import { describe, expect, it } from "vitest";

import type {
  RaceClassificationEntry,
  RaceResult,
} from "@/lib/f1-adapter/types";
import type { PredictionFields } from "@/lib/predictions/types";
import {
  CATEGORY_POINTS,
  PODIUM_MAX,
  PODIUM_POINTS,
  compareHeadToHead,
  scoreDnfCount,
  scoreFastestLap,
  scorePodium,
  scoreRace,
  scoreRedFlag,
  scoreSeasonForPerson,
} from "./index";

// ── Fixtures ────────────────────────────────────────────────────────────────

function entry(
  position: number,
  driverCode: string,
  driverName: string,
): RaceClassificationEntry {
  return {
    position,
    driverCode,
    driverName,
    constructorName: "Team",
    status: "Finished",
    finished: true,
  };
}

/** Actual result: podium VER / NOR / LEC, fastest lap HAM, 3 DNFs, 1 red flag. */
function baseResult(overrides: Partial<RaceResult> = {}): RaceResult {
  return {
    season: 2026,
    round: 1,
    classification: [
      entry(1, "VER", "Max Verstappen"),
      entry(2, "NOR", "Lando Norris"),
      entry(3, "LEC", "Charles Leclerc"),
      entry(4, "HAM", "Lewis Hamilton"),
      entry(5, "RUS", "George Russell"),
    ],
    fastestLapDriver: "HAM",
    dnfCount: 3,
    redFlagCount: 1,
    ...overrides,
  };
}

function prediction(overrides: Partial<PredictionFields> = {}): PredictionFields {
  return {
    p1Driver: null,
    p2Driver: null,
    p3Driver: null,
    fastestLapDriver: null,
    dnfCount: null,
    redFlagCount: null,
    ...overrides,
  };
}

// ── Podium ──────────────────────────────────────────────────────────────────

describe("scorePodium", () => {
  it("awards 4 for exact drivers and exact order", () => {
    const score = scorePodium(
      prediction({ p1Driver: "VER", p2Driver: "NOR", p3Driver: "LEC" }),
      baseResult(),
    );
    expect(score.points).toBe(PODIUM_POINTS.exactOrder);
    expect(score.points).toBe(4);
    expect(score.correct).toBe(true);
    expect(score.max).toBe(PODIUM_MAX);
  });

  it("awards 3 for all three correct drivers in the wrong order", () => {
    const score = scorePodium(
      prediction({ p1Driver: "LEC", p2Driver: "VER", p3Driver: "NOR" }),
      baseResult(),
    );
    expect(score.points).toBe(3);
    expect(score.correct).toBe(false);
  });

  it("awards 2 for exactly two correct drivers regardless of order", () => {
    // VER + NOR correct, HAM (P4) is not on the podium.
    const score = scorePodium(
      prediction({ p1Driver: "VER", p2Driver: "NOR", p3Driver: "HAM" }),
      baseResult(),
    );
    expect(score.points).toBe(2);
    expect(score.correct).toBe(false);
  });

  it("awards 1 for exactly one correct driver regardless of order", () => {
    // Only LEC is on the podium; order irrelevant.
    const score = scorePodium(
      prediction({ p1Driver: "HAM", p2Driver: "RUS", p3Driver: "LEC" }),
      baseResult(),
    );
    expect(score.points).toBe(1);
    expect(score.correct).toBe(false);
  });

  it("still awards 1 when the single correct driver sits in the right slot", () => {
    // VER correct in P1, other two picks off-podium -> one correct driver.
    const score = scorePodium(
      prediction({ p1Driver: "VER", p2Driver: "HAM", p3Driver: "RUS" }),
      baseResult(),
    );
    expect(score.points).toBe(1);
    expect(score.correct).toBe(false);
  });

  it("awards 0 when no predicted driver reached the podium", () => {
    const score = scorePodium(
      prediction({ p1Driver: "HAM", p2Driver: "RUS", p3Driver: "PIA" }),
      baseResult(),
    );
    expect(score.points).toBe(0);
    expect(score.correct).toBe(false);
  });

  it("matches on full driver name as well as code", () => {
    const score = scorePodium(
      prediction({
        p1Driver: "Max Verstappen",
        p2Driver: "Lando Norris",
        p3Driver: "Charles Leclerc",
      }),
      baseResult(),
    );
    expect(score.points).toBe(4);
  });

  it("is tolerant of casing and extra whitespace", () => {
    const score = scorePodium(
      prediction({ p1Driver: "  ver ", p2Driver: "nor", p3Driver: "LeC" }),
      baseResult(),
    );
    expect(score.points).toBe(4);
  });

  it("treats a partial podium as scoring only the provided picks", () => {
    // Only P1 filled in, and it is correct -> one correct driver = 1 point.
    const score = scorePodium(
      prediction({ p1Driver: "VER" }),
      baseResult(),
    );
    expect(score.points).toBe(1);
    expect(score.correct).toBe(false); // not a full exact-order podium
  });

  it("scores a missing prediction as 0 with full max", () => {
    const score = scorePodium(null, baseResult());
    expect(score.points).toBe(0);
    expect(score.max).toBe(PODIUM_MAX);
    expect(score.correct).toBe(false);
  });
});

