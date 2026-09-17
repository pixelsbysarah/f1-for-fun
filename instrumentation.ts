/**
 * OpenTelemetry bootstrap. Next.js calls `register()` here once per server
 * runtime instance it starts — separately for the Node.js server and the Edge
 * runtime (`middleware.ts`) — so this branches on `NEXT_RUNTIME` rather than
 * assuming one environment.
 *
 * The two runtimes get different setups because they support different
 * exporters:
 *
 *  - **Node**: registers both a trace exporter and a *metrics* exporter
 *    (`@opentelemetry/exporter-metrics-otlp-http`). That package's transport
 *    imports Node's `http` module, which does not exist in the Edge sandbox —
 *    importing it from code that ends up in the middleware bundle would break
 *    the build. This is the runtime `lib/metrics/otel.ts`'s
 *    `db.client.operation.duration` histogram actually gets exported from.
 *  - **Edge**: registers traces only, via `@vercel/otel`'s built-in
 *    fetch-based OTLP exporter (Edge-compatible). No metrics reader is
 *    registered here, so any histogram recorded from `middleware.ts` would
 *    silently go nowhere — see `lib/metrics/otel.ts` for how the
 *    auth-session-refresh timing is recorded instead (as a span attribute).
 *
 * Both branches are silent no-ops when `OTEL_EXPORTER_OTLP_ENDPOINT` is
 * unset — e.g. local dev without an `.env.local`, or CI. `registerOTel` falls
 * back to "no exporter" rather than throwing, so nothing breaks and nothing
 * is sent. Production has the endpoint set (Vercel env vars); see
 * OBSERVABILITY.md for how that's configured and how local dev can point at
 * either Grafana Cloud directly or the local Docker stack.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerOTel } = await import("@vercel/otel");
    const { PeriodicExportingMetricReader } = await import(
      "@opentelemetry/sdk-metrics"
    );
    const { OTLPMetricExporter } = await import(
      "@opentelemetry/exporter-metrics-otlp-http"
    );

    registerOTel({
      serviceName: "f1-for-fun",
      // Trivial traffic (a two-user portfolio app) — keep every trace rather
      // than sampling, so the demo dashboard always has data to show.
      traceSampler: "always_on",
      metricReaders: [
        new PeriodicExportingMetricReader({
          exporter: new OTLPMetricExporter(),
        }),
      ],
    });
  } else if (process.env.NEXT_RUNTIME === "edge") {
    const { registerOTel } = await import("@vercel/otel");

    // Traces only — see the module comment above for why metrics are
    // skipped on this runtime.
    registerOTel({
      serviceName: "f1-for-fun",
      traceSampler: "always_on",
    });
  }
}
