/**
 * Single source of truth for editable design values.
 *
 * Per the project rules (CLAUDE.md #7), team colors, fonts, and similar
 * design tokens live here rather than being scattered inline across
 * components. Change a value here and it propagates everywhere.
 */

/**
 * Font stacks. The `variable` names are CSS custom properties injected by
 * `next/font` (see `lib/fonts.ts`) and consumed by Tailwind's `fontFamily`
 * config. Swapping a font is a two-step change: update the loader in
 * `lib/fonts.ts` and the fallback stack here.
 */
export const fonts = {
  heading: {
    variable: "--font-heading",
    fallback: ["Merriweather", "Georgia", "Cambria", "Times New Roman", "serif"],
  },
  body: {
    variable: "--font-body",
    fallback: ["Lato", "Helvetica Neue", "Arial", "sans-serif"],
  },
} as const;

/**
 * Core theme colors used by the layout shell. Kept minimal for the scaffold;
 * extended as later tickets add UI. Values are also mirrored into the DaisyUI
 * theme in `tailwind.config.ts`.
 */
export const colors = {
  /** Near-black charcoal base for the asphalt background. */
  asphalt: "#14161a",
  asphaltHighlight: "#1d2026",
  /** Default off-white body text. */
  offWhite: "#ece9e2",
  /** Racing red used for the gutter track-limit line and accents. */
  racingRed: "#e10600",
  /** Green used for the CSS-drawn "correct prediction" checkmark. */
  correctGreen: "#2ecc71",
} as const;

/**
 * Team colors applied to a driver's name/text when selected. Used by later
 * tickets (predictions/dashboard); defined here now so there is one editable
 * home for them. Keys are constructor slugs.
 */
export const teamColors: Record<string, { primary: string; onPrimary: string }> = {
  mclaren: { primary: "#ff8000", onPrimary: "#000000" },
  ferrari: { primary: "#e8002d", onPrimary: "#ffffff" },
  redbull: { primary: "#3671c6", onPrimary: "#ffffff" },
  mercedes: { primary: "#27f4d2", onPrimary: "#000000" },
  astonmartin: { primary: "#229971", onPrimary: "#ffffff" },
  alpine: { primary: "#0093cc", onPrimary: "#ffffff" },
  williams: { primary: "#64c4ff", onPrimary: "#000000" },
  haas: { primary: "#b6babd", onPrimary: "#000000" },
  rb: { primary: "#6692ff", onPrimary: "#000000" },
  sauber: { primary: "#52e252", onPrimary: "#000000" },
} as const;
