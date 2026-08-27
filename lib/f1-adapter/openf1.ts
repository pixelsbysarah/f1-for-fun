/**
 * OpenF1 data source (openf1.org, free, no auth).
 *
 * This is the ONLY file that knows OpenF1's response shape. It composes the
 * per-session OpenF1 endpoints into the app's internal {@link RaceResult}
 * types and hands back nothing else, so swapping to another source later is
 * confined to adding a sibling implementation of {@link F1DataSource}
 * (CLAUDE.md #6).
 *
 * All extracted values pass through the sanitizers in `./sanitize` before they
 * leave this layer — no raw external field is ever returned (CLAUDE.md #5).
 *
 * OpenF1 has no round number, so a race is matched to a session by date, never
 * by ordinal position (see {@link selectRaceSessionKey}). Every endpoint
 * returns the object `{"detail":"No results found."}` — NOT an empty array —
 * when there is no data; {@link OpenF1Source.fetchRows} treats any non-array
 * body as "no data".
 */
import { sanitizeText, toNonNegativeInt } from "./sanitize";
import type {
  F1DataSource,
  RaceClassificationEntry,
  RaceResult,
} from "./types";

/** Default OpenF1 base URL. Overridable (e.g. in tests) via the constructor. */
export const OPENF1_BASE_URL = "https://api.openf1.org/v1";

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

/** UTC calendar day (YYYY-MM-DD) of a timestamp string, or null if unparseable. */
function isoDay(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toISOString().slice(0, 10);
}

/** Resolved driver identity, keyed by car number. Any field may be null. */
type DriverInfo = {
  code: string | null;
  name: string | null;
  team: string | null;
};

/**
 * Pick the session_key of the Race session matching `date` from a raw
 * `/sessions?year=…&session_type=Race` payload.
 *
 * Matching is by UTC calendar day, never by ordinal position: OpenF1 exposes
 * no round number, and the 2026 calendar contains a data artifact session that
 * ordinal counting would let shift every later round onto the wrong results.
 * Sprints (`session_name: "Sprint"`) and cancelled sessions are ignored.
 * Returns `null` when nothing matches — the caller never guesses.
 */
export function selectRaceSessionKey(
  sessions: unknown[],
  date: string,
): number | null {
  const targetDay = isoDay(date);
  if (targetDay === null) return null;

  for (const raw of sessions) {
    const rec = asRecord(raw);
    if (!rec) continue;
    if (rec.session_name !== "Race") continue;
    if (rec.is_cancelled === true) continue;
    if (isoDay(rec.date_start) !== targetDay) continue;

    const key = toNonNegativeInt(rec.session_key);
    if (key !== null) return key;
  }
  return null;
}

/** Build a car-number → identity map from a raw `/drivers` payload. */
export function buildDriverMap(drivers: unknown[]): Map<number, DriverInfo> {
  const map = new Map<number, DriverInfo>();
  for (const raw of drivers) {
    const rec = asRecord(raw);
    if (!rec) continue;
    const num = toNonNegativeInt(rec.driver_number);
    if (num === null) continue;
    map.set(num, {
      code: sanitizeText(rec.name_acronym, 5),
      name: sanitizeText(rec.full_name, 80),
      team: sanitizeText(rec.team_name, 60),
    });
  }
  return map;
}

/**
 * Translate one raw `/session_result` row into an internal classification
 * entry, resolving the driver identity via `driverMap`. Returns `null` when
 * the row has no usable position or driver number.
 *
 * OpenF1 has no status string — only `dnf`/`dns`/`dsq` booleans — so a readable
 * status is synthesized for the stored JSON. `finished` is derived from `dnf`
 * alone (a DSQ/DNS driver who was running at the flag is not a DNF).
 */
export function translateEntry(
  raw: unknown,
  driverMap: Map<number, DriverInfo>,
): RaceClassificationEntry | null {
  const rec = asRecord(raw);
  if (!rec) return null;

  const position = toNonNegativeInt(rec.position);
  if (position === null || position < 1) return null;

  const driverNumber = toNonNegativeInt(rec.driver_number);
  const info = driverNumber !== null ? driverMap.get(driverNumber) : undefined;

  // Prefer the short acronym ("NOR"); fall back to the car number.
  const driverCode =
    info?.code ?? (driverNumber !== null ? String(driverNumber) : null);
  if (!driverCode) return null;

  const driverName = info?.name ?? driverCode;
  const constructorName = info?.team ?? "Unknown";

  const dnf = rec.dnf === true;
  const dns = rec.dns === true;
  const dsq = rec.dsq === true;
  const status = dsq ? "DSQ" : dns ? "DNS" : dnf ? "DNF" : "Finished";

  return {
    position,
    driverCode,
    driverName,
    constructorName,
    status,
    finished: dnf === false,
  };
}

/**
 * Fastest lap driver code from a raw `/laps` payload: the driver with the
 * minimum non-null `lap_duration`.
 *
 * OpenF1 does not mark deleted laps, so this is the fastest *recorded* lap and
 * can rarely differ from F1's official fastest lap. Null when no lap has a
 * usable duration.
 */
export function fastestLapDriver(
  laps: unknown[],
  driverMap: Map<number, DriverInfo>,
): string | null {
  let bestDuration = Number.POSITIVE_INFINITY;
  let bestDriver: number | null = null;

  for (const raw of laps) {
    const rec = asRecord(raw);
    if (!rec) continue;
    const duration = rec.lap_duration;
    // Skip null / missing / non-finite durations (pit/out laps, no time set).
    if (typeof duration !== "number" || !Number.isFinite(duration)) continue;
    const num = toNonNegativeInt(rec.driver_number);
    if (num === null) continue;
    if (duration < bestDuration) {
      bestDuration = duration;
      bestDriver = num;
    }
  }

  if (bestDriver === null) return null;
  return driverMap.get(bestDriver)?.code ?? String(bestDriver);
}

