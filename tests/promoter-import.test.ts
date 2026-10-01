import { describe, expect, it } from "vitest";
import {
  assignPromoterColumn,
  detectPromoterHeader,
  missingPromoterFields,
  parseBirthYear,
  parseBoolean,
  parsePromoterRows,
  planPromoterImport,
  rowsToCreate,
  splitAreas,
  summarisePromoterImport,
  validatePromoterRow,
  type ExistingPromoter,
  type KnownArea,
  type PromoterColumnMapping,
} from "@/lib/promoters/import";
import type { Cell, SheetGrid } from "@/lib/import/types";

/**
 * S1 — the pure half of the promoter import. Same shape as tests/import-*.test.ts.
 *
 * Every fixture here is synthetic. CLAUDE.md §1: no real agency data, ever — the names are the
 * ordinary Greek names a generator would produce and every address is @example.invalid.
 */

function grid(rows: Cell[][]): SheetGrid {
  return { name: "Φύλλο1", rows };
}

const AREAS: KnownArea[] = [
  { id: "area-glyfada", name: "Γλυφάδα" },
  { id: "area-kentro", name: "Κέντρο" },
  { id: "area-nea-smyrni", name: "Νέα Σμύρνη" },
];

const OPTIONS = { knownAreas: AREAS, today: "2026-09-28" };

const MAP = (m: Record<number, string>): PromoterColumnMapping => m as PromoterColumnMapping;

// ---------------------------------------------------------------------------------------------
// Header detection
// ---------------------------------------------------------------------------------------------

describe("detectPromoterHeader — Greek headers", () => {
  it("maps the headers a Greek agency actually writes", () => {
    const g = grid([
      ["Ονοματεπώνυμο", "Τηλέφωνο", "Email", "Περιοχή", "Έτος γέννησης", "Αυτοκίνητο", "Δίπλωμα", "Σχόλια"],
      ["Μαρία Παπαδοπούλου", "6971234567", "m@example.invalid", "Γλυφάδα", 1994, "ΝΑΙ", "ΝΑΙ", ""],
    ]);
    const d = detectPromoterHeader(g);
    expect(d.headerRowIndex).toBe(0);
    expect(d.complete).toBe(true);
    expect(d.mapping[0]).toBe("full_name");
    expect(d.mapping[1]).toBe("phone");
    expect(d.mapping[2]).toBe("email");
    expect(d.mapping[3]).toBe("area");
    expect(d.mapping[4]).toBe("birth_year");
    expect(d.mapping[5]).toBe("has_car");
    expect(d.mapping[6]).toBe("has_licence");
    expect(d.mapping[7]).toBe("notes");
  });

  it("does not care about accents, case or punctuation in the header", () => {
    const g = grid([
      ["ΟΝΟΜΑΤΕΠΩΝΥΜΟ", "ΤΗΛ.", "ΠΕΡΙΟΧΗ"],
      ["Άννα Γεωργίου", "6971234567", "Κέντρο"],
    ]);
    const d = detectPromoterHeader(g);
    expect(d.mapping[0]).toBe("full_name");
    expect(d.mapping[1]).toBe("phone");
    expect(d.mapping[2]).toBe("area");
  });

  it("finds the header under title rows and a blank row", () => {
    const g = grid([
      ["ΛΙΣΤΑ PROMOTERS ΣΕΠΤΕΜΒΡΙΟΣ 2026", null, null],
      [null, null, null],
      ["Επώνυμο", "Όνομα", "Κινητό"],
      ["Παπαδοπούλου", "Μαρία", "6971234567"],
    ]);
    const d = detectPromoterHeader(g);
    expect(d.headerRowIndex).toBe(2);
    expect(d.mapping[0]).toBe("last_name");
    expect(d.mapping[1]).toBe("first_name");
    expect(d.mapping[2]).toBe("phone");
    expect(d.complete).toBe(true);
  });

  it("maps English headers too", () => {
    const g = grid([
      ["Full name", "Mobile", "Email", "Area", "Car", "Licence"],
      ["Maria Papadopoulou", "6971234567", "m@example.invalid", "Κέντρο", "yes", "no"],
    ]);
    const d = detectPromoterHeader(g);
    expect(d.mapping[0]).toBe("full_name");
    expect(d.mapping[1]).toBe("phone");
    expect(d.mapping[2]).toBe("email");
    expect(d.mapping[3]).toBe("area");
    expect(d.mapping[4]).toBe("has_car");
    expect(d.mapping[5]).toBe("has_licence");
    expect(d.complete).toBe(true);
  });

  it("is honest when it cannot find the required columns", () => {
    const g = grid([
      ["Στήλη Α", "Στήλη Β"],
      ["κάτι", "άλλο"],
    ]);
    const d = detectPromoterHeader(g);
    expect(d.complete).toBe(false);
    expect(missingPromoterFields(d.mapping)).toEqual(["name", "phone"]);
  });

  it("reports low confidence rather than guessing confidently", () => {
    const g = grid([
      ["Ονοματεπώνυμο", "Στοιχεία επικοινωνίας"],
      ["Άννα Γεωργίου", "6971234567"],
    ]);
    const d = detectPromoterHeader(g);
    expect(d.confidence[0]).toBe(1);
    // "Στοιχεία επικοινωνίας" contains the token "επικοινωνια" but is not the same phrase.
    expect(d.confidence[1]!).toBeLessThan(1);
  });
});

