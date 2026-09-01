/**
 * Pure dashboard view-model builder.
 *
 * Turns races (+ optional results), participants, and their predictions into
 * render-ready view models: the head-to-head season summary and the per-race
 * detail rows, ordered most-recent-first. All correct/incorrect/missing styling
 * *decisions* are made here (as `FieldState`s), not in the React components, so
 * they can be unit-tested directly (see `build.test.ts`).
 */
import {
  constructorAliases,
  teamColors,
} from "@/lib/config/design-tokens";
import {
  normalizeDriver,
  predictionMatchesEntry,
  scoreRace,
  scoreSeasonForPerson,
} from "@/lib/scoring";
import type {
  PredictionFields,
  RaceResult,
  ScoredRace,
} from "@/lib/scoring";
import type { RaceClassificationEntry } from "@/lib/f1-adapter/types";

import type {
  ActualRaceView,
  CategoryKey,
  DashboardInput,
  DashboardView,
  FieldView,
  PersonRaceView,
  PersonSeasonView,
  RaceInput,
  RaceView,
  SeasonView,
} from "./types";

const EMPTY_FIELD: Readonly<FieldView> = {
  value: "-",
  state: "missing",
  teamColor: null,
};

/**
 * Resolve a constructor/team name to its team-color hex, or `null` when no
 * alias matches. Case-insensitive substring match against the editable
 * `constructorAliases` config.
 */
export function resolveTeamColor(
  constructorName: string | null | undefined,
): string | null {
  if (!constructorName) return null;
  const name = constructorName.toLowerCase();
  for (const { match, slug } of constructorAliases) {
    if (name.includes(match)) {
      return teamColors[slug]?.primary ?? null;
    }
  }
  return null;
}

/** The classified finisher in a given 1-based position, or `null`. */
function entryAtPosition(
  result: RaceResult,
  position: number,
): RaceClassificationEntry | null {
  return result.classification.find((e) => e.position === position) ?? null;
}

/** The classified entry a driver code/name refers to, or `null`. */
function entryForDriver(
  result: RaceResult,
  driver: string | null,
): RaceClassificationEntry | null {
  if (driver == null) return null;
  return (
    result.classification.find((e) => predictionMatchesEntry(driver, e)) ?? null
  );
}

/**
 * A driver-prediction field styled against the actual finisher of that exact
 * position. Correct = predicted driver finished in that position (full team
 * color); otherwise greyscale. `null` prediction shows `-`.
 */
function driverField(
  predicted: string | null,
  actualEntry: RaceClassificationEntry | null,
  completed: boolean,
): FieldView {
  if (predicted == null || normalizeDriver(predicted) == null) {
    return { ...EMPTY_FIELD };
  }
  if (!completed) {
    return { value: predicted, state: "pending", teamColor: null };
  }
  const correct = predictionMatchesEntry(predicted, actualEntry);
  return {
    value: predicted,
    state: correct ? "correct" : "incorrect",
    teamColor: correct ? resolveTeamColor(actualEntry?.constructorName) : null,
  };
}

/**
 * The fastest-lap prediction, styled against the race's actual fastest-lap
 * driver. Correct picks are colored by the driver's team (looked up in the
 * classification).
 */
function fastestLapField(
  predicted: string | null,
  result: RaceResult | null,
): FieldView {
  if (predicted == null || normalizeDriver(predicted) == null) {
    return { ...EMPTY_FIELD };
  }
  if (result == null) {
    return { value: predicted, state: "pending", teamColor: null };
  }
  const actual = normalizeDriver(result.fastestLapDriver);
  const correct = actual != null && normalizeDriver(predicted) === actual;
  return {
    value: predicted,
    state: correct ? "correct" : "incorrect",
    teamColor: correct
      ? resolveTeamColor(
          entryForDriver(result, result.fastestLapDriver)?.constructorName,
        )
      : null,
  };
}

/** A numeric prediction field (DNF count / red flags) styled by equality. */
function numberField(
  predicted: number | null,
  actual: number | null,
  completed: boolean,
): FieldView {
  if (predicted == null) return { ...EMPTY_FIELD };
  if (!completed || actual == null) {
    // Not completed, or category not scoreable (e.g. red-flag data missing):
    // show the prediction with no judgement.
    return { value: String(predicted), state: "pending", teamColor: null };
  }
  return {
    value: String(predicted),
    state: predicted === actual ? "correct" : "incorrect",
    teamColor: null,
  };
}

