import { describe, expect, it, vi } from "vitest";
import {
  isRunPeriodKey,
  manualPeriodKey,
  nextAvailabilityDate,
  periodKeyFor,
} from "@/lib/dispatch/period";
import {
  canReclaim,
  countResults,
  outcomeFromSend,
  redactError,
  STALE_PENDING_MS,
  type DispatchKey,
  type DispatchOutcome,
  type DispatchStatus,
  type ExistingDispatch,
} from "@/lib/dispatch/outcome";
import { dispatchOne, type DispatchStore } from "@/lib/dispatch/engine";
import { createPacer, runBounded } from "@/lib/dispatch/pacer";
import { isAuthorizedCronRequest } from "@/lib/dispatch/cron-auth";
import { availabilityMessage, checkinMessage, firstName, manualText } from "@/lib/dispatch/messages";
import {
  lastRunFrom,
  latestFailedPromoters,
  sentCount,
  unreachableReason,
  type DispatchRow,
} from "@/lib/dispatch/summary";
import type { MessagingAdapter, OutboundMessage, SendResult } from "@/lib/messaging";

process.env.TOKEN_SIGNING_SECRET = "test-signing-secret-do-not-use-in-prod";

// ---------------------------------------------------------------------------
// Period keys — Europe/Athens, not UTC
// ---------------------------------------------------------------------------

describe("periodKeyFor", () => {
  it("is the 15th in Athens at 23:30 UTC on the 14th (summer, UTC+3)", () => {
    expect(periodKeyFor(new Date("2026-09-14T23:30:00Z"))).toBe("2026-09-15");
  });

  it("is the 15th in Athens at 23:30 UTC on the 14th (winter, UTC+2)", () => {
    expect(periodKeyFor(new Date("2026-01-14T23:30:00Z"))).toBe("2026-01-15");
  });

  it("is still the 14th in Athens at 20:59 UTC on the 14th (summer)", () => {
    expect(periodKeyFor(new Date("2026-09-14T20:59:00Z"))).toBeNull();
  });

  it("the first Athens minute of the 15th counts; the last minute of the 15th counts; the 16th does not", () => {
    expect(periodKeyFor(new Date("2026-09-14T21:00:00Z"))).toBe("2026-09-15");
    expect(periodKeyFor(new Date("2026-09-15T20:59:59Z"))).toBe("2026-09-15");
    expect(periodKeyFor(new Date("2026-09-15T21:00:00Z"))).toBeNull();
  });

  it("the 1st in Athens while UTC is still on the last day of the previous month, across a year", () => {
    expect(periodKeyFor(new Date("2026-12-31T22:30:00Z"))).toBe("2027-01-01");
    expect(periodKeyFor(new Date("2026-02-28T23:00:00Z"))).toBe("2026-03-01");
  });

  it("the cron's own hour (04:00 UTC) reads the same date in both seasons", () => {
    expect(periodKeyFor(new Date("2026-10-01T04:00:00Z"))).toBe("2026-10-01");
    expect(periodKeyFor(new Date("2026-12-15T04:00:00Z"))).toBe("2026-12-15");
    expect(periodKeyFor(new Date("2026-12-16T04:00:00Z"))).toBeNull();
  });

  it("is null on every other day", () => {
    for (const day of ["02", "10", "14", "16", "28", "30"]) {
      expect(periodKeyFor(new Date(`2026-09-${day}T09:00:00Z`)), day).toBeNull();
    }
  });
});

