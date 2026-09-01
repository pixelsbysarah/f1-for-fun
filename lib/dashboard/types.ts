/**
 * View-model types for the public dashboard + score summary.
 *
 * This layer is pure and decoupled from Supabase and React: `buildDashboard`
 * (see `build.ts`) takes plain races/results/predictions/participants in and
 * returns these render-ready shapes out, so the ordering and correct/incorrect
 * styling logic is unit-testable without a database or the DOM.
 */
import type { PredictionFields, RaceResult } from "@/lib/scoring";
import type { RaceScore } from "@/lib/scoring";

/**
 * Display state of a single prediction field, driving its styling:
 *   - `correct`   — matches the actual result: full team color + green check.
 *   - `incorrect` — wrong: rendered greyscale.
 *   - `missing`   — no value was predicted: shows `-`, scores zero.
 *   - `pending`   — no judgement yet: race not completed, or the category is
 *                   not scoreable (e.g. red-flag data unavailable). Neutral.
 */
export type FieldState = "correct" | "incorrect" | "missing" | "pending";

/** A single rendered prediction (or actual-result) field. */
export type FieldView = {
  /** Text to display; `-` for a missing value. */
  value: string;
  state: FieldState;
  /**
   * Team color hex applied to the text, or `null` for none. Only ever set for
   * driver fields that are `correct` (or for actual-result driver fields).
   * Sourced from the editable `teamColors` config, never a literal here.
   */
  teamColor: string | null;
};

/** The six scored categories, in display order. */
export type CategoryKey =
  | "p1"
  | "p2"
  | "p3"
  | "fastestLap"
  | "dnfCount"
  | "redFlag";

/** One person's rendered predictions for one race. */
export type PersonRaceView = {
  userId: string;
  displayName: string;
  fields: Record<CategoryKey, FieldView>;
  /** Per-race score, or `null` when the race is not yet completed. */
  score: RaceScore | null;
};

/** The actual outcome of a completed race, per category. */
export type ActualRaceView = Record<CategoryKey, FieldView>;

/** One race row on the dashboard. */
export type RaceView = {
  raceId: string;
  season: number;
  round: number;
  name: string;
  raceDate: string | null;
  isCompleted: boolean;
  /** Actual result columns, or `null` for an upcoming race. */
  actual: ActualRaceView | null;
  people: PersonRaceView[];
};

/** One person's season totals for the head-to-head summary. */
export type PersonSeasonView = {
  userId: string;
  displayName: string;
  totalPoints: number;
  maxPoints: number;
  accuracyPct: number;
};

/** The head-to-head score summary across all completed races. */
export type SeasonView = {
  people: PersonSeasonView[];
  /** `userId` of whoever leads on total points, or `null` if tied/empty. */
  leaderUserId: string | null;
};

/** The full dashboard view model. */
export type DashboardView = {
  season: SeasonView;
  races: RaceView[];
};

/** A participant in the tracker (one of the manually-created accounts). */
export type Participant = {
  userId: string;
  displayName: string;
};

/** A race plus its result, if completed — the builder's per-race input. */
export type RaceInput = {
  id: string;
  season: number;
  round: number;
  name: string;
  raceDate: string | null;
  isCompleted: boolean;
  /** Sanitized result, or `null` when the race has no stored results yet. */
  result: RaceResult | null;
};

/** predictions[userId][raceId] → that user's prediction for that race. */
export type PredictionsByUser = Record<
  string,
  Record<string, PredictionFields>
>;

/** Everything `buildDashboard` needs, decoupled from any data source. */
export type DashboardInput = {
  races: RaceInput[];
  participants: Participant[];
  predictions: PredictionsByUser;
};
