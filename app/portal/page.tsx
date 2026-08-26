import { redirect } from "next/navigation";

import { resolveAuthDestination } from "@/lib/auth/next-step";
import { readSessionState } from "@/lib/auth/session";
import type { PredictionFields, Race } from "@/lib/predictions/types";
import { createClient } from "@/lib/supabase/server";

import { PredictionForm } from "./PredictionForm";
import { signOut } from "./actions";

/**
 * Authenticated predictions portal.
 *
 * Not publicly accessible: unauthenticated visitors are bounced by the
 * middleware, and any user who hasn't completed onboarding/MFA is redirected to
 * the right step here (the session must resolve to `/portal`, i.e. be `aal2`).
 * Lists upcoming races with a per-race form to enter/edit predictions.
 */
export const dynamic = "force-dynamic";

export default async function PortalPage() {
  const supabase = await createClient();
  const state = await readSessionState(supabase);

  const destination = resolveAuthDestination(state);
  if (destination !== "/portal" || !state.user) {
    redirect(destination);
  }

  // Upcoming races only (soonest first). Completed races are for the dashboard.
  const { data: raceRows } = await supabase
    .from("races")
    .select("*")
    .eq("is_completed", false)
    .order("season", { ascending: true })
    .order("round", { ascending: true });

  // This user's existing predictions, to pre-fill the forms.
  const { data: predictionRows } = await supabase
    .from("predictions")
    .select("*")
    .eq("user_id", state.user.id);

  const races: Race[] = (raceRows ?? []).map((r) => ({
    id: r.id,
    season: r.season,
    round: r.round,
    name: r.name,
    circuit: r.circuit,
    raceDate: r.race_date,
    isCompleted: r.is_completed,
  }));

  const predictionByRace = new Map<string, PredictionFields>();
  for (const p of predictionRows ?? []) {
    predictionByRace.set(p.race_id, {
      p1Driver: p.p1_driver,
      p2Driver: p.p2_driver,
      p3Driver: p.p3_driver,
      fastestLapDriver: p.fastest_lap_driver,
      dnfCount: p.dnf_count,
      redFlagCount: p.red_flag_count,
    });
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-black text-off-white">
            Your predictions
          </h1>
          <p className="mt-1 text-sm text-off-white/60">
            Signed in as {state.user.email}
          </p>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="rounded border border-off-white/20 px-3 py-1.5 text-sm text-off-white/80 hover:border-racing-red"
          >
            Sign out
          </button>
        </form>
      </header>

      {races.length === 0 ? (
        <p className="mt-10 text-off-white/70">
          No upcoming races yet. Once the race calendar is loaded, they&apos;ll
          appear here.
        </p>
      ) : (
        <ul className="mt-10 flex flex-col gap-8">
          {races.map((race) => (
            <li key={race.id}>
              <PredictionForm
                race={race}
                initial={predictionByRace.get(race.id) ?? null}
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