// ── Fastest lap ───────────────────────────────────────────────────────────────

describe("scoreFastestLap", () => {
  it("awards a point for the correct driver", () => {
    const score = scoreFastestLap(
      prediction({ fastestLapDriver: "HAM" }),
      baseResult(),
    );
    expect(score.points).toBe(CATEGORY_POINTS.fastestLap);
    expect(score.correct).toBe(true);
  });

  it("awards nothing for the wrong driver", () => {
    const score = scoreFastestLap(
      prediction({ fastestLapDriver: "VER" }),
      baseResult(),
    );
    expect(score.points).toBe(0);
    expect(score.correct).toBe(false);
  });

  it("scores 0 when the prediction is missing", () => {
    const score = scoreFastestLap(null, baseResult());
    expect(score.points).toBe(0);
    expect(score.correct).toBe(false);
    expect(score.max).toBe(1);
  });

  it("scores 0 when the race has no recorded fastest-lap driver", () => {
    const score = scoreFastestLap(
      prediction({ fastestLapDriver: "HAM" }),
      baseResult({ fastestLapDriver: null }),
    );
    expect(score.points).toBe(0);
    expect(score.correct).toBe(false);
  });
});

// ── DNF count ─────────────────────────────────────────────────────────────────

describe("scoreDnfCount", () => {
  it("awards a point for the exact count", () => {
    const score = scoreDnfCount(prediction({ dnfCount: 3 }), baseResult());
    expect(score.points).toBe(1);
    expect(score.correct).toBe(true);
  });

  it("awards nothing for a wrong count", () => {
    const score = scoreDnfCount(prediction({ dnfCount: 2 }), baseResult());
    expect(score.points).toBe(0);
    expect(score.correct).toBe(false);
  });

  it("treats a predicted 0 that matches an actual 0 as correct", () => {
    const score = scoreDnfCount(
      prediction({ dnfCount: 0 }),
      baseResult({ dnfCount: 0 }),
    );
    expect(score.points).toBe(1);
    expect(score.correct).toBe(true);
  });

  it("scores 0 when the prediction is missing", () => {
    const score = scoreDnfCount(null, baseResult());
    expect(score.points).toBe(0);
    expect(score.correct).toBe(false);
  });
});

// ── Red flags ─────────────────────────────────────────────────────────────────

describe("scoreRedFlag", () => {
  it("awards a point for the exact count", () => {
    const score = scoreRedFlag(prediction({ redFlagCount: 1 }), baseResult());
    expect(score.points).toBe(1);
    expect(score.correct).toBe(true);
  });

  it("awards nothing for a wrong count", () => {
    const score = scoreRedFlag(prediction({ redFlagCount: 0 }), baseResult());
    expect(score.points).toBe(0);
    expect(score.correct).toBe(false);
  });

  it("is unscoreable (max 0) when red-flag data was not fetched", () => {
    const score = scoreRedFlag(
      prediction({ redFlagCount: 1 }),
      baseResult({ redFlagCount: null }),
    );
    expect(score.points).toBe(0);
    expect(score.max).toBe(0);
    expect(score.correct).toBeNull();
  });
});

// ── Whole-race scoring & missing predictions ─────────────────────────────────

