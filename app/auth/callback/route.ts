import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth callback: exchanges the code for a session, ensures a profile row
 * (slug = GitHub login) on first login, then redirects to the dashboard.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const login =
          (user.user_metadata?.user_name as string | undefined) ??
          user.id.slice(0, 8);
        await supabase
          .from("profiles")
          .upsert(
            { user_id: user.id, slug: login },
            { onConflict: "user_id", ignoreDuplicates: true },
          );
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
