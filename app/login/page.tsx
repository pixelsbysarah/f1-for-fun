import { redirect } from "next/navigation";

import { resolveAuthDestination } from "@/lib/auth/next-step";
import { readSessionState } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

import { LoginForm } from "./LoginForm";

/**
 * Login page — the ONLY authentication entry point. There is deliberately no
 * signup route anywhere in the app (CLAUDE.md #2): accounts are created
 * manually in the Supabase dashboard.
 *
 * If someone already has a session, forward them to wherever they belong in
 * the onboarding/MFA sequence rather than showing the form again.
 */
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const supabase = await createClient();
  const state = await readSessionState(supabase);

  if (state.hasUser) {
    redirect(resolveAuthDestination(state));
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <h1 className="font-heading text-2xl font-black text-off-white">
        Sign in
      </h1>
      <p className="mt-2 text-sm text-off-white/70">
        Prediction access is invite-only. Accounts are created manually — there
        is no public sign-up.
      </p>
      <LoginForm />
    </main>
  );
}
