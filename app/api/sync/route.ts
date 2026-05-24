import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const REPO = "sfrangulov/ephemeris";
const WORKFLOW_FILE = "sync.yml";
const REF = "main";
const TOKEN = process.env.GITHUB_TOKEN;
const OWNER_LOGIN = process.env.OWNER_GITHUB_LOGIN;

export async function POST() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const login = auth?.user?.user_metadata?.user_name as string | undefined;
  if (!OWNER_LOGIN || login !== OWNER_LOGIN) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!TOKEN) {
    return NextResponse.json(
      { error: "GITHUB_TOKEN not set" },
      { status: 500 },
    );
  }
  const r = await fetch(
    `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ ref: REF }),
    },
  );
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    return NextResponse.json(
      { error: `github ${r.status}: ${text.slice(0, 200)}` },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true });
}
