/**
 * Prediction dashboard placeholder — the per-race prediction/results detail,
 * most-recent race first. No data wiring yet; static empty state for now.
 */
export function Dashboard() {
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
      <div className="mt-4 rounded-lg border border-dashed border-white/15 bg-asphalt-highlight/40 p-8 text-center">
        <p className="font-body text-sm text-off-white/50">
          Race-by-race predictions and results will appear here.
        </p>
      </div>
    </section>
  );
}
