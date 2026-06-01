import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchPortfolioSnapshot, type PortfolioPackage } from "@/lib/portfolio";
import {
  computeInsights,
  selectInsights,
  toFacts,
  toStackItems,
  type PackageStat,
  type VersionDownload,
  type WeeklyInsightPayload,
} from "@/lib/phrase";

/**
 * Pre-generation bridge: portfolio data -> weekly-insight payload (sync-side).
 *
 * Downloads come from the honest weekly buckets already computed by
 * `loadPortfolio` (today-UTC-filtered upstream). Per-version downloads (latest
 * npm last-week window, stable only) feed the version-EOL rule and are fetched
 * separately during sync — never on the badge/page hot path — so the surface
 * only ever reads the cached payload.
 */

/** One `version_download_weekly` row, as selected during sync. */
export interface VersionRow {
  package_id: number;
  week_ending: string;
  version: string;
  downloads: number;
}

/** Whole days since an ISO timestamp, or null if absent/unparseable. */
export function daysSince(
  iso: string | null,
  nowMs: number = Date.now(),
): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.floor((nowMs - then) / 86_400_000);
}

/**
 * Collapse raw `version_download_weekly` rows to the LATEST week per package:
 * `package_id -> [{version, downloads}]`. npm only exposes per-version downloads
 * for last-week, so a package usually has one window; this picks the newest
 * `week_ending` defensively when several have accumulated.
 */
export function latestWeekVersions(
  rows: VersionRow[],
): Map<number, VersionDownload[]> {
  const maxWeek = new Map<number, string>();
  for (const r of rows) {
    const cur = maxWeek.get(r.package_id);
    if (!cur || r.week_ending > cur) maxWeek.set(r.package_id, r.week_ending);
  }
  const out = new Map<number, VersionDownload[]>();
  for (const r of rows) {
    if (r.week_ending !== maxWeek.get(r.package_id)) continue;
    const arr = out.get(r.package_id) ?? [];
    arr.push({ version: r.version, downloads: r.downloads });
    out.set(r.package_id, arr);
  }
  return out;
}

/**
 * Adapt loaded portfolio packages into weekly-insight `PackageStat[]`:
 * `downloads = weeks.at(-1)`, `prevDownloads = weeks.at(-2)` (both honest,
 * today-filtered buckets), `lastPublishDays` from the publish timestamp, and
 * optional per-version downloads keyed by package id.
 */
export function toPackageStats(
  packages: PortfolioPackage[],
  versionsById: Map<number, VersionDownload[]> = new Map(),
  nowMs: number = Date.now(),
): PackageStat[] {
  return packages.map((p) => ({
    name: p.name,
    downloads: p.weeks.at(-1) ?? 0,
    prevDownloads: p.weeks.at(-2) ?? 0,
    lastPublishDays: daysSince(p.lastPublishedAt, nowMs),
    versions: versionsById.get(p.id),
  }));
}

/**
 * Build the cached weekly-insight payload for one profile, or null for an empty
 * portfolio. The stack is DETERMINISTIC: the top-salience insights with a
 * recommendation guaranteed present ({@link selectInsights}). LLM phrasing was
 * dropped — the blind A/B gate found no edge over the computed insight for a
 * single line, and the multi-line stack already surfaces both the lead and the
 * actionable recommendation. Honest by construction, cheap (no inference).
 */
export function buildWeeklyInsight(
  packages: PortfolioPackage[],
  versionsById: Map<number, VersionDownload[]>,
  generatedAt: string,
  nowMs: number = Date.now(),
): WeeklyInsightPayload | null {
  const stats = toPackageStats(packages, versionsById, nowMs);
  if (stats.length === 0) return null;
  const candidates = computeInsights(toFacts(stats));
  const stack = toStackItems(selectInsights(candidates, 3));
  return { stack, generated_at: generatedAt };
}

/**
 * Pre-generate + cache the weekly-insight payload for every profile (sync-side).
 * One LLM lead-selection per profile (degrades to the deterministic stack
 * without `DEEPSEEK_API_KEY`); per-version data is fetched here, off the
 * badge/page hot path. Per-profile failures are logged and skipped, never fatal.
 */
export async function pregenWeeklyInsights(
  admin: SupabaseClient,
  generatedAt: string,
): Promise<void> {
  const { data: profiles, error } = await admin
    .from("profiles")
    .select("user_id, slug");
  if (error) throw new Error(`profiles: ${error.message}`);

  for (const profile of profiles ?? []) {
    try {
      const snap = await fetchPortfolioSnapshot(profile.slug, profile.user_id);
      if (!snap || snap.packages.length === 0) continue;
      const { data: vrows } = await admin
        .from("version_download_weekly")
        .select("package_id, week_ending, version, downloads")
        .in(
          "package_id",
          snap.packages.map((p) => p.id),
        );
      const versionsById = latestWeekVersions((vrows ?? []) as VersionRow[]);
      const payload = buildWeeklyInsight(
        snap.packages,
        versionsById,
        generatedAt,
      );
      if (!payload) continue;
      await admin
        .from("profiles")
        .update({ weekly_insight: payload })
        .eq("user_id", profile.user_id);
      console.log(
        `insight ${profile.slug}: ${payload.stack.length} lines (lead: ${payload.stack[0]?.text.slice(0, 60)})`,
      );
    } catch (e) {
      console.error(`insight ${profile.slug}: ${String(e)}`);
    }
  }
}
