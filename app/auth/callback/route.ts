import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  fetchPackagesByMaintainer,
  fetchDownloadsRange,
  fetchPackageMeta,
} from "@/lib/npm";
import { fetchRepoStats } from "@/lib/github";

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/**
 * OAuth callback. Exchanges code for session, ensures a profile row,
 * runs a lightweight first-sync (discovery + recent downloads + current
 * stars, no stargazer backfill), then redirects to /u/[slug].
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  const supabase = await createClient();
  const { error: exchErr } = await supabase.auth.exchangeCodeForSession(code);
  if (exchErr) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  const slug =
    (user.user_metadata?.user_name as string | undefined) ?? user.id.slice(0, 8);

  // 1. ensure profile exists
  await supabase
    .from("profiles")
    .upsert(
      { user_id: user.id, slug },
      { onConflict: "user_id", ignoreDuplicates: true },
    );

  // 2. lightweight bootstrap sync (best-effort; failures don't block redirect)
  try {
    await bootstrapSync(user.id, slug);
  } catch (e) {
    console.error(`bootstrap ${slug}: ${String(e)}`);
  }

  return NextResponse.redirect(`${origin}/u/${slug}`);
}

async function bootstrapSync(userId: string, slug: string) {
  const admin = createAdminClient();
  const githubToken = process.env.GITHUB_TOKEN;

  const names = await fetchPackagesByMaintainer(slug);
  if (names.length === 0) return;

  await admin
    .from("packages")
    .upsert(names.map((name) => ({ name })), {
      onConflict: "name",
      ignoreDuplicates: true,
    });

  const { data: pkgRows } = await admin
    .from("packages")
    .select("id, name, repo_owner, repo_name, backfill_status")
    .in("name", names);
  const pkgs = pkgRows ?? [];

  if (pkgs.length) {
    await admin.from("watchlist").upsert(
      pkgs.map((p) => ({ user_id: userId, package_id: p.id })),
      { onConflict: "user_id,package_id", ignoreDuplicates: true },
    );
  }

  const now = new Date();
  const to = isoDate(now);
  const from = isoDate(new Date(now.getTime() - 40 * 86_400_000));

  for (const pkg of pkgs) {
    try {
      let dlOk = false;
      try {
        const points = await fetchDownloadsRange(pkg.name, from, to);
        const rows = points
          .filter((p) => p.downloads != null)
          .map((p) => ({ package_id: pkg.id, day: p.day, downloads: p.downloads }));
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
            stars_delta: 0,
          },
          { onConflict: "package_id,day" },
        );
      }
    } catch (e) {
      console.error(`bootstrap ${pkg.name}: ${String(e)}`);
    }
  }
}
