import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client — SERVER ONLY.
 *
 * Uses the `SUPABASE_SERVICE_ROLE_KEY`, which bypasses Row Level Security, and
 * must therefore never reach the browser. Only ever import this from
 * server-side code (Server Components, Route Handlers, Server Actions): the key
 * it reads is not a `NEXT_PUBLIC_*` var, so Next.js will not inline it into a
 * client bundle. This client is used solely by
 * the data adapter to write the adapter-owned columns (race results,
 * `fetch_metadata`) that RLS closes off to anon/authenticated roles.
 *
 * Distinct from `lib/supabase/env.ts`, which deliberately reads only the public
 * URL/anon key and never the service-role key.
 */
export function createServiceClient(
  env: Record<string, string | undefined> = process.env,
): SupabaseClient {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    const missing = [
      !url && "NEXT_PUBLIC_SUPABASE_URL",
      !serviceRoleKey && "SUPABASE_SERVICE_ROLE_KEY",
    ]
      .filter(Boolean)
      .join(", ");
    throw new Error(
      `Missing Supabase environment variable(s) for the service client: ${missing}. ` +
        "The service-role key lives in Vercel env vars (production) or your " +
        "local `.env.local` (development) and is never committed.",
    );
  }

  // No session persistence/refresh: this is a stateless server-side client.
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