describe("missingPromoterFields", () => {
  it("accepts first+last in place of a full name", () => {
    expect(missingPromoterFields(MAP({ 0: "first_name", 1: "last_name", 2: "phone" }))).toEqual([]);
  });

  it("rejects a first name on its own", () => {
    expect(missingPromoterFields(MAP({ 0: "first_name", 1: "phone" }))).toEqual(["name"]);
  });

  it("always requires a phone — it is the identity rule", () => {
    expect(missingPromoterFields(MAP({ 0: "full_name" }))).toEqual(["phone"]);
  });
});

describe("assignPromoterColumn", () => {
  it("takes a field away from the column that had it", () => {
    const next = assignPromoterColumn(MAP({ 0: "full_name", 1: "phone" }), 1, "full_name");
    expect(next[0]).toBe("ignore");
    expect(next[1]).toBe("full_name");
  });

  it("lets several columns be ignored at once", () => {
    const next = assignPromoterColumn(MAP({ 0: "ignore", 1: "phone" }), 1, "ignore");
    expect(next[0]).toBe("ignore");
    expect(next[1]).toBe("ignore");
  });
});

// ---------------------------------------------------------------------------------------------
// Cell parsing
// ---------------------------------------------------------------------------------------------

describe("parseBoolean", () => {
  it("reads yes/no in both languages and the tick marks", () => {
    for (const yes of ["ΝΑΙ", "ναι", "Ν", "yes", "Y", "TRUE", "1", "x", "✓", true, 1]) {
      expect(parseBoolean(yes as Cell)).toBe(true);
    }
    for (const no of ["ΟΧΙ", "όχι", "no", "N", "FALSE", "0", "-", "", null, false, 0]) {
      expect(parseBoolean(no as Cell)).toBe(false);
    }
  });

  it("treats an unrecognised note as yes, because blank is how you say no", () => {
    expect(parseBoolean("ΝΑΙ - μηχανάκι")).toBe(true);
    expect(parseBoolean("δικό της")).toBe(true);
  });
});

describe("parseBirthYear", () => {
  it("reads a bare year", () => {
    expect(parseBirthYear(1994, 2026)).toBe(1994);
    expect(parseBirthYear("1994", 2026)).toBe(1994);
  });

  it("pulls the year out of a written date without guessing day/month order", () => {
    expect(parseBirthYear("12/05/1994", 2026)).toBe(1994);
    expect(parseBirthYear("05/12/1994", 2026)).toBe(1994);
  });

  it("reads a real Date cell", () => {
    expect(parseBirthYear(new Date(1994, 4, 12), 2026)).toBe(1994);
  });

  it("is null for a blank cell and invalid for nonsense or an impossible age", () => {
    expect(parseBirthYear(null, 2026)).toBeNull();
    expect(parseBirthYear("   ", 2026)).toBeNull();
    expect(parseBirthYear("άγνωστο", 2026)).toBe("invalid");
    expect(parseBirthYear(1800, 2026)).toBe("invalid");
    expect(parseBirthYear(2025, 2026)).toBe("invalid"); // would be one year old
  });
});

