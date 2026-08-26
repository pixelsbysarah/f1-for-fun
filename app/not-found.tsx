import { headers } from "next/headers";
import Link from "next/link";

/**
 * Custom 404.
 *
 * Exists primarily to force the not-found route to render per-request. Next's
 * built-in 404 is statically prerendered, so its inline bootstrap scripts ship
 * without a nonce and are blocked wholesale by our CSP (see
 * `lib/security/headers.ts`) — the page renders but never hydrates.
 *
 * `export const dynamic` is not honoured on this route, so the opt-in is the
 * `headers()` call below: reading a dynamic API is what moves it out of the
 * static prerender. We read the nonce the middleware set, which is the same
 * value Next stamps onto its scripts, so the call is meaningful rather than a
 * no-op that a future cleanup would delete.
 */
export default async function NotFound() {
  await headers();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <p className="font-heading text-sm font-bold uppercase tracking-widest text-racing-red">
        404
      </p>
      <h1 className="mt-2 font-heading text-2xl font-black text-off-white">
        Off the track
      </h1>
      <p className="mt-2 text-sm text-off-white/70">
        That page doesn&apos;t exist.
      </p>
      <Link
        href="/"
        className="mt-6 self-start rounded border border-off-white/20 px-3 py-1.5 text-sm text-off-white/80 hover:border-racing-red"
      >
        Back to the dashboard
      </Link>
    </main>
  );
}
