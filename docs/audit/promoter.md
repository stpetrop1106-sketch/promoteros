# Promoter-side audit — A3

**Date:** 2026-09-21/22 · **Branch:** `develop` @ `a288ad8` · **Target:** a local dev server on
:3309 against the live Supabase project named in `.env`, which is also production.

This is a find-and-report parcel. **No application code was changed and nothing was committed.**

Everything below was walked as the promoter walks it: a 375px viewport, in Greek, from a link,
never logged in. Every finding carries steps that were actually run. Where a finding is a code
reading rather than something I watched happen, it says so in its own words — I have not dressed
up an inference as an observation.

All rows were created by this audit (two `@example.invalid` promoters, one client, one campaign,
one store, five shifts and their invitations/assignments/check-ins/reports). The seeded demo
agency and the promoter "ΣΤΕΛΛΑ" were read but never modified. No email was sent — both addresses
are on a reserved domain, which `lib/messaging/email-address.ts` refuses before any provider call.

**Headline:** three blockers. The worst is that a promoter standing in a supermarket with one bar
of signal can tap "Αποθήκευση αναφοράς", get **no response of any kind**, and walk away believing
the report is filed. It is not.

| # | Finding | Severity |
|---|---|---|
| A3-01 | A report submitted on a dropped connection fails in complete silence | **blocker** |
| A3-02 | After the agency cancels the shift, the promoter's page still says it is booked | **blocker** |
| A3-03 | Invite from the shift page and the link is destroyed before anyone can copy it | **blocker** |
| A3-04 | "Αμοιβή 5,50 €" is the hourly rate, shown without a unit, on an 8-hour shift | serious |
| A3-05 | `/i` and `/c` answer every failure with "expired", including a cancelled shift | serious |
| A3-06 | Archiving a promoter revokes one of their four links; the other three keep working | serious |
| A3-07 | An out-of-range number kills the whole report with a generic error, forever | serious |
| A3-08 | A rejected photo is never reported to the promoter — the warning is unreachable | serious |
| A3-09 | The brief vanishes from an accepted invitation after 24 hours | serious |
| A3-10 | Declaring yourself unavailable does nothing about a shift you already accepted | serious |
| A3-11 | Accept, decline and "Το διάβασα" give no feedback at all while they run | serious |
| A3-12 | The invitation never says who it is from, or who it is for | annoying |
| A3-13 | The invitation does not show the store address | annoying |
| A3-14 | An empty report can be filed by accident and locks out the real one | annoying |
| A3-15 | `capture="environment"` can hide the photo library on a phone | annoying |
| A3-16 | English is unreachable on every promoter page | annoying |
| A3-17 | The invitation message is hardcoded Greek, and gendered feminine | annoying |
| A3-18 | Partial-day validation costs a server round trip | annoying |
| A3-19 | Availability cannot express a window that crosses midnight | annoying |
| A3-20 | The coordinator's bulk clear erases the promoter's own words without trace | annoying |
| A3-21 | An "already checked in" error drops the promoter into the override form | cosmetic |
| A3-22 | The privacy link is a 15px line of grey text at the very bottom | cosmetic |
| A3-23 | Full promoter tokens are written into the request log line | cosmetic |

---

## A3-01 — A report submitted on a dropped connection fails in complete silence

**Severity: blocker for a customer.**

### What
If the connection drops between tapping "Αποθήκευση αναφοράς" and the server answering, the page
does nothing at all — no message, no spinner, no retry — and the report is not saved.

### Where
`app/c/[token]/report/report-form.tsx` (the `useActionState` form) and
`app/c/[token]/report/actions.ts` (`submitReport`). Neither has a rejection path: the action state
union in `./state.ts` has `idle | error | success`, and a *transport* failure never produces any
of them.

### Steps to reproduce
1. Accept an invitation, check in, and open `/c/<token>/report`.
2. Type a number into "Τεμάχια που προωθήθηκαν".
3. Make the server unreachable. I stopped the dev server (`taskkill` on the pid holding :3309)
   and confirmed connections to :3309 were failing (`netstat` showed `SYN_SENT`).
4. Tap "Αποθήκευση αναφοράς".
5. Wait 20 seconds and read the page.

### What happened
Nothing changed. The button kept the label "Αποθήκευση αναφοράς" and stayed **enabled**
(`disabled: false`). There was no `role="alert"`, no text anywhere on the page about a failure,
and no unhandled rejection reached a listener I had installed on `window`. The typed values
survived, which is the one good part. After restarting the server, `/c/<token>/report` still
rendered an empty form — confirming nothing was saved.

An earlier attempt at this test, where I stubbed `window.fetch` instead of stopping the server,
did **not** reproduce it — Next's action transport had already captured `fetch`, the POST went
through, and the report saved. I mention this because it is the reason I re-ran the test properly;
the result above is the one from the real outage.

### What should happen
A failed submission must say so, in Greek, and offer the tap again: "Δεν στάλθηκε — δεν υπάρχει
σύνδεση. Δοκίμασε ξανά." The promoter must never be able to leave the page believing a report
went in when it did not. This is the exact scenario `shrink-photo.ts` and `actions.ts` already
write careful comments about ("a bad connection dropping the photo never drops the report") — the
care stops one layer short of the transport.

### Suggested fix
Wrap the action call in the form component so a rejection becomes a state rather than nothing:
give `ReportActionState` a `status: "offline"` member, call the action through a small wrapper with
`try/catch` (or an `onSubmit` that awaits and catches), and render a retry message. The same
wrapper is needed in `app/c/[token]/checkin-form.tsx`, where the shape is worse (see below).

**Related, not separately reproduced:** `checkin-form.tsx` awaits `checkinWithGeo` /
`checkinWithOverride` inside `startTransition` with no `try/catch`. A transport rejection there
cannot reach `handleActionResult`, so `phase` stays `"submitting"` and the button stays disabled
indefinitely. I had no un-checked-in assignment left to run this against; it is a code reading.

---

## A3-02 — After the agency cancels the shift, the promoter's page still says it is booked

**Severity: blocker for a customer.**

### What
When a coordinator cancels a promoter's assignment, the promoter's invitation page keeps saying
"Ευχαριστούμε! Η βάρδια καταχωρήθηκε." and replaces the arrival button with "…Δοκίμασε ξανά
αργότερα" — which tells them to come back later rather than that the shift is gone.

### Where
`app/i/[token]/page.tsx:105-124`. The page branches on `v.status === "accepted"` (the *invitation*
row) and never looks at the assignment. `lib/checkins.ts:createCheckinLinkForInvitation` does
return `{ ok: false, reason: "cancelled" }`, but the page collapses every `!ok` into one string,
`t("invitation.next_steps.error")` = "Δεν μπορέσαμε να ετοιμάσουμε τον σύνδεσμο άφιξης αυτή τη
στιγμή. Δοκίμασε ξανά αργότερα."

### Steps to reproduce
1. As the promoter, accept an invitation for a future shift.
2. As the coordinator, open that shift, and under the confirmed row press "Ακύρωση ανάθεσης",
   then "Ναι" on the two-step confirm. The board now shows "Ακυρώθηκε".
