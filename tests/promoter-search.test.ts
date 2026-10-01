import { describe, expect, it } from "vitest";
import {
  normaliseSearchText,
  phoneDigits,
  promoterSearchFilter,
  searchTokens,
  toLatin,
} from "@/lib/promoters/search";

/**
 * S1. These are the TypeScript half of `supabase/migrations/0021_promoter_search.sql`. The SQL half
 * cannot be asserted from here — `scripts/verify-promoter-search.ts` does that against the live
 * table — so what is pinned here is the behaviour the SQL was written to mirror, name by name.
 *
 * Every Greek name below is one that actually exists on the demo roster.
 */

describe("normaliseSearchText — the accent bug", () => {
  it("collapses the spellings that used to miss each other", () => {
    // The whole bug in one assertion: these three are the same promoter and used to be three
    // different searches, two of which returned nothing.
    expect(normaliseSearchText("ΣΤΕΛΛΑ")).toBe("στελλα");
    expect(normaliseSearchText("Στέλλα")).toBe("στελλα");
    expect(normaliseSearchText("στέλλα")).toBe("στελλα");
  });

  it("folds accents on names that exist twice in the roster with and without them", () => {
    expect(normaliseSearchText("Μαρία")).toBe(normaliseSearchText("Μαρια"));
    expect(normaliseSearchText("Παπαδοπούλου")).toBe(normaliseSearchText("Παπαδοπουλου"));
  });

  it("folds final sigma, which JS and Postgres lowercase differently", () => {
    // "ΣΤΕΛΛΑΣ".toLowerCase() is 'στελλας' (final sigma) but lower('ΣΤΕΛΛΑΣ') is 'στελλασ'.
    // Without the fold, every Greek surname ending in sigma would miss.
    expect(normaliseSearchText("ΣΤΕΛΛΑΣ")).toBe("στελλασ");
    expect(normaliseSearchText("Παππάς")).toBe("παππασ");
    expect(normaliseSearchText("Παππάσ")).toBe(normaliseSearchText("Παππάς"));
    expect(normaliseSearchText("ΑΝΔΡΕΑΣ")).toBe(normaliseSearchText("Ανδρέας"));
  });

  it("leaves Latin text alone apart from case", () => {
    expect(normaliseSearchText("Maria Papadopoulou")).toBe("maria papadopoulou");
  });

  it("strips Latin accents too — an imported roster may carry them", () => {
    expect(normaliseSearchText("Zoé")).toBe("zoe");
  });
});

describe("toLatin — ELOT 743, against real roster names", () => {
  const cases: [string, string][] = [
    ["μαρια", "maria"],
    ["στελλα", "stella"],
    ["παπαδοπουλου", "papadopoulou"], // ου -> ou, twice, not "oy"
    ["θεοδωρου", "theodorou"], // θ -> th
    ["χατζη", "chatzi"], // χ -> ch, η -> i
    ["αγγελικη", "angeliki"], // γγ -> ng, not "gg"
    ["ευαγγελια", "evangelia"], // ευ -> ev AND γγ -> ng in one word
    ["λαμπροπουλοσ", "lampropoulos"], // μπ deliberately NOT folded to "b"
    ["γεωργιου", "georgiou"],
    ["κωνσταντινοσ", "konstantinos"],
    ["αλεξιου", "alexiou"], // ξ -> x
    ["σταθοπουλου", "stathopoulou"],
    ["δημητρησ", "dimitris"],
    ["ιωαννα", "ioanna"],
    ["βασιλικη", "vasiliki"], // β -> v
    ["καραγιαννη", "karagianni"],
    ["παναγιωτησ", "panagiotis"],
    ["χριστινα", "christina"],
    ["οικονομου", "oikonomou"],
    ["παππασ", "pappas"],
  ];

  for (const [greek, latin] of cases) {
    it(`${greek} -> ${latin}`, () => {
      expect(toLatin(greek)).toBe(latin);
    });
  }

  it("passes Latin text through unchanged, so a Greek query still finds a Latin-typed name", () => {
    expect(toLatin("maria papadopoulou")).toBe("maria papadopoulou");
  });

  it("is idempotent — applying it twice changes nothing", () => {
    for (const [greek] of cases) expect(toLatin(toLatin(greek))).toBe(toLatin(greek));
  });
});

