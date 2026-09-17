import { type NextRequest } from "next/server";

import { recordSessionRefresh } from "@/lib/metrics/otel";
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
 *
 * Also times step 2 and records it via `recordSessionRefresh` — see
 * `lib/metrics/otel.ts` for why that's a span attribute rather than a metric
 * (this runs on the Edge runtime, which has no metrics exporter configured).
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

  const sessionRefreshStarted = performance.now();
  let response;
  try {
    response = await updateSession(request, { nonce, csp });
  } catch (error) {
    recordSessionRefreshSafely({
      durationMs: performance.now() - sessionRefreshStarted,
      outcome: "error",
      authenticated: false,
    });
    throw error;
  }

  // `updateSession` only ever redirects for the unauthenticated-visitor-on-a-
  // protected-route case (see its own doc comment) — a cheap way to label
  // this timing by whether the visitor had a session, without threading that
  // detail out of the auth helper just for a metrics label.
  const authenticated = !(
    response.status === 307 &&
    response.headers.get("location")?.includes("/login")
  );
  recordSessionRefreshSafely({
    durationMs: performance.now() - sessionRefreshStarted,
    outcome: "ok",
    authenticated,
  });

  response.headers.set("Content-Security-Policy", csp);
  return response;
}

/**
 * `recordSessionRefresh` should never throw (it only touches OTel span
 * attributes), but middleware sits in front of every request in the app — a
 * bug in instrumentation must never be able to take it down. Belt and braces.
 */
function recordSessionRefreshSafely(
  args: Parameters<typeof recordSessionRefresh>[0],
) {
  try {
    recordSessionRefresh(args);
  } catch (error) {
    console.error("recordSessionRefresh failed:", error);
  }
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
