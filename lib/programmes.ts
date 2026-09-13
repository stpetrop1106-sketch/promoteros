import type { createServerSupabase } from "@/lib/supabase/server";

/**
 * P37a — shift sections ("ενότητες" of the Shifts screen).
 *
 * An agency's clients each send their own schedules — a September programme for six stores from
 * one brand, a weekend roadshow from another — and the coordinator thinks in those programmes,
 * not in one flat list of hundreds of shifts. `shift_programmes` (0016_shift_programmes.sql) is
 * that unit: a named group of shifts inside one campaign.
 *
 * Same split as `lib/exceptions.ts`: the mapping, aggregation, sorting and filtering below are
 * pure functions over plain camelCase data, so `tests/programmes.test.ts` exercises the whole
 * board without a database. Only `fetchProgrammeBoard` and the three writers at the bottom touch
 * Supabase, and always through the RLS-scoped client (CLAUDE.md §4) — never the admin client, and
 * never an `agency_id` filter on a select, because the tenant policy from `0002_rls.sql` already
 * supplies it.
 *
 * No `server-only` marker and no runtime import of `lib/supabase/server`, on purpose, for the
 * same reason `lib/exceptions.ts` states one: `createServerSupabase` is only ever used here in a
 * `typeof` type position (`import type`, erased at compile time), because every DB-touching
 * function below takes an already-created client as a parameter instead of creating its own. That
 * is what lets `tests/programmes.test.ts` import this module under plain Node without dragging in
 * `next/headers` or the `server-only` package, which throws unconditionally outside a Server
 * Component. This module holds no secret itself — the secret is in the client its callers pass in.
 *
 * 0016 is not applied to the cloud database yet (docs/round-2-plan.md's migration registry), so
 * the functions below have not been run against a real database. See docs/status/P37a.md for
 * exactly what was and was not exercised.
 */

export type ProgrammeSource = "manual" | "import";

// ---------------------------------------------------------------------------------------------
// Input shapes — camelCase, mapped from snake_case at the data-access boundary below
// ---------------------------------------------------------------------------------------------

export type ProgrammeInput = {
  id: string;
  campaignId: string;
  campaignName: string;
  clientName: string | null;
  name: string;
  source: ProgrammeSource;
  sourceFilename: string | null;
  archivedAt: string | null;
  createdAt: string;
};

export type ProgrammeShiftInput = {
  id: string;
  programmeId: string | null;
  campaignId: string;
  campaignName: string;
  clientName: string | null;
  storeName: string | null;
  onDate: string; // "YYYY-MM-DD"
  startTime: string; // "HH:MM" or "HH:MM:SS"
  endTime: string;
  promotersRequired: number;
  status: string; // shift_status: open | partially_filled | filled | completed | cancelled
  /** Assignments already confirmed or completed, capped at `promotersRequired`. */
  confirmedCount: number;
};

// ---------------------------------------------------------------------------------------------
// Output shapes
// ---------------------------------------------------------------------------------------------

export type ProgrammeSummary = {
  id: string;
  name: string;
  campaignId: string;
  campaignName: string;
  clientName: string | null;
  source: ProgrammeSource;
  sourceFilename: string | null;
  archived: boolean;
  shiftCount: number;
  requiredTotal: number;
  confirmedTotal: number;
  /** Shifts (not cancelled) that still need at least one more person. */
  openShiftCount: number;
  fromDate: string | null;
  toDate: string | null;
  /** Soonest not-cancelled shift on or after `today`. Null when the section has none. */
  nextShiftDate: string | null;
  shifts: ProgrammeShiftInput[];
};

export type UnsectionedGroup = {
  shifts: ProgrammeShiftInput[];
  fromDate: string | null;
  toDate: string | null;
  nextShiftDate: string | null;
};

function isCancelled(status: string): boolean {
  return status === "cancelled";
}

function minDate(dates: string[]): string {
  return dates.reduce((a, b) => (b < a ? b : a));
}

function maxDate(dates: string[]): string {
  return dates.reduce((a, b) => (b > a ? b : a));
}

function dateRangeOf(shifts: ProgrammeShiftInput[]): { fromDate: string | null; toDate: string | null } {
  const dates = shifts.filter((s) => !isCancelled(s.status)).map((s) => s.onDate);
  if (dates.length === 0) return { fromDate: null, toDate: null };
  return { fromDate: minDate(dates), toDate: maxDate(dates) };
}

function nextShiftDateOf(shifts: ProgrammeShiftInput[], today: string): string | null {
  const upcoming = shifts.filter((s) => !isCancelled(s.status) && s.onDate >= today).map((s) => s.onDate);
  return upcoming.length === 0 ? null : minDate(upcoming);
}

