import { describe, expect, it, vi } from "vitest";

import {
  buildDriverMap,
  buildRaceResult,
  countRedFlags,
  fastestLapDriver,
  OpenF1Source,
  selectRaceSessionKey,
  translateEntry,
} from "./openf1";

/**
 * Realistic slices of the five OpenF1 payloads a race fetch composes, drawn
 * from the verified 2026 samples (Dutch GP, session_key 11353). Kept small but
 * shaped exactly like the live API, including OpenF1's `dnf`/`dns`/`dsq`
 * booleans and null `lap_duration`.
 */

// `/sessions?year=2026&session_type=Race` — includes the shapes that trip up
// ordinal matching: two Spanish rounds (Barcelona + Madrid), a same-day Sprint,
// a cancelled session, and the Bahrain/Kuala-Lumpur data artifact.
const SESSIONS = [
  {
    session_key: 11353,
    session_name: "Race",
    session_type: "Race",
    date_start: "2026-08-23T13:00:00+00:00",
    country_name: "Netherlands",
    location: "Zandvoort",
    year: 2026,
    is_cancelled: false,
  },
  {
    session_key: 11100,
    session_name: "Race",
    session_type: "Race",
    date_start: "2026-06-14T13:00:00+00:00",
    country_name: "Spain",
    location: "Barcelona",
    year: 2026,
    is_cancelled: false,
  },
  {
    session_key: 11200,
    session_name: "Race",
    session_type: "Race",
    date_start: "2026-09-13T13:00:00+00:00",
    country_name: "Spain",
    location: "Madrid",
    year: 2026,
    is_cancelled: false,
  },
  {
    session_key: 11731,
    session_name: "Race",
    session_type: "Race",
    date_start: "2026-10-04T13:00:00+00:00",
    country_name: "Bahrain",
    location: "Kuala Lumpur",
    year: 2026,
    is_cancelled: false,
  },
  {
    // Same day as the Dutch GP but a Sprint — must be ignored.
    session_key: 11999,
    session_name: "Sprint",
    session_type: "Race",
    date_start: "2026-08-23T09:00:00+00:00",
    country_name: "Netherlands",
    location: "Zandvoort",
    year: 2026,
    is_cancelled: false,
  },
  {
    session_key: 11888,
    session_name: "Race",
    session_type: "Race",
    date_start: "2026-07-05T13:00:00+00:00",
    country_name: "Fantasy",
    location: "Nowhere",
    year: 2026,
    is_cancelled: true,
  },
];

// `/session_result?session_key=11353` — 3 finishers + 2 DNF + 1 DNS + 1 DSQ,
// out of position order to exercise the sort.
const SESSION_RESULT = [
  { position: 3, driver_number: 16, dnf: false, dns: false, dsq: false },
  { position: 1, driver_number: 1, dnf: false, dns: false, dsq: false },
  { position: 2, driver_number: 4, dnf: false, dns: false, dsq: false },
  { position: 18, driver_number: 44, dnf: true, dns: false, dsq: false },
  { position: 19, driver_number: 22, dnf: true, dns: false, dsq: false },
  { position: 20, driver_number: 5, dnf: false, dns: true, dsq: false },
  { position: 17, driver_number: 10, dnf: false, dns: false, dsq: true },
];

// `/laps?session_key=11353` — fastest recorded lap is LEC (#16); one null lap.
const LAPS = [
  { driver_number: 16, lap_number: 60, lap_duration: 74.23 },
  { driver_number: 1, lap_number: 55, lap_duration: 74.9 },
  { driver_number: 4, lap_number: 60, lap_duration: null },
  { driver_number: 4, lap_number: 61, lap_duration: 75.1 },
];

// `/drivers?session_key=11353`
const DRIVERS = [
  { driver_number: 1, name_acronym: "VER", full_name: "Max VERSTAPPEN", team_name: "Red Bull Racing" },
  { driver_number: 4, name_acronym: "NOR", full_name: "Lando NORRIS", team_name: "McLaren" },
  { driver_number: 16, name_acronym: "LEC", full_name: "Charles LECLERC", team_name: "Ferrari" },
  { driver_number: 44, name_acronym: "HAM", full_name: "Lewis HAMILTON", team_name: "Ferrari" },
  { driver_number: 22, name_acronym: "TSU", full_name: "Yuki TSUNODA", team_name: "RB" },
  { driver_number: 5, name_acronym: "BOR", full_name: "Gabriel BORTOLETO", team_name: "Kick Sauber" },
  { driver_number: 10, name_acronym: "GAS", full_name: "Pierre GASLY", team_name: "Alpine" },
];

// OpenF1's no-data sentinel: an object, not an empty array.
const NO_RESULTS = { detail: "No results found." };

// One Track-scope RED event (Monaco 2024 shape).
const ONE_RED_FLAG = [
  {
    meeting_key: 1236,
    session_key: 9523,
    date: "2024-05-26T13:04:08+00:00",
    category: "Flag",
    flag: "RED",
    scope: "Track",
    message: "RED FLAG",
  },
];

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

