import { describe, expect, it } from "vitest";
import { detectHeader, parseRows, matchStores } from "@/lib/import";
import type { KnownStore, ParsedRow, SheetGrid } from "@/lib/import";
import { runImportCommit, type ImportDeps, type ShiftInsert } from "@/app/shifts/import/commit";
import {
  assignColumn,
  geocodeQueries,
  headerSignature,
  missingRequiredFields,
  planRows,
  restoreMapping,
  rowsForStoreMatching,
  storeTargetsBySourceRow,
  summarisePlan,
} from "@/app/shifts/import/plan";
import type { CommitInput, StoreResolution } from "@/app/shifts/import/types";

// All synthetic: invented chain ("Hyper Vega"), invented branches, invented campaign.
const TODAY = "2026-09-13";
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const CAMPAIGN = uuid(1);
const OTHER_CAMPAIGN = uuid(2);
const CLIENT = uuid(3);
const PROGRAMME = uuid(4);
const STORE_GLYFADA = uuid(10);
const STORE_FOREIGN = uuid(99); // belongs to another agency: RLS never returns it

const KNOWN: KnownStore[] = [{ id: STORE_GLYFADA, name: "Hyper Vega Γλυφάδα", address: null, chain: "Hyper Vega" }];

function grid(rows: (string | number | null)[][]): SheetGrid {
  return { name: "Σεπτ", rows: [["Ημερομηνία", "Κατάστημα", "Διεύθυνση", "Ωράριο", "Άτομα"], ...rows] };
}

function parse(g: SheetGrid): ParsedRow[] {
  const h = detectHeader(g);
  return parseRows(g, h.headerRowIndex, h.mapping, { today: TODAY });
}

function resolutionsFor(rows: ParsedRow[], decide: (name: string) => StoreResolution["action"]): StoreResolution[] {
  return matchStores(rowsForStoreMatching(rows), KNOWN).map((m) => {
    const action = decide(m.name);
    if (action === "existing") return { key: m.key, sourceRows: m.sourceRows, action, storeId: m.match?.storeId ?? STORE_GLYFADA };
    return { key: m.key, sourceRows: m.sourceRows, action };
  });
}

function strip(rows: ParsedRow[]) {
  return rows.map(({ issues: _i, notes: _n, ...rest }) => rest);
}

type Log = { writes: string[]; shifts: ShiftInsert[] };

function fakeDeps(overrides: Partial<ImportDeps> = {}): { deps: ImportDeps; log: Log } {
  const log: Log = { writes: [], shifts: [] };
  let storeSeq = 500;
  const deps: ImportDeps = {
    today: TODAY,
    readOnly: false,
    findCampaign: async (id) => (id === CAMPAIGN ? { id, name: "Σεπτέμβριος", clientId: CLIENT } : null),
    findClient: async (id) => (id === CLIENT ? { id } : null),
    findClientByName: async (name) => (name === "Υπάρχων Πελάτης" ? { id: CLIENT } : null),
    findProgramme: async (id) => (id === PROGRAMME ? { id, name: "Σεπτέμβριος — Hyper Vega", campaignId: CAMPAIGN, archived: false } : null),
    listKnownStores: async () => KNOWN,
    listExistingShiftKeys: async () => [],
    hasRecentImport: async () => false,
    geocode: async () => ({ lat: 37.87, lng: 23.75 }),
    createClient: async () => {
      log.writes.push("client");
      return uuid(200);
    },
    createCampaign: async () => {
      log.writes.push("campaign");
      return uuid(300);
    },
    createStore: async (s) => {
      log.writes.push(`store:${s.name}`);
      return uuid(storeSeq++);
    },
    createProgramme: async () => {
      log.writes.push("programme");
      return uuid(400);
    },
    insertShifts: async (rows) => {
      log.writes.push(`shifts:${rows.length}`);
      log.shifts.push(...rows);
      return true;
    },
    ...overrides,
  };
  return { deps, log };
}

function input(rows: ParsedRow[], stores: StoreResolution[], extra: Partial<CommitInput> = {}): CommitInput {
  return {
    filename: "Σεπτέμβριος — Hyper Vega.xlsx",
    rows: strip(rows),
    campaign: { mode: "existing", campaignId: CAMPAIGN },
    programme: { mode: "new", name: "Σεπτέμβριος — Hyper Vega" },
    stores,
    includeDuplicateRows: [],
    ...extra,
  };
}

