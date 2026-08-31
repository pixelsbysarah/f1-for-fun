import { RaceCard } from "@/components/dashboard/RaceCard";
import type { RaceView } from "@/lib/dashboard/types";

/**
 * Prediction dashboard: per-race prediction/results detail, most-recent race
 * first. Ordering and styling decisions are made upstream in `buildDashboard`;
 * this component just renders the resulting `RaceView`s.
 */
export function Dashboard({ races }: { races: RaceView[] }) {
  return (
    <section
      aria-labelledby="dashboard-heading"
      className="mx-auto max-w-5xl px-6 py-8"
    >
      <h2
        id="dashboard-heading"
        className="font-heading text-xl font-bold text-off-white"
      >
        Dashboard
      </h2>

      {races.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-white/15 bg-asphalt-highlight/40 p-8 text-center">
          <p className="font-body text-sm text-off-white/50">
            Race-by-race predictions and results will appear here once
            predictions are in.
          </p>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-6">
          {races.map((race) => (
            <RaceCard key={race.raceId} race={race} />
          ))}
        </div>
      )}
    </section>
  );
}
