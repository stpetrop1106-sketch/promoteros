/**
 * S1 — prove promoter search against the live database, not just in unit tests.
 *
 *     npx tsx --env-file=.env scripts/verify-promoter-search.ts
 *
 * READ ONLY. It creates nothing and writes nothing, so it is safe to run against the production
 * project at any time.
 *
 * There are four things unit tests cannot tell us, and this checks all four:
 *
 *   1. THE TWO NORMALISERS AGREE. `promoters.search_name` is computed by Postgres and the query is
 *      normalised by TypeScript. If they ever disagree about one letter, search silently misses
 *      rows and NOTHING reports an error. This recomputes every stored value in TypeScript and
 *      demands a byte-for-byte match — the single highest-risk assumption in the design.
 *   2. The searches the coordinator actually types return the people who are actually there.
 *   3. A search never returns the same promoter twice, and paging never loses one.
 *   4. The status filter is not quietly hiding part of the roster.
 */

import { createClient } from "@supabase/supabase-js";
import { normaliseSearchText, promoterSearchFilter, toLatin } from "../lib/promoters/search";

const PAGE_SIZE = 50; // must match app/promoters/page.tsx

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let failures = 0;
function check(ok: boolean, label: string, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "  ok  " : " FAIL "} ${label}${detail ? ` — ${detail}` : ""}`);
}

type Row = { id: string; full_name: string; status: string; agency_id: string; search_name: string; search_name_latin: string };

const SELECT = "id, full_name, status, agency_id, search_name, search_name_latin";

async function main() {
  console.log("\n1. Postgres and TypeScript normalise identically\n");

  const { data, error } = await db.from("promoters").select(SELECT).order("full_name").order("id");
  if (error) throw new Error(`could not read promoters: ${error.message} (is 0021 applied?)`);
  const rows = (data ?? []) as Row[];
  console.log(`  ${rows.length} promoters on ${new Set(rows.map((r) => r.agency_id)).size} agency/agencies\n`);

  let mismatches = 0;
  for (const row of rows) {
    const expectedName = normaliseSearchText(row.full_name);
    const expectedLatin = toLatin(expectedName);
    if (row.search_name !== expectedName || row.search_name_latin !== expectedLatin) {
      mismatches++;
      if (mismatches <= 10) {
        console.log(`  FAIL ${JSON.stringify(row.full_name)}`);
        console.log(`       search_name        db=${JSON.stringify(row.search_name)} ts=${JSON.stringify(expectedName)}`);
        console.log(`       search_name_latin  db=${JSON.stringify(row.search_name_latin)} ts=${JSON.stringify(expectedLatin)}`);
      }
    }
  }
  check(mismatches === 0, `all ${rows.length} rows normalise identically in SQL and TypeScript`, mismatches ? `${mismatches} mismatched` : "");

  // -------------------------------------------------------------------------------------------
  console.log("\n2. The searches a coordinator actually types\n");

  async function search(q: string): Promise<Row[]> {
    const filter = promoterSearchFilter(q);
    let query = db.from("promoters").select(SELECT).order("full_name").order("id");
    if (filter) query = query.or(filter);
    const { data: found, error: err } = await query;
    if (err) throw new Error(`search ${JSON.stringify(q)} failed: ${err.message}`);
    return (found ?? []) as Row[];
  }

  // Every one of these must find the promoter whose name is the FIRST element, whichever way the
  // coordinator spells it. The accents, the case and the script all vary; the answer must not.
  const groups: { label: string; queries: string[] }[] = [
    { label: "ΣΤΕΛΛΑ", queries: ["ΣΤΕΛΛΑ", "Στέλλα", "στελλα", "  ΣΤΕΛΛΑ  ", "Stella", "stella"] },
    { label: "Maria", queries: ["Μαρία", "μαρια", "ΜΑΡΙΑ", "Maria", "maria", " MARIA "] },
    { label: "Papadopoulou", queries: ["Παπαδοπούλου", "παπαδοπουλου", "Papadopoulou", "papadopoulou"] },
    { label: "Maria Papadopoulou", queries: ["Μαρία Παπαδοπούλου", "Maria Papadopoulou", "Papadopoulou Maria", "παπαδοπουλου μαρια"] },
  ];

  for (const group of groups) {
    const results = await Promise.all(group.queries.map(search));
    const idSets = results.map((r) => r.map((x) => x.id).sort().join(","));
    const counts = results.map((r) => r.length);
    const allSame = idSets.every((s) => s === idSets[0]);
    check(counts[0]! > 0, `"${group.label}" finds somebody`, `${counts[0]} row(s)`);
    check(
      allSame,
      `"${group.label}" — all ${group.queries.length} spellings return the identical set`,
      group.queries.map((q, i) => `${JSON.stringify(q)}=${counts[i]}`).join(" "),
    );
    if (results[0]!.length > 0) console.log(`         ${results[0]!.map((r) => r.full_name).join(", ")}`);
  }

  // The regression this whole parcel exists for, stated as the owner stated it.
  const stella = await search("Στέλλα");
  check(stella.some((r) => r.full_name === "ΣΤΕΛΛΑ"), `searching "Στέλλα" finds the promoter stored as "ΣΤΕΛΛΑ"`);

  // -------------------------------------------------------------------------------------------
  console.log("\n3. No duplicates, nothing lost across pages\n");

  for (const q of ["", "Μαρία", "α", "Papadopoulou"]) {
    const all = await search(q);
    const ids = all.map((r) => r.id);
    check(new Set(ids).size === ids.length, `search ${JSON.stringify(q)} returns no promoter twice`, `${ids.length} row(s)`);

    // Page through exactly the way the screen does, and compare with the unpaged result.
    const filter = promoterSearchFilter(q);
    const paged: string[] = [];
    for (let page = 0; page * PAGE_SIZE < all.length; page++) {
      let query = db.from("promoters").select(SELECT).order("full_name").order("id");
      if (filter) query = query.or(filter);
      const { data: slice, error: err } = await query.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (err) throw new Error(err.message);
      paged.push(...(slice ?? []).map((r) => (r as Row).id));
    }
    check(new Set(paged).size === paged.length, `search ${JSON.stringify(q)} — paging repeats nobody`, `${paged.length} row(s) over ${Math.ceil(all.length / PAGE_SIZE)} page(s)`);
    check(paged.join(",") === ids.join(","), `search ${JSON.stringify(q)} — paged result equals unpaged result`);
  }

  // -------------------------------------------------------------------------------------------
  console.log("\n4. The status filter is not hiding anyone\n");

  const byStatus = new Map<string, number>();
  for (const row of rows) byStatus.set(row.status, (byStatus.get(row.status) ?? 0) + 1);
  console.log(`  roster holds: ${[...byStatus].map(([s, n]) => `${s}=${n}`).join(", ")}\n`);

  const unfiltered = await search("");
  check(unfiltered.length === rows.length, "with no status filter, every promoter is listed", `${unfiltered.length}/${rows.length}`);

  let sum = 0;
  for (const [status, expected] of byStatus) {
    const { count, error: err } = await db.from("promoters").select("id", { count: "exact", head: true }).eq("status", status);
    if (err) throw new Error(err.message);
    sum += count ?? 0;
    check(count === expected, `status="${status}" returns exactly its ${expected} promoter(s)`, `got ${count}`);
  }
  check(sum === rows.length, "the per-status counts add up to the whole roster", `${sum}/${rows.length}`);

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
