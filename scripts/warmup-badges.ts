/**
 * Best-effort CDN warmup for badge SVGs after a successful sync.
 *
 * Fetches every public profile's portfolio badge + per-package variants so
 * Vercel's edge cache is populated before any reader (GitHub Camo, browser)
 * hits a cold function. Failures are logged, not raised — warmup must never
 * break the sync workflow. Env: same as sync (SUPABASE secrets).
 */
import { createAdminClient } from "../lib/supabase/admin";

const BASE_URL = process.env.WARMUP_BASE_URL ?? "https://ephemeris.tools";
const VARIANTS = [
  "momentum.svg",
  "sparkline.svg",
  "stars.svg",
  "card.svg",
] as const;
const CONCURRENCY = 5;

type Result = { url: string; ok: boolean; status: number };

async function fetchUrl(url: string): Promise<Result> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "ephemeris-warmup/1" },
    });
    await res.arrayBuffer(); // drain body so the CDN actually finishes
    return { url, ok: res.ok, status: res.status };
  } catch {
    return { url, ok: false, status: 0 };
  }
}

async function runChunked(urls: string[]): Promise<Result[]> {
  const out: Result[] = [];
  for (let i = 0; i < urls.length; i += CONCURRENCY) {
    const chunk = urls.slice(i, i + CONCURRENCY);
    const settled = await Promise.all(chunk.map(fetchUrl));
    out.push(...settled);
  }
  return out;
}

async function main() {
  const supabase = createAdminClient();
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("user_id, slug")
    .eq("is_public", true);
  if (error) throw new Error(`profiles: ${error.message}`);
  console.log(`warming badges for ${profiles?.length ?? 0} public profiles`);

  const urls: string[] = [];
  for (const profile of profiles ?? []) {
    urls.push(`${BASE_URL}/badge/${profile.slug}`);
    const { data: wl } = await supabase
      .from("watchlist")
      .select("package_id")
      .eq("user_id", profile.user_id);
    const ids = (wl ?? []).map((r) => r.package_id);
    if (ids.length === 0) continue;
    const { data: pkgs } = await supabase
      .from("packages")
      .select("name")
      .in("id", ids);
    for (const pkg of pkgs ?? []) {
      for (const variant of VARIANTS) {
        urls.push(`${BASE_URL}/badge/${profile.slug}/${pkg.name}/${variant}`);
      }
    }
  }

  console.log(`warming ${urls.length} URLs (concurrency=${CONCURRENCY})`);
  const results = await runChunked(urls);
  const failed = results.filter((r) => !r.ok);
  console.log(`warmed ${results.length - failed.length}/${results.length}`);
  if (failed.length > 0) {
    console.log("failed URLs:");
    for (const f of failed) console.log(`  ${f.status} ${f.url}`);
  }
}

main().catch((e) => {
  console.error("warmup failed:", e);
  // best-effort — never break the sync workflow
  process.exit(0);
});
