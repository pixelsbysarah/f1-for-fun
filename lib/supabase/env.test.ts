import { describe, expect, it } from "vitest";

import { readSupabaseEnv } from "./env";

describe("readSupabaseEnv", () => {
  it("returns the url and anon key when both are present", () => {
    const env = {
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    };
    expect(readSupabaseEnv(env)).toEqual({
      url: "http://127.0.0.1:54321",
      anonKey: "anon-key",
    });
  });

  it("throws naming the missing variable when the url is absent", () => {
    const env = { NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key" };
    expect(() => readSupabaseEnv(env)).toThrowError(
      /NEXT_PUBLIC_SUPABASE_URL/,
    );
  });

  it("throws naming the missing variable when the anon key is absent", () => {
    const env = { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" };
    expect(() => readSupabaseEnv(env)).toThrowError(
      /NEXT_PUBLIC_SUPABASE_ANON_KEY/,
    );
  });

  it("lists both variables when neither is set", () => {
    expect(() => readSupabaseEnv({})).toThrowError(
      /NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY/,
    );
  });

  it("treats an empty-string value as missing", () => {
    const env = {
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    };
    expect(() => readSupabaseEnv(env)).toThrowError(
      /NEXT_PUBLIC_SUPABASE_URL/,
    );
  });
});
