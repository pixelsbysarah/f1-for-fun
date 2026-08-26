import type { PredictionFields } from "./types";

/**
 * Validation + sanitization for prediction form input.
 *
 * User-submitted prediction data is untrusted and must be normalized before it
 * is stored or later rendered (CLAUDE.md #5 is written for the external F1 API,
 * but the same "never trust, always validate" stance applies to form input).
 * This runs client-side for UX and again server-side before the DB write, so
 * the DB never sees an unvalidated value.
 *
 * Rules:
 *  - Every field is optional; a blank field becomes `null` (a partial
 *    prediction scoring zero for that field).
 *  - Driver fields are trimmed, length-capped, and restricted to a safe
 *    character set (letters, digits, spaces, and `-'.`), stripping anything
 *    that could carry markup.
 *  - The three podium picks, when provided, must be distinct drivers.
 *  - DNF and red-flag counts must be whole numbers within sane race bounds.
 */

export const MAX_DRIVER_NAME_LENGTH = 40;
/** Full 2026 grid is 22 cars; allow the whole field to retire. */
export const MAX_DNF_COUNT = 22;
/** Generous upper bound; multiple red flags in one race is already extreme. */
export const MAX_RED_FLAG_COUNT = 10;

/** Letters (incl. accented), digits, spaces, hyphen, apostrophe, period. */
const DRIVER_NAME_PATTERN = /^[\p{L}\p{N} '.-]+$/u;

export type PredictionInput = {
  p1Driver?: unknown;
  p2Driver?: unknown;
  p3Driver?: unknown;
  fastestLapDriver?: unknown;
  dnfCount?: unknown;
  redFlagCount?: unknown;
};

export type ValidationResult =
  | { ok: true; value: PredictionFields }
  | { ok: false; errors: Record<string, string> };

function normalizeDriver(
  raw: unknown,
  field: string,
  errors: Record<string, string>,
): string | null {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim();
  if (text === "") return null;

  if (text.length > MAX_DRIVER_NAME_LENGTH) {
    errors[field] = `Must be ${MAX_DRIVER_NAME_LENGTH} characters or fewer.`;
    return null;
  }
  if (!DRIVER_NAME_PATTERN.test(text)) {
    errors[field] = "Use letters, numbers, spaces, or - ' . only.";
    return null;
  }
  return text;
}

function normalizeCount(
  raw: unknown,
  field: string,
  max: number,
  errors: Record<string, string>,
): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const num = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (!Number.isInteger(num)) {
    errors[field] = "Enter a whole number.";
    return null;
  }
  if (num < 0 || num > max) {
    errors[field] = `Enter a number between 0 and ${max}.`;
    return null;
  }
  return num;
}

export function validatePrediction(input: PredictionInput): ValidationResult {
  const errors: Record<string, string> = {};

  const p1Driver = normalizeDriver(input.p1Driver, "p1Driver", errors);
  const p2Driver = normalizeDriver(input.p2Driver, "p2Driver", errors);
  const p3Driver = normalizeDriver(input.p3Driver, "p3Driver", errors);
  const fastestLapDriver = normalizeDriver(
    input.fastestLapDriver,
    "fastestLapDriver",
    errors,
  );
  const dnfCount = normalizeCount(
    input.dnfCount,
    "dnfCount",
    MAX_DNF_COUNT,
    errors,
  );
  const redFlagCount = normalizeCount(
    input.redFlagCount,
    "redFlagCount",
    MAX_RED_FLAG_COUNT,
    errors,
  );

  // Podium picks that are present must reference three different drivers.
  const podium = [p1Driver, p2Driver, p3Driver].filter(
    (d): d is string => d !== null,
  );
  const distinct = new Set(podium.map((d) => d.toLowerCase()));
  if (distinct.size !== podium.length) {
    errors.podium = "P1, P2, and P3 must be three different drivers.";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      p1Driver,
      p2Driver,
      p3Driver,
      fastestLapDriver,
      dnfCount,
      redFlagCount,
    },
  };
}
