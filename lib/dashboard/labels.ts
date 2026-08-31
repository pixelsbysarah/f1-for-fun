import type { CategoryKey } from "./types";

/** Human labels for each scored category, in dashboard display order. */
export const CATEGORY_LABELS: ReadonlyArray<{
  key: CategoryKey;
  label: string;
}> = [
  { key: "p1", label: "P1" },
  { key: "p2", label: "P2" },
  { key: "p3", label: "P3" },
  { key: "fastestLap", label: "Fastest lap" },
  { key: "dnfCount", label: "DNFs" },
  { key: "redFlag", label: "Red flags" },
];
