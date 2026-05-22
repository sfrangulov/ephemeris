import { createClient } from "@supabase/supabase-js";

/**
 * Secret-key Supabase client for trusted jobs only (Vercel Cron snapshot,
 * GitHub Actions backfill). The secret key authorizes via the `service_role`
 * Postgres role and bypasses RLS — NEVER import into client/browser code or
 * expose the key. No session persistence.
 */
export function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error("createAdminClient must never be used in the browser");
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY");
  }

  return createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