/**
 * Groups the flat shift list by `programmeId` and folds each group's coverage — the one place the
 * two queries in `fetchProgrammeBoard` meet.
 */
export function buildProgrammeSummaries(
  programmes: ProgrammeInput[],
  shifts: ProgrammeShiftInput[],
  today: string,
): ProgrammeSummary[] {
  const byProgramme = new Map<string, ProgrammeShiftInput[]>();
  for (const shift of shifts) {
    if (!shift.programmeId) continue;
    const bucket = byProgramme.get(shift.programmeId);
    if (bucket) bucket.push(shift);
    else byProgramme.set(shift.programmeId, [shift]);
  }

  return programmes.map((programme) => {
    const own = (byProgramme.get(programme.id) ?? [])
      .slice()
      .sort((a, b) => a.onDate.localeCompare(b.onDate));
    const nonCancelled = own.filter((s) => !isCancelled(s.status));
    const { fromDate, toDate } = dateRangeOf(own);

    return {
      id: programme.id,
      name: programme.name,
      campaignId: programme.campaignId,
      campaignName: programme.campaignName,
      clientName: programme.clientName,
      source: programme.source,
      sourceFilename: programme.sourceFilename,
      archived: programme.archivedAt !== null,
      shiftCount: own.length,
      requiredTotal: nonCancelled.reduce((sum, s) => sum + s.promotersRequired, 0),
      confirmedTotal: nonCancelled.reduce((sum, s) => sum + s.confirmedCount, 0),
      openShiftCount: nonCancelled.filter((s) => s.confirmedCount < s.promotersRequired).length,
      fromDate,
      toDate,
      nextShiftDate: nextShiftDateOf(own, today),
      shifts: own,
    };
  });
}

/**
 * The shifts no section claimed — possible for anything created outside the section flows.
 * Rendered as one flat "Χωρίς ενότητα" bucket rather than grouped, since these are the exception,
 * not a second kind of section.
 */
export function buildUnsectionedGroup(shifts: ProgrammeShiftInput[], today: string): UnsectionedGroup {
  const own = shifts
    .filter((s) => !s.programmeId)
    .slice()
    .sort((a, b) => a.onDate.localeCompare(b.onDate));
  const { fromDate, toDate } = dateRangeOf(own);
  return { shifts: own, fromDate, toDate, nextShiftDate: nextShiftDateOf(own, today) };
}

// ---------------------------------------------------------------------------------------------
// Ordering — soonest upcoming shift first. A section whose shifts are all past sinks, but a new,
// empty section (waiting for its first shift) stays near the top: it needs attention too, just of
// a different kind, and sinking it with finished work would bury the thing the coordinator most
// needs to notice — that some sections were made and never filled in.
// ---------------------------------------------------------------------------------------------

function rank(s: Pick<ProgrammeSummary, "nextShiftDate" | "shiftCount">): 0 | 1 | 2 {
  if (s.nextShiftDate) return 0;
  if (s.shiftCount === 0) return 1;
  return 2;
}

export function sortProgrammeSummaries(list: ProgrammeSummary[]): ProgrammeSummary[] {
  return [...list].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    if (ra === 0) {
      return a.nextShiftDate!.localeCompare(b.nextShiftDate!) || a.name.localeCompare(b.name, "el");
    }
    if (ra === 2) {
      return (b.toDate ?? "").localeCompare(a.toDate ?? "") || a.name.localeCompare(b.name, "el");
    }
    return a.name.localeCompare(b.name, "el");
  });
}

// ---------------------------------------------------------------------------------------------
// Filters — kept in the URL by the page (`?client=&campaign=&when=&archived=`), applied here so
// the rule lives in one, tested place rather than in JSX.
// ---------------------------------------------------------------------------------------------

export type ProgrammeWhenFilter = "all" | "upcoming" | "past";

export type ProgrammeFilters = {
  clientName: string | null;
  campaignId: string | null;
  when: ProgrammeWhenFilter;
  showArchived: boolean;
};

export const DEFAULT_PROGRAMME_FILTERS: ProgrammeFilters = {
  clientName: null,
  campaignId: null,
  when: "all",
  showArchived: false,
};

function isPastOnly(s: Pick<ProgrammeSummary, "nextShiftDate" | "shiftCount">): boolean {
  return s.shiftCount > 0 && !s.nextShiftDate;
}