describe("manual and next-run keys", () => {
  it("the manual key is the Athens date", () => {
    expect(manualPeriodKey(new Date("2026-09-13T22:10:00Z"))).toBe("manual-2026-09-14");
  });

  it("next availability date", () => {
    expect(nextAvailabilityDate(new Date("2026-09-13T09:00:00Z"))).toBe("2026-09-15");
    expect(nextAvailabilityDate(new Date("2026-09-15T09:00:00Z"))).toBe("2026-09-15");
    expect(nextAvailabilityDate(new Date("2026-09-16T09:00:00Z"))).toBe("2026-10-01");
    expect(nextAvailabilityDate(new Date("2026-12-20T09:00:00Z"))).toBe("2027-01-01");
    expect(nextAvailabilityDate(new Date("2026-02-20T09:00:00Z"))).toBe("2026-03-01");
    expect(nextAvailabilityDate(new Date("2026-09-01T09:00:00Z"))).toBe("2026-09-01");
  });

  it("run keys exclude the welcome and check-in keys", () => {
    expect(isRunPeriodKey("2026-09-15")).toBe(true);
    expect(isRunPeriodKey("2026-09-01")).toBe(true);
    expect(isRunPeriodKey("manual-2026-09-13")).toBe(true);
    expect(isRunPeriodKey("welcome")).toBe(false);
    expect(isRunPeriodKey("2026-09-13")).toBe(false);
    expect(isRunPeriodKey("3f2504e0-4f89-11d3-9a0c-0305e82c3301")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Outcome mapping and reclaim rules
// ---------------------------------------------------------------------------

describe("outcomeFromSend", () => {
  it("only a provider acceptance is sent", () => {
    expect(outcomeFromSend({ delivered: true, channel: "email", providerMessageId: "e1" })).toEqual({
      status: "sent",
      channel: "email",
      providerMessageId: "e1",
    });
  });

  it("an address problem is skipped with its reason; a provider problem is failed", () => {
    const manual = { delivered: false as const, channel: "clipboard" as const, manualBody: "x" };
    expect(outcomeFromSend({ ...manual, reason: "no_address" })).toMatchObject({ status: "skipped", skipReason: "no_email" });
    expect(outcomeFromSend({ ...manual, reason: "invalid_address" })).toMatchObject({ skipReason: "invalid_email" });
    expect(outcomeFromSend({ ...manual, reason: "reserved_domain" })).toMatchObject({ skipReason: "reserved_domain" });
    expect(outcomeFromSend({ ...manual, channel: "email", reason: "rate_limited", error: "resend_429:rate_limit_exceeded" })).toEqual({
      status: "failed",
      channel: "email",
      error: "resend_429:rate_limit_exceeded",
    });
    expect(outcomeFromSend(manual)).toMatchObject({ status: "skipped", skipReason: "email_not_configured" });
  });

  it("never stores an address inside an error", () => {
    expect(redactError("Invalid `to` field: maria@gmail.com, please")).toBe("Invalid `to` field: [address], please");
    expect(redactError("x".repeat(1000)).length).toBe(300);
  });
});

describe("canReclaim", () => {
  const now = new Date("2026-09-15T04:10:00Z");
  const row = (status: DispatchStatus, minutesAgo: number): ExistingDispatch => ({
    id: "d",
    status,
    attempts: 1,
    updatedAt: new Date(now.getTime() - minutesAgo * 60_000).toISOString(),
  });

  it("never takes over a sent row, however old", () => {
    expect(canReclaim(row("sent", 60 * 24 * 30), now)).toBe(false);
  });

  it("takes over skipped and failed rows", () => {
    expect(canReclaim(row("skipped", 0), now)).toBe(true);
    expect(canReclaim(row("failed", 0), now)).toBe(true);
  });

  it("takes over a pending row only once it is stale", () => {
    expect(canReclaim(row("pending", 1), now)).toBe(false);
    expect(canReclaim(row("pending", STALE_PENDING_MS / 60_000 - 1), now)).toBe(false);
    expect(canReclaim(row("pending", STALE_PENDING_MS / 60_000), now)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// The engine — exactly once, against a store with the real unique key
// ---------------------------------------------------------------------------

type MemRow = ExistingDispatch & { key: string; outcome?: DispatchOutcome };

/** Enforces `unique (promoter_id, kind, period_key)` and the attempts-conditional reclaim. */
function memoryStore() {
  const rows = new Map<string, MemRow>();
  let seq = 0;
  const k = (key: DispatchKey) => `${key.promoterId}|${key.kind}|${key.periodKey}`;
  const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

  const store: DispatchStore = {
    async insertPending(key) {
      await tick();
      if (rows.has(k(key))) return { inserted: false };
      const id = `d${++seq}`;
      rows.set(k(key), { id, key: k(key), status: "pending", attempts: 1, updatedAt: new Date().toISOString() });
      return { inserted: true, id };
    },
    async findExisting(key) {
      await tick();
      const r = rows.get(k(key));
      return r ? { id: r.id, status: r.status, attempts: r.attempts, updatedAt: r.updatedAt } : null;
    },
    async reclaim(existing) {
      await tick();
      const r = [...rows.values()].find((x) => x.id === existing.id);
      if (!r || r.status !== existing.status || r.attempts !== existing.attempts) return false;
      r.status = "pending";
      r.attempts += 1;
      r.updatedAt = new Date().toISOString();
      return true;
    },
    async finish(id, outcome) {
      await tick();
      const r = [...rows.values()].find((x) => x.id === id);
      if (!r) throw new Error("no row");
      r.status = outcome.status;
      r.outcome = outcome;
      r.updatedAt = new Date().toISOString();
    },
  };
  return { store, rows };
}

function fakeAdapter(respond: (m: OutboundMessage) => SendResult | Promise<SendResult>) {
  const sent: OutboundMessage[] = [];
  const adapter: MessagingAdapter = {
    channel: "email",
    async send(m) {
      sent.push(m);
      await new Promise((resolve) => setTimeout(resolve, 1));
      return respond(m);
    },
  };
  return { adapter, sent };
}

const KEY: DispatchKey = {
  agencyId: "agency-1",
  promoterId: "promoter-1",
  kind: "availability_link",
  periodKey: "2026-09-15",
};

const MSG: OutboundMessage = {
  to: { name: "P", phone: "+306900000000", email: "p@mailbox.gr" },
  body: "b",
  url: "https://app/a/x",
};

describe("dispatchOne", () => {
  it("claims, sends with an idempotency key derived from the row, and records sent", async () => {
    const { store, rows } = memoryStore();
    const { adapter, sent } = fakeAdapter(() => ({ delivered: true, channel: "email", providerMessageId: "e1" }));

    const result = await dispatchOne({ store, adapter }, KEY, async () => MSG);

    expect(result).toEqual({ result: "sent" });
    expect(sent).toHaveLength(1);
    expect(sent[0]?.idempotencyKey).toBe("promoteros-dispatch-d1");
    expect([...rows.values()][0]?.status).toBe("sent");
  });

  it("two overlapping runs for the same key send exactly one email", async () => {
    const { store } = memoryStore();
    const { adapter, sent } = fakeAdapter(() => ({ delivered: true, channel: "email" }));

    const results = await Promise.all([
      dispatchOne({ store, adapter }, KEY, async () => MSG),
      dispatchOne({ store, adapter }, KEY, async () => MSG),
      dispatchOne({ store, adapter }, KEY, async () => MSG),
    ]);

    expect(sent).toHaveLength(1);
    expect(results.filter((r) => r.result === "sent")).toHaveLength(1);
    expect(results.filter((r) => r.result === "already_claimed")).toHaveLength(2);
  });

  it("a cron retry after a successful run sends nothing", async () => {
    const { store } = memoryStore();
    const { adapter, sent } = fakeAdapter(() => ({ delivered: true, channel: "email" }));
    await dispatchOne({ store, adapter }, KEY, async () => MSG);
    const again = await dispatchOne({ store, adapter }, KEY, async () => MSG);
    expect(again).toEqual({ result: "already_claimed" });
    expect(sent).toHaveLength(1);
  });

  it("a later run re-tries a failed row, and two concurrent re-tries still send once", async () => {
    const { store, rows } = memoryStore();
    const failing = fakeAdapter(() => ({
      delivered: false,
      channel: "email",
      manualBody: "x",
      reason: "provider_error",
      error: "resend_500:internal_server_error",
    }));
    expect(await dispatchOne({ store, adapter: failing.adapter }, KEY, async () => MSG)).toEqual({ result: "failed" });

    const ok = fakeAdapter(() => ({ delivered: true, channel: "email" }));
    const retries = await Promise.all([
      dispatchOne({ store, adapter: ok.adapter }, KEY, async () => MSG),
      dispatchOne({ store, adapter: ok.adapter }, KEY, async () => MSG),
    ]);
    expect(ok.sent).toHaveLength(1);
    expect(retries.map((r) => r.result).sort()).toEqual(["already_claimed", "sent"]);
    const row = [...rows.values()][0];
    expect(row?.attempts).toBe(2);
    // The retry reuses the row's idempotency key, so the provider de-duplicates too.
    expect(ok.sent[0]?.idempotencyKey).toBe("promoteros-dispatch-d1");
  });

  it("a skipped promoter is re-evaluated on the next run of the same period", async () => {
    const { store } = memoryStore();
    const skip = fakeAdapter(() => ({ delivered: false, channel: "clipboard", manualBody: "x", reason: "no_address" }));
    expect(await dispatchOne({ store, adapter: skip.adapter }, KEY, async () => MSG)).toEqual({
      result: "skipped",
      skipReason: "no_email",
    });
    const ok = fakeAdapter(() => ({ delivered: true, channel: "email" }));
    expect(await dispatchOne({ store, adapter: ok.adapter }, KEY, async () => MSG)).toEqual({ result: "sent" });
  });

  it("a fresh pending row (a live run mid-send) is left alone", async () => {
    const { store, rows } = memoryStore();
    rows.set(`${KEY.promoterId}|${KEY.kind}|${KEY.periodKey}`, {
      id: "live",
      key: "",
      status: "pending",
      attempts: 1,
      updatedAt: new Date().toISOString(),
    });
    const { adapter, sent } = fakeAdapter(() => ({ delivered: true, channel: "email" }));
    expect(await dispatchOne({ store, adapter }, KEY, async () => MSG)).toEqual({ result: "already_claimed" });
    expect(sent).toHaveLength(0);
  });

  it("different periods, kinds or promoters are different messages", async () => {
    const { store } = memoryStore();
    const { adapter, sent } = fakeAdapter(() => ({ delivered: true, channel: "email" }));
    await dispatchOne({ store, adapter }, KEY, async () => MSG);
    await dispatchOne({ store, adapter }, { ...KEY, periodKey: "welcome" }, async () => MSG);
    await dispatchOne({ store, adapter }, { ...KEY, kind: "checkin_link", periodKey: "assignment-1" }, async () => MSG);
    await dispatchOne({ store, adapter }, { ...KEY, promoterId: "promoter-2" }, async () => MSG);
    expect(sent).toHaveLength(4);
  });

  it("never sends without a claim: a store that cannot insert means no email", async () => {
    const { store } = memoryStore();
    const broken: DispatchStore = {
      ...store,
      insertPending: async () => {
        throw new Error("relation message_dispatches does not exist");
      },
    };
    const { adapter, sent } = fakeAdapter(() => ({ delivered: true, channel: "email" }));
    expect(await dispatchOne({ store: broken, adapter }, KEY, async () => MSG)).toEqual({ result: "error" });
    expect(sent).toHaveLength(0);
  });

  it("a message that cannot be built is a failed row, not a thrown run", async () => {
    const { store, rows } = memoryStore();
    const { adapter, sent } = fakeAdapter(() => ({ delivered: true, channel: "email" }));
    const result = await dispatchOne({ store, adapter }, KEY, async () => {
      throw new Error("Assignment not found for maria@gmail.com");
    });
    expect(result).toEqual({ result: "failed" });
    expect(sent).toHaveLength(0);
    const outcome = [...rows.values()][0]?.outcome;
    expect(outcome).toMatchObject({ status: "failed" });
    expect(JSON.stringify(outcome)).not.toContain("maria@gmail.com");
  });

  it("an adapter that throws is recorded as failed", async () => {
    const { store } = memoryStore();
    const adapter: MessagingAdapter = {
      channel: "email",
      send: async () => {
        throw new Error("boom");
      },
    };
    expect(await dispatchOne({ store, adapter }, KEY, async () => MSG)).toEqual({ result: "failed" });
  });
});

// ---------------------------------------------------------------------------
// Pacing and bounded concurrency
// ---------------------------------------------------------------------------

describe("createPacer", () => {
  it("spaces concurrent callers at least the interval apart", async () => {
    let clock = 1_000;
    const starts: number[] = [];
    const sleep = vi.fn(async (ms: number) => {
      // Model time passing only for the sleeper; callers reserved their slots synchronously.
      starts.push(clock + ms);
    });
    const pace = createPacer(500, { now: () => clock, sleep });

    await Promise.all([pace(), pace(), pace(), pace()]);

    // First goes immediately (no sleep), the rest at +500, +1000, +1500.
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([500, 1000, 1500]);
    clock = 5_000;
    await pace();
    expect(sleep).toHaveBeenCalledTimes(3); // long enough since the last slot: no wait
  });
});

describe("runBounded", () => {
  it("never has more than `concurrency` in flight, and one failure never stops the rest", async () => {
    let inFlight = 0;
    let peak = 0;
    const items = Array.from({ length: 12 }, (_, i) => i);

    const { results, notStarted } = await runBounded(
      items,
      async (i) => {
        inFlight++;
        peak = Math.max(peak, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 2));
        inFlight--;
        if (i === 3 || i === 7) throw new Error("one promoter failed");
        return "ok" as const;
      },
      { concurrency: 2, onError: () => "error" as const },
    );

    expect(peak).toBe(2);
    expect(notStarted).toBe(0);
    expect(results).toHaveLength(12);
    expect(results.filter((r) => r === "error")).toHaveLength(2);
  });

  it("stops starting new work once the deadline passes and reports what it left", async () => {
    let now = 0;
    const { results, notStarted } = await runBounded(
      [1, 2, 3, 4, 5],
      async () => {
        now += 100;
        return "ok";
      },
      { concurrency: 1, onError: () => "error", deadline: 250, now: () => now },
    );
    expect(results).toHaveLength(3);
    expect(notStarted).toBe(2);
  });

  it("counts results for the JSON summary", () => {
    const counts = countResults(
      [
        { result: "sent" },
        { result: "sent" },
        { result: "skipped", skipReason: "no_email" },
        { result: "skipped", skipReason: "invalid_email" },
        { result: "skipped", skipReason: "reserved_domain" },
        { result: "failed" },
        { result: "already_claimed" },
        { result: "error" },
      ],
      4,
    );
    expect(counts).toEqual({
      considered: 12,
      sent: 2,
      skipped: 3,
      skippedNoEmail: 2,
      skippedReservedDomain: 1,
      failed: 1,
      alreadyClaimed: 1,
      errors: 1,
      notStarted: 4,
    });
  });
});

// ---------------------------------------------------------------------------
// Cron authorization
// ---------------------------------------------------------------------------

describe("isAuthorizedCronRequest", () => {
  const SECRET = "s3cret-cron-value";

  it("accepts exactly `Bearer <secret>`", () => {
    expect(isAuthorizedCronRequest(`Bearer ${SECRET}`, SECRET)).toBe(true);
  });

  it("rejects everything when CRON_SECRET is unset or empty", () => {
    expect(isAuthorizedCronRequest("Bearer ", "")).toBe(false);
    expect(isAuthorizedCronRequest("Bearer undefined", undefined)).toBe(false);
    expect(isAuthorizedCronRequest(null, undefined)).toBe(false);
  });

  it("rejects near misses", () => {
    for (const header of [
      null,
      "",
      SECRET,
      `bearer ${SECRET}`,
      `Bearer  ${SECRET}`,
      `Bearer ${SECRET} `,
      `Bearer ${SECRET}x`,
      `Bearer ${SECRET.slice(0, -1)}`,
      `Basic ${SECRET}`,
    ]) {
      expect(isAuthorizedCronRequest(header, SECRET), String(header)).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Messages and the settings summary
// ---------------------------------------------------------------------------

describe("messages", () => {
  const recipient = { id: "3f2504e0-4f89-11d3-9a0c-0305e82c3301", fullName: "Μαρία Δοκιμαστική", phone: "+306900000000", email: "m@mailbox.gr" };

  it("availability: greeting by first name, the agency, the /a/ link, subject and button", () => {
    const m = availabilityMessage(recipient, "periodic", "Δοκιμαστικό Γραφείο");
    expect(m.body).toContain("Γεια σου Μαρία!");
    expect(m.body).toContain("Δοκιμαστικό Γραφείο");
    expect(m.url).toMatch(/\/a\/[^/]+$/);
    expect(m.to.email).toBe("m@mailbox.gr");
    expect(m.subject).toBeTruthy();
    expect(m.actionLabel).toBeTruthy();
    expect(manualText(m).endsWith(m.url)).toBe(true);
  });

  it("the welcome reads differently from the periodic one", () => {
    expect(availabilityMessage(recipient, "welcome", "Γ").subject).not.toBe(
      availabilityMessage(recipient, "periodic", "Γ").subject,
    );
  });

  it("check-in: store, times without seconds, the given link", () => {
    const m = checkinMessage(
      recipient,
      { campaignName: "Καμπάνια", storeName: "Κατάστημα", startTime: "09:00:00", endTime: "17:00:00" },
      "https://app/c/tok",
    );
    expect(m.body).toContain("Καμπάνια · Κατάστημα, 09:00–17:00");
    expect(m.url).toBe("https://app/c/tok");
    expect(m.subject).toContain("09:00");
  });

  it("first name", () => {
    expect(firstName("  Μαρία   Δοκιμαστική ")).toBe("Μαρία");
    expect(firstName("Μαρία")).toBe("Μαρία");
  });
});

describe("settings summary", () => {
  const row = (p: string, key: string, status: DispatchStatus, created: string, skip: DispatchRow["skip_reason"] = null): DispatchRow => ({
    promoter_id: p,
    period_key: key,
    status,
    skip_reason: skip,
    created_at: created,
    updated_at: created,
  });

  it("the last run is the most recently started run, never the welcome", () => {
    const rows = [
      row("a", "2026-09-01", "sent", "2026-09-01T04:01:00Z"),
      row("a", "manual-2026-09-13", "sent", "2026-09-13T10:00:00Z"),
      row("b", "manual-2026-09-13", "skipped", "2026-09-13T10:00:01Z", "no_email"),
      row("c", "manual-2026-09-13", "skipped", "2026-09-13T10:00:02Z", "reserved_domain"),
      row("d", "manual-2026-09-13", "failed", "2026-09-13T10:00:03Z"),
      row("e", "welcome", "sent", "2026-09-13T12:00:00Z"),
    ];
    expect(lastRunFrom(rows)).toEqual({
      periodKey: "manual-2026-09-13",
      manual: true,
      at: "2026-09-13T10:00:03Z",
      sent: 1,
      skippedNoEmail: 1,
      skippedReservedDomain: 1,
      failed: 1,
      pending: 0,
    });
    expect(lastRunFrom([row("e", "welcome", "sent", "2026-09-13T12:00:00Z")])).toBeNull();
  });

  it("a promoter counts as failed only if their latest message failed", () => {
    const rows = [
      row("a", "2026-09-01", "failed", "2026-09-01T04:00:00Z"),
      row("a", "manual-2026-09-13", "sent", "2026-09-13T10:00:00Z"),
      row("b", "manual-2026-09-13", "failed", "2026-09-13T10:00:00Z"),
    ];
    expect([...latestFailedPromoters(rows)]).toEqual(["b"]);
    expect(sentCount(rows, "manual-2026-09-13")).toBe(1);
  });

  it("unreachable reasons, most general first", () => {
    expect(unreachableReason("m@mailbox.gr", false, true)).toBe("email_not_configured");
    expect(unreachableReason(null, true, false)).toBe("no_email");
    expect(unreachableReason("nope", true, false)).toBe("invalid_email");
    expect(unreachableReason("seed@example.invalid", true, false)).toBe("reserved_domain");
    expect(unreachableReason("m@mailbox.gr", true, true)).toBe("last_send_failed");
    expect(unreachableReason("m@mailbox.gr", true, false)).toBeNull();
  });
});
