import { createBrowserClient } from "@supabase/ssr";

import { readSupabaseEnv } from "./env";

/**
 * Browser-side Supabase client.
 *
 * Uses `@supabase/ssr` so the session lives in httpOnly, secure cookies
 * (shared with the server client) rather than localStorage/sessionStorage —
 * this keeps tokens out of reach of client-side JavaScript, mitigating
 * XSS-based token theft (build-spec "Session & Token Security").
 *
 * Used by the interactive auth flows (login, MFA enroll/challenge) and the
 * prediction form, which need to call the auth/MFA APIs from the browser.
 */
export function createClient() {
  // Access `process.env.NEXT_PUBLIC_*` as literal member expressions so
  // Next.js inlines the values into the browser bundle at build time (it does
  // not substitute values reached through an aliased `process.env`).
  const { url, anonKey } = readSupabaseEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  return createBrowserClient(url, anonKey);
}
