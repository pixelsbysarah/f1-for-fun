import { describe, expect, it } from "vitest";

import { teamColors } from "@/lib/config/design-tokens";
import type { RaceResult } from "@/lib/scoring";

import { buildDashboard, resolveTeamColor } from "./build";
import type { DashboardInput, RaceInput } from "./types";

/** A completed-race result with a known podium/fastest-lap/dnf/red-flag. */
function makeResult(overrides: Partial<RaceResult> = {}): RaceResult {
  return {
    season: 2026,
    round: 1,
    classification: [
      {
        position: 1,
        driverCode: "VER",
        driverName: "Max Verstappen",
        constructorName: "Red Bull Racing",
        status: "Finished",
        finished: true,
      },
      {
        position: 2,
        driverCode: "NOR",
        driverName: "Lando Norris",
        constructorName: "McLaren",
        status: "Finished",
        finished: true,
      },
      {
        position: 3,
        driverCode: "LEC",
        driverName: "Charles Leclerc",
        constructorName: "Ferrari",
        status: "Finished",
        finished: true,
      },
    ],
    fastestLapDriver: "VER",
    dnfCount: 2,
    redFlagCount: 1,
    ...overrides,
  };
}

function completedRace(id: string, round: number): RaceInput {
  return {
    id,
    season: 2026,
    round,
    name: `Race ${round}`,
    raceDate: `2026-0${round}-01T13:00:00Z`,
    isCompleted: true,
    result: makeResult({ round }),
  };
}

const PARTICIPANTS = [
  { userId: "a", displayName: "Alex" },
  { userId: "b", displayName: "Sam" },
];

describe("resolveTeamColor", () => {
  it("maps a constructor name to its configured team color", () => {
    expect(resolveTeamColor("Red Bull Racing")).toBe(teamColors.redbull.primary);
    expect(resolveTeamColor("McLaren")).toBe(teamColors.mclaren.primary);
    expect(resolveTeamColor("Scuderia Ferrari")).toBe(teamColors.ferrari.primary);
  });

  it("returns null for an unknown or empty name", () => {
    expect(resolveTeamColor("Unknown Team")).toBeNull();
    expect(resolveTeamColor(null)).toBeNull();
    expect(resolveTeamColor("")).toBeNull();
  });
});

describe("buildDashboard ordering", () => {
  it("orders races most-recent first (season then round, descending)", () => {
    const input: DashboardInput = {
      races: [
        completedRace("r1", 1),
        completedRace("r3", 3),
        completedRace("r2", 2),
        { ...completedRace("r-prev", 5), season: 2025 },
      ],
      participants: PARTICIPANTS,
      predictions: {},
    };

    const rounds = buildDashboard(input).races.map((r) => `${r.season}-${r.round}`);
    expect(rounds).toEqual(["2026-3", "2026-2", "2026-1", "2025-5"]);
  });

  it("includes upcoming races only when someone predicted them", () => {
    const upcomingPredicted: RaceInput = {
      id: "up1",
      season: 2026,
      round: 10,
      name: "Upcoming Predicted",
      raceDate: "2026-10-01T13:00:00Z",
      isCompleted: false,
      result: null,
    };
    const upcomingEmpty: RaceInput = { ...upcomingPredicted, id: "up2", round: 11 };

    const input: DashboardInput = {
      races: [upcomingPredicted, upcomingEmpty],
      participants: PARTICIPANTS,
      predictions: {
        a: {
          up1: {
            p1Driver: "VER",
            p2Driver: null,
            p3Driver: null,
            fastestLapDriver: null,
            dnfCount: null,
            redFlagCount: null,
          },
        },
      },
    };

    const ids = buildDashboard(input).races.map((r) => r.raceId);
    expect(ids).toEqual(["up1"]);
  });
});