3. As the promoter, reopen the same `/i/<token>` link.

### What happened
The page still reads, in order: the shift details, the brief, **"Ευχαριστούμε! Η βάρδια
καταχωρήθηκε."**, the heading "Τι ακολουθεί", the sentence telling them to open this link on the
day — and then, where the arrival button was, "Δεν μπορέσαμε να ετοιμάσουμε τον σύνδεσμο άφιξης
αυτή τη στιγμή. Δοκίμασε ξανά αργότερα."

A promoter reading that concludes the booking stands and the link is being slow. They travel to
the store. The agency's client sees a promoter turn up for a shift the agency cancelled, which is
precisely the embarrassment this product is sold to prevent.

### What should happen
A cancelled assignment must replace the confirmation, not sit underneath it: "Η βάρδια ακυρώθηκε
από τον συντονιστή. Δεν χρειάζεται να πας." — with the shift details retained so they can see
*which* shift, and a line about who to contact.

### Suggested fix
Have `page.tsx` distinguish `checkinResult.reason === "cancelled"` from every other failure, and
suppress the accepted/next-steps block entirely in that case. Two new keys in both locales.

---

## A3-03 — Invite from the shift page and the link is destroyed before anyone can copy it

**Severity: blocker for a customer.** It is the coordinator's screen, but the consequence is
entirely the promoter's: they never receive anything.

### What
Inviting a candidate from the shift page's "Επόμενοι υποψήφιοι" panel shows the coordinator
nothing to copy. The invitation exists in the database and the promoter is never told about it.
There is no way to recover the link from the shift page afterwards.

### Where
- `app/shifts/[id]/actions.ts:29-61` — `invite()` calls `revalidatePath('/shifts/'+shiftId)` and
  *then* returns `{ status: "manual", manualBody, url }`.
- `app/shifts/[id]/invite-button.tsx:40-61` — that `manualBody` is rendered in a textarea by the
  component that lives inside the candidate card. The revalidation removes the just-invited
  promoter from the candidate list, so the component unmounts and takes the state with it.
- `app/shifts/[id]/invitation-link-button.tsx:79` — **a component that exists for exactly this
  problem** ("Αντιγραφή συνδέσμου", plus cancel) and is imported by nothing.
  `app/shifts/[id]/board.ts:278` already computes `invitationId` for pending rows, so the data is
  there; `status-board.tsx:120-152` renders only check-in, no-show and cancel controls.

### Steps to reproduce
1. Open a shift with an open slot and at least one ranked candidate.
2. Install a `MutationObserver` on `<main>` first, so nothing transient is missed.
3. Press "Πρόσκληση" on the top candidate.
4. Watch the page for 30 seconds, then read the status board row.

### What happened
No textarea ever appeared — the observer recorded no node containing the message or the URL. After
the refresh the board shows the promoter as "Αναμονή απάντησης" with **an empty ΕΝΕΡΓΕΙΕΣ cell**.
I repeated this on three separate shifts (21/09, 22/09, 23/09) with the same result.

The same server action, invoked from `/promoters/[id]/invite`, *does* render the message and the
"Αντιγραφή" / "Άνοιγμα στο WhatsApp" buttons — that is how I obtained every working `/i/` link in
this audit. So the action is fine; the shift-page placement is not.

The promoter in this state has an invitation counting down to expiry that they have never seen.

### What should happen
Losing the message must be impossible. Either the invite result should survive the revalidation,
or — better, since the component is already written — the pending row on the status board should
carry `InvitationLinkButton`, so the link can be copied again at any time before it expires.

### Suggested fix
Render `InvitationLinkButton` in `status-board.tsx` for rows with an `invitationId` and a pending
state. That is the smaller change and it also fixes the "I closed the tab" case, which the
in-place textarea never covered.

---

## A3-04 — "Αμοιβή 5,50 €" is the hourly rate, shown without a unit, on an 8-hour shift

**Severity: serious.**

### What
The invitation shows the campaign's *hourly* rate under the bare label "Αμοιβή" ("Pay"). A
promoter deciding whether to take a 10:00–18:00 shift reads it as the pay for the shift.

### Where
- `app/i/[token]/page.tsx:80-86` renders `t("invitation.rate")` against `v.rateCents`.
- `lib/i18n/el.ts:1946` `"invitation.rate": "Αμοιβή"` · `lib/i18n/en.ts:1911` `"invitation.rate": "Pay"`.
- The same column is labelled "Ωριαία αμοιβή (EUR)" on the coordinator's campaign form, and
  `lib/invitations.ts` selects `campaigns(rate_cents)` straight into `rateCents`.

### Steps to reproduce
1. Create a campaign with "Ωριαία αμοιβή (EUR)" = 5,50.
2. Create a shift on it, 10:00–18:00.
3. Invite a promoter and open the `/i/<token>` link.

### What happened
The card reads:

```
Ημερομηνία   Πέμπτη 24 Σεπτεμβρίου · 10:00–18:00
Αμοιβή       5,50 €
```

Nothing on the page says "per hour". €5.50 for an eight-hour day is below any lawful rate in
Greece, so the most likely reading is also the most alarming one. The opposite error is worse
commercially: a promoter who reads it as €5.50/hour when the agency meant something else has been
misinformed about their pay by the agency's software.

### What should happen
Say the unit: "Αμοιβή 5,50 €/ώρα", and ideally also the computed total for the shift's own hours,
which is the number the promoter actually wants.

### Suggested fix
Change the key's value to include the unit in both locales
(`"invitation.rate": "Αμοιβή (ανά ώρα)"` / `"Pay (per hour)"`), or add a second line computed from
`endTime − startTime`. A locale-string change plus, optionally, one arithmetic helper.

---

## A3-05 — `/i` and `/c` answer every failure with "expired", including a cancelled shift

**Severity: serious.**

### What
Both promoter pages collapse every possible failure into one sentence with no title, no
explanation and no next step. One of those failures is "the agency cancelled your shift", and the
message for it is that the link has expired.

### Where
- `app/i/[token]/page.tsx:29-35` — `if (!result.ok)` renders only `t("invitation.expired")`
  ("Η πρόσκληση έχει λήξει."). `loadInvitation` can return `malformed`, `bad_signature`, `expired`,
  `wrong_purpose` or `not_found`; all five look identical.
- `app/c/[token]/page.tsx:31-37` — same shape with `t("checkin.expired")`
  ("Ο σύνδεσμος έχει λήξει ή δεν είναι έγκυρος."). `loadCheckin` also returns `cancelled` here.
- Contrast `app/a/[token]/page.tsx:80-98`, which does this correctly.

### Steps to reproduce
Each of these was run with `curl` against the live server and the visible text extracted:

