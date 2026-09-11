/**
 * P32 — the retention sweep.
 *
 * `promoters.retention_until` has existed since the first migration with nothing enforcing it.
 * This is the thing that enforces it.
 *
 *   npx tsx --env-file=.env scripts/retention-sweep.ts                  # dry run, deletes nothing
 *   npx tsx --env-file=.env scripts/retention-sweep.ts --apply          # actually erases
 *   npx tsx --env-file=.env scripts/retention-sweep.ts --promoter=<id>  # one person, dry run
 *   npx tsx --env-file=.env scripts/retention-sweep.ts --promoter=<id> --apply
 *   npx tsx --env-file=.env scripts/retention-sweep.ts --access=<id> [--out=file.json]
 *
 * DRY RUN IS THE DEFAULT AND THAT IS NOT NEGOTIABLE. Erasing requires `--apply`, typed by a
 * human who has just read the dry run. Nothing in this repo invokes this script with `--apply`
 * on a schedule, and nothing should until the retention window in docs/gdpr.md has been
 * confirmed by the founder.
 *
 * Safe to run repeatedly: a promoter already erased carries `anonymised_at` and is skipped.
 * The selection logic lives in `lib/retention.ts` and is unit-tested in
 * `tests/retention.test.ts` with no database, because a bug here deletes real people's records.
 *
 * It uses the service-role key from `.env`, so it runs from a trusted machine only.
 *
 * Everything is inside `main()` rather than at the top level: `package.json` has no
 * `"type": "module"`, so tsx transforms these files as CJS and rejects top-level `await`.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ERASURE_PLAN,
  isoDate,
  latestDate,
  planSweep,
  type RetentionCandidate,
} from "../lib/retention";
import { collectSubjectAccess, erasePromoter } from "../lib/erasure";

const line = "-".repeat(88);

function header(text: string) {
  console.log(`\n${line}\n${text}\n${line}`);
}

// -----------------------------------------------------------------------------------------------
// Arguments
// -----------------------------------------------------------------------------------------------

const args = process.argv.slice(2);
const apply = args.includes("--apply");

function flag(name: string): string | null {
  const prefix = `--${name}=`;
  const hit = args.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// -----------------------------------------------------------------------------------------------
// Mode 1 — subject access
// -----------------------------------------------------------------------------------------------

async function subjectAccess(db: SupabaseClient, promoterId: string, outPath: string | null) {
  const record = await collectSubjectAccess(db, promoterId);
  const target = resolve(process.cwd(), outPath ?? `subject-access-${promoterId}.json`);

  writeFileSync(target, JSON.stringify(record, null, 2), "utf8");

  header(`Subject access record for ${promoterId}`);
  console.log(`Written to ${target}`);
  console.log("\nCounts:");
  for (const [key, value] of Object.entries(record)) {
    if (Array.isArray(value)) console.log(`  ${key.padEnd(24)} ${value.length}`);
  }
  console.log("\nWhat this record tells them we do NOT hold:");
  for (const item of record.notHeld) console.log(`  - ${item}`);
  console.log(
    "\nTHIS FILE IS ONE REAL PERSON'S COMPLETE RECORD. `.gitignore` does not cover *.json —\n" +
      "write it outside the repo, send it over a channel they chose, then delete it.",
  );
}

// -----------------------------------------------------------------------------------------------
// Mode 2 — erase one named promoter (a subject request)
// -----------------------------------------------------------------------------------------------

async function eraseOne(db: SupabaseClient, promoterId: string) {
  const outcome = await erasePromoter(db, promoterId, {
    reason: "subject_request",
    dryRun: !apply,
  });

  header(`${apply ? "ERASING" : "DRY RUN — would erase"} promoter ${promoterId} (subject request)`);

  if (outcome.alreadyErased) {
    console.log("Already erased. Nothing to do.");
    return;
  }

  for (const [table, count] of Object.entries(outcome.deletedCounts)) {
    console.log(`  delete    ${table.padEnd(26)} ${count}`);
  }
  for (const [table, count] of Object.entries(outcome.anonymisedCounts)) {
    console.log(`  anonymise ${table.padEnd(26)} ${count}`);
  }

  const residual = outcome.residual.filter((r) => r.count > 0);
  if (residual.length > 0) {
    console.log("\n  MANUAL REVIEW — free text and files that survive and may name them:");
    for (const r of residual) console.log(`    ${r.table.padEnd(24)} ${r.count}`);
    console.log("  See docs/gdpr.md, 'What automation cannot reach'.");
  }

  if (!apply) console.log("\nNothing was changed. Re-run with --apply to perform the erasure.");
}

// -----------------------------------------------------------------------------------------------
// Mode 3 — the sweep
// -----------------------------------------------------------------------------------------------

async function sweep(db: SupabaseClient) {
  const today = isoDate(new Date());

  const { data: agencies, error: agencyError } = await db
    .from("agencies")
    .select("id, name, promoter_retention_months");
  if (agencyError) throw new Error(`agencies: ${agencyError.message}`);

  const retentionMonthsByAgency = new Map<string, number | null>(
    (agencies ?? []).map((a) => [
      String(a.id),
      typeof a.promoter_retention_months === "number" ? a.promoter_retention_months : null,
    ]),
  );
  const agencyNames = new Map<string, string>(
    (agencies ?? []).map((a) => [String(a.id), String(a.name)]),
  );

  const { data: promoterRows, error: promoterError } = await db
    .from("promoters")
    .select("id, agency_id, full_name, retention_until, anonymised_at, created_at");
  if (promoterError) throw new Error(`promoters: ${promoterError.message}`);

  // Last activity, pulled in two flat queries rather than a correlated subquery per promoter.
  // Fine at the scale this product runs at today (hundreds of promoters); if it ever is not,
  // the fix is a view, not a loop.
  const { data: assignmentRows, error: assignmentError } = await db
    .from("assignments")
    .select("promoter_id, confirmed_at");
  if (assignmentError) throw new Error(`assignments: ${assignmentError.message}`);

  const { data: availabilityRows, error: availabilityError } = await db
    .from("availability")
    .select("promoter_id, on_date");
  if (availabilityError) throw new Error(`availability: ${availabilityError.message}`);

  const lastActivity = new Map<string, string>();
  const noteActivity = (promoterId: unknown, when: unknown) => {
    if (typeof promoterId !== "string" || typeof when !== "string") return;
    const best = latestDate(lastActivity.get(promoterId), when);
    if (best) lastActivity.set(promoterId, best);
  };
  for (const row of assignmentRows ?? []) noteActivity(row.promoter_id, row.confirmed_at);
  for (const row of availabilityRows ?? []) noteActivity(row.promoter_id, row.on_date);

  const namesById = new Map<string, string>();
  const candidates: RetentionCandidate[] = (promoterRows ?? []).map((row) => {
    const id = String(row.id);
    namesById.set(id, String(row.full_name));
    return {
      id,
      agencyId: String(row.agency_id),
      retentionUntil: row.retention_until ? String(row.retention_until).slice(0, 10) : null,
      anonymisedAt: row.anonymised_at ? String(row.anonymised_at) : null,
      lastActivityOn: lastActivity.get(id) ?? latestDate(String(row.created_at)) ?? today,
    };
  });

  const plan = planSweep(candidates, today, retentionMonthsByAgency);

  header(`Retention sweep · ${today} · ${apply ? "APPLY" : "DRY RUN"}`);
  console.log(`Promoters examined:            ${candidates.length}`);
  console.log(`Due for erasure:               ${plan.due.length}`);
  console.log(`Skipped:                       ${plan.skipped.length}`);

  const bySkipReason = new Map<string, number>();
  for (const s of plan.skipped) {
    if (s.inScope) continue;
    bySkipReason.set(s.reason, (bySkipReason.get(s.reason) ?? 0) + 1);
  }
  for (const [reason, count] of bySkipReason) {
    console.log(`  ${reason.padEnd(28)} ${count}`);
  }

  if (plan.agenciesWithoutPolicy.length > 0) {
    console.log(
      "\nAgencies with no declared retention window (promoter_retention_months is null):",
    );
    for (const id of plan.agenciesWithoutPolicy) console.log(`  ${agencyNames.get(id) ?? id}`);
    console.log(
      "  Nothing is inferred for these. Set the column deliberately — see docs/gdpr.md for the\n" +
        "  proposed window and why this script refuses to guess one.",
    );
  }

  if (plan.policyGaps.length > 0) {
    console.log(
      `\n${plan.policyGaps.length} promoter(s) are past their agency's declared window but have no`,
    );
    console.log("retention_until set. THE SWEEP WILL NOT TOUCH THEM. A human must set the date:");
    for (const gap of plan.policyGaps.slice(0, 25)) {
      console.log(
        `  ${gap.promoterId}  last activity ${gap.lastActivityOn}  would have been due ${gap.wouldHaveBeenDueOn}`,
      );
    }
    if (plan.policyGaps.length > 25) console.log(`  … and ${plan.policyGaps.length - 25} more`);
  }

  if (plan.due.length === 0) {
    console.log("\nNothing is due. Exiting.");
    return;
  }

  console.log("\nDue for erasure:");
  for (const decision of plan.due) {
    if (!decision.inScope) continue;
    const name = namesById.get(decision.promoterId);
    console.log(
      `  ${decision.promoterId}${name ? ` (${name})` : ""} — retention_until ${decision.dueOn}`,
    );
  }

  if (!apply) {
    console.log("\nWhat would happen to each table:");
    for (const rule of ERASURE_PLAN) console.log(`  ${rule.action.padEnd(10)} ${rule.table}`);
    console.log(
      "\nNOTHING WAS CHANGED. Read docs/gdpr.md, confirm the list above is right, then re-run\n" +
        "with --apply.",
    );
    return;
  }

  let erased = 0;
  const totals: Record<string, number> = {};
  for (const decision of plan.due) {
    if (!decision.inScope) continue;
    const outcome = await erasePromoter(db, decision.promoterId, {
      reason: "retention_sweep",
      dryRun: false,
    });
    if (outcome.alreadyErased) continue;
    erased += 1;
    for (const [table, count] of Object.entries({
      ...outcome.deletedCounts,
      ...outcome.anonymisedCounts,
    })) {
      totals[table] = (totals[table] ?? 0) + count;
    }
    const residual = outcome.residual.filter((r) => r.count > 0);
    if (residual.length > 0) {
      console.log(
        `  ${decision.promoterId}: manual review needed — ${residual
          .map((r) => `${r.table}=${r.count}`)
          .join(", ")}`,
      );
    }
  }

  header(`Erased ${erased} promoter(s)`);
  for (const [table, count] of Object.entries(totals)) {
    console.log(`  ${table.padEnd(28)} ${count}`);
  }
  console.log("\nA receipt row was written to promoter_erasures for each one.");
}

// -----------------------------------------------------------------------------------------------

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Copy .env.example to .env first.",
    );
    process.exit(1);
  }

  const singlePromoter = flag("promoter");
  const accessFor = flag("access");

  for (const [label, value] of [
    ["--promoter", singlePromoter],
    ["--access", accessFor],
  ] as const) {
    if (value !== null && !UUID.test(value)) {
      console.error(`${label} must be a promoter uuid, got: ${value}`);
      process.exit(1);
    }
  }

  const db = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (accessFor) return subjectAccess(db, accessFor, flag("out"));
  if (singlePromoter) return eraseOne(db, singlePromoter);
  return sweep(db);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
