# A2 — coordinator and owner workflow audit

**Date:** 2026-09-21 · **Method:** the product used as a person uses it, on an isolated dev server
(`NEXT_DIST_DIR=.next-A2`, port 3308) against the live database. No application code was changed.

Companion to `docs/audit/security.md` (A1), which covered tenant isolation, RLS, the admin console,
the cron route, the Stripe webhook, storage and secrets by reading code and probing the database.
**This audit is the other half: what a person can reach by clicking.** Nothing here duplicates A1,
and the `app_user_invites` privilege escalation A1 found (A1-01) is deliberately not repeated.

Every finding below was reproduced in a browser or proven with a runnable script. Where a symptom
turned out to be an artefact of the test harness rather than a product fault, it was dropped —
three candidate findings died that way and are listed at the end so nobody re-chases them.

**Data discipline.** Everything created for this audit was named `A2 Audit …`, used
`@example.invalid` addresses, and has been deleted: one client, one campaign, one store, two
sections, three shifts, two invitations, one assignment, one brief, three promoters, one test
agency and two auth users. `promoters?full_name=like.*A2 Audit*` returns `[]`, and `agencies`
is back to the single `Demo Promotion Agency` row. The owner's seeded data and the promoter
"ΣΤΕΛΛΑ" were never modified.

---

## Ranked summary

| # | Finding | Severity |
|---|---|---|
| 1 | Excel/CSV import writes the **wrong date** on every shift | blocker |
| 2 | `/privacy/promoters` returns **500 as soon as a second agency exists** | blocker |
| 3 | A picker with a placeholder silently **pre-selects the first option** — wrong client, wrong store, wrong section | blocker |
| 4 | The per-series rate override is **written and never read** | serious |
| 5 | The invitation shows an **hourly** rate as a flat "Αμοιβή 5,50 €" | serious |
| 6 | A failed shift-series submit leaves an **orphan store and section** behind | serious |
| 7 | An invitation link **cannot be recovered or resent** once created | serious |
| 8 | Adding a store by hand demands **hand-copied Google Maps coordinates** | serious |
| 9 | Matching returns **zero candidates with no explanation** for any date nobody declared | serious |
| 10 | An invited colleague is offered **"create your own agency"** instead of their invitation | serious |
| 11 | Destructive actions use **`window.confirm`** | serious |
| 12 | A billing-blocked agency's archive/status buttons **silently do nothing** | serious |
| 13 | No UI writes the **per-client blocklist**, though it is a documented hard filter | serious |
| 14 | `/settings/scoring` — the **weight-tuning screen — does not exist** | serious |
| 15 | The import **pre-selects a fuzzy store match** as the default | serious |
| 16 | `/shifts` subtitle **counts sections and calls them shifts** | annoying |
| 17 | **Raw ISO dates** on two coordinator screens and in a promoter's check-in message | annoying |
| 18 | Greek plural: **"1 προσκλήσεις"** | annoying |
| 19 | Promoter roster has **no pagination**; filtering is in-memory, capped at 1000 | annoying |
| 20 | The owner's own team row reads **"Εκκρεμεί"** | annoying |
| 21 | A promoter who declines is **not told what she answered** | annoying |
| 22 | An empty section reads **"Πλήρως στελεχωμένη"** | annoying |
| 23 | "Έναρξη συνδρομής" **silently does nothing** without a Stripe key | annoying |
| 24 | Stale **seat-limit error** after a seat is freed | annoying |
| 25 | The manual-send list is **59 rows with no search** | annoying |
| 26 | The brief editor **never says the brief is published** | annoying |
| 27 | "Μόνο ο **owner**…" — English word in Greek copy | cosmetic |
| 28 | Promoter-facing copy is **hardcoded feminine** | cosmetic |
| 29 | `149 €/ μήνα` — stray space | cosmetic |
| 30 | 12-hour and 24-hour clocks **mixed on one page** | cosmetic |
| 31 | Check-in message greets with the **full name** | cosmetic |
| 32 | The privacy notice names the **same entity as controller and processor** | cosmetic |

**Counts:** 3 blockers · 12 serious · 11 annoying · 6 cosmetic.

---

# Blockers

## 1. The Excel import puts every shift on the wrong date

**What.** A schedule imported from a real Excel file lands one day earlier than the file says, and
in a CSV any date whose day is 12 or less is additionally read month-first, silently.

**Where.** `lib/import/dates.ts:96-99` (the `Date` branch of `parseDateCell`), fed by
`lib/import/workbook.ts:75,79` (`read(..., { cellDates: true })`). Surfaces at
`/shifts` → "Εισαγωγή από Excel" → step 4 "Έλεγχος", and then in the created shifts.

**Steps to reproduce.**
1. In Excel, put `Ημ/νία | Κατάστημα | Ωράριο | Άτομα` in row 1 and one row underneath with the
   date cell typed as a **date** (not text): `22/09/2026`, a known store, `10:00-18:00`, `1`.
2. Save as `.xlsx`. Open `/shifts` → **Εισαγωγή από Excel** → pick the file.
3. Step through Στήλες → Πού πάνε οι βάρδιες → Καταστήματα → Έλεγχος.

**What happened.** The preview row reads **21/09/2026** and is marked `Έτοιμη`. Confirmed with a
script against the real pipeline (`readWorkbook` → `detectHeader` → `parseRows`) on this machine,
`TZ=Europe/Athens`:

```
input 22/09/2026 → 2026-09-21
input 10/09/2026 → 2026-09-09   (flagged past_date)
input 03/04/2026 → 2026-04-02
```

For a **CSV** the damage compounds, because SheetJS parses the text month-first before the same
UTC read shifts it again:

