/**
 * Constant security headers.
 *
 * These take no per-request input, so they are served from the Next config
 * rather than the middleware — that way they also cover the static-asset paths
 * excluded by the middleware matcher. The Content-Security-Policy is NOT here:
 * it carries a per-request nonce and is set in `middleware.ts`
 * (see `lib/security/headers.ts`).
 *
 * `X-Frame-Options` duplicates the CSP's `frame-ancestors 'none'` for browsers
 * predating CSP level 3.
 */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value:
      "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
  },
  // Vercel sets HSTS on its own domains too; declared here so the guarantee
  // travels with the app rather than the host.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
