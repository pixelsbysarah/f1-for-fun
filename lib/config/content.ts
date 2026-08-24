/**
 * Editable site copy and external links. Centralized so wording and URLs can
 * be tweaked without hunting through components.
 */
export const site = {
  appName: "For Fun: An F1 Personal Prediction Tracker",
  subheading: "a non-serious prediction tracker",
  heroBody:
    "I casually watch F1. My spouse has followed and watched for years. Let's see how we do with predicting the remaining races of the 2026 season of Formula 1!",
} as const;

export const links = {
  /** Real URLs can be finalized later; placeholders anticipate them. */
  github: "https://github.com/pixelsbysarah/f1-for-fun",
  portfolio: "https://www.pixelsbysarah.com",
} as const;

/** Data-source attribution shown in the footer (per Jolpica/Ergast terms). */
export const dataSourceCredit = "Data via Jolpica F1 (Ergast-compatible API)";
