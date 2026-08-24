import { redirect } from "next/navigation";

import { resolveAuthDestination } from "@/lib/auth/next-step";
import { readSessionState } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/**
 * Central auth-routing hub. Each auth step (login, MFA challenge, onboarding)
 * sends the user here when it finishes; this reads the live session state and
 * forwards them to the single page they now belong on. Keeping the decision in
 * one server-rendered place avoids duplicating the sequencing logic across
 * client components.
 */
export const dynamic = "force-dynamic";

export default async function AuthNextPage() {
  const supabase = await createClient();
  const state = await readSessionState(supabase);
  redirect(resolveAuthDestination(state));
}
