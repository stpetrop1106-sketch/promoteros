# Build plan — v1 weekend

Read this before touching the repo. It is the coordination contract between every agent working
here. `CLAUDE.md` / `AGENTS.md` say *how* to write code; this says *who writes what, in what order,
and how we know it is finished*.

---

## 1. What we are building

A coordinator opens a shift, sees a ranked list of promoters with the reason each one ranked where
they did, sends an invitation, and the promoter accepts or declines from a link on their phone
without logging in. If they decline, the next candidates surface immediately. On the day, the
promoter confirms arrival and uploads a photo from the store.

That sentence is the product. Everything else is support for it.

## 2. Definition of done for v1

**v1 succeeds when Stella can run one full week of her own work through the tool, alone, without
touching a spreadsheet.**

Not a pitch demo. Not yet a pilot with other people's promoters. A working instrument she uses
herself to find out whether the workflow holds up.

### 2.1 The standard — this becomes a product for sale

v1 is the first version of software other agencies will eventually pay for and run their operations
on. That fixes one rule above all others:

> **Speed comes from cutting scope, never from cutting rigour.**
> We build fewer things. We do not build them provisionally.

What that means in practice, decided rather than left open:

| Never shortcut | Why |
|---|---|
| **Auth and tenant isolation** | A product that can leak one agency's roster to another is unsellable, and the leak is discovered by the customer. RLS is enforced from the first screen, not retrofitted |
| **The security of promoter-facing links** | They are unauthenticated URLs to personal data. Signed, expiring, single-use, rate-limited, hashed at rest |
| **The GDPR-shaping decisions** | One-shot geolocation, no position trail, legal basis, retention. Retrofitting these means a migration and a rewrite of the check-in flow |
| **The matching engine's correctness** | The ranking *is* the product. A silent regression is invisible in a UI and fatal in a sales meeting |
| **Schema shape** | Migrations against live customer data are the most expensive thing in this codebase |

| Cut freely | Why |
|---|---|
| Features (reporting, payroll, client portal, supervisor routes) | They are `roadmap.md` L5/L6 and cost nothing to defer |
| Visual polish, empty states, animation | Nobody but Stella sees v1 |
| Breadth (bulk import, integrations, second language beyond el/en) | Depth on the core loop is what proves the product |
| Edge cases in *Stella's own* usage | She can work around her own tool; a customer cannot |

**The test for any decision an agent faces:** would we have to undo this when the second agency signs
up? If yes, do it properly now. If no, do the fastest thing that works.

### 2.2 Because v1 is a self-test tool

| Required | Not required |
|---|---|
| Promoter / campaign / shift creation UI — she enters her own data | Bulk import, CSV upload |
| Real login, one agency, one role | Role permissions, client portal, supervisor app |
| Visible score breakdown and weight tuning | Learned weights, natural-language query |
| Promoter pages work on a real phone over HTTPS | Real WhatsApp channel, push notifications |

### 2.3 The acceptance test

One person, one sitting, no code changes:

1. Log in. Create a campaign with a client, a store, and three shifts.
2. Add eight promoters with real addresses spread across the city, varying cars and skills.
3. Set availability for those promoters across the week.
4. Open a shift → see a ranked list where the ordering is defensible.
5. Invite the top candidate → open the link on a phone → accept.
6. Invite a second → decline → see replacements offered without going back to search.
7. On the day, open the check-in link on a phone → confirm arrival → upload a photo.
8. See a board showing who is confirmed, who checked in, who has not responded.

If all eight run, v1 is done. If seven run, v1 is not done.

## 3. Data rule — restated because v1 changes the temptation

"Test it yourself" is exactly the moment someone reaches for the real roster. Do not.

Use invented promoters and Stella's own phone number. No name, phone, client, store list, brief, or
report template from any real agency enters this repo or this database, in any parcel, for any
reason. See `CLAUDE.md` §1 — the constraint with legal consequences, not a preference.

