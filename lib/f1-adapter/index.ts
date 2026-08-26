/**
 * Public surface of the F1 data adapter.
 *
 * The rest of the app imports from here and depends only on the internal types
 * and the {@link F1DataSource} interface — never on Jolpica's response shape
 * (CLAUDE.md #6). Swapping data sources means adding a sibling of
 * `JolpicaF1Source` and changing the one construction site below.
 */
import { JolpicaF1Source } from "./jolpica";
import {
  refreshRaceResults,
  SupabaseRaceResultsStore,
  type RefreshOutcome,
} from "./store";
import type { F1DataSource } from "./types";

export type {
  F1DataSource,
  RaceResult,
  RaceClassificationEntry,
} from "./types";
export { JolpicaF1Source, JOLPICA_BASE_URL } from "./jolpica";
export { shouldRefresh, REFRESH_INTERVAL_MS } from "./refresh";
export {
  refreshRaceResults,
  SupabaseRaceResultsStore,
  RACE_RESULTS_RESOURCE,
  type RaceResultsStore,
  type PendingRace,
  type RefreshOutcome,
} from "./store";
export { sanitizeText, toNonNegativeInt } from "./sanitize";

/** The default data source. Swap this line to change providers. */
export function defaultF1Source(): F1DataSource {
  return new JolpicaF1Source();
}

/**
 * Page-load entry point: refresh completed-race results if the 5-minute gate
 * allows it, using the service-role Supabase client and the default source.
 *
 * Safe to call from a Server Component on every request — it is internally
 * rate-limited and self-contained. Never throws to the caller: a failed
 * refresh (missing env, source outage) is logged and swallowed so it cannot
 * break page rendering. Import lazily to keep the service-role client off any
 * client bundle.
 */
export async function maybeRefreshRaceResults(): Promise<RefreshOutcome> {
  try {
    const { createServiceClient } = await import("@/lib/supabase/service");
    const store = new SupabaseRaceResultsStore(createServiceClient());
    return await refreshRaceResults({ source: defaultF1Source(), store });
  } catch (error) {
    console.error("Race-results refresh skipped:", error);
    return { refreshed: false, updated: 0 };
  }
}
