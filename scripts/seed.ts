/**
 * Synthetic seed data.
 *
 * Everything here is generated. No real promoter, client, or agency data ever enters this
 * project — see CLAUDE.md §1. Brand names below are invented; any resemblance to a real
 * company is unintended.
 *
 * Seed quality decides whether every later demo lands, so this aims at "looks like a real
 * agency's Tuesday", not "enough rows to render a table". Three shapes here exist because the
 * matching engine reads them (see docs/status/P0.md and P0c.md):
 *
 *   1. CAMPAIGN TYPES ARE SHARED. `category_experience` is true only when the promoter has
 *      worked for a client that runs a *different* campaign of the same type. When every
 *      campaign_type belonged to exactly one campaign the factor was 0 for every candidate on
 *      every shift — 15% of the model separating nobody. The type vocabulary is therefore
 *      short, shared, and deliberately decoupled from the client name.
 *   2. GEOGRAPHY IS COHERENT. A promoter's home sits in the city of their area, the areas they
 *      accept work in are their own plus their nearest neighbours, and stores cluster the same
 *      way. Most of the roster is in Athens with a real Thessaloniki minority, which is what an
 *      agency operating in two cities actually looks like.
 *   3. TWO PROMOTERS ARE DELIBERATELY OUT OF RANGE. Strong on every other factor and ~300 km
 *      from the Athens stores, so the maximum-distance ceiling in
 *      supabase/migrations/0007_match_radius.sql is visibly exercised rather than untested.
 *      Before 0007 is applied they top an Athens ranking, which is the defect; after it they
 *      are absent from Athens shifts and rank first on Thessaloniki ones.
 *
 * Re-running is safe: everything the seed owns is reset first, so a second run produces the
 * same database as the first rather than duplicate stores, campaigns and availability rows.
 * It resets only rows it created (matched by name), so campaigns or stores added by hand
 * through the UI survive.
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

const ATHENS = "Αθήνα";
const THESSALONIKI = "Θεσσαλονίκη";

const AREAS = [
  { name: "Μαρούσι", city: ATHENS, lat: 38.0568, lng: 23.8078 },
  { name: "Γλυφάδα", city: ATHENS, lat: 37.8631, lng: 23.7539 },
  { name: "Κηφισιά", city: ATHENS, lat: 38.0736, lng: 23.8103 },
  { name: "Περιστέρι", city: ATHENS, lat: 38.0136, lng: 23.6916 },
  { name: "Νέα Σμύρνη", city: ATHENS, lat: 37.9455, lng: 23.7141 },
  { name: "Πειραιάς", city: ATHENS, lat: 37.9475, lng: 23.6379 },
  { name: "Χαλάνδρι", city: ATHENS, lat: 38.0217, lng: 23.7997 },
  { name: "Καλλιθέα", city: ATHENS, lat: 37.9555, lng: 23.7009 },
  { name: "Κέντρο", city: THESSALONIKI, lat: 40.6401, lng: 22.9444 },
  { name: "Καλαμαριά", city: THESSALONIKI, lat: 40.5806, lng: 22.9508 },
] as const;

/**
 * Not quite one promoter in five works out of Thessaloniki. A real minority rather than a
 * token one: enough that a Thessaloniki shift still has a usable candidate list, few enough
 * that the agency reads as Athens-based.
 */
const THESSALONIKI_SHARE = 0.18;

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
  { name: "Aurora Beauty" },
  { name: "Kerasia Foods" },
  { name: "Nefeli Care" },
  { name: "Volta Electronics" },
] as const;

/**
 * The shared category vocabulary. `campaign_type` is a KIND of work, not a client's name —
 * that is precisely what makes `category_experience` an independent signal from
 * `brand_experience`. Every value below is carried by at least two campaigns, otherwise the
 * factor is structurally unreachable.
 */
const SAMPLING = "Δειγματισμός";
const PROMOTION = "Προώθηση";
const EVENT = "Event";

