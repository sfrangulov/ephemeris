import { fetchDownloadsRange, fetchPackageMeta } from "@/lib/npm";
import { fetchRepoStats } from "@/lib/github";
import type { SupabaseClient } from "@supabase/supabase-js";

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export interface SyncablePackage {
  id: number;
  name: string;
  repo_owner: string | null;
  repo_name: string | null;
  backfill_status: string;
}

export interface SyncOptions {
  githubToken?: string;
  /** Most recent stars_total observed before today, for delta computation.
   * Pass 0 for first-observation (bootstrap). */
  priorStarsTotal?: number;
}

/**
 * Sync downloads + metadata + current stars for ONE package. Idempotent.
 * Shared by the recurring cron (`scripts/sync.ts`) and the lightweight
 * bootstrap on first OAuth callback. Errors inside the per-step subtasks
 * are partially tolerated (404 on downloads is swallowed); other failures
 * bubble to the caller's per-package try/catch.
 */
export async function syncPackage(
  admin: SupabaseClient,
  pkg: SyncablePackage,
  now: Date,
  options: SyncOptions = {},
): Promise<void> {
  const { githubToken, priorStarsTotal = 0 } = options;
  const to = isoDate(now);
  const from = isoDate(new Date(now.getTime() - 40 * 86_400_000));

  let dlOk = false;
  try {
    const points = await fetchDownloadsRange(pkg.name, from, to);
    const rows = points
      .filter((p) => p.downloads != null)
      .map((p) => ({
        package_id: pkg.id,
        day: p.day,
        downloads: p.downloads,
      }));
    if (rows.length) {
      await admin
        .from("download_daily")
        .upsert(rows, { onConflict: "package_id,day" });
    }
    dlOk = true;
  } catch (e) {
    if (!String(e).includes("404")) throw e;
  }

  const meta = await fetchPackageMeta(pkg.name);
  const update: Record<string, unknown> = {
    latest_version: meta.latestVersion,
    last_published_at: meta.lastPublishedAt,
  };
  if (dlOk) update.last_synced_at = now.toISOString();
  if (meta.repo) {
    update.repo_owner = meta.repo.owner;
    update.repo_name = meta.repo.repo;
    if (pkg.backfill_status === "none") update.backfill_status = "pending";
  }
  await admin.from("packages").update(update).eq("id", pkg.id);

  const owner = meta.repo?.owner ?? pkg.repo_owner;
  const repo = meta.repo?.repo ?? pkg.repo_name;
  if (owner && repo && githubToken) {
    const stats = await fetchRepoStats(owner, repo, githubToken);
    await admin.from("star_daily").upsert(
      {
        package_id: pkg.id,
        day: to,
        stars_total: stats.stars,
        stars_delta: stats.stars - priorStarsTotal,
      },
      { onConflict: "package_id,day" },
    );
  }
}
