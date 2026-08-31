/**
 * Prediction scoring — pure comparison of stored predictions against stored
 * race results (Ticket #17).
 *
 * Nothing here touches the database or React; callers pass predictions +
 * results in and get score objects out. Keeping it pure is deliberate: this is
 * the highest-risk logic in the app for silent bugs, so it is isolated and
 * exhaustively unit-tested.
 *
 * ── Scoring rules (implemented exactly as specified in Ticket #17) ───────────
 * Podium (P1/P2/P3):
 *   - 3 correct drivers AND correct order .................. 4 points
 *   - 3 correct drivers, wrong order ...................... 3 points
 *   - 2 correct drivers (order irrelevant) ............... 2 points
 *   - 1 correct driver (order irrelevant) ................ 1 point
 *   - otherwise .......................................... 0 points
 * Fastest lap / DNF count / red flags: 1 point if correct, else 0, each
 *   category scored independently.
 * Missing prediction (no row for a race): every field displays as `-` and
 *   scores 0, but the race still counts toward the maximum possible points.
 *
 * NOTE: This scheme supersedes the older `1 / 0.5 / 0` podium scheme still
 * described in CLAUDE.md / docs/build-spec.md. The point values live in
 * `PODIUM_POINTS` / `CATEGORY_POINTS` below so they are trivial to retune in
 * one place if the docs are reconciled the other way.
 */
import type { RaceClassificationEntry } from "@/lib/f1-adapter/types";
import type {
  CategoryScore,
  HeadToHead,
  PersonEntry,
  PersonSeasonScore,
  PredictionFields,
  RaceResult,
  RaceScore,
  ScoredRace,
} from "./types";

export type {
  CategoryScore,
  HeadToHead,
  PersonEntry,
  PersonSeasonScore,
  RaceScore,
  ScoredRace,
} from "./types";

/** Podium point values, keyed by outcome. Single source of truth. */
export const PODIUM_POINTS = {
  /** All three drivers correct AND in the exact P1/P2/P3 order. */
  exactOrder: 4,
  /** All three drivers correct, any wrong order. */
  allThreeAnyOrder: 3,
  /** Exactly two of the three drivers on the actual podium. */
  twoCorrect: 2,
  /** Exactly one of the three drivers on the actual podium. */
  oneCorrect: 1,
  /** No predicted driver reached the podium. */
  none: 0,
} as const;

/** The most a podium prediction can earn. */
export const PODIUM_MAX = PODIUM_POINTS.exactOrder;

/** Each non-podium category is worth a flat point when correct. */
export const CATEGORY_POINTS = {
  fastestLap: 1,
  dnfCount: 1,
  redFlag: 1,
} as const;

/**
 * Normalize a driver reference for comparison: lower-cased, trimmed, and with
 * internal whitespace collapsed. Predictions are free text ("VER", "Max
 * Verstappen"), so this makes the match tolerant of casing/spacing noise.
 */
function normalizeDriver(value: string | null | undefined): string | null {
  if (value == null) return null;
  const normalized = value.trim().toLowerCase().replace(/\s+/g, " ");
  return normalized === "" ? null : normalized;
}

/**
 * Does a predicted driver string identify this classified entry? A prediction
 * may store either the short code ("VER") or a name ("Max Verstappen"), so we
 * accept a match on either the entry's driver code or its full name.
 */
function predictionMatchesEntry(
  predicted: string | null,
  entry: RaceClassificationEntry | null,
): boolean {
  if (predicted == null || entry == null) return false;
  const norm = normalizeDriver(predicted);
  if (norm == null) return false;
  return (
    norm === normalizeDriver(entry.driverCode) ||
    norm === normalizeDriver(entry.driverName)
  );
}

/** The actual finishers in positions 1, 2, 3 (null if a slot is absent). */
function actualPodium(
  result: RaceResult,
): [
  RaceClassificationEntry | null,
  RaceClassificationEntry | null,
  RaceClassificationEntry | null,
] {
  const at = (pos: number) =>
    result.classification.find((e) => e.position === pos) ?? null;
  return [at(1), at(2), at(3)];
}

/**
 * Score the podium prediction. Counts how many predicted drivers reached the
 * actual podium (order-independent), then awards the exact-order bonus only
 * when all three slots line up positionally.
 */
export function scorePodium(
  prediction: PredictionFields | null,
  result: RaceResult,
): CategoryScore {
  const podium = actualPodium(result);
  const picks = prediction
    ? [prediction.p1Driver, prediction.p2Driver, prediction.p3Driver]
    : [null, null, null];

  // Order-independent driver matches: each pick counts once if the driver
  // appears anywhere on the actual podium. Validation guarantees the three
  // picks are distinct and the podium holds three distinct drivers, so simple
  // membership counting cannot double-count.
  const correctDrivers = picks.reduce((count, pick) => {
    const hit = podium.some((entry) => predictionMatchesEntry(pick, entry));
    return count + (hit ? 1 : 0);
  }, 0);

  // Exact-order: every slot's pick matches the driver in that exact position.
  const exactOrder =
    picks.every((pick) => pick != null) &&
    picks.every((pick, i) => predictionMatchesEntry(pick, podium[i]));

  let points: number;
  if (exactOrder) {
    points = PODIUM_POINTS.exactOrder;
  } else if (correctDrivers === 3) {
    points = PODIUM_POINTS.allThreeAnyOrder;
  } else if (correctDrivers === 2) {
    points = PODIUM_POINTS.twoCorrect;
  } else if (correctDrivers === 1) {
    points = PODIUM_POINTS.oneCorrect;
  } else {
    points = PODIUM_POINTS.none;
  }

  return { points, max: PODIUM_MAX, correct: exactOrder };
}

