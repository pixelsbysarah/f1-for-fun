/**
 * Persistence port + refresh orchestration for race results.
 *
 * The orchestrator ({@link refreshRaceResults}) is written against the narrow
 * {@link RaceResultsStore} port rather than the Supabase client directly, so
 * the gating/update flow can be unit tested with a fake store and no database.
 * `SupabaseRaceResultsStore` is the production implementation of that port.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { REFRESH_INTERVAL_MS, shouldRefresh } from "./refresh";
import type { F1DataSource, RaceResult } from "./types";

/** Resource key used in `fetch_metadata` for the race-results poll. */
export const RACE_RESULTS_RESOURCE = "race_results";

/** A race the adapter may need to fetch results for. */
export type PendingRace = {
  id: string;
  season: number;
  round: number;
};

/** Everything the orchestrator needs from persistence — nothing more. */
export interface RaceResultsStore {
  /** Last time this resource was polled, or `null` if never. */
  getLastFetched(resource: string): Promise<Date | null>;
  /** Record that this resource was polled at `at`. */
  setLastFetched(resource: string, at: Date): Promise<void>;
  /** Races that have started (by `now`) but have no stored results yet. */
  listRacesNeedingResults(now: Date): Promise<PendingRace[]>;
  /** Persist a race's sanitized result and mark it completed. */
  saveRaceResult(
    raceId: string,
    result: RaceResult,
    fetchedAt: Date,
  ): Promise<void>;
}

export type RefreshOutcome = {
  /** False when the 5-minute gate short-circuited the run. */
  refreshed: boolean;
  /** Number of races whose results were written this run. */
  updated: number;
};

/**
 * Refresh completed-race results, respecting the 5-minute rate limit.
 *
 * Flow: check the persisted `last_fetched`; bail if too soon; otherwise fetch
 * results for each pending race, storing whatever the source returns. A single
 * race failing (transport error, no results yet) is logged-and-skipped so one
 * bad race can't abort the whole run. `last_fetched` is stamped once the run
 * completes so the gate holds for the next 5 minutes.
 */
export async function refreshRaceResults(deps: {
  source: F1DataSource;
  store: RaceResultsStore;
  now?: Date;
  intervalMs?: number;
}): Promise<RefreshOutcome> {
  const now = deps.now ?? new Date();
  const intervalMs = deps.intervalMs ?? REFRESH_INTERVAL_MS;

  const lastFetched = await deps.store.getLastFetched(RACE_RESULTS_RESOURCE);
  if (!shouldRefresh(lastFetched, now, intervalMs)) {
    return { refreshed: false, updated: 0 };
  }

  const pending = await deps.store.listRacesNeedingResults(now);

  let updated = 0;
  for (const race of pending) {
    try {
      const result = await deps.source.getRaceResults(race.season, race.round);
      if (!result) continue;
      await deps.store.saveRaceResult(race.id, result, now);
      updated += 1;
    } catch (error) {
      // Skip this race; a single failure must not abort the whole refresh.
      console.error(
        `Failed to refresh results for race ${race.id} (${race.season} round ${race.round}):`,
        error,
      );
    }
  }

  await deps.store.setLastFetched(RACE_RESULTS_RESOURCE, now);
  return { refreshed: true, updated };
}

/**
 * Supabase-backed {@link RaceResultsStore}. Expects a client created with the
 * service-role key (see `lib/supabase/service.ts`) so it can write the
 * adapter-owned columns, which are closed to anon/authenticated roles by RLS.
 */
export class SupabaseRaceResultsStore implements RaceResultsStore {
  constructor(private readonly client: SupabaseClient) {}

  async getLastFetched(resource: string): Promise<Date | null> {
    const { data, error } = await this.client
      .from("fetch_metadata")
      .select("last_fetched")
      .eq("resource", resource)
      .maybeSingle();

    if (error) throw error;
    if (!data?.last_fetched) return null;
    return new Date(data.last_fetched as string);
  }

  async setLastFetched(resource: string, at: Date): Promise<void> {
    const { error } = await this.client
      .from("fetch_metadata")
      .upsert(
        { resource, last_fetched: at.toISOString() },
        { onConflict: "resource" },
      );
    if (error) throw error;
  }

  async listRacesNeedingResults(now: Date): Promise<PendingRace[]> {
    const { data, error } = await this.client
      .from("races")
      .select("id, season, round, race_date")
      .eq("is_completed", false)
      .lte("race_date", now.toISOString());

    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id as string,
      season: row.season as number,
      round: row.round as number,
    }));
  }

  async saveRaceResult(
    raceId: string,
    result: RaceResult,
    fetchedAt: Date,
  ): Promise<void> {
    const { error } = await this.client
      .from("races")
      .update({
        result_classification: result.classification,
        fastest_lap_driver: result.fastestLapDriver,
        result_dnf_count: result.dnfCount,
        red_flag: result.redFlag,
        results_fetched_at: fetchedAt.toISOString(),
        is_completed: true,
      })
      .eq("id", raceId);
    if (error) throw error;
  }
}
