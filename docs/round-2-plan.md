# Round 2 — the owner's second list

Written by the manager on 2026-09-13. **Every agent in this round reads this file after `CLAUDE.md`
and before touching code.** It says which files are yours. A file not listed under your parcel is
not yours, even if nobody seems to be using it.

## What was asked, in the owner's words, and what it became

| # | Asked | Parcel |
|---|---|---|
| 1 | "Αντιγραφή" under the availability link does nothing | **P36 — done by the manager** (`b9937d6`). Root cause: `NotAllowedError` swallowed silently |
| 2 | Availability link sent automatically when a promoter is added, then to everyone on the 1st and 15th | **P39** |
| 3 | "Στείλε πρόσκληση" on a promoter's card, to any shift, even if not suggested | **P38** |
| 4 | Shifts screen: as many sections of shifts as the agency wants | **P37a** |
| 5 | Drag a client's Excel onto Shifts and get the shifts created | **P37b** (engine) → **P37c** (UI) |
| P1 | Is login still broken? Explain how to test with a third person | **manager** — needs the Supabase token |
| P2 | Show me the promoter side: invitation, arrival, photo, GPS | **P38** closes the gap below; **manager** does the walkthrough |

**A gap found while scoping P2:** nothing in the application ever issues a check-in link.
`createCheckinLink` in `lib/checkins.ts` has no caller. A promoter who accepts reaches a dead end, and
the check-in page — which works — is unreachable from the product. P38 fixes this.

## Ground rules for this round

1. **Your files are listed below. Nothing else.** Need a change elsewhere → write it in your status
   file under "Requests to other lanes" and carry on.
2. **i18n**: `lib/i18n/el.ts` and `lib/i18n/en.ts` are append-only, one block at the very end, Greek
   first, both in the same edit. Four agents append concurrently: **re-read each file immediately
   before you edit it**, and edit with a single atomic write, never a long-running editor session.
3. **Never run `npm install`, never edit `package.json`.** `xlsx` is already installed.
4. **Migrations**: write only the number reserved for you. The manager reviews and applies them.
   Never edit an applied migration.
5. **Builds and dev servers use your own output folder** — two processes writing one `.next`
   corrupt each other:
   ```
   NEXT_DIST_DIR=.next-<parcel> npm run build
   NEXT_DIST_DIR=.next-<parcel> NEXT_PUBLIC_APP_URL=http://localhost:<port> npx next dev -p <port>
   ```
   Ports: P37a 3301 · P37c 3302 · P38 3303 · P39 3304. Never stop a process you did not start.
6. **Open the screens you built.** `node scripts/dev-signin-link.mjs <port> <path>` prints a
   one-time sign-in link for your local server. A green build has shipped three pages that 500'd on
   every load (`BOARD.md`, I7).
7. **Before `in_review`**: `npx tsc --noEmit` clean · `npm test` green · `node scripts/scan-function-props.cjs`
   clean · `NEXT_DIST_DIR=.next-<parcel> npm run build` completes · screens opened at 375px and desktop.
8. **Commit nothing.** The manager commits, with explicit paths.
9. **Update your status file as you go** — files touched, what is done. A session limit has killed
   six parcels; a status file is how the next run resumes instead of starting over.

## Migration registry

| # | File | Owner | State |
|---|---|---|---|
| 0001–0015 | — | — | Applied |
| **0016** | `0016_shift_programmes.sql` | manager (for P37a/P37c) | **Applied 2026-09-15** — 4 sections backfilled, 25/25 shifts filed, composite FK refused a cross-campaign filing |
| **0017** | `0017_message_dispatches.sql` | P39 | **Applied 2026-09-15** — RLS forced, authenticated SELECT only, owner can update only the four intended agency columns |
| 0018 | — | — | Spare, ask first |

Until 0016 is applied, the cloud database has no `shift_programmes` table. P37a builds against the
migration as written; screens that query it will error locally until the manager applies it.

## Ownership

### P37a — Shift sections (Sonnet)
- `app/shifts/page.tsx` and any new `app/shifts/*.tsx` beside it (not `app/shifts/[id]/**`, not `app/shifts/import/**`)
- `app/shifts/sections/**` (new — create/rename/archive actions and dialogs)
- `lib/programmes.ts` (new)
- `app/campaigns/[id]/shifts/new/**` — choose the section new shifts go into
- `tests/programmes*.test.ts`
- Mounts `<ImportShifts />` and `<ImportShifts target={…} />` from `app/shifts/import/import-shifts.tsx`, **does not edit that file**

### P37b — Import engine (Sonnet)
- `lib/import/**` except `lib/import/types.ts` (frozen, manager's)
- `tests/import*.test.ts`, `tests/fixtures/import/**`
- Implements exactly the function list at the bottom of `lib/import/types.ts`

### P37c — Import UI (Opus) — starts when P37a and P37b are both `in_review`
- `app/shifts/import/**`
- Creates stores, campaign (optional), programme and shifts from a confirmed import

### P38 — Invite from the promoter card, and check-in links that reach the promoter (Sonnet)
- `app/promoters/[id]/page.tsx`, `app/promoters/[id]/invite/**` (new)
- `lib/invite-eligibility.ts` (new), `tests/invite-eligibility*.test.ts`
- `app/i/[token]/**` — after accepting, the promoter gets their check-in link
- `app/shifts/[id]/**` — the coordinator can send a confirmed promoter their check-in link
- `lib/checkins.ts` — may **add** helpers; must not change `createCheckinLink`'s signature (P39 calls it)
- **Not** `lib/invitations.ts` (P39's)

### P39 — Automatic messaging (Opus)
- `lib/messaging/**`, `lib/dispatch/**` (new), `lib/invitations.ts` (pass the promoter's email to the adapter)
- `lib/availability-links.ts`
- `app/promoters/actions.ts` — send the first availability link after a promoter is created
- `app/api/cron/**` (new), `vercel.json` (new)
- `app/settings/messaging/**` (new), and one link row in `app/settings/page.tsx`
- `supabase/migrations/0017_message_dispatches.sql`
- `tests/messaging*.test.ts`, `tests/dispatch*.test.ts`

### Manager
- `docs/**`, `CLAUDE.md`/`AGENTS.md`, `lib/import/types.ts`, all migrations review and apply, Vercel
  and Supabase configuration, `app/login/**` (P1), the promoter walkthrough (P2), every commit.

## Shared components you may use, not edit

`components/ui/**` is frozen. New in this round and worth using: `CopyButton` (never fails silently)
and `WhatsAppButton` (opens wa.me with the message prefilled, no clipboard). Anything that shows a
link or message for a coordinator to send uses both.
