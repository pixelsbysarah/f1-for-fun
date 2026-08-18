/**
 * Score summary placeholder — the head-to-head "you vs. spouse" tally.
 * No data wiring yet; renders a static empty state for the scaffold.
 */
export function ScoreSummary() {
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
      <div className="mt-4 rounded-lg border border-dashed border-white/15 bg-asphalt-highlight/40 p-8 text-center">
        <p className="font-body text-sm text-off-white/50">
          Head-to-head score will appear here once predictions are wired up.
        </p>
      </div>
    </section>
  );
}