describe("buildDashboard field styling", () => {
  const input: DashboardInput = {
    races: [completedRace("r1", 1)],
    participants: PARTICIPANTS,
    predictions: {
      a: {
        r1: {
          p1Driver: "VER", // correct (finished P1)
          p2Driver: "LEC", // wrong (actual P2 is NOR)
          p3Driver: "NOR", // wrong (actual P3 is LEC)
          fastestLapDriver: "VER", // correct
          dnfCount: 2, // correct
          redFlagCount: 0, // wrong (actual 1)
        },
      },
      // user b has no prediction row → all missing
    },
  };

  const race = buildDashboard(input).races[0];
  const alex = race.people.find((p) => p.userId === "a")!;
  const sam = race.people.find((p) => p.userId === "b")!;

  it("marks an exact-position driver pick correct with its team color", () => {
    expect(alex.fields.p1.state).toBe("correct");
    expect(alex.fields.p1.teamColor).toBe(teamColors.redbull.primary);
  });

  it("marks a wrong driver pick incorrect with no team color", () => {
    expect(alex.fields.p2.state).toBe("incorrect");
    expect(alex.fields.p2.teamColor).toBeNull();
  });

  it("scores fastest lap and dnf count correct, red flags incorrect", () => {
    expect(alex.fields.fastestLap.state).toBe("correct");
    expect(alex.fields.fastestLap.teamColor).toBe(teamColors.redbull.primary);
    expect(alex.fields.dnfCount.state).toBe("correct");
    expect(alex.fields.redFlag.state).toBe("incorrect");
  });

  it("renders a person with no prediction as all-missing dashes", () => {
    for (const key of ["p1", "p2", "p3", "fastestLap", "dnfCount", "redFlag"] as const) {
      expect(sam.fields[key].state).toBe("missing");
      expect(sam.fields[key].value).toBe("-");
    }
  });

  it("exposes the actual outcome for a completed race", () => {
    expect(race.actual).not.toBeNull();
    expect(race.actual!.p1.value).toBe("VER");
    expect(race.actual!.p1.teamColor).toBe(teamColors.redbull.primary);
    expect(race.actual!.dnfCount.value).toBe("2");
    expect(race.actual!.redFlag.value).toBe("1");
  });

  it("leaves upcoming predictions in a neutral pending state", () => {
    const upcoming: DashboardInput = {
      races: [
        {
          id: "u1",
          season: 2026,
          round: 20,
          name: "Upcoming",
          raceDate: null,
          isCompleted: false,
          result: null,
        },
      ],
      participants: PARTICIPANTS,
      predictions: {
        a: {
          u1: {
            p1Driver: "HAM",
            p2Driver: null,
            p3Driver: null,
            fastestLapDriver: null,
            dnfCount: 3,
            redFlagCount: null,
          },
        },
      },
    };
    const person = buildDashboard(upcoming).races[0].people.find(
      (p) => p.userId === "a",
    )!;
    expect(person.fields.p1.state).toBe("pending");
    expect(person.fields.p1.value).toBe("HAM");
    expect(person.fields.dnfCount.state).toBe("pending");
    expect(person.score).toBeNull();
  });

  it("treats unavailable red-flag data as pending, not incorrect", () => {
    const noRedFlag: DashboardInput = {
      races: [
        {
          ...completedRace("r1", 1),
          result: makeResult({ redFlagCount: null }),
        },
      ],
      participants: PARTICIPANTS,
      predictions: {
        a: {
          r1: {
            p1Driver: null,
            p2Driver: null,
            p3Driver: null,
            fastestLapDriver: null,
            dnfCount: null,
            redFlagCount: 2,
          },
        },
      },
    };
    const person = buildDashboard(noRedFlag).races[0].people.find(
      (p) => p.userId === "a",
    )!;
    expect(person.fields.redFlag.state).toBe("pending");
  });
});

describe("buildDashboard season summary", () => {
  it("aggregates completed-race scores and names the leader", () => {
    const input: DashboardInput = {
      races: [completedRace("r1", 1)],
      participants: PARTICIPANTS,
      predictions: {
        a: {
          r1: {
            p1Driver: "VER",
            p2Driver: "NOR",
            p3Driver: "LEC",
            fastestLapDriver: "VER",
            dnfCount: 2,
            redFlagCount: 1,
          }, // perfect: 7/7
        },
        b: {
          r1: {
            p1Driver: "VER",
            p2Driver: null,
            p3Driver: null,
            fastestLapDriver: null,
            dnfCount: null,
            redFlagCount: null,
          }, // one podium driver: 1/7
        },
      },
    };

    const { season } = buildDashboard(input);
    const alex = season.people.find((p) => p.userId === "a")!;
    const sam = season.people.find((p) => p.userId === "b")!;
    expect(alex.totalPoints).toBe(7);
    expect(alex.maxPoints).toBe(7);
    expect(alex.accuracyPct).toBe(100);
    expect(sam.totalPoints).toBe(1);
    expect(season.leaderUserId).toBe("a");
  });

  it("returns no leader when nobody has scored yet", () => {
    const input: DashboardInput = {
      races: [completedRace("r1", 1)],
      participants: PARTICIPANTS,
      predictions: {},
    };
    expect(buildDashboard(input).season.leaderUserId).toBeNull();
  });
});
