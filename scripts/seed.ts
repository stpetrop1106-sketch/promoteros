/**
 * Synthetic seed data.
 *
 * Everything here is generated. No real promoter, client, or agency data ever enters this
 * project — see CLAUDE.md §1. Brand names below are invented; any resemblance to a real
 * company is unintended.
 *
 * Seed quality decides whether every later demo lands, so this aims at "looks like a real
 * agency's Tuesday", not "enough rows to render a table".
 *
 * Usage: npm run seed
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Copy .env.example to .env first.",
  );
  process.exit(1);
}

const db = createClient(url, serviceKey, { auth: { persistSession: false } });

// Deterministic RNG so two runs produce the same database and demos are repeatable.
function mulberry32(seed: number) {
  return function random() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260825);

const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
const pickSome = <T,>(xs: readonly T[], n: number): T[] =>
  [...xs].sort(() => rand() - 0.5).slice(0, n);
const chance = (p: number) => rand() < p;
const between = (lo: number, hi: number) => lo + rand() * (hi - lo);

// --- Reference geography (public coordinates, jittered per promoter) ----------

const AREAS = [
  { name: "Μαρούσι", city: "Αθήνα", lat: 38.0568, lng: 23.8078 },
  { name: "Γλυφάδα", city: "Αθήνα", lat: 37.8631, lng: 23.7539 },
  { name: "Κηφισιά", city: "Αθήνα", lat: 38.0736, lng: 23.8103 },
  { name: "Περιστέρι", city: "Αθήνα", lat: 38.0136, lng: 23.6916 },
  { name: "Νέα Σμύρνη", city: "Αθήνα", lat: 37.9455, lng: 23.7141 },
  { name: "Πειραιάς", city: "Αθήνα", lat: 37.9475, lng: 23.6379 },
  { name: "Χαλάνδρι", city: "Αθήνα", lat: 38.0217, lng: 23.7997 },
  { name: "Καλλιθέα", city: "Αθήνα", lat: 37.9555, lng: 23.7009 },
  { name: "Κέντρο", city: "Θεσσαλονίκη", lat: 40.6401, lng: 22.9444 },
  { name: "Καλαμαριά", city: "Θεσσαλονίκη", lat: 40.5806, lng: 22.9508 },
] as const;

const FIRST_NAMES = [
  "Μαρία", "Σοφία", "Άννα", "Ελένη", "Κατερίνα", "Ιωάννα", "Δήμητρα", "Χριστίνα",
  "Νίκη", "Βασιλική", "Αγγελική", "Ευαγγελία", "Γιώργος", "Δημήτρης", "Νίκος",
  "Κωνσταντίνος", "Παναγιώτης", "Ανδρέας", "Στέλιος", "Θανάσης",
] as const;

const LAST_NAMES = [
  "Παπαδοπούλου", "Γεωργίου", "Νικολάου", "Δημητρίου", "Ιωάννου", "Αντωνίου",
  "Βασιλείου", "Παππάς", "Οικονόμου", "Καραγιάννη", "Μακρή", "Σταθοπούλου",
  "Αλεξίου", "Θεοδώρου", "Λαμπρόπουλος", "Χατζή",
] as const;

const SKILLS = [
  { name: "Supermarket sampling", category: "retail" },
  { name: "Beauty & περιποίηση", category: "beauty" },
  { name: "Αρώματα", category: "beauty" },
  { name: "Events & activations", category: "events" },
  { name: "Τεχνολογία", category: "tech" },
  { name: "Παιδικά προϊόντα", category: "retail" },
  { name: "Ποτά & tasting", category: "beverage" },
  { name: "Αγγλικά", category: "language" },
] as const;

// Invented brands. Deliberately not real companies.
const CLIENTS = [
  { name: "Aurora Beauty", type: "Δειγματισμός αρώματος" },
  { name: "Kritikos Foods", type: "Δειγματισμός προϊόντος" },
  { name: "Nefeli Care", type: "Προώθηση περιποίησης" },
  { name: "Volta Electronics", type: "Προώθηση τεχνολογίας" },
] as const;

const STORE_CHAINS = ["Hyper Vega", "Agora Market", "Golden Mall", "Selini Stores"] as const;

const AGENCY_ID_SLUG = "demo-agency";

async function main() {
  console.log("Seeding synthetic data…");

  // --- Agency -------------------------------------------------------------
  const { data: agency, error: agencyErr } = await db
    .from("agencies")
    .upsert({ name: "Demo Promotion Agency", slug: AGENCY_ID_SLUG }, { onConflict: "slug" })
    .select()
    .single();
  if (agencyErr) throw agencyErr;
  const agencyId = agency.id as string;

  // --- Areas --------------------------------------------------------------
  const { data: areas, error: areasErr } = await db
    .from("areas")
    .upsert(
      AREAS.map((a) => ({
        agency_id: agencyId,
        name: a.name,
        city: a.city,
        centroid_lat: a.lat,
        centroid_lng: a.lng,
      })),
      { onConflict: "agency_id,name" },
    )
    .select();
  if (areasErr) throw areasErr;

  // --- Skills -------------------------------------------------------------
  const { data: skills, error: skillsErr } = await db
    .from("skills")
    .upsert(
      SKILLS.map((s) => ({ agency_id: agencyId, name: s.name, category: s.category })),
      { onConflict: "agency_id,name" },
    )
    .select();
  if (skillsErr) throw skillsErr;

  // --- Clients ------------------------------------------------------------
  const { data: clients, error: clientsErr } = await db
    .from("clients")
    .upsert(
      CLIENTS.map((c) => ({ agency_id: agencyId, name: c.name })),
      { onConflict: "agency_id,name" },
    )
    .select();
  if (clientsErr) throw clientsErr;

  // --- Promoters ----------------------------------------------------------
  const promoterRows = Array.from({ length: 60 }, (_, i) => {
    const area = pick(areas);
    return {
      agency_id: agencyId,
      full_name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
      // Synthetic numbers in a clearly non-routable pattern.
      phone: `69000${String(10000 + i).slice(-5)}`,
      email: `promoter${i + 1}@example.invalid`,
      birth_year: Math.floor(between(1985, 2005)),
      home_area_id: area.id,
      // Jitter around the area centroid so distances are meaningful but nobody is real.
      home_lat: area.centroid_lat + between(-0.02, 0.02),
      home_lng: area.centroid_lng + between(-0.02, 0.02),
      has_car: chance(0.45),
      has_licence: chance(0.6),
      status: chance(0.9) ? "active" : "paused",
      reliability_score: Number(between(0.55, 1).toFixed(2)),
    };
  });

  const { data: promoters, error: promotersErr } = await db
    .from("promoters")
    .upsert(promoterRows, { onConflict: "agency_id,phone" })
    .select();
  if (promotersErr) throw promotersErr;

  // Skills, areas and client history per promoter.
  await db.from("promoter_skills").upsert(
    promoters.flatMap((p) =>
      pickSome(skills, 1 + Math.floor(rand() * 3)).map((s) => ({
        promoter_id: p.id,
        skill_id: s.id,
        level: 1 + Math.floor(rand() * 3),
      })),
    ),
  );

  await db.from("promoter_areas").upsert(
    promoters.flatMap((p) =>
      pickSome(areas, 1 + Math.floor(rand() * 3)).map((a) => ({
        promoter_id: p.id,
        area_id: a.id,
      })),
    ),
  );

  await db.from("promoter_client_history").upsert(
    promoters
      .filter(() => chance(0.55))
      .flatMap((p) =>
        pickSome(clients, 1 + Math.floor(rand() * 2)).map((c) => ({
          promoter_id: p.id,
          client_id: c.id,
          shifts_completed: 1 + Math.floor(rand() * 12),
          avg_rating: Number(between(3.2, 5).toFixed(1)),
        })),
      ),
  );

  // --- Stores -------------------------------------------------------------
  const { data: stores, error: storesErr } = await db
    .from("stores")
    .insert(
      Array.from({ length: 15 }, () => {
        const area = pick(areas);
        return {
          agency_id: agencyId,
          client_id: pick(clients).id,
          name: `${pick(STORE_CHAINS)} ${area.name}`,
          chain: pick(STORE_CHAINS),
          address: `${area.name}, ${area.city}`,
          area_id: area.id,
          lat: area.centroid_lat + between(-0.01, 0.01),
          lng: area.centroid_lng + between(-0.01, 0.01),
        };
      }),
    )
    .select();
  if (storesErr) throw storesErr;

  // --- Campaigns, briefs, shifts -----------------------------------------
  const today = new Date();
  const dateIn = (days: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };

  const campaignRows = CLIENTS.slice(0, 3).map((c, i) => {
    const client = clients.find((x) => x.name === c.name)!;
    return {
      agency_id: agencyId,
      client_id: client.id,
      name: `${c.name} — ${c.type}`,
      campaign_type: c.type,
      starts_on: dateIn(i * 3),
      ends_on: dateIn(i * 3 + 7),
      dress_code: "Μαύρο παντελόνι / λευκό πουκάμισο",
      rate_cents: Math.round(between(3000, 5500)),
      status: "active",
    };
  });

  const { data: campaigns, error: campaignsErr } = await db
    .from("campaigns")
    .insert(campaignRows)
    .select();
  if (campaignsErr) throw campaignsErr;

  const { data: briefs, error: briefsErr } = await db
    .from("briefs")
    .insert(
      campaigns.map((c) => ({
        agency_id: agencyId,
        campaign_id: c.id,
        title: `Brief — ${c.name}`,
        body_md: [
          "## Στόχος",
          "Δειγματισμός και ενημέρωση καταναλωτών στο σημείο πώλησης.",
          "",
          "## Βασικά σημεία",
          "- Παρουσίαση του προϊόντος",
          "- Προσφορά της εβδομάδας",
          "- Καταγραφή ελλείψεων στο ράφι",
        ].join("\n"),
        published_at: new Date().toISOString(),
      })),
    )
    .select();
  if (briefsErr) throw briefsErr;

  // Which skills each campaign actually calls for — this is what skill_overlap scores against.
  await db.from("campaign_skills").upsert(
    campaigns.flatMap((c) =>
      pickSome(skills, 2 + Math.floor(rand() * 2)).map((s) => ({
        campaign_id: c.id,
        skill_id: s.id,
        required: chance(0.4),
      })),
    ),
  );

  // Roughly 40% have read the brief — the gap is exactly what a coordinator chases.
  await db.from("brief_ack").upsert(
    briefs.flatMap((b) =>
      promoters
        .filter(() => chance(0.4))
        .map((p) => ({ brief_id: b.id, promoter_id: p.id })),
    ),
  );

  const shiftRows = campaigns.flatMap((c) =>
    Array.from({ length: 8 }, () => ({
      agency_id: agencyId,
      campaign_id: c.id,
      store_id: pick(stores).id,
      on_date: dateIn(1 + Math.floor(rand() * 10)),
      start_time: pick(["10:00", "11:00", "12:00"] as const),
      end_time: pick(["18:00", "19:00", "20:00"] as const),
      promoters_required: 1 + Math.floor(rand() * 2),
      status: "open",
    })),
  );

  const { error: shiftsErr } = await db.from("shifts").insert(shiftRows);
  if (shiftsErr) throw shiftsErr;

  // --- Availability over the next two weeks -------------------------------
  const availabilityRows = promoters.flatMap((p) =>
    Array.from({ length: 14 }, (_, d) => d)
      .filter(() => chance(0.7))
      .map((d) => {
        const partial = chance(0.25);
        return {
          agency_id: agencyId,
          promoter_id: p.id,
          on_date: dateIn(d),
          status: chance(0.85) ? "available" : "unavailable",
          from_time: partial ? "17:00" : null,
          to_time: partial ? "23:00" : null,
          source: "self",
        };
      }),
  );

  const { error: availErr } = await db
    .from("availability")
    .upsert(availabilityRows, { onConflict: "promoter_id,on_date,from_time" });
  if (availErr) throw availErr;

  // --- Default scoring weights -------------------------------------------
  await db.from("scoring_weights").upsert(
    [
      { factor: "distance", weight: 1.4 },
      { factor: "brand_experience", weight: 1.2 },
      { factor: "category_experience", weight: 1.0 },
      { factor: "skill_overlap", weight: 1.0 },
      { factor: "brief_completed", weight: 0.8 },
      { factor: "reliability", weight: 1.3 },
    ].map((w) => ({ agency_id: agencyId, ...w })),
    { onConflict: "agency_id,factor" },
  );

  console.log(
    `Done. ${promoters.length} promoters · ${stores.length} stores · ` +
      `${campaigns.length} campaigns · ${shiftRows.length} shifts · ` +
      `${availabilityRows.length} availability rows.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
