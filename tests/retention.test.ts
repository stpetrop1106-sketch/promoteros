import { describe, expect, it } from "vitest";
import {
  anonymisedPromoterPatch,
  decide,
  DELETE_TABLES,
  ERASED_NAME,
  ERASURE_PLAN,
  isoDate,
  isValidIsoDate,
  latestDate,
  planSweep,
  retentionUntilFor,
  type RetentionCandidate,
} from "@/lib/retention";

// A bug in `lib/retention.ts` deletes real people's records, so this file is written
// adversarially and touches no database. `lib/retention.ts` takes `today` as a parameter
// precisely so that the boundary cases below are assertable at all.
//
// The governing bias throughout: erasing a day EARLY is unrecoverable, erasing a day LATE is
// not. Every ambiguous case must resolve to "leave the row alone".

// -----------------------------------------------------------------------------------------------
// Fixtures
// -----------------------------------------------------------------------------------------------

function promoter(over: Partial<RetentionCandidate> = {}): RetentionCandidate {
  return {
    id: "p-1",
    agencyId: "a-1",
    retentionUntil: null,
    anonymisedAt: null,
    lastActivityOn: "2024-01-15",
    ...over,
  };
}

const TODAY = "2026-09-11";

// -----------------------------------------------------------------------------------------------
// Date helpers
// -----------------------------------------------------------------------------------------------

describe("isValidIsoDate", () => {
  it("accepts a real calendar date", () => {
    expect(isValidIsoDate("2026-09-11")).toBe(true);
    expect(isValidIsoDate("2024-02-29")).toBe(true);
  });

  it("rejects a date that does not exist", () => {
    // Date() would happily roll 2025-02-29 forward to 2025-03-01. Round-tripping catches it.
    expect(isValidIsoDate("2025-02-29")).toBe(false);
    expect(isValidIsoDate("2026-13-01")).toBe(false);
    expect(isValidIsoDate("2026-00-10")).toBe(false);
  });

  it("rejects anything that is not exactly YYYY-MM-DD", () => {
    for (const value of ["", "2026-9-11", "11/09/2026", "2026-09-11T00:00:00Z", "yesterday"]) {
      expect(isValidIsoDate(value)).toBe(false);
    }
  });
});

describe("isoDate", () => {
  it("takes the UTC day, not the local one", () => {
    expect(isoDate(new Date("2026-09-11T23:30:00.000Z"))).toBe("2026-09-11");
    expect(isoDate(new Date("2026-09-11T00:00:00.000Z"))).toBe("2026-09-11");
  });
});

describe("latestDate", () => {
  it("returns the most recent day and ignores holes", () => {
    expect(latestDate("2024-01-01", null, "2025-06-30", undefined)).toBe("2025-06-30");
  });

  it("truncates a timestamp to its date", () => {
    expect(latestDate("2025-06-30T21:44:10.123Z")).toBe("2025-06-30");
  });

  it("returns null when there is nothing usable", () => {
    expect(latestDate(null, undefined, "", "not-a-date")).toBeNull();
  });
});

describe("retentionUntilFor", () => {
  it("adds whole months", () => {
    expect(retentionUntilFor("2024-03-15", 24)).toBe("2026-03-15");
    expect(retentionUntilFor("2026-01-31", 12)).toBe("2027-01-31");
  });

  it("clamps rather than rolling over the end of a short month", () => {
    // 31 Jan + 1 month must be 28/29 Feb, never 2/3 March. Rolling over would silently grant
    // extra days of retention, which is the wrong direction to be sloppy in.
    expect(retentionUntilFor("2026-01-31", 1)).toBe("2026-02-28");
    expect(retentionUntilFor("2024-01-31", 1)).toBe("2024-02-29");
    expect(retentionUntilFor("2026-08-31", 1)).toBe("2026-09-30");
  });

  it("crosses year boundaries", () => {
    expect(retentionUntilFor("2025-11-30", 3)).toBe("2026-02-28");
    expect(retentionUntilFor("2025-12-01", 25)).toBe("2028-01-01");
  });

  it("refuses a malformed date or a nonsense window", () => {
    expect(() => retentionUntilFor("31/01/2026", 24)).toThrow();
    expect(() => retentionUntilFor("2026-02-30", 24)).toThrow();
    expect(() => retentionUntilFor("2026-01-31", 0)).toThrow();
    expect(() => retentionUntilFor("2026-01-31", -12)).toThrow();
    expect(() => retentionUntilFor("2026-01-31", 1.5)).toThrow();
  });
});

