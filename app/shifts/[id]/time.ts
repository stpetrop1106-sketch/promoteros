/**
 * Europe/Athens wall-clock arithmetic, with no timezone library — the codebase has none (see
 * `app/c/[token]/page.tsx`'s "the codebase has no timezone" note) and this parcel may not add
 * one to `lib/**`, which it does not own.
 *
 * `shifts.on_date` and `shifts.start_time` are naive local values with no zone of their own —
 * they are written and read as the agency's own wall clock (`agencies.timezone`, currently
 * always `Europe/Athens`). CLAUDE.md's instruction not to "shift a date by constructing a JS
 * `Date` from a bare date string" is about the trap of `new Date("2026-09-09")`, which PARSES
 * AS UTC MIDNIGHT and then prints as the wrong local day/hour everywhere else. We never do that
 * here: `shiftStartAsAthensMs` builds the timestamp from explicit numeric parts via `Date.UTC`,
 * and separately, `nowAsAthensMs` re-expresses the current instant using Athens wall-clock
 * parts via `Intl.DateTimeFormat`. Both sides end up in the same "local time treated as if it
 * were UTC" representation, which is internally consistent for comparison and difference even
 * though neither value is a true UTC instant — we only ever compare the two, never format one
 * of them as a real UTC/ISO timestamp.
 */

const ATHENS_TZ = "Europe/Athens";

/** The current instant's Athens wall-clock time, expressed as milliseconds "as if" UTC. */
export function nowAsAthensMs(): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ATHENS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";

  return Date.UTC(
    Number(get("year")),
    Number(get("month")) - 1,
    Number(get("day")),
    Number(get("hour")),
    Number(get("minute")),
    Number(get("second")),
  );
}

/** A shift's `on_date` ("YYYY-MM-DD") + `start_time`/`end_time` ("HH:MM:SS" or "HH:MM"), in the
 *  same "Athens wall-clock as if UTC" representation as `nowAsAthensMs()`, so the two are safe
 *  to subtract. */
export function athensWallClockMs(onDate: string, timeOfDay: string): number {
  const [y, mo, d] = onDate.split("-").map(Number);
  const [h, mi] = timeOfDay.split(":").map(Number);
  return Date.UTC(y, (mo ?? 1) - 1, d ?? 1, h ?? 0, mi ?? 0, 0);
}

/** Minutes from now until the given Athens wall-clock instant. Negative once it is in the past. */
export function minutesUntil(onDate: string, timeOfDay: string): number {
  return Math.round((athensWallClockMs(onDate, timeOfDay) - nowAsAthensMs()) / 60_000);
}

export function isPastAthens(onDate: string, timeOfDay: string): boolean {
  return athensWallClockMs(onDate, timeOfDay) <= nowAsAthensMs();
}

/** A real `timestamptz` (from `sent_at`, `responded_at`, `cancelled_at`, `checked_in_at`, …) is
 *  an actual UTC instant, unlike the naive `on_date`/`start_time` pair above — this one is safe
 *  to hand straight to `Intl.DateTimeFormat` with an explicit `timeZone`, no trick needed. Used
 *  only for display, e.g. "09/09 14:05". */
export function formatAthens(iso: string): string {
  return new Intl.DateTimeFormat("el-GR", {
    timeZone: ATHENS_TZ,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}