/** Flat 1-point-if-correct score for the fastest-lap driver. */
export function scoreFastestLap(
  prediction: PredictionFields | null,
  result: RaceResult,
): CategoryScore {
  const predicted = normalizeDriver(prediction?.fastestLapDriver ?? null);
  const actual = normalizeDriver(result.fastestLapDriver);
  // A missing prediction or a race with no recorded fastest-lap driver can
  // never be correct.
  const correct = predicted != null && actual != null && predicted === actual;
  return {
    points: correct ? CATEGORY_POINTS.fastestLap : 0,
    max: CATEGORY_POINTS.fastestLap,
    correct,
  };
}

/** Flat 1-point-if-correct score for the DNF count. */
export function scoreDnfCount(
  prediction: PredictionFields | null,
  result: RaceResult,
): CategoryScore {
  const predicted = prediction?.dnfCount ?? null;
  const correct = predicted != null && predicted === result.dnfCount;
  return {
    points: correct ? CATEGORY_POINTS.dnfCount : 0,
    max: CATEGORY_POINTS.dnfCount,
    correct,
  };
}

/**
 * Flat 1-point-if-correct score for the red-flag count. Red-flag data can be
 * genuinely unavailable (`result.redFlagCount === null` = not fetched yet); in
 * that case the category is not scoreable — it earns 0 points and 0 max, so it
 * drops out of the accuracy denominator rather than penalizing anyone.
 */
export function scoreRedFlag(
  prediction: PredictionFields | null,
  result: RaceResult,
): CategoryScore {
  if (result.redFlagCount == null) {
    return { points: 0, max: 0, correct: null };
  }
  const predicted = prediction?.redFlagCount ?? null;
  const correct = predicted != null && predicted === result.redFlagCount;
  return {
    points: correct ? CATEGORY_POINTS.redFlag : 0,
    max: CATEGORY_POINTS.redFlag,
    correct,
  };
}

/**
 * Score every category for one race. Pass `null` for a missing prediction: the
 * race still contributes its full maximum, but scores zero everywhere.
 */
export function scoreRace(
  prediction: PredictionFields | null,
  result: RaceResult,
): RaceScore {
  const podium = scorePodium(prediction, result);
  const fastestLap = scoreFastestLap(prediction, result);
  const dnfCount = scoreDnfCount(prediction, result);
  const redFlag = scoreRedFlag(prediction, result);

  const categories = [podium, fastestLap, dnfCount, redFlag];
  const points = categories.reduce((sum, c) => sum + c.points, 0);
  const maxPoints = categories.reduce((sum, c) => sum + c.max, 0);

  return {
    podium,
    fastestLap,
    dnfCount,
    redFlag,
    points,
    maxPoints,
    missing: prediction == null,
  };
}

/** Round to one decimal place without floating-point display noise. */
function roundOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Aggregate one person's score across all completed races.
 *
 * `predictionsByRaceId` maps a race id to that person's prediction; a race
 * absent from the map (or mapped to `null`/`undefined`) is treated as a missing
 * prediction — scored zero for every category, but still counted in the
 * maximum.
 *
 * Accuracy weighting: the percentage is `totalPoints / maxPoints`, where the
 * maximum is summed from each category's own max — **podium counts for 4 and
 * each other category for 1** (per-race max 7 when red-flag data is present).
 * The percentage is therefore NOT weighted evenly across the four categories:
 * the podium deliberately dominates, matching this ticket's point scheme. A
 * category that is not scoreable for a race (e.g. red-flag data unavailable) is
 * excluded from both numerator and denominator.
 */
export function scoreSeasonForPerson(
  predictionsByRaceId: Record<string, PredictionFields | null | undefined>,
  races: ScoredRace[],
): PersonSeasonScore {
  let totalPoints = 0;
  let maxPoints = 0;
  const raceScores = races.map(({ raceId, result }) => {
    const prediction = predictionsByRaceId[raceId] ?? null;
    const score = scoreRace(prediction, result);
    totalPoints += score.points;
    maxPoints += score.maxPoints;
    return { raceId, score };
  });

  const accuracyPct =
    maxPoints === 0 ? 0 : roundOneDecimal((totalPoints / maxPoints) * 100);

  return { totalPoints, maxPoints, accuracyPct, raceScores };
}

/**
 * The build-spec "simple score" head-to-head: compare two people's season
 * totals and report who leads. A plain data shape for now (Ticket #17); wiring
 * it into the header UI happens in Ticket 5.
 */
export function compareHeadToHead(a: PersonEntry, b: PersonEntry): HeadToHead {
  const aPoints = a.score.totalPoints;
  const bPoints = b.score.totalPoints;

  let leaderUserId: string | null;
  if (aPoints > bPoints) {
    leaderUserId = a.userId;
  } else if (bPoints > aPoints) {
    leaderUserId = b.userId;
  } else {
    leaderUserId = null; // tie
  }

  return {
    a: { userId: a.userId, points: aPoints, accuracyPct: a.score.accuracyPct },
    b: { userId: b.userId, points: bPoints, accuracyPct: b.score.accuracyPct },
    leaderUserId,
    pointsDifference: Math.abs(aPoints - bPoints),
  };
}
