import { describe, expect, it } from "vitest";

import {
  MAX_DNF_COUNT,
  MAX_DRIVER_NAME_LENGTH,
  MAX_RED_FLAG_COUNT,
  validatePrediction,
} from "./validation";

describe("validatePrediction", () => {
  it("accepts and normalizes a complete prediction", () => {
    const result = validatePrediction({
      p1Driver: "  Verstappen ",
      p2Driver: "Norris",
      p3Driver: "Leclerc",
      fastestLapDriver: "Hamilton",
      dnfCount: "3",
      redFlagCount: 1,
    });

    expect(result).toEqual({
      ok: true,
      value: {
        p1Driver: "Verstappen",
        p2Driver: "Norris",
        p3Driver: "Leclerc",
        fastestLapDriver: "Hamilton",
        dnfCount: 3,
        redFlagCount: 1,
      },
    });
  });

  it("treats blank and missing fields as null (partial prediction)", () => {
    const result = validatePrediction({
      p1Driver: "Piastri",
      p2Driver: "   ",
      dnfCount: "",
    });

    expect(result).toEqual({
      ok: true,
      value: {
        p1Driver: "Piastri",
        p2Driver: null,
        p3Driver: null,
        fastestLapDriver: null,
        dnfCount: null,
        redFlagCount: null,
      },
    });
  });

  it("rejects duplicate podium drivers (case-insensitively)", () => {
    const result = validatePrediction({
      p1Driver: "Norris",
      p2Driver: "norris",
      p3Driver: "Leclerc",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.podium).toBeDefined();
  });

  it("allows duplicate values across non-podium fields", () => {
    // Fastest-lap driver may match a podium pick; only P1/P2/P3 must differ.
    const result = validatePrediction({
      p1Driver: "Norris",
      p2Driver: "Leclerc",
      p3Driver: "Piastri",
      fastestLapDriver: "Norris",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects driver names with unsafe characters", () => {
    const result = validatePrediction({
      p1Driver: "<script>alert(1)</script>",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.p1Driver).toBeDefined();
  });

  it("rejects driver names that are too long", () => {
    const result = validatePrediction({
      p1Driver: "a".repeat(MAX_DRIVER_NAME_LENGTH + 1),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.p1Driver).toBeDefined();
  });

  it("rejects a non-integer DNF count", () => {
    const result = validatePrediction({ dnfCount: "2.5" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.dnfCount).toBeDefined();
  });

  it("rejects out-of-range counts", () => {
    const tooManyDnf = validatePrediction({ dnfCount: MAX_DNF_COUNT + 1 });
    const negativeRedFlags = validatePrediction({ redFlagCount: -1 });
    const tooManyRedFlags = validatePrediction({
      redFlagCount: MAX_RED_FLAG_COUNT + 1,
    });

    expect(tooManyDnf.ok).toBe(false);
    expect(negativeRedFlags.ok).toBe(false);
    expect(tooManyRedFlags.ok).toBe(false);
  });

  it("accepts the boundary count values", () => {
    const result = validatePrediction({
      dnfCount: 0,
      redFlagCount: MAX_RED_FLAG_COUNT,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.dnfCount).toBe(0);
      expect(result.value.redFlagCount).toBe(MAX_RED_FLAG_COUNT);
    }
  });
});