const BASIC = grid([
  ["15/09/2026", "HYPER VEGA Γλυφάδας", "", "10:00-18:00", 2],
  ["16/09/2026", "Hyper Vega - Γλυφάδα", "", "10:00-18:00", 1],
  ["17/09/2026", "Μίνι Μάρκετ Αστέρι", "Ερμού 10", "09:00-13:00", 1],
  ["18/09/2026", "Μίνι Μάρκετ Αστέρι", "", "09:00-13:00", 1],
]);

describe("runImportCommit — the happy path writes in dependency order", () => {
  it("creates the new store, then the programme, then shifts that all carry the programme id", async () => {
    const rows = parse(BASIC);
    const stores = resolutionsFor(rows, (name) => (name.includes("Αστέρι") ? "create" : "existing"));
    const { deps, log } = fakeDeps();

    const result = await runImportCommit(input(rows, stores), deps);

    expect(result.status).toBe("done");
    if (result.status !== "done") return;
    expect(log.writes).toEqual(["store:Μίνι Μάρκετ Αστέρι", "programme", "shifts:4"]);
    expect(result.outcome).toMatchObject({ shiftsCreated: 4, shiftsNotCreated: 0, failedAt: null, programmeCreated: true });
    expect(log.shifts.every((s) => s.programmeId === uuid(400) && s.campaignId === CAMPAIGN)).toBe(true);
    // The blank-address row joined its store through sourceRows, not a per-row key.
    expect(log.shifts.filter((s) => s.storeId === uuid(500))).toHaveLength(2);
    expect(log.shifts.filter((s) => s.storeId === STORE_GLYFADA)).toHaveLength(2);
  });

  it("imports into an existing section without creating one", async () => {
    const rows = parse(BASIC);
    const stores = resolutionsFor(rows, () => "existing");
    const { deps, log } = fakeDeps();
    const result = await runImportCommit(input(rows, stores, { programme: { mode: "existing", programmeId: PROGRAMME } }), deps);
    expect(result.status).toBe("done");
    expect(log.writes).toEqual(["shifts:4"]);
    expect(log.shifts.every((s) => s.programmeId === PROGRAMME)).toBe(true);
  });

  it("creates a new client and campaign first when asked", async () => {
    const rows = parse(BASIC);
    const stores = resolutionsFor(rows, (name) => (name.includes("Αστέρι") ? "create" : "skip"));
    const { deps, log } = fakeDeps({ listKnownStores: async () => [] });
    const campaign = {
      mode: "new" as const,
      client: { mode: "new" as const, name: "Νέος Πελάτης" },
      name: "Φθινόπωρο",
      startsOn: "2026-09-15",
      endsOn: "2026-09-18",
      rateEuros: "6,50",
    };
    // With no known stores the server's grouping still matches the client's — grouping never depends on them.
    const result = await runImportCommit(input(rows, stores, { campaign }), deps);
    expect(result.status).toBe("done");
    expect(log.writes).toEqual(["client", "campaign", "store:Μίνι Μάρκετ Αστέρι", "programme", "shifts:2"]);
  });
});