```
22/09/2026 → 2026-09-22   (day > 12, stays a string — correct by luck)
10/09/2026 → 2026-10-08   (10 September became 8 October)
03/04/2026 → 2026-03-03   (3 April became 3 March, then flagged "past date")
```

**What should happen.** The date in the file is the date of the shift.

**Why this is the worst finding.** It is silent, it affects the bulk path a client's schedule
arrives through, and it defeats the safety net: a real past date becomes a plausible future one, so
the `past_date` warning that would have caught it never fires. A coordinator has no reason to doubt
the preview. Promoters get invited for the wrong day.

**Why the tests do not see it.** `tests/import-dates-times.test.ts:10` and
`tests/import-workbook.test.ts:44` build their fixtures with `new Date(Date.UTC(2026, 8, 20))`. In
Athens that is 03:00 local, so the UTC getters happen to return the right day. A real spreadsheet
stores an integer serial — local midnight — which no fixture in the suite produces. All 32 import
tests pass with the bug present; I ran them.

**Suggested fix.** `cellDates: true` yields a local-time `Date`, so read it with local getters:

```ts
// lib/import/dates.ts
if (cell instanceof Date) {
  if (Number.isNaN(cell.getTime())) return { ok: false };
  return finalizeYmd(cell.getFullYear(), cell.getMonth() + 1, cell.getDate());
}
```

The Excel-serial branch below it is already correct (it builds a UTC date and reads UTC) — leave it
alone. For the CSV month/day inversion, stop letting SheetJS coerce CSV text at all: parse CSV with
`raw: true` and no `cellDates`, and let `parseDateText` (which is already day-first and already
tested) do the work. Then add one test whose fixture is a local-midnight `Date`, and one CSV test
with `10/09/2026` in it.

---

## 2. The promoter privacy notice returns 500 the moment a second agency exists

**What.** `/privacy/promoters` refuses to render when the `agencies` table has more than one row.
Every promoter-facing page links to it.

**Where.** `app/privacy/promoters/page.tsx:49` (`.limit(2)`) and `:57-63` (`throw`).

**Steps to reproduce.**
1. Sign in as a user with no agency, go to `/onboarding`, create any agency.
2. Open `/privacy/promoters`.

**What happened.** HTTP 500. Verified directly: with one agency the page returns 200; I created
`A2 Audit Agency` through `/onboarding` and the same URL returned **500**; after deleting that
agency it returned 200 again.

**What should happen.** A promoter opening "Τα προσωπικά σου δεδομένα" from her invitation always
sees her own agency's notice.

**Severity.** Blocker for the thing the product is about to do — sign a second agency. It also
breaks the *first* agency's notice at the same instant, and it is the page that makes the
"contract + legitimate interest" legal basis legitimate rather than assumed (`CLAUDE.md` §2, G1 in
`build-plan.md` §11.2). The code comment correctly identifies this as a Gate-2 item; the practical
point is that Gate 2 now fires on the same day as the first upsell, and it fires as a 500.

**Suggested fix.** Make the notice per-agency and resolve the controller from the token that
brought the promoter there — `/i/[token]`, `/c/[token]` and `/a/[token]` all already know the
agency. A route like `/privacy/promoters/[agencyToken]` (or `?a=<agency_id>` resolved server-side)
removes the "there can be only one" assumption entirely. Until then the throw is the right
behaviour — it must not be softened into a placeholder controller.

---

## 3. A picker with a placeholder silently selects the first real option

**What.** `SelectField` renders its placeholder as `<option value="" disabled hidden>`. Because it
is `hidden`, the browser cannot land on it, so a select with no explicit default starts on the
**first real option**. The field looks unfilled and behaves as filled; `required` cannot help,
because a value is present.

**Where.** `components/ui/Field.tsx:208-212`. Affected call sites — all three are write paths that
choose a record's parent:

| Screen | Field | What you silently get |
|---|---|---|
| `/campaigns/new` (`campaign-form.tsx:100-108`) | Πελάτης | the alphabetically first client |
| `/campaigns/[id]/shifts/new` (`shift-series-form.tsx:132-141`) | Κατάστημα | the first store |
| `/shifts` → Νέα ενότητα (`new-section-form.tsx:90-98`) | Καμπάνια | the first campaign |

**Steps to reproduce.**
1. Open `/campaigns/new`. Do not touch the "Πελάτης" dropdown.
2. Read it: it displays **Aurora Beauty**, not "Επίλεξε πελάτη".
3. In the console: `document.querySelector('#clientId').value` → a real client UUID.
4. Fill only the name, dates and rate, and submit. The campaign is created under Aurora Beauty.

**What happened.** A campaign filed against a client the coordinator never chose. Same shape for a
shift series against the wrong store (which also means the wrong coordinates, so the whole ranked
list is computed from the wrong place) and a section under the wrong campaign.

**What should happen.** The control shows the placeholder until a choice is made, and submitting
without one is a field error.

**Severity.** Blocker: it is silent, it misfiles a customer's work, and it surfaces later as a
wrong client on a report. Two other selects escape it only because they are controlled components
(`destination-step.tsx:143`, `invite-panel.tsx:57`) and one avoids `placeholder` on purpose with a
comment that shows someone already knew about the `hidden` behaviour
(`availability-grid.tsx:366-368`).

**Suggested fix.** In `Field.tsx`, drop `hidden` from the placeholder option and give the select
`defaultValue=""` when no value or defaultValue was passed, so the placeholder is genuinely the
initial selection and `required` fires. Then add a `.refine` to each of the three server schemas
rejecting an empty parent id — belt and braces, because the schemas already have the field.

---

# Serious

## 4. The per-series rate override is written and never read

**What.** "Αμοιβή για αυτές τις βάρδιες (EUR, προαιρετικό)" writes `shifts.rate_cents_override`,
and nothing in the product ever reads that column.

