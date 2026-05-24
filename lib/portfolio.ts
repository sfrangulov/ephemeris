import { cache } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { momentumStatus, weeklyBuckets, type Status } from "@/lib/aggregate";

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
 * Load a maintainer's portfolio by profile slug. Throws `notFound()` if the
 * slug is unknown or the profile is private and not viewed by its owner.
 * Cached per request via React `cache()` keyed on slug+viewer.
 */
export const loadPortfolio = cache(
  async (
    slug: string,
    viewerUserId: string | null = null,
  ): Promise<PortfolioSnapshot> => {
    const supabase = await createClient();

    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id, is_public")
      .eq("slug", slug)
      .maybeSingle();
    if (!profile) notFound();
    if (!profile.is_public && profile.user_id !== viewerUserId) notFound();

    const { data: watchlistRows } = await supabase
      .from("watchlist")
      .select("package_id")
      .eq("user_id", profile.user_id);
    const ids = (watchlistRows ?? []).map((r) => r.package_id);
    if (ids.length === 0) {
      return {
        packages: [],
        freshness: null,
        globalMaxDl: 0,
        weeklyTotals: [],
        profile: { userId: profile.user_id, isPublic: profile.is_public },
      };
    }

    const { data: packages } = await supabase
      .from("packages")
      .select("id, name, latest_version, last_published_at, last_synced_at")
      .in("id", ids);

    const pkgIds = (packages ?? []).map((p) => p.id);
    const [{ data: downloads }, { data: starsData }] = await Promise.all([
      supabase
        .from("download_daily")
        .select("package_id, day, downloads")
        .in("package_id", pkgIds)
        .order("day"),
      supabase
        .from("star_daily")
        .select("package_id, day, stars_total, stars_delta")
        .in("package_id", pkgIds)
        .order("day"),
    ]);

    // Exclude today's row from bucketing — npm Downloads API returns 0 for
    // the current UTC day until it's aggregated (delay ~24h). Including it
    // shifts our trailing-7d window vs npm's canonical /point/last-week and
    // under-reports both the last-week sum and the w/w delta. See DESIGN.md
    // §Honest data layer.
    const todayUtc = new Date().toISOString().slice(0, 10);
    const dlByPkg = new Map<number, { day: string; downloads: number }[]>();
    for (const row of downloads ?? []) {
      if (row.day >= todayUtc) continue;
      const list = dlByPkg.get(row.package_id) ?? [];
      list.push({ day: row.day, downloads: row.downloads });
      dlByPkg.set(row.package_id, list);
    }
    const starByPkg = new Map<
      number,
      { day: string; stars_total: number; stars_delta: number }[]
    >();
    for (const row of starsData ?? []) {
      const list = starByPkg.get(row.package_id) ?? [];
      list.push(row);
      starByPkg.set(row.package_id, list);
    }

    const enriched: PortfolioPackage[] = (packages ?? []).map((p) => {
      const weeks = weeklyBuckets(dlByPkg.get(p.id) ?? [], 13);
      const last = weeks.at(-1) ?? 0;
      const prev = weeks.at(-2) ?? 0;
      const starHistory = starByPkg.get(p.id) ?? [];
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
        deltaStars: lastStar?.stars_delta ?? 0,
        starsSeries: weeklyStars(starHistory, weeks.length),
      };
    });

    enriched.sort((a, b) => b.lastWeekDownloads - a.lastWeekDownloads);

    const allBuckets = enriched.flatMap((p) => p.weeks).filter((v) => v > 0);
    const globalMaxDl = quantile(allBuckets, 0.9);
    const weeklyTotals = sumWeekly(enriched.map((p) => p.weeks));

    const oldestSync = (packages ?? [])
      .map((p) => p.last_synced_at as string | null)
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

/** "2h ago" / "today" / "stale" — coarse freshness for the sidebar pill. */
function relAgo(iso: string | null): string | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return null;
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return mins <= 1 ? "just now" : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 26) return `${hrs}h ago`;
  return "stale";
}