describe("searchTokens", () => {
  it("trims surrounding whitespace", () => {
    expect(searchTokens("  MARIA  ")).toEqual(["maria"]);
  });

  it("splits a full name into words so word order does not matter", () => {
    expect(searchTokens("Maria Papadopoulou")).toEqual(["maria", "papadopoulou"]);
    expect(searchTokens("Παπαδοπούλου Μαρία")).toEqual(["παπαδοπουλου", "μαρια"]);
  });

  it("collapses runs of whitespace rather than producing empty tokens", () => {
    expect(searchTokens("Μαρία\t\n   Χατζή")).toEqual(["μαρια", "χατζη"]);
  });

  it("strips the characters that would reshape a PostgREST filter", () => {
    // Each of these would otherwise end the value and start a new condition, or act as a wildcard.
    expect(searchTokens("Μαρία, Χατζή")).toEqual(["μαρια", "χατζη"]);
    expect(searchTokens("or(id.gt.0)")).toEqual(["or", "id.gt.0"]);
    expect(searchTokens("%%%")).toEqual([]);
    expect(searchTokens("a_b")).toEqual(["a", "b"]);
    expect(searchTokens(`"quoted"`)).toEqual(["quoted"]);
  });

  it("caps the number and length of tokens", () => {
    expect(searchTokens("a b c d e f g h")).toHaveLength(5);
    expect(searchTokens("x".repeat(200))[0]).toHaveLength(60);
  });

  it("returns nothing for an empty or whitespace-only query", () => {
    expect(searchTokens("")).toEqual([]);
    expect(searchTokens("    ")).toEqual([]);
  });
});

describe("phoneDigits", () => {
  it("reduces every way a coordinator writes a number to the stored form's digits", () => {
    expect(phoneDigits("697 123 4567")).toBe("6971234567");
    expect(phoneDigits("+30 697 123 4567")).toBe("306971234567");
    expect(phoneDigits("(697) 123-4567")).toBe("6971234567");
  });

  it("is empty for a name", () => {
    expect(phoneDigits("Μαρία")).toBe("");
  });
});

describe("promoterSearchFilter", () => {
  it("is null when there is nothing to search for", () => {
    expect(promoterSearchFilter("")).toBeNull();
    expect(promoterSearchFilter("   ")).toBeNull();
    expect(promoterSearchFilter("%")).toBeNull();
  });

  it("queries both normalisations of the name for a single token", () => {
    const filter = promoterSearchFilter("Στέλλα")!;
    expect(filter).toContain("search_name.ilike.%στελλα%");
    expect(filter).toContain("search_name_latin.ilike.%stella%");
  });

  it("finds a Greek-script name from a Latin-script query", () => {
    const filter = promoterSearchFilter("Maria")!;
    expect(filter).toContain("search_name_latin.ilike.%maria%");
  });

  it("ANDs multiple tokens so both words must be present", () => {
    const filter = promoterSearchFilter("Maria Papadopoulou")!;
    expect(filter).toContain("and(");
    expect(filter).toContain("search_name_latin.ilike.%maria%");
    expect(filter).toContain("search_name_latin.ilike.%papadopoulou%");
  });

  it("produces the identical name clause however the query is cased, accented or padded", () => {
    const nameClause = (raw: string) => promoterSearchFilter(raw)!.split(",phone.")[0];
    const expected = nameClause("μαρια");
    for (const variant of ["Μαρία", "ΜΑΡΙΑ", "  Μαρία  ", "μαρία"]) {
      expect(nameClause(variant)).toBe(expected);
    }
  });

  it("adds a digits-only phone clause so spaced numbers match the stored +30 form", () => {
    const filter = promoterSearchFilter("697 123 4567")!;
    expect(filter).toContain("phone.ilike.%6971234567%");
  });

  it("does not treat a short number as a phone", () => {
    expect(promoterSearchFilter("697")).not.toContain("phone.ilike.%697%,");
    expect(promoterSearchFilter("Μαρία")).not.toContain("phone.ilike.%%");
  });

  it("never emits an unbalanced or injectable expression", () => {
    for (const raw of ["Μαρία", "Maria Papadopoulou", "or(id.gt.0)", "a,b,c", "697 123 4567", "'; drop"]) {
      const filter = promoterSearchFilter(raw);
      if (!filter) continue;
      const opens = (filter.match(/\(/g) ?? []).length;
      const closes = (filter.match(/\)/g) ?? []).length;
      expect(opens).toBe(closes);
      // Nothing the user typed can survive into the expression as a structural character.
      expect(filter).not.toMatch(/[%(),.]\s/);
    }
  });
});
