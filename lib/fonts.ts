/**
 * Font loaders. Isolated here so swapping a Google Font is a single-file
 * change: swap the `next/font/google` import + loader below and update the
 * matching fallback stack in `lib/config/design-tokens.ts`.
 *
 * `next/font` self-hosts the fonts at build time (no runtime request to
 * Google) and exposes each as a CSS variable that Tailwind reads.
 *
 * The `variable` names below MUST be written as literal strings — Next's font
 * loader rejects values referenced from an object ("Font loader values must be
 * explicitly written literals"). They intentionally mirror the CSS variable
 * names in `lib/config/design-tokens.ts` (`fonts.heading.variable` /
 * `fonts.body.variable`), which Tailwind consumes; keep the two in sync when
 * swapping a font.
 */
import { Lato, Merriweather } from "next/font/google";

export const headingFont = Merriweather({
  subsets: ["latin"],
  weight: ["300", "400", "700", "900"],
  display: "swap",
  variable: "--font-heading",
});

export const bodyFont = Lato({
  subsets: ["latin"],
  weight: ["300", "400", "700"],
  display: "swap",
  variable: "--font-body",
});

/** Combined class string applied to <html> so both variables are available. */
export const fontVariables = `${headingFont.variable} ${bodyFont.variable}`;
