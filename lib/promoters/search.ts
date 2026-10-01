/**
 * S1 — the promoter search box, on the database.
 *
 * PURE and client-safe: no `server-only`, no database, no network. Everything here is the query
 * half of `supabase/migrations/0021_promoter_search.sql`; the column half lives there.
 *
 * ---------------------------------------------------------------------------------------------
 * THE BUG THIS EXISTS FOR
 * ---------------------------------------------------------------------------------------------
 * `full_name.ilike.%q%` is case-insensitive but not accent-insensitive. Measured against the real
 * roster before 0021:
 *
 *     '%ΣΤΕΛΛΑ%' -> 1 row      '%Στέλλα%' -> 0 rows
 *     '%μαρια%'  -> 1 row      '%Μαρία%'  -> 3 rows
 *     '%Maria%'  -> 0 rows
 *
 * A coordinator who types the accents a Greek name actually has, on a roster typed without them
 * (or the reverse), gets "no promoters found" for someone sitting in the table. Both spellings now
 * normalise to the same thing before they ever meet.
 *
 * ---------------------------------------------------------------------------------------------
 * THE TWO HALVES MUST AGREE
 * ---------------------------------------------------------------------------------------------
 * `normaliseSearchText` mirrors the SQL of `promoters.search_name`, and `toLatin` mirrors
 * `public.greek_to_latin`. If they ever disagree about one letter, search silently misses rows —
 * there is no error to notice. `scripts/verify-promoter-search.ts` proves they agree by reading
 * every stored value back out of the live table and recomputing it here.
 */

import { stripDiacritics } from "@/lib/import/text";

/**
 * PostgREST's `or=` takes a comma-separated list inside parentheses, so a comma, a bracket or a
 * quote in the search box would change the SHAPE of the filter rather than be searched for. Strip
 * those, and `%`/`_`, which are `ilike` wildcards. Inherited unchanged from the original
 * `searchPattern` in app/promoters/page.tsx — that guard is the reason this is safe to interpolate,
 * and it matters MORE now than it did then: the expression this builds is nested, so a stray
 * bracket would not merely widen the search, it would change which columns are being compared.
 */