**Where.** Written at `app/campaigns/[id]/shifts/new/actions.ts:234`. `grep -rn rate_cents_override
app/ lib/` returns exactly that one line — the invitation page, the shift board, the campaign
report and both CSV exports all read `campaigns.rate_cents` instead (`lib/invitations.ts:187`).

**Steps to reproduce.**
1. Create a campaign with an hourly rate of 5,50.
2. Add a shift series and set "Αμοιβή για αυτές τις βάρδιες" to 8,00.
3. Invite a promoter to one of those shifts and open the invitation link.

**What happened.** The promoter is told **5,50 €**. The campaign report and both CSVs also use 5,50.

**What should happen.** The override is what the shift pays, and it is what the promoter and the
client report see.

**Suggested fix.** Select `rate_cents_override` alongside `campaigns(rate_cents)` in
`lib/invitations.ts` and in `app/campaigns/[id]/report/data.ts`, and coalesce. If the override is
not wanted yet, remove the field from the form — a control that writes to a column nobody reads is
worse than no control, because the coordinator believes they have set the rate.

## 5. The invitation shows an hourly rate as a flat sum

**What.** The invitation page renders the campaign's **hourly** rate under the label "Αμοιβή", with
no unit.

**Where.** `app/i/[token]/page.tsx:76-81`; `"invitation.rate": "Αμοιβή"` (`lib/i18n/el.ts:1946`),
`"Pay"` in English.

**Steps to reproduce.** Create a campaign with "Ωριαία αμοιβή (EUR)" = 5,50, invite someone to an
8-hour shift, open the invitation.

**What happened.** `Αμοιβή — 5,50 €` beside `Τρίτη 22 Σεπτεμβρίου · 10:00–18:00`.

**What should happen.** Either "Αμοιβή 5,50 €/ώρα", or the computed total for the shift, or both.

**Severity.** This is the number a freelancer decides on, and it is the number she will argue about
afterwards. The unit is genuinely ambiguous across the product, which is the deeper problem: the
campaign form says "Ωριαία αμοιβή", the import says "Αμοιβή **ανά βάρδια** (€)"
(`lib/i18n/el.ts:1806`), the series override says neither, and the invitation says neither. Three
screens, three meanings, one column.

**Suggested fix.** Decide the unit once (hourly, given `campaigns.new.rate_label`), say so in every
label including the import's, and show hours × rate on the invitation.

## 6. A failed shift-series submit leaves an orphan store and section behind

**What.** `createShifts` inserts the new store and creates the new section **before** it checks
that the date range and weekday selection produce any dates at all.

**Where.** `app/campaigns/[id]/shifts/new/actions.ts` — store insert at `:148-166`, section create
at `:172-186`, the zero-dates check at `:213-217`.

**Steps to reproduce.**
1. `/campaigns/[id]/shifts/new`. Choose "Νέο κατάστημα" and fill name + coordinates.
2. Choose "Νέα ενότητα" and give it a name.
3. Set Από 22/09/2026, Έως 25/09/2026 (a Tue–Fri span) and untick every weekday except Σάβ and Κυρ.
4. Fill the times and submit.

**What happened.** The error is correct and well written — «Δεν προέκυψε καμία ημερομηνία βάρδιας —
έλεγξε το εύρος και τις ημέρες.» — but the store and the section have already been committed. I
confirmed both afterwards: a section appeared on `/shifts` with "Καμία βάρδια σε αυτή την ενότητα
ακόμα", and the store showed up in the Excel importer's known-store list.

**What should happen.** Nothing is created until the whole submission is valid.

**Severity.** Every retry adds another junk store to a list that feeds the importer's fuzzy
matching, and another empty section to the coordinator's home screen. There is no delete for either
— only archive for the section, nothing at all for the store.

**Suggested fix.** Move the `dates.length === 0` check above the store and section writes; it
depends only on `data`, so it can run immediately after `safeParse`. Better still, fold it into the
zod schema as a `.refine` so it becomes a field error on `weekdays` like every other validation.

## 7. An invitation link cannot be recovered or resent

**What.** Once "Αποστολή πρόσκλησης" has been pressed, the message and its link are shown once and
are then unreachable. A second invitation to the same shift is blocked.

**Where.** `app/shifts/[id]/status-board.tsx:120-148` — a row in `awaiting_reply` gets no action at
all. `app/promoters/[id]/invite/` replaces the card with the blocking reason
«Έχει ήδη ανοιχτή πρόσκληση για αυτή τη βάρδια.» (`lib/invite-eligibility.ts`, `pending_invitation`).

**Steps to reproduce.**
1. `/promoters/[id]/invite` → "Αποστολή πρόσκλησης" for an upcoming shift.
2. Do not copy the message. Reload the page.
3. Open the shift at `/shifts/[id]` and look at the row for that promoter.

**What happened.** The invite card now says an invitation is already open; the shift board row has
an empty ΕΝΕΡΓΕΙΕΣ column. The link exists in the database and is reachable from nowhere in the UI.

**What should happen.** A pending invitation row offers "Αντιγραφή" / "Άνοιγμα στο WhatsApp" for the
same link, and a way to cancel it.

**Severity.** The default transport is `ClipboardAdapter` — the coordinator pastes the link by hand
(`CLAUDE.md`, Messaging). Losing the clipboard is not an edge case, it is Tuesday. The promoter
never hears about the shift, the coordinator cannot re-send, and the shift shows "awaiting reply"
until it expires.

**Suggested fix.** Render the same `CopyButton` / `WhatsAppButton` pair on an `awaiting_reply` row
that `CheckinLinkButton` already uses on a confirmed one; the token is stateless to re-render from
the stored row. Add a "Ακύρωση πρόσκλησης" so the block can be cleared deliberately.

## 8. Adding a store by hand demands coordinates from Google Maps

