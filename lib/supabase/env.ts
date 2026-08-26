/**
 * Reads and validates the public Supabase environment variables.
 *
 * These are the only two values every Supabase client (browser, server,
 * middleware) needs. Centralizing the read means a missing/misconfigured env
 * fails loudly and consistently instead of surfacing as a confusing runtime
 * error deep inside the SDK. Pulled out as a pure function so it can be unit
 * tested without spinning up a real client.
 *
 * Both values are safe to expose to the browser (the anon key is public by
 * design; row-level security is what protects the data). The server-only
 * `SUPABASE_SERVICE_ROLE_KEY` is deliberately NOT read here — it must never
 * reach client bundles and is only used by the data adapter (Ticket 3).
 */
export type SupabaseEnv = {
  url: string;
  anonKey: string;
};

export function readSupabaseEnv(
  env: Record<string, string | undefined> = process.env,
): SupabaseEnv {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    const missing = [
      !url && "NEXT_PUBLIC_SUPABASE_URL",
      !anonKey && "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ]
      .filter(Boolean)
      .join(", ");
    throw new Error(
      `Missing Supabase environment variable(s): ${missing}. ` +
        "Copy .env.example to .env.local and fill in the values from " +
        "`supabase start` (local) or the Vercel dashboard (production).",
    );
  }

  return { url, anonKey };
}
