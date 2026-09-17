# Observability

Prometheus + Grafana style monitoring for this app, built entirely on
**OpenTelemetry** so the same instrumentation code runs unchanged in local dev
and production. The local Docker stack (`observability/`) is dev/demo only —
nothing there touches `next build`, `next.config.mjs`, or any deploy config.
Locally, no telemetry leaves your machine unless you configure an OTLP
endpoint; in production it's wired up via Vercel environment variables (see
**Production (Vercel)** below).

## Architecture

```
                app code (instrumentation.ts, lib/metrics/*)
                       │  OTLP/HTTP (traces + metrics)
        ┌──────────────┴───────────────┐
   LOCAL (docker compose)         GRAFANA CLOUD (direct)
   otel-collector                 OTLP gateway
     ├─ spanmetrics connector       ├─ Tempo (traces)
     │  (spans → RED metrics)       └─ Mimir (metrics)
     └─ prometheus exporter
            │
        Prometheus ──── Grafana (pre-provisioned dashboard)
```

Same OTLP protocol, same metric/attribute names, either way — only the
endpoint differs, via env vars. See **Two ways to run this** below.

## What's instrumented, and why

| Signal | Mechanism | Where |
|---|---|---|
| Request rate, p95 latency, per route | Next's **automatic request spans** (via `@vercel/otel`), turned into metrics by the collector's `spanmetrics` connector (local) or Grafana Cloud's Tempo metrics-generator (cloud) | `instrumentation.ts` — no code in `middleware.ts` or any route |
| Supabase query count + duration, by table/operation | Explicit histogram (`db.client.operation.duration`), recorded by a `Proxy` wrapping `.from()` | `lib/metrics/supabase.ts`, wired into `lib/supabase/server.ts` and `lib/supabase/service.ts` |
| Auth session-refresh timing | Span attribute (`auth.session_refresh.*`) on the request span — **not** a metric | `middleware.ts` + `lib/metrics/otel.ts` |

### Why request/latency metrics come from spans, not a middleware timer

The obvious approach — time `middleware.ts` and call that "request latency" —
is wrong for this app: Next middleware returns a response and the page
*renders after* middleware returns, so a timer around the middleware call only
measures the auth/cookie work, not the actual request. The auto-instrumented
request span, by contrast, spans the whole request including render. Deriving
RED metrics from those spans is also the only option that needs zero code in
`middleware.ts` — see the `span_metrics` connector in
`observability/otel-collector-config.yaml`.

### Why the Supabase wrapper, not per-call-site timing

`instrumentSupabase()` (`lib/metrics/supabase.ts`) wraps a Supabase client
once, at creation, in a `Proxy` that intercepts `.from(table)` and times
however long the resulting query chain (`.select()`, `.eq()`, `.maybeSingle()`,
etc.) takes to resolve. Every `.from(...)` call site in the app — the portal
page/actions, the dashboard loader, the F1 result store — is instrumented for
free, with no per-call-site changes and no risk of a call site forgetting to
time itself. See the file's own doc comment for exactly how the chain-tracking
works. Covered by `lib/metrics/supabase.test.ts`.

The **browser** Supabase client (`lib/supabase/client.ts`) is deliberately
*not* wrapped — it only calls `auth.*` methods (login, MFA), never `.from()`,
so there'd be nothing to instrument, and instrumenting it would need the
browser OTel SDK (out of scope here).

### Why session-refresh timing is a span attribute, not a metric

`middleware.ts` runs on the **Edge runtime**. A metrics *exporter* needs
Node's `http` module (confirmed directly — that import breaks the Edge
bundle), so `instrumentation.ts` only registers a metrics reader on the
`nodejs` branch, never on `edge`. A histogram recorded from middleware would
have nowhere to export to. Span attributes, on the other hand, travel with
the trace via `@vercel/otel`'s fetch-based (Edge-compatible) trace exporter —
so that's what `recordSessionRefresh()` uses instead. It's visible in Grafana
Cloud's Tempo (Explore → search by service, open a trace, check its
attributes) but doesn't appear on the local dashboard, which is
Prometheus/metrics-only.

### Metric names

