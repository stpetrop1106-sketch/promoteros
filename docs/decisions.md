# Decisions

Append-only. New decisions go at the bottom with a date. If you change one, add a new entry that
supersedes it rather than editing history.

---

### D1 — Next.js + Supabase · 2026-08-25
One app, server actions, no separate API layer. Supabase gives Postgres, auth, storage and RLS in one
service, and the promoter-facing pages need no auth at all because they use signed tokens — which
removes the single biggest day-one time sink. Rails and Django were credible but would mean
hand-rolling storage and row-level auth. No-code was rejected: the tokenized public pages, the scoring
function and the geolocation check-in all fight the platform.

### D2 — Matching is a scoring function, not an LLM · 2026-08-25
Deterministic, explainable, tunable. The coordinator has to see why someone ranked third and override
it. An LLM would cost explainability and add nothing. AI is confined to the three narrow uses in
`CLAUDE.md`.

### D3 — Invitations are signed magic links; channels are adapters · 2026-08-25
WhatsApp Business API requires Meta business verification and template approval — 3–10 business days,
outside our control, and every invitation we send is business-initiated so 100% of them are template
messages. Building the loop on signed token URLs makes the transport swappable and lets the product
work on day one via clipboard, which is what agencies already do manually.

### D4 — Check-in stores derived distance, never a position trail · 2026-08-25
Greek DPA applies Article 29 WP Opinion 2/2017; there is likely no legal basis for monitoring worker
location outside agreed hours. One-shot foreground capture, persist `distance_from_store_m` and
`within_geofence`, discard coordinates, always offer a manual override. Retrofitting this later is
painful, so it is fixed now.

### D5 — Legal basis is contract necessity + legitimate interest, not consent · 2026-08-25
The Greek DPA fined a company €150,000 for asking employees to consent to processing — the power
imbalance makes consent non-free. Consent remains the right basis for marketing-category messaging only.

### D6 — Hard tenant isolation, no shared talent pool · 2026-08-25
Greek agencies compete for the same clients and the same promoters. The moment agency A can see
agency B's roster the product is unsellable here. No cross-tenant analytics or benchmarks either,
however tempting the feature.

### D7 — Promotion-specific domain language, single vertical · 2026-08-25
`promoter`, `campaign`, `brief`, `shift` — not `worker`, `job`, `instructions`. Adjacent verticals
(private security, hospitality staffing) are commercially interesting and have better seasonality, but
abstracting the schema for them now would make every screen vaguer and cost the demo its immediacy.
If we enter those verticals, it is one rename migration, taken deliberately.

### D8 — No ERGANI compliance layer for now · 2026-08-25
The digital work card was identified in research as the strongest commercial wedge, but the deadline and
sector codes were only sourced secondhand and the product is being built to the original spec.
Not in the roadmap. Revisit only if prospects raise it, and verify the facts first-hand before building.

### D9 — Bilingual (el/en) from the first screen · 2026-08-25
Not "Greek now, i18n later". Retrofitting i18n means touching every component a second time, and the
EU market has to be reachable from month one. Greek is the reference locale: written first, English
follows in the same edit. Both files change together or the build fails.

### D10 — `campaign_skills` added to the schema · 2026-08-25
Not in the original data model. Without it, `skill_overlap` would have to guess a match by
comparing `campaign_type` text against `skills.category`, which is a fake signal that would quietly
corrupt every ranking. A campaign now declares which skills it wants and the score measures real
overlap. Added under the rule "no new table without a screen that reads it" — the match screen reads it.

### D11 — Invitations are created, then their token is minted · 2026-08-25
The row is inserted first so the token can carry the real invitation id, then the row is updated
with the token hash. The alternative — generating an id client-side — would mean trusting an
identifier that never passed through the database.

### D12 — Geocoding behind a provider adapter · 2026-08-25
Same shape as the messaging adapters, for the same reason. Nominatim is fine for development but its
usage policy does not cover commercial volume, so the production provider will be a paid one. Feature
code calls `getGeocoder()` and never learns which. Manual lat/lng stays available as an override —
Greek addresses geocode imperfectly and a coordinator must be able to correct a pin.

