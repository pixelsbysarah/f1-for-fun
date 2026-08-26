/**
 * Internal shape of a per-race prediction. Mirrors the `predictions` table
 * columns (see supabase/migrations). All prediction fields are optional: a
 * user may save a partial prediction, and any missing field renders as `-`
 * and scores zero (build-spec scoring rules).
 */
export type PredictionFields = {
  /** Predicted podium finishers, top to bottom. Driver codes/names as text. */
  p1Driver: string | null;
  p2Driver: string | null;
  p3Driver: string | null;
  /** Predicted fastest-lap driver. */
  fastestLapDriver: string | null;
  /** Predicted number of DNFs. */
  dnfCount: number | null;
  /** Predicted number of red flags shown during the race. */
  redFlagCount: number | null;
};

/** A prediction row as read from the database (includes ownership + linkage). */
export type PredictionRow = PredictionFields & {
  id: string;
  userId: string;
  raceId: string;
};

/** A race as read from the database. */
export type Race = {
  id: string;
  season: number;
  round: number;
  name: string;
  circuit: string | null;
  raceDate: string | null;
  isCompleted: boolean;
};