/**
 * Build an injectable fetch that routes by endpoint. Each route entry is either
 * a payload (served as 200 JSON) or a number (served as that HTTP status).
 */
function makeFetch(
  overrides: Partial<Record<string, unknown>> = {},
) {
  const routes: Record<string, unknown> = {
    sessions: SESSIONS,
    session_result: SESSION_RESULT,
    laps: LAPS,
    race_control: NO_RESULTS,
    drivers: DRIVERS,
    ...overrides,
  };
  const resolve = (entry: unknown) =>
    typeof entry === "number" ? jsonResponse({}, entry) : jsonResponse(entry);

  return vi.fn(async (url: string) => {
    if (url.includes("/sessions")) return resolve(routes.sessions);
    if (url.includes("/session_result")) return resolve(routes.session_result);
    if (url.includes("/laps")) return resolve(routes.laps);
    if (url.includes("/race_control")) return resolve(routes.race_control);
    if (url.includes("/drivers")) return resolve(routes.drivers);
    throw new Error(`Unexpected URL: ${url}`);
  });
}

describe("selectRaceSessionKey", () => {
  it("matches by UTC date, distinguishing two races that share a country", () => {
    // Spain appears twice; date is the only discriminator.
    expect(selectRaceSessionKey(SESSIONS, "2026-06-14")).toBe(11100);
    expect(selectRaceSessionKey(SESSIONS, "2026-09-13")).toBe(11200);
  });

  it("matches a full timestamp on the same UTC day", () => {
    expect(selectRaceSessionKey(SESSIONS, "2026-08-23T00:00:00Z")).toBe(11353);
  });

  it("ignores a Sprint sharing the race's date", () => {
    // 11999 (Sprint) and 11353 (Race) are both on 2026-08-23; must pick 11353.
    expect(selectRaceSessionKey(SESSIONS, "2026-08-23")).toBe(11353);
  });

  it("ignores cancelled sessions", () => {
    expect(selectRaceSessionKey(SESSIONS, "2026-07-05")).toBeNull();
  });

  it("returns null rather than guessing when no date matches", () => {
    expect(selectRaceSessionKey(SESSIONS, "2026-12-25")).toBeNull();
    expect(selectRaceSessionKey(SESSIONS, "not-a-date")).toBeNull();
  });
});

describe("translateEntry", () => {
  const driverMap = buildDriverMap(DRIVERS);

  it("resolves the driver identity and marks a finisher", () => {
    expect(translateEntry(SESSION_RESULT[1], driverMap)).toEqual({
      position: 1,
      driverCode: "VER",
      driverName: "Max VERSTAPPEN",
      constructorName: "Red Bull Racing",
      status: "Finished",
      finished: true,
    });
  });

  it("synthesizes a DNF status and marks it not finished", () => {
    const entry = translateEntry(
      { position: 18, driver_number: 44, dnf: true, dns: false, dsq: false },
      driverMap,
    );
    expect(entry?.status).toBe("DNF");
    expect(entry?.finished).toBe(false);
  });

  it("synthesizes DNS/DSQ but keeps finished derived from dnf only", () => {
    const dns = translateEntry(
      { position: 20, driver_number: 5, dnf: false, dns: true, dsq: false },
      driverMap,
    );
    expect(dns?.status).toBe("DNS");
    expect(dns?.finished).toBe(true);

    const dsq = translateEntry(
      { position: 17, driver_number: 10, dnf: false, dns: false, dsq: true },
      driverMap,
    );
    expect(dsq?.status).toBe("DSQ");
    expect(dsq?.finished).toBe(true);
  });

  it("falls back to the car number when the driver is unknown", () => {
    const entry = translateEntry(
      { position: 5, driver_number: 99, dnf: false },
      driverMap,
    );
    expect(entry?.driverCode).toBe("99");
    expect(entry?.driverName).toBe("99");
    expect(entry?.constructorName).toBe("Unknown");
  });

  it("returns null for an unusable position or non-object", () => {
    expect(translateEntry({ driver_number: 1 }, driverMap)).toBeNull();
    expect(translateEntry(null, driverMap)).toBeNull();
  });
});

describe("fastestLapDriver", () => {
  it("returns the code of the minimum non-null lap_duration", () => {
    expect(fastestLapDriver(LAPS, buildDriverMap(DRIVERS))).toBe("LEC");
  });

  it("returns null when no lap has a usable duration", () => {
    expect(
      fastestLapDriver(
        [{ driver_number: 1, lap_duration: null }],
        buildDriverMap(DRIVERS),
      ),
    ).toBeNull();
  });
});

describe("countRedFlags", () => {
  it("counts each Track-scope RED event", () => {
    expect(countRedFlags(ONE_RED_FLAG)).toBe(1);
  });

  it("counts an empty payload as zero, not unknown", () => {
    expect(countRedFlags([])).toBe(0);
  });
});

