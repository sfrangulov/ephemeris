/**
 * Unified portfolio sync (GitHub Actions worker). The single data pipeline:
 *   1. discover packages from npm by maintainer, register new ones
 *   2. per package: recent downloads + registry metadata + current stars
 *   3. one-time stargazer-history backfill for newly-resolved repos
 *
 * Runs outside Next (no serverless timeout). Idempotent via composite-PK
 * upserts. Env: NPM_MAINTAINER (default sfrangulov), NEXT_PUBLIC_SUPABASE_URL,
 * SUPABASE_SECRET_KEY, GITHUB_TOKEN.
 * Local: `set -a; . ./.env.local; set +a; npx tsx scripts/sync.ts`
 */
import { createAdminClient } from "../lib/supabase/admin";
import {
  fetchPackagesByMaintainer,
  fetchDownloadsRange,
  fetchPackageMeta,
} from "../lib/npm";
import { fetchRepoStats, backfillStargazers } from "../lib/github";
import { starDailyFromTimestamps } from "../lib/aggregate";

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

async function main() {
  const maintainer = process.env.NPM_MAINTAINER || "sfrangulov";
  const githubToken = process.env.GITHUB_TOKEN;
  const supabase = createAdminClient();

  // 1. Discover from npm and register new packages.
  const names = await fetchPackagesByMaintainer(maintainer);
  console.log(`discovered ${names.length} packages for ${maintainer}`);
  if (names.length) {
    const { error } = await supabase
      .from("packages")
      .upsert(names.map((name) => ({ name })), {
        onConflict: "name",
        ignoreDuplicates: true,
      });
    if (error) throw new Error(`register: ${error.message}`);
  }

  const { data: packages, error } = await supabase.from("packages").select("*");
  if (error) throw new Error(error.message);

  const now = new Date();
  const to = isoDate(now);
  const from = isoDate(new Date(now.getTime() - 40 * 86_400_000));

  // 2. Downloads + metadata + current stars.
  for (const pkg of packages ?? []) {
    try {
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
          await supabase
            .from("download_daily")
            .upsert(rows, { onConflict: "package_id,day" });
        }
      } catch (e) {
        // Brand-new packages have no downloads endpoint yet (404); keep going.
        if (!String(e).includes("404")) throw e;
      }

      const meta = await fetchPackageMeta(pkg.name);
      const update: Record<string, unknown> = {
        latest_version: meta.latestVersion,
        last_published_at: meta.lastPublishedAt,
        last_synced_at: now.toISOString(),
      };
      if (meta.repo) {
        update.repo_owner = meta.repo.owner;
        update.repo_name = meta.repo.repo;
        if (pkg.backfill_status === "none") update.backfill_status = "pending";
      }
      await supabase.from("packages").update(update).eq("id", pkg.id);

      const owner = meta.repo?.owner ?? pkg.repo_owner;
      const repo = meta.repo?.repo ?? pkg.repo_name;
      if (owner && repo && githubToken) {
        const stats = await fetchRepoStats(owner, repo, githubToken);
        const { data: prior } = await supabase
          .from("star_daily")
          .select("stars_total")
          .eq("package_id", pkg.id)
          .lt("day", to)
          .order("day", { ascending: false })
          .limit(1)
          .maybeSingle();
        const prevTotal = prior?.stars_total ?? 0;
        await supabase.from("star_daily").upsert(
          {
            package_id: pkg.id,
            day: to,
            stars_total: stats.stars,
            stars_delta: stats.stars - prevTotal,
          },
          { onConflict: "package_id,day" },
        );
      }
      console.log(`synced ${pkg.name}`);
    } catch (e) {
      console.error(`sync ${pkg.name}: ${String(e)}`);
    }
  }

  // 3. One-time star-history backfill for newly-resolved repos.
  if (!githubToken) {
    console.warn("no GITHUB_TOKEN: skipping star backfill");
    return;
  }
  const { data: pending } = await supabase
    .from("packages")
    .select("id, name, repo_owner, repo_name")
    .eq("backfill_status", "pending")
    .not("repo_owner", "is", null)
    .not("repo_name", "is", null);
  for (const pkg of pending ?? []) {
    try {
      const { timestamps, truncated } = await backfillStargazers(
        pkg.repo_owner!,
        pkg.repo_name!,
        githubToken,
      );
      const rows = starDailyFromTimestamps(timestamps).map((r) => ({
        package_id: pkg.id,
        ...r,
      }));
      if (rows.length) {
        await supabase
          .from("star_daily")
          .upsert(rows, { onConflict: "package_id,day" });
      }
      await supabase
        .from("packages")
        .update({ backfill_status: truncated ? "truncated" : "done" })
        .eq("id", pkg.id);
      console.log(
        `backfilled ${pkg.name}: ${rows.length} star-days${truncated ? " (truncated)" : ""}`,
      );
    } catch (e) {
      console.error(`backfill ${pkg.name}: ${String(e)}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
