/**
 * Wraps a Supabase client so every `.from(table)` query is timed and counted,
 * without touching call sites — `lib/supabase/server.ts` and
 * `lib/supabase/service.ts` wrap their clients once at creation, and the
 * `.from(...)` calls throughout the app (`app/portal/*`, `lib/dashboard/load.ts`,
 * `lib/f1-adapter/store.ts`) are unaware anything is watching.
 *
 * The browser client (`lib/supabase/client.ts`) and the middleware's own
 * session-refresh client are deliberately NOT wrapped: they only ever call
 * `auth.*` methods, never `.from()`, so there'd be nothing to instrument.
 *
 * How the timing works: a Supabase query builder is a "thenable" — calling a
 * terminal method (`select`/`insert`/`update`/`upsert`/`delete`) returns an
 * object that isn't a real Promise but implements `.then()`, and the actual
 * HTTP request fires when that `.then()` is invoked (i.e. when the caller
 * `await`s it). Everything in between — `.eq()`, `.order()`, `.maybeSingle()`,
 * etc. — returns `this` or another chainable/thenable builder. So this wraps
 * the object returned by `.from(table)` in a `Proxy` that:
 *   1. Notes the first CRUD verb called on it as the operation label.
 *   2. Re-wraps whatever any chained method returns, so the tracking survives
 *      an arbitrarily long chain.
 *   3. Intercepts `.then()` itself to time from the CRUD-verb call to the
 *      settled promise, and record one observation — then forwards the real
 *      result/error through unchanged.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { recordDbOperation } from "./otel";

const CRUD_VERBS = new Set(["select", "insert", "update", "upsert", "delete"]);

/** Per-query mutable state, threaded through every proxy in one chain. */
type QueryContext = {
  table: string;
  operation: string | null;
  startedAt: number | null;
};

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

/** Result shape every PostgREST builder resolves to. */
type PostgrestLikeResult = { error?: unknown };

/**
 * Wraps one query builder (or anything a chained call off it returns) so its
 * eventual `.then()` gets timed under `ctx`. Assumes single-use: like the
 * underlying PostgREST builders themselves, a query is expected to be
 * awaited once, not stored and re-awaited — matching every call site in this
 * codebase.
 */
function wrapBuilder<T extends object>(target: T, ctx: QueryContext): T {
  return new Proxy(target, {
    get(obj, prop, receiver) {
      const value = Reflect.get(obj, prop, receiver);

      if (prop === "then" && typeof value === "function") {
        return (
          onFulfilled?: ((value: unknown) => unknown) | null,
          onRejected?: ((reason: unknown) => unknown) | null,
        ) => {
          const startedAt = ctx.startedAt ?? performance.now();
          const timed = (
            value.call(obj) as Promise<PostgrestLikeResult>
          ).then(
            (result) => {
              recordDbOperation({
                table: ctx.table,
                operation: ctx.operation ?? "unknown",
                durationMs: performance.now() - startedAt,
                outcome: result?.error ? "error" : "ok",
              });
              return result;
            },
            (error: unknown) => {
              recordDbOperation({
                table: ctx.table,
                operation: ctx.operation ?? "unknown",
                durationMs: performance.now() - startedAt,
                outcome: "error",
              });
              throw error;
            },
          );
          return timed.then(onFulfilled, onRejected);
        };
      }

      if (typeof value !== "function") return value;

      return (...args: unknown[]) => {
        const result = (value as (...a: unknown[]) => unknown).apply(
          obj,
          args,
        );

        if (
          ctx.operation === null &&
          typeof prop === "string" &&
          CRUD_VERBS.has(prop)
        ) {
          ctx.operation = prop;
          ctx.startedAt = performance.now();
        }

        // Re-wrap anything that's "more of the same builder" — `.eq()`,
        // `.order()`, `.maybeSingle()`, etc. return either `this` or a new
        // chainable/thenable object.
        if (
          result &&
          typeof result === "object" &&
          (result === obj || isThenable(result))
        ) {
          return wrapBuilder(result as object, ctx);
        }
        return result;
      };
    },
  }) as T;
}

/**
 * Wraps a Supabase client so every `.from(table)` query is timed and
 * recorded as a `db.client.operation.duration` observation (see
 * `lib/metrics/otel.ts`). Instrumentation never affects behavior — data and
 * errors pass through exactly as returned by the real client.
 */
export function instrumentSupabase<T extends SupabaseClient>(client: T): T {
  return new Proxy(client, {
    get(obj, prop, receiver) {
      const value = Reflect.get(obj, prop, receiver);

      if (prop === "from" && typeof value === "function") {
        return (table: string) => {
          const builder = (value as (table: string) => object).call(
            obj,
            table,
          );
          return wrapBuilder(builder, {
            table,
            operation: null,
            startedAt: null,
          });
        };
      }

      return value;
    },
  }) as T;
}
