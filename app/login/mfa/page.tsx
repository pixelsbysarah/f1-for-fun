import { redirect } from "next/navigation";

import { readSessionState } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

import { MfaChallengeForm } from "./MfaChallengeForm";

/**
 * MFA challenge step. Reached after a password sign-in when the user already
 * has a verified TOTP factor but this session is still `aal1`. Verifying a code
 * here upgrades the session to `aal2`, which is what RLS requires for writes.
 */
export const dynamic = "force-dynamic";

export default async function MfaChallengePage() {
  const supabase = await createClient();
  const state = await readSessionState(supabase);

  if (!state.hasUser) redirect("/login");
  if (!state.hasVerifiedFactor) redirect("/onboarding");
  if (state.currentLevel === "aal2") redirect("/portal");

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <h1 className="font-heading text-2xl font-black text-off-white">
        Two-factor verification
      </h1>
      <p className="mt-2 text-sm text-off-white/70">
        Enter the 6-digit code from your authenticator app to finish signing in.
      </p>
      <MfaChallengeForm />
    </main>
  );
}
