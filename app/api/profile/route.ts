import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  // Defense-in-depth CSRF check: SameSite=Lax cookies already block
  // cross-site POSTs, but verify Origin/Host match explicitly.
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin && host && new URL(origin).host !== host) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as { is_public?: boolean };
  if (typeof body.is_public !== "boolean") {
    return NextResponse.json({ error: "is_public boolean required" }, { status: 400 });
  }
  const { error } = await supabase
    .from("profiles")
    .update({ is_public: body.is_public })
    .eq("user_id", user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
