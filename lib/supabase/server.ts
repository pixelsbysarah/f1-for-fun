import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

import { readSupabaseEnv } from "./env";

/**
 * Server-side Supabase client for Server Components, Route Handlers, and
 * Server Actions.
 *
 * Reads/writes the session from the request cookies via `@supabase/ssr`, so
 * the same httpOnly cookie session is shared with the browser client. A new
 * client is created per request because `cookies()` is request-scoped.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = readSupabaseEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // `setAll` was called from a Server Component, where mutating
          // cookies is not allowed. This is safe to ignore because the
          // middleware (`updateSession`) refreshes the session cookie on
          // every request.
        }
      },
    },
  });
}
