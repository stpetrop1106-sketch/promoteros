/**
 * How a shift's date, hours and pay read to a person — on the promoter's phone first of all.
 *
 * The promoter pages printed the raw database values: "2026-09-15 · 10:00–20:00" and "€ 38.00".
 * Correct, and exactly what a system shows when nobody has thought about the person reading it.
 * A promoter deciding whether to accept wants the weekday more than anything else.
 *
 * Pure and client-safe. `on_date` is a naive calendar date (Europe/Athens), so it is turned into a
 * Date at UTC midnight and formatted in UTC — never through the device's own time zone, which is
 * how a Tuesday becomes a Monday on a phone set to another zone.
 */

const LOCALE = "el-GR";

/** "2026-09-15" → "Τρίτη 15 Σεπτεμβρίου". Unparseable input is returned unchanged. */
export function formatShiftDate(onDate: string, options: { withYear?: boolean } = {}): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(onDate);
  if (!match) return onDate;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(options.withYear ? { year: "numeric" } : {}),
  }).format(date);
}

/** "10:00:00" or "10:00" → "10:00". */
export function formatShiftTime(time: string): string {
  return /^\d{2}:\d{2}/.test(time) ? time.slice(0, 5) : time;
}

/** "Τρίτη 15 Σεπτεμβρίου · 10:00–20:00" */
export function formatShiftWhen(onDate: string, startTime: string, endTime: string): string {
  return `${formatShiftDate(onDate)} · ${formatShiftTime(startTime)}–${formatShiftTime(endTime)}`;
}

/** 3800 → "38,00 €" — Greek decimal comma, symbol after the amount. */
export function formatEuroCents(cents: number): string {
  return new Intl.NumberFormat(LOCALE, { style: "currency", currency: "EUR" }).format(cents / 100);
}
