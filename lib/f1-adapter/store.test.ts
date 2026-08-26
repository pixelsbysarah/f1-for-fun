import { describe, expect, it, vi } from "vitest";

import { REFRESH_INTERVAL_MS } from "./refresh";
import {
  RACE_RESULTS_RESOURCE,
  refreshRaceResults,
  type PendingRace,
  type RaceResultsStore,
} from "./store";
import type { F1DataSource, RaceResult } from "./types";

function fakeResult(season: number, round: number): RaceResult {
  return {
    season,
    round,
    classification: [
      {
        position: 1,
        driverCode: "VER",
        driverName: "Max Verstappen",
        constructorName: "Red Bull",
        status: "Finished",
        finished: true,
      },
    ],
    fastestLapDriver: "VER",
    dnfCount: 0,
    redFlag: null,
  };
}

function makeStore(overrides: Partial<RaceResultsStore> = {}): RaceResultsStore {
  return {
    getLastFetched: vi.fn().mockResolvedValue(null),
    setLastFetched: vi.fn().mockResolvedValue(undefined),
    listRacesNeedingResults: vi.fn().mockResolvedValue([]),
    saveRaceResult: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const now = new Date("2026-03-08T12:00:00.000Z");

describe("refreshRaceResults", () => {
  it("skips the run when the 5-minute gate is closed", async () => {
    const store = makeStore({
      getLastFetched: vi
        .fn()
        .mockResolvedValue(new Date(now.getTime() - 60 * 1000)),
    });
    const source: F1DataSource = { getRaceResults: vi.fn() };

    const outcome = await refreshRaceResults({ source, store, now });

    expect(outcome).toEqual({ refreshed: false, updated: 0 });
    expect(source.getRaceResults).not.toHaveBeenCalled();
    expect(store.listRacesNeedingResults).not.toHaveBeenCalled();
    expect(store.setLastFetched).not.toHaveBeenCalled();
  });

  it("fetches and stores results for each pending race, then stamps last_fetched", async () => {
    const pending: PendingRace[] = [
      { id: "race-1", season: 2026, round: 1 },
      { id: "race-2", season: 2026, round: 2 },
    ];
    const store = makeStore({
      getLastFetched: vi
        .fn()
        .mockResolvedValue(new Date(now.getTime() - REFRESH_INTERVAL_MS)),
      listRacesNeedingResults: vi.fn().mockResolvedValue(pending),
    });
    const source: F1DataSource = {
      getRaceResults: vi
        .fn()
        .mockImplementation((season: number, round: number) =>
          Promise.resolve(fakeResult(season, round)),
        ),
    };

    const outcome = await refreshRaceResults({ source, store, now });

    expect(outcome).toEqual({ refreshed: true, updated: 2 });
    expect(store.saveRaceResult).toHaveBeenCalledTimes(2);
    expect(store.saveRaceResult).toHaveBeenCalledWith(
      "race-1",
      fakeResult(2026, 1),
      now,
    );
    expect(store.setLastFetched).toHaveBeenCalledWith(
      RACE_RESULTS_RESOURCE,
      now,
    );
  });

  it("skips races the source has no results for yet", async () => {
    const store = makeStore({
      listRacesNeedingResults: vi
        .fn()
        .mockResolvedValue([{ id: "race-1", season: 2026, round: 1 }]),
    });
    const source: F1DataSource = {
      getRaceResults: vi.fn().mockResolvedValue(null),
    };

    const outcome = await refreshRaceResults({ source, store, now });

    expect(outcome).toEqual({ refreshed: true, updated: 0 });
    expect(store.saveRaceResult).not.toHaveBeenCalled();
    // Still stamps the fetch so the gate holds for the next 5 minutes.
    expect(store.setLastFetched).toHaveBeenCalledOnce();
  });

  it("continues past a race whose fetch throws, still stamping last_fetched", async () => {
    const store = makeStore({
      listRacesNeedingResults: vi.fn().mockResolvedValue([
        { id: "race-1", season: 2026, round: 1 },
        { id: "race-2", season: 2026, round: 2 },
      ]),
    });
    const source: F1DataSource = {
      getRaceResults: vi
        .fn()
        .mockRejectedValueOnce(new Error("network"))
        .mockResolvedValueOnce(fakeResult(2026, 2)),
    };
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const outcome = await refreshRaceResults({ source, store, now });

    expect(outcome).toEqual({ refreshed: true, updated: 1 });
    expect(store.saveRaceResult).toHaveBeenCalledOnce();
    expect(store.saveRaceResult).toHaveBeenCalledWith(
      "race-2",
      fakeResult(2026, 2),
      now,
    );
    expect(store.setLastFetched).toHaveBeenCalledOnce();
    errorSpy.mockRestore();
  });
});
