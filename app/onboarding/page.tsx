import { redirect } from "next/navigation";

import { readSessionState } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

import { OnboardingFlow } from "./OnboardingFlow";

/**
 * First-login onboarding. Before a user can reach the portal (and, per RLS,
 * write predictions) they must:
 *   1. Replace the temporary password issued in the Supabase dashboard.
 *   2. Enroll a TOTP MFA factor.
 *
 * This page renders whichever steps are still outstanding and hands off to
 * `/auth/next` when both are complete.
 */
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const state = await readSessionState(supabase);

  if (!state.hasUser) redirect("/login");
  if (state.passwordSet && state.hasVerifiedFactor) redirect("/auth/next");

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <h1 className="font-heading text-2xl font-black text-off-white">
        Finish setting up your account
      </h1>
      <p className="mt-2 text-sm text-off-white/70">
        A couple of one-time steps before you can make predictions.
      </p>
      <OnboardingFlow
        needsPassword={!state.passwordSet}
        needsEnrollment={!state.hasVerifiedFactor}
      />
    </main>
  );
}
