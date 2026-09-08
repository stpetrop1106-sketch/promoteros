/**
 * Read-only smoke check for the matching engine.
 *
 * The ranking IS the product (build-plan §2.1), so this does more than prove the RPC
 * returns rows. For three seeded shifts it prints:
 *
 *   1. the hard-filter funnel — how many promoters each filter removes, so an empty or
 *      near-empty result is diagnosed as "the seed is wrong" vs "the filter is wrong"
 *   2. the ranked candidates with their per-factor breakdown
 *   3. the score distribution — a ranking where every score is 0.5 is not a ranking
 *   4. three invariants that must hold, checked against the real rows:
 *        A. breakdown carries all six factors with finite values
 *        B. the total score equals the weighted mean of the breakdown (the UI shows the
 *           breakdown as the explanation; if it does not reconstruct the total, the
 *           explanation is a lie)
 *        C. Pareto dominance — a candidate at least as good on every factor and strictly
 *           better on one must not score lower. This is the "does a nearby promoter with
 *           brand experience and a completed brief outrank a distant one with neither"
 *           question, asked of every pair rather than one hand-picked example
 *
 * Mutates nothing. Usage: npm run smoke
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Copy .env.example to .env first.",
  );
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });

const FACTORS = [
  "distance",
  "brand_experience",
  "category_experience",
  "skill_overlap",
  "brief_completed",
  "reliability",
] as const;

type Factor = (typeof FACTORS)[number];

type BreakdownEntry = { value: number; weight: number; detail?: number };
type Breakdown = Record<Factor, BreakdownEntry>;

type MatchRow = {
  promoter_id: string;
  full_name: string;
  phone: string;
  distance_m: number | null;
  has_car: boolean;
  brief_completed: boolean;
  brand_shifts: number;
  skill_hits: number;
  reliability: number;
  score: number | null;
  breakdown: Breakdown;
};

type ShiftRow = {
  id: string;
  agency_id: string;
  on_date: string;
  start_time: string;
  end_time: string;
  campaign_id: string;
  store_id: string;
};

/**
 * Beyond this, a candidate is in another city. Nothing in match_promoters excludes them —
 * distance_score decays but never disqualifies — so four strong factors can carry someone
 * 300 km away into the top five. Surfaced, not silently fixed: whether that is a hard
 * radius filter, a promoter_areas filter, or a seed that stops mixing cities is a product
 * decision, not P0's.
 */
const FAR_M = 60_000;

const problems = new Set<string>();
const flag = (s: string) => {
  problems.add(s);
  console.log(`    ! ${s}`);
};

const hhmm = (t: string) => String(t).slice(0, 5);
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

/** Does one availability row cover the whole shift window? Mirrors the SQL hard filter. */
function covers(
  row: { status: string; from_time: string | null; to_time: string | null },
  start: string,
  end: string,
) {
  if (row.status !== "available") return false;
  if (row.from_time !== null && row.from_time > start) return false;
  if (row.to_time !== null && row.to_time < end) return false;
  return true;
}

/**
 * Why the candidate list is the size it is. Run in TypeScript rather than SQL on purpose:
 * if these numbers disagree with the RPC's row count, the SQL filter is not doing what
 * this file says it does, and that disagreement is itself the finding.
 */