const UNSAFE = /[,()"'%_*\\]/g;

/** More than this and the coordinator is pasting, not searching. Keeps the URL and the plan sane. */
const MAX_TOKENS = 5;
const MAX_TOKEN_LENGTH = 60;

/** Below four digits, "6" or "69" is a name fragment far more often than a phone number. */
const MIN_PHONE_DIGITS = 4;

/**
 * Lowercase, accent-stripped, final-sigma-folded. The exact TypeScript of
 * `translate(immutable_unaccent(lower(full_name)), 'ς', 'σ')`.
 *
 * The sigma fold is the subtle one. JavaScript's `toLowerCase()` implements the Unicode
 * final-sigma rule and Postgres's `lower()` does not:
 *
 *     "ΣΤΕΛΛΑΣ".toLowerCase() -> "στελλας"    lower('ΣΤΕΛΛΑΣ') -> 'στελλασ'
 *
 * Without the fold the query and the column disagree on every Greek name ending in sigma, which is
 * most Greek male surnames — a bug that would look exactly like the one we are fixing.
 */
export function normaliseSearchText(value: string): string {
  return stripDiacritics(value.toLowerCase()).replace(/ς/g, "σ");
}

/**
 * Greek -> Latin, ELOT 743 (the passport spelling), over text that `normaliseSearchText` has
 * already lowercased and unaccented. The exact TypeScript of `public.greek_to_latin`.
 *
 * Digraphs first: they are not compositional. "ου" is "ou", not "oy"; "γγ" is "ng", not "gg".
 * Not handled, on purpose: μπ -> b and γκ -> g, which are right word-initially ("Μπάμπης" ->
 * "babis") and wrong in the middle ("Λαμπρόπουλος" would become "labropoulos").
 *
 * Lossy by nature, and accepted as such by the owner: "Eftychia" will not find "Ευτυχία"
 * (ευ -> ev gives "evtychia") and "Hatzi" will not find "Χατζή". Both return nothing today too.
 */
const DIGRAPHS: readonly (readonly [string, string])[] = [
  ["ου", "ou"],
  ["αυ", "av"],
  ["ευ", "ev"],
  ["γγ", "ng"],
  ["θ", "th"],
  ["χ", "ch"],
  ["ψ", "ps"],
];

const LETTERS: Readonly<Record<string, string>> = {
  α: "a", β: "v", γ: "g", δ: "d", ε: "e", ζ: "z", η: "i", ι: "i",
  κ: "k", λ: "l", μ: "m", ν: "n", ξ: "x", ο: "o", π: "p", ρ: "r",
  σ: "s", ς: "s", τ: "t", υ: "y", φ: "f", ω: "o",
};

export function toLatin(normalised: string): string {
  let out = normalised;
  for (const [from, to] of DIGRAPHS) out = out.split(from).join(to);
  return Array.from(out, (ch) => LETTERS[ch] ?? ch).join("");
}

/**
 * The words to look for. Splitting matters for two reasons a single `%q%` cannot cover:
 * `"  MARIA  "` must behave like `maria`, and "Παπαδοπούλου Μαρία" must find a promoter stored as
 * "Μαρία Παπαδοπούλου" — the coordinator does not know which order the roster was typed in.
 */
export function searchTokens(raw: string): string[] {
  return normaliseSearchText(raw)
    .replace(UNSAFE, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, MAX_TOKENS)
    .map((token) => token.slice(0, MAX_TOKEN_LENGTH));
}

/**
 * Digits only. Phones are stored normalised to `+30697…` by `normalizePhone` in
 * app/promoters/actions.ts, so a coordinator reading a number off a screen and typing
 * "697 123 4567" — or pasting "+30 697 123 4567" — matched nothing at all before this.
 */
export function phoneDigits(raw: string): string {
  return raw.replace(/\D/g, "");
}

/**
 * The whole search as one PostgREST `or=` expression, ready for `query.or(...)`. Null when there is
 * nothing to search for.
 *
 * Every token must match (AND), and a token may match either normalisation of the name (OR), or the
 * phone may match:
 *
 *     or( and( or(search_name.ilike.%μαρια%, search_name_latin.ilike.%maria%),
 *              or(search_name.ilike.%χατζη%, search_name_latin.ilike.%chatzi%) ),
 *         phone.ilike.%...% )
 *
 * Both columns are consulted for every token rather than guessing at the script: a Greek token
 * matches `search_name` directly, a Latin token matches `search_name_latin`, and a name stored in
 * Latin letters is still found by a Greek query because `toLatin` leaves Latin text alone.
 *
 * `ilike` rather than `like`, even though both sides are already lowercased. It costs nothing on a
 * trigram index and it means a case difference we failed to anticipate degrades to "slightly wider
 * match" instead of "promoter invisible", which is the failure mode this whole file exists to kill.
 */
export function promoterSearchFilter(raw: string): string | null {
  const tokens = searchTokens(raw);
  const clauses: string[] = [];

  if (tokens.length > 0) {
    const perToken = tokens.map(
      (token) => `or(search_name.ilike.%${token}%,search_name_latin.ilike.%${toLatin(token)}%)`,
    );
    clauses.push(perToken.length === 1 ? perToken[0]! : `and(${perToken.join(",")})`);
  }

  const phrase = tokens.join(" ");
  if (phrase) clauses.push(`phone.ilike.%${phrase}%`);

  const digits = phoneDigits(raw).slice(0, MAX_TOKEN_LENGTH);
  if (digits.length >= MIN_PHONE_DIGITS) clauses.push(`phone.ilike.%${digits}%`);

  return clauses.length === 0 ? null : clauses.join(",");
}
