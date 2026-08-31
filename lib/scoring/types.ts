/**
 * Types for the prediction scoring layer.
 *
 * This layer is intentionally pure and decoupled from the database and UI
 * (see Ticket #17): every function takes plain predictions + results in and
 * returns plain score objects out, so it is trivially unit-testable and the
 * dashboard (Ticket 5) can render the shapes without re-deriving anything.
 */
import type { PredictionFields } from "@/lib/predictions/types";
import type { RaceResult } from "@/lib/f1-adapter/types";

/** Score for a single scored category on a single race. */
export type CategoryScore = {
  /** Points earned in this category. */
  points: number;
  /**
   * Maximum points obtainable in this category for this race. `0` means the
   * category is not scoreable for this race (e.g. red-flag data unavailable),
   * so it is excluded from the accuracy denominator entirely.
   */
  max: number;
  /**
   * Whether the prediction was fully correct in this category. For podium this
   * means the exact P1/P2/P3 order; a partial-credit podium is `false`.
   * `null` means the category could not be scored (see `max === 0`).
   */
  correct: boolean | null;
};

/** Per-category breakdown of a single race's score for one person. */
export type RaceScore = {
  podium: CategoryScore;
  fastestLap: CategoryScore;
  dnfCount: CategoryScore;
  redFlag: CategoryScore;
  /** Sum of points across all categories. */
  points: number;
  /** Sum of category maxima that were scoreable (the denominator source). */
  maxPoints: number;
  /**
   * True when no prediction row existed for this race — every field displays
   * as `-` and scores zero, but the race still counts toward the maximum.
   */
  missing: boolean;
};

/** One race paired with its (already fetched + sanitized) result. */
export type ScoredRace = {
  raceId: string;
  result: RaceResult;
};

/** A person's full-season score, aggregated across all completed races. */
export type PersonSeasonScore = {
  /** Total points earned across every scored category and race. */
  totalPoints: number;
  /** Maximum points that were obtainable across the same races. */
  maxPoints: number;
  /**
   * Season accuracy as a percentage: `totalPoints / maxPoints * 100`, rounded
   * to one decimal place. `0` when there is nothing scoreable yet. See
   * `scoreSeasonForPerson` for the weighting caveat.
   */
  accuracyPct: number;
  /** Per-race breakdown, in the order the races were supplied. */
  raceScores: Array<{ raceId: string; score: RaceScore }>;
};

/** A person's identity paired with their season score, for head-to-head. */
export type PersonEntry = {
  userId: string;
  score: PersonSeasonScore;
};

/** Result of the simple head-to-head "you vs. spouse" comparison. */
export type HeadToHead = {
  a: { userId: string; points: number; accuracyPct: number };
  b: { userId: string; points: number; accuracyPct: number };
  /** `userId` of whoever leads on total points, or `null` if tied. */
  leaderUserId: string | null;
  /** Absolute points difference between the two. */
  pointsDifference: number;
};

export type { PredictionFields, RaceResult };