async function funnel(shift: ShiftRow) {
  const { data: promoters, error } = await db
    .from("promoters")
    .select("id, status, home_lat, home_lng")
    .eq("agency_id", shift.agency_id);
  if (error) throw error;

  const all = promoters ?? [];
  const active = all.filter((p) => p.status === "active");
  const noCoords = active.filter((p) => p.home_lat === null || p.home_lng === null);

  const { data: avail, error: availErr } = await db
    .from("availability")
    .select("promoter_id, status, from_time, to_time")
    .eq("agency_id", shift.agency_id)
    .eq("on_date", shift.on_date);
  if (availErr) throw availErr;

  const rows = avail ?? [];
  const declared = new Set(rows.map((r) => r.promoter_id));
  const covering = new Set(
    rows
      .filter((r) => covers(r, shift.start_time, shift.end_time))
      .map((r) => r.promoter_id),
  );

  const activeIds = new Set(active.map((p) => p.id));
  const activeCovering = [...covering].filter((id) => activeIds.has(id));

  const { count: blocked } = await db
    .from("blocklist")
    .select("*", { count: "exact", head: true })
    .eq("agency_id", shift.agency_id);

  const { count: invited } = await db
    .from("invitations")
    .select("*", { count: "exact", head: true })
    .eq("shift_id", shift.id);

  const { count: assigned } = await db
    .from("assignments")
    .select("*", { count: "exact", head: true })
    .eq("shift_id", shift.id);

  console.log(
    `    funnel: ${all.length} promoters → ${active.length} active → ` +
      `${declared.size} declared this date → ${activeCovering.length} cover ${hhmm(
        shift.start_time,
      )}–${hhmm(shift.end_time)}  ` +
      `(blocklist ${blocked ?? 0}, invitations ${invited ?? 0}, assignments ${assigned ?? 0})`,
  );

  if (noCoords.length > 0) {
    flag(
      `${noCoords.length} active promoter(s) have no home_lat/home_lng — haversine_m returns ` +
        `null for them, which makes score null, and "order by score desc" is NULLS FIRST in ` +
        `Postgres. They would rank first with no score. See 0005_matching_fixes.sql.`,
    );
  }

  return { expected: activeCovering.length };
}

/** Invariants A and B, per row. */
function checkRow(r: MatchRow) {
  const b = r.breakdown;
  if (!b || typeof b !== "object") {
    flag(`${r.full_name}: breakdown missing entirely`);
    return null;
  }

  const missing = FACTORS.filter((f) => !b[f] || typeof b[f].value !== "number");
  if (missing.length > 0) {
    flag(`${r.full_name}: breakdown missing factors ${missing.join(", ")}`);
    return null;
  }

  for (const f of FACTORS) {
    const v = b[f].value;
    if (!Number.isFinite(v) || v < 0 || v > 1) {
      flag(`${r.full_name}: factor ${f} value ${v} is outside 0..1`);
    }
  }

  if (r.score === null) {
    flag(`${r.full_name}: score is null`);
    return null;
  }

  const weighted = FACTORS.reduce((acc, f) => acc + b[f].value * b[f].weight, 0);
  const total = FACTORS.reduce((acc, f) => acc + b[f].weight, 0);
  const recomputed = total === 0 ? 0 : weighted / total;

  if (Math.abs(recomputed - r.score) > 0.0002) {
    flag(
      `${r.full_name}: breakdown does not reconstruct the score ` +
        `(breakdown ⇒ ${recomputed.toFixed(4)}, returned ${r.score.toFixed(4)})`,
    );
  }

  return recomputed;
}

/**
 * Invariant C. A candidate that is nearer, has more brand shifts, more skill hits, has read
 * the brief and is at least as reliable must not be ranked below one that is worse on every
 * one of those. Checked over every pair in the candidate set, not a chosen example.
 */