---

## 4. Current state — verified vs written

Agents must know which ground is solid. Written ≠ working.

| Layer | State | Evidence |
|---|---|---|
| Schema (`0001`, `0002`) | **Verified** | Migrations applied to the cloud project |
| Seed | **Verified** | Ran: 60 promoters, 15 stores, 3 campaigns, 24 shifts, 579 availability rows |
| `match_promoters` (`0003`) | **Applied, never executed** | Migration ran after three fixes. No query has returned a row yet |
| Invitation loop (`lib/invitations.ts`, `/i/[token]`) | **Written, never executed** | Typechecks. Nothing more |
| Check-in, field reports | **Not started** | — |
| Auth | **Not started** | Coordinator pages run on the service-role client — `TODO(L4)` |
| Design system | **In progress (Codex)** | Tokens landed in `globals.css`, `layout.tsx` |

**P0 exists because of row three.** Nothing may be built on the matching engine until one query has
returned candidates.

---

## 5. Working rules for parallel agents

With 3–4 agents in one folder, collisions are the main threat to the weekend — not difficulty.

### 5.1 One file, one owner

Every file belongs to exactly one lane. An agent needing a change in another lane's file
**requests it in the handoff notes and does not make it**. §8 assigns ownership.

### 5.2 Shared files have special rules

| File | Rule |
|---|---|
| `lib/i18n/el.ts` + `en.ts` | **Append only**, at the end of your feature's own key block. Never reorder or reformat, never touch another block. Both files in the same edit |
| `supabase/migrations/` | **Never edit an applied migration.** Add `00NN_<name>.sql` with the next free number, claimed in §8 before writing |
| `app/globals.css`, `app/layout.tsx` | **Lane D only.** Other lanes use existing tokens; if a token is missing, request it |

### 5.3 Contracts are frozen before parallel work starts

The types in §6 are the seams between parcels. An agent needing to change one **stops and raises it**.
A silent change to a shared type breaks another agent's in-flight work, and neither sees it until
integration.

### 5.4 Commit discipline

Small commits, one parcel per branch, parcel id in the message (`P4: campaign and shift creation`).
Never commit `.env`. Run `npm run typecheck && npm test` before every commit.

### 5.5 Definition of done, per parcel

Acceptance criteria met · `npm run typecheck` clean · tests pass and new logic has one · both locale
files updated · no file outside the parcel's globs modified · handoff note written. Not before.

---

## 6. Frozen contracts

**Matching** — `lib/matching/index.ts`
```ts
matchPromoters(shiftId: string, limit?: number): Promise<Candidate[]>
topReasons(candidate: Candidate, n?: number): MatchFactor[]
// Candidate: promoterId, fullName, phone, distanceM, hasCar, briefCompleted,
//            brandShifts, skillHits, reliability, score (0..1), breakdown
```

**Invitations** — `lib/invitations.ts`
```ts
createInvitation(shiftId, promoterId, ttlHours?): Promise<{ url, manualBody, delivered }>
loadInvitation(token): Promise<{ ok: true, view: InvitationView } | { ok: false, reason }>
respondToInvitation(token, "accept" | "decline", reason?): Promise<…>
refreshShiftStatus(shiftId): Promise<void>
```

**Tokens** — `lib/tokens.ts`
```ts
mintToken(purpose: "invitation" | "checkin", recordId, ttlSeconds)
verifyToken(token, expected): VerifyResult
linkFor(token, purpose): string
```
Check-in reuses this with purpose `"checkin"`. P9 must not invent a second token scheme.

**Geocoding** — `lib/geocoding/index.ts` (P3 creates it)
```ts
interface GeocodingProvider { geocode(address: string): Promise<Coordinates | null> }
getGeocoder(): GeocodingProvider
```
Same adapter shape as messaging, for the same reason: the dev provider and the commercial provider
are different, and feature code must not care. See D12.

