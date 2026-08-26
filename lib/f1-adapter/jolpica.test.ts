import { describe, expect, it, vi } from "vitest";

import {
  didFinish,
  JolpicaF1Source,
  parseRaceResultsResponse,
  translateRace,
  translateResult,
} from "./jolpica";

/**
 * Minimal but realistic slice of an Ergast/Jolpica `/results` response:
 * three finishers, one lapped, one retired (Accident), with the fastest lap
 * credited to P2.
 */
function ergastResponse() {
  return {
    MRData: {
      RaceTable: {
        season: "2026",
        round: "1",
        Races: [
          {
            season: "2026",
            round: "1",
            raceName: "Australian Grand Prix",
            Results: [
              {
                position: "1",
                positionText: "1",
                Driver: { driverId: "max_verstappen", code: "VER", givenName: "Max", familyName: "Verstappen" },
                Constructor: { constructorId: "red_bull", name: "Red Bull" },
                status: "Finished",
              },
              {
                position: "2",
                positionText: "2",
                Driver: { driverId: "norris", code: "NOR", givenName: "Lando", familyName: "Norris" },
                Constructor: { constructorId: "mclaren", name: "McLaren" },
                status: "Finished",
                FastestLap: { rank: "1", lap: "44" },
              },
              {
                position: "3",
                positionText: "3",
                Driver: { driverId: "leclerc", code: "LEC", givenName: "Charles", familyName: "Leclerc" },
                Constructor: { constructorId: "ferrari", name: "Ferrari" },
                status: "+1 Lap",
              },
              {
                position: "4",
                positionText: "R",
                Driver: { driverId: "hamilton", code: "HAM", givenName: "Lewis", familyName: "Hamilton" },
                Constructor: { constructorId: "ferrari", name: "Ferrari" },
                status: "Accident",
              },
            ],
          },
        ],
      },
    },
  };
}

describe("didFinish", () => {
  it("counts a classified or lapped driver as finished", () => {
    expect(didFinish("Finished")).toBe(true);
    expect(didFinish("+1 Lap")).toBe(true);
    expect(didFinish("+2 Laps")).toBe(true);
  });

  it("counts a retirement status as not finished", () => {
    expect(didFinish("Accident")).toBe(false);
    expect(didFinish("Engine")).toBe(false);
    expect(didFinish("Collision")).toBe(false);
    expect(didFinish("Disqualified")).toBe(false);
    expect(didFinish(null)).toBe(false);
  });
});

describe("translateResult", () => {
  it("translates a raw entry into the internal shape", () => {
    const raw = {
      position: "1",
      Driver: { code: "VER", givenName: "Max", familyName: "Verstappen" },
      Constructor: { name: "Red Bull" },
      status: "Finished",
    };
    expect(translateResult(raw)).toEqual({
      entry: {
        position: 1,
        driverCode: "VER",
        driverName: "Max Verstappen",
        constructorName: "Red Bull",
        status: "Finished",
        finished: true,
      },
      isFastestLap: false,
    });
  });

  it("flags the fastest-lap holder", () => {
    const raw = {
      position: "2",
      Driver: { code: "NOR", givenName: "Lando", familyName: "Norris" },
      Constructor: { name: "McLaren" },
      status: "Finished",
      FastestLap: { rank: "1" },
    };
    expect(translateResult(raw)?.isFastestLap).toBe(true);
  });

  it("falls back to driverId, then family name, when code is absent", () => {
    const raw = {
      position: "5",
      Driver: { driverId: "kimi_antonelli", givenName: "Kimi", familyName: "Antonelli" },
      Constructor: { name: "Mercedes" },
      status: "Finished",
    };
    expect(translateResult(raw)?.entry.driverCode).toBe("kimi_antonelli");
  });

  it("returns null when the position is unusable", () => {
    expect(
      translateResult({
        position: "R",
        Driver: { code: "VER", familyName: "Verstappen" },
        status: "Retired",
      }),
    ).toBeNull();
  });

  it("returns null for non-object input", () => {
    expect(translateResult(null)).toBeNull();
    expect(translateResult("nope")).toBeNull();
  });

  it("sanitizes markup out of driver/team/status fields", () => {
    const raw = {
      position: "1",
      Driver: { code: "<b>X</b>", givenName: "Ma<x", familyName: "Vers>tappen" },
      Constructor: { name: "Red <Bull>" },
      status: "Fin<ished",
    };
    const out = translateResult(raw)?.entry;
    expect(out?.driverCode).toBe("bX/b");
    expect(out?.driverName).toBe("Max Verstappen");
    expect(out?.constructorName).toBe("Red Bull");
    expect(out?.status).toBe("Finished");
  });
});

