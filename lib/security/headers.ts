/**
 * Security response headers.
 *
 * Split into two pieces with different delivery mechanisms:
 *
 *  - The constant headers (frame options, nosniff, referrer policy,
 *    permissions policy, HSTS) live in `next.config.mjs`. They take no
 *    per-request input, and serving them from the Next config means they
 *    also cover the static-asset paths the middleware matcher skips.
 *  - `buildContentSecurityPolicy` — needs a fresh per-request nonce, so it is
 *    built in `middleware.ts` and set on both the request (Next reads the
 *    nonce back out of it to stamp its own inline bootstrap scripts) and the
 *    response.
 *
 * The directives that carry the most weight for this app:
 *  - `frame-ancestors 'none'` — the TOTP enrollment and challenge forms are
 *    the highest-value clickjacking targets in the app; this makes them
 *    unframeable. `X-Frame-Options: DENY` covers pre-CSP3 browsers.
 *  - `form-action 'self'` — a form's action cannot be repointed at an
 *    attacker's origin, so credentials/TOTP codes can't be exfiltrated that
 *    way even if markup injection were possible.
 *  - `base-uri 'self'` — blocks `<base>` injection, which would otherwise
 *    re-resolve every relative script URL to an attacker's host.
 *  - `script-src` with a nonce + `'strict-dynamic'` and NO `'unsafe-inline'`.
 *
 * Kept as pure functions so the policy can be unit tested without a running
 * server — a CSP that silently loses a directive is exactly the kind of
 * regression that is invisible until it matters.
 */

/**
 * `style-src` keeps `'unsafe-inline'`: `next/font` emits an inline
 * `@font-face` style block and Next injects inline styles during hydration,
 * neither of which reliably picks up a nonce. Inline-style injection is a
 * substantially weaker primitive than inline-script injection, so this is the
 * pragmatic stopping point rather than an oversight.
 */
const STYLE_SRC = ["'self'", "'unsafe-inline'"];

export type CspOptions = {
  /** Per-request nonce, base64. Must be unique per response. */
  nonce: string;
  /** Origin of the Supabase project, e.g. `https://abc.supabase.co`. */
  supabaseOrigin: string;
  /** Relaxes the policy for the dev server (HMR needs eval + a websocket). */
  isDev?: boolean;
};

export function buildContentSecurityPolicy({
  nonce,
  supabaseOrigin,
  isDev = false,
}: CspOptions): string {
  const directives: Array<[string, string[]]> = [
    ["default-src", ["'self'"]],
    [
      "script-src",
      [
        // `'self'` is a fallback for CSP2 browsers, which ignore
        // `'strict-dynamic'`. CSP3 browsers ignore `'self'` once
        // `'strict-dynamic'` is present and trust only the nonced root script
        // and whatever it loads.
        "'self'",
        `'nonce-${nonce}'`,
        "'strict-dynamic'",
        // React Fast Refresh compiles with eval in dev only.
        ...(isDev ? ["'unsafe-eval'"] : []),
      ],
    ],
    ["style-src", STYLE_SRC],
    // `data:` is required for the TOTP QR code, which Supabase Auth returns as
    // an SVG data URI (see app/onboarding/OnboardingFlow.tsx).
    ["img-src", ["'self'", "data:"]],
    // `next/font` self-hosts Merriweather/Lato at build time, so no Google
    // Fonts origin is needed here.
    ["font-src", ["'self'"]],
    [
      "connect-src",
      [
        "'self'",
        // Auth, MFA, and PostgREST calls from the browser client.
        supabaseOrigin,
        // Dev-server HMR socket. If Supabase Realtime is ever used, its
        // `wss://` origin needs adding here for production too.
        ...(isDev ? ["ws:"] : []),
      ],
    ],
    ["frame-ancestors", ["'none'"]],
    ["frame-src", ["'none'"]],
    ["object-src", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["form-action", ["'self'"]],
  ];

  const policy = directives.map(
    ([name, values]) => `${name} ${values.join(" ")}`,
  );

  if (!isDev) {
    policy.push("upgrade-insecure-requests");
  }

  return policy.join("; ");
}

/**
 * Cryptographically random 128-bit nonce, base64-encoded.
 *
 * Uses Web Crypto (available in both the Edge runtime and Node 24) rather than
 * `Math.random`, which is not a CSP-safe source: a guessable nonce is the same
 * as no nonce at all.
 */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}
