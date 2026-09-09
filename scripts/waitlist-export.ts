/**
 * Reads every waitlist registration through the service role and:
 *   1. prints a readable summary (total count, signups per day, breakdown by promoter_count,
 *      breakdown by utm_source)
 *   2. writes the full data to a CSV file
 *
 * RLS blocks every read of `waitlist_signups` except through the service role, so this is
 * the only way to see registrations outside the Supabase SQL editor. It uses the service-role
 * key from .env, so it only runs from a trusted machine — never in a deployed environment.
 *
 * The CSV contains real people's contact details. `.gitignore` already excludes `*.csv`
 * (verified — see docs/waitlist-launch.md), so the default output path is safe to write
 * inside the repo, but treat the file itself as sensitive regardless of where it lands.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/waitlist-export.ts [output-path]
 *   Defaults to waitlist-export.csv in the project root.
 */
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Copy .env.example to .env first.",
  );
  process.exit(1);
}

const db = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Signup = {
  id: string;
  full_name: string;
  work_email: string;
  company_name: string;
  job_title: string | null;
  promoter_count: string;
  primary_challenge: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  created_at: string;
};

const COLUMNS = [
  "id",
  "full_name",
  "work_email",
  "company_name",
  "job_title",
  "promoter_count",
  "primary_challenge",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "created_at",
] as const;

const outputArg = process.argv[2] ?? "waitlist-export.csv";
const outputPath = resolve(process.cwd(), outputArg);

const { data, error } = await db
  .from("waitlist_signups")
  .select(COLUMNS.join(", "))
  .order("created_at", { ascending: true })
  .returns<Signup[]>();

if (error) {
  console.error("Could not read waitlist signups.", { code: error.code });
  process.exit(1);
}

const signups = data ?? [];

// --- Summary ---

console.log(`Waitlist signups: ${signups.length}`);

if (signups.length === 0) {
  console.log("No signups yet.");
} else {
  const byDay = new Map<string, number>();
  const byPromoterCount = new Map<string, number>();
  const byUtmSource = new Map<string, number>();

  for (const signup of signups) {
    const day = signup.created_at.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
    byPromoterCount.set(signup.promoter_count, (byPromoterCount.get(signup.promoter_count) ?? 0) + 1);
    const source = signup.utm_source ?? "(none)";
    byUtmSource.set(source, (byUtmSource.get(source) ?? 0) + 1);
  }

  console.log("\nSignups per day:");
  for (const [day, count] of [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    console.log(`  ${day}  ${count}`);
  }

  console.log("\nBy promoter count:");
  for (const [range, count] of [...byPromoterCount.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    console.log(`  ${range}  ${count}`);
  }

  console.log("\nBy UTM source:");
  for (const [source, count] of [...byUtmSource.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${source}  ${count}`);
  }
}

// --- CSV ---

function csvCell(value: string | null): string {
  if (value === null) return "";
  const needsQuoting = /[",\n]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuoting ? `"${escaped}"` : escaped;
}

const lines = [COLUMNS.join(",")];
for (const signup of signups) {
  lines.push(COLUMNS.map((column) => csvCell(signup[column])).join(","));
}

writeFileSync(outputPath, lines.join("\n") + "\n", "utf8");
console.log(`\nWrote ${signups.length} row(s) to ${outputPath}`);
