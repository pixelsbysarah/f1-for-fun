import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Dashboard } from "@/components/sections/Dashboard";
import { Hero } from "@/components/sections/Hero";
import { ScoreSummary } from "@/components/sections/ScoreSummary";

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