describe("buildRaceResult", () => {
  it("composes the four payloads into a sorted RaceResult", () => {
    const result = buildRaceResult({
      season: 2026,
      round: 15,
      sessionResult: SESSION_RESULT,
      laps: LAPS,
      raceControl: [],
      drivers: DRIVERS,
    });

    expect(result?.season).toBe(2026);
    expect(result?.round).toBe(15);
    expect(result?.classification.map((e) => e.position)).toEqual([
      1, 2, 3, 17, 18, 19, 20,
    ]);
    expect(result?.classification.slice(0, 3).map((e) => e.driverCode)).toEqual(
      ["VER", "NOR", "LEC"],
    );
    expect(result?.fastestLapDriver).toBe("LEC");
    expect(result?.redFlagCount).toBe(0);
  });

  it("counts only dnf === true, excluding DNS and DSQ", () => {
    const result = buildRaceResult({
      season: 2026,
      round: 15,
      sessionResult: SESSION_RESULT,
      laps: LAPS,
      raceControl: [],
      drivers: DRIVERS,
    });
    // Two DNF rows (#44, #22); the DNS (#5) and DSQ (#10) are not counted.
    expect(result?.dnfCount).toBe(2);
  });

  it("returns null when nothing is classifiable", () => {
    expect(
      buildRaceResult({
        season: 2026,
        round: 1,
        sessionResult: [],
        laps: [],
        raceControl: [],
        drivers: [],
      }),
    ).toBeNull();
  });
});

describe("OpenF1Source.getRaceResults", () => {
  it("composes a full RaceResult from the four session endpoints", async () => {
    const fetchFn = makeFetch();
    const source = new OpenF1Source({ fetchFn, baseUrl: "https://x.test/v1" });

    const result = await source.getRaceResults({
      season: 2026,
      round: 15,
      date: "2026-08-23T13:00:00Z",
    });

    expect(result?.classification).toHaveLength(7);
    expect(result?.fastestLapDriver).toBe("LEC");
    expect(result?.dnfCount).toBe(2);
    expect(result?.redFlagCount).toBe(0);
    // The right session was resolved from the date.
    expect(fetchFn).toHaveBeenCalledWith(
      "https://x.test/v1/session_result?session_key=11353",
    );
  });

  it("treats an empty race_control payload as zero red flags", async () => {
    const withFlag = makeFetch({ race_control: ONE_RED_FLAG });
    const source = new OpenF1Source({ fetchFn: withFlag });
    const flagged = await source.getRaceResults({
      season: 2026,
      round: 15,
      date: "2026-08-23",
    });
    expect(flagged?.redFlagCount).toBe(1);

    const noFlag = makeFetch({ race_control: NO_RESULTS });
    const clean = await new OpenF1Source({ fetchFn: noFlag }).getRaceResults({
      season: 2026,
      round: 15,
      date: "2026-08-23",
    });
    expect(clean?.redFlagCount).toBe(0);
  });

  it("returns null when session_result has no data", async () => {
    const fetchFn = makeFetch({ session_result: NO_RESULTS });
    const source = new OpenF1Source({ fetchFn });
    expect(
      await source.getRaceResults({
        season: 2026,
        round: 15,
        date: "2026-08-23",
      }),
    ).toBeNull();
  });

  it("returns null (not a throw) inside the paid live window (HTTP 403)", async () => {
    const fetchFn = makeFetch({ session_result: 403 });
    const source = new OpenF1Source({ fetchFn });
    await expect(
      source.getRaceResults({ season: 2026, round: 15, date: "2026-08-23" }),
    ).resolves.toBeNull();
  });

  it("returns null when no session matches the race date", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchFn = makeFetch();
    const source = new OpenF1Source({ fetchFn });

    expect(
      await source.getRaceResults({
        season: 2026,
        round: 15,
        date: "2026-12-25",
      }),
    ).toBeNull();
    // Never falls through to a session_result fetch.
    expect(fetchFn).not.toHaveBeenCalledWith(
      expect.stringContaining("/session_result"),
    );
    warn.mockRestore();
  });

  it("throws on an unexpected non-OK status", async () => {
    const fetchFn = makeFetch({ session_result: 500 });
    const source = new OpenF1Source({ fetchFn });
    await expect(
      source.getRaceResults({ season: 2026, round: 15, date: "2026-08-23" }),
    ).rejects.toThrow(/500/);
  });

  it("fetches the season calendar once across multiple races (memoized)", async () => {
    const fetchFn = makeFetch();
    const source = new OpenF1Source({ fetchFn, baseUrl: "https://x.test/v1" });

    await source.getRaceResults({ season: 2026, round: 8, date: "2026-06-14" });
    await source.getRaceResults({ season: 2026, round: 15, date: "2026-08-23" });

    const calendarCalls = fetchFn.mock.calls.filter(([url]) =>
      url.includes("/sessions"),
    );
    expect(calendarCalls).toHaveLength(1);
  });
});
