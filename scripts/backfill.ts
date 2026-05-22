/**
 * Stargazer-history backfill worker. Runs outside Next (GitHub Actions or
 * locally) because paging hundreds of stargazer pages exceeds the serverless
 * timeout. Picks up packages flagged `backfill_status='pending'`, reconstructs
 * their daily star history, and marks them `done` (or `truncated` at the cap).
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, GITHUB_TOKEN.
 * Local run: `set -a; . ./.env.local; set +a; npx tsx scripts/backfill.ts`
 */
import { createAdminClient } from "../lib/supabase/admin";
import { backfillStargazers } from "../lib/github";
import { starDailyFromTimestamps } from "../lib/aggregate";

async function main() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is required for backfill");

  const supabase = createAdminClient();

  const { data: packages, error } = await supabase
    .from("packages")
    .select("id, name, repo_owner, repo_name")
    .eq("backfill_status", "pending")
    .not("repo_owner", "is", null)
    .not("repo_name", "is", null);
  if (error) throw new Error(error.message);

  if (!packages?.length) {
    console.log("nothing pending");
    return;
  }

  for (const pkg of packages) {
    try {
      const { timestamps, truncated } = await backfillStargazers(
        pkg.repo_owner!,
        pkg.repo_name!,
        token,
      );
      const rows = starDailyFromTimestamps(timestamps).map((r) => ({
        package_id: pkg.id,
        ...r,
      }));
      if (rows.length) {
        const { error: upErr } = await supabase
          .from("star_daily")
          .upsert(rows, { onConflict: "package_id,day" });
        if (upErr) throw new Error(upErr.message);
      }
      await supabase
        .from("packages")
        .update({ backfill_status: truncated ? "truncated" : "done" })
        .eq("id", pkg.id);
      console.log(
        `${pkg.name}: ${rows.length} star-days${truncated ? " (truncated)" : ""}`,
      );
    } catch (e) {
      console.error(`${pkg.name}: ${String(e)}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
