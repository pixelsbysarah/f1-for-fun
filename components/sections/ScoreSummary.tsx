import type { SeasonView } from "@/lib/dashboard/types";

/**
 * Head-to-head score summary: each person's season points and accuracy across
 * all completed races, with the current leader highlighted. Accuracy is
 * podium-weighted (see the scoring module), not an even category average.
 */
export function ScoreSummary({ season }: { season: SeasonView }) {
  const hasPeople = season.people.length > 0;
  const anyScored = season.people.some((p) => p.maxPoints > 0);

  return (
    <section
      aria-labelledby="score-summary-heading"
      className="mx-auto max-w-5xl px-6 py-8"
    >
      <h2
        id="score-summary-heading"
        className="font-heading text-xl font-bold text-off-white"
      >
        Score Summary
      </h2>

      {!hasPeople || !anyScored ? (
        <div className="mt-4 rounded-lg border border-dashed border-white/15 bg-asphalt-highlight/40 p-8 text-center">
          <p className="font-body text-sm text-off-white/50">
            The head-to-head score appears here once the first race is scored.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {season.people.map((person) => {
            const isLeader = person.userId === season.leaderUserId;
            return (
              <div
                key={person.userId}
                className={
                  isLeader
                    ? "rounded-lg border border-correct-green/40 bg-asphalt-highlight/60 p-5"
                    : "rounded-lg border border-off-white/10 bg-asphalt-highlight/40 p-5"
                }
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-heading text-lg font-bold text-off-white">
                    {person.displayName}
                  </h3>
                  {isLeader && (
                    <span className="rounded-full bg-correct-green/15 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-correct-green">
                      Leading
                    </span>
                  )}
                </div>
                <p className="mt-2 font-heading text-3xl font-black text-off-white">
                  {person.totalPoints}
                  <span className="ml-1 text-base font-normal text-off-white/50">
                    / {person.maxPoints} pts
                  </span>
                </p>
                <p className="mt-1 text-sm text-off-white/60">
                  {person.accuracyPct}% season accuracy
                </p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
