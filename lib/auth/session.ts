import type { SupabaseClient, User } from "@supabase/supabase-js";

import type { AuthState } from "./next-step";

/**
 * User-metadata flag set when a user replaces their temporary password during
 * onboarding. Not a security boundary (user-editable) — a UX gate only. See
 * `resolveAuthDestination`.
 */
export const PASSWORD_SET_FLAG = "password_set";

export type SessionState = AuthState & {
  user: User | null;
};

/**
 * Reads the live auth state for the current request from a Supabase client.
 *
 * Combines three server-authoritative signals:
 *  - `getUser()` — is anyone signed in, and their metadata.
 *  - `getAuthenticatorAssuranceLevel()` — is this session `aal2` (MFA passed).
 *  - `listFactors()` — does the user have a verified TOTP factor enrolled.
 *
 * The shape it returns feeds `resolveAuthDestination` to decide where the user
 * belongs. Kept separate from that pure function so the routing logic stays
 * trivially testable.
 */
export async function readSessionState(
  supabase: SupabaseClient,
): Promise<SessionState> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      user: null,
      hasUser: false,
      passwordSet: false,
      hasVerifiedFactor: false,
      currentLevel: null,
    };
  }

  const { data: aal } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const { data: factors } = await supabase.auth.mfa.listFactors();

  const hasVerifiedFactor = (factors?.totp?.length ?? 0) > 0;
  const passwordSet = user.user_metadata?.[PASSWORD_SET_FLAG] === true;
  const currentLevel = aal?.currentLevel === "aal2" ? "aal2" : "aal1";

  return {
    user,
    hasUser: true,
    passwordSet,
    hasVerifiedFactor,
    currentLevel,
  };
}
