/**
 * P30 — the promoter's own availability link.
 *
 * PURE ON PURPOSE, like `lib/retention.ts`: no Supabase, no network, no `server-only`. The clock
 * and the locale are always parameters with a default, so every rule below is unit-testable
 * (`tests/availability-links.test.ts`). The database work lives in `app/a/[token]/data.ts`.
 *
 * ---------------------------------------------------------------------------
 * WHY THE TTL IS WEEKS AND NOT HOURS
 * ---------------------------------------------------------------------------
 * An invitation token (`lib/invitations.ts`, 24h) concerns exactly one shift: it is minted,
 * answered, and dead. An availability link is the opposite kind of object — the promoter keeps it
 * in their chat history and comes back to it whenever their month changes. A 24-hour link would
 * mean the coordinator re-sends a link every time someone wants to update a day, which is the
 * manual work `product-spec.md` §2 exists to remove.
 *
 * 56 days — eight weeks, exactly four of the two-week windows the page renders. Long enough that a
 * promoter who declares in September is still using the same link in October; short enough that an
 * anonymous, unrevokable credential dies on its own within two months, so a link forwarded to the
 * wrong chat stops working without anybody having to notice. Re-issuing is one tap for the
 * coordinator (`app/promoters/[id]/availability-link.tsx`), and an expired link says so and says
 * what to do about it rather than showing a dead page.
 *
 * There is NO stored `token_hash` for these links, unlike invitations — that would need a column
 * and this parcel adds no migration. The consequence is honest and written down: an availability
 * link cannot be revoked early, only out-waited (or cut off by archiving the promoter, which the
 * loader checks). See `docs/status/P30.md`.
 *
 * ---------------------------------------------------------------------------
 * WHY THE RECORD ID IS NAMESPACED
 * ---------------------------------------------------------------------------
 * `TokenPurpose` in `lib/tokens.ts` is `"invitation" | "checkin"`, and `lib/tokens.ts` is not this
 * parcel's file to widen. Rather than inventing a second signing scheme (explicitly not wanted),
 * we reuse `mintToken`/`verifyToken` unchanged and carry the purpose in the signed record id:
 * `availability:<promoter uuid>`. The HMAC covers the payload, so the prefix cannot be forged or
 * stripped, and the checks compose:
 *
 *   - an invitation token presented at `/a/[token]` carries a bare uuid → rejected, `wrong_purpose`
 *   - an availability token presented at `/i/[token]` or `/c/[token]` resolves to a record id that
 *     is not a uuid, so the lookup finds nothing and those pages return `not_found`
 *
 * When someone owns `lib/tokens.ts` again, adding `"availability"` to `TokenPurpose` lets this
 * prefix be deleted with no change to anything else. Requested in `docs/status/P30.md`.
 */

import { mintToken, verifyToken } from "@/lib/tokens";

export const AVAILABILITY_TTL_DAYS = 56;
export const AVAILABILITY_TTL_SECONDS = AVAILABILITY_TTL_DAYS * 24 * 60 * 60;

/** The purpose we piggyback on. See the header. */
const CARRIER_PURPOSE = "invitation" as const;
const RECORD_PREFIX = "availability:";

export const ATHENS_TZ = "Europe/Athens";

/** The window the promoter sets. Two weeks is what a promoter can actually hold in their head. */
export const GRID_DAYS = 14;

// ---------------------------------------------------------------------------
// Token
// ---------------------------------------------------------------------------

export function mintAvailabilityToken(
  promoterId: string,
  ttlSeconds: number = AVAILABILITY_TTL_SECONDS,
): { token: string; expiresAt: Date } {
  const { token, expiresAt } = mintToken(
    CARRIER_PURPOSE,
    `${RECORD_PREFIX}${promoterId}`,
    ttlSeconds,
  );
  return { token, expiresAt };
}

export type AvailabilityTokenResult =
  | { ok: true; promoterId: string }
  | { ok: false; reason: "malformed" | "bad_signature" | "expired" | "wrong_purpose" };

export function verifyAvailabilityToken(token: string): AvailabilityTokenResult {
  const verified = verifyToken(token, CARRIER_PURPOSE);
  if (!verified.ok) return { ok: false, reason: verified.reason };

  if (!verified.recordId.startsWith(RECORD_PREFIX)) {
    // A perfectly valid invitation token. Correct signature, wrong kind of link.
    return { ok: false, reason: "wrong_purpose" };
  }

  const promoterId = verified.recordId.slice(RECORD_PREFIX.length);
  if (promoterId.length === 0) return { ok: false, reason: "malformed" };

  return { ok: true, promoterId };
}

/**
 * `/a/` for availability, matching `/i/` for invitation and `/c/` for check-in.
 * `linkFor()` in `lib/tokens.ts` only knows those two paths and is not ours to extend.
 */
