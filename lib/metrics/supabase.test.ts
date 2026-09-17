import { beforeEach, describe, expect, it, vi } from "vitest";

import { recordDbOperation } from "./otel";
import { instrumentSupabase } from "./supabase";

vi.mock("./otel", () => ({
  recordDbOperation: vi.fn(),
}));

/**
 * Minimal stand-ins for the two PostgREST builder shapes this wrapper cares
 * about: a query builder (`.from()`'s return value — CRUD verbs only) and a
 * filter builder (what a CRUD verb returns — chainable, and thenable once
 * awaited). Real `@supabase/postgrest-js` builders behave the same way for
 * the purposes of this test: `.then()` is where the "request" actually
 * resolves.
 */
function makeFilterBuilder(resolve: () => Promise<{ data: unknown; error: unknown }>) {
  const builder = {
    eq: () => builder,
    order: () => builder,
    lte: () => builder,
    maybeSingle: () => builder,
    single: () => builder,
    then: (
      onFulfilled?: ((v: unknown) => unknown) | null,
      onRejected?: ((e: unknown) => unknown) | null,
    ) => resolve().then(onFulfilled, onRejected),
  };
  return builder;
}

function makeFakeClient(resolve: () => Promise<{ data: unknown; error: unknown }>) {
  return {
    from: () => ({
      select: () => makeFilterBuilder(resolve),
      insert: () => makeFilterBuilder(resolve),
      update: () => makeFilterBuilder(resolve),
      upsert: () => makeFilterBuilder(resolve),
      delete: () => makeFilterBuilder(resolve),
    }),
    // Untouched by the wrapper — present to confirm it's passed through.
    auth: { getUser: vi.fn() },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("instrumentSupabase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records table, operation, and ok outcome for a simple select", async () => {
    const client = makeFakeClient(async () => ({ data: [{ id: 1 }], error: null }));
    const wrapped = instrumentSupabase(client);

    const result = await wrapped.from("races").select("*");

    expect(result).toEqual({ data: [{ id: 1 }], error: null });
    expect(recordDbOperation).toHaveBeenCalledTimes(1);
    expect(recordDbOperation).toHaveBeenCalledWith(
      expect.objectContaining({ table: "races", operation: "select", outcome: "ok" }),
    );
  });

  it("survives a long filter chain and still labels the original verb", async () => {
    const client = makeFakeClient(async () => ({ data: null, error: null }));
    const wrapped = instrumentSupabase(client);

    await wrapped
      .from("predictions")
      .select("*")
      .eq("user_id", "u1")
      .order("season", { ascending: true })
      .maybeSingle();

    expect(recordDbOperation).toHaveBeenCalledTimes(1);
    expect(recordDbOperation).toHaveBeenCalledWith(
      expect.objectContaining({ table: "predictions", operation: "select" }),
    );
  });

  it("labels an upsert as 'upsert', not the terminal chained call", async () => {
    const client = makeFakeClient(async () => ({ data: null, error: null }));
    const wrapped = instrumentSupabase(client);

    await wrapped.from("predictions").upsert({ id: 1 }, { onConflict: "id" });

    expect(recordDbOperation).toHaveBeenCalledWith(
      expect.objectContaining({ table: "predictions", operation: "upsert" }),
    );
  });

  it("records outcome 'error' and passes the error result through on a PostgREST error", async () => {
    const pgError = { message: "denied", code: "42501" };
    const client = makeFakeClient(async () => ({ data: null, error: pgError }));
    const wrapped = instrumentSupabase(client);

    const result = await wrapped.from("predictions").insert({ id: 1 });

    expect(result).toEqual({ data: null, error: pgError });
    expect(recordDbOperation).toHaveBeenCalledWith(
      expect.objectContaining({ operation: "insert", outcome: "error" }),
    );
  });

  it("records outcome 'error' and rethrows on a rejected query", async () => {
    const client = makeFakeClient(() => Promise.reject(new Error("network down")));
    const wrapped = instrumentSupabase(client);

    await expect(wrapped.from("races").select("*")).rejects.toThrow("network down");
    expect(recordDbOperation).toHaveBeenCalledWith(
      expect.objectContaining({ table: "races", operation: "select", outcome: "error" }),
    );
  });

  it("leaves non-.from() properties (e.g. auth) untouched", () => {
    const client = makeFakeClient(async () => ({ data: null, error: null }));
    const wrapped = instrumentSupabase(client);

    expect(wrapped.auth).toBe(client.auth);
  });
});
