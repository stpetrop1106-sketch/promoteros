import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A1-09 — `lib/tokens.ts` now carries `import "server-only"`, whose Node build throws on
// import. Neutralised here rather than aliased away in vitest.config.ts: the guardrail should
// stay real for every other module, and these three files are the ones that must reach the
// signing code itself.
vi.mock("server-only", () => ({}));
import { mintToken } from "@/lib/tokens";
import {
  AVAILABILITY_TTL_DAYS,
  AVAILABILITY_TTL_SECONDS,
  END_TIMES,
  EMPTY_DAY,
  GRID_DAYS,
  START_TIMES,
  addDaysIso,
  athensToday,
  availabilityLinkFor,
  gridDates,
  isValidIsoDate,
  isValidTime,
  isoAsUtcDate,
  mintAvailabilityToken,
  planRow,
  summariseDay,
  toDisplayTime,
  verifyAvailabilityToken,
  type AvailabilityRow,
} from "@/lib/availability-links";

// Same contract as tests/tokens.test.ts: the secret is read lazily inside sign(), so setting it
// at module scope is enough, and tests never depend on a real .env.
process.env.TOKEN_SIGNING_SECRET = "test-signing-secret-do-not-use-in-prod";

const PROMOTER = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";

describe("availability token round trip", () => {
  it("mints a token that verifies back to the same promoter", () => {
    const { token } = mintAvailabilityToken(PROMOTER);
    const result = verifyAvailabilityToken(token);
    expect(result).toEqual({ ok: true, promoterId: PROMOTER });
  });

  it("expires eight weeks out by default, not hours", () => {
    const before = Date.now();
    const { expiresAt } = mintAvailabilityToken(PROMOTER);
    const days = (expiresAt.getTime() - before) / 86_400_000;

    expect(AVAILABILITY_TTL_DAYS).toBe(56);
    expect(AVAILABILITY_TTL_SECONDS).toBe(56 * 24 * 3600);
    // A promoter keeps this link and comes back to it; anything measured in hours would put the
    // coordinator back in the business of re-sending links. Four of the fortnights the page shows.
    expect(days).toBeGreaterThan(55.9);
    expect(days).toBeLessThan(56.1);
    expect(AVAILABILITY_TTL_DAYS).toBe(4 * GRID_DAYS);
  });

  it("builds the /a/ URL, not /i/ or /c/", () => {
    const { token } = mintAvailabilityToken(PROMOTER);
    expect(availabilityLinkFor(token)).toContain(`/a/${token}`);
  });
});

describe("a wrong-purpose token is rejected", () => {
  it("refuses a genuine invitation token", () => {
    // Correct signature, correct carrier purpose, but a bare record id: this is an invitation
    // link, and it must not open somebody's availability page.
    const { token } = mintToken("invitation", "9a1b8c7d-0000-4000-8000-000000000000", 3600);
    expect(verifyAvailabilityToken(token)).toEqual({ ok: false, reason: "wrong_purpose" });
  });

  it("refuses a check-in token", () => {
    const { token } = mintToken("checkin", "assignment-1", 3600);
    expect(verifyAvailabilityToken(token)).toEqual({ ok: false, reason: "wrong_purpose" });
  });

  it("refuses a namespaced but empty record id", () => {
    const { token } = mintToken("invitation", "availability:", 3600);
    expect(verifyAvailabilityToken(token)).toEqual({ ok: false, reason: "malformed" });
  });
});

