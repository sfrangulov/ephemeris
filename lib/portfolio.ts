import { cache } from "react";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  momentumStatus,
  weeklyBuckets,
  weeklyStarDelta,
  type Status,
} from "@/lib/aggregate";
import { relAgo } from "@/lib/freshness";

/** Shape of one package inside the `portfolio_badge` RPC jsonb result. */
interface RpcPackage {
  id: number;
  name: string;
  latest_version: string | null;
  last_published_at: string | null;
  last_synced_at: string | null;
  downloads: { day: string; downloads: number }[];
  stars: { day: string; stars_total: number; stars_delta: number }[];
}

interface PortfolioBadgeRpc {
  profile: { user_id: string; is_public: boolean };
  packages: RpcPackage[];
}

export interface PortfolioPackage {
  id: number;
  name: string;
  latestVersion: string | null;
  lastPublishedAt: string | null;
  weeks: number[];
  status: Status;
  lastWeekDownloads: number;
  deltaDownloads: number;
  starsTotal: number;
  /** Net stars gained in the trailing 7 days (week-over-week), parallel to
   *  `deltaDownloads`. Honest 7-day sum, not the daily last-row delta. */
  deltaStars: number;
  starsSeries: number[];
}

export interface PortfolioSnapshot {
  packages: PortfolioPackage[];
  freshness: string | null;
  globalMaxDl: number;
  /** Sum of weekly downloads across all tracked packages, 13 weeks newest-last. */
  weeklyTotals: number[];
  profile: { userId: string; isPublic: boolean };
}

/**
 * Load a maintainer's portfolio by profile slug, or `null` if the slug is
 * unknown or the profile is private and not viewed by its owner. Cached per
 * request via React `cache()` keyed on slug+viewer. The badge routes use this
 * directly so they can emit a *cacheable* 404; the dashboard pages use the
 * throwing `loadPortfolio` wrapper below.
 */
export const loadPortfolioOrNull = cache(
  async (
    slug: string,
    viewerUserId: string | null = null,
  ): Promise<PortfolioSnapshot | null> => {
    // Single round-trip: the portfolio_badge RPC does the profile gate,
    // watchlist->packages join, date-bounded downloads, and unbounded star tail
    // in one hop (replaces the previous 4 sequential trans-region queries).
    // Uses the admin client because the function is service_role-only (its
    // SECURITY DEFINER body enforces the privacy gate itself). No cookies read
    // here, so badge/marketing responses stay CDN-cacheable.
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("portfolio_badge", {
      p_slug: slug,
      p_viewer: viewerUserId,
    });
    if (error) throw error;
    // jsonb-returning RPC: supabase-js yields the object directly; guard the
    // scalar-array wrap defensively.
    const blob = (Array.isArray(data) ? data[0] : data) as
      | PortfolioBadgeRpc
      | null;
    if (!blob) return null; // unknown slug or private-not-owner
    const { profile } = blob;
    // Defense-in-depth: the SQL gate already enforced this; re-check in TS.
    if (!profile.is_public && profile.user_id !== viewerUserId) return null;

    // Exclude today's row from bucketing — npm Downloads API returns 0 for
    // the current UTC day until it's aggregated (delay ~24h). Including it
    // shifts our trailing-7d window vs npm's canonical /point/last-week and
    // under-reports both the last-week sum and the w/w delta. See DESIGN.md
    // §Honest data layer.
    const todayUtc = new Date().toISOString().slice(0, 10);
    const enriched: PortfolioPackage[] = (blob.packages ?? []).map((p) => {
      const daily = (p.downloads ?? []).filter((r) => r.day < todayUtc);
      const weeks = weeklyBuckets(daily, 13);
      const last = weeks.at(-1) ?? 0;
      const prev = weeks.at(-2) ?? 0;
      const starHistory = p.stars ?? [];
      const lastStar = starHistory.at(-1);
      const starsTotal = lastStar?.stars_total ?? 0;
      return {
        id: p.id,
        name: p.name,
        latestVersion: p.latest_version,
        lastPublishedAt: p.last_published_at,
        weeks,
        status: momentumStatus(last, prev),
        lastWeekDownloads: last,
        deltaDownloads: last - prev,
        starsTotal,
        deltaStars: weeklyStarDelta(starHistory),
        starsSeries: weeklyStars(starHistory, weeks.length),
      };
    });

    enriched.sort((a, b) => b.lastWeekDownloads - a.lastWeekDownloads);

    const allBuckets = enriched.flatMap((p) => p.weeks).filter((v) => v > 0);
    const globalMaxDl = quantile(allBuckets, 0.9);
    const weeklyTotals = sumWeekly(enriched.map((p) => p.weeks));

    const oldestSync =
      (blob.packages ?? [])
        .map((p) => p.last_synced_at)
        .filter((s): s is string => Boolean(s))
        .sort()
        .at(0) ?? null;

    return {
      packages: enriched,
      freshness: relAgo(oldestSync),
      globalMaxDl,
      weeklyTotals,
      profile: { userId: profile.user_id, isPublic: profile.is_public },
    };
  },
);

/**
 * Throwing variant of {@link loadPortfolioOrNull}: `notFound()` on an unknown
 * or private-not-owner slug. Used by the dashboard RSC pages (`/u/[slug]`,
 * marketing demo, OG card) which want a 404, not a null. Reuses the cached
 * loader underneath, so the single RPC still runs at most once per request.
 */
export async function loadPortfolio(
  slug: string,
  viewerUserId: string | null = null,
): Promise<PortfolioSnapshot> {
  const snapshot = await loadPortfolioOrNull(slug, viewerUserId);
  if (!snapshot) notFound();
  return snapshot;
}

/**
 * Last cumulative star total per ISO-week, newest last, length aligned to the
 * provided week count. Previously this was a flat-line stub (current total
 * repeated N times) — visually implied a stable trend that wasn't measured.
 */
function weeklyStars(
  history: { day: string; stars_total: number }[],
  weeks: number,
): number[] {
  if (weeks === 0 || history.length === 0) return [];
  const byWeek = new Map<number, number>();
  const now = Date.now();
  for (const row of history) {
    const ageDays = Math.floor((now - new Date(row.day).getTime()) / 86_400_000);
    const w = weeks - 1 - Math.floor(ageDays / 7);
    if (w < 0 || w >= weeks) continue;
    byWeek.set(w, row.stars_total);
  }
  const out = new Array<number>(weeks).fill(0);
  let last = 0;
  for (let i = 0; i < weeks; i++) {
    if (byWeek.has(i)) last = byWeek.get(i)!;
    out[i] = last;
  }
  return out;
}

/** Linear-interpolation quantile of a numeric array (small n is fine). */
function quantile(values: number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/**
 * Element-wise sum of weekly buckets across packages, aligned to the same
 * trailing 13-week window. Packages with shorter histories pad with 0s at
 * the start so all series end on "this week" before we sum.
 */
function sumWeekly(series: number[][]): number[] {
  const len = Math.max(0, ...series.map((s) => s.length));
  if (len === 0) return [];
  const out = new Array<number>(len).fill(0);
  for (const s of series) {
    const offset = len - s.length;
    for (let i = 0; i < s.length; i++) {
      out[i + offset] += s[i];
    }
  }
  return out;
}