| What I sent | What the promoter sees |
|---|---|
| `/i/garbage` | Η πρόσκληση έχει λήξει. |
| `/i/<valid signature, unknown invitation id>` | Η πρόσκληση έχει λήξει. |
| `/i/<checkin-purpose token>` | Η πρόσκληση έχει λήξει. |
| `/i/<one character changed in the signature>` | Η πρόσκληση έχει λήξει. |
| `/i/<payload swapped, old signature>` | Η πρόσκληση έχει λήξει. |
| `/c/<token whose assignment was cancelled>` | Ο σύνδεσμος έχει λήξει ή δεν είναι έγκυρος. |
| `/c/garbage` | Ο σύνδεσμος έχει λήξει ή δεν είναι έγκυρος. |
| `/a/garbage` | **Ο σύνδεσμος δεν λειτουργεί** / Ο σύνδεσμος δεν είναι έγκυρος — μπορεί να κόπηκε κατά την αντιγραφή. / Ζήτησε από τον συντονιστή σου να σου στείλει καινούργιο σύνδεσμο. |
| `/a/<expired token>` | **Ο σύνδεσμος δεν λειτουργεί** / Αυτός ο σύνδεσμος έληξε. / Ζήτησε από τον συντονιστή σου… |

Tampering is correctly rejected in every case — the signature scheme does its job. This finding is
only about what the person is then told.

### What happened
`/i` and `/c` produce a bare grey sentence on an otherwise empty page. There is no heading, no
"ask your coordinator", no phone number, no link to anything. For a promoter whose WhatsApp
truncated the URL — by far the likeliest cause, and the one `/a` names out loud — the page asserts
the invitation expired, which is false and sends them to the wrong conclusion.

### What should happen
`/i` and `/c` should look like `/a`: a title, the specific reason, and a next step. `/a` already
proves the pattern and the copy exists.

### Suggested fix
Lift `/a`'s `ErrorScreen` shape into `/i` and `/c`, mapping each `reason` to its own key. Six new
keys per locale. `cancelled` in particular must get its own sentence (see A3-02).

---

## A3-06 — Archiving a promoter revokes one of their four links; the other three keep working

**Severity: serious.**

### What
Archiving or blocklisting is the product's stated way to cut a promoter off — but it only stops
the availability page. Their invitation link, arrival page and field report all keep working.

### Where
- `app/a/[token]/data.ts:76-79` checks `status === "archived" || "blocklisted"` and returns
  `inactive`. Its own comment calls this "the closest thing we have to revocation".
- `lib/invitations.ts:loadInvitation` and `respondToInvitation` never select `promoters.status`.
- `lib/checkins.ts:loadCheckin`, `submitCheckin`, `submitFieldReport` and `attachReportPhoto`
  never select it either.

### Steps to reproduce
1. Create a promoter, invite them, accept, and check in — so they hold a live `/i` link, a live
   `/c` link and an unfiled report.
2. As the coordinator, open `/promoters/<id>/edit`, press "Αρχειοθέτηση promoter", then
   "Ναι, αρχειοθέτηση".
3. Open all four of that promoter's links.

### What happened

| Link | Result after archiving |
|---|---|
| `/a/<token>` | **Blocked** — "Ο σύνδεσμος δεν λειτουργεί / Αυτός ο σύνδεσμος δεν είναι πλέον ενεργός." |
| `/i/<token>` | Renders in full: shift, brief, "Ευχαριστούμε! Η βάρδια καταχωρήθηκε.", and a working "Άνοιγμα σελίδας άφιξης" button |
| `/c/<token>` | Renders the arrival page in full |
| `/c/<token>/report` | Renders the report form, ready to submit |

I did not have a *pending* invitation left for an archived promoter, so I did not watch an archived
person press "Αποδοχή". `respondToInvitation` has no status check anywhere in its path, so I expect
it to succeed; I am reporting that part as a code reading, not an observation.

### What should happen
Archiving is what a coordinator does when cooperation has ended — including after an incident. A
blocklisted promoter must not be able to accept a shift or record an arrival. The four surfaces
should agree.

### Suggested fix
Add the same status gate `app/a/[token]/data.ts` already uses to `loadInvitation`,
`respondToInvitation`, `loadCheckin`, `submitCheckin` and `submitFieldReport` — one extra column in
each existing select and one early return. Note the two cases differ in the right message:
someone who has already worked the shift should probably still be able to file the report, so
consider gating the *write* paths and `loadInvitation`'s accept button rather than the report.

---

## A3-07 — An out-of-range number kills the whole report with a generic error, forever

**Severity: serious.**

### What
A number too large for a Postgres `integer` passes both the browser's validation and the server's,
then fails at the database. The promoter is told only "we could not save the report, try again" —
with no field named. Trying again does exactly the same thing.

### Where
`app/c/[token]/report/actions.ts:27-34` — `parseOptionalNonNegativeInt` accepts anything that is
`Number.isFinite`, `Number.isInteger` and `>= 0`. `1e24` satisfies all three. `field_reports`
columns are `integer` (`supabase/migrations/0001_init.sql:298-299`). The insert fails and
`lib/checkins.ts:submitFieldReport` returns `save_failed`, which maps to
`t("report.error.save_failed")`.

### Steps to reproduce
1. Open `/c/<token>/report` after checking in.
2. Put `999999999999999999999999` in "Τεμάχια που προωθήθηκαν" and leave everything else empty.
   (The form's own `checkValidity()` returns **true** for this — `min=0` and `step=1` are both
   satisfied, so the browser does not intervene.)
3. Tap "Αποθήκευση αναφοράς".

### What happened
`role="alert"` reads "Δεν μπορέσαμε να αποθηκεύσουμε την αναφορά. Δοκίμασε ξανά." The field values
are preserved, which is good, but nothing points at the offending field, and the only advice —
"try again" — cannot work.

For contrast, the values the browser *does* catch (`-5`, `3.5`) are blocked by the native tooltip,
which is in the browser's language, not Greek, and leaves no trace in the page.

### What should happen
An upper bound in the same place as the lower bound, with a specific Greek message on the field:
"Ο αριθμός είναι πολύ μεγάλος."

### Suggested fix
Add `n > 2_147_483_647 → { ok: false }` to `parseOptionalNonNegativeInt`, and a `max` attribute on
the three number inputs so the browser catches it first. One new locale key, or reuse
`report.validation.number_invalid`.

---

## A3-08 — A rejected photo is never reported to the promoter

**Severity: serious.**

### What
`submitReport` counts failed photos and there is a locale string for it
(`report.success_with_photo_failures`), but the promoter can never see it: the same action's
`revalidatePath` swaps the whole form out for the "already submitted" screen before the success
state can render.

### Where
- `app/c/[token]/report/actions.ts:148-152` — counts `photosSaved` / `photosFailed`, then
  `revalidatePath`, then returns the success state.
- `app/c/[token]/report/page.tsx:50-55` — on re-render, `v.hasReport` is now true, so the page
  returns the terminal "Η αναφορά έχει ήδη υποβληθεί" screen instead of `<ReportForm>`. The form
  component holding the success state is unmounted.
- `report-form.tsx:117-126` — the branch that would have shown the warning.

### Steps to reproduce
1. Open `/c/<token>/report` after checking in.
2. Put three files into the photo input: a JPEG, a PNG, and a `.txt` file with type `text/plain`.
   (The `accept` attribute filters the picker but does not stop a file that reaches the input by
   other means; the server is the real gate, and it rejects `text/plain` as `invalid_type`.)
