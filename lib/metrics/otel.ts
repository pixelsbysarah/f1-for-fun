/**
 * Custom OpenTelemetry instruments, used alongside Next's own automatic
 * request tracing (registered in `instrumentation.ts`).
 *
 * Two different signals are used deliberately, for the same reason laid out
 * in `instrumentation.ts`: a metrics *reader* only exists on the Node
 * runtime, not on Edge.
 *
 *  - `recordDbOperation` records a real metric (histogram). It's called from
 *    `instrumentSupabase()` (`./supabase.ts`), which only ever runs
 *    server-side in the Node runtime (the browser Supabase client and the
 *    Edge middleware client are never wrapped — see that file), so it
 *    reaches Grafana as a proper time series.
 *  - `recordSessionRefresh` annotates the *active span* instead of recording
 *    a metric, because it's called from `middleware.ts`, which runs on Edge.
 *    A histogram recorded there would have nowhere to export to (no
 *    MeterProvider reader is registered on that runtime); span attributes
 *    travel with the request span through `@vercel/otel`'s fetch-based,
 *    Edge-compatible trace exporter instead.
 *
 * Both helpers are safe to call from any runtime, exporter configured or
 * not: the OpenTelemetry API is a documented no-op when nothing is
 * registered, so this module never needs its own env-var checks.
 */
import { metrics, trace } from "@opentelemetry/api";

const METER_NAME = "f1-for-fun";

const dbOperationDuration = metrics
  .getMeter(METER_NAME)
  .createHistogram("db.client.operation.duration", {
    description:
      "Duration of a Supabase query, from the terminal call (select/insert/...) to the settled promise.",
    unit: "s",
  });

export type DbOperationOutcome = "ok" | "error";

/** Records one Supabase query's duration. Effective on the Node runtime only. */
export function recordDbOperation(args: {
  table: string;
  operation: string;
  durationMs: number;
  outcome: DbOperationOutcome;
}): void {
  dbOperationDuration.record(args.durationMs / 1000, {
    "db.system.name": "postgresql",
    "db.collection.name": args.table,
    "db.operation.name": args.operation,
    outcome: args.outcome,
  });
}

export type SessionRefreshOutcome = "ok" | "error";

/**
 * Annotates the active request span with session-refresh timing, in place of
 * a metric (see module doc). A no-op if there is no active span — e.g.
 * outside a traced request, or when no exporter is configured.
 */
export function recordSessionRefresh(args: {
  durationMs: number;
  outcome: SessionRefreshOutcome;
  authenticated: boolean;
}): void {
  const span = trace.getActiveSpan();
  if (!span) return;
  span.setAttribute("auth.session_refresh.duration_ms", args.durationMs);
  span.setAttribute("auth.session_refresh.outcome", args.outcome);
  span.setAttribute("auth.session_refresh.authenticated", args.authenticated);
}