function matchesWhen(s: Pick<ProgrammeSummary, "nextShiftDate" | "shiftCount">, when: ProgrammeWhenFilter): boolean {
  if (when === "all") return true;
  return when === "past" ? isPastOnly(s) : !isPastOnly(s);
}

export function filterProgrammeSummaries(list: ProgrammeSummary[], filters: ProgrammeFilters): ProgrammeSummary[] {
  return list.filter((s) => {
    if (!filters.showArchived && s.archived) return false;
    if (filters.clientName && s.clientName !== filters.clientName) return false;
    if (filters.campaignId && s.campaignId !== filters.campaignId) return false;
    if (!matchesWhen(s, filters.when)) return false;
    return true;
  });
}

/**
 * Same client/campaign/when axes as `filterProgrammeSummaries`, for the one bucket with no
 * `archived` of its own. `when` is evaluated for the bucket as a whole rather than shift-by-shift:
 * a client or campaign filter narrows which shifts show, but "upcoming"/"past" describes the
 * bucket's overall state, the same as it does for a named section.
 */
export function filterUnsectionedGroup(
  group: UnsectionedGroup,
  filters: Pick<ProgrammeFilters, "clientName" | "campaignId" | "when">,
  today: string,
): UnsectionedGroup {
  let shifts = group.shifts.filter((s) => {
    if (filters.clientName && s.clientName !== filters.clientName) return false;
    if (filters.campaignId && s.campaignId !== filters.campaignId) return false;
    return true;
  });

  if (filters.when !== "all") {
    const nextShiftDate = nextShiftDateOf(shifts, today);
    const past = isPastOnly({ nextShiftDate, shiftCount: shifts.length });
    if ((filters.when === "past") !== past) shifts = [];
  }

  const { fromDate, toDate } = dateRangeOf(shifts);
  return { shifts, fromDate, toDate, nextShiftDate: nextShiftDateOf(shifts, today) };
}

// ---------------------------------------------------------------------------------------------
// Filter dropdown options
// ---------------------------------------------------------------------------------------------

export type FilterOption = { value: string; label: string };

/** Every campaign that has a section, for the campaign filter — deduplicated, alphabetical. */
export function campaignOptionsFrom(programmes: ProgrammeInput[]): FilterOption[] {
  const seen = new Map<string, string>();
  for (const p of programmes) if (!seen.has(p.campaignId)) seen.set(p.campaignId, p.campaignName);
  return [...seen.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "el"));
}

/** Every client with a section, for the client filter. Value and label are the same string:
 * clients have no stable id on this page's data, and `clients.name` is unique per agency. */
export function clientOptionsFrom(programmes: ProgrammeInput[]): FilterOption[] {
  const seen = new Set<string>();
  for (const p of programmes) if (p.clientName) seen.add(p.clientName);
  return [...seen].sort((a, b) => a.localeCompare(b, "el")).map((name) => ({ value: name, label: name }));
}

// ---------------------------------------------------------------------------------------------
// Data access — the only part that touches Supabase. RLS-scoped client only.
// ---------------------------------------------------------------------------------------------

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabase>>;

type ProgrammeRow = {
  id: string;
  campaign_id: string;
  name: string;
  source: ProgrammeSource;
  source_filename: string | null;
  archived_at: string | null;
  created_at: string;
  campaigns: { name: string; clients: { name: string } | null } | null;
};

type ShiftRow = {
  id: string;
  programme_id: string | null;
  campaign_id: string;
  on_date: string;
  start_time: string;
  end_time: string;
  promoters_required: number;
  status: string;
  stores: { name: string } | null;
  campaigns: { name: string; clients: { name: string } | null } | null;
  assignments: { status: string }[];
};

const COVERING_ASSIGNMENT_STATUSES = new Set(["confirmed", "completed"]);

function confirmedCountOf(assignments: { status: string }[], required: number): number {
  const confirmed = assignments.filter((a) => COVERING_ASSIGNMENT_STATUSES.has(a.status)).length;
  return Math.min(confirmed, required);
}

/** A hard ceiling so one very busy agency cannot turn the board into an unbounded query —
 * mirrors `app/dashboard/page.tsx`'s `MAX_SHIFTS`. */
const MAX_SHIFTS = 2000;

/**
 * Everything the Shifts screen needs, in two queries no matter how many sections exist: one for
 * the sections themselves (with their campaign and client names joined in), one for every shift
 * (with its store, campaign/client names, and the assignments behind its coverage count). The
 * grouping and every number after that — coverage, date ranges, next-shift, ordering — is done in
 * TypeScript by the pure functions above, the same split `app/dashboard/page.tsx` uses for
 * exceptions.
 */
