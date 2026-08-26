/**
 * Pure auth-state routing logic, shared by the auth pages and the portal.
 *
 * The onboarding requirements (build-spec "Account Setup & Access Control")
 * form a strict sequence a user must complete before they can write
 * predictions:
 *
 *   1. Be signed in.
 *   2. Set a permanent password (temporary passwords issued in the Supabase
 *      dashboard must be replaced on first login).
 *   3. Enroll a TOTP MFA factor.
 *   4. Pass an MFA challenge this session (session assurance level `aal2`).
 *
 * This function maps the current state to the single page the user belongs on.
 * It is kept free of any Supabase/Next dependency so it can be unit tested
 * exhaustively — the gating that actually protects data is RLS, but this keeps
 * the UX honest and never sends a half-onboarded user to the portal.
 *
 * NOTE: `passwordSet` is a UX signal stored in user metadata, not a security
 * boundary (users can edit their own metadata). Write access is still gated by
 * `aal2` at the RLS layer regardless of what this returns.
 */

export type AssuranceLevel = "aal1" | "aal2";

export type AuthState = {
  /** Whether there is an authenticated user at all. */
  hasUser: boolean;
  /** Whether the user has replaced their temporary password. */
  passwordSet: boolean;
  /** Whether the user has at least one verified TOTP factor enrolled. */
  hasVerifiedFactor: boolean;
  /** Current session assurance level, or null when signed out. */
  currentLevel: AssuranceLevel | null;
};

export type AuthDestination =
  | "/login"
  | "/login/mfa"
  | "/onboarding"
  | "/portal";

export function resolveAuthDestination(state: AuthState): AuthDestination {
  if (!state.hasUser) {
    return "/login";
  }

  // First login: force a permanent password, then TOTP enrollment, before any
  // write access is possible.
  if (!state.passwordSet || !state.hasVerifiedFactor) {
    return "/onboarding";
  }

  // Enrolled but this session hasn't cleared an MFA challenge yet.
  if (state.currentLevel !== "aal2") {
    return "/login/mfa";
  }

  return "/portal";
}

/**
 * Convenience predicate: is the user fully authenticated and MFA-verified,
 * i.e. allowed to reach the portal and (per RLS) write predictions?
 */
export function isFullyAuthenticated(state: AuthState): boolean {
  return resolveAuthDestination(state) === "/portal";
}