3. Fill a couple of numbers and some notes, and submit.
4. Read the page, then open the coordinator's `/campaigns/<id>/report`.

### What happened
The promoter's page showed **"Η αναφορά έχει ήδη υποβληθεί. Ευχαριστούμε!"** — no mention of
photos at all. The coordinator's report confirmed the split: "ΦΩΤΟΓΡΑΦΙΕΣ 2", with the two images
listed and the third silently gone.

So a promoter who photographs a shelf, has the upload rejected, and closes the page believes the
client has the photo. The client does not.

### What should happen
The promoter must be told which photos did not make it, and be able to retry them. At minimum the
existing warning must be reachable.

### Suggested fix
Drop `revalidatePath` from the success path (the form already renders its own terminal state), or
have `page.tsx` accept a "just submitted" state instead of falling straight through to
`hasReport`. Longer term, allow photos to be added to an existing report so a retry is possible.

---

## A3-09 — The brief vanishes from an accepted invitation after 24 hours

**Severity: serious.** *Code reading — see below.*

### What
The invitation page deliberately stays readable after its token expires, so an accepted promoter
can come back on the day for the check-in link. The brief on that same page does not: it is read
through a stricter verifier and silently disappears.

### Where
- `lib/invitations.ts:loadInvitation` uses `verifyTokenSignature` (expiry *reported*, not
  enforced) and then allows `status === "accepted" && acceptedInvitationStillReadable(on_date)`.
  `lib/checkins.ts:createCheckinLinkForInvitation` does the same.
- `lib/briefs.ts:loadInvitationCampaign` uses **`verifyToken`**, which enforces expiry. Past the
  24-hour TTL it returns `{ ok: false, reason: "expired" }`.
- `app/i/[token]/page.tsx:41-43` — `const brief = briefResult.ok ? briefResult.view : null`, and a
  null brief renders nothing. No error, no gap, no trace.

### Steps to reproduce
Not reproduced live. `createInvitation`'s TTL defaults to 24 hours and no coordinator screen
exposes a shorter one, so reproducing it needs either a 24-hour wait or a hand-called
`createInvitation(shiftId, promoterId, 0.01)`. I minted an expired token by hand to try it, but
that is correctly rejected earlier by the stored-hash check in `loadInvitation`
(`data.token_hash !== hashToken(token)`), so it does not exercise this path.

What I *did* confirm is the two halves of the mechanism separately: an accepted invitation reopened
within the window renders both the brief and a freshly minted check-in link (I reopened one four
times, and got a new `/c/` URL each time), and `lib/briefs.ts` uses the strict verifier at
line 40.

### What happened / would happen
On the morning of the shift — more than 24 hours after the invitation was sent, which is the normal
case — the promoter reopens the link the product told them to keep. They get the shift details and
the arrival button, and the brief section is simply absent. The brief is the document telling them
what to do in the store; it is the thing they reopen the link *for*.

### What should happen
The brief should follow the same rule as the rest of the page: readable for as long as the accepted
invitation is readable.

### Suggested fix
Change `lib/briefs.ts:loadInvitationCampaign` to `verifyTokenSignature`, and apply the same
`status === "accepted" && acceptedInvitationStillReadable(...)` test the other two readers use.
`acknowledgeBriefForInvitation` is a write and should keep `verifyToken` — though note that means
an accepted promoter can read a brief they can no longer acknowledge, so the acknowledge button
should be hidden rather than left to fail.

---

## A3-10 — Declaring yourself unavailable does nothing about a shift you already accepted

**Severity: serious.** This is a design gap, not a bug.

### What
`/a/[token]` lets a promoter say "Δεν μπορώ" for a date. It writes an availability row and stops
there. An invitation already out for that date stays pending; an assignment already confirmed for
that date stays confirmed; and the coordinator's screens show no sign that the promoter has since
said they cannot come.

### Where
`app/a/[token]/data.ts:saveAvailabilityDay` writes only to `availability`. Nothing reads across to
`invitations` or `assignments`. `app/shifts/[id]/board.ts` does not consider availability.

### Steps to reproduce
1. Invite a promoter to a shift on 23/09 and leave it pending.
2. As the promoter, open `/a/<token>` and tap "Δεν μπορώ" on 23/09.
3. As the coordinator, open `/promoters/<id>/availability`, then the 23/09 shift.

### What happened
The coordinator's availability page correctly shows **"Τετ 23/09 · Μη διαθέσιμη · Το δήλωσε η
ίδια"** — the provenance tracking works well. But the shift board for that same day still reads:

```
A3 Δοκιμή Προμότερ   Αναμονή απάντησης   Στάλθηκε: 21/09, 19:11   Λήγει: 22/09, 19:11
ΓΙΑΤΙ ΧΡΕΙΑΖΕΤΑΙ ΑΝΑΠΛΗΡΩΣΗ — 1 πρόσκληση σε αναμονή απάντησης
```

I also cleared a day on which the promoter held a (since-cancelled) confirmed assignment; the page
said nothing about it either.

The promoter's side of this is the part that matters. They have used the tool the agency gave them
to say they cannot work that day. Nothing tells them that this is not the same as declining the
invitation, and nothing on the availability page mentions the shift at all. They will believe the
message was received.

### What should happen
Two things, in order of cost. The availability page should, when a date carries a pending
invitation or a confirmed assignment, say so and route the promoter to the right action: "Έχεις
ήδη πρόσκληση για αυτή τη μέρα — απάντησε εκεί" with the link, or "Έχεις κλεισμένη βάρδια — μίλα
με τον συντονιστή". And the coordinator's shift board should flag a pending invitation whose
promoter has since declared themselves unavailable, because that invitation is not going to be
accepted and the replacement search should start now.

### Suggested fix
The promoter-side warning is the smaller change and the one that stops someone being stood up:
`app/a/[token]/data.ts` already has the promoter id, so one extra query over `shifts` joined to
that promoter's non-cancelled assignments and pending invitations inside the fortnight would carry
a per-day flag into `GridDay`. Note it must not leak campaign, client or store names — the file's
own header is explicit that this page shows nothing about the agency, and a date-only flag keeps
that promise.

---

## A3-11 — Accept, decline and "Το διάβασα" give no feedback at all while they run

**Severity: serious.**

### What
Every button on the invitation page dims to 50% opacity while its action runs and otherwise looks
exactly the same. On this connection those actions took between 10 and 30 seconds. A promoter has
no way to tell a tap that registered from a tap that missed.

### Where
- `app/i/[token]/respond-form.tsx:18-38` — `Buttons` uses `useFormStatus().pending` only to set
  `disabled`, and keeps `acceptLabel` / `declineLabel` unchanged.
- `app/i/[token]/acknowledge-brief-form.tsx:31-42` — `ConfirmButton`, same.
- Compare `app/c/[token]/checkin-form.tsx`, which *does* swap in `labels.locating` /
  `labels.submitting`, and `report-form.tsx`, which swaps in `labels.submitting`. The invitation
  page is the odd one out.

