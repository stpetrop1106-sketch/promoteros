/**
 * P37b — text normalisation shared by header detection and store matching.
 *
 * No `xlsx` import here on purpose — this module sits underneath the two functions that must stay
 * SheetJS-free (`detectHeader`, `matchStores`), so it must stay SheetJS-free too.
 *
 * The technique for Greek accents: NFD decomposes an accented vowel (e.g. "ά") into the base letter
 * plus a combining accent codepoint (U+0301 etc.); stripping the combining-marks range removes the
 * accent and leaves the plain Greek letter. Same trick as `athensToday` neighbours use for dates,
 * applied here to text instead.
 */

const COMBINING_MARKS = /[̀-ͯ]/g;

export function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(COMBINING_MARKS, "");
}

/** Lowercase, accent-stripped, whitespace-collapsed — but punctuation is kept. Used for display diffing. */
export function normalizeLoose(value: string): string {
  return stripDiacritics(value).toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Lowercase, accent-stripped, punctuation removed, whitespace collapsed to single spaces.
 * This is the form header-synonym matching and store-key tokens both compare against — case,
 * accents, punctuation and extra whitespace must never make two headers or two store names differ.
 */
export function normalizeKeyTokens(value: string): string {
  return stripDiacritics(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(value: string): string[] {
  const normalized = normalizeKeyTokens(value);
  return normalized.length === 0 ? [] : normalized.split(" ");
}

/** Jaccard similarity of two token sets. Empty vs empty is treated as a perfect (trivial) match. */
export function jaccard(a: readonly string[], b: readonly string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size === 0 && setB.size === 0) return 1;
  let intersection = 0;
  for (const token of setA) if (setB.has(token)) intersection++;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}
