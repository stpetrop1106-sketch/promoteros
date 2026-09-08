# Roadmap

Layers, not a menu. Finish one before starting the next. Each layer ends in something demonstrable
to a real coordinator — that is the test of whether it is done.

---

## L0 — Foundation (hours 0–2)

Next.js + TypeScript + Tailwind. Supabase project, schema from `data-model.md`, migrations checked in.
`scripts/seed.ts` generating **synthetic** data: ~60 promoters with realistic Athens/Thessaloniki
coordinates, 15 stores, 4 clients, 3 campaigns, availability spread across two weeks.

Seed quality decides whether every later demo lands. Do not rush it.

**Done when:** `npm run seed` produces a database that looks like a real agency's.

## L1 — Matching (hours 2–4) · *spec §4*

`match(shiftId)` as a SQL function plus a typed wrapper. Hard filters → weighted score →
ranked candidates with per-factor breakdown. Weights read from `scoring_weights`.

Coordinator UI: campaign list → shift detail → **ranked candidate table** showing name, distance,
transport, brand experience, brief status, score bar with the breakdown, and an Invite button.

**This screen is the product.** If a coordinator does not say "oh" when they see it, nothing else matters.

**Done when:** a coordinator can open a shift and see who should work it, and why.

## L2 — The loop (hours 4–7) · *spec §5, §6*

Invitation → signed expiring token → `/i/[token]` public page in Greek with shift details and
**Accept / Decline** → status updates → coverage indicator on the shift.

`ClipboardAdapter` first (the coordinator pastes into WhatsApp — exactly what they do today, so
adoption cost is zero). `TelegramAdapter` to prove the automated path end to end.

Then the replacement loop: on decline or cancellation, re-rank excluding decliners, surface the next
three, one-click re-invite.

**Done when:** decline → next candidate offered in under two seconds, with no coordinator input.

## L3 — The field (hours 7–10) · *spec §7, §10*

`/c/[token]` check-in page: one-shot geolocation, distance computed and stored, position discarded,
manual override available. Photo upload to Supabase Storage. Shift detail shows the live status board.

Mobile layout pass on the two promoter-facing pages. Greek strings. Privacy notice on the check-in page.

**Done when:** the whole cycle — match, invite, accept, check in, photo — runs on a real phone.

---

*Everything above is the one-day build. Everything below is not.*

---

## L4 — Week one

Promoter self-service availability (§2) · brief upload and acknowledgement (§9) ·
RLS policies properly enforced for all four roles · full Greek localisation ·
natural-language query → filter (§12) · read-only client view (§11) ·
timeout-based auto-escalation down the replacement ladder ·
**start WhatsApp business verification on day one — it gates everything and takes 3–10 business days**

## L5 — Month one

Full replacement engine: escalation ladders, quiet hours, per-promoter rate limits, audit trail ·
client reporting with photo galleries and export · field report summarisation ·
exception dashboard (§8) · notification delivery reconciliation ·
GDPR artifacts: privacy notice, retention job, DSR handling, DPA template for clients

## L6 — Quarter one

Supervisor route optimisation (VROOM) · learned matching weights from accept/show/rating outcomes ·
conversational coordinator that *acts* rather than queries, with approval gates ·
Viber channel · payroll-ready attendance export

---

## Sequencing rules

1. **Nothing may block on WhatsApp.** The adapter interface exists so the product ships without it.
2. **No new table without a screen that reads it.** Schema ambition is how one-day builds die.
3. **Synthetic data only**, at every layer. Not a guideline — see `CLAUDE.md` §1.
4. When a layer runs long, cut *within* it rather than starting the next one half-built.
   If L3 must be cut, cut it — L1+L2 is the story that sells.