/**
 * Eight campaigns over four clients. The four `current` ones carry the shifts a coordinator
 * is staffing today; the four `past` ones are completed history and carry no shifts —
 * scripts/smoke.ts reads the three earliest shifts by date, and shifts in the past would give
 * it three windows nobody has declared availability for.
 *
 * Type coverage per client is what makes category_experience discriminate:
 *   Aurora  → Δειγματισμός only        Kerasia → Δειγματισμός + Event
 *   Nefeli  → Προώθηση only            Volta    → Προώθηση + Event
 * So a promoter who has only ever worked for Volta scores 0 on a Δειγματισμός shift, and one
 * who has worked for Aurora scores 1 — on a Kerasia sampling shift they have never staffed.
 */
const CAMPAIGNS = [
  {
    client: "Aurora Beauty",
    name: "Aurora Bloom — δειγματισμός αρώματος",
    type: SAMPLING,
    phase: "current",
    skills: ["Αρώματα", "Beauty & περιποίηση"],
  },
  {
    client: "Kerasia Foods",
    name: "Kerasia Deli — δειγματισμός στο ράφι",
    type: SAMPLING,
    phase: "current",
    skills: ["Supermarket sampling", "Ποτά & tasting"],
  },
  {
    client: "Nefeli Care",
    name: "Nefeli Daily — προώθηση περιποίησης",
    type: PROMOTION,
    phase: "current",
    skills: ["Beauty & περιποίηση", "Supermarket sampling"],
  },
  {
    client: "Volta Electronics",
    name: "Volta Home — προώθηση τεχνολογίας",
    type: PROMOTION,
    phase: "current",
    skills: ["Τεχνολογία", "Αγγλικά"],
  },
  {
    client: "Aurora Beauty",
    name: "Aurora Noir — δειγματισμός χειμώνα",
    type: SAMPLING,
    phase: "past",
    skills: ["Αρώματα", "Αγγλικά"],
  },
  {
    client: "Kerasia Foods",
    name: "Kerasia Festival — καλοκαιρινό activation",
    type: EVENT,
    phase: "past",
    skills: ["Events & activations", "Ποτά & tasting"],
  },
  {
    client: "Nefeli Care",
    name: "Nefeli Sun — προώθηση αντηλιακών",
    type: PROMOTION,
    phase: "past",
    skills: ["Beauty & περιποίηση", "Παιδικά προϊόντα"],
  },
  {
    client: "Volta Electronics",
    name: "Volta Back to School — activation",
    type: EVENT,
    phase: "past",
    skills: ["Events & activations", "Τεχνολογία"],
  },
] as const;

const STORE_CHAINS = ["Hyper Vega", "Agora Market", "Golden Mall", "Selini Stores"] as const;

const AGENCY_ID_SLUG = "demo-agency";

// Names this script has ever generated for campaigns and stores. The reset deletes exactly
// these and nothing else, so a campaign or store created by hand through the UI is left alone.
const SEEDED_CAMPAIGN_NAMES = [
  ...CAMPAIGNS.map((c) => c.name),
  // Names generated by earlier revisions of this file, so an old seed is cleaned up too.
  "Aurora Beauty — Δειγματισμός αρώματος",
  "Kerasia Foods — Δειγματισμός προϊόντος",
  "Nefeli Care — Προώθηση περιποίησης",
  "Volta Electronics — Προώθηση τεχνολογίας",
];

const SEEDED_STORE_NAMES = STORE_CHAINS.flatMap((chain) =>
  AREAS.map((a) => `${chain} ${a.name}`),
);

// --- Types for the rows we read back ----------------------------------------

type AreaRow = {
  id: string;
  name: string;
  city: string;
  centroid_lat: number;
  centroid_lng: number;
};
type IdNameRow = { id: string; name: string };
type PromoterRow = { id: string; full_name: string; phone: string };
type StoreRow = { id: string; name: string; client_id: string; area_id: string };
type CampaignRow = { id: string; name: string; client_id: string };