**i18n** — `translatorFor(locale)` returns `t(key, params?)`. Keys typed from `el.ts`.

**Routes** — `/login`, `/shifts`, `/shifts/[id]`, `/promoters`, `/campaigns`, `/settings/scoring`,
`/i/[token]`, `/c/[token]`.

**Design tokens** — `--color-ink`, `--color-muted`, `--color-line`, `--color-canvas`,
`--color-surface`, `--color-accent`, `--color-accent-hover`, `--color-action`, `--color-action-hover`,
`--color-ok`, `--color-warn`, `--color-bad`. Use these; never a raw hex.

---

## 7. Lanes

| Lane | Scope | Owns |
|---|---|---|
| **A — Domain** | Schema, matching, invitations, auth, server actions, data access | `lib/**` (except `i18n`), `supabase/migrations/**`, `scripts/**`, `tests/**` |
| **B — Coordinator UI** | Everything the coordinator sees | `app/shifts/**`, `app/promoters/**`, `app/campaigns/**`, `app/settings/**` |
| **C — Promoter UI** | Everything on a promoter's phone | `app/i/**`, `app/c/**` |
| **D — Shell & design** | Tokens, layout, shared components, i18n plumbing | `app/globals.css`, `app/layout.tsx`, `app/login/**`, `components/**`, `lib/i18n/index.ts` |

Codex is currently in Lane D. Keep it there or move it deliberately — not by accident.

---

## 8. Parcels

**M** = must for the acceptance test · **S** = should · **C** = cut first if behind.

### Wave 0 — serial, blocks everything

| # | Parcel | Lane | Owns | Acceptance | Size | Pri |
|---|---|---|---|---|---|---|
| **P0** | **Prove the matching engine** | A | `scripts/smoke.ts`, migration `0004` if needed | `npm run smoke` prints ranked candidates for 3 seeded shifts with plausible ordering. SQL errors fixed in a *new* migration, never by editing `0003` | 1h | **M** |
| **P0b** | **Deploy pipeline** | A | `vercel.json`, `docs/deploy.md` | Pushed to Vercel, EU region, env vars set, preview URL live over HTTPS. Every later parcel is tested there, not only on localhost | 1h | **M** |

Nothing else starts until P0 is green — every UI parcel would be building on sand.

P0b is first, not last, for a concrete reason: **phone geolocation requires HTTPS**, `localhost` is
exempt but a LAN IP is not. Discovering that in Wave 3 costs a day.

### Wave 1 — parallel

| # | Parcel | Lane | Owns | Depends | Acceptance | Size | Pri |
|---|---|---|---|---|---|---|---|
| **P1** | **Auth + RLS end to end** | A + D | `lib/supabase/**`, `lib/auth.ts`, `app/login/**`, migration `0005`, all existing `app/**/actions.ts` | P0 | Email magic-link login; `app_users` row on first login; **every page and action uses the RLS-scoped client**; `TODO(L4)` gone; service-role reachable only from token-verified paths. Test proves a second agency's rows are invisible | 4h | **M** |
| **P2** | Design system components | D | `components/**`, `app/globals.css` | — | `Button`, `Card`, `Table`, `Field`, `Badge`, `PageHeader` — tokens only, both locales, mobile-first | 3h | **M** |
| **P3** | Promoter CRUD + geocoding | B + A | `app/promoters/**`, `lib/geocoding/**` | P0 | Create, edit, list, archive a promoter. Address geocodes to lat/lng through the provider adapter, with a manual override. List searchable | 4h | **M** |
| **P15** | Test harness | A | `tests/**`, `vitest.config.ts` | — | `npm test` runs. Covers `distanceScore`, `mintToken`/`verifyToken` (including tampered, expired, wrong-purpose), and a `match_promoters` assertion that ordering is stable | 2h | **M** |