describe("splitAreas", () => {
  it("splits the separators a coordinator actually types", () => {
    expect(splitAreas("Γλυφάδα, Κέντρο")).toEqual(["Γλυφάδα", "Κέντρο"]);
    expect(splitAreas("Γλυφάδα / Κέντρο")).toEqual(["Γλυφάδα", "Κέντρο"]);
    expect(splitAreas("Γλυφάδα; Κέντρο | Νέα Σμύρνη")).toEqual(["Γλυφάδα", "Κέντρο", "Νέα Σμύρνη"]);
    expect(splitAreas("")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// Row parsing
// ---------------------------------------------------------------------------------------------

const FULL_MAP = MAP({
  0: "full_name", 1: "phone", 2: "email", 3: "area", 4: "birth_year", 5: "has_car", 6: "has_licence", 7: "notes",
});

describe("parsePromoterRows", () => {
  it("parses a clean Greek row end to end", () => {
    const g = grid([
      ["Ονοματεπώνυμο", "Τηλέφωνο", "Email", "Περιοχή", "Έτος γέννησης", "Αυτοκίνητο", "Δίπλωμα", "Σχόλια"],
      ["Μαρία Παπαδοπούλου", "697 123 4567", "maria@example.invalid", "Γλυφάδα, Κέντρο", 1994, "ΝΑΙ", "ΟΧΙ", "διαθέσιμη Σ/Κ"],
    ]);
    const [row] = parsePromoterRows(g, 0, FULL_MAP, OPTIONS);
    expect(row!.sourceRow).toBe(2);
    expect(row!.fullName).toBe("Μαρία Παπαδοπούλου");
    expect(row!.phone).toBe("+306971234567"); // the identity rule, applied at parse time
    expect(row!.phoneRaw).toBe("697 123 4567");
    expect(row!.email).toBe("maria@example.invalid");
    expect(row!.birthYear).toBe(1994);
    expect(row!.areaIds).toEqual(["area-glyfada", "area-kentro"]);
    expect(row!.hasCar).toBe(true);
    expect(row!.hasLicence).toBe(false);
    expect(row!.notes).toBe("διαθέσιμη Σ/Κ");
    expect(row!.issues).toEqual([]);
  });

  it("joins a split name as Επώνυμο Όνομα", () => {
    const g = grid([
      ["Επώνυμο", "Όνομα", "Κινητό"],
      ["Παπαδοπούλου", "Μαρία", "6971234567"],
    ]);
    const [row] = parsePromoterRows(g, 0, MAP({ 0: "last_name", 1: "first_name", 2: "phone" }), OPTIONS);
    expect(row!.fullName).toBe("Παπαδοπούλου Μαρία");
  });

  it("skips fully blank rows but keeps their Excel row numbers honest", () => {
    const g = grid([
      ["Ονοματεπώνυμο", "Τηλέφωνο"],
      ["Άννα Γεωργίου", "6971234567"],
      [null, null],
      ["", ""],
      ["Νίκος Σταθόπουλος", "6971234568"],
    ]);
    const rows = parsePromoterRows(g, 0, MAP({ 0: "full_name", 1: "phone" }), OPTIONS);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.sourceRow)).toEqual([2, 5]);
  });

  it("flags a missing name and a missing phone as errors", () => {
    const g = grid([
      ["Ονοματεπώνυμο", "Τηλέφωνο"],
      ["", "6971234567"],
      ["Άννα Γεωργίου", ""],
      ["Α", "6971234569"],
    ]);
    const rows = parsePromoterRows(g, 0, MAP({ 0: "full_name", 1: "phone" }), OPTIONS);
    expect(rows[0]!.issues[0]).toMatchObject({ code: "missing_name", severity: "error" });
    expect(rows[1]!.issues[0]).toMatchObject({ code: "missing_phone", severity: "error" });
    expect(rows[2]!.issues[0]).toMatchObject({ code: "name_too_short", severity: "error" });
  });

  it("flags an unusable phone rather than importing a broken one", () => {
    const g = grid([
      ["Ονοματεπώνυμο", "Τηλέφωνο"],
      ["Άννα Γεωργίου", "—"],
      ["Νίκη Θεοδώρου", "697"],
    ]);
    const rows = parsePromoterRows(g, 0, MAP({ 0: "full_name", 1: "phone" }), OPTIONS);
    expect(rows[0]!.issues.some((i) => i.code === "phone_invalid")).toBe(true);
    expect(rows[1]!.issues.some((i) => i.code === "phone_invalid")).toBe(true);
    expect(rows[0]!.phone).toBeNull();
  });

  it("keeps a promoter whose email is malformed, and says so", () => {
    const g = grid([
      ["Ονοματεπώνυμο", "Τηλέφωνο", "Email"],
      ["Άννα Γεωργίου", "6971234567", "not-an-email"],
    ]);
    const [row] = parsePromoterRows(g, 0, MAP({ 0: "full_name", 1: "phone", 2: "email" }), OPTIONS);
    expect(row!.email).toBeNull();
    expect(row!.issues).toEqual([{ code: "email_invalid", severity: "warning", field: "email" }]);
    // The point of the warning: it must not stop the import.
    expect(row!.issues.every((i) => i.severity === "warning")).toBe(true);
  });

  it("warns about an area the agency does not have, and imports the rest", () => {
    const g = grid([
      ["Ονοματεπώνυμο", "Τηλέφωνο", "Περιοχή"],
      ["Άννα Γεωργίου", "6971234567", "Γλυφάδα, Ραφήνα"],
    ]);
    const [row] = parsePromoterRows(g, 0, MAP({ 0: "full_name", 1: "phone", 2: "area" }), OPTIONS);
    expect(row!.areaNames).toEqual(["Γλυφάδα", "Ραφήνα"]);
    expect(row!.areaIds).toEqual(["area-glyfada"]);
    expect(row!.issues).toEqual([{ code: "unknown_area", severity: "warning", field: "area" }]);
  });

  it("matches an area whose accents or case differ from the agency's spelling", () => {
    const g = grid([
      ["Ονοματεπώνυμο", "Τηλέφωνο", "Περιοχή"],
      ["Άννα Γεωργίου", "6971234567", "ΓΛΥΦΑΔΑ"],
      ["Νίκη Θεοδώρου", "6971234568", "νεα σμυρνη"],
    ]);
    const rows = parsePromoterRows(g, 0, MAP({ 0: "full_name", 1: "phone", 2: "area" }), OPTIONS);
    expect(rows[0]!.areaIds).toEqual(["area-glyfada"]);
    expect(rows[1]!.areaIds).toEqual(["area-nea-smyrni"]);
    expect(rows.flatMap((r) => r.issues)).toEqual([]);
  });

  it("flags the SECOND row when one phone appears twice, keeping the first", () => {
    const g = grid([
      ["Ονοματεπώνυμο", "Τηλέφωνο"],
      ["Άννα Γεωργίου", "6971234567"],
      ["Άννα Γεωργίου", "+30 697 123 4567"], // same person, written differently
    ]);
    const rows = parsePromoterRows(g, 0, MAP({ 0: "full_name", 1: "phone" }), OPTIONS);
    expect(rows[0]!.issues).toEqual([]);
    expect(rows[1]!.issues).toEqual([{ code: "duplicate_in_file", severity: "error", field: "phone" }]);
  });

  it("defaults the optional flags to false when the file has no such column", () => {
    const g = grid([
      ["Ονοματεπώνυμο", "Τηλέφωνο"],
      ["Άννα Γεωργίου", "6971234567"],
    ]);
    const [row] = parsePromoterRows(g, 0, MAP({ 0: "full_name", 1: "phone" }), OPTIONS);
    expect(row!.hasCar).toBe(false);
    expect(row!.hasLicence).toBe(false);
    expect(row!.birthYear).toBeNull();
    expect(row!.areaIds).toEqual([]);
    expect(row!.notes).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------
// Server-side re-validation
// ---------------------------------------------------------------------------------------------

describe("validatePromoterRow — what the server recomputes", () => {
  const base = {
    sourceRow: 2,
    fullName: "Άννα Γεωργίου",
    phone: "+306971234567",
    phoneRaw: "6971234567",
    email: null,
    birthYear: null,
    areaNames: [],
    areaIds: [],
    hasCar: false,
    hasLicence: false,
    notes: null,
    issues: [],
  };

  it("clears issues a tampered payload claims not to have", () => {
    const smuggled = { ...base, fullName: "", issues: [] };
    expect(validatePromoterRow(smuggled, OPTIONS).issues[0]).toMatchObject({ code: "missing_name", severity: "error" });
  });

  it("agrees with parsePromoterRows on a clean row", () => {
    expect(validatePromoterRow(base, OPTIONS).issues).toEqual([]);
  });

  it("re-checks the phone the client says it normalised", () => {
    expect(validatePromoterRow({ ...base, phone: "12" }, OPTIONS).issues[0]!.code).toBe("phone_invalid");
  });

  it("re-checks a birth year that is out of range", () => {
    expect(validatePromoterRow({ ...base, birthYear: 2025 }, OPTIONS).issues[0]!.code).toBe("birth_year_invalid");
  });
});

// ---------------------------------------------------------------------------------------------
// The plan and the summary
// ---------------------------------------------------------------------------------------------

describe("planPromoterImport", () => {
  const existing: ExistingPromoter[] = [
    { id: "p-1", fullName: "Άννα Γεωργίου", phone: "+306971234567" },
  ];

  function parse(rows: Cell[][]) {
    return parsePromoterRows(
      grid([["Ονοματεπώνυμο", "Τηλέφωνο", "Email"], ...rows]),
      0,
      MAP({ 0: "full_name", 1: "phone", 2: "email" }),
      OPTIONS,
    );
  }

  it("marks an existing promoter as a duplicate and names who they are", () => {
    const planned = planPromoterImport(parse([["Άννα Γεωργίου", "697 123 4567", ""]]), existing);
    expect(planned[0]!.status).toBe("duplicate");
    expect(planned[0]!.reasons).toContain("duplicate_existing");
    expect(planned[0]!.existing).toEqual({ id: "p-1", fullName: "Άννα Γεωργίου" });
  });

  it("matches a duplicate however the phone was written in the file", () => {
    for (const written of ["6971234567", "+306971234567", "+30 697 123 4567", "697-123-4567"]) {
      const planned = planPromoterImport(parse([["Κάποια Άλλη", written, ""]]), existing);
      expect(planned[0]!.status).toBe("duplicate");
    }
  });

  it("never updates a duplicate — it is skipped and creates nothing", () => {
    const planned = planPromoterImport(parse([["Άννα Γεωργίου", "6971234567", ""]]), existing);
    expect(rowsToCreate(planned)).toEqual([]);
  });

  it("an error row is an error, not a duplicate, even if its phone exists", () => {
    const planned = planPromoterImport(parse([["", "6971234567", ""]]), existing);
    expect(planned[0]!.status).toBe("error");
  });

  it("imports a warning row and carries the reason", () => {
    const planned = planPromoterImport(parse([["Νίκη Θεοδώρου", "6971234599", "bad-email"]]), existing);
    expect(planned[0]!.status).toBe("warning");
    expect(planned[0]!.reasons).toEqual(["email_invalid"]);
    expect(rowsToCreate(planned)).toHaveLength(1);
  });

  it("counts a mixed file the way the owner asked to see it", () => {
    const planned = planPromoterImport(
      parse([
        ["Νίκη Θεοδώρου", "6971230001", ""], // ready
        ["Σοφία Αλεξίου", "6971230002", "oops"], // warning, still imported
        ["Άννα Γεωργίου", "6971234567", ""], // duplicate of an existing promoter
        ["", "6971230003", ""], // error: no name
        ["Χωρίς Τηλέφωνο", "", ""], // error: no phone
        ["Νίκη Θεοδώρου", "6971230001", ""], // error: duplicate within the file
      ]),
      existing,
    );
    expect(summarisePromoterImport(planned)).toEqual({
      total: 6,
      valid: 2,
      duplicates: 1,
      errors: 3,
      warnings: 1,
    });
    expect(rowsToCreate(planned).map((r) => r.fullName)).toEqual(["Νίκη Θεοδώρου", "Σοφία Αλεξίου"]);
  });

  it("summarises an empty plan without dividing by zero", () => {
    expect(summarisePromoterImport([])).toEqual({ total: 0, valid: 0, duplicates: 0, errors: 0, warnings: 0 });
  });
});
