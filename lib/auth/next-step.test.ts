import { describe, expect, it } from "vitest";

import {
  isFullyAuthenticated,
  resolveAuthDestination,
  type AuthState,
} from "./next-step";

const fullyAuthed: AuthState = {
  hasUser: true,
  passwordSet: true,
  hasVerifiedFactor: true,
  currentLevel: "aal2",
};

describe("resolveAuthDestination", () => {
  it("sends signed-out visitors to login", () => {
    expect(
      resolveAuthDestination({
        hasUser: false,
        passwordSet: false,
        hasVerifiedFactor: false,
        currentLevel: null,
      }),
    ).toBe("/login");
  });

  it("sends a user with a temporary password to onboarding", () => {
    expect(
      resolveAuthDestination({ ...fullyAuthed, passwordSet: false }),
    ).toBe("/onboarding");
  });

  it("sends a user without an enrolled factor to onboarding", () => {
    expect(
      resolveAuthDestination({
        ...fullyAuthed,
        hasVerifiedFactor: false,
        currentLevel: "aal1",
      }),
    ).toBe("/onboarding");
  });

  it("sends an enrolled user with an aal1 session to the MFA challenge", () => {
    expect(
      resolveAuthDestination({ ...fullyAuthed, currentLevel: "aal1" }),
    ).toBe("/login/mfa");
  });

  it("sends a fully MFA-verified user to the portal", () => {
    expect(resolveAuthDestination(fullyAuthed)).toBe("/portal");
  });

  it("prioritizes onboarding over the MFA challenge", () => {
    // No password AND aal1: onboarding must come first.
    expect(
      resolveAuthDestination({
        hasUser: true,
        passwordSet: false,
        hasVerifiedFactor: false,
        currentLevel: "aal1",
      }),
    ).toBe("/onboarding");
  });
});

describe("isFullyAuthenticated", () => {
  it("is true only when the destination is the portal", () => {
    expect(isFullyAuthenticated(fullyAuthed)).toBe(true);
    expect(
      isFullyAuthenticated({ ...fullyAuthed, currentLevel: "aal1" }),
    ).toBe(false);
    expect(
      isFullyAuthenticated({
        hasUser: false,
        passwordSet: false,
        hasVerifiedFactor: false,
        currentLevel: null,
      }),
    ).toBe(false);
  });
});