**P1 absorbed the old "swap service-role for RLS" parcel.** Shipping pages against the admin client
and fixing it later would mean a cross-lane rewrite mid-weekend and an insecure interim state in a
product meant for sale. It is one parcel, done once, at the start. It is the only parcel that spans
two lanes — schedule it when B and C are idle.

### Wave 2 — parallel

| # | Parcel | Lane | Owns | Depends | Acceptance | Size | Pri |
|---|---|---|---|---|---|---|---|
| **P4** | Campaign + shift creation | B | `app/campaigns/**` | P1, P2 | Create a client, campaign with dates and rate, stores, and N shifts. Shifts appear in `/shifts` | 3h | **M** |
| **P5** | Availability entry | B | `app/promoters/[id]/availability/**` | P3 | Available/unavailable per promoter per day including partial days. Feeds the matching hard filter | 2h | **M** |
| **P16** | **Promoter-link hardening** | A + C | `lib/tokens.ts`, `middleware.ts`, migration `0006` | P1 | Rate limiting on `/i/*` and `/c/*` by IP and by token; single-use enforced at the database, not only in application logic; expired-token cleanup job; no personal data in any URL or log line | 3h | **M** |

P16 is a **must**, not a nice-to-have. These are unauthenticated URLs pointing at a named person's
shift and phone number. Getting this wrong is the failure mode that ends the product, and it is
cheap now and expensive later.

### Wave 3 — parallel

| # | Parcel | Lane | Owns | Depends | Acceptance | Size | Pri |
|---|---|---|---|---|---|---|---|
| **P7** | Invitation loop, end to end | C | `app/i/**` | P0, P2, P16 | Invite from the ranked list → link opens on a real phone → accept writes an assignment → coverage updates. Decline recorded. Verified on the deployed URL | 2h | **M** |
| **P8** | Replacement panel | B | `app/shifts/[id]/replacements.tsx` | P7 | On decline or cancellation the next 3 candidates appear on the shift page with one-click re-invite. No manual re-search | 2h | **M** |
| **P9** | Check-in | C | `app/c/**`, migration `0007` | P7, P16 | One-shot foreground position; stores distance + geofence boolean only; manual override; privacy notice on the page; works on a real phone over HTTPS | 3h | **M** |

### Wave 4 — parallel, finish

| # | Parcel | Lane | Owns | Depends | Acceptance | Size | Pri |
|---|---|---|---|---|---|---|---|
| **P10** | Shift status board | B | `app/shifts/[id]/board.tsx` | P9 | Per shift: confirmed / checked in / waiting / no response, exceptions surfaced first | 2h | **M** |
| **P13** | Weight tuning UI | B | `app/settings/scoring/**` | P0 | Adjust the six weights and watch the ranking change. This is how we learn whether the model is right — promoted from "cut" because it is the point of the self-test | 2h | **S** |
| **P11** | Field report + photo | C | `app/c/[token]/report/**` | P9 | Units, interactions, stock issues, notes, photo to Supabase Storage, attached to the assignment | 3h | **S** |
| **P12** | Locale switcher + i18n sweep | D | `lib/i18n/index.ts`, `components/locale-switcher.tsx` | P2 | Locale persists per user; no hardcoded user-facing string; both dictionaries complete | 2h | **S** |
| **P14** | Reseed + walkthrough | A | `scripts/**`, `docs/walkthrough.md` | all | One command resets to a clean state; the eight acceptance steps written down | 1h | **S** |

### Wave 5 — commercial surface

Design in `docs/commercial-architecture.md`. These make it a product someone can buy rather than a
tool one person uses. They come *after* the core loop works — billing for a product that does not
work yet is the wrong order — but the schema they need is shaped in P1 so nothing has to be undone.

