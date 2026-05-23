import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchPackageMeta, fetchDownloadsRange } from "@/lib/npm";

export const runtime = "nodejs";

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/** True when the current session belongs to the configured portfolio owner. */
async function requireOwner() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const owner = process.env.OWNER_GITHUB_LOGIN;
  const login = user?.user_metadata?.user_name as string | undefined;
  return Boolean(user && owner && login === owner);
}

/** Add a package to the portfolio (owner only): validate, insert, load now. */
export async function POST(req: Request) {
  if (!(await requireOwner())) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  const { name } = (await req.json().catch(() => ({}))) as { name?: string };
  if (!name?.trim()) {
    return Response.json({ error: "name required" }, { status: 400 });
  }

  let meta;
  try {
    meta = await fetchPackageMeta(name.trim());
  } catch {
    return Response.json({ error: "package not found" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: pkg, error } = await admin
    .from("packages")
    .upsert(
      {
        name: name.trim(),
        latest_version: meta.latestVersion,
        last_published_at: meta.lastPublishedAt,
        repo_owner: meta.repo?.owner ?? null,
        repo_name: meta.repo?.repo ?? null,
        backfill_status: meta.repo ? "pending" : "none",
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: "name" },
    )
    .select("id")
    .single();
  if (error || !pkg) {
    return Response.json({ error: error?.message ?? "insert failed" }, { status: 500 });
  }

  // Load recent downloads inline (stars/backfill come from the sync Action).
  try {
    const now = new Date();
    const points = await fetchDownloadsRange(
      name.trim(),
      isoDate(new Date(now.getTime() - 40 * 86_400_000)),
      isoDate(now),
    );
    const rows = points
      .filter((p) => p.downloads != null)
      .map((p) => ({ package_id: pkg.id, day: p.day, downloads: p.downloads }));
    if (rows.length) {
      await admin
        .from("download_daily")
        .upsert(rows, { onConflict: "package_id,day" });
    }
  } catch {
    // brand-new package without downloads yet; fine.
  }

  return Response.json({ ok: true, id: pkg.id });
}

/** Remove a package from the portfolio (owner only). */
export async function DELETE(req: Request) {
  if (!(await requireOwner())) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  const { name } = (await req.json().catch(() => ({}))) as { name?: string };
  if (!name?.trim()) {
    return Response.json({ error: "name required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("packages")
    .delete()
    .eq("name", name.trim());
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ ok: true });
}