describe("an expired token is rejected", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("stops working the moment its TTL passes", () => {
    vi.setSystemTime(new Date("2026-09-11T09:00:00Z"));
    const { token } = mintAvailabilityToken(PROMOTER, 60);

    vi.setSystemTime(new Date("2026-09-11T09:00:30Z"));
    expect(verifyAvailabilityToken(token).ok).toBe(true);

    vi.setSystemTime(new Date("2026-09-11T09:01:01Z"));
    expect(verifyAvailabilityToken(token)).toEqual({ ok: false, reason: "expired" });
  });

  it("a default link is still alive at seven weeks and dead at nine", () => {
    vi.setSystemTime(new Date("2026-09-11T09:00:00Z"));
    const { token } = mintAvailabilityToken(PROMOTER);

    vi.setSystemTime(new Date("2026-10-30T09:00:00Z")); // 49 days
    expect(verifyAvailabilityToken(token).ok).toBe(true);

    vi.setSystemTime(new Date("2026-11-13T09:00:00Z")); // 63 days
    expect(verifyAvailabilityToken(token)).toEqual({ ok: false, reason: "expired" });
  });
});

describe("a tampered token is rejected", () => {
  it("refuses a swapped promoter id", () => {
    const { token } = mintAvailabilityToken(PROMOTER);
    const other = mintAvailabilityToken("00000000-0000-4000-8000-000000000001");
    const forgedBody = other.token.split(".")[0] ?? "";
    const signature = token.split(".")[1] ?? "";

    expect(verifyAvailabilityToken(`${forgedBody}.${signature}`)).toEqual({
      ok: false,
      reason: "bad_signature",
    });
  });

  it("refuses a flipped byte in the signature", () => {
    const { token } = mintAvailabilityToken(PROMOTER);
    const [body, signature] = token.split(".") as [string, string];
    const flipped = (signature[0] === "A" ? "B" : "A") + signature.slice(1);

    expect(verifyAvailabilityToken(`${body}.${flipped}`)).toEqual({
      ok: false,
      reason: "bad_signature",
    });
  });

  it("refuses a token with no signature at all", () => {
    const { token } = mintAvailabilityToken(PROMOTER);
    const body = token.split(".")[0] ?? "";
    expect(verifyAvailabilityToken(body)).toEqual({ ok: false, reason: "malformed" });
    expect(verifyAvailabilityToken("")).toEqual({ ok: false, reason: "malformed" });
  });

  it("refuses a token minted under a different secret", () => {
    const { token } = mintAvailabilityToken(PROMOTER);
    const original = process.env.TOKEN_SIGNING_SECRET;
    process.env.TOKEN_SIGNING_SECRET = "a-different-secret";
    try {
      expect(verifyAvailabilityToken(token)).toEqual({ ok: false, reason: "bad_signature" });
    } finally {
      process.env.TOKEN_SIGNING_SECRET = original;
    }
  });
});