function checkDominance(rows: MatchRow[]) {
  let pairs = 0;
  let violations = 0;

  for (const a of rows) {
    for (const b of rows) {
      if (a === b || a.score === null || b.score === null) continue;
      if (a.distance_m === null || b.distance_m === null) continue;

      const atLeast =
        a.distance_m <= b.distance_m &&
        a.brand_shifts >= b.brand_shifts &&
        a.skill_hits >= b.skill_hits &&
        Number(a.brief_completed) >= Number(b.brief_completed) &&
        a.reliability >= b.reliability &&
        a.breakdown.category_experience.value >= b.breakdown.category_experience.value;

      const strictly =
        a.distance_m < b.distance_m ||
        a.brand_shifts > b.brand_shifts ||
        a.skill_hits > b.skill_hits ||
        Number(a.brief_completed) > Number(b.brief_completed) ||
        a.reliability > b.reliability ||
        a.breakdown.category_experience.value > b.breakdown.category_experience.value;

      if (!atLeast || !strictly) continue;
      pairs++;

      // has_car widens the radius, so equal metres can legitimately score differently.
      // Only compare where transport is the same.
      if (a.has_car !== b.has_car) continue;

      if (a.score < b.score - 1e-9) {
        violations++;
        if (violations <= 3) {
          flag(
            `dominance violated: ${a.full_name} (${a.score.toFixed(4)}) is at least as good on ` +
              `every factor as ${b.full_name} (${b.score.toFixed(4)}) but scores lower`,
          );
        }
      }
    }
  }

  return { pairs, violations };
}

function spread(rows: MatchRow[]) {
  const scores = rows.map((r) => r.score).filter((s): s is number => s !== null);
  if (scores.length === 0) return null;

  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const sd = Math.sqrt(
    scores.reduce((a, b) => a + (b - mean) ** 2, 0) / scores.length,
  );
  const distinct = new Set(scores.map((s) => s.toFixed(4))).size;

  return { min, max, mean, sd, distinct, n: scores.length };
}

function renderRow(i: number, r: MatchRow) {
  const b = r.breakdown;
  const km = r.distance_m === null ? "  ?  " : (r.distance_m / 1000).toFixed(1).padStart(6);
  const score = r.score === null ? " null" : `${Math.round(r.score * 100)}%`.padStart(5);

  console.log(`    ${String(i + 1).padStart(2)}. ${score}  ${r.full_name.padEnd(24)} ${km} km`);
  console.log(
    `        dist ${b.distance.value.toFixed(2)}×${b.distance.weight}` +
      `  brand ${b.brand_experience.value.toFixed(2)}×${b.brand_experience.weight} (${r.brand_shifts})` +
      `  cat ${b.category_experience.value.toFixed(2)}×${b.category_experience.weight}` +
      `  skill ${b.skill_overlap.value.toFixed(2)}×${b.skill_overlap.weight} (${r.skill_hits})` +
      `  brief ${b.brief_completed.value.toFixed(2)}×${b.brief_completed.weight}` +
      `  rel ${b.reliability.value.toFixed(2)}×${b.reliability.weight}` +
      `  ${r.has_car ? "car" : "no car"}`,
  );
}

