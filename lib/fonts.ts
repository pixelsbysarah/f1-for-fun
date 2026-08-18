/**
 * Font loaders. Isolated here so swapping a Google Font is a single-file
 * change: swap the `next/font/google` import + loader below and update the
 * matching fallback stack in `lib/config/design-tokens.ts`.
 *
 * `next/font` self-hosts the fonts at build time (no runtime request to
 * Google) and exposes each as a CSS variable that Tailwind reads.
 */
import { Lato, Merriweather } from "next/font/google";

import { fonts } from "@/lib/config/design-tokens";

export const headingFont = Merriweather({
  subsets: ["latin"],
  weight: ["300", "400", "700", "900"],
  display: "swap",
  variable: fonts.heading.variable,
});

export const bodyFont = Lato({
  subsets: ["latin"],
  weight: ["300", "400", "700"],
  display: "swap",
  variable: fonts.body.variable,
});

/** Combined class string applied to <html> so both variables are available. */
export const fontVariables = `${headingFont.variable} ${bodyFont.variable}`;
