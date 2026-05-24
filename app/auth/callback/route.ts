import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchPackagesByMaintainer } from "@/lib/npm";
import { syncPackage } from "@/lib/sync";

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

  const oauthSlug =
    (user.user_metadata?.user_name as string | undefined) ?? user.id.slice(0, 8);

  // Look up existing profile first. Bootstrap runs ONLY for new profiles —
  // otherwise every login would re-discover + re-sync the maintainer's whole
  // portfolio (~8s for 16 packages), which is wasted work and bad UX.
  const { data: existing } = await supabase
    .from("profiles")
    .select("slug")
    .eq("user_id", user.id)
    .maybeSingle();

  // Returning users keep their stored slug (handles GitHub rename — the URL
  // they own may differ from current OAuth user_name).
  const finalSlug = existing?.slug ?? oauthSlug;

  if (!existing) {
    // First login: insert profile + run inline bootstrap. The upsert form
    // is defensive against a concurrent callback race (both requests would
    // race the insert; second one no-ops via onConflict).
    await supabase
      .from("profiles")
      .upsert(
        { user_id: user.id, slug: oauthSlug },
        { onConflict: "user_id", ignoreDuplicates: true },
      );
    try {
      await bootstrapSync(user.id, oauthSlug);
    } catch (e) {
      console.error(`bootstrap ${oauthSlug}: ${String(e)}`);
    }
  }

  return NextResponse.redirect(`${origin}/u/${finalSlug}`);
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

  for (const pkg of pkgs) {
    try {
      await syncPackage(admin, pkg, now, { githubToken, priorStarsTotal: 0 });
    } catch (e) {
      console.error(`bootstrap ${pkg.name}: ${String(e)}`);
    }
  }
}
