/**
 * Internal, source-agnostic F1 result types.
 *
 * Nothing outside `lib/f1-adapter` should reference an external API's response
 * shape (CLAUDE.md #6). Every source — Jolpica today, OpenF1 or another
 * tomorrow — translates into these types, so swapping sources is a change
 * confined to this folder.
 */

/** One driver's line in a race's final classification. */
export type RaceClassificationEntry = {
  /** Classified finishing position (1-based). */
  position: number;
  /** Short driver code, e.g. "VER". Sanitized; never a raw API field. */
  driverCode: string;
  /** Full driver name, e.g. "Max Verstappen". Sanitized. */
  driverName: string;
  /** Entrant/team name, e.g. "Red Bull". Sanitized. */
  constructorName: string;
  /** Classification status, e.g. "Finished", "+1 Lap", "Accident". Sanitized. */
  status: string;
  /** Derived: did the driver complete the race (i.e. not a DNF)? */
  finished: boolean;
};

/** A single race's final result, translated into the app's own shape. */
export type RaceResult = {
  season: number;
  round: number;
  /** Finishing order, sorted by position ascending. */
  classification: RaceClassificationEntry[];
  /** Driver code credited with the fastest lap, or null if unavailable. */
  fastestLapDriver: string | null;
  /** Count of classified non-finishers. */
  dnfCount: number;
  /**
   * Whether a red flag occurred. `null` means UNKNOWN — Jolpica/Ergast does
   * not expose red-flag data, so we record it as unknown rather than guess
   * (see the ticket). A future source that provides it can fill this in.
   */
  redFlag: boolean | null;
};

/**
 * Swappable F1 data source. The rest of the app depends on this interface,
 * not on any concrete API client.
 */
export interface F1DataSource {
  /**
   * Fetch the final classification for a completed race. Resolves to `null`
   * when the source has no results for that race yet (e.g. not run, or the
   * response was malformed and could not be trusted). Rejects on transport
   * errors (non-OK HTTP status, network failure).
   */
  getRaceResults(season: number, round: number): Promise<RaceResult | null>;
}
