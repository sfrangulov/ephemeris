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
import { fetchPackagesByMaintainer } from "../lib/npm";
import { backfillStargazers } from "../lib/github";
import { starDailyFromTimestamps } from "../lib/aggregate";
import { syncPackage } from "../lib/sync";

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

  // TODO(v3): at N>10 profiles this loop will start hitting npm-registry
  // search rate limits (~5 req/s). Add p-limit-style concurrency cap +
  // jitter when usage grows.
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

  for (const pkg of packages ?? []) {
    try {
      const { data: prior } = await supabase
        .from("star_daily")
        .select("stars_total")
        .eq("package_id", pkg.id)
        .lt("day", to)
        .order("day", { ascending: false })
        .limit(1)
        .maybeSingle();
      const priorStarsTotal = prior?.stars_total ?? 0;
      await syncPackage(supabase, pkg, now, { githubToken, priorStarsTotal });
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
