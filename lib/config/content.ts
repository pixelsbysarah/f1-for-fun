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

/** Data-source attribution shown in the footer (per OpenF1's CC BY-NC-SA terms). */
export const dataSourceCredit = "Data via OpenF1 (openf1.org), CC BY-NC-SA 4.0";

/**
 * Non-affiliation / non-commercial disclaimer required by OpenF1's
 * CC BY-NC-SA 4.0 license. Shown in the footer alongside the credit.
 */
export const dataSourceDisclaimer =
  "This is an unofficial, non-commercial project, not associated with or endorsed by Formula 1, OpenF1, or their licensors.";