### D13 — Auth and RLS ship together, in the first wave · 2026-08-25
The original plan had coordinator pages on the service-role client with an RLS swap scheduled later.
Rejected: it creates an insecure interim state in a product intended for sale, and the swap would be
a cross-lane rewrite mid-build. One parcel, done once, before any coordinator screen is written.
Service-role access survives only on token-verified promoter paths.

### D14 — Promoter links are hardened in v1, not later · 2026-08-25
`/i/[token]` and `/c/[token]` are unauthenticated URLs pointing at a named person's shift, phone and
location. Rate limiting, database-level single-use enforcement and expiry cleanup are must-have for
v1 rather than hardening debt, because this is the failure mode that would end the product and it is
cheap now and expensive later.

### D15 — An expired trial gets the same 14-day grace as a failed card · 2026-09-10
Approved by Stella. The alternative was immediate lockout at trial end. Rejected because the failure
mode is identical to a failed card and so is the damage: a coordinator locked out mid-campaign with
promoters standing in stores turns our billing event into their client's incident. Someone whose
trial lapsed on a Friday is also the person most likely to buy on the Monday, and locking them out is
the worst possible moment to ask for a card.

### D16 — `past_due_since` is a real column, not a derived value · 2026-09-10
Approved by Stella. The 14-day grace window needs a start that does not move. Deriving it from the
latest `invoice.payment_failed` would restart the clock on every dunning retry, so an agency in
permanent dunning would keep full access forever. The column is written once when the subscription
first enters `past_due` and cleared when it leaves.

### D17 — The first platform admin is seeded by hand · 2026-09-10
There is no code path that inserts into `platform_admins`, because any such path would be a path to
every customer's data. Seeding is a single manual `insert` in the SQL editor, documented in the tail
of `0013_admin.sql`. Until it runs, `/admin` returns 404 to everyone — the correct default for a
console with nobody in it.

### D18 — Spreadsheet parsing with SheetJS 0.20.3 from the vendor's CDN · 2026-09-13
The Excel import (round 2, item 5) needs .xlsx, legacy .xls and Greek CSV. SheetJS is the only
library that reads all three. Its npm registry copy is frozen at 0.18.5 with CVE-2023-30533
(prototype pollution) and CVE-2024-22363 (ReDoS); the vendor now publishes maintained releases only
from `cdn.sheetjs.com`, which is where the dependency points. `exceljs` was the alternative and does
not read .xls. SheetJS is loaded only by `readWorkbook`, in the browser, when a file is dropped — the
server-side re-validation path never imports it.

### D19 — Automatic promoter messages go by email first · 2026-09-13
The owner asked for availability links to reach promoters without a coordinator sending them.
WhatsApp Business needs Meta verification outside our control, Viber in Greece carries a €150/month
minimum, and promoters do not have Telegram chat ids. Email through Resend is the one channel we can
automate today, so it is the first automated adapter — behind the adapter interface, like every
channel. A promoter with no email is not silently skipped: the coordinator gets a list of exactly
who could not be reached, with the link ready to send by WhatsApp. This keeps D3 (adapters, not
conditionals) and revisits Q5 once real promoters show which channel they open.

### D20 — Sections of shifts are programmes inside a campaign · 2026-09-13
The owner asked for "as many sections of shifts as the agency wants", because clients send separate
programmes. A section could have been a free-form tag. It is instead a `shift_programmes` row owned by
exactly one campaign, because a shift already cannot exist without a campaign, and because the Excel
import needs a campaign to attach shifts to anyway. A composite foreign key makes it impossible in
the database to file a shift under another campaign's section or another agency's.

---

## Open questions

Answer before the layer that depends on them; do not let them block earlier work.

| # | Question | Blocks | Default if unanswered |
|---|---|---|---|
| Q4 | Flat per-agency pricing (€249/mo) or per-active-promoter? | Not the build | Flat — predictable beats cheap in this market |
| Q5 | Which messaging channel do Greek promoters actually tap? Worth testing manually with ten people before we build for it. | L4 channel choice | WhatsApp |
| Q6 | Do promoters ever work for more than one agency in our system? Affects whether phone number is unique per tenant or globally. | L4 promoter self-service | Unique per tenant only |

*Resolved: Q1 → D8 · Q2 → D9 · Q3 → D7*