/**
 * Count Track-scope RED events from a raw `/race_control?flag=RED&scope=Track`
 * payload. Each object row is one event; an empty payload means 0 red flags,
 * NOT unknown.
 */
export function countRedFlags(raceControl: unknown[]): number {
  return raceControl.filter((raw) => asRecord(raw) !== null).length;
}

/**
 * Compose the four per-session OpenF1 payloads into a {@link RaceResult}.
 * Returns `null` when the session has no usable classification.
 */
export function buildRaceResult(input: {
  season: number;
  round: number;
  sessionResult: unknown[];
  laps: unknown[];
  raceControl: unknown[];
  drivers: unknown[];
}): RaceResult | null {
  const driverMap = buildDriverMap(input.drivers);

  const classification: RaceClassificationEntry[] = [];
  for (const raw of input.sessionResult) {
    const entry = translateEntry(raw, driverMap);
    if (entry) classification.push(entry);
  }
  if (classification.length === 0) return null;

  classification.sort((a, b) => a.position - b.position);

  // dnfCount is rows where `dnf === true` ONLY. DNS and DSQ are deliberately
  // excluded — a driver who never started, or was disqualified while running,
  // is not a "did not finish". Do not "fix" this to include them.
  const dnfCount = input.sessionResult.filter(
    (raw) => asRecord(raw)?.dnf === true,
  ).length;

  return {
    season: input.season,
    round: input.round,
    classification,
    fastestLapDriver: fastestLapDriver(input.laps, driverMap),
    dnfCount,
    redFlagCount: countRedFlags(input.raceControl),
  };
}

/** Minimal fetch surface, so tests can inject a fake without a DOM `Response`. */
export type FetchLike = (
  url: string,
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

/**
 * Concrete {@link F1DataSource} backed by the OpenF1 API. `fetchFn` and
 * `baseUrl` are injectable so the translation path can be tested against a
 * mocked HTTP layer — the real OpenF1 API is never called in tests.
 *
 * The season calendar (`/sessions`) is memoized per instance so a multi-race
 * refresh costs one calendar request, not one per race.
 */
export class OpenF1Source implements F1DataSource {
  private readonly fetchFn: FetchLike;
  private readonly baseUrl: string;
  private readonly sessionsByYear = new Map<
    number,
    Promise<unknown[] | null>
  >();

  constructor(options: { fetchFn?: FetchLike; baseUrl?: string } = {}) {
    this.fetchFn = options.fetchFn ?? ((url) => fetch(url));
    this.baseUrl = options.baseUrl ?? OPENF1_BASE_URL;
  }

  /**
   * Fetch a list endpoint. Returns the array of rows, or `null` when the data
   * is not available yet (401/403/404 — e.g. a refresh landing inside OpenF1's
   * paid live window, which is expected, not an outage). A successful response
   * whose body is not an array (OpenF1's `{"detail":"No results found."}`) is
   * treated as an empty result, not an error. Other non-OK statuses throw.
   */
  private async fetchRows(url: string): Promise<unknown[] | null> {
    const response = await this.fetchFn(url);
    if (!response.ok) {
      if ([401, 403, 404].includes(response.status)) return null;
      throw new Error(`OpenF1 request failed (HTTP ${response.status}): ${url}`);
    }
    const body = await response.json();
    return Array.isArray(body) ? body : [];
  }

  private getSessions(year: number): Promise<unknown[] | null> {
    let cached = this.sessionsByYear.get(year);
    if (!cached) {
      cached = this.fetchRows(
        `${this.baseUrl}/sessions?year=${year}&session_type=Race`,
      );
      this.sessionsByYear.set(year, cached);
    }
    return cached;
  }

  async getRaceResults(request: {
    season: number;
    round: number;
    date: string;
  }): Promise<RaceResult | null> {
    const { season, round, date } = request;

    const sessions = await this.getSessions(season);
    if (sessions === null) {
      console.warn(
        `OpenF1: session calendar unavailable for ${season}; skipping round ${round}.`,
      );
      return null;
    }

    const sessionKey = selectRaceSessionKey(sessions, date);
    if (sessionKey === null) {
      console.warn(
        `OpenF1: no Race session on ${date} for ${season} round ${round}; not guessing.`,
      );
      return null;
    }

    const sessionResult = await this.fetchRows(
      `${this.baseUrl}/session_result?session_key=${sessionKey}`,
    );
    // Unavailable (live window) or empty (not classified yet) → no result yet.
    if (sessionResult === null || sessionResult.length === 0) return null;

    // Sequential to stay well under OpenF1's 3 req/s limit.
    const laps = await this.fetchRows(
      `${this.baseUrl}/laps?session_key=${sessionKey}`,
    );
    const raceControl = await this.fetchRows(
      `${this.baseUrl}/race_control?session_key=${sessionKey}&flag=RED&scope=Track`,
    );
    const drivers = await this.fetchRows(
      `${this.baseUrl}/drivers?session_key=${sessionKey}`,
    );

    return buildRaceResult({
      season,
      round,
      sessionResult,
      laps: laps ?? [],
      raceControl: raceControl ?? [],
      drivers: drivers ?? [],
    });
  }
}