describe("the fortnight, in Athens", () => {
  afterEach(() => vi.useRealTimers());

  it("uses the Athens calendar date, not UTC's", () => {
    // 22:30 UTC on the 11th is already 01:30 on the 12th in Athens. A promoter tapping then must
    // not be shown a grid that starts yesterday.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-11T22:30:00Z"));
    expect(athensToday()).toBe("2026-09-12");
    expect(new Date().toISOString().slice(0, 10)).toBe("2026-09-11");
  });

  it("returns fourteen consecutive days starting today", () => {
    const dates = gridDates("2026-09-11");
    expect(dates).toHaveLength(GRID_DAYS);
    expect(dates[0]).toBe("2026-09-11");
    expect(dates[13]).toBe("2026-09-24");
  });

  it("crosses a month, a year and the Athens DST switch without slipping a day", () => {
    expect(addDaysIso("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDaysIso("2026-12-31", 1)).toBe("2027-01-01");
    // Greece moves the clock back on 2026-10-25.
    expect(addDaysIso("2026-10-24", 2)).toBe("2026-10-26");
    expect(addDaysIso("2027-03-27", 2)).toBe("2027-03-29");
    expect(addDaysIso("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("reads a bare date back as the same calendar day", () => {
    const utc = isoAsUtcDate("2026-09-11");
    expect(utc.getUTCFullYear()).toBe(2026);
    expect(utc.getUTCMonth()).toBe(8);
    expect(utc.getUTCDate()).toBe(11);
  });

  it("rejects dates that are not real", () => {
    expect(isValidIsoDate("2026-09-11")).toBe(true);
    expect(isValidIsoDate("2026-02-30")).toBe(false);
    expect(isValidIsoDate("2026-13-01")).toBe(false);
    expect(isValidIsoDate("11/09/2026")).toBe(false);
    expect(isValidIsoDate("2026-9-1")).toBe(false);
  });
});

describe("one choice produces at most one row", () => {
  it("writes a whole-day row with both times null", () => {
    expect(planRow("available")).toEqual({
      ok: true,
      row: { status: "available", from_time: null, to_time: null },
    });
    expect(planRow("unavailable")).toEqual({
      ok: true,
      row: { status: "unavailable", from_time: null, to_time: null },
    });
  });

  it("models 'available after 17:00' as an available window, which is what the filter reads", () => {
    expect(planRow("partial", "17:00", null)).toEqual({
      ok: true,
      row: { status: "available", from_time: "17:00:00", to_time: null },
    });
    expect(planRow("partial", "17:00", "22:00")).toEqual({
      ok: true,
      row: { status: "available", from_time: "17:00:00", to_time: "22:00:00" },
    });
  });

  it("clearing a day writes no row at all", () => {
    expect(planRow("clear")).toEqual({ ok: true, row: null });
  });

  it("refuses a nonsense window rather than storing one", () => {
    expect(planRow("partial", "22:00", "09:00")).toEqual({ ok: false, reason: "bad_range" });
    expect(planRow("partial", "22:00", "22:00")).toEqual({ ok: false, reason: "bad_range" });
    expect(planRow("partial", "25:00", null)).toEqual({ ok: false, reason: "bad_time" });
    expect(planRow("partial", null, null)).toEqual({ ok: false, reason: "bad_time" });
    expect(planRow("whatever")).toEqual({ ok: false, reason: "bad_choice" });
  });

  it("offers only hours that can form a valid window", () => {
    expect(START_TIMES[0]).toBe("06:00");
    expect(START_TIMES[START_TIMES.length - 1]).toBe("22:00");
    expect(END_TIMES[0]).toBe("08:00");
    expect(END_TIMES[END_TIMES.length - 1]).toBe("23:00");
    for (const time of [...START_TIMES, ...END_TIMES]) expect(isValidTime(time)).toBe(true);
  });
});

describe("collapsing a day the coordinator may already have touched", () => {
  const row = (over: Partial<AvailabilityRow>): AvailabilityRow => ({
    status: "available",
    from_time: null,
    to_time: null,
    source: "self",
    ...over,
  });

  it("an untouched day is simply not set", () => {
    expect(summariseDay([])).toEqual(EMPTY_DAY);
  });

  it("trims the seconds the time column adds", () => {
    expect(toDisplayTime("17:00:00")).toBe("17:00");
    expect(toDisplayTime(null)).toBeNull();
    const state = summariseDay([row({ from_time: "17:00:00" })]);
    expect(state.choice).toBe("partial");
    expect(state.fromTime).toBe("17:00");
  });

  it("flags the contradiction the unique key allows, and shows the whole-day row", () => {
    // (promoter_id, on_date, from_time) lets these two coexist — 0005_matching_fixes.sql FIX 2.
    const state = summariseDay([
      row({ status: "unavailable", from_time: "14:00:00", to_time: "16:00:00", source: "coordinator" }),
      row({ status: "available", source: "coordinator" }),
    ]);
    expect(state.contradictory).toBe(true);
    expect(state.choice).toBe("available");
    expect(state.fromTime).toBeNull();
  });

  it("keeps the source, because 'the promoter said so herself' is the point of the parcel", () => {
    expect(summariseDay([row({ source: "coordinator" })]).source).toBe("coordinator");
    expect(summariseDay([row({ source: "self" })]).source).toBe("self");
  });
});