const today = new Date();
/** An ISO date offset from today. Negative for the completed past campaigns. */
function dateIn(days: number) {
  const d = new Date(today);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Metres between two points. Mirrors haversine_m() in 0003_matching.sql. */
function metresBetween(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const a =
    Math.sin(toRad(lat2 - lat1) / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lng2 - lng1) / 2) ** 2;
  return Math.round(2 * 6371000 * Math.asin(Math.sqrt(a)));
}

/** The n areas closest to `home`, in the same city. "Neighbouring", not "random". */
function neighbouringAreas(home: AreaRow, all: AreaRow[], n: number): AreaRow[] {
  return all
    .filter((a) => a.city === home.city && a.id !== home.id)
    .map((a) => ({
      area: a,
      d: metresBetween(home.centroid_lat, home.centroid_lng, a.centroid_lat, a.centroid_lng),
    }))
    .sort((x, y) => x.d - y.d)
    .slice(0, n)
    .map((x) => x.area);
}

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

  // --- Reset what this script owns ----------------------------------------
  // campaigns/stores/shifts have no natural key to upsert on, and availability's unique key
  // includes a nullable from_time (nulls are distinct in Postgres), so without this a second
  // run doubles them all — including contradictory available/unavailable rows for one day.
  console.log("  resetting previously seeded campaigns, stores and availability…");

  // Deleting a campaign cascades to its briefs, brief_ack, campaign_skills and shifts, and
  // through the shifts to assignments and invitations.
  const { error: delCampaignsErr } = await db
    .from("campaigns")
    .delete()
    .eq("agency_id", agencyId)
    .in("name", SEEDED_CAMPAIGN_NAMES);
  if (delCampaignsErr) throw delCampaignsErr;

  const { error: delStoresErr } = await db
    .from("stores")
    .delete()
    .eq("agency_id", agencyId)
    .in("name", SEEDED_STORE_NAMES);
  if (delStoresErr) {
    console.error(
      "Could not delete previously seeded stores. If this is a foreign-key violation, a shift " +
        "that this script did not create still points at one of them — delete that shift first.",
    );
    throw delStoresErr;
  }

  const { error: delAvailErr } = await db
    .from("availability")
    .delete()
    .eq("agency_id", agencyId);
  if (delAvailErr) throw delAvailErr;

  // --- Areas --------------------------------------------------------------
  const { data: areasData, error: areasErr } = await db
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
  const areas = (areasData ?? []) as AreaRow[];
  const areasIn = (city: string) => areas.filter((a) => a.city === city);
  const areaNamed = (name: string) => areas.find((a) => a.name === name)!;

  // --- Skills -------------------------------------------------------------
  const { data: skillsData, error: skillsErr } = await db
    .from("skills")
    .upsert(
      SKILLS.map((s) => ({ agency_id: agencyId, name: s.name, category: s.category })),
      { onConflict: "agency_id,name" },
    )
    .select();
  if (skillsErr) throw skillsErr;
  const skills = (skillsData ?? []) as IdNameRow[];
  const skillNamed = (name: string) => skills.find((s) => s.name === name)!;

  // --- Clients ------------------------------------------------------------
  const { data: clientsData, error: clientsErr } = await db
    .from("clients")
    .upsert(
      CLIENTS.map((c) => ({ agency_id: agencyId, name: c.name })),
      { onConflict: "agency_id,name" },
    )
    .select();
  if (clientsErr) throw clientsErr;
  const clients = (clientsData ?? []) as IdNameRow[];
  const clientNamed = (name: string) => clients.find((c) => c.name === name)!;

  // --- Promoters ----------------------------------------------------------
  /**
   * The two out-of-range ringers. They exist so the radius ceiling is tested by the demo
   * rather than assumed: both live in Thessaloniki, ~300 km from every Athens store, and are
   * strong on every other factor. Without 0007 the first one ranks FIRST on an Athens shift —
   * a promoter who would have to cross the country, recommended above someone two streets away.
   */
  const RINGERS = [
    { name: "Κατερίνα Βασιλείου", area: "Κέντρο", reliability: 0.97, historyShifts: 12 },
    { name: "Στέλιος Παππάς", area: "Καλαμαριά", reliability: 0.93, historyShifts: 8 },
  ] as const;

  const promoterPlans = Array.from({ length: 60 }, (_, i) => {
    const ringer = RINGERS[i];
    const homeArea = ringer
      ? areaNamed(ringer.area)
      : pick(areasIn(chance(THESSALONIKI_SHARE) ? THESSALONIKI : ATHENS));

    return {
      index: i,
      ringer,
      homeArea,
      row: {
        agency_id: agencyId,
        full_name: ringer ? ringer.name : `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
        // Synthetic numbers in a clearly non-routable pattern.
        phone: `69000${String(10000 + i).slice(-5)}`,
        email: `promoter${i + 1}@example.invalid`,
        birth_year: Math.floor(between(1985, 2005)),
        // Set explicitly and consistently with the coordinates below. The promoter form does
        // not populate it yet, but matching and every "who works this area" question need it.
        home_area_id: homeArea.id,
        // Jitter around the area centroid so distances are meaningful but nobody is real.
        home_lat: homeArea.centroid_lat + between(-0.02, 0.02),
        home_lng: homeArea.centroid_lng + between(-0.02, 0.02),
        has_car: ringer ? true : chance(0.45),
        has_licence: ringer ? true : chance(0.6),
        status: ringer ? "active" : chance(0.9) ? "active" : "paused",
        reliability_score: ringer
          ? ringer.reliability
          : Number(between(0.55, 1).toFixed(2)),
      },
    };
  });

  const { data: promotersData, error: promotersErr } = await db
    .from("promoters")
    .upsert(
      promoterPlans.map((p) => p.row),
      { onConflict: "agency_id,phone" },
    )
    .select();
  if (promotersErr) throw promotersErr;
  const promoters = (promotersData ?? []) as PromoterRow[];

  // Upsert does not guarantee row order, so re-join the plan to the persisted row by phone.
  const byPhone = new Map(promoters.map((p) => [p.phone, p]));
  const plans = promoterPlans.map((p) => ({ ...p, db: byPhone.get(p.row.phone)! }));
  const promoterIds = promoters.map((p) => p.id);

  // Child rows are regenerated, not merged: a previous run's random draws would otherwise
  // pile up alongside this one's.
  for (const table of ["promoter_skills", "promoter_areas", "promoter_client_history"]) {
    const { error } = await db.from(table).delete().in("promoter_id", promoterIds);
    if (error) throw error;
  }

  const skillRows = plans.flatMap((p) =>
    (p.ringer
      ? // Broad skills: the ringers must be strong on skill_overlap too, or the ceiling looks
        // like it is only removing weak candidates.
        pickSome(skills, 5)
      : pickSome(skills, 1 + Math.floor(rand() * 3))
    ).map((s) => ({
      promoter_id: p.db.id,
      skill_id: s.id,
      level: p.ringer ? 3 : 1 + Math.floor(rand() * 3),
    })),
  );
  const { error: pSkillsErr } = await db.from("promoter_skills").insert(skillRows);
  if (pSkillsErr) throw pSkillsErr;

  // Where they will actually work: their own area plus its nearest neighbours in the same
  // city. Previously these were random, which made "accepts this area" meaningless.
  const areaRows = plans.flatMap((p) => {
    const chosen = [p.homeArea, ...neighbouringAreas(p.homeArea, areas, 1 + Math.floor(rand() * 2))];
    return chosen.map((a) => ({ promoter_id: p.db.id, area_id: a.id }));
  });
  const { error: pAreasErr } = await db.from("promoter_areas").insert(areaRows);
  if (pAreasErr) throw pAreasErr;

  // History with a client is what brand_experience reads, and — through that client's other
  // campaigns — what category_experience reads. Roughly half the roster has some.
  const historyRows = plans.flatMap((p) => {
    const withClients = p.ringer ? clients : chance(0.55) ? pickSome(clients, 1 + Math.floor(rand() * 2)) : [];
    return withClients.map((c) => ({
      promoter_id: p.db.id,
      client_id: c.id,
      shifts_completed: p.ringer ? p.ringer.historyShifts : 1 + Math.floor(rand() * 12),
      last_worked_on: dateIn(-Math.floor(between(10, 180))),
      avg_rating: Number(between(3.2, 5).toFixed(1)),
    }));
  });
  const { error: histErr } = await db.from("promoter_client_history").insert(historyRows);
  if (histErr) throw histErr;

  // --- Stores -------------------------------------------------------------
  // Four Athens stores and one Thessaloniki store per client: the agency's centre of gravity
  // is Athens, but it genuinely operates in both cities.
  const storeRows = clients.flatMap((client) => {
    const athens = pickSome(areasIn(ATHENS), 4);
    const north = pick(areasIn(THESSALONIKI));
    return [...athens, north].map((area) => {
      const chain = pick(STORE_CHAINS);
      return {
        agency_id: agencyId,
        client_id: client.id,
        name: `${chain} ${area.name}`,
        chain,
        address: `${area.name}, ${area.city}`,
        area_id: area.id,
        lat: area.centroid_lat + between(-0.01, 0.01),
        lng: area.centroid_lng + between(-0.01, 0.01),
      };
    });
  });

  const { data: storesData, error: storesErr } = await db
    .from("stores")
    .insert(storeRows)
    .select();
  if (storesErr) throw storesErr;
  const stores = (storesData ?? []) as StoreRow[];

  const athensAreaIds = new Set(areasIn(ATHENS).map((a) => a.id));
  const storesFor = (clientId: string, athensOnly: boolean) =>
    stores.filter(
      (s) => s.client_id === clientId && (!athensOnly || athensAreaIds.has(s.area_id)),
    );

  // --- Campaigns, briefs, shifts -----------------------------------------
  const campaignRows = CAMPAIGNS.map((c, i) => {
    const client = clientNamed(c.client);
    const past = c.phase === "past";
    return {
      agency_id: agencyId,
      client_id: client.id,
      name: c.name,
      campaign_type: c.type,
      starts_on: past ? dateIn(-120 + i * 10) : dateIn(i * 3),
      ends_on: past ? dateIn(-100 + i * 10) : dateIn(i * 3 + 7),
      dress_code: "Μαύρο παντελόνι / λευκό πουκάμισο",
      rate_cents: Math.round(between(3000, 5500)),
      status: past ? "completed" : "active",
    };
  });

  const { data: campaignsData, error: campaignsErr } = await db
    .from("campaigns")
    .insert(campaignRows)
    .select();
  if (campaignsErr) throw campaignsErr;
  const campaigns = (campaignsData ?? []) as CampaignRow[];
  const campaignNamed = (name: string) => campaigns.find((c) => c.name === name)!;
  const currentCampaigns = CAMPAIGNS.filter((c) => c.phase === "current").map((c) => ({
    def: c,
    row: campaignNamed(c.name),
  }));

  const { data: briefsData, error: briefsErr } = await db
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
  const briefs = (briefsData ?? []) as { id: string; campaign_id: string }[];

  // Which skills each campaign actually calls for — this is what skill_overlap scores against.
  const campaignSkillRows = CAMPAIGNS.flatMap((c) =>
    c.skills.map((name) => ({
      campaign_id: campaignNamed(c.name).id,
      skill_id: skillNamed(name).id,
      required: chance(0.4),
    })),
  );
  const { error: cSkillsErr } = await db.from("campaign_skills").insert(campaignSkillRows);
  if (cSkillsErr) throw cSkillsErr;

  // Roughly 40% have read the brief — the gap is exactly what a coordinator chases.
  const ackRows = briefs.flatMap((b) =>
    plans
      .filter((p) => p.ringer || chance(0.4))
      .map((p) => ({ brief_id: b.id, promoter_id: p.db.id })),
  );
  const { error: ackErr } = await db.from("brief_ack").insert(ackRows);
  if (ackErr) throw ackErr;

  // Shifts belong to a store of the campaign's own client, and four in five are in Athens.
  const shiftRows = currentCampaigns.flatMap((c) =>
    Array.from({ length: 6 }, () => {
      const athensOnly = chance(0.8);
      const pool = storesFor(c.row.client_id, athensOnly);
      const fallback = storesFor(c.row.client_id, false);
      return {
        agency_id: agencyId,
        campaign_id: c.row.id,
        store_id: pick(pool.length > 0 ? pool : fallback).id,
        on_date: dateIn(1 + Math.floor(rand() * 10)),
        start_time: pick(["10:00", "11:00", "12:00"] as const),
        end_time: pick(["18:00", "19:00", "20:00"] as const),
        promoters_required: 1 + Math.floor(rand() * 2),
        status: "open",
      };
    }),
  );

  const { error: shiftsErr } = await db.from("shifts").insert(shiftRows);
  if (shiftsErr) throw shiftsErr;

  // --- Availability over the next two weeks -------------------------------
  const availabilityRows = plans.flatMap((p) =>
    Array.from({ length: 14 }, (_, d) => d)
      .filter(() => p.ringer || chance(0.7))
      .map((d) => {
        // The ringers are free all day, every day: they must clear the hard filters so that
        // the only thing that can remove them is the distance ceiling.
        const partial = p.ringer ? false : chance(0.25);
        return {
          agency_id: agencyId,
          promoter_id: p.db.id,
          on_date: dateIn(d),
          status: p.ringer ? "available" : chance(0.85) ? "available" : "unavailable",
          from_time: partial ? "17:00" : null,
          to_time: partial ? "23:00" : null,
          source: "self",
        };
      }),
  );

  const { error: availErr } = await db.from("availability").insert(availabilityRows);
  if (availErr) throw availErr;

  // --- Default scoring weights -------------------------------------------
  // `params` on the distance row carries the hard radius ceiling read by match_promoters
  // (0007_match_radius.sql). It is written explicitly here so the knob is discoverable in the
  // settings screen rather than living only in a SQL default.
  const { error: weightsErr } = await db.from("scoring_weights").upsert(
    [
      { factor: "distance", weight: 1.4, params: { max_distance_km: 60 } },
      { factor: "brand_experience", weight: 1.2, params: {} },
      { factor: "category_experience", weight: 1.0, params: {} },
      { factor: "skill_overlap", weight: 1.0, params: {} },
      { factor: "brief_completed", weight: 0.8, params: {} },
      { factor: "reliability", weight: 1.3, params: {} },
    ].map((w) => ({ agency_id: agencyId, ...w })),
    { onConflict: "agency_id,factor" },
  );
  if (weightsErr) throw weightsErr;

  const northPromoters = plans.filter((p) => p.homeArea.city === THESSALONIKI).length;
  const northStores = stores.filter((s) => !athensAreaIds.has(s.area_id)).length;

  console.log(
    `Done. ${promoters.length} promoters (${northPromoters} in ${THESSALONIKI}, ` +
      `${RINGERS.length} deliberately out of range of the Athens stores) · ` +
      `${stores.length} stores (${northStores} in ${THESSALONIKI}) · ` +
      `${campaigns.length} campaigns over ${new Set(CAMPAIGNS.map((c) => c.type)).size} shared ` +
      `types · ${shiftRows.length} shifts · ${availabilityRows.length} availability rows.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