### Steps to reproduce
1. Open a pending `/i/<token>`.
2. Tap "Το διάβασα" and time it.
3. Tap "Αποδοχή" and time it.

### What happened
"Το διάβασα": nothing visible changed for about 10 seconds, then the button was replaced by "Το
διάβασες: 21 Σεπ 2026, 7:15 μ.μ." I initially recorded this as a failed tap and was about to
report it as a bug — which is exactly the mistake the promoter will make, except they will tap
again.

"Αποδοχή" / "Απόρριψη": a decline took about 14 seconds to swap in "Ευχαριστούμε για την
απάντηση." The server log showed one accept POST taking **30 seconds**.

### What should happen
The label should change on tap — "Αποστολή…" — the way the arrival and report buttons already do.

### Suggested fix
Add `sendingLabel` props to `RespondForm` and `AcknowledgeBriefForm` and render them when
`pending`. Two new keys per locale. Separately, the 30-second accept is worth a look on its own:
`createInvitation` runs `matchPromoters(shiftId, 100)` purely to freeze a score breakdown, and
`respondToInvitation` re-ranks on every decline.

### A note on a related symptom I could not pin down
On my first accept, the page did not update at all: 30 seconds after the POST returned 200, the
form still showed "Αποδοχή / Απόρριψη", and only a manual reload revealed the confirmation and the
check-in link. I could not reproduce it on three later accepts, which all updated correctly. I am
recording it rather than diagnosing it. If it is real it is a blocker, because the promoter's next
move is to tap "Αποδοχή" again — and a second tap returns `already_answered`, which
`respond-form.tsx` handles by rendering **the form again with no message at all** (the component
has branches for `accepted` and `declined` but none for `error`). Worth giving `RespondState`'s
error case a visible branch regardless of whether the refresh bug is real.

---

## A3-12 — The invitation never says who it is from, or who it is for

**Severity: annoying.** Consequential for a promoter who works for several agencies.

### What
`/i/[token]` shows campaign, store, date, dress code and pay. It never shows the agency's name, and
it never shows the promoter's own name — even though `loadInvitation` already returns
`promoterName`.

### Where
`lib/invitations.ts:InvitationView` carries `promoterName`; `app/i/[token]/page.tsx` never renders
it. No query on that page reaches `agencies`. Compare `app/a/[token]/page.tsx:127-129`, which
greets the promoter by name ("Γεια σου {name}.").

### Steps to reproduce
Open any `/i/<token>` and read the page top to bottom.

### What happened
The first line is "Νέα βάρδια". A promoter who works for three agencies, receiving this via a
forwarded WhatsApp message from a number they may not have saved, cannot tell which agency is
offering the shift. The message body they received is no help either — it is campaign name, store
name, date, "Είσαι διαθέσιμη;" and the URL (see A3-17).

The missing name also removes the only cheap check against a coordinator pasting the wrong link
into the wrong chat: nothing on the page would look wrong to the person who opened it.

### What should happen
Greet by name, and name the agency, the way the availability page already does.

### Suggested fix
Render `v.promoterName` in a greeting line; add `agencies.name` to `loadInvitation`'s select and
show it in the header. The privacy notice already establishes that the agency is the controller,
so naming it here is consistent with the legal shape.

---

## A3-13 — The invitation does not show the store address

**Severity: annoying.**

### What
The invitation shows the store's *name* only. The address appears for the first time on the
arrival page, which the promoter only reaches after accepting.

### Where
`lib/invitations.ts:InvitationView` selects `stores(name)` and no address.
`lib/checkins.ts:CheckinView` selects `stores(name, address, lat, lng)` and `app/c/[token]/page.tsx`
renders `{storeName} · {storeAddress}`.

### Steps to reproduce
Open a pending `/i/<token>` and compare with the `/c/<token>` page for the same shift.

### What happened
The invitation reads "Κατάστημα: A3 Audit Store". The arrival page reads "A3 Audit Store · A3 test
address". A chain store has many branches; "ΑΒ Βασιλόπουλος" is not an answer to "can you work
this?" — how far away it is, is.

### What should happen
Show the address on the invitation. It is the single most decision-relevant fact after the date,
and the matching engine has already scored this promoter on their distance to it.

### Suggested fix
Add `address` to the `stores(...)` select in `loadInvitation` and one line to the definition list.

---

## A3-14 — An empty report can be filed by accident and locks out the real one

**Severity: annoying.** Cheap to fix, expensive when it happens.

### What
Every field on the report is optional, the submit is irreversible, and there is no confirmation. A
stray tap files an empty report, and from then on the page says "already submitted" with no way to
add anything.

### Where
`app/c/[token]/report/actions.ts` validates types but never requires a value.
`lib/checkins.ts:submitFieldReport` rejects a second report with `already_submitted`, and there is
no update path anywhere in the codebase.

### Steps to reproduce
1. Open `/c/<token>/report` after checking in.
2. Tap "Αποθήκευση αναφοράς" without entering anything.
3. Reload.

### What happened
The report saved. The page now shows "Η αναφορά έχει ήδη υποβληθεί. Ευχαριστούμε!" and the
coordinator's campaign report counts it in "Από όλες τις 1 αναφορές πεδίου" with nulls throughout.

### What should happen
Either require at least one field, or confirm an empty submit ("Δεν συμπλήρωσες τίποτα. Σίγουρα;"),
or — best — allow the report to be edited until the end of the following day, which also fixes the
photo-retry problem in A3-08.

### Suggested fix
The confirmation is one `useState` in `report-form.tsx`, no schema change. Editing is the right
answer but is a larger parcel.

---

## A3-15 — `capture="environment"` can hide the photo library on a phone

**Severity: annoying.** *Code reading — not tested on a real device.*

### What
The photo input sets `capture="environment"` alongside `multiple`. On iOS Safari, `capture` makes
the input open the camera directly and suppresses the photo-library option, and `multiple` is
ignored while it is present. A promoter who photographed the display during the shift and files the
report on the bus afterwards cannot reach those photos.

### Where
`app/c/[token]/report/report-form.tsx:227-236`.

### Steps to reproduce
Not run — the browser I audited with is not a phone, and behaviour here is genuinely
platform-specific. Flagging it because the affected case (filing the report later, from the camera
roll) is the common one, and because the component comment asserts the opposite: "opens the back
camera directly on a phone without extra UI".

### What should happen
Both paths should be available: take a photo now, or pick photos taken earlier.

### Suggested fix
Drop `capture` and keep `accept="image/*"` plus `multiple` — phones then offer both camera and
library. If shooting in the moment matters, use two inputs, one with `capture` and one without.
Worth 10 minutes on a real handset before changing anything.

---

## A3-16 — English is unreachable on every promoter page

**Severity: annoying.** Contradicts a stated product constraint.

### What
`CLAUDE.md` says the UI is bilingual from the first screen. Every promoter-facing page hardcodes
the default locale, and there is no switcher on any of them. The English dictionary is complete and
cannot be reached.