| # | Parcel | Lane | Owns | Depends | Acceptance | Size | Pri |
|---|---|---|---|---|---|---|---|
| **P19** | Accounts, team, onboarding | A + B | `app/onboarding/**`, `app/settings/team/**`, migration `0011` | P1, P2 | Sign-up creates an agency; guided first run ends at a ranked shift; owner invites staff by email with roles; invitations expire | 4h | **S** |
| **P17** | Billing (Stripe) | A + B | `lib/billing/**`, `app/api/stripe/**`, `app/settings/billing/**`, migration `0009` | P19 | Checkout subscribes an agency; webhook writes `subscription_status`; Billing Portal handles card, invoices, cancellation; `past_due` warns but does not lock out; `canceled` is read-only, never destructive. Runs fully in Stripe test mode | 5h | **S** |
| **P18** | Admin console | A + B | `app/admin/**`, `lib/admin/**`, migration `0010` | P19 | Separate `platform_admins` table; agency list with subscription and usage; read-only customer view requiring a typed reason; time-boxed support session with a visible banner; append-only `admin_audit_log` with no delete path | 5h | **S** |
| **P20** | Idiot-proofing pass | B + C | assigned per screen at the time | all above | Every screen audited against `commercial-architecture.md` §6: one primary action, teaching empty states, typed confirmation for destructive actions, specific errors, no dead ends | 4h | **S** |

**Totals:** must ≈ 25h · should (v1) ≈ 8h · commercial ≈ 18h.

---

## 9. Sequencing

```
Wave 0   P0 → P0b                              serial,   ~2h
Wave 1   P1 · P2 · P3 · P15                    parallel, ~4h
Wave 2   P4 · P5 · P16                         parallel, ~3h
Wave 3   P7 · P8 · P9                          parallel, ~3h
Wave 4   P10 · P13 · P11 · P12 · P14           parallel, ~3h
```

Roughly 15 hours of wall clock at three agents — a weekend with room for the two or three things
that will go wrong. **That slack is the plan, not padding.**

**Integration checkpoint at the end of each wave.** One agent runs `npm run typecheck && npm test`
plus the acceptance steps reached so far, on the deployed URL. Never start a wave on a broken tree.

---

## 10. Handing a parcel to an agent

Give exactly this. Anything less and the agent invents scope.

```
Read CLAUDE.md and docs/build-plan.md first, especially §2.1 (the quality standard).

You own parcel <P#>: <title>.
Lane: <A|B|C|D>. You may modify ONLY: <file globs>.
Depends on: <parcels>, already merged.

Build: <acceptance criteria, verbatim from §8>

Contracts you must use, not change: <relevant §6 entries>
Shared-file rules: i18n append-only in both locales; your migration number is <NN>.

Done means: acceptance criteria met, npm run typecheck && npm test clean, new logic
has a test, both locale files updated, no file outside your globs touched.

This is going to be sold. If you hit a choice between fast and correct, take correct
and cut something else instead — then say what you cut in your handoff note.

Finish by writing 3-6 lines: what you built, anything you worked around, and any
change you need in another lane's files (request it — do not make it).
```

---

## 11. v1.1 — hardening, before anyone else touches it

**A second person uses this in roughly two to four weeks.** That makes this section scheduled work,
not a someday list. It is the gate between "Stella's tool" and "someone else's personal data", and
after the v1 weekend it is the only thing that matters until it is finished.

### 11.1 Two different gates

They are often confused and have different triggers.

| Gate | Triggered by | What it protects |
|---|---|---|
| **Gate 1 — real people** | The first real promoter taps a real link | Their personal data: name, phone, location, work history |
| **Gate 2 — real customers** | A second agency gets an account | Their commercial data, and our position as their processor |

**Gate 1 fires first and fires quietly.** Nobody announces it — it happens the moment one invitation
goes to a real phone. Two weeks from now, that is the deadline that binds.

### 11.2 Gate 1 — must be done before one real promoter receives a link

