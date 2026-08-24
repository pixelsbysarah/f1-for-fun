import { describe, expect, it } from "vitest";

import { buildContentSecurityPolicy, generateNonce } from "./headers";

const SUPABASE_ORIGIN = "https://example-project.supabase.co";

function policy(overrides: { nonce?: string; isDev?: boolean } = {}) {
  return buildContentSecurityPolicy({
    nonce: overrides.nonce ?? "test-nonce",
    supabaseOrigin: SUPABASE_ORIGIN,
    isDev: overrides.isDev ?? false,
  });
}

/** Pull a single directive's value out of a serialized policy. */
function directive(csp: string, name: string): string | undefined {
  return csp
    .split("; ")
    .find((d) => d === name || d.startsWith(`${name} `))
    ?.slice(name.length)
    .trim();
}

describe("buildContentSecurityPolicy", () => {
  it("makes the app unframeable, which is what protects the TOTP forms", () => {
    expect(directive(policy(), "frame-ancestors")).toBe("'none'");
  });

  it("pins form submissions to the app's own origin", () => {
    expect(directive(policy(), "form-action")).toBe("'self'");
  });

  it("blocks base-tag injection from re-resolving relative script URLs", () => {
    expect(directive(policy(), "base-uri")).toBe("'self'");
  });

  it("never allows inline script, in dev or prod", () => {
    for (const isDev of [true, false]) {
      expect(directive(policy({ isDev }), "script-src")).not.toContain(
        "'unsafe-inline'",
      );
    }
  });

  it("carries the request nonce into script-src", () => {
    expect(directive(policy({ nonce: "abc123" }), "script-src")).toContain(
      "'nonce-abc123'",
    );
  });

  it("allows eval only in dev, where Fast Refresh needs it", () => {
    expect(directive(policy({ isDev: true }), "script-src")).toContain(
      "'unsafe-eval'",
    );
    expect(directive(policy({ isDev: false }), "script-src")).not.toContain(
      "'unsafe-eval'",
    );
  });

  it("permits browser calls to the configured Supabase project only", () => {
    const connectSrc = directive(policy(), "connect-src");
    expect(connectSrc).toContain(SUPABASE_ORIGIN);
    expect(connectSrc).not.toContain("*");
  });

  it("permits the data: URI Supabase returns for the TOTP QR code", () => {
    expect(directive(policy(), "img-src")).toContain("data:");
  });

  it("upgrades insecure requests in production only", () => {
    expect(policy({ isDev: false })).toContain("upgrade-insecure-requests");
    expect(policy({ isDev: true })).not.toContain("upgrade-insecure-requests");
  });
});

describe("generateNonce", () => {
  it("returns a fresh value on every call", () => {
    const nonces = new Set(Array.from({ length: 100 }, generateNonce));
    expect(nonces.size).toBe(100);
  });

  it("returns 128 bits encoded as base64", () => {
    const nonce = generateNonce();
    expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
  });
});