**What.** The only non-import way to create a store makes latitude and longitude **required**
fields and tells the coordinator to go and find them: «Μη αυτόματες συντεταγμένες προς το παρόν —
βρες τις στο Google Maps. Ο αυτόματος εντοπισμός έρχεται αργότερα.»

**Where.** `app/campaigns/[id]/shifts/new/shift-series-form.tsx:145-175`.

**Steps to reproduce.** `/campaigns/[id]/shifts/new` → "Νέο κατάστημα".

**What happened.** Two required numeric fields and an instruction to leave the product.

**What should happen.** The same "Εύρεση συντεταγμένων" button the promoter form has, with manual
entry as the fallback.

**Severity.** The geocoder is already wired in two other places — `app/promoters/actions.ts:208`
and `app/shifts/import/actions.ts:138` — so this is an unfinished screen, not a missing capability.
It matters more than it looks: distance is the heaviest factor in the ranking, so the whole
matching engine is downstream of a coordinator hand-copying decimals.

**Related dead end.** In the importer, a store whose address will not geocode *cannot be created at
all* — «Η διεύθυνση δεν βρέθηκε στον χάρτη, οπότε αυτό το κατάστημα δεν μπορεί να δημιουργηθεί.
Διάλεξε υπάρχον κατάστημα ή παράλειψη.» Correct as a guard, but with no manual-coordinate escape
in the wizard the coordinator's only routes are to skip those rows or to abandon the import,
create the store by hand with Google Maps coordinates, and start again.

**Suggested fix.** Reuse the promoter form's geocode button on the store block, and add a
"συντεταγμένες με το χέρι" disclosure in the importer's store step for the un-geocodable case.

## 9. Matching returns nothing, without saying why

**What.** A promoter is a candidate only if she has an explicit `availability` row covering the
whole shift. For any date on which nobody has declared, every shift shows "Κανένας διαθέσιμος
promoter για αυτή τη βάρδια" — which reads as "your roster does not fit", not "nobody has told us
about that day yet".

**Where.** Hard filter at `supabase/migrations/0007_match_radius.sql:121-129`; empty state in
`app/shifts/[id]/replacement-panel.tsx`.

**Steps to reproduce.**
1. Create two shifts at the same store, same hours, on consecutive days — one on a date covered by
   existing availability rows, one on a date beyond them.
2. Open both shift pages.

**What happened.** Verified through the real RPC on three shifts of one campaign, same store, same
times: 22/09 → **5 candidates**; 23/09 → **0**; 08/10 → **0**. The only difference is that the
seeded availability stops at 22/09. The two empty pages give the coordinator no way to tell that
from "nobody is suitable".

**What should happen.** The empty state distinguishes the cases: "Κανείς δεν έχει δηλώσει
διαθεσιμότητα για τις 23/09 — στείλε τον σύνδεσμο διαθεσιμότητας" with a link to the messaging
screen, versus "όλοι όσοι δήλωσαν είναι πολύ μακριά / αποκλεισμένοι / ήδη κλεισμένοι".

**Severity.** This is the first thing a new agency will see. They import a month of shifts, open
one, and the product that was sold on ranking shows an empty list with no next step.

**Suggested fix.** Have `match_promoters` (or the page around it) also report how many promoters
were excluded and by which hard filter, and render the counts in the empty state. The engine
already knows; only the UI is silent.

**Compounding constraint.** The promoter's own availability link only ever offers **14 days**
(verified: 21/09 → 04/10 on a link minted on 21/09). A shift 18 days out therefore *cannot* have a
declared-available candidate, ever, no matter what anyone does. The dashboard's exception window is
the same shape — its own footer says «Ο έλεγχος καλύπτει τις βάρδιες από 14/09/2026 έως
05/10/2026», so a completely uncovered shift on 08/10 appears on no screen that warns about
anything. Agencies routinely receive a month's schedule at once. Either the window needs to be
configurable, or the coordinator needs a way to record availability further out.

## 10. An invited colleague is offered "create your own agency"

**What.** A person who has been invited to an agency, but signs in through the normal login instead
of through the invitation link, lands on a page whose primary action creates a **second tenant**.

