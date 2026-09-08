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

---

## Open questions

Answer before the layer that depends on them; do not let them block earlier work.

| # | Question | Blocks | Default if unanswered |
|---|---|---|---|
| Q4 | Flat per-agency pricing (€249/mo) or per-active-promoter? | Not the build | Flat — predictable beats cheap in this market |
| Q5 | Which messaging channel do Greek promoters actually tap? Worth testing manually with ten people before we build for it. | L4 channel choice | WhatsApp |
| Q6 | Do promoters ever work for more than one agency in our system? Affects whether phone number is unique per tenant or globally. | L4 promoter self-service | Unique per tenant only |

*Resolved: Q1 → D8 · Q2 → D9 · Q3 → D7*