/** Build one person's rendered fields for one race. */
function personRaceView(
  userId: string,
  displayName: string,
  prediction: PredictionFields | null,
  race: RaceInput,
): PersonRaceView {
  const result = race.result;
  const completed = race.isCompleted && result != null;

  const p = prediction;
  const fields: Record<CategoryKey, FieldView> = {
    p1: driverField(
      p?.p1Driver ?? null,
      result ? entryAtPosition(result, 1) : null,
      completed,
    ),
    p2: driverField(
      p?.p2Driver ?? null,
      result ? entryAtPosition(result, 2) : null,
      completed,
    ),
    p3: driverField(
      p?.p3Driver ?? null,
      result ? entryAtPosition(result, 3) : null,
      completed,
    ),
    fastestLap: fastestLapField(p?.fastestLapDriver ?? null, result),
    dnfCount: numberField(p?.dnfCount ?? null, result?.dnfCount ?? null, completed),
    redFlag: numberField(
      p?.redFlagCount ?? null,
      result?.redFlagCount ?? null,
      completed,
    ),
  };

  return {
    userId,
    displayName,
    fields,
    score: completed && result ? scoreRace(prediction, result) : null,
  };
}

/** The actual-outcome columns for a completed race. */
function actualRaceView(result: RaceResult): ActualRaceView {
  const driverActual = (entry: RaceClassificationEntry | null): FieldView =>
    entry
      ? {
          value: entry.driverCode || entry.driverName,
          state: "correct",
          teamColor: resolveTeamColor(entry.constructorName),
        }
      : { value: "-", state: "pending", teamColor: null };

  const numberActual = (value: number | null): FieldView =>
    value == null
      ? { value: "-", state: "pending", teamColor: null }
      : { value: String(value), state: "pending", teamColor: null };

  const flEntry = entryForDriver(result, result.fastestLapDriver);
  return {
    p1: driverActual(entryAtPosition(result, 1)),
    p2: driverActual(entryAtPosition(result, 2)),
    p3: driverActual(entryAtPosition(result, 3)),
    fastestLap: result.fastestLapDriver
      ? {
          value: result.fastestLapDriver,
          state: "correct",
          teamColor: resolveTeamColor(flEntry?.constructorName),
        }
      : { value: "-", state: "pending", teamColor: null },
    dnfCount: numberActual(result.dnfCount),
    redFlag: numberActual(result.redFlagCount),
  };
}

/** Does anyone have a prediction for this race? */
function anyPrediction(
  raceId: string,
  input: DashboardInput,
): boolean {
  return input.participants.some(
    (person) => input.predictions[person.userId]?.[raceId] != null,
  );
}

/**
 * Build the full dashboard view model.
 *
 * Dashboard rows are ordered most-recent-first (by season then round,
 * descending) and limited to races that are either completed or have at least
 * one prediction, so the tracker stays focused on relevant content. The season
 * summary aggregates every completed race via the shared scoring module.
 */
export function buildDashboard(input: DashboardInput): DashboardView {
  const { participants, predictions } = input;

  // Most-recent-first: season desc, then round desc.
  const orderedRaces = [...input.races].sort(
    (a, b) => b.season - a.season || b.round - a.round,
  );

  const races: RaceView[] = orderedRaces
    .filter((race) => race.isCompleted || anyPrediction(race.id, input))
    .map((race) => {
      const completed = race.isCompleted && race.result != null;
      return {
        raceId: race.id,
        season: race.season,
        round: race.round,
        name: race.name,
        raceDate: race.raceDate,
        isCompleted: completed,
        actual: completed && race.result ? actualRaceView(race.result) : null,
        people: participants.map((person) =>
          personRaceView(
            person.userId,
            person.displayName,
            predictions[person.userId]?.[race.id] ?? null,
            race,
          ),
        ),
      };
    });

  return { season: buildSeason(input), races };
}

/** Aggregate each participant's completed-race totals for the head-to-head. */
function buildSeason(input: DashboardInput): SeasonView {
  const completed: ScoredRace[] = input.races
    .filter((r) => r.isCompleted && r.result != null)
    .map((r) => ({ raceId: r.id, result: r.result as RaceResult }));

  const people: PersonSeasonView[] = input.participants.map((person) => {
    const byRace = input.predictions[person.userId] ?? {};
    const score = scoreSeasonForPerson(byRace, completed);
    return {
      userId: person.userId,
      displayName: person.displayName,
      totalPoints: score.totalPoints,
      maxPoints: score.maxPoints,
      accuracyPct: score.accuracyPct,
    };
  });

  // Leader = strictly-highest total points; null on a tie or when nobody has
  // any (avoids crowning a leader before any race is scored).
  let leaderUserId: string | null = null;
  let best = -1;
  let tied = false;
  for (const p of people) {
    if (p.totalPoints > best) {
      best = p.totalPoints;
      leaderUserId = p.userId;
      tied = false;
    } else if (p.totalPoints === best) {
      tied = true;
    }
  }
  if (tied || best <= 0) leaderUserId = null;

  return { people, leaderUserId };
}
