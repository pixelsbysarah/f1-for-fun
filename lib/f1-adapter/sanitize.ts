/**
 * Sanitization primitives for untrusted external F1 API data (CLAUDE.md #5).
 *
 * Everything pulled from the F1 source is untrusted: it must be shape-checked,
 * type-coerced, and stripped of anything that could carry markup before it is
 * stored or rendered. These helpers are deliberately small and pure so the
 * translation layer can lean on them and so they are easy to unit test.
 */

/** C0/C1 control characters — never legitimate in a driver name or status. */
const CONTROL_CHARS = new RegExp("[\\u0000-\\u001F\\u007F-\\u009F]", "g");
/** Angle brackets, stripped so a value can never smuggle in markup when rendered. */
const MARKUP_CHARS = /[<>]/g;

/**
 * Coerce an unknown external value to a safe, trimmed, length-capped string.
 *
 * Returns `null` for anything that isn't a string/number, or that is empty
 * after cleaning — callers treat `null` as "missing" and handle it explicitly
 * rather than storing a junk value.
 */
export function sanitizeText(raw: unknown, maxLength = 80): string | null {
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  if (typeof raw === "number" && !Number.isFinite(raw)) return null;

  const cleaned = String(raw)
    .replace(CONTROL_CHARS, "")
    .replace(MARKUP_CHARS, "")
    .trim();

  if (cleaned === "") return null;
  return cleaned.slice(0, maxLength);
}

/**
 * Coerce an unknown external value to a non-negative integer.
 *
 * Ergast/Jolpica sends numbers as strings ("1", "18"), so both strings and
 * numbers are accepted. Anything non-integer, negative, unparseable, or
 * outside the safe-integer range becomes `null`.
 */
export function toNonNegativeInt(raw: unknown): number | null {
  if (typeof raw === "number") {
    return Number.isInteger(raw) && raw >= 0 ? raw : null;
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!/^\d+$/.test(trimmed)) return null;
    const num = Number.parseInt(trimmed, 10);
    return Number.isSafeInteger(num) ? num : null;
  }
  return null;
}