describe("runImportCommit — the browser's parse is never trusted", () => {
  it("recomputes row issues: a row the client claims is clean but ends before it starts is not created", async () => {
    const rows = parse(BASIC);
    const tampered = rows.map((r, i) => (i === 0 ? { ...r, startTime: "18:00", endTime: "10:00", issues: [] } : r));
    const stores = resolutionsFor(rows, (name) => (name.includes("Αστέρι") ? "create" : "existing"));
    const { deps, log } = fakeDeps();
    const result = await runImportCommit(input(tampered, stores), deps);
    // The row's store group lost a row on the server, so the grouping no longer matches.
    expect(result).toEqual({ status: "error", error: "stores_changed" });
    expect(log.writes).toEqual([]);
  });

  it("refuses a store grouping that differs from the server's own matchStores", async () => {
    const rows = parse(BASIC);
    const stores = resolutionsFor(rows, () => "existing").map((s, i) =>
      i === 1 ? { ...s, sourceRows: s.sourceRows.slice(0, 1) } : s,
    );
    const { deps, log } = fakeDeps();
    expect(await runImportCommit(input(rows, stores), deps)).toEqual({ status: "error", error: "stores_changed" });
    expect(log.writes).toEqual([]);
  });

  it("refuses a missing or an invented store resolution", async () => {
    const rows = parse(BASIC);
    const stores = resolutionsFor(rows, () => "existing");
    const { deps } = fakeDeps();
    expect(await runImportCommit(input(rows, stores.slice(1)), deps)).toMatchObject({ error: "stores_changed" });
    const invented: StoreResolution = { key: "made up", sourceRows: [2], action: "skip" };
    expect(await runImportCommit(input(rows, [...stores, invented]), deps)).toMatchObject({ error: "stores_changed" });
  });

  it("does not find a store id from another agency or another client", async () => {
    const rows = parse(BASIC);
    const stores = resolutionsFor(rows, () => "existing").map((s) =>
      s.action === "existing" ? { ...s, storeId: STORE_FOREIGN } : s,
    );
    const { deps, log } = fakeDeps();
    expect(await runImportCommit(input(rows, stores), deps)).toEqual({ status: "error", error: "store_not_found" });
    expect(log.writes).toEqual([]);
  });

  it("does not find a campaign, or a section of another campaign, or an archived section", async () => {
    const rows = parse(BASIC);
    const stores = resolutionsFor(rows, () => "existing");
    const { deps } = fakeDeps();
    expect(
      await runImportCommit(input(rows, stores, { campaign: { mode: "existing", campaignId: OTHER_CAMPAIGN } }), deps),
    ).toMatchObject({ error: "campaign_not_found" });

    const other = fakeDeps({
      findProgramme: async (id) => ({ id, name: "x", campaignId: OTHER_CAMPAIGN, archived: false }),
    });
    expect(
      await runImportCommit(input(rows, stores, { programme: { mode: "existing", programmeId: PROGRAMME } }), other.deps),
    ).toMatchObject({ error: "programme_not_found" });

    const archived = fakeDeps({
      findProgramme: async (id) => ({ id, name: "x", campaignId: CAMPAIGN, archived: true }),
    });
    expect(
      await runImportCommit(input(rows, stores, { programme: { mode: "existing", programmeId: PROGRAMME } }), archived.deps),
    ).toMatchObject({ error: "programme_archived" });
  });

  it("refuses malformed rows, repeated row numbers, too many rows and a read-only agency", async () => {
    const rows = parse(BASIC);
    const stores = resolutionsFor(rows, () => "existing");
    const { deps } = fakeDeps();

    const badTime = input(rows, stores);
    badTime.rows[0] = { ...badTime.rows[0]!, startTime: "25:00" };
    expect(await runImportCommit(badTime, deps)).toMatchObject({ error: "invalid_payload" });

    const repeated = input(rows, stores);
    repeated.rows[1] = { ...repeated.rows[1]!, sourceRow: repeated.rows[0]!.sourceRow };
    expect(await runImportCommit(repeated, deps)).toMatchObject({ error: "invalid_payload" });

    const many = input(rows, stores);
    many.rows = Array.from({ length: 2001 }, (_, i) => ({ ...many.rows[0]!, sourceRow: i + 2 }));
    expect(await runImportCommit(many, deps)).toMatchObject({ error: "too_many_rows" });

    const readOnly = fakeDeps({ readOnly: true });
    expect(await runImportCommit(input(rows, stores), readOnly.deps)).toMatchObject({ error: "read_only" });
    expect(readOnly.log.writes).toEqual([]);
  });

  it("refuses a 'new' client that already exists", async () => {
    const rows = parse(BASIC);
    const stores = resolutionsFor(rows, () => "skip");
    const { deps, log } = fakeDeps();
    const campaign = {
      mode: "new" as const,
      client: { mode: "new" as const, name: "Υπάρχων Πελάτης" },
      name: "Φθινόπωρο",
      startsOn: "2026-09-15",
      endsOn: "2026-09-18",
      rateEuros: "6",
    };
    expect(await runImportCommit(input(rows, stores, { campaign }), deps)).toMatchObject({ error: "client_exists" });
    expect(log.writes).toEqual([]);
  });
});