### Where
`app/i/[token]/page.tsx:25`, `app/c/[token]/page.tsx:25`, `app/c/[token]/report/page.tsx:23`,
`app/c/[token]/report/actions.ts:10`, `app/a/[token]/page.tsx:104`,
`app/privacy/promoters/page.tsx:34` — all `translatorFor(DEFAULT_LOCALE)`. No `LocaleSwitcher` is
imported anywhere under `app/i`, `app/c` or `app/a`. `app/c/[token]/report/actions.ts:8` says as
much: "promoter-facing pages have no locale switcher yet".

### Steps to reproduce
Open any promoter page and look for a way to change language.

### What happened
There is none. I checked the dictionaries for completeness and they are in good shape: 120
promoter-facing keys under `invitation.*`, `checkin.*`, `report.*`, `promoter_availability.*` and
`promoter_privacy.*` in each of `lib/i18n/el.ts` and `lib/i18n/en.ts`, with **zero** missing on
either side. The translations exist; only the route to them is missing.

This matters more on the promoter side than anywhere else in the product. Field staff in Athens are
not uniformly Greek-speaking, and this is the one surface used by people who get no training and
cannot ask anyone.

### What should happen
A locale toggle on the promoter pages, or `?lang=en` honoured on the token routes.

### Suggested fix
`?lang=` on the four promoter routes is the smallest version: read `searchParams`, validate against
`Locale`, fall back to `DEFAULT_LOCALE`. The coordinator's link-copy UI can then offer an English
link. Lane D owns `lib/i18n/index.ts`; this is a request, not a change I made.

---

## A3-17 — The invitation message is hardcoded Greek, and gendered feminine

**Severity: annoying.**

### What
The WhatsApp message body the coordinator pastes is built from string literals in `lib/`, not
through `t()`, and it addresses the promoter in the feminine.

### Where
`lib/invitations.ts:103-112`:

```
"Νέα βάρδια", campaign?.name, store?.name, formatShiftWhen(...), "", "Είσαι διαθέσιμη;"
```

Two user-facing strings, neither behind a key, in a file that imports `translatorFor` two lines
above and uses it for the email subject. `CLAUDE.md`'s conventions say no user-facing string is
ever inline.

### Steps to reproduce
Invite a promoter from `/promoters/<id>/invite` and read the message in the copy box.

### What happened

```
Νέα βάρδια
A3 Audit Campaign
A3 Audit Store
Πέμπτη 24 Σεπτεμβρίου · 10:00–18:00

Είσαι διαθέσιμη;

http://localhost:3309/i/eyJwIjoi…
```

"Είσαι διαθέσιμη;" is feminine. The roster I worked with contains men (Γιώργος, Δημήτρης, Νίκος,
Ανδρέας), and `invitation.question` in `el.ts:55` has the same problem on the page itself. It is a
small thing that reads as carelessness to the person receiving it.

### What should happen
Both strings behind keys in both locales, and phrased so they do not assume gender — "Μπορείς;" or
"Είσαι διαθέσιμος/-η;". The product already uses the `/-η` form elsewhere
("Επιβεβαιωμένος/η" on the board).

### Suggested fix
Two keys, appended to both dictionaries; `lib/invitations.ts` already holds a module-level
`t = translatorFor(DEFAULT_LOCALE)`.

---

## A3-18 — Partial-day validation costs a server round trip

**Severity: annoying.**

### What
Choosing an end time before the start time is only caught by the server. On this connection that
was a 12-second wait for an answer the page had enough information to give instantly.

### Where
`app/a/[token]/availability-grid.tsx:PartialEditor` submits whatever is selected;
`lib/availability-links.ts:planRow` returns `bad_range`, and the message comes back through
`saveDay`.

### Steps to reproduce
1. Open `/a/<token>`, tap "Ωράριο" on any day.
2. Set "Από" 22:00 and "Έως" 08:00, and tap "Αποθήκευση ωραρίου".

### What happened
About 12 seconds of nothing, then "Η ώρα λήξης πρέπει να είναι μετά την ώρα έναρξης." The message
itself is good — specific and in plain Greek.

### What should happen
Same message, immediately, and ideally the "Έως" list should not offer times at or before the
chosen "Από" at all.

### Suggested fix
Filter `endTimes` against the selected `from` inside `PartialEditor`. The server check stays as the
real gate.

---

## A3-19 — Availability cannot express a window that crosses midnight

**Severity: annoying.** A domain gap rather than a defect.

### What
A partial day is one `available` window with `to_time > from_time`. A promoter available from
22:00 until 02:00 — an event, a night activation, a late supermarket — has no way to say so.

### Where
`lib/availability-links.ts:START_TIMES` runs 06:00–22:00, `END_TIMES` runs 08:00–23:00, and
`planRow`'s `partial` branch rejects `toTime <= fromTime`.

### Steps to reproduce
Open `/a/<token>`, tap "Ωράριο", and try to express "22:00 until 02:00".

### What happened
The "Έως" list stops at 23:00, and anything earlier than the start is rejected as `bad_range`. The
closest available statement is "Διαθέσιμη από 22:00" with no end, which is a different claim.

### What should happen
Worth a decision rather than a fix. Promotion work does run past midnight, and the matching filter
(`from_time <= shift.start_time and to_time >= shift.end_time`) has the same limitation, so the gap
is consistent across the engine — which is why I am flagging it as a design question for the owner
rather than a bug.

### Suggested fix
None proposed; it touches the matching filter and the schema's shape. If the answer is "night
shifts are out of scope", say so in `docs/roadmap.md` so the next person does not rediscover it.

---

## A3-20 — The coordinator's bulk clear erases the promoter's own words without trace

**Severity: annoying.**

### What
"Καθάρισε όλο το δεκαπενθήμερο" deletes every availability row for the fortnight, including the
days the promoter declared themselves. The coordinator is warned; the promoter is never told.

### Where
`app/promoters/[id]/availability/availability-grid.tsx:77-124` (the arm-then-fire control) and its
bulk action. `app/a/[token]/data.ts` has no notion of who last changed a day.

### Steps to reproduce
1. As the promoter, set several days on `/a/<token>`, including a partial day.
2. As the coordinator, open `/promoters/<id>/availability` and tap "Καθάρισε όλο το δεκαπενθήμερο"
   twice.
3. As the promoter, reopen `/a/<token>`.

### What happened
The coordinator's side is genuinely well done. The first tap arms the button — "Σίγουρα; Πάτησε
ξανά για να σβήσεις" — and, because some days carried `source: "self"`, it showed the right
warning: **"Προσοχή: κάποιες από αυτές τις μέρες τις δήλωσε η ίδια η promoter. Θα σβηστούν κι
αυτές, χωρίς αναίρεση."** That is exactly the care this deserves.

The promoter's side is the gap. All fourteen days came back reading "Δεν έχει οριστεί", identical
to a fortnight they had never touched. Nothing says their entries were cleared, or by whom. They
will assume the page lost their work — and, because an unset day is never offered by the matching
engine, they quietly stop being offered shifts.

### What should happen
A line at the top of the promoter's grid when the last change was not theirs: "Ο συντονιστής σου
καθάρισε τις δηλώσεις σου — μπορείς να τις ξαναβάλεις."

