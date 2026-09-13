/**
 * P37b — store identity. No `xlsx` import.
 *
 * Revised by the manager after review, because the first version created duplicate stores on files
 * shaped like real client schedules. Three failures, each reproduced before it was fixed:
 *
 *  1. The address was part of the identity key, so a store whose address is filled on its first row
 *     and blank below — how client files are almost always written — became two stores.
 *  2. Greek inflection defeated matching: "Hyper Vega Γλυφάδας" did not match a known
 *     "Hyper Vega Γλυφάδα", because the genitive is a different token.
 *  3. Similarity against known stores compared name AND address tokens, so a known store with an
 *     address scored below the "likely" floor against a file row without one.
 *
 * The rules now:
 *
 *  - A store's identity is its NAME, as a set of folded tokens (`foldToken`): lowercase, accents
 *    stripped, a final ς/s and trailing vowels removed, so Γλυφάδα / Γλυφάδας / ΓΛΥΦΑΔΑ agree.
 *    Only endings fold: Αμαρουσίου and Μαρούσι differ at the start and stay different, and the
 *    coordinator resolves that one by choosing the existing store. Folding is deterministic, which
 *    a prefix rule is not, so it can be used as a grouping key.
 *  - The address SPLITS a name into several stores only when the file carries two or more genuinely
 *    different addresses for it — "Σκλαβενίτης" with the branch in the address column is several
 *    stores, and merging them would be far worse than asking.
 *  - Blank-address rows join the store when the name has at most one distinct address. When it has
 *    several, the blank rows stay a separate entry, so the coordinator is asked rather than guessed
 *    for.
 *  - Similarity against known stores uses NAME tokens only; the address only breaks ties between
 *    known stores that share a name.
 *
 * Rows find their store through `StoreMatch.sourceRows`. Recomputing a key per row cannot work any
 * more: a blank-address row's store depends on the other rows of the file.
 *
 * The chain/area guard still holds: "Hyper Vega Γλυφάδα" vs "Hyper Vega Κηφισιά" fold to
 * {hyper, veg, γλυφαδ} vs {hyper, veg, κηφισ} — Jaccard 0.5, below the 0.6 "likely" floor.
 */

import type { KnownStore, ParsedRow, StoreMatch } from "./types";
import { jaccard, tokenize } from "./text";

const EXACT_THRESHOLD = 0.95;
const LIKELY_THRESHOLD = 0.6;

const TRAILING_VOWELS = /[αεηιουωaeiouy]+$/u;
const FINAL_SIGMA_OR_S = /[ςs]$/u;
const DIGITS_ONLY = /^\p{N}+$/u;

/**
 * Fold one normalised token so inflected forms of the same word agree. Only words of four or more
 * letters are folded, and the result keeps at least three, so short words ("νεα", "ab") and numbers
 * are never reduced to something that collides with an unrelated word.
 */
export function foldToken(token: string): string {
  if (token.length < 4 || DIGITS_ONLY.test(token)) return token;
  const folded = token.replace(FINAL_SIGMA_OR_S, "").replace(TRAILING_VOWELS, "");
  return folded.length >= 3 ? folded : token;
}

function foldedTokens(value: string | null | undefined): string[] {
  return value ? [...new Set(tokenize(value).map(foldToken))] : [];
}

function keyOf(tokens: readonly string[]): string {
  return [...tokens].sort().join(" ");
}

/**
 * Identity key for a store. With an address, the address part distinguishes branches that share a
 * name; `matchStores` decides whether a given file actually needs that distinction.
 */
export function normaliseStoreKey(name: string, address?: string | null): string {
  const nameKey = keyOf(foldedTokens(name));
  const addressKey = keyOf(foldedTokens(address));
  return addressKey ? `${nameKey}|${addressKey}` : nameKey;
}

type Entry = {
  key: string;
  name: string;
  address: string | null;
  city: string | null;
  chain: string | null;
  sourceRows: number[];
};

function entryFrom(key: string, row: ParsedRow): Entry {
  return {
    key,
    name: row.storeName ?? "",
    address: row.storeAddress,
    city: row.city,
    chain: row.chain,
    sourceRows: [row.sourceRow],
  };
}

function absorb(entry: Entry, row: ParsedRow) {
  entry.sourceRows.push(row.sourceRow);
  if (!entry.address && row.storeAddress) entry.address = row.storeAddress;
  if (!entry.city && row.city) entry.city = row.city;
  if (!entry.chain && row.chain) entry.chain = row.chain;
}

function groupRows(rows: readonly ParsedRow[]): Entry[] {
  // Name key -> rows, in file order.
  const byName = new Map<string, ParsedRow[]>();
  for (const row of rows) {
    if (!row.storeName) continue;
    const nameKey = normaliseStoreKey(row.storeName);
    const list = byName.get(nameKey);
    if (list) list.push(row);
    else byName.set(nameKey, [row]);
  }

  const entries: Entry[] = [];
  for (const [nameKey, group] of byName) {
    const distinctAddresses = new Set(
      group.map((r) => keyOf(foldedTokens(r.storeAddress))).filter((k) => k.length > 0),
    );

    if (distinctAddresses.size <= 1) {
      // One store. Blank-address rows belong to it; the first non-empty address is its address.
      const entry = entryFrom(nameKey, group[0]!);
      for (const row of group.slice(1)) absorb(entry, row);
      entries.push(entry);
      continue;
    }

    // Several branches share this name: one entry per address, blank rows kept apart.
    const byAddress = new Map<string, Entry>();
    for (const row of group) {
      const addressKey = keyOf(foldedTokens(row.storeAddress));
      const key = addressKey ? `${nameKey}|${addressKey}` : nameKey;
      const existing = byAddress.get(key);
      if (existing) absorb(existing, row);
      else byAddress.set(key, entryFrom(key, row));
    }
    entries.push(...byAddress.values());
  }
  return entries;
}

export function matchStores(rows: readonly ParsedRow[], known: readonly KnownStore[]): StoreMatch[] {
  const knownEntries = known.map((store) => ({
    store,
    nameTokens: foldedTokens(store.name),
    addressTokens: foldedTokens(store.address),
  }));

  return groupRows(rows).map((entry): StoreMatch => {
    const nameTokens = foldedTokens(entry.name);
    const addressTokens = foldedTokens(entry.address);

    let best: { storeId: string; storeName: string; score: number; tiebreak: number } | null = null;
    for (const candidate of knownEntries) {
      const score = jaccard(nameTokens, candidate.nameTokens);
      // The address only separates known stores that share a name; it never lowers a name match.
      const tiebreak =
        addressTokens.length > 0 && candidate.addressTokens.length > 0
          ? jaccard(addressTokens, candidate.addressTokens)
          : 0;
      if (!best || score > best.score || (score === best.score && tiebreak > best.tiebreak)) {
        best = { storeId: candidate.store.id, storeName: candidate.store.name, score, tiebreak };
      }
    }

    const base = {
      key: entry.key,
      name: entry.name,
      address: entry.address,
      city: entry.city,
      chain: entry.chain,
      rowCount: entry.sourceRows.length,
      sourceRows: entry.sourceRows,
    };
    if (!best || best.score < LIKELY_THRESHOLD) return { ...base, match: null, confidence: "none" };
    const match = { storeId: best.storeId, storeName: best.storeName, score: best.score };
    return { ...base, match, confidence: best.score >= EXACT_THRESHOLD ? "exact" : "likely" };
  });
}