// -----------------------------------------------------------------------------------------------
// decide() — the single most dangerous function in the repo
// -----------------------------------------------------------------------------------------------

describe("decide — who is in scope", () => {
  it("erases a promoter whose retention date has passed", () => {
    const d = decide(promoter({ retentionUntil: "2026-09-10" }), TODAY);
    expect(d.inScope).toBe(true);
    expect(d).toMatchObject({ promoterId: "p-1", agencyId: "a-1", dueOn: "2026-09-10" });
  });

  it("does NOT erase on the retention date itself", () => {
    // `retention_until` reads as "kept UNTIL this date", so the whole of that day is still
    // inside the window. Due the day after, never on it.
    const d = decide(promoter({ retentionUntil: TODAY }), TODAY);
    expect(d).toEqual({
      promoterId: "p-1",
      agencyId: "a-1",
      inScope: false,
      reason: "not_yet_due",
    });
  });

  it("does not erase a future date", () => {
    const d = decide(promoter({ retentionUntil: "2027-01-01" }), TODAY);
    expect(d).toMatchObject({ inScope: false, reason: "not_yet_due" });
  });

  it("never infers a retention date from anything else", () => {
    // Ten years of inactivity, no date set: still untouchable. Deleting someone because of a
    // policy nobody explicitly applied to them is exactly the failure this guards against.
    const d = decide(promoter({ retentionUntil: null, lastActivityOn: "2016-01-01" }), TODAY);
    expect(d).toMatchObject({ inScope: false, reason: "no_retention_date" });
  });

  it("treats a malformed retention date as no date, not as an excuse to guess", () => {
    for (const bad of ["", "yesterday", "2026-02-30", "01-01-2020", "2020"]) {
      const d = decide(promoter({ retentionUntil: bad }), TODAY);
      expect(d).toMatchObject({ inScope: false, reason: "no_retention_date" });
    }
  });

  it("skips a promoter who is already a tombstone, however overdue", () => {
    // This is what makes the sweep safe to run repeatedly.
    const d = decide(
      promoter({ retentionUntil: "2020-01-01", anonymisedAt: "2026-01-01T10:00:00.000Z" }),
      TODAY,
    );
    expect(d).toMatchObject({ inScope: false, reason: "already_anonymised" });
  });

  it("checks anonymised_at before the date, so an erased row is never re-processed", () => {
    const d = decide(
      promoter({ retentionUntil: null, anonymisedAt: "2026-01-01T10:00:00.000Z" }),
      TODAY,
    );
    expect(d).toMatchObject({ inScope: false, reason: "already_anonymised" });
  });
});

// -----------------------------------------------------------------------------------------------
// planSweep()
// -----------------------------------------------------------------------------------------------

