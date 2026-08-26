"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { validatePrediction, type PredictionInput } from "@/lib/predictions/validation";
import { createClient } from "@/lib/supabase/server";

export type SaveResult =
  | { ok: true }
  | { ok: false; errors: Record<string, string> }
  | { ok: false; message: string };

/**
 * Saves (inserts or updates) the current user's prediction for a race.
 *
 * Runs entirely server-side so the input is re-validated here before it ever
 * reaches the database (never trust the client, even our own form). The write
 * itself is still governed by RLS: the upsert only succeeds when the session is
 * MFA-verified (`aal2`) and `user_id` matches `auth.uid()`. `user_id` is set
 * from the server-read session, not from client input, so it can't be spoofed.
 */
export async function savePrediction(
  raceId: string,
  input: PredictionInput,
): Promise<SaveResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "You must be signed in to save." };
  }

  const result = validatePrediction(input);
  if (!result.ok) {
    return { ok: false, errors: result.errors };
  }

  const v = result.value;
  const { error } = await supabase.from("predictions").upsert(
    {
      user_id: user.id,
      race_id: raceId,
      p1_driver: v.p1Driver,
      p2_driver: v.p2Driver,
      p3_driver: v.p3Driver,
      fastest_lap_driver: v.fastestLapDriver,
      dnf_count: v.dnfCount,
      red_flag_count: v.redFlagCount,
    },
    { onConflict: "user_id,race_id" },
  );

  if (error) {
    // Most likely an RLS denial — e.g. the session dropped below aal2.
    return {
      ok: false,
      message:
        "Could not save your prediction. Make sure you're still signed in and MFA-verified.",
    };
  }

  revalidatePath("/portal");
  return { ok: true };
}

/** Signs the user out and returns them to the login page. */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
