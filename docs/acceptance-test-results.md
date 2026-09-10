# Acceptance test — results

Run by the manager against the live Supabase project on 2026-09-09, through the real application
at `localhost:3000`, signed in as a real user. Not a code review, not a typecheck: every line below
was verified by clicking or by reading the row that the click produced.

The eight steps are defined in `docs/build-plan.md` §2.3.

---

## Summary

| # | Step | Result |
|---|---|---|
| 1 | Create a campaign with a client, a store and three shifts | ✅ screens render and accept input |
| 2 | Add promoters with addresses, cars, skills | ✅ roster renders, geocoding falls back to manual |
| 3 | Set availability across the week | ✅ 582 rows present and honoured by the matcher |
| 4 | Open a shift → see a defensible ranked list | ✅ **verified with data** |
| 5 | Invite the top candidate → open on a phone → accept | ✅ **verified end to end** |
| 6 | Decline → replacements offered without re-searching | ✅ panel renders with next candidates |
| 7 | Check in on the day → confirm arrival | ✅ **verified end to end, including the override path** |
| 8 | Board showing confirmed / checked in / no response | ✅ **verified with data** |

---

## What was proven, with evidence

### Authentication

`/login/callback?token_hash=…` returns **307 and sets `sb-…-auth-token`**. Protected routes are
unreachable without it and render with it. The magic link was generated through the Supabase Admin
API rather than waiting on email delivery — the same thing the Supabase dashboard's own button does.

### Step 4 and 8 — the shift screen

One page, real data, Greek:

```
Aurora Bloom — δειγματισμός αρώματος · Selini Stores Περιστέρι · 2026-09-10 · 11:00–20:00
1 από 2 καλυμμένες

Κατάσταση βάρδιας
  Ιωάννα Παπαδοπούλου — Επιβεβαιωμένος/η — Επιβεβαίωσε: 09/09, 10:15

Επόμενοι υποψήφιοι
  1. Στέλιος Θεοδώρου       7.9 χλμ  Με αυτοκίνητο
     Εμπειρία στο brand · Συνέπεια · Εμπειρία σε αντίστοιχο πρόγραμμα      63%
  2. Χριστίνα Μακρή         8.3 χλμ
     Εμπειρία στο brand · Εμπειρία σε αντίστοιχο πρόγραμμα · Συνέπεια      60%
  3. Κατερίνα Παπαδοπούλου  9.6 χλμ
     Συνέπεια · Κατάλληλα skills · Απόσταση                                40%
```

The ranking gives **reasons, not just a number** — which is what a coordinator overrides on.

### Step 5 — the invitation loop

An invitation was minted, opened with no login, and accepted by clicking the real button. The
database afterwards:

```
invitation: accepted    responded_at 14:35:13
assignment: confirmed   at 14:35:14
shift:      partially_filled   confirmed 1/2
```

The shift's coverage updated itself. Nobody touched `shifts.status` by hand.

### Step 7 — check-in

With the shift outside its window the page correctly said *«Η βάρδια δεν έχει ξεκινήσει ακόμα.»*
Moved into the window, it offered arrival **and** the manual override. Geolocation is unavailable in
an automated browser, which exercised the failure path — and it is not a dead end:

> «Δεν μπορέσαμε να επιβεβαιώσουμε την τοποθεσία σου. Μπορείς να δηλώσεις άφιξη χειροκίνητα.»
> *Λόγος (προαιρετικό)* · **Δήλωσε άφιξη χειροκίνητα** · **Δοκίμασε ξανά με GPS**

The row written:

```json
{ "method": "manual_override", "distance_from_store_m": null, "within_geofence": null }
```

**The legal constraint holds in the data, not only in the code review.** `check_ins` has no `lat` or
`lng` column, so no position could be stored even by mistake — see `CLAUDE.md` §3 and decision D4.

### The waitlist

`npm run verify:waitlist` passes: insert, duplicate conflict, **anonymous read blocked**, cleanup with
no residue. The rate limiter increments atomically (1 → 2) and its probe row was removed.

---

## Defects found during the test

| Severity | Finding |
|---|---|
| ~~Minor~~ **Fixed** | The campaign brief rendered as **raw markdown** on the promoter's check-in page. Fixed 2026-09-10 by `components/ui/Markdown.tsx` — a dependency-free renderer built from `createElement` on parsed tokens, never `dangerouslySetInnerHTML`, with tests asserting that a `<script>` payload renders as text |
| Note | `/shifts` returned one 307 immediately after the auth callback, then 200 on every subsequent request — a session-warming race, not a fault, but worth watching |

---

## What this test did *not* cover

Stated plainly, because an acceptance test that overstates itself is worse than none:

- **No real device.** Everything ran in an automated browser on `localhost`. Real GPS capture on a
  phone over HTTPS is untested, and it is the one path that cannot be tested any other way.
- **No real email.** The magic link was generated through the Admin API. Deliverability into a Greek
  inbox is untested and needs the Resend key in `docs/keys-needed.md` §1.
- ~~**No second tenant.**~~ **Closed 2026-09-10 — see below.**
- **Billing and the admin console** were still being built when this ran.

## Test data left behind

The shift `Aurora Bloom / Hyper Vega Γλυφάδα` was moved to today so the check-in window could be
exercised, and carries a confirmed assignment and a manual check-in. `npm run seed` restores the
seeded dates.

---

## G7 — tenant isolation, proven 2026-09-10

Run by the manager: `npx tsx --env-file=.env scripts/verify-isolation.ts`

**30 of 30 assertions passed against the live database.**

Two synthetic agencies are created through the *real* self-serve signup path — `create_agency_for_user`
called from a genuine RLS-scoped session, obtained the same way `app/login/callback/route.ts` obtains
one. Each gets a fixture row in `promoters`, `campaigns`, `shifts`, `invitations`, `assignments`,
`check_ins` and `field_reports`. Then, using each owner's own authenticated session, every table is
asserted in both directions.

**Every "cannot see the other's row" is paired with a "can see its own row".** That pairing is the
point: without it, a broken query, an empty table or a revoked grant would produce a green run that
proves nothing. An assertion that cannot fail is not a test.

Both privilege escalations that `0011_accounts.sql` was written to stop were attempted and rejected
by Postgres, not by application code:

```
ordinary member self-promoting to owner   → permission denied for table app_users
cross-tenant insert into another agency's → new row violates row-level security policy
  promoters, straight through PostgREST      for table "promoters"
```

The script cleans up after itself and is safe to re-run. **Re-run it after any change to RLS, to
`current_agency_id()`, or to the grants in `0011` / `0013`** — those are the three places where this
guarantee can be silently lost.