describe("runImportCommit — duplicates", () => {
  const DUPES = grid([
    ["15/09/2026", "HYPER VEGA Γλυφάδας", "", "10:00-18:00", 1],
    ["15/09/2026", "Hyper Vega - Γλυφάδα", "", "10:00 - 18:00", 1],
    ["16/09/2026", "Hyper Vega Γλυφάδα", "", "10:00-18:00", 1],
  ]);

  it("re-runs the in-file duplicate check on the server and leaves the copy out by default", async () => {
    const rows = parse(DUPES).map((r) => ({ ...r, issues: [] })); // the client "forgot" to flag it
    const stores = resolutionsFor(rows, () => "existing");
    const { deps, log } = fakeDeps();
    const result = await runImportCommit(input(rows, stores), deps);
    expect(result.status).toBe("done");
    if (result.status !== "done") return;
    expect(result.outcome.shiftsCreated).toBe(2);
    expect(result.outcome.leftOut).toEqual([{ reason: "duplicate_in_file", count: 1 }]);
    expect(log.shifts.map((s) => s.date)).toEqual(["2026-09-15", "2026-09-16"]);
  });

  it("imports an in-file duplicate the coordinator chose to include", async () => {
    const rows = parse(DUPES);
    const stores = resolutionsFor(rows, () => "existing");
    const { deps } = fakeDeps();
    const result = await runImportCommit(input(rows, stores, { includeDuplicateRows: [rows[1]!.sourceRow] }), deps);
    expect(result.status === "done" && result.outcome.shiftsCreated).toBe(3);
  });

  it("leaves out a shift that already exists in the campaign, unless included", async () => {
    const rows = parse(DUPES);
    const stores = resolutionsFor(rows, () => "existing");
    const existing = fakeDeps({ listExistingShiftKeys: async () => [`${STORE_GLYFADA}|2026-09-16|10:00|18:00`] });
    const result = await runImportCommit(input(rows, stores), existing.deps);
    expect(result.status === "done" && result.outcome.leftOut).toEqual([
      { reason: "duplicate_in_file", count: 1 },
      { reason: "duplicate_existing", count: 1 },
    ]);
    expect(existing.log.shifts.map((s) => s.date)).toEqual(["2026-09-15"]);

    const again = fakeDeps({ listExistingShiftKeys: async () => [`${STORE_GLYFADA}|2026-09-16|10:00|18:00`] });
    const included = await runImportCommit(input(rows, stores, { includeDuplicateRows: [rows[2]!.sourceRow] }), again.deps);
    expect(included.status === "done" && included.outcome.shiftsCreated).toBe(2);
  });

  it("says so when every row is a duplicate, and writes nothing", async () => {
    const rows = parse(DUPES).slice(0, 1);
    const stores = resolutionsFor(rows, () => "existing");
    const { deps, log } = fakeDeps({ listExistingShiftKeys: async () => [`${STORE_GLYFADA}|2026-09-15|10:00|18:00`] });
    expect(await runImportCommit(input(rows, stores), deps)).toMatchObject({ error: "nothing_to_import" });
    expect(log.writes).toEqual([]);
  });
});

describe("runImportCommit — failure never leaves shifts outside a section", () => {
  it("geocodes before writing: a store that cannot be placed stops everything, and names the store", async () => {
    const rows = parse(BASIC);
    const stores = resolutionsFor(rows, (name) => (name.includes("Αστέρι") ? "create" : "existing"));
    const { deps, log } = fakeDeps({ geocode: async () => null });
    expect(await runImportCommit(input(rows, stores), deps)).toEqual({
      status: "error",
      error: "geocode_failed",
      details: ["Μίνι Μάρκετ Αστέρι"],
    });
    expect(log.writes).toEqual([]);
  });

  it("a failed programme insert creates no shifts and reports the store it did create", async () => {
    const rows = parse(BASIC);
    const stores = resolutionsFor(rows, (name) => (name.includes("Αστέρι") ? "create" : "existing"));
    const { deps, log } = fakeDeps();
    deps.createProgramme = async () => null;
    const result = await runImportCommit(input(rows, stores), deps);
    expect(result.status).toBe("done");
    if (result.status !== "done") return;
    expect(result.outcome).toMatchObject({
      failedAt: "programme",
      storesCreated: ["Μίνι Μάρκετ Αστέρι"],
      shiftsCreated: 0,
      shiftsNotCreated: 4,
      programmeId: null,
    });
    expect(log.shifts).toEqual([]);
  });

  it("a failed batch stops the rest and reports exactly how many exist, all inside the section", async () => {
    const many = grid(
      Array.from({ length: 450 }, (_, i) => {
        const day = new Date(Date.UTC(2026, 8, 15 + Math.floor(i / 5)));
        const hour = 8 + (i % 5);
        return [
          `${day.getUTCDate()}/${day.getUTCMonth() + 1}/${day.getUTCFullYear()}`,
          "Hyper Vega Γλυφάδα",
          "",
          `${hour}:00-${hour + 1}:00`,
          1,
        ];
      }),
    );
    const rows = parse(many);
    expect(rows.filter((r) => r.issues.length === 0)).toHaveLength(450);
    const stores = resolutionsFor(rows, () => "existing");
    let calls = 0;
    const { deps, log } = fakeDeps();
    const insert = deps.insertShifts;
    deps.insertShifts = async (batch) => (++calls === 2 ? false : insert(batch));

    const result = await runImportCommit(input(rows, stores), deps);
    expect(result.status).toBe("done");
    if (result.status !== "done") return;
    expect(result.outcome).toMatchObject({ failedAt: "shifts", shiftsCreated: 200, shiftsNotCreated: 250 });
    expect(log.writes).toEqual(["programme", "shifts:200"]);
    expect(log.shifts.every((s) => s.programmeId === result.outcome.programmeId)).toBe(true);
  });
});

