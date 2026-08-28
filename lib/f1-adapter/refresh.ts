/**
 * Rate-limited refresh gating.
 *
 * Refresh is triggered on page load but must not hammer the external source.
 * OpenF1 publishes a 3 req/s, 30 req/min limit, so a conservative 5-minute
 * floor between fetches (build spec, "Data Layer") keeps us comfortably under
 * it even across concurrent serverless invocations; the per-run race cap
 * (see `MAX_RACES_PER_RUN` in `./store`) bounds the burst within a single run.
 * The decision is a pure function of the persisted `last_fetched` timestamp
 * and the current time, so it is trivially testable and has no hidden state.
 */

/** Minimum time between external fetches: 5 minutes. */
export const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Should we call the external API again?
 *
 * - Never fetched before (`null`/`undefined`) → yes.
 * - Unparseable stored timestamp → yes (treat as never fetched rather than
 *   getting stuck).
 * - Otherwise → only once at least `intervalMs` has elapsed.
 *
 * Accepts a `Date`, an ISO string, or epoch millis for `lastFetched` so it can
 * be handed a raw DB value without pre-parsing.
 */
export function shouldRefresh(
  lastFetched: Date | string | number | null | undefined,
  now: Date = new Date(),
  intervalMs: number = REFRESH_INTERVAL_MS,
): boolean {
  if (lastFetched === null || lastFetched === undefined) return true;

  const last =
    lastFetched instanceof Date ? lastFetched : new Date(lastFetched);
  const lastMs = last.getTime();
  if (Number.isNaN(lastMs)) return true;

  return now.getTime() - lastMs >= intervalMs;
}
