import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { resolveAuthDestination } from "./next-step";
import { readSessionState } from "./session";

type FakeOptions = {
  user?: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null;
  currentLevel?: "aal1" | "aal2";
  totpFactors?: number;
};

/**
 * Minimal stand-in for the parts of the Supabase auth client that
 * `readSessionState` calls. This lets us exercise the exact auth-state logic
 * that gates the portal page without a live Supabase instance.
 */
function fakeClient({
  user = null,
  currentLevel = "aal1",
  totpFactors = 0,
}: FakeOptions): SupabaseClient {
  return {
    auth: {
      getUser: async () => ({ data: { user }, error: null }),
      mfa: {
        getAuthenticatorAssuranceLevel: async () => ({
          data: { currentLevel, nextLevel: currentLevel },
          error: null,
        }),
        listFactors: async () => ({
          data: {
            totp: Array.from({ length: totpFactors }, (_, i) => ({
              id: `factor-${i}`,
            })),
            all: [],
            phone: [],
          },
          error: null,
        }),
      },
    },
  } as unknown as SupabaseClient;
}

describe("readSessionState (portal auth-state gating)", () => {
  it("reports a signed-out visitor and routes them to login", async () => {
    const state = await readSessionState(fakeClient({ user: null }));

    expect(state.hasUser).toBe(false);
    expect(state.currentLevel).toBe(null);
    expect(resolveAuthDestination(state)).toBe("/login");
  });

  it("routes a user with a temporary password to onboarding", async () => {
    const state = await readSessionState(
      fakeClient({
        user: { id: "u1", user_metadata: {} },
        currentLevel: "aal1",
        totpFactors: 0,
      }),
    );

    expect(state.hasUser).toBe(true);
    expect(state.passwordSet).toBe(false);
    expect(resolveAuthDestination(state)).toBe("/onboarding");
  });

  it("routes a password-set user without MFA to onboarding for enrollment", async () => {
    const state = await readSessionState(
      fakeClient({
        user: { id: "u1", user_metadata: { password_set: true } },
        currentLevel: "aal1",
        totpFactors: 0,
      }),
    );

    expect(state.passwordSet).toBe(true);
    expect(state.hasVerifiedFactor).toBe(false);
    expect(resolveAuthDestination(state)).toBe("/onboarding");
  });

  it("routes an enrolled but unverified session to the MFA challenge", async () => {
    const state = await readSessionState(
      fakeClient({
        user: { id: "u1", user_metadata: { password_set: true } },
        currentLevel: "aal1",
        totpFactors: 1,
      }),
    );

    expect(state.hasVerifiedFactor).toBe(true);
    expect(state.currentLevel).toBe("aal1");
    expect(resolveAuthDestination(state)).toBe("/login/mfa");
  });

  it("admits a fully MFA-verified user to the portal", async () => {
    const state = await readSessionState(
      fakeClient({
        user: { id: "u1", user_metadata: { password_set: true } },
        currentLevel: "aal2",
        totpFactors: 1,
      }),
    );

    expect(state.currentLevel).toBe("aal2");
    expect(resolveAuthDestination(state)).toBe("/portal");
  });
});