Follow current OpenTelemetry semantic conventions: `db.client.operation.duration`
(histogram, unit `s`) with attributes `db.system.name`, `db.collection.name`
(the table), `db.operation.name`, and a non-standard `outcome` (`ok`/`error`).
Once through the Prometheus exporter these become `db_client_operation_duration_seconds_{bucket,count,sum}`
with underscored label names (`db_collection_name`, etc.) — Prometheus
convention, not something either exporter is misconfigured to do.

## Two ways to run this

### Mode A — direct to Grafana Cloud (matches production)

Set in `.env.local`:

```
OTEL_EXPORTER_OTLP_ENDPOINT=<your Grafana Cloud OTLP gateway URL>
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Basic%20<base64(instance-id:token)>
```

Get both from **Grafana Cloud → Connections → Add new connection →
OpenTelemetry (OTLP)** — tick both **Metrics** and **Traces** when generating
the token; that page assembles the header in the exact format above. `npm run
dev` (or `build && start`) and hit the app — traces and metrics land directly
in your Grafana Cloud stack. View them at **Explore → `grafanacloud-<stack>-traces`**
(search by Service Name `f1-for-fun`) for traces, or build a dashboard against
the `grafanacloud-<stack>-prom` datasource using the queries in
`observability/grafana/dashboards/f1-observability.json`.

**Header format matters:** `OTEL_EXPORTER_OTLP_HEADERS` must be
`<key>=<value>` (comma-separated if there's more than one), not a bare token —
a bare base64 blob silently produces no `Authorization` header at all (no
error, just nothing sent) and every export gets `401`.

### Mode B — fully local, offline, no account needed

```
# .env.local (or just export in your shell for one run)
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
# no headers needed — the local collector doesn't require auth
```

```bash
cd observability
docker compose up -d
```

Then run the app as usual and open **http://localhost:3001** (Grafana; no
login — anonymous admin is enabled for this local-only stack, see the
compose file's comment on why that's fine here and nowhere else) and the
**"f1-for-fun — Observability"** dashboard is already there. Prometheus itself
is at **http://localhost:9090** if you want to run PromQL directly.

Give it a minute after the first requests: the metrics exporter flushes every
60s, and the collector's `spanmetrics` connector needs a scrape cycle after
that. With only a couple of requests, percentile panels can show gaps —
expected on light demo traffic, not a bug.

If you change `observability/grafana/provisioning/datasources/datasource.yml`
(e.g. its `uid`) after Grafana has already provisioned once, restart with
`docker compose down -v` (wipes the local volumes — there's nothing worth
keeping in them) rather than a plain restart, or Grafana's provisioner can
wedge on a stale datasource reference.

Tear down with `docker compose down -v` from `observability/`.

## Production (Vercel)

Wired up. Production has its own Grafana Cloud token —
`OTEL_EXPORTER_OTLP_ENDPOINT` and `OTEL_EXPORTER_OTLP_HEADERS` are set as
**Vercel Production environment variables**, marked Sensitive, and are
deliberately a separate token from the one in local `.env.local` (isolates
blast radius — revoke/rotate one without affecting the other). No code
differs between environments: `instrumentation.ts` just picks up whatever
OTLP endpoint is present.

**Sampling:** `traceSampler: "always_on"` in `instrumentation.ts` — every
request is traced, in production included. Grafana Cloud's plan meters
ingested series/volume, so this is worth revisiting if real traffic ever
shows up or the ingest volume starts looking off; for now it's on so the
dashboards have something to show.

**Local Mode A and production send to the same Grafana Cloud destination**
(different tokens, same backend) — when querying or dashboarding, filter on
the `deployment.environment.name` resource attribute to avoid mixing local
test traffic into a production view. That attribute is populated from
Vercel's own `VERCEL_ENV` and is only present when actually running on
Vercel — it's absent for anything run locally, including `next start`
(`NODE_ENV=production` locally does **not** set it).

**Why this couldn't just be "Prometheus scrapes the deployed app"**, the
originally-obvious design: Vercel functions are ephemeral and scale to zero,
so there's no stable process for Prometheus to scrape, and `prom-client`-style
in-memory counters would reset constantly as instances recycle. Serverless
needs a *push* model — the app sends telemetry out over authenticated HTTPS
— which is exactly what OTLP/`@vercel/otel` does, and it also means no public
metrics endpoint has to be exposed and protected in production.
