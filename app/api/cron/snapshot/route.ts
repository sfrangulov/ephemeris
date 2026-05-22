import { createAdminClient } from "@/lib/supabase/admin";
import { fetchDownloadsRange, fetchPackageMeta } from "@/lib/npm";
import { fetchRepoStats } from "@/lib/github";

export const runtime = "nodejs";
export const maxDuration = 60;

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Daily snapshot. Vercel Cron calls this with `Authorization: Bearer
 * <CRON_SECRET>` (injected automatically when CRON_SECRET env is set). For
 * each tracked package: add recent download points, refresh registry metadata,
 * and record today's star total. Idempotent via upsert on the composite PKs.
 */
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createAdminClient();
  const githubToken = process.env.GITHUB_TOKEN;

  const now = new Date();
  const to = isoDate(now);
  const from = isoDate(new Date(now.getTime() - 40 * 86_400_000));

  const { data: packages, error } = await supabase.from("packages").select("*");
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const results: Array<{ pkg: string; ok: boolean; error?: string }> = [];

  for (const pkg of packages ?? []) {
    try {
      // 1. Downloads — recent daily points.
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

      // 2. Registry metadata + repo resolution.
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

      // 3. Current star total (needs a GitHub token for reliable rate limits).
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

      results.push({ pkg: pkg.name, ok: true });
    } catch (e) {
      results.push({ pkg: pkg.name, ok: false, error: String(e) });
    }
  }

  return Response.json({ synced: results.length, results });
}
