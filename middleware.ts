import { type NextRequest } from "next/server";

import {
  buildContentSecurityPolicy,
  generateNonce,
} from "@/lib/security/headers";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Root middleware. Two jobs, in order:
 *
 *  1. Mint a per-request CSP nonce and hand it to `updateSession`, which puts
 *     it on the *request* headers. Next reads the nonce back off the request
 *     and stamps it onto the inline bootstrap scripts it generates, which is
 *     what lets `script-src` avoid `'unsafe-inline'`.
 *  2. Delegate to `updateSession` to refresh the Supabase session cookie and
 *     guard protected routes.
 *
 * The CSP is then set on whatever response comes back — including the redirect
 * responses `updateSession` returns for unauthenticated visitors.
 */
export async function middleware(request: NextRequest) {
  const nonce = generateNonce();
  const { url } = readSupabaseEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  const csp = buildContentSecurityPolicy({
    nonce,
    supabaseOrigin: new URL(url).origin,
    isDev: process.env.NODE_ENV !== "production",
  });

  const response = await updateSession(request, { nonce, csp });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  /**
   * Run on all paths except Next.js internals and static assets. Auth cookies
   * still need refreshing on public pages (the dashboard reads predictions),
   * so we intentionally do NOT exclude "/" here.
   *
   * Excluded paths are non-HTML assets, which a CSP does not apply to; the
   * constant headers in `next.config.mjs` still cover them.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