**Where.** `app/login/page.tsx:30-62`. The comment at `:42-43` explains the intent ("signing in
without an agency used to be a dead end") — the gap is that the page never looks for a pending
invitation for that email.

**Steps to reproduce.**
1. As an owner, invite `someone@example.invalid` as Συντονιστής from `/settings/team`.
2. As that person, sign in normally (magic link) without opening the invitation link.

**What happened.** «Ο λογαριασμός δεν ανήκει ακόμη σε agency … Ζήτησε από τον διαχειριστή να σου
δώσει πρόσβαση», and beneath it a black primary button: **«Δημιούργησε την εταιρεία σου»**. The
pending invitation addressed to exactly that email is not mentioned.

**What should happen.** If a live invitation exists for the signed-in address, show it and offer to
accept it. Creating a new agency should be the secondary action, or absent.

**Severity.** Serious. This is the easiest way for a customer's staff to end up in an empty parallel
tenant, wonder where the data went, and phone the agency owner — and, per finding 2, a second
agency row is also what breaks every promoter's privacy notice.

**Suggested fix.** On the no-agency page, query `agency_invitations` for the user's email; if one is
live, render the invitation card (the `/onboarding/join/[token]` screen is already well built) and
demote the create-agency link to a text link.

## 11. Destructive actions use `window.confirm`

**What.** Cancelling an assignment, marking a no-show, cancelling a campaign and closing the import
wizard all gate on the browser's native confirm dialog.

**Where.** `app/shifts/[id]/cancel-assignment-button.tsx:63`,
`app/shifts/[id]/mark-no-show-button.tsx`, `app/campaigns/[id]/cancel-campaign-form.tsx`,
`app/shifts/import/import-wizard.tsx`.

**Steps to reproduce.** `/shifts/[id]` with a confirmed promoter → "Ακύρωση ανάθεσης".

**What happened.** An OS dialog with OS-language buttons appears over the page.

**What should happen.** The same in-page two-step confirmation the product already builds well
elsewhere — `app/promoters/[id]/edit/archive-control.tsx` does exactly this ("Αρχειοθέτηση" →
"Ναι, αρχειοθέτηση" / "Άκυρο"), and the fortnight-clear on the availability grid was deliberately
moved off `window.confirm` for these reasons (see `BOARD.md` G-k).

**Severity.** It is the dialog people dismiss without reading, its buttons are not in the product's
language, `commercial-architecture.md` §6 asks for typed confirmation on destructive actions, and
the team has already written the replacement pattern twice. This is the one finding in the list
that is purely "finish what you started".

**Suggested fix.** Lift `ArchiveControl`'s arm-then-fire pattern into a small shared component and
use it at all four sites.

## 12. A billing-blocked agency's buttons silently do nothing

**What.** `setSectionArchived` and `setCampaignStatus` are bound directly as `<form action>`, so
they return `void` and cannot report anything. When the billing guard refuses, they `return`
without a trace.

**Where.** `app/shifts/sections/actions.ts:100-107` — the file comment states the trade-off
explicitly: "no way to surface a specific message here, so a blocked or failed request silently
no-ops". Same shape in `app/campaigns/[id]/actions.ts`'s `setCampaignStatus`.

**Steps to reproduce.** Put an agency in `past_due`/`canceled`, then press "Αρχειοθέτηση" on a
section.

**What happened.** Nothing at all — no message, no state change, no error. (I could not put the
owner's live agency into that state, so this one is established from the code plus the author's own
comment rather than from a click. A1 flagged the same limitation on its read-only findings.)

**What should happen.** The same banner the other guarded actions produce:
«Ο λογαριασμός είναι σε κατάσταση μόνο για ανάγνωση.»

**Severity.** The customer most likely to meet it is a paying one whose card just failed — the worst
possible moment for the product to stop responding without saying why.

**Suggested fix.** Convert both to `useActionState` actions returning a state object, as
`renameSection` in the same file already does, and render the error beside the button.

## 13. Nothing in the UI writes the blocklist

**What.** `CLAUDE.md`'s matching section names "agency blocklist, client blocklist" as hard filters.
The `blocklist` table is read in two places and written by nothing.

**Where.** Read at `app/promoters/[id]/invite/data.ts:161,186-187` and in
`supabase/migrations/0007_match_radius.sql`. `grep -rn 'from("blocklist")' app/ lib/` finds only the
select.

**Steps to reproduce.** Try to record "this promoter must never be sent to Aurora Beauty again"
anywhere in the product.

**What happened.** There is no such control. The nearest thing is the promoter's own
`status = "blocklisted"`, which is agency-wide, not per client — and the status dropdown only
*offers* that value when the promoter is **already** archived or blocklisted
(`app/promoters/promoter-form.tsx:155-156`), so reaching it from an active promoter means archiving
first and editing again.

**What should happen.** A per-client "μην την προτείνεις σε αυτόν τον πελάτη" on the promoter
profile, and a reachable agency-wide blocklist toggle.

**Severity.** "The client asked us not to send her again" is one of the most ordinary things a
coordinator records. The engine is ready for it, the eligibility rules already report it
(`invite_eligibility.blocking.blocklisted`), and `/promoters` even offers "Σε αποκλεισμό" as a
filter value that can never match anything a coordinator set.

**Suggested fix.** A small panel on `/promoters/[id]` writing `blocklist(promoter_id, client_id |
null, reason)`, and make `blocklisted` always selectable in the status field.

## 14. The weight-tuning screen does not exist

**What.** `/settings/scoring` 404s. `build-plan.md` §6 lists it among the frozen routes, §8 has it
as P13, and `CLAUDE.md` promises "Weights live in a `scoring_weights` table, tunable per agency
without a deploy".

**Where.** `app/settings/` contains `agency`, `billing`, `messaging`, `team` and nothing else.

**Steps to reproduce.** Sign in and open `/settings/scoring`.

**What happened.** Not found. There is no link to it anywhere either, so nothing is broken on
screen — the capability simply is not there.

**What should happen.** Either the screen, or the claim comes out of `CLAUDE.md` and the route out
of the frozen list.

**Severity.** The ranking *is* the product. When an agency disagrees with the order — and they
will, because their idea of "reliable" is not ours — the only lever is a database edit by us. The
per-factor breakdown on each candidate card is excellent and makes the argument visible; there is
just nothing to do about it afterwards.

## 15. The import pre-selects a fuzzy store match

**What.** In step 3 of the import wizard, a store the file names but the database does not have is
matched fuzzily to an existing store, and **that guess is the default**.

**Where.** `app/shifts/import/stores-step.tsx` (`defaultDecision`), fed by
`lib/import/store-matching.ts`.

**Steps to reproduce.** Import a file containing `A2 Audit Store Γλυφάδα` when the database holds
`A2 Audit Store Κέντρο`.

**What happened.** The card is labelled «Πιθανή αντιστοιχία» with a good warning —
«Μοιάζει με το "A2 Audit Store Κέντρο". Βεβαιώσου ότι είναι το ίδιο κατάστημα.» — but
"Είναι υπάρχον κατάστημα → A2 Audit Store Κέντρο" is already selected, and "Επόμενο" is not
blocked. An unknown store with no match *does* block ("Χρειάζεται απόφαση"); a wrong guess does not.

**What should happen.** A probable match is a suggestion, not a decision: leave it unselected and
block "Επόμενο" the same way, or at minimum show the matched store's address next to the file's
city so the difference is visible.

**Severity.** Clicking through files quickly is exactly what this feature is for. A wrongly merged
store means shifts at the wrong address, wrong distances and a wrong client report — and, unlike
the date bug, nothing downstream ever contradicts it.

---

# Annoying

## 16. The shifts subtitle counts sections and calls them shifts

`app/shifts/page.tsx:87-89` passes `visibleSummaries.length` — the number of **sections** — into
`"shifts.list.subtitle": "{count} βάρδιες, με τη χρονολογικά πρώτη στην κορυφή."`
(`lib/i18n/el.ts:44`). With four sections holding 25 shifts the page says **"4 βάρδιες"** above a
list of 25. The second half is wrong too: `sortProgrammeSummaries` (`lib/programmes.ts:192-205`)
ranks sections by upcoming-ness and then by *descending* end date, so an all-past board is not
chronological. Either count `shifts.length` and drop the ordering claim, or give the key a new
wording about sections.

## 17. Raw ISO dates on three surfaces

`formatDateRange` (`app/campaigns/_shared.ts:65-67`) returns the database strings unchanged, so
`/campaigns` and `/campaigns/[id]` show `2026-09-22 → 2026-09-30`; `app/campaigns/[id]/page.tsx:240`
renders `{shift.on_date}` directly in the shift table. Everywhere else in the product is
`22/09/2026`. Worse, the same slip is in a **promoter-facing message**: the check-in text a
coordinator pastes into WhatsApp is built at `app/shifts/[id]/actions.ts:215` as
`` `${shift.on_date} · ${startTime}–${endTime}` ``, so the promoter reads
"2026-09-23 · 10:00–18:00". P41 removed ISO dates from the promoter's screens; this one is in the
message that gets her there.

## 18. "1 προσκλήσεις σε αναμονή απάντησης"

`"shifts.replacements.pending_count": "{count} προσκλήσεις σε αναμονή απάντησης"`
(`lib/i18n/el.ts:526`) has no singular. Shown on any shift with exactly one open invitation, which
is the common case. Same family as the "1 θέσεις" that R2-5 fixed. A quick sweep of the other
`{count}` keys is worth doing at the same time.

## 19. The promoter roster has no pagination

`app/promoters/page.tsx:71-81` fetches every promoter with `.limit(1000)` and filters **in memory**
(`:90-99`). At 64 rows the page is already a long scroll; the target customer has hundreds. Two
consequences: every visit ships the whole roster to render one screen, and an agency with more than
1000 promoters silently cannot find the rest — the search box will simply never return them, with
no warning. Push the filters into the query and paginate.

## 20. The owner's own row says "Εκκρεμεί"

`/settings/team` shows the signed-in owner with a warning badge «Εκκρεμεί», because
`app/settings/team/page.tsx:27` keys the badge on `accepted_at`, and the seeded owner row has
`accepted_at: null`. A brand-new agency created through `/onboarding` does not have this (I
checked — the founder shows «Ενεργό»), so it affects the owner's own production account
specifically: the person being demoed to is shown as not yet accepted. Backfill `accepted_at`, or
treat "the row that matches the current session" as active.

## 21. A promoter who declines is not told what she answered

Accepting gives «Ευχαριστούμε! Η βάρδια καταχωρήθηκε.» plus the next step. Declining gives
«Ευχαριστούμε για την απάντηση.» — the same sentence you would get for either. Reloading the page
(which is safe and idempotent — good) shows the same thing. A mis-tap is unrecoverable and
undetectable from the promoter's side. Say «Καταγράψαμε ότι δεν μπορείς αυτή τη βάρδια», and
consider letting her undo within a few minutes.

## 22. An empty section reads "Πλήρως στελεχωμένη"

A section with no shifts shows "0 από 0 καλυμμένες" and the badge
`"shifts.sections.needs_people_none": "Πλήρως στελεχωμένη"` (`lib/i18n/el.ts:1538`). "Fully staffed"
is the one thing an empty section is not. Needs a zero case.

## 23. "Έναρξη συνδρομής" silently does nothing without a Stripe key

`/settings/billing` explains honestly at the top that billing is not configured, and then renders
three fully enabled plan buttons. Clicking one produces no navigation, no message and no console
error. The banner covers the dev case, but the same code path is what a paying customer hits if the
key is ever wrong in production. Disable the buttons when billing is unavailable, or return a
visible error.

## 24. Stale seat-limit error after a seat is freed

Fill the three Starter seats, attempt a fourth invitation (correctly refused with
«Έφτασες το όριο θέσεων του πακέτου σου. Ελευθέρωσε μία θέση ή αναβάθμισε.»), then revoke a pending
invitation. The seat counter updates to "2 από 3" and the invite form comes back — but the red
error from the previous attempt is still sitting above it. The action state survives the
revalidation. Clear it when the seat count changes.

## 25. The manual-send list is 59 rows with no search

`/settings/messaging` lists every active promoter with her own Αντιγραφή / WhatsApp pair when email
is not configured — which is exactly the right idea, and unusable at scale: 59 rows today, 150 on
the Starter plan's own limit, with no search, no filter and no "done" marker. Add a search box and
a way to see who has already been sent one.

## 26. The brief editor never says the brief is published

`/campaigns/[id]/brief` shows "Αποθήκευση πρόχειρου" and "Δημοσίευση" identically before and after
publishing. The campaign page shows a «Δημοσιευμένο» badge; the editing screen shows no state, no
version and no published-at. A coordinator reopening it to fix a typo cannot tell whether promoters
are currently reading it.

---

# Cosmetic

27. **`app/settings/agency/page.tsx`** (coordinator view): «Μόνο ο **owner** του πρακτορείου μπορεί
    να αλλάξει αυτά τα στοιχεία.» Everywhere else the role is «ιδιοκτήτης».
28. **Hardcoded feminine.** `"invitation.question": "Είσαι διαθέσιμη;"` (`lib/i18n/el.ts:55`),
    «Η promoter είναι αποκλεισμένη» (`:1603`), «Στείλε τον στην promoter…». The seed itself has
    Γιώργος, Νίκος and Δημήτρης in it. A neutral phrasing («Μπορείς αυτή τη βάρδια;») avoids the
    whole problem.
29. **`149 €/ μήνα`** — a stray space before the unit on the billing plan cards.
30. **Mixed clocks.** The invitation's brief acknowledgement reads "21 Σεπ 2026, 2:36 μ.μ." while
    the shift on the same page is "10:00–18:00". Pick 24-hour for a product about shift times.
31. **Check-in greeting.** `app/shifts/[id]/actions.ts:210` greets with the promoter's full name —
    "Γεια σου A2 Δοκιμή Χωρίς Θέση!" — where `lib/dispatch/messages.ts` correctly uses
    `firstName()` for the same kind of message.
32. **The privacy notice names one entity twice.** With `NEXT_PUBLIC_LEGAL_ENTITY_NAME` set to the
    owner's own name, `/privacy/promoters` currently reads: the controller is "Demo Promotion
    Agency (Στέλλα Πετροπούλου)" and "Το Στέλλα Πετροπούλου είναι μόνο το λογισμικό". Factually
    true for a sole trader, and incoherent to read — the controller/processor distinction is the
    whole point of the section. Worth a different processor entity name before a customer reads it.

---

# Designed this way — and whether the design is right

- **Admin console in English.** `/admin` is entirely English while the product is Greek-first. It
  is an internal tool for one person; **the design is right**, and it should stay out of the i18n
  dictionaries rather than being half-translated later.
- **Archiving a section is one click with no confirmation** (`setSectionArchived`). Reversible, and
  the archived view is one filter away, so **the design is right** — but the page did not appear to
  update in place for several seconds after the click (the action does call `revalidatePath`, so
  this may be dev-server latency rather than a fault; see "could not test"). A toast saying where
  the section went would remove the ambiguity either way.
- **The replacement panel is always visible**, headed «ΓΙΑΤΙ ΧΡΕΙΑΖΕΤΑΙ ΑΝΑΠΛΗΡΩΣΗ», even on a
  shift where nothing has gone wrong. Showing the next candidates permanently is right; the heading
  is wrong when the reason is simply "not covered yet".
- **Only three candidates are offered**, with no "show more" and no way to search the roster from
  the shift page. Correct for the shortlist idea, and the per-promoter invite screen covers the
  "the client asked for her by name" case — but a coordinator who dislikes all three has nowhere to
  go from that screen.
- **A draft campaign can run the entire loop.** I created a campaign, left it «Πρόχειρη», imported
  shifts into it, invited a promoter and had her accept — the draft state never gated anything. If
  draft is meant to mean "not live yet", it should block invitations; if it is just a label, the
  "Ενεργοποίηση" button is theatre.
- **The availability token reuses `purpose: "invitation"`** with an `availability:<uuid>` record id
  rather than its own purpose. Harmless today because the record id is namespaced and validated,
  but it means the "wrong purpose" rejection that `lib/tokens.ts` tests so carefully does not
  separate these two link types. A third purpose costs nothing.
- **New promoters start at 80% reliability** with no history. A confident-looking number invented
  out of nothing, sitting in a column the coordinator is meant to compare on. Either show "—" until
  there is history, or label the default.

---

# What I exercised and found working

So the next person does not re-walk this ground:

- **Auth.** Magic-link sign-in, the callback setting the session cookie, an already-used link
  showing «Ο σύνδεσμος έληξε ή έχει ήδη χρησιμοποιηθεί. Ζήτησε καινούριο.», and the no-agency
  landing page (whose content is finding 10, but which renders correctly).
- **Dashboard.** Both states: the all-clear empty state with its coverage-window footnote, and the
  populated state — it surfaced my decline within fifteen minutes, correctly phrased, with the
  right shift and a "Εύρεση αντικατάστασης" link. This screen is good.
- **Shifts board.** Sections with client/campaign/time-range/archived filters, the archived view
  and «Επαναφορά», section rename (updates in place), section archive (verified in the database),
  empty states for both "no sections" and "filters match nothing".
- **The Excel import, everything except the dates.** Header detection skipped two title rows and a
  blank row and mapped five Greek headers at 100% confidence; `10:00-18:00`, `10:00 – 18:00` (en
  dash) and `9.00 π.μ. - 5.00 μ.μ.` all parsed; a duplicate row was caught as `duplicate_in_file`
  and excluded with an opt-in override; an unparseable headcount ("δύο") fell back to 1 with a
  warning; an unknown store blocked the step until decided; a store whose address would not
  geocode was correctly refused; the preview named every excluded row and why; the done step
  summarised what was and was not created. Windows-1253 and `;`-delimited CSV handling is covered
  by the existing tests. **This is the most impressive part of the product.**
- **Promoters.** List with all five filters and the result counter, search, create with a
  geocodable address (Nominatim resolved «Πλατεία Συντάγματος, Αθήνα» to 37.97552, 23.73495 and
  showed the formatted address for confirmation), the **duplicate-phone guard** — which not only
  blocks but links to the existing promoter, a genuinely good piece of error design — the profile
  page, edit, and the two-step archive (confirmed `status: "archived"` in the database).
- **Availability.** Coordinator-minted link, the promoter's own `/a/[token]` grid, per-day
  Μπορώ / Ωράριο / Δεν μπορώ saving immediately with optimistic state, and the resulting rows
  feeding the matching hard filter correctly.
- **The core loop, end to end.** Invite from the promoter card (with the correct
  "no availability declared" warning and the correct "already has an open invitation" block) →
  open `/i/[token]` → **decline** → the shift board shows «Αρνήθηκε» with the timestamp and the
  replacement panel names who declined and when → invite a second promoter → **accept** → the board
  shows «Επιβεβαιωμένος/η» with a check-in link button and a cancel control → the promoter's page
  shows the check-in link and the brief. Reloading `/i/[token]` after responding is idempotent and
  safe.
- **Briefs.** Authoring, publishing, markdown rendering, and the read-state list («Ποιοι έχουν
  διαβάσει το brief» / «Δεν το έχουν διαβάσει ακόμα») updating after the promoter tapped
  «Το διάβασα». **Markdown is correctly escaped** — a `<script>alert('xss')</script>` in the brief
  body rendered as literal text with zero script elements in `<main>`.
- **Client report.** `/campaigns/[id]/report` renders from real shift data and is careful in a way
  that is rare: it labels partial figures «ΜΕΡΙΚΑ ΔΕΔΟΜΕΝΑ», states "από 2 από 4 αναφορές πεδίου —
  λείπουν 2" under every total, explains why cancellations are not in the denominator, and warns
  not to add the two check-in axes together. Both CSV exports return 200 with `;` delimiters, a
  UTF-8 BOM (`lib/reporting.ts:741`), RFC 5987 filenames and `Cache-Control: no-store`.
- **Settings.** Agency identity, team, billing and messaging pages all render, and all four are
  honest about what is not configured rather than pretending.
- **Role gating.** As a coordinator: `/settings/billing` refuses with an explanation,
  `/settings/agency` is read-only, `/settings/team` is read-only with the reason stated,
  `/settings/messaging` shows the switch but says only the owner can change it. The settings hub
  adapts its own copy. This is done properly. (Two nits: the coordinator still sees plan, trial
  end and seat counts, and the onboarding checklist they land on still offers them owner-only
  steps.)
- **Onboarding and team.** Agency creation, the first-run checklist, invitation creation with the
  link shown on screen for a no-email setup, the `/onboarding/join/[token]` acceptance screen,
  role assignment, seat-limit enforcement replacing the form with guidance, and invitation revoke
  returning the seat.
- **i18n discipline.** `el.ts` and `en.ts` both hold **1552 keys with zero divergence in either
  direction and no duplicates**, and a sweep for hardcoded Greek in `app/`, `components/` and
  `lib/` outside the dictionaries found only `—`, `·` and comments. No missing-key throw appeared
  in the console on any screen I opened.
- **375px.** No page-level horizontal overflow on `/dashboard`, `/shifts`, `/promoters`,
  `/campaigns`, the campaign report, `/settings` and its four children, or the forms — wide tables
  scroll inside their own box exactly as `docs/design.md` describes. Measured with
  `documentElement.scrollWidth > clientWidth`, not by eye.
- **Console.** Clean on every screen opened. No React errors, no hydration warnings, no missing
  translation keys.

---

# What I could not test, and why

1. **No-show marking.** `MarkNoShowButton` only appears once a shift has started, and every shift I
   was allowed to create was in the future. Creating a past shift and forcing the clock would have
   meant either editing the owner's data or faking time. The control's gating logic reads correctly
   in `app/shifts/[id]/board.ts`, but I did not press it.
2. **`window.confirm`-gated actions, to completion.** The headless pane auto-dismisses native
   dialogs, so cancel-assignment, mark-no-show and cancel-campaign could not be carried through
   from the UI. That is itself part of finding 11; the code path after the confirm is unexercised
   here.
3. **Billing states beyond trialing.** `past_due`, `canceled` and `active` all require either
   Stripe keys or writing to the owner's live agency row. Finding 12 is therefore established from
   the code and its author's comment, not from a click — the same honest limit A1 recorded.
4. **Check-in and field reports.** Reached the check-in link and the "Άνοιγμα σελίδας άφιξης" step,
   but did not submit a geolocated arrival or upload a photograph. P9/P41 cover this ground and it
   is promoter-side (Lane C).
5. **The admin console's reason-gated operational view.** Opening it writes a permanent row to
   `admin_audit_log`, which is append-only by design and cannot be cleaned up. I would not write an
   irreversible "an agent read your customer data" entry against the owner's own agency, and my own
   test agency was deleted before I got to it. The aggregate view, the agency list and the audit-log
   screen itself all render correctly and A1 verified the guards.
6. **Whether the section-archive click revalidates in place.** The action does call
   `revalidatePath("/shifts")`, but the list did not visibly update within four seconds and did
   after a reload. Dev-server compile latency is the likelier explanation; worth one look on a
   production build before treating it as a bug.
7. **Concurrency effects.** Three other agents were editing files in this working tree during the
   audit, so Fast Refresh remounted pages under me more than once, and all localhost ports share
   cookies, so my session was replaced by another agent's at least once. Nothing in the findings
   above depends on session identity — every data claim was re-verified directly against the
   database — but a second pass on a quiet tree would be worth an hour.

---

# Three things that looked like bugs and were not

Recorded so nobody spends time on them again.

1. **"A failed submit wipes every field you typed."** It does not. Values entered through the
   harness's programmatic fill were reverted by React's controlled inputs; values actually typed
   survive a server-side validation error. Re-tested with real keystrokes.
2. **"The CSV export has no UTF-8 BOM."** It does — `lib/reporting.ts:741` prefixes `CSV_BOM`. My
   first check used `fetch().text()`, and `TextDecoder` strips a leading BOM by default. The route's
   own comment says the BOM is in the body, and it is.
3. **"An autofocused field puts the caret before the existing text."** No autofocus is involved;
   my click landed at the start of the string. The brief-title field is not autofocused at all.