describe("planSweep", () => {
  const policy = new Map<string, number | null>([["a-1", 24]]);

  it("splits due from skipped and never loses a row", () => {
    const candidates = [
      promoter({ id: "due", retentionUntil: "2026-01-01" }),
      promoter({ id: "future", retentionUntil: "2030-01-01" }),
      promoter({ id: "no-date" }),
      promoter({ id: "done", retentionUntil: "2020-01-01", anonymisedAt: "2021-01-01T00:00:00Z" }),
    ];
    const plan = planSweep(candidates, TODAY, policy);

    expect(plan.due.map((d) => d.promoterId)).toEqual(["due"]);
    expect(plan.skipped).toHaveLength(3);
    expect(plan.due.length + plan.skipped.length).toBe(candidates.length);
  });

  it("reports a policy gap without acting on it", () => {
    // Last activity 2024-01-15 + 24 months = 2026-01-15, which is past. The row still has no
    // retention_until, so it is reported and NOT erased.
    const plan = planSweep([promoter({ id: "gap" })], TODAY, policy);

    expect(plan.due).toHaveLength(0);
    expect(plan.policyGaps).toEqual([
      {
        promoterId: "gap",
        agencyId: "a-1",
        lastActivityOn: "2024-01-15",
        wouldHaveBeenDueOn: "2026-01-15",
      },
    ]);
  });

  it("does not report a gap for someone still inside the declared window", () => {
    const plan = planSweep([promoter({ lastActivityOn: "2025-06-01" })], TODAY, policy);
    expect(plan.policyGaps).toHaveLength(0);
  });

  it("does not report a gap for a row that already has a date", () => {
    const plan = planSweep(
      [promoter({ retentionUntil: "2030-01-01", lastActivityOn: "2016-01-01" })],
      TODAY,
      policy,
    );
    expect(plan.policyGaps).toHaveLength(0);
  });

  it("does not report a gap for a row that is already a tombstone", () => {
    const plan = planSweep(
      [promoter({ anonymisedAt: "2026-01-01T00:00:00Z", lastActivityOn: "2016-01-01" })],
      TODAY,
      policy,
    );
    expect(plan.policyGaps).toHaveLength(0);
  });

  it("names agencies with no declared window and infers nothing for them", () => {
    const noPolicy = new Map<string, number | null>([["a-1", null]]);
    const plan = planSweep([promoter({ lastActivityOn: "2010-01-01" })], TODAY, noPolicy);

    expect(plan.agenciesWithoutPolicy).toEqual(["a-1"]);
    expect(plan.policyGaps).toHaveLength(0);
    expect(plan.due).toHaveLength(0);
  });

  it("treats an agency missing from the map as having no policy", () => {
    const plan = planSweep([promoter()], TODAY, new Map());
    expect(plan.agenciesWithoutPolicy).toEqual(["a-1"]);
    expect(plan.policyGaps).toHaveLength(0);
  });

  it("still erases an explicitly dated row in an agency with no declared window", () => {
    // The date on the row is a deliberate human act. Absence of an agency-wide policy does not
    // undo it.
    const plan = planSweep([promoter({ retentionUntil: "2020-01-01" })], TODAY, new Map());
    expect(plan.due.map((d) => d.promoterId)).toEqual(["p-1"]);
  });

  it("keeps agencies separate", () => {
    const plan = planSweep(
      [
        promoter({ id: "p-a", agencyId: "a-1", retentionUntil: "2020-01-01" }),
        promoter({ id: "p-b", agencyId: "a-2", retentionUntil: "2030-01-01" }),
      ],
      TODAY,
      new Map([
        ["a-1", 24],
        ["a-2", 60],
      ]),
    );
    expect(plan.due.map((d) => d.promoterId)).toEqual(["p-a"]);
    expect(plan.agenciesWithoutPolicy).toHaveLength(0);
  });

  it("refuses a malformed `today` rather than comparing strings against nonsense", () => {
    expect(() => planSweep([promoter()], "11/09/2026", policy)).toThrow();
  });

  it("returns empty groups for no candidates", () => {
    const plan = planSweep([], TODAY, policy);
    expect(plan).toEqual({ due: [], skipped: [], policyGaps: [], agenciesWithoutPolicy: [] });
  });
});

// -----------------------------------------------------------------------------------------------
// The tombstone patch
// -----------------------------------------------------------------------------------------------

describe("anonymisedPromoterPatch", () => {
  const now = new Date("2026-09-11T08:00:00.000Z");
  const patch = anonymisedPromoterPatch("11111111-2222-3333-4444-555555555555", now);

  it("leaves nothing that identifies a person", () => {
    expect(patch.full_name).toBe(ERASED_NAME);
    expect(patch.email).toBeNull();
    expect(patch.birth_year).toBeNull();
    expect(patch.gender).toBeNull();
    expect(patch.home_lat).toBeNull();
    expect(patch.home_lng).toBeNull();
    expect(patch.home_area_id).toBeNull();
    expect(patch.transport_notes).toBeNull();
  });

  it("satisfies the not-null, unique phone column without holding a phone number", () => {
    // `promoters.phone` is `not null` with `unique (agency_id, phone)`, so it cannot be nulled.
    // Deriving it from the id keeps it unique and personal to nobody.
    expect(patch.phone).toBe("erased:11111111-2222-3333-4444-555555555555");
    // Whatever it is, it must not be dialable: no leading +, no leading digit.
    expect(patch.phone).not.toMatch(/^\+?\d/);
    expect(patch.phone.startsWith("erased:")).toBe(true);
  });

  it("marks the row so the sweep never processes it twice", () => {
    expect(patch.anonymised_at).toBe("2026-09-11T08:00:00.000Z");
    expect(patch.status).toBe("archived");
  });

  it("is deterministic, so re-running it is a no-op rather than a second scrub", () => {
    expect(anonymisedPromoterPatch("abc", now)).toEqual(anonymisedPromoterPatch("abc", now));
  });
});