describe("plan helpers", () => {
  it("counts what the preview headline says", () => {
    const rows = parse(
      grid([
        ["15/09/2026", "Hyper Vega Γλυφάδα", "", "10:00-18:00", 1],
        ["", "Hyper Vega Γλυφάδα", "", "10:00-18:00", 1],
        ["16/09/2026", "Μίνι Μάρκετ Αστέρι", "", "10:00-18:00", 1],
        ["01/09/2026", "Hyper Vega Γλυφάδα", "", "10:00-18:00", 1],
      ]),
    );
    const stores = resolutionsFor(rows, (name) => (name.includes("Αστέρι") ? "skip" : "existing"));
    const planned = planRows({
      rows,
      targets: storeTargetsBySourceRow(stores),
      existingKeys: new Set(),
      includeDuplicateRows: new Set(),
    });
    expect(planned.map((p) => p.status)).toEqual(["ready", "error", "skipped", "warning"]);
    expect(summarisePlan(planned)).toMatchObject({ toCreate: 2, notImported: 2, withWarnings: 1 });
  });

  it("gives a meaning to one column only, and knows what an import needs", () => {
    let mapping = { 0: "date", 1: "store_name", 2: "ignore", 3: "time_range" } as const satisfies Record<number, string>;
    expect(missingRequiredFields(mapping)).toEqual([]);
    const moved = assignColumn(mapping, 2, "date");
    expect(moved).toEqual({ 0: "ignore", 1: "store_name", 2: "date", 3: "time_range" });
    expect(missingRequiredFields(assignColumn(moved, 3, "start_time"))).toEqual(["time"]);
    mapping = { 0: "date", 1: "store_name", 2: "ignore", 3: "time_range" };
    expect(missingRequiredFields({ ...mapping, 1: "ignore" })).toEqual(["store_name"]);
  });

  it("remembers a mapping by header signature, and refuses one that no longer fits", () => {
    const headers = ["ΗΜ/ΝΙΑ", "Σημείο", "Ωράριο"];
    expect(headerSignature(headers)).toBe(headerSignature(["ημ/νια", " σημειο ", "ΩΡΑΡΙΟ"]));
    expect(headerSignature(headers)).not.toBe(headerSignature(["ΗΜ/ΝΙΑ", "Σημείο", "Ώρες"]));
    expect(restoreMapping({ 0: "date", 1: "store_name", 2: "time_range" }, headers)).toEqual({
      0: "date",
      1: "store_name",
      2: "time_range",
    });
    expect(restoreMapping({ 0: "date", 1: "store_name", 7: "time_range" }, headers)).toBeNull();
    expect(restoreMapping({ 0: "date", 1: "bogus", 2: "time_range" }, headers)).toBeNull();
    expect(restoreMapping({ 0: "date", 1: "store_name" }, headers)).toBeNull();
  });
  it("asks the geocoder for the address, then without the street type, then the name — never the city alone", () => {
    expect(geocodeQueries({ name: "Μίνι Μάρκετ Αστέρι", address: "Λεωφόρος Βουλιαγμένης 100", city: "Γλυφάδα" })).toEqual([
      "Λεωφόρος Βουλιαγμένης 100, Γλυφάδα",
      "Βουλιαγμένης 100, Γλυφάδα",
      "Μίνι Μάρκετ Αστέρι, Γλυφάδα",
    ]);
    expect(geocodeQueries({ name: "Hyper Vega Κηφισιά", address: null, city: "Κηφισιά" })).toEqual(["Hyper Vega Κηφισιά, Κηφισιά"]);
  });
});
