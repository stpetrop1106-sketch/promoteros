import { z } from "zod";
import type { KnownStore, ParsedRow, StoreMatch } from "@/lib/import/types";
import { validateRow } from "@/lib/import/row-parser";
import { matchStores } from "@/lib/import/store-matching";
import { MAX_IMPORT_ROWS } from "@/lib/import/constants";
import { parseEurosToCents } from "@/app/campaigns/_shared";
import {
  SHIFT_INSERT_BATCH,
  chunk,
  geocodeQueries,
  planRows,
  rowsForStoreMatching,
  storeAddressFor,
  storeTargetsBySourceRow,
  summarisePlan,
  verifyStoreResolutions,
  willCreate,
} from "./plan";
import type { CommitOutcome, CommitResult, CommitStage, StoreResolution } from "./types";

/**
 * P37c — the import commit, with every database and network call injected.
 *
 * `actions.ts` wires `ImportDeps` to the RLS-scoped Supabase client and `getGeocoder()`; the tests
 * wire fakes. That split is what lets `tests/import-commit.test.ts` prove the two properties that
 * matter without a database: the browser's parse is never trusted, and a failure half-way through
 * never leaves shifts no section shows.
 *
 * Order of work, on purpose:
 *   1. read and validate EVERYTHING — payload shape, rows, ids, store grouping, duplicates, and
 *      geocoding for new stores — while nothing has been written, so every refusal writes nothing;
 *   2. then write in dependency order: client → campaign → stores → programme → shifts.
 * Supabase gives no multi-statement transaction to this client, so step 2 can still fail part-way.
 * When it does, the outcome says exactly what exists, and nothing after the failed step runs. Shifts
 * are only ever inserted with the programme's id, after the programme exists — so every created
 * shift is inside a section.
 */

export type ShiftInsert = {
  campaignId: string;
  storeId: string;
  programmeId: string;
  date: string;
  startTime: string;
  endTime: string;
  promotersRequired: number;
};

export type ImportDeps = {
  /** Europe/Athens "YYYY-MM-DD", from the server's clock. */
  today: string;
  readOnly: boolean;
  findCampaign(id: string): Promise<{ id: string; name: string; clientId: string } | null>;
  findClient(id: string): Promise<{ id: string } | null>;
  findClientByName(name: string): Promise<{ id: string } | null>;
  findProgramme(id: string): Promise<{ id: string; name: string; campaignId: string; archived: boolean } | null>;
  /** The stores a shift of this client may use: the client's own and unowned ones. Null on failure. */
  listKnownStores(clientId: string | null): Promise<KnownStore[] | null>;
  /** `existingShiftKey`s already in the campaign for these stores and dates. Null on failure. */
  listExistingShiftKeys(campaignId: string, storeIds: string[], from: string, to: string): Promise<string[] | null>;
  /** An import programme with this name and file was created moments ago — a second submit. */
  hasRecentImport(programmeName: string, filename: string): Promise<boolean>;
  geocode(query: string): Promise<{ lat: number; lng: number } | null>;
  createClient(name: string): Promise<string | null>;
  createCampaign(input: { clientId: string; name: string; startsOn: string; endsOn: string; rateCents: number }): Promise<string | null>;
  createStore(input: {
    clientId: string;
    name: string;
    address: string | null;
    chain: string | null;
    lat: number;
    lng: number;
  }): Promise<string | null>;
  createProgramme(input: { campaignId: string; name: string; filename: string }): Promise<string | null>;
  insertShifts(rows: ShiftInsert[]): Promise<boolean>;
};

// ---------------------------------------------------------------------------------------------
// Payload shape
// ---------------------------------------------------------------------------------------------

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function isRealDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

const text = (max: number) => z.string().max(max).nullable();

const rowSchema = z.object({
  sourceRow: z.number().int().min(1).max(10_000_000),
  date: z.string().refine(isRealDate).nullable(),
  startTime: z.string().regex(TIME_RE).nullable(),
  endTime: z.string().regex(TIME_RE).nullable(),
  storeName: text(1000),
  storeAddress: text(1000),
  city: text(500),
  chain: text(500),
  // `promoters_required` is a smallint with `> 0` (0001_init.sql).
  promotersRequired: z.number().int().min(1).max(32767),
});

const sourceRows = z.array(z.number().int().min(1)).min(1).max(MAX_IMPORT_ROWS);
const resolutionSchema = z.discriminatedUnion("action", [
  z.object({ key: z.string().max(2000), sourceRows, action: z.literal("existing"), storeId: z.string().uuid() }),
  z.object({ key: z.string().max(2000), sourceRows, action: z.literal("create") }),
  z.object({ key: z.string().max(2000), sourceRows, action: z.literal("skip") }),
]);

const clientSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("existing"), clientId: z.string().uuid() }),
  z.object({ mode: z.literal("new"), name: z.string().max(1000) }),
]);

const campaignSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("existing"), campaignId: z.string().uuid() }),
  z.object({
    mode: z.literal("new"),
    client: clientSchema,
    name: z.string().max(1000),
    startsOn: z.string().max(20),
    endsOn: z.string().max(20),
    rateEuros: z.string().max(40),
  }),
]);

const programmeSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("existing"), programmeId: z.string().uuid() }),
  z.object({ mode: z.literal("new"), name: z.string().max(1000) }),
]);

const inputSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  rows: z.array(rowSchema).min(1),
  campaign: campaignSchema,
  programme: programmeSchema,
  stores: z.array(resolutionSchema).max(MAX_IMPORT_ROWS),
  includeDuplicateRows: z.array(z.number().int()).max(MAX_IMPORT_ROWS),
});

function fail(error: Extract<CommitResult, { status: "error" }>["error"], details?: string[]): CommitResult {
  return details ? { status: "error", error, details } : { status: "error", error };
}

// ---------------------------------------------------------------------------------------------
// The commit
// ---------------------------------------------------------------------------------------------

export async function runImportCommit(raw: unknown, deps: ImportDeps): Promise<CommitResult> {
  if (deps.readOnly) return fail("read_only");

  // Size first, before zod walks 50 000 objects someone chose to send.
  if (raw && typeof raw === "object" && Array.isArray((raw as { rows?: unknown }).rows)) {
    if ((raw as { rows: unknown[] }).rows.length > MAX_IMPORT_ROWS) return fail("too_many_rows");
  }
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) return fail("invalid_payload");
  const input = parsed.data;

  const seenRows = new Set<number>();
  for (const row of input.rows) {
    if (seenRows.has(row.sourceRow)) return fail("invalid_payload");
    seenRows.add(row.sourceRow);
  }

  // Every row through the engine's own validation. Whatever issues the browser computed are gone.
  const options = { today: deps.today };
  const rows: ParsedRow[] = input.rows.map((row) => validateRow({ ...row, notes: null, issues: [] }, options));

  // --- Where the shifts go -------------------------------------------------------------------
  let campaignId: string | null = null;
  let campaignName: string;
  let clientId: string | null;
  let newCampaign: { name: string; startsOn: string; endsOn: string; rateCents: number } | null = null;
  let newClientName: string | null = null;

  if (input.campaign.mode === "existing") {
    const campaign = await deps.findCampaign(input.campaign.campaignId);
    if (!campaign) return fail("campaign_not_found");
    campaignId = campaign.id;
    campaignName = campaign.name;
    clientId = campaign.clientId;
  } else {
    const c = input.campaign;
    const name = c.name.trim();
    const rateCents = parseEurosToCents(c.rateEuros);
    if (
      name.length < 2 ||
      name.length > 200 ||
      !isRealDate(c.startsOn) ||
      !isRealDate(c.endsOn) ||
      c.endsOn < c.startsOn ||
      rateCents === null
    ) {
      return fail("campaign_invalid");
    }
    newCampaign = { name, startsOn: c.startsOn, endsOn: c.endsOn, rateCents };
    campaignName = name;

    if (c.client.mode === "existing") {
      const client = await deps.findClient(c.client.clientId);
      if (!client) return fail("client_not_found");
      clientId = client.id;
    } else {
      const clientName = c.client.name.trim();
      if (clientName.length < 2 || clientName.length > 200) return fail("campaign_invalid");
      // A "new" client that already exists would silently change which stores this import may use.
      if (await deps.findClientByName(clientName)) return fail("client_exists");
      newClientName = clientName;
      clientId = null;
    }
  }

  let existingProgramme: { id: string; name: string } | null = null;
  let newProgrammeName: string | null = null;
  if (input.programme.mode === "existing") {
    if (!campaignId) return fail("invalid_payload");
    const programme = await deps.findProgramme(input.programme.programmeId);
    if (!programme || programme.campaignId !== campaignId) return fail("programme_not_found");
    // An archived section is hidden on /shifts — shifts put there would be shifts no section shows.
    if (programme.archived) return fail("programme_archived");
    existingProgramme = { id: programme.id, name: programme.name };
  } else {
    const name = input.programme.name.trim();
    if (name.length < 1 || name.length > 120) return fail("programme_name_invalid");
    newProgrammeName = name;
  }

  // --- Stores: the server groups the rows itself ------------------------------------------------
  const known = await deps.listKnownStores(clientId);
  if (!known) return fail("load_failed");

  const matches = matchStores(rowsForStoreMatching(rows), known);
  const verified = verifyStoreResolutions(matches, input.stores as StoreResolution[]);
  if (!verified.ok) return fail("stores_changed");

  const knownIds = new Set(known.map((s) => s.id));
  for (const { resolution } of verified.pairs) {
    if (resolution.action === "existing" && !knownIds.has(resolution.storeId)) return fail("store_not_found");
  }

  // --- The plan, with duplicates against the database -----------------------------------------
  const targets = storeTargetsBySourceRow(verified.pairs.map((p) => p.resolution));
  const include = new Set(input.includeDuplicateRows);

  let existingKeys = new Set<string>();
  if (campaignId) {
    const firstPass = planRows({ rows, targets, existingKeys, includeDuplicateRows: include });
    const candidates = firstPass.filter((p) => p.store?.kind === "existing" && p.row.date);
    if (candidates.length > 0) {
      const storeIds = [...new Set(candidates.map((p) => (p.store as { storeId: string }).storeId))];
      const dates = candidates.map((p) => p.row.date!);
      const from = dates.reduce((a, b) => (b < a ? b : a));
      const to = dates.reduce((a, b) => (b > a ? b : a));
      const keys = await deps.listExistingShiftKeys(campaignId, storeIds, from, to);
      if (!keys) return fail("load_failed");
      existingKeys = new Set(keys);
    }
  }

  const planned = planRows({ rows, targets, existingKeys, includeDuplicateRows: include });
  const toCreate = planned.filter(willCreate);
  if (toCreate.length === 0) return fail("nothing_to_import");
  const summary = summarisePlan(planned);

  if (newProgrammeName && (await deps.hasRecentImport(newProgrammeName, input.filename))) {
    return fail("already_imported");
  }

  // --- Geocode every store to be created, before writing anything -----------------------------
  const neededKeys = new Set(toCreate.flatMap((p) => (p.store?.kind === "create" ? [p.store.key] : [])));
  const storesToCreate: { match: StoreMatch; lat: number; lng: number }[] = [];
  const notLocated: string[] = [];
  for (const { match, resolution } of verified.pairs) {
    if (resolution.action !== "create" || !neededKeys.has(match.key)) continue;
    let point: { lat: number; lng: number } | null = null;
    for (const query of geocodeQueries(match)) {
      point = await deps.geocode(query);
      if (point) break;
    }
    if (point) storesToCreate.push({ match, ...point });
    else notLocated.push(match.name);
  }
  if (notLocated.length > 0) return fail("geocode_failed", notLocated);

  // --- Writes ------------------------------------------------------------------------------------
  const outcome: CommitOutcome = {
    campaignId: campaignId ?? "",
    campaignName,
    campaignCreated: false,
    clientCreated: false,
    programmeId: existingProgramme?.id ?? null,
    programmeName: existingProgramme?.name ?? newProgrammeName ?? "",
    programmeCreated: false,
    storesCreated: [],
    shiftsCreated: 0,
    shiftsNotCreated: toCreate.length,
    leftOut: summary.leftOut,
    failedAt: null,
  };
  const stop = (stage: CommitStage): CommitResult => ({ status: "done", outcome: { ...outcome, failedAt: stage } });

  if (newClientName) {
    const id = await deps.createClient(newClientName);
    if (!id) return stop("client");
    clientId = id;
    outcome.clientCreated = true;
  }

  if (newCampaign) {
    const id = await deps.createCampaign({ clientId: clientId!, ...newCampaign });
    if (!id) return stop("campaign");
    campaignId = id;
    outcome.campaignId = id;
    outcome.campaignCreated = true;
  }

  const createdStoreIds = new Map<string, string>();
  for (const { match, lat, lng } of storesToCreate) {
    const id = await deps.createStore({
      clientId: clientId!,
      name: match.name.trim().slice(0, 200),
      address: storeAddressFor(match)?.slice(0, 500) ?? null,
      chain: match.chain?.trim().slice(0, 120) || null,
      lat,
      lng,
    });
    if (!id) return stop("store");
    createdStoreIds.set(match.key, id);
    outcome.storesCreated.push(match.name);
  }

  let programmeId = existingProgramme?.id ?? null;
  if (!programmeId) {
    programmeId = await deps.createProgramme({ campaignId: campaignId!, name: newProgrammeName!, filename: input.filename });
    if (!programmeId) return stop("programme");
    outcome.programmeId = programmeId;
    outcome.programmeCreated = true;
  }

  const inserts: ShiftInsert[] = toCreate.map((p) => ({
    campaignId: campaignId!,
    storeId: p.store!.kind === "existing" ? p.store!.storeId : createdStoreIds.get(p.store!.key)!,
    programmeId: programmeId!,
    date: p.row.date!,
    startTime: p.row.startTime!,
    endTime: p.row.endTime!,
    promotersRequired: p.row.promotersRequired,
  }));

  for (const batch of chunk(inserts, SHIFT_INSERT_BATCH)) {
    if (!(await deps.insertShifts(batch))) return stop("shifts");
    outcome.shiftsCreated += batch.length;
    outcome.shiftsNotCreated -= batch.length;
  }

  return { status: "done", outcome };
}