export async function fetchProgrammeBoard(
  db: SupabaseClient,
): Promise<{ programmes: ProgrammeInput[]; shifts: ProgrammeShiftInput[] }> {
  const [{ data: programmeRows, error: programmeError }, { data: shiftRows, error: shiftError }] =
    await Promise.all([
      db
        .from("shift_programmes")
        .select(
          "id, campaign_id, name, source, source_filename, archived_at, created_at, campaigns(name, clients(name))",
        )
        .order("created_at", { ascending: true }),
      db
        .from("shifts")
        .select(
          "id, programme_id, campaign_id, on_date, start_time, end_time, promoters_required, status, stores(name), campaigns(name, clients(name)), assignments(status)",
        )
        .order("on_date", { ascending: true })
        .limit(MAX_SHIFTS),
    ]);

  if (programmeError) throw new Error(programmeError.message);
  if (shiftError) throw new Error(shiftError.message);

  const programmes: ProgrammeInput[] = ((programmeRows ?? []) as unknown as ProgrammeRow[]).map((r) => ({
    id: r.id,
    campaignId: r.campaign_id,
    campaignName: r.campaigns?.name ?? "—",
    clientName: r.campaigns?.clients?.name ?? null,
    name: r.name,
    source: r.source,
    sourceFilename: r.source_filename,
    archivedAt: r.archived_at,
    createdAt: r.created_at,
  }));

  const shifts: ProgrammeShiftInput[] = ((shiftRows ?? []) as unknown as ShiftRow[]).map((r) => ({
    id: r.id,
    programmeId: r.programme_id,
    campaignId: r.campaign_id,
    campaignName: r.campaigns?.name ?? "—",
    clientName: r.campaigns?.clients?.name ?? null,
    storeName: r.stores?.name ?? null,
    onDate: r.on_date,
    startTime: r.start_time,
    endTime: r.end_time,
    promotersRequired: r.promoters_required,
    status: r.status,
    confirmedCount: confirmedCountOf(r.assignments ?? [], r.promoters_required),
  }));

  return { programmes, shifts };
}

export type ProgrammeWriteResult =
  | { ok: true; id: string }
  | { ok: false; error: "invalid" | "save_failed" };

export type CreateProgrammeInput = {
  agencyId: string;
  campaignId: string;
  name: string;
  source?: ProgrammeSource;
  sourceFilename?: string | null;
};

/**
 * Creates a section inside one campaign. The campaign id is re-verified through the RLS-scoped
 * client before the insert — the same rule every mutating action in this codebase follows for an
 * id that travelled through a form (see `app/campaigns/[id]/shifts/new/actions.ts`).
 */
export async function createProgramme(db: SupabaseClient, input: CreateProgrammeInput): Promise<ProgrammeWriteResult> {
  const name = input.name.trim();
  if (name.length < 1 || name.length > 120) return { ok: false, error: "invalid" };

  const { data: campaign } = await db.from("campaigns").select("id").eq("id", input.campaignId).maybeSingle();
  if (!campaign) return { ok: false, error: "invalid" };

  const { data, error } = await db
    .from("shift_programmes")
    .insert({
      agency_id: input.agencyId,
      campaign_id: input.campaignId,
      name,
      source: input.source ?? "manual",
      source_filename: input.sourceFilename ?? null,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: "save_failed" };
  return { ok: true, id: data.id };
}

export async function renameProgramme(db: SupabaseClient, id: string, name: string): Promise<ProgrammeWriteResult> {
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 120) return { ok: false, error: "invalid" };

  const { error } = await db.from("shift_programmes").update({ name: trimmed }).eq("id", id);
  if (error) return { ok: false, error: "save_failed" };
  return { ok: true, id };
}

/** Archiving hides a section from the board; it never touches the shifts inside it. */
export async function setProgrammeArchived(
  db: SupabaseClient,
  id: string,
  archived: boolean,
): Promise<ProgrammeWriteResult> {
  const { error } = await db
    .from("shift_programmes")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return { ok: false, error: "save_failed" };
  return { ok: true, id };
}

export type CampaignProgrammeOption = { id: string; name: string; createdAt: string };

/** Non-archived sections of one campaign, newest first — the picker on the "add shifts" form. */
export async function listCampaignProgrammes(
  db: SupabaseClient,
  campaignId: string,
): Promise<CampaignProgrammeOption[]> {
  const { data, error } = await db
    .from("shift_programmes")
    .select("id, name, created_at")
    .eq("campaign_id", campaignId)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ id: r.id, name: r.name, createdAt: r.created_at }));
}