### Suggested fix
Hard as it stands, because a cleared day has no row and therefore no `source` to read — the
information is deleted along with the data. The cheap version is to have the bulk clear write a
single timestamp on the promoter (a `availability_cleared_at` column) that `/a/[token]` reads. That
is a migration, so it belongs with whoever next opens that schema.

---

## A3-21 — An "already checked in" error drops the promoter into the override form

**Severity: cosmetic.**

### What
Every server error on the arrival page, including "you are already checked in", sets the form's
phase to `override` — so the promoter is shown the manual-arrival form and invited to submit it,
which will fail the same way.

### Where
`app/c/[token]/checkin-form.tsx:70-77` — `handleActionResult` sets `setPhase("override")` for every
non-success result, including `already_checked_in`, which has its own message in `labels`.

### Steps to reproduce
Open `/c/<token>` in two tabs, check in from one, then tap "Δήλωσε άφιξη" in the other.
(I did not run this exact race — the behaviour is read off the branch above and off the fact that
`submitCheckin` returns `already_checked_in` before anything else.)

### What happened / would happen
The correct message appears, attached to a form that cannot succeed. Reloading shows the right
state, so the promoter can recover, which is why this is cosmetic rather than serious.

### Suggested fix
Route `already_checked_in` to the success/checked-in view instead of `override`.

---

## A3-22 — The privacy link is a 15px line of grey text at the very bottom

**Severity: cosmetic.**

### What
"Τα προσωπικά σου δεδομένα" is a 15px-tall muted link at the foot of every promoter page, below
the fold on a phone.

### Where
`app/i/[token]/page.tsx:145-152`, `app/c/[token]/page.tsx:141-148`,
`app/a/[token]/page.tsx:157-164`.

### Steps to reproduce
Open any promoter page at 375px and measure the link.

### What happened
Measured height 15px, width 169px — the only sub-40px target on the page; every other control is
44px or more, and there is no horizontal overflow at 375px anywhere I looked (`/i`, `/c`,
`/c/report`, `/a` all have `scrollWidth === 375`). The layout work is good; this one link is not
comfortably tappable.

It carries more weight than its size suggests: it is the Gate 1 notice, and on `/c` it is the page
where location is asked for.

### Suggested fix
Padding to bring it to a 44px target. Worth also lifting it next to the privacy sentence on `/c`,
where it is actually relevant, rather than only at the bottom.

---

## A3-23 — Full promoter tokens are written into the request log line

**Severity: cosmetic.** Worth a decision before production traffic.

### What
Every request logs the whole path, which contains the token. The token is the credential for one
named person's shift, phone-adjacent data and arrival record, and its payload is base64url, not
encrypted — the promoter's uuid and the expiry read straight out of it.

### Where
The URL scheme itself (`lib/tokens.ts:linkFor`), plus whatever logs request paths. Observed in the
dev server's own access log:

```
GET /a/eyJwIjoiaW52aXRhdGlvbiIsImkiOiJhdmFpbGFiaWxpdHk6YWE1NGEwZTUt… 200 in 23041ms
POST /c/eyJwIjoiY2hlY2tpbiIsImkiOiJjZDRkODZkOS1mOWNl… 200 in 2878ms
```

Decoding the first payload gives
`{"p":"invitation","i":"availability:aa54a0e5-…","e":1794845183}`.

### Steps to reproduce
Open any promoter link and read the server's stdout.

### What happened
As above. `docs/build-plan.md` §8 lists "no personal data in any URL or log line" as part of P16,
and an availability token that lives 56 days sitting in a log is a standing credential in a place
nobody treats as secret.

### What should happen
A decision, at least: whether production request logs are retained, for how long, and who can read
them. This is a dev-server observation — I have not looked at what the hosting platform retains,
and that is the question that actually matters.

### Suggested fix
Out of scope for a code change here. Flagging it for whoever owns the production logging
configuration.

---

## Evidence on two questions asked during the audit

Both of these are **already-known A1 findings** (A1-07 and A1-03), so they are deliberately not
given A3 numbers and must not be counted twice. What follows is corroborating evidence gathered
from the promoter side.

### Can an anonymous promoter endpoint be hammered? Yes — there is no limiter of any kind.

**Evidence, run against the live server:**

- 40 rapid `GET /i/garbage<n>` (signature fails before any database call) → **40 × 200**, no 429.
- 25 rapid `GET /a/<a valid token>` (each one performs two database reads) → **25 × 200**, no 429.
- Response headers on that route carry no `Retry-After` and no `X-RateLimit-*`.
- One `000` above is the first request while the route compiled and one `404` is a dev-server
  hiccup; neither is throttling.

**Why there is nothing to hit:** `middleware.ts:150-162` scopes `config.matcher` to
`/dashboard`, `/shifts`, `/promoters`, `/campaigns`, `/settings` and `/login` — **the promoter
routes are deliberately excluded**, with a comment explaining that running auth middleware over
them would add a round trip. That reasoning is sound for *auth*, but it also means no middleware
at all executes on `/i`, `/c` or `/a`, so there is no layer where a limiter currently could sit.
Grepping the whole tree for `rate_limit|rateLimit|ratelimit` finds only the public waitlist form
(`app/actions.ts:58`) and Supabase Auth's own 429 on login (`app/login/actions.ts:58`). Nothing
in `lib/invitations.ts`, `lib/checkins.ts` or `app/a/[token]/data.ts` counts anything.

**What that exposes, specifically from the promoter side.** These are unauthenticated URLs whose
only credential is an HMAC in the path, and the token payload is base64url, not encrypted — so an
attacker can read a real token's structure (`{"p":"invitation","i":"<uuid>","e":<unix>}`) and knows
exactly what to vary. The signature is 32 bytes of HMAC-SHA256 and is not brute-forceable, so this
is not a practical path to another promoter's data. The realistic damage is availability and cost:
every valid request to `/a/[token]` runs two queries through the **service-role** client, and
`/i/[token]` additionally mints a check-in token and, when accepted, does a further assignment
lookup. There is nothing to stop a single IP driving those continuously. `docs/build-plan.md` §8
lists "rate limiting on `/i/*` and `/c/*` by IP and by token" as part of P16, marked **must**; on
the evidence above it was not built, and `/a/*` did not exist when P16 was written.

**Aggravating factor from my own findings:** an availability token lives 56 days
(`lib/availability-links.ts:AVAILABILITY_TTL_DAYS`) and cannot be revoked except by archiving the
promoter, and full tokens appear in request log lines (A3-23). A leaked token is therefore a
long-lived, unthrottled, unrevokable handle.

### Are report photos ever deleted from storage? No — not by any code path.

**Evidence:**

- Grepping the entire tree for a storage removal — `storage` within the same line as
  `remove|delete|rm(` across `lib/`, `app/` and `scripts/` — returns **nothing**. The only
  storage call anywhere is the upload at `lib/checkins.ts:440`
  (`db.storage.from(PHOTO_BUCKET).upload(path, file, …)`).
- `report_photos` is written in one place (`lib/checkins.ts:446`) and read in two
  (`lib/erasure.ts`, `app/campaigns/[id]/report/data.ts:218`). No writer ever removes the object
  the `storage_path` column points at.
