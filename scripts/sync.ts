/**
 * Unified portfolio sync (GitHub Actions worker). For each profile:
 *   1. discover packages from npm by maintainer = profile.slug
 *   2. register new packages, link them in that user's watchlist
 * Then globally (all known packages):
 *   3. downloads + registry meta + current stars
 *   4. one-time stargazer-history backfill for backfill_status='pending'
 *
 * Runs outside Next (no serverless timeout). Idempotent via composite-PK
 * upserts. Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, GITHUB_TOKEN.
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
  const githubToken = process.env.GITHUB_TOKEN;
  const supabase = createAdminClient();

  // 1+2. Per-profile discovery and watchlist linking.
  const { data: profiles, error: profErr } = await supabase
    .from("profiles")
    .select("user_id, slug");
  if (profErr) throw new Error(`profiles: ${profErr.message}`);
  console.log(`iterating ${profiles?.length ?? 0} profiles`);

  for (const profile of profiles ?? []) {
    try {
      const names = await fetchPackagesByMaintainer(profile.slug);
      if (names.length === 0) {
        console.log(`discovered 0 packages for ${profile.slug}`);
        continue;
      }
      console.log(`discovered ${names.length} packages for ${profile.slug}`);
      await supabase.from("packages").upsert(
        names.map((name) => ({ name })),
        { onConflict: "name", ignoreDuplicates: true },
      );
      const { data: pkgRows } = await supabase
        .from("packages")
        .select("id, name")
        .in("name", names);
      const links = (pkgRows ?? []).map((p) => ({
        user_id: profile.user_id,
        package_id: p.id,
      }));
      if (links.length) {
        await supabase
          .from("watchlist")
          .upsert(links, { onConflict: "user_id,package_id", ignoreDuplicates: true });
      }
    } catch (e) {
      console.error(`discovery ${profile.slug}: ${String(e)}`);
    }
  }

  // 3. Downloads + metadata + current stars for ALL packages.
  const { data: packages, error: pkgErr } = await supabase
    .from("packages")
    .select("*");
  if (pkgErr) throw new Error(pkgErr.message);

  const now = new Date();
  const to = isoDate(now);
  const from = isoDate(new Date(now.getTime() - 40 * 86_400_000));

  for (const pkg of packages ?? []) {
    try {
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
          await supabase
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

  // 4. One-time star-history backfill for newly-resolved repos.
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
