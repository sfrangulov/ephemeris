import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Next 16 proxy (formerly middleware): refreshes the Supabase auth session on
 * every request so Server Components see a current user. Must run before any
 * auth-dependent rendering. Does not gate routes (dashboard stays public).
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Touch the session so expired tokens refresh into the response cookies.
  await supabase.auth.getUser();
  return response;
}

export const proxyConfig = {
  // Exclude /badge/* entirely: badges render public data with no viewer, so
  // the session refresh is pure overhead — and on the extensionless portfolio
  // badge (/badge/[slug]) it would otherwise run a getUser() auth round-trip
  // on every request. Per-package badges (.svg) are already excluded below.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|badge/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