| # | Item | Size | Why |
|---|---|---|---|
| **G1** | Privacy notice in Greek on `/i/*` and `/c/*`, and a linked full notice | 2h | Legal basis is contract + legitimate interest, never consent — D5. The notice is what makes that basis legitimate rather than assumed |
| **G2** | `retention_until` enforced by a scheduled deletion job | 3h | The column exists so deletion is a job, not a promise. An unenforced retention field is worse than none — it documents an intention we are not honouring |
| **G3** | Subject access and deletion path for a promoter | 4h | A GDPR right, exercisable on request. Also the first thing a serious customer asks about |
| **G8** | Audit trail on assignments, invitations and check-ins | 3h | "Who cancelled this shift, and when" is an operational question the day something goes wrong. Retrofitting history onto rows that were overwritten is impossible |
| **G9** | Deletion of the seed's synthetic data from the production database | 1h | Invented promoters and real ones must never share a table in a live system. Separate project or a clean reset |

**Total ≈ 13h — one focused week of evenings.** This is the work between the v1 weekend and the day
someone else uses it. Do not let it slip; the trigger arrives without warning.

### 11.3 Gate 2 — before a second agency has an account

| # | Item | Size | Why |
|---|---|---|---|
| **G4** | DPA template for agency customers | 3h | We are processor for their campaign data, controller for our own roster. They will ask, and having it ready is a signal of seriousness |
| **G5** | Backups verified by an actual restore into a scratch project | 2h | An untested backup is not a backup |
| **G6** | Error tracking in production | 2h | Until then, a customer's failure is invisible to us and reported by them, which is the worst way to learn |
| **G7** | A second agency in the database, tenant isolation tested against it | 2h | The only way to know RLS holds. P1 proves it in tests; this proves it in production shape |
| **G10** | Restore point and migration rollback plan | 2h | The first schema change against live customer data is the moment this stops being optional |

### 11.4 One thing that is not a technical task

**Whose promoters receive the first real links?**

If they come from the roster of the agency Stella currently works for, two separate problems fire at
once: real agency data enters a repo whose first rule forbids it (`CLAUDE.md` §1), and the Article 40
ownership question in `docs/decisions.md` becomes concrete rather than theoretical, because the
software would then be demonstrably operating on the employer's business.

The clean version: **the first real promoters are people who agree directly with Stella, personally,
outside her employer's roster** — or the employer signs the written acknowledgement first. This is a
decision to take before Gate 1, not during it. It costs nothing now and is unfixable afterwards.

---

## 12. What will go wrong

Ranked by likelihood, response decided in advance so nobody improvises at hour nine.

1. **`match_promoters` returns nothing.** Most likely the availability hard filter: a seeded promoter
   available 17:00–23:00 genuinely cannot work a 10:00–18:00 shift, which may exclude nearly
   everyone. *Response:* P0 diagnoses before any UI exists. Fix the seed, not the filter.
2. **Two agents edit `lib/i18n/el.ts` at once.** *Response:* append-only in separate blocks; if it
   happens anyway keep both and re-run typecheck — the compiler finds the gap.
3. **Geolocation fails on the phone.** *Response:* P0b removed this by deploying first. If it still
   fails, it is a permissions prompt, not HTTPS.
4. **Auth eats more than four hours.** It is the most common weekend sink. *Response:* magic-link
   only, no password reset, no signup flow — one seeded account. Do not add a second auth method.
5. **Scope creep into reporting and payroll.** Every parcel suggests one. *Response:* "L5",
   in `roadmap.md`.

---

## 13. Open questions

| # | Question | Blocks | Default |
|---|---|---|---|
| Q9 | Does Stella use her own phone as a test promoter? | P7, P9 | Yes — the only way to see whether the link really opens from WhatsApp on a real device |
| Q10 | Which geocoding provider for production? Nominatim's policy does not cover commercial volume | Not the build — the adapter in P3 makes it a swap | Nominatim in dev, decide the paid provider before the first customer |
| Q11 | Do we need an audit trail in v1 or at G6? | P4, P7 | G6 — but design tables so it can be added without touching existing columns |
