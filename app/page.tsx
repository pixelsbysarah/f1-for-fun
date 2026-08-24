import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Dashboard } from "@/components/sections/Dashboard";
import { Hero } from "@/components/sections/Hero";
import { ScoreSummary } from "@/components/sections/ScoreSummary";

/**
 * Rendered per-request rather than prerendered at build time.
 *
 * The CSP uses a per-request nonce instead of `script-src 'unsafe-inline'`
 * (see `lib/security/headers.ts`). A nonce cannot be baked into build-time
 * HTML, so a statically prerendered page would ship inline bootstrap scripts
 * the browser then refuses to run. The cost is small here: the middleware
 * already makes a Supabase call on every request to this path, so the static
 * HTML cache was saving a render, not a round trip.
 */
export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <ScoreSummary />
        <Dashboard />
      </main>
      <SiteFooter />
    </div>
  );
}