async function main() {
  const { data: shifts, error: shiftsErr } = await db
    .from("shifts")
    .select(
      "id, agency_id, on_date, start_time, end_time, campaign_id, store_id, campaigns(name, campaign_type), stores(name, address)",
    )
    .order("on_date")
    .limit(3);

  if (shiftsErr) throw shiftsErr;
  if (!shifts?.length) throw new Error("No shifts — run npm run seed first.");

  // Is category_experience reachable at all? It needs a second campaign of the same type.
  const { data: allCampaigns } = await db.from("campaigns").select("id, campaign_type");
  const typeCounts = new Map<string, number>();
  for (const c of allCampaigns ?? []) {
    const t = String(c.campaign_type);
    typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
  }

  let totalCandidates = 0;

  for (const raw of shifts) {
    const shift = raw as unknown as ShiftRow;
    const campaign = raw.campaigns as unknown as {
      name: string;
      campaign_type: string;
    } | null;
    const store = raw.stores as unknown as { name: string; address: string } | null;

    console.log(`\n─── ${campaign?.name} · ${store?.name} (${store?.address})`);
    console.log(
      `    ${shift.on_date} ${hhmm(shift.start_time)}–${hhmm(shift.end_time)}  [${shift.id}]`,
    );

    const { expected } = await funnel(shift);

    // No limit clamp: we want the whole candidate set for the statistics, then print the head.
    const { data, error } = await db.rpc("match_promoters", {
      p_shift_id: shift.id,
      p_limit: 500,
    });

    if (error) {
      flag(`match_promoters failed: ${error.message}`);
      continue;
    }

    const rows = (data ?? []) as MatchRow[];
    totalCandidates += rows.length;

    if (rows.length === 0) {
      flag(
        expected === 0
          ? "no candidates, and no active promoter declared availability covering this window — " +
              "the seed is the problem, not the filter"
          : `no candidates, but ${expected} promoters should have passed the availability filter — ` +
              "the SQL hard filter is wrong",
      );
      continue;
    }

    if (rows.length !== expected) {
      console.log(
        `    note: ${rows.length} candidates vs ${expected} expected from availability alone ` +
          "(difference should be explained by blocklist / invitations / assignments above)",
      );
    }

    console.log(`    ${rows.length} candidates`);
    const top = rows.slice(0, 5);
    for (const [i, r] of top.entries()) renderRow(i, r);

    const farInTop = top.filter((r) => (r.distance_m ?? 0) > FAR_M);
    if (farInTop.length > 0) {
      flag(
        `${farInTop.length} of the top 5 live more than ${FAR_M / 1000} km away ` +
          `(${farInTop
            .map((r) => `${r.full_name} ${(r.distance_m! / 1000).toFixed(0)} km`)
            .join(", ")}). No hard radius and no promoter_areas filter, so brand + brief + ` +
          `reliability outweigh an impossible commute.`,
      );
    }

    const s = spread(rows);
    if (s) {
      console.log(
        `    scores: min ${pct(s.min)}  max ${pct(s.max)}  mean ${pct(s.mean)}  ` +
          `sd ${s.sd.toFixed(4)}  distinct ${s.distinct}/${s.n}`,
      );
      if (s.sd < 0.01) flag(`scores are effectively identical (sd ${s.sd.toFixed(4)}) — not a ranking`);
      if (s.distinct < s.n / 2) flag(`only ${s.distinct} distinct scores across ${s.n} candidates`);
    }

    for (const r of rows) checkRow(r);

    const dom = checkDominance(rows);
    console.log(
      `    dominance: ${dom.pairs} comparable pairs, ${dom.violations} violations`,
    );

    // Factors that are constant across the whole candidate set carry weight but do no work.
    for (const f of FACTORS) {
      const vals = new Set(rows.map((r) => r.breakdown[f]?.value));
      const first = rows[0]?.breakdown[f];
      if (vals.size === 1 && first) {
        flag(
          `factor "${f}" is ${first.value} for all ${rows.length} candidates — it carries ` +
            `weight ${first.weight} and separates nobody`,
        );
      }
    }

    // Sanity on the ordering the RPC itself returned.
    for (let i = 1; i < rows.length; i++) {
      const prev = rows[i - 1];
      const cur = rows[i];
      if (!prev || !cur || prev.score === null || cur.score === null) continue;
      if (cur.score > prev.score + 1e-9) {
        flag(`rows are not returned in descending score order at position ${i + 1}`);
        break;
      }
    }
  }

  const unreachable = [...typeCounts.entries()].filter(([, n]) => n < 2);
  if (unreachable.length > 0) {
    console.log(
      `\n    ! ${unreachable.length}/${typeCounts.size} campaign_type value(s) are unique to a ` +
        "single campaign. category_experience needs a *different* campaign of the same type, " +
        "so it can never be true for those. Seed fix, not a function fix.",
    );
    problems.add("category_experience unreachable for campaign types held by one campaign");
  }

  console.log(
    `\n${totalCandidates} candidates across ${shifts.length} shifts · ` +
      `${problems.size} distinct problem(s) flagged`,
  );
  if (problems.size > 0) {
    console.log("\nProblems:");
    for (const p of problems) console.log(`  - ${p}`);
  }
  console.log("");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