// -----------------------------------------------------------------------------------------------
// The plan itself — a table that nobody thought about is the real risk
// -----------------------------------------------------------------------------------------------

describe("ERASURE_PLAN", () => {
  /**
   * Every table in `supabase/migrations/0001_init.sql` that can hold something about a
   * promoter, listed by hand from the schema rather than derived from the plan — otherwise
   * this test would agree with whatever the plan happens to say.
   *
   * If a migration adds a table with a `promoter_id`, or one hanging off `assignments`, add it
   * here and to ERASURE_PLAN in the same edit. This assertion failing is the point.
   */
  const TABLES_THAT_CAN_HOLD_PROMOTER_DATA = [
    "promoters",
    "promoter_areas",
    "promoter_skills",
    "promoter_client_history",
    "availability",
    "brief_ack",
    "blocklist",
    "invitations",
    "message_dispatches", // 0017
    "assignments",
    "check_ins",
    "field_reports",
    "report_photos",
    "replacement_runs",
  ] as const;

  it("covers every table that can hold promoter data", () => {
    const covered = new Set(ERASURE_PLAN.map((r) => r.table));
    for (const table of TABLES_THAT_CAN_HOLD_PROMOTER_DATA) {
      expect(covered.has(table), `${table} has no entry in ERASURE_PLAN`).toBe(true);
    }
  });

  it("does not invent tables that are not in the schema", () => {
    const known = new Set<string>(TABLES_THAT_CAN_HOLD_PROMOTER_DATA);
    for (const rule of ERASURE_PLAN) {
      expect(known.has(rule.table), `${rule.table} is not a known table`).toBe(true);
    }
  });

  it("gives each table exactly one action", () => {
    const tables = ERASURE_PLAN.map((r) => r.table);
    expect(new Set(tables).size).toBe(tables.length);
  });

  it("explains every decision — the reasoning is the deliverable", () => {
    for (const rule of ERASURE_PLAN) {
      expect(rule.why.length, `${rule.table} has no reasoning`).toBeGreaterThan(40);
      expect(rule.reachedBy.length).toBeGreaterThan(0);
    }
  });

  it("keeps the shift history and deletes the profile", () => {
    const action = (table: string) => ERASURE_PLAN.find((r) => r.table === table)?.action;

    // The agency's business record survives.
    expect(action("assignments")).toBe("anonymise");
    expect(action("check_ins")).toBe("anonymise");
    expect(action("field_reports")).toBe("keep");

    // The person's profile does not.
    expect(action("availability")).toBe("delete");
    expect(action("promoter_skills")).toBe("delete");
    expect(action("promoter_areas")).toBe("delete");
    expect(action("promoter_client_history")).toBe("delete");
    expect(action("blocklist")).toBe("delete");
    expect(action("invitations")).toBe("delete");
    expect(action("brief_ack")).toBe("delete");
    expect(action("message_dispatches")).toBe("delete");

    // The promoter row is a tombstone, never a deletion — deleting it would cascade the
    // history away.
    expect(action("promoters")).toBe("anonymise");
  });

  it("DELETE_TABLES matches the plan and never includes promoters", () => {
    expect(DELETE_TABLES).toEqual(
      ERASURE_PLAN.filter((r) => r.action === "delete").map((r) => r.table),
    );
    expect(DELETE_TABLES).not.toContain("promoters");
    expect(DELETE_TABLES).not.toContain("assignments");
  });

  it("spells out what is scrubbed wherever it says anonymise", () => {
    for (const rule of ERASURE_PLAN) {
      if (rule.action !== "anonymise") continue;
      expect(rule.scrubs?.length, `${rule.table} says anonymise but lists no columns`)
        .toBeGreaterThan(0);
    }
  });
});