describe("scoreRace", () => {
  it("sums all four categories with a perfect prediction", () => {
    const score = scoreRace(
      prediction({
        p1Driver: "VER",
        p2Driver: "NOR",
        p3Driver: "LEC",
        fastestLapDriver: "HAM",
        dnfCount: 3,
        redFlagCount: 1,
      }),
      baseResult(),
    );
    expect(score.points).toBe(7); // 4 + 1 + 1 + 1
    expect(score.maxPoints).toBe(7);
    expect(score.missing).toBe(false);
  });

  it("marks a null prediction as missing, scoring 0 against the full max", () => {
    const score = scoreRace(null, baseResult());
    expect(score.points).toBe(0);
    expect(score.maxPoints).toBe(7);
    expect(score.missing).toBe(true);
  });

  it("drops the red-flag category from the max when unscoreable", () => {
    const score = scoreRace(
      prediction({
        p1Driver: "VER",
        p2Driver: "NOR",
        p3Driver: "LEC",
        fastestLapDriver: "HAM",
        dnfCount: 3,
      }),
      baseResult({ redFlagCount: null }),
    );
    expect(score.points).toBe(6); // 4 + 1 + 1, red flag excluded
    expect(score.maxPoints).toBe(6); // 7 - 1
  });
});

// ── Season accuracy across a multi-race sample ───────────────────────────────

describe("scoreSeasonForPerson", () => {
  const races = [
    { raceId: "r1", result: baseResult({ round: 1 }) },
    { raceId: "r2", result: baseResult({ round: 2 }) },
    { raceId: "r3", result: baseResult({ round: 3 }) },
  ];

  it("aggregates points and computes a percentage against the max", () => {
    const predictions = {
      // r1: perfect -> 7
      r1: prediction({
        p1Driver: "VER",
        p2Driver: "NOR",
        p3Driver: "LEC",
        fastestLapDriver: "HAM",
        dnfCount: 3,
        redFlagCount: 1,
      }),
      // r2: podium two-correct (2) + dnf correct (1) = 3
      r2: prediction({
        p1Driver: "VER",
        p2Driver: "NOR",
        p3Driver: "HAM",
        dnfCount: 3,
      }),
      // r3: missing entirely -> 0
    };

    const season = scoreSeasonForPerson(predictions, races);
    expect(season.totalPoints).toBe(10); // 7 + 3 + 0
    expect(season.maxPoints).toBe(21); // 7 * 3
    expect(season.accuracyPct).toBeCloseTo(47.6, 1); // 10/21 * 100
    expect(season.raceScores).toHaveLength(3);
    expect(season.raceScores[2].score.missing).toBe(true);
  });

  it("treats an omitted race id as a missing prediction", () => {
    const season = scoreSeasonForPerson({}, races);
    expect(season.totalPoints).toBe(0);
    expect(season.maxPoints).toBe(21);
    expect(season.accuracyPct).toBe(0);
  });

  it("returns 0% when there are no races scored yet", () => {
    const season = scoreSeasonForPerson({}, []);
    expect(season.totalPoints).toBe(0);
    expect(season.maxPoints).toBe(0);
    expect(season.accuracyPct).toBe(0);
  });

  it("excludes unscoreable red-flag races from the denominator", () => {
    const noRedFlagRaces = [
      { raceId: "r1", result: baseResult({ redFlagCount: null }) },
    ];
    const season = scoreSeasonForPerson(
      {
        r1: prediction({
          p1Driver: "VER",
          p2Driver: "NOR",
          p3Driver: "LEC",
          fastestLapDriver: "HAM",
          dnfCount: 3,
        }),
      },
      noRedFlagRaces,
    );
    expect(season.totalPoints).toBe(6);
    expect(season.maxPoints).toBe(6);
    expect(season.accuracyPct).toBe(100);
  });
});

// ── Head-to-head ─────────────────────────────────────────────────────────────

describe("compareHeadToHead", () => {
  const races = [{ raceId: "r1", result: baseResult() }];

  function seasonFor(fields: Partial<PredictionFields>) {
    return scoreSeasonForPerson({ r1: prediction(fields) }, races);
  }

  it("names the higher-scoring person as leader", () => {
    const a = {
      userId: "me",
      score: seasonFor({ p1Driver: "VER", p2Driver: "NOR", p3Driver: "LEC" }), // 4
    };
    const b = {
      userId: "spouse",
      score: seasonFor({ dnfCount: 3 }), // 1
    };
    const h2h = compareHeadToHead(a, b);
    expect(h2h.leaderUserId).toBe("me");
    expect(h2h.pointsDifference).toBe(3);
    expect(h2h.a.points).toBe(4);
    expect(h2h.b.points).toBe(1);
  });

  it("reports a tie as a null leader", () => {
    const a = { userId: "me", score: seasonFor({ dnfCount: 3 }) };
    const b = { userId: "spouse", score: seasonFor({ redFlagCount: 1 }) };
    const h2h = compareHeadToHead(a, b);
    expect(h2h.leaderUserId).toBeNull();
    expect(h2h.pointsDifference).toBe(0);
  });
});
