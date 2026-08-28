import { describe, expect, it } from "vitest";

import { sanitizeText, toNonNegativeInt } from "./sanitize";

describe("sanitizeText", () => {
  it("trims surrounding whitespace", () => {
    expect(sanitizeText("  Max Verstappen  ")).toBe("Max Verstappen");
  });

  it("coerces numbers to strings", () => {
    expect(sanitizeText(1)).toBe("1");
  });

  it("strips angle brackets so values can't smuggle in markup", () => {
    expect(sanitizeText("<script>alert(1)</script>VER")).toBe(
      "scriptalert(1)/scriptVER",
    );
  });

  it("strips control characters", () => {
    const withControls =
      "VE" + String.fromCharCode(0) + "R" + String.fromCharCode(9);
    expect(sanitizeText(withControls)).toBe("VER");
  });

  it("caps length at the provided maximum", () => {
    expect(sanitizeText("abcdefghij", 4)).toBe("abcd");
  });

  it("returns null for empty or whitespace-only input", () => {
    expect(sanitizeText("")).toBeNull();
    expect(sanitizeText("   ")).toBeNull();
  });

  it("returns null once markup/control stripping leaves nothing", () => {
    expect(sanitizeText("<>")).toBeNull();
  });

  it("returns null for non-string, non-number types", () => {
    expect(sanitizeText(null)).toBeNull();
    expect(sanitizeText(undefined)).toBeNull();
    expect(sanitizeText({})).toBeNull();
    expect(sanitizeText(["VER"])).toBeNull();
    expect(sanitizeText(true)).toBeNull();
  });

  it("returns null for non-finite numbers", () => {
    expect(sanitizeText(Number.NaN)).toBeNull();
    expect(sanitizeText(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe("toNonNegativeInt", () => {
  it("parses numeric strings as Ergast sends them", () => {
    expect(toNonNegativeInt("1")).toBe(1);
    expect(toNonNegativeInt("18")).toBe(18);
  });

  it("accepts non-negative integer numbers", () => {
    expect(toNonNegativeInt(0)).toBe(0);
    expect(toNonNegativeInt(22)).toBe(22);
  });

  it("rejects negatives, decimals, and non-numeric strings", () => {
    expect(toNonNegativeInt("-1")).toBeNull();
    expect(toNonNegativeInt(-1)).toBeNull();
    expect(toNonNegativeInt("3.5")).toBeNull();
    expect(toNonNegativeInt(3.5)).toBeNull();
    expect(toNonNegativeInt("R")).toBeNull();
    expect(toNonNegativeInt("12abc")).toBeNull();
  });

  it("rejects values beyond the safe-integer range", () => {
    expect(toNonNegativeInt("999999999999999999999")).toBeNull();
  });

  it("returns null for non-string, non-number types", () => {
    expect(toNonNegativeInt(null)).toBeNull();
    expect(toNonNegativeInt(undefined)).toBeNull();
    expect(toNonNegativeInt({})).toBeNull();
  });
});
