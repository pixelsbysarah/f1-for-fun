import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { readSupabaseEnv } from "./env";

/** Paths that require an authenticated session. */
const PROTECTED_PREFIXES = ["/portal", "/onboarding"];

/** Per-request security context minted by the root middleware. */
export type SecurityContext = {
  nonce: string;
  csp: string;
};

/**
 * Clones the request headers and stamps the CSP nonce onto them.
 *
 * Both headers are needed: Next parses the nonce out of the request's
 * `Content-Security-Policy` to apply it to the inline scripts it generates,
 * and `x-nonce` lets Server Components read it directly if they ever need to
 * emit their own inline tag.
 *
 * Cloned fresh at each call site rather than once up front, because
 * `request.cookies.set()` mutates the underlying `cookie` header — a snapshot
 * taken before the Supabase cookie rotation would carry stale cookies into the
 * response.
 */
function headersWithNonce(request: NextRequest, { nonce, csp }: SecurityContext) {
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);
  return headers;
}

/**
 * Refreshes the Supabase session cookie on every request and performs coarse
 * route protection.
 *
 * Two responsibilities:
 *  1. Call `getUser()` so `@supabase/ssr` rotates the (httpOnly, secure)
 *     refresh token and writes fresh cookies onto the response. Skipping this
 *     lets sessions silently expire.
 *  2. Bounce unauthenticated visitors away from protected areas to `/login`.
 *
 * Finer-grained gating (permanent password set, MFA enrolled, session at
 * `aal2`) is enforced by the protected pages themselves — see
 * `resolveAuthDestination`. RLS is the real security boundary; these redirects
 * are UX so users land on the right step.
 */
export async function updateSession(
  request: NextRequest,
  security: SecurityContext,
) {
  let supabaseResponse = NextResponse.next({
    request: { headers: headersWithNonce(request, security) },
  });

  const { url, anonKey } = readSupabaseEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({
          request: { headers: headersWithNonce(request, security) },
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // IMPORTANT: do not run code between createServerClient and getUser(); it
  // must be the first auth call so the session is refreshed before any gating.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const needsAuth = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (!user && needsAuth) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Must return the response with refreshed cookies untouched, or the session
  // will not persist across requests.
  return supabaseResponse;
}