- `lib/erasure.ts:202` `erasePromoter` deletes **rows** and records `deletedCounts`. It counts
  `report_photos` (line 287) but never touches the bucket, so a completed erasure leaves the
  images in place.
- `lib/retention.ts:146-149` is explicit that `report_photos` is "Flagged for review, not deleted"
  and that a photo "can incidentally contain a person, which no automated rule can detect". So the
  rows are on a review path; the files are on no path at all.

**Why this matters on the promoter side specifically.** The images are of a supermarket aisle taken
by a named worker at a known time and place, uploaded from a page that promises, in Greek, "Δεν
αποθηκεύουμε τις συντεταγμένες σου ούτε σε παρακολουθούμε." That promise is kept for coordinates
(A3-01 aside, `check_ins` genuinely has no lat/lng columns) — but a promoter photographing a
display can easily catch a colleague or a customer, and those frames outlive every deletion the
product offers. The promoter privacy notice at `/privacy/promoters` renders a retention section
from `promoter_privacy.retention_body`; whatever it promises, photographs are currently outside
it. A subject-access or erasure request cannot be completed honestly today.

I confirmed the upload half of this myself: two images from my test report reached the bucket and
are listed on the coordinator's campaign report ("ΦΩΤΟΓΡΑΦΙΕΣ 2"). I did **not** attempt any
deletion, so "they survive an erasure run" is a code reading of `lib/erasure.ts`, not something I
watched happen.

---

## What I exercised and found working

Not padding — each of these was run, and each could have failed.

- **The token scheme holds.** Tampering with the signature, tampering with the payload and
  reusing an old signature are all rejected; a `checkin` token at `/i` is rejected as
  `wrong_purpose`; a valid signature over an unknown record id returns `not_found`; a hand-minted
  token with a correct HMAC is still refused because it does not match the stored `token_hash`.
- **Geolocation obeys CLAUDE.md §3 exactly.** One-shot `getCurrentPosition`, never `watchPosition`.
  Permission denied falls straight to the manual override with a specific message ("Δεν δόθηκε
  άδεια πρόσβασης στην τοποθεσία."). A position ~20m from the store recorded a clean arrival; a
  position in Thessaloniki recorded the arrival **anyway** and told the promoter so ("Φαίνεσαι
  μακριά από το κατάστημα. Το καταγράψαμε ούτως ή άλλως"). Location never blocked anyone.
  `check_ins` has no coordinate columns (`0001_init.sql:281-291`) and a `unique (assignment_id)`
  constraint, so a second check-in is impossible at the database, not just in the UI. The
  coordinator's report showed the derived pair only: "ΧΩΡΙΣ ΕΝΔΕΙΞΗ ΘΕΣΗΣ 1 · ΧΕΙΡΟΚΙΝΗΤΗ
  ΕΠΙΒΕΒΑΙΩΣΗ 1".
- **The manual override always exists**, is offered before anything fails ("Είμαι εδώ, το GPS δεν
  είναι σωστό" sits under the main button from the first render), accepts an optional free-text
  reason, and produced a valid check-in.
- **Photo shrinking works, and works on a file that would otherwise be refused twice over.** An
  11.79 MB 4032×3024 JPEG came out at **673 KB** with its name intact — under both the 4 MB action
  body cap and the 8 MB server limit. Several photos in one submit worked; both valid images
  reached storage and appear on the coordinator's report.
- **The report survives a partial failure.** Text fields saved even though one of three attached
  files was rejected — the deliberate ordering in `actions.ts` does what its comment claims.
- **Long Greek free text** (~2,000 characters) saved and rendered correctly on the client report.
- **The check-in link really is there**, on first accept and on every reopen — I reopened one
  accepted invitation four times and got a freshly minted, working `/c/` URL each time.
- **"Το διάβασα" holds.** It recorded once, showed "Το διάβασες: 21 Σεπ 2026, 7:15 μ.μ." on every
  later view, and the timestamp survived reloads and a later accept.
- **The brief is readable on a phone** — markdown headings, bullets and bold all render through
  `<Markdown>`, at 375px, without overflow.
- **Decline works end to end** and the page correctly switches to "Ευχαριστούμε για την απάντηση."
- **`/a/[token]` is the best-built page in the promoter set.** Whole-day, partial-day with a
  16:00–21:00 range, and clearing a day all saved and read back correctly; the fortnight rolled
  forward to the new day overnight; the error screens name a specific cause *and* a next step; and
  the page leaks nothing — no campaign, client, store, rate or other promoter, exactly as its
  header promises. One promoter's link showed only that promoter's data.
- **Self-declared provenance survives to the coordinator.** Every day the promoter set showed as
  "Το δήλωσε η ίδια" on `/promoters/<id>/availability`, and unset days read "Δεν έχει δηλωθεί —
  δεν προτείνεται στο matching".
- **Archiving does kill the availability link**, with the right message and a next step.
- **No horizontal overflow at 375px** on `/i`, `/c`, `/c/report` or `/a`; every control except the
  privacy link and the native file input is a 44px target or larger.
- **Both locale dictionaries are complete** for the promoter surface: 120 keys each, no gaps in
  either direction.
- **No consent checkbox anywhere**, as `docs/decisions.md` D5 requires.

## What I could not test, and why

- **The 24-hour expiry behaviour of an accepted invitation** (A3-09, and the "still readable"
  path generally). Reproducing it needs a real 24-hour wait or a `createInvitation` call with a
  short TTL, and no screen exposes one. A hand-minted expired token is correctly rejected earlier
  by the stored-hash check, so it does not reach the code in question.
- **An archived promoter pressing "Αποδοχή"** on a pending invitation (A3-06). I ran out of pending
  invitations for that promoter and the dev server began failing to compile
  `/promoters/[id]/invite` before I could make another. The read-side half is confirmed; the
  write-side half is a code reading.
- **The check-in action on a dropped connection** (the second half of A3-01). Every assignment I
  had was already checked in by then. The report form's behaviour is confirmed; `checkin-form.tsx`
  is inference from its `startTransition` without `try/catch`.
- **`capture="environment"` on a real iOS or Android handset** (A3-15). This is genuinely
  platform-specific and a desktop browser cannot answer it.
- **A real phone over HTTPS.** Everything here ran against `localhost`, which is exempt from the
  secure-context requirement. The geolocation permission prompt, the WhatsApp link handoff and
  whether a long token URL survives being pasted into a real chat are all untested. The
  truncated-link case is the one I would most want checked on a handset, because `/a`'s error copy
  already assumes it happens.
- **Geolocation timeout and `POSITION_UNAVAILABLE`.** I exercised permission-denied (the real
  browser denied it) and two granted positions by replacing `navigator.geolocation.getCurrentPosition`
  with a stub — an API-level emulation, stated plainly because it is not the same as a device with
  no GPS fix. The 12-second timeout branch was not exercised.
- **Anything about production.** This ran on a dev server; response times quoted above (10-30s for
  an action) are dev-mode numbers against a remote database and should not be read as production
  latency. They do, however, set the floor for how long the no-feedback windows in A3-11 are.
