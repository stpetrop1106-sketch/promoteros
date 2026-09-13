import type { ParsedRow, RowIssueCode } from "@/lib/import/types";

/**
 * P37c — shapes shared by the import wizard (browser) and the commit action (server).
 *
 * Types only, and no `"use server"`: CLAUDE.md's boundary rule. `actions.ts` may export nothing but
 * async functions, so everything a client component needs to name lives here.
 */

// ---------------------------------------------------------------------------------------------
// What the wizard loads once it opens
// ---------------------------------------------------------------------------------------------

export type ImportClientOption = { id: string; name: string };

export type ImportCampaignOption = {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
  startsOn: string;
  endsOn: string;
};

export type ImportProgrammeOption = { id: string; name: string; campaignId: string; archived: boolean };

export type ImportStoreOption = {
  id: string;
  name: string;
  address: string | null;
  chain: string | null;
  clientId: string | null;
};

export type ImportContext = {
  /** Europe/Athens, "YYYY-MM-DD", from the server's clock. */
  today: string;
  /** The agency cannot write (billing). The wizard still reads the file; the commit is refused. */
  readOnly: boolean;
  clients: ImportClientOption[];
  campaigns: ImportCampaignOption[];
  programmes: ImportProgrammeOption[];
  /** True when the sections could not be read (e.g. 0016 not applied yet). Only "new section" is offered. */
  programmesUnavailable: boolean;
  stores: ImportStoreOption[];
};

export type ImportContextResult = { ok: true; context: ImportContext } | { ok: false };

// ---------------------------------------------------------------------------------------------
// The coordinator's decisions, as sent to the server
// ---------------------------------------------------------------------------------------------

/**
 * One decision per DISTINCT store in the file. `key` and `sourceRows` must equal a `StoreMatch` the
 * server computes itself from the submitted rows — the client's grouping is never trusted.
 */
export type StoreResolution =
  | { key: string; sourceRows: number[]; action: "existing"; storeId: string }
  | { key: string; sourceRows: number[]; action: "create" }
  | { key: string; sourceRows: number[]; action: "skip" };

export type ClientChoice = { mode: "existing"; clientId: string } | { mode: "new"; name: string };

export type CampaignChoice =
  | { mode: "existing"; campaignId: string }
  | {
      mode: "new";
      client: ClientChoice;
      name: string;
      startsOn: string;
      endsOn: string;
      /** As typed: "12,50" or "12.50". */
      rateEuros: string;
    };

export type ProgrammeChoice = { mode: "existing"; programmeId: string } | { mode: "new"; name: string };

/**
 * A row as sent to the commit: the parsed values only. `issues` are recomputed by the server, and
 * `notes` has no column on a shift — leaving both out keeps a 2000-row file well under the server
 * action body limit.
 */
export type CommitRow = Omit<ParsedRow, "issues" | "notes">;

export type CommitInput = {
  filename: string;
  rows: CommitRow[];
  campaign: CampaignChoice;
  programme: ProgrammeChoice;
  stores: StoreResolution[];
  /** `sourceRow`s of duplicate rows the coordinator chose to import anyway. */
  includeDuplicateRows: number[];
};

// ---------------------------------------------------------------------------------------------
// The plan — what happens to every row
// ---------------------------------------------------------------------------------------------

export type RowReason = RowIssueCode | "store_skipped" | "duplicate_existing";

/**
 * - `ready`    imported, nothing to say
 * - `warning`  imported, a reason is shown
 * - `error`    not imported: the row itself is broken
 * - `skipped`  not imported: the coordinator chose to skip its store
 * - `excluded` not imported: a duplicate, left out by default
 */
export type RowStatus = "ready" | "warning" | "error" | "skipped" | "excluded";

export type StoreTarget = { kind: "existing"; storeId: string } | { kind: "create"; key: string };

export type PlannedRow = {
  row: ParsedRow;
  status: RowStatus;
  reasons: RowReason[];
  store: StoreTarget | null;
  duplicate: "in_file" | "existing" | null;
};

// ---------------------------------------------------------------------------------------------
// What the commit returns
// ---------------------------------------------------------------------------------------------

export type CommitErrorCode =
  | "read_only"
  | "invalid_payload"
  | "too_many_rows"
  | "campaign_not_found"
  | "client_not_found"
  | "client_exists"
  | "campaign_invalid"
  | "programme_not_found"
  | "programme_archived"
  | "programme_name_invalid"
  | "stores_changed"
  | "store_not_found"
  | "geocode_failed"
  | "nothing_to_import"
  | "already_imported"
  | "load_failed";

export type CommitStage = "client" | "campaign" | "store" | "programme" | "shifts";

export type CommitOutcome = {
  campaignId: string;
  campaignName: string;
  campaignCreated: boolean;
  clientCreated: boolean;
  programmeId: string | null;
  programmeName: string;
  programmeCreated: boolean;
  storesCreated: string[];
  shiftsCreated: number;
  /** Rows that should have become shifts but did not, because a write failed. */
  shiftsNotCreated: number;
  /** Rows left out on purpose, by reason. A row with several reasons counts once, under its first. */
  leftOut: { reason: RowReason; count: number }[];
  /** Null when everything planned was written. Otherwise the step that failed; nothing after it ran. */
  failedAt: CommitStage | null;
};

export type CommitResult =
  | { status: "idle" }
  | { status: "error"; error: CommitErrorCode; details?: string[] }
  | { status: "done"; outcome: CommitOutcome };

export const COMMIT_IDLE: CommitResult = { status: "idle" };

export type GeocodePreview = { ok: true; formattedAddress: string; confidence: "high" | "medium" | "low" } | { ok: false };
