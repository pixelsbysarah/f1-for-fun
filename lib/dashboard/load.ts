/**
 * Server-only data loader for the public dashboard.
 *
 * Reads races (public), every participant's predictions, and the account list
 * with the service-role client — the dashboard is public and read-only, but the
 * `predictions` RLS policy only exposes rows to authenticated users, so the
 * pre-scored public view is assembled server-side here. No secrets or other
 * users' account metadata ever reach the browser: only the derived view model
 * (`buildDashboard`) is serialized to the client.
 *
 * Never throws: any failure (missing env in CI/local, transient DB error) is
 * logged and yields an empty view so the page still renders its empty states.
 *
 * Server-only: it lazily imports the service-role client, whose key is a
 * non-`NEXT_PUBLIC_*` env var Next.js will not inline into a client bundle.
 */
import type { RaceResult, RaceClassificationEntry } from "@/lib/f1-adapter/types";
import type { PredictionFields } from "@/lib/scoring";

import { buildDashboard } from "./build";
import type {
  DashboardView,
  Participant,
  PredictionsByUser,
  RaceInput,
} from "./types";

const EMPTY_VIEW: DashboardView = {
  season: { people: [], leaderUserId: null },
  races: [],
};

/** Best-effort friendly name for an account, never leaking the raw email. */
function displayNameFor(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}): string {
  const meta = user.user_metadata ?? {};
  const candidate =
    (meta.display_name as string | undefined) ??
    (meta.full_name as string | undefined) ??
    (meta.name as string | undefined);
  if (candidate && candidate.trim() !== "") return candidate.trim();
  // Fall back to the email local-part (before the @), never the full address.
  const local = user.email?.split("@")[0];
  return local && local.trim() !== "" ? local : "Player";
}

/** Map a DB race row into the builder's `RaceInput`, composing its result. */
function toRaceInput(row: Record<string, unknown>): RaceInput {
  const completed = Boolean(row.is_completed) && row.result_classification != null;
  const result: RaceResult | null = completed
    ? {
        season: row.season as number,
        round: row.round as number,
        classification:
          (row.result_classification as RaceClassificationEntry[]) ?? [],
        fastestLapDriver: (row.fastest_lap_driver as string | null) ?? null,
        dnfCount: (row.result_dnf_count as number | null) ?? 0,
        redFlagCount: (row.red_flag_count as number | null) ?? null,
      }
    : null;

  return {
    id: row.id as string,
    season: row.season as number,
    round: row.round as number,
    name: row.name as string,
    raceDate: (row.race_date as string | null) ?? null,
    isCompleted: Boolean(row.is_completed),
    result,
  };
}

/** Build the public dashboard view model from Supabase, or an empty view. */
export async function loadDashboard(): Promise<DashboardView> {
  try {
    const { createServiceClient } = await import("@/lib/supabase/service");
    const supabase = createServiceClient();

    const [raceRes, predRes, usersRes] = await Promise.all([
      supabase.from("races").select("*"),
      supabase.from("predictions").select("*"),
      supabase.auth.admin.listUsers(),
    ]);

    if (raceRes.error) throw raceRes.error;
    if (predRes.error) throw predRes.error;
    if (usersRes.error) throw usersRes.error;

    const races: RaceInput[] = (raceRes.data ?? []).map(toRaceInput);

    // Stable column order: oldest account first.
    const participants: Participant[] = [...(usersRes.data.users ?? [])]
      .sort(
        (a, b) =>
          new Date(a.created_at ?? 0).getTime() -
          new Date(b.created_at ?? 0).getTime(),
      )
      .map((u) => ({ userId: u.id, displayName: displayNameFor(u) }));

    const predictions: PredictionsByUser = {};
    for (const p of predRes.data ?? []) {
      const fields: PredictionFields = {
        p1Driver: p.p1_driver,
        p2Driver: p.p2_driver,
        p3Driver: p.p3_driver,
        fastestLapDriver: p.fastest_lap_driver,
        dnfCount: p.dnf_count,
        redFlagCount: p.red_flag_count,
      };
      (predictions[p.user_id] ??= {})[p.race_id] = fields;
    }

    return buildDashboard({ races, participants, predictions });
  } catch (error) {
    console.error("Dashboard load skipped:", error);
    return EMPTY_VIEW;
  }
}