describe("translateRace", () => {
  it("builds a full RaceResult, sorted, with derived DNF count and fastest lap", () => {
    const race = ergastResponse().MRData.RaceTable.Races[0];
    const result = translateRace(race);
    expect(result).not.toBeNull();
    expect(result?.season).toBe(2026);
    expect(result?.round).toBe(1);
    expect(result?.classification.map((e) => e.driverCode)).toEqual([
      "VER",
      "NOR",
      "LEC",
      "HAM",
    ]);
    // Only HAM (Accident) is a DNF.
    expect(result?.dnfCount).toBe(1);
    expect(result?.fastestLapDriver).toBe("NOR");
    // Jolpica/Ergast doesn't expose red flags — recorded as unknown.
    expect(result?.redFlag).toBeNull();
  });

  it("sorts classification by position regardless of source order", () => {
    const result = translateRace({
      season: "2026",
      round: "2",
      Results: [
        { position: "3", Driver: { code: "C" }, Constructor: { name: "T" }, status: "Finished" },
        { position: "1", Driver: { code: "A" }, Constructor: { name: "T" }, status: "Finished" },
        { position: "2", Driver: { code: "B" }, Constructor: { name: "T" }, status: "Finished" },
      ],
    });
    expect(result?.classification.map((e) => e.position)).toEqual([1, 2, 3]);
  });

  it("returns null when there are no results", () => {
    expect(translateRace({ season: "2026", round: "3", Results: [] })).toBeNull();
    expect(translateRace({ season: "2026", round: "3" })).toBeNull();
  });

  it("returns null when season/round are missing", () => {
    expect(
      translateRace({ Results: [{ position: "1", Driver: { code: "A" }, status: "Finished" }] }),
    ).toBeNull();
  });

  it("leaves fastest lap null when no entry is ranked first", () => {
    const result = translateRace({
      season: "2026",
      round: "4",
      Results: [
        { position: "1", Driver: { code: "A" }, Constructor: { name: "T" }, status: "Finished" },
      ],
    });
    expect(result?.fastestLapDriver).toBeNull();
  });
});

describe("parseRaceResultsResponse", () => {
  it("parses a well-formed envelope", () => {
    const result = parseRaceResultsResponse(ergastResponse());
    expect(result?.season).toBe(2026);
    expect(result?.classification).toHaveLength(4);
  });

  it("returns null for malformed or empty envelopes", () => {
    expect(parseRaceResultsResponse(null)).toBeNull();
    expect(parseRaceResultsResponse({})).toBeNull();
    expect(parseRaceResultsResponse({ MRData: {} })).toBeNull();
    expect(parseRaceResultsResponse({ MRData: { RaceTable: { Races: [] } } })).toBeNull();
    expect(parseRaceResultsResponse("<html>rate limited</html>")).toBeNull();
  });

  it("returns null when the returned race is not the one requested", () => {
    expect(
      parseRaceResultsResponse(ergastResponse(), { season: 2026, round: 2 }),
    ).toBeNull();
    expect(
      parseRaceResultsResponse(ergastResponse(), { season: 2026, round: 1 }),
    ).not.toBeNull();
  });
});

describe("JolpicaF1Source", () => {
  it("requests the round's results URL and returns the translated result", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ergastResponse(),
    });
    const source = new JolpicaF1Source({
      fetchFn,
      baseUrl: "https://example.test/ergast/f1",
    });

    const result = await source.getRaceResults(2026, 1);

    expect(fetchFn).toHaveBeenCalledWith(
      "https://example.test/ergast/f1/2026/1/results.json",
    );
    expect(result?.classification).toHaveLength(4);
    expect(result?.fastestLapDriver).toBe("NOR");
  });

  it("throws on a non-OK HTTP response", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({}),
    });
    const source = new JolpicaF1Source({ fetchFn });

    await expect(source.getRaceResults(2026, 1)).rejects.toThrow(/429/);
  });

  it("returns null when the source returns a different race than requested", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ergastResponse(),
    });
    const source = new JolpicaF1Source({ fetchFn });

    expect(await source.getRaceResults(2026, 99)).toBeNull();
  });
});
