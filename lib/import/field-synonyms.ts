/**
 * P37b — header synonym dictionary. Every term is written as a human-readable Greek/English phrase;
 * matching normalises both sides (see `text.ts`), so accents/case/punctuation in the actual file
 * header never matter. Multi-word terms are matched as a set of tokens, not a literal phrase, so
 * word order in the file doesn't matter either.
 */

import type { ImportField } from "./types";

export type SynonymEntry = { field: ImportField; terms: string[] };

export const FIELD_SYNONYMS: readonly SynonymEntry[] = [
  {
    field: "date",
    terms: ["ημ νια", "ημερομηνια", "ημερα", "date", "ημ"],
  },
  {
    field: "store_name",
    terms: ["καταστημα", "σημειο πωλησης", "store", "pos", "point of sale", "καταστηματος"],
  },
  {
    field: "store_address",
    terms: ["διευθυνση", "address"],
  },
  {
    field: "city",
    terms: ["περιοχη", "πολη", "city", "area"],
  },
  {
    field: "chain",
    terms: ["αλυσιδα", "chain", "brand", "εταιρια"],
  },
  {
    field: "start_time",
    terms: ["ωρα εναρξης", "εναρξη", "εναρξης", "απο", "from", "start", "start time"],
  },
  {
    field: "end_time",
    terms: ["εως", "ληξη", "ληξης", "to", "end", "end time"],
  },
  {
    field: "time_range",
    terms: ["ωραριο", "ωρες", "time", "shift time", "ωραριο βαρδιας"],
  },
  {
    field: "promoters_required",
    terms: ["ατομα", "promoters", "πληθος", "headcount", "qty", "quantity", "αριθμος ατομων"],
  },
  {
    field: "notes",
    terms: ["σχολια", "notes", "comments", "παρατηρησεις"],
  },
];
