import { describe, expect, it } from "vitest";
import { createRateLimiter, decide, sweep } from "@/lib/rate-limit";

describe("decide", () => {
  const W = 60_000;

  it("allows exactly `limit` requests and refuses the next one", () => {
    const windows = new Map();
    const results = Array.from({ length: 4 }, () => decide(windows, "ip", 1_000, 3, W));
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
    expect(results.map((r) => r.remaining)).toEqual([2, 1, 0, 0]);
  });

  it("starts a fresh window once the old one ends", () => {
    const windows = new Map();
    for (let i = 0; i < 5; i += 1) decide(windows, "ip", 1_000, 3, W);
    expect(decide(windows, "ip", 1_000, 3, W).allowed).toBe(false);

    // One millisecond past the boundary is a new window, not a continuation of the old count.
    expect(decide(windows, "ip", W + 1, 3, W).allowed).toBe(true);
  });

  it("keeps callers apart", () => {
    const windows = new Map();
    decide(windows, "a", 0, 1, W);
    expect(decide(windows, "a", 0, 1, W).allowed).toBe(false);
    expect(decide(windows, "b", 0, 1, W).allowed).toBe(true);
  });

  it("reports whole seconds until the window ends, never zero", () => {
    const windows = new Map();
    // 500 ms before the boundary still has to say "1", because Retry-After: 0 means "now".
    const nearEnd = decide(windows, "ip", W - 500, 1, W);
    expect(nearEnd.retryAfterSeconds).toBe(1);

    const atStart = decide(new Map(), "ip", 0, 1, W);
    expect(atStart.retryAfterSeconds).toBe(60);
  });
});

describe("sweep", () => {
  it("removes ended windows and leaves live ones", () => {
    const windows = new Map();
    decide(windows, "old", 0, 5, 1_000);
    decide(windows, "live", 0, 5, 60_000);
    expect(sweep(windows, 5_000)).toBe(1);
    expect([...windows.keys()]).toEqual(["live"]);
  });
});

describe("createRateLimiter", () => {
  it("does not grow without bound when keys are rotated", () => {
    const limiter = createRateLimiter({ limit: 10, windowMs: 60_000 });
    for (let i = 0; i < 10_050; i += 1) limiter.check(`ip-${i}`, 1_000);
    expect(limiter.size).toBeLessThanOrEqual(10_001);
  });

  it("still refuses a hammering caller after a rotation storm", () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000 });
    limiter.check("victim", 1_000);
    limiter.check("victim", 1_000);
    expect(limiter.check("victim", 1_000).allowed).toBe(false);
  });
});
