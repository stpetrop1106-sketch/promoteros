/**
 * What a shift pays the person working it.
 *
 * The promoter was being quoted an hourly rate — "Αμοιβή (ανά ώρα): 7,00 €" — and left to do the
 * arithmetic on their phone while deciding whether to give up a Saturday. The number that answers
 * the question they are actually asking is what the *shift* pays, so that is the number the
 * invitation leads with now.
 *
 * Pure, client-safe and deliberately separate from `lib/shift-format.ts`: that module turns values
 * into Greek text, this one does money arithmetic. Everything here is integer cents and integer
 * minutes — no floating point anywhere on the path from the rate to the total, so 7,00 €/h over
 * 7½ hours is exactly 52,50 € and never 52,499999999999996.
 *
 * ## What this deliberately does NOT model
 *
 * **Unpaid breaks.** There is no break column anywhere in the schema (checked across every
 * migration), so paid duration is `end_time - start_time` and nothing else. Inventing a break here
 * would silently underpay people against a number the coordinator never entered.
 *
 * **Overnight shifts.** Neither path that creates a shift permits `end_time <= start_time` — the
 * series form refines on it (`campaigns.validation.time_order`) and the importer rejects the row
 * (`end_before_start`, lib/import/row-parser.ts). So an end at or before the start is bad data, not
 * a shift that runs past midnight, and guessing a wrap to the next day would turn a typo into a
 * twelve-hour pay quote. `null` is returned instead and the caller falls back to the hourly rate.
 */

/** "10:00", "10:00:00" or "10:00:00+03" → minutes since midnight. `null` if it is not a time. */
export function parseTimeToMinutes(time: string | null | undefined): number | null {
  if (!time) return null;
  const match = /^(\d{2}):(\d{2})/.exec(time.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/**
 * Paid minutes between two times of the same day.
 *
 * `null` when either time is unparseable, or when the end is not after the start — see the file
 * comment on why that is treated as bad data rather than an overnight shift.
 */
export function shiftDurationMinutes(
  startTime: string | null | undefined,
  endTime: string | null | undefined,
): number | null {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (start === null || end === null) return null;
  if (end <= start) return null;
  return end - start;
}

/**
 * `rateCents` per hour over `minutes` → the whole-shift total, in cents.
 *
 * Integer throughout: `rateCents * minutes` is an exact integer well inside the safe range (a
 * 1.000 €/h rate over a 24-hour shift is 144.000.000), and the division by 60 is done with an
 * explicit remainder so the half-cent case rounds up rather than however the binary fraction
 * happened to land.
 */
export function payCentsForMinutes(rateCents: number, minutes: number): number | null {
  if (!Number.isInteger(rateCents) || !Number.isInteger(minutes)) return null;
  if (rateCents < 0 || minutes < 0) return null;

  const numerator = rateCents * minutes;
  const whole = Math.floor(numerator / 60);
  const remainder = numerator - whole * 60;
  return remainder * 2 >= 60 ? whole + 1 : whole;
}

/**
 * What this shift pays, in cents.
 *
 * `rateCents` is already the effective rate — `shifts.rate_cents_override ?? campaigns.rate_cents`,
 * resolved by whoever loaded the row (`lib/invitations.ts` does exactly that). `null` means "we
 * cannot state a total": no rate on the campaign at all, or hours that do not make sense. A caller
 * showing money must treat `null` as "say nothing", never as zero.
 */
export function shiftPayCents(
  rateCents: number | null | undefined,
  startTime: string | null | undefined,
  endTime: string | null | undefined,
): number | null {
  if (rateCents === null || rateCents === undefined) return null;
  if (!Number.isFinite(rateCents) || rateCents <= 0) return null;

  const minutes = shiftDurationMinutes(startTime, endTime);
  if (minutes === null || minutes === 0) return null;

  return payCentsForMinutes(Math.round(rateCents), minutes);
}

/**
 * 450 → "7,5", 480 → "8". Greek decimal comma, and no ",0" on a whole number of hours, because
 * "8 ώρες" is what a person says and "8,0 ώρες" is what a database says.
 */
export function formatShiftHours(minutes: number | null | undefined): string | null {
  if (minutes === null || minutes === undefined) return null;
  if (!Number.isInteger(minutes) || minutes <= 0) return null;

  const hours = minutes / 60;
  return new Intl.NumberFormat("el-GR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(hours);
}