export function availabilityLinkFor(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base}/a/${token}`;
}

// ---------------------------------------------------------------------------
// Dates — Europe/Athens, never a JS Date built from a bare date string
// ---------------------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Today, as the agency's wall clock sees it. `availability.on_date` is a naive `date`: it means
 * "Tuesday the 15th in Athens", not an instant. Taking `new Date().toISOString()` would hand a
 * promoter tapping at 01:30 Athens time (22:30 UTC the day before) a grid starting yesterday.
 */
export function athensToday(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ATHENS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-");
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  const utc = new Date(Date.UTC(year, month - 1, day));
  return (
    utc.getUTCFullYear() === year &&
    utc.getUTCMonth() === month - 1 &&
    utc.getUTCDate() === day
  );
}

/**
 * Whole-day arithmetic over UTC midnights. Athens' DST transitions never land on a UTC midnight,
 * so adding 86 400 000 ms always lands on the next calendar day — which is the trap CLAUDE.md
 * warns about, avoided by never parsing the string as a local instant.
 */
export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-");
  const start = Date.UTC(Number(y), Number(m) - 1, Number(d));
  const next = new Date(start + days * 86_400_000);
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

/** The dates the page renders, and the only dates a save is allowed to touch. */
export function gridDates(startIso: string, days: number = GRID_DAYS): string[] {
  return Array.from({ length: days }, (_, i) => addDaysIso(startIso, i));
}

/** Safe to format: built from explicit numeric parts, read back as UTC. */
export function isoAsUtcDate(iso: string): Date {
  const [y, m, d] = iso.split("-");
  return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
}

// ---------------------------------------------------------------------------
// Times
// ---------------------------------------------------------------------------

/** Hourly is the granularity promoters actually speak in ("after five"). */
export const START_TIMES: readonly string[] = Array.from({ length: 17 }, (_, i) => `${pad(i + 6)}:00`);
export const END_TIMES: readonly string[] = Array.from({ length: 16 }, (_, i) => `${pad(i + 8)}:00`);

export function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/** `time` columns come back as "HH:MM:SS"; the UI speaks "HH:MM". */
export function toDisplayTime(value: string | null): string | null {
  return value === null ? null : value.slice(0, 5);
}

export function toDbTime(value: string): string {
  return `${value}:00`;
}

// ---------------------------------------------------------------------------
// A day's state
// ---------------------------------------------------------------------------

export type DayChoice = "available" | "unavailable" | "partial" | "clear";
export type AvailabilitySource = "self" | "coordinator" | "inferred";

export type AvailabilityRow = {
  status: "available" | "unavailable";
  from_time: string | null;
  to_time: string | null;
  source: AvailabilitySource;
};

/** What one row of the grid shows. Nothing here is agency data. */
export type DayState = {
  choice: Exclude<DayChoice, "clear"> | "clear";
  fromTime: string | null;
  toTime: string | null;
  source: AvailabilitySource | null;
  /** More than one row on this date — a contradiction we inherited, never one we can create. */
  contradictory: boolean;
};

export const EMPTY_DAY: DayState = {
  choice: "clear",
  fromTime: null,
  toTime: null,
  source: null,
  contradictory: false,
};

/**
 * Collapse whatever rows exist for one date into the single state the promoter sees.
 *
 * The unique key is `(promoter_id, on_date, from_time)`, so the table CAN hold a whole-day
 * `available` row and a partial `unavailable` row on the same date — `0005_matching_fixes.sql`
 * FIX 2 exists precisely because the matching engine has to resolve that. A promoter must never
 * be shown "you are both available and not available"; we show the whole-day row if there is one,
 * flag the date, and let the next save replace the lot.
 */
export function summariseDay(rows: readonly AvailabilityRow[]): DayState {
  if (rows.length === 0) return EMPTY_DAY;

  const wholeDay = rows.find((r) => r.from_time === null && r.to_time === null);
  const chosen = wholeDay ?? rows[0];
  if (!chosen) return EMPTY_DAY;

  const fromTime = toDisplayTime(chosen.from_time);
  const toTime = toDisplayTime(chosen.to_time);
  const isWholeDay = fromTime === null && toTime === null;

  return {
    choice: isWholeDay ? chosen.status : chosen.status === "available" ? "partial" : "unavailable",
    fromTime,
    toTime,
    source: chosen.source,
    contradictory: rows.length > 1,
  };
}

export type RowPlan =
  | { ok: true; row: null }
  | { ok: true; row: { status: "available" | "unavailable"; from_time: string | null; to_time: string | null } }
  | { ok: false; reason: "bad_choice" | "bad_time" | "bad_range" };

/**
 * One choice in, AT MOST ONE ROW out. This is the whole contradiction guarantee: the save action
 * deletes the date's rows and then writes this single row, so a date can never again hold two
 * statements about itself.
 *
 * A partial day is modelled as an `available` window rather than an `unavailable` one, because
 * that is the shape the matching filter reads: `from_time <= shift.start_time` and
 * `to_time >= shift.end_time` (`0007_match_radius.sql`). "Available after 17:00" with no end is
 * `from_time = 17:00, to_time = null`, and null already means "no bound on that side".
 */
export function planRow(choice: string, fromTime?: string | null, toTime?: string | null): RowPlan {
  switch (choice) {
    case "clear":
      return { ok: true, row: null };

    case "available":
      return { ok: true, row: { status: "available", from_time: null, to_time: null } };

    case "unavailable":
      return { ok: true, row: { status: "unavailable", from_time: null, to_time: null } };

    case "partial": {
      if (!fromTime || !isValidTime(fromTime)) return { ok: false, reason: "bad_time" };
      if (toTime !== null && toTime !== undefined && toTime !== "") {
        if (!isValidTime(toTime)) return { ok: false, reason: "bad_time" };
        if (toTime <= fromTime) return { ok: false, reason: "bad_range" };
        return {
          ok: true,
          row: { status: "available", from_time: toDbTime(fromTime), to_time: toDbTime(toTime) },
        };
      }
      return {
        ok: true,
        row: { status: "available", from_time: toDbTime(fromTime), to_time: null },
      };
    }

    default:
      return { ok: false, reason: "bad_choice" };
  }
}
