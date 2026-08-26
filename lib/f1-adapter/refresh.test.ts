import { describe, expect, it } from "vitest";

import { REFRESH_INTERVAL_MS, shouldRefresh } from "./refresh";

describe("shouldRefresh", () => {
  const now = new Date("2026-03-08T12:00:00.000Z");

  it("refreshes when there is no prior fetch", () => {
    expect(shouldRefresh(null, now)).toBe(true);
    expect(shouldRefresh(undefined, now)).toBe(true);
  });

  it("does not refresh before the interval has elapsed", () => {
    const fourMinutesAgo = new Date(now.getTime() - 4 * 60 * 1000);
    expect(shouldRefresh(fourMinutesAgo, now)).toBe(false);
  });

  it("refreshes exactly at the interval boundary", () => {
    const fiveMinutesAgo = new Date(now.getTime() - REFRESH_INTERVAL_MS);
    expect(shouldRefresh(fiveMinutesAgo, now)).toBe(true);
  });

  it("refreshes once past the interval", () => {
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
    expect(shouldRefresh(tenMinutesAgo, now)).toBe(true);
  });

  it("does not refresh one millisecond before the boundary", () => {
    const justUnder = new Date(now.getTime() - (REFRESH_INTERVAL_MS - 1));
    expect(shouldRefresh(justUnder, now)).toBe(false);
  });

  it("accepts an ISO string timestamp (as read from the DB)", () => {
    const iso = new Date(now.getTime() - 6 * 60 * 1000).toISOString();
    expect(shouldRefresh(iso, now)).toBe(true);
  });

  it("accepts epoch millis", () => {
    expect(shouldRefresh(now.getTime() - 6 * 60 * 1000, now)).toBe(true);
  });

  it("refreshes when the stored timestamp is unparseable", () => {
    expect(shouldRefresh("not-a-date", now)).toBe(true);
  });

  it("honours a custom interval", () => {
    const thirtySecondsAgo = new Date(now.getTime() - 30 * 1000);
    expect(shouldRefresh(thirtySecondsAgo, now, 60 * 1000)).toBe(false);
    expect(shouldRefresh(thirtySecondsAgo, now, 10 * 1000)).toBe(true);
  });
});
