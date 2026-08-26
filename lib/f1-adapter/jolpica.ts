/**
 * Jolpica F1 data source (Ergast-compatible, free, no auth).
 *
 * This is the ONLY file that knows Jolpica's response shape. It translates the
 * raw Ergast JSON into the app's internal {@link RaceResult} types and hands
 * back nothing else, so swapping to OpenF1 or another source later is confined
 * to adding a sibling implementation of {@link F1DataSource} (CLAUDE.md #6).
 *
 * All extracted values pass through the sanitizers in `./sanitize` before they
 * leave this layer — no raw external field is ever returned (CLAUDE.md #5).
 */
import { sanitizeText, toNonNegativeInt } from "./sanitize";
import type {
  F1DataSource,
  RaceClassificationEntry,
  RaceResult,
} from "./types";

/** Default Jolpica base URL. Overridable (e.g. in tests) via the constructor. */
export const JOLPICA_BASE_URL = "https://api.jolpi.ca/ergast/f1";

/**
 * A driver is only counted as having finished when classified on the lead lap
 * ("Finished") or lapped ("+1 Lap", "+2 Laps"). Every other status — Accident,
 * Engine, Collision, Retired, Disqualified, etc. — is treated as a DNF.
 */
const FINISHED_STATUS = /^(?:Finished|\+\d+\s+Laps?)$/i;

export function didFinish(status: string | null): boolean {
  return status !== null && FINISHED_STATUS.test(status);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Translate one raw Ergast result entry. Returns the internal entry plus
 * whether this entry holds the fastest lap, or `null` if the entry is too
 * malformed to trust (no usable position or driver identity).
 */
export function translateResult(
  raw: unknown,
): { entry: RaceClassificationEntry; isFastestLap: boolean } | null {
  const result = asRecord(raw);
  if (!result) return null;

  const position = toNonNegativeInt(result.position);
  if (position === null || position < 1) return null;

  const driver = asRecord(result.Driver) ?? {};
  const constructor = asRecord(result.Constructor) ?? {};

  const given = sanitizeText(driver.givenName, 40);
  const family = sanitizeText(driver.familyName, 40);
  const fullName = [given, family].filter(Boolean).join(" ");

  // Prefer the short code ("VER"); fall back to the driverId, then family name.
  const driverCode =
    sanitizeText(driver.code, 5) ??
    sanitizeText(driver.driverId, 30) ??
    family;

  // Prefer the full name; fall back to the code so a code-only entry is kept.
  const driverName = fullName !== "" ? fullName : driverCode;

  if (!driverCode || !driverName) return null;

  const constructorName = sanitizeText(constructor.name, 60) ?? "Unknown";
  const status = sanitizeText(result.status, 40) ?? "Unknown";

  const fastestLap = asRecord(result.FastestLap);
  const isFastestLap =
    fastestLap !== null && sanitizeText(fastestLap.rank, 4) === "1";

  return {
    entry: {
      position,
      driverCode,
      driverName,
      constructorName,
      status,
      finished: didFinish(status),
    },
    isFastestLap,
  };
}

/**
 * Translate a single raw Ergast `Race` object into a {@link RaceResult}.
 * Returns `null` when the race carries no usable results.
 */
export function translateRace(rawRace: unknown): RaceResult | null {
  const race = asRecord(rawRace);
  if (!race) return null;

  const season = toNonNegativeInt(race.season);
  const round = toNonNegativeInt(race.round);
  if (season === null || round === null) return null;

  const rawResults = race.Results;
  if (!Array.isArray(rawResults) || rawResults.length === 0) return null;

  const classification: RaceClassificationEntry[] = [];
  let fastestLapDriver: string | null = null;

  for (const raw of rawResults) {
    const translated = translateResult(raw);
    if (!translated) continue;
    classification.push(translated.entry);
    if (translated.isFastestLap && fastestLapDriver === null) {
      fastestLapDriver = translated.entry.driverCode;
    }
  }

  if (classification.length === 0) return null;

  classification.sort((a, b) => a.position - b.position);
  const dnfCount = classification.filter((entry) => !entry.finished).length;

  return {
    season,
    round,
    classification,
    fastestLapDriver,
    dnfCount,
    // Jolpica/Ergast does not expose red-flag data; record unknown, don't guess.
    redFlag: null,
  };
}

/**
 * Parse a full Ergast `/results` response body. Validates the nested envelope
 * shape defensively and, when `expected` is given, confirms the returned race
 * matches the one requested (a source returning a different race is treated as
 * no result rather than silently stored against the wrong row).
 */
export function parseRaceResultsResponse(
  rawJson: unknown,
  expected?: { season: number; round: number },
): RaceResult | null {
  const root = asRecord(rawJson);
  const mrData = asRecord(root?.MRData);
  const raceTable = asRecord(mrData?.RaceTable);
  const races = raceTable?.Races;
  if (!Array.isArray(races) || races.length === 0) return null;

  const result = translateRace(races[0]);
  if (!result) return null;

  if (
    expected &&
    (result.season !== expected.season || result.round !== expected.round)
  ) {
    return null;
  }

  return result;
}

/** Minimal fetch surface, so tests can inject a fake without a DOM `Response`. */
export type FetchLike = (
  url: string,
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

/**
 * Concrete {@link F1DataSource} backed by the Jolpica API. `fetchFn` and
 * `baseUrl` are injectable so the translation path can be tested against a
 * mocked HTTP layer — the real Jolpica API is never called in tests.
 */
export class JolpicaF1Source implements F1DataSource {
  private readonly fetchFn: FetchLike;
  private readonly baseUrl: string;

  constructor(options: { fetchFn?: FetchLike; baseUrl?: string } = {}) {
    this.fetchFn = options.fetchFn ?? ((url) => fetch(url));
    this.baseUrl = options.baseUrl ?? JOLPICA_BASE_URL;
  }

  async getRaceResults(
    season: number,
    round: number,
  ): Promise<RaceResult | null> {
    const url = `${this.baseUrl}/${season}/${round}/results.json`;
    const response = await this.fetchFn(url);
    if (!response.ok) {
      throw new Error(
        `Jolpica request failed (HTTP ${response.status}) for ${season} round ${round}.`,
      );
    }
    const json = await response.json();
    return parseRaceResultsResponse(json, { season, round });
  }
}
