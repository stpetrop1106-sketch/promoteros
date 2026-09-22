# Security and data-protection audit — A1

**Date:** 2026-09-21 · **Branch:** `develop` @ `a288ad8` · **Target:** the live Supabase project
named in `.env`, which is also production.

This is a find-and-report parcel. **No application code was changed.** Every finding below carries
a reproduction that was actually run; where I could not run one, the finding says so in plain words
rather than asserting a conclusion the evidence cannot carry (BOARD.md, I6 / I7 / R2-2 / R2-3).

All probing was done inside agencies this audit created and deleted. The seeded demo agency, the
promoter "ΣΤΕΛΛΑ" and every pre-existing row were read but never modified. Two rows this audit
wrote (a `waitlist_rate_limit` counter and a storage object) were deleted again; the deletions are
shown in the transcripts below. No email was sent.

**Headline:** one **critical** finding. Any staff user of an agency — a junior coordinator — can
make themselves the owner of that agency and lock the real owner out. It was reproduced end to end
against the live database. Everything else is high or below.

| # | Finding | Severity |
|---|---|---|
| A1-01 | A coordinator can mint an owner account and take over the agency | **critical** |
| A1-02 | The waitlist rate limiter can be driven by anyone with the public anon key | **high** |
| A1-03 | Field-report photo files are never deleted by any code path | **high** |
| A1-04 | `REVOKE … FROM PUBLIC` in the migrations does not do what the migrations say it does | **medium** |
| A1-05 | "Read-only agency" is not read-only: eight write paths have no billing gate | **medium** |
| A1-06 | The billing gate fails open when the entitlement cannot be read | **medium** |
| A1-07 | No abuse controls on any anonymous promoter endpoint | **medium** |
| A1-08 | Promoter tokens cannot be revoked; an availability link lives 56 days | **low** |
| A1-09 | `lib/tokens.ts` is not `server-only` | **low** |
| A1-10 | Raw Postgres error text can reach the coordinator's screen | **low** |
| A1-11 | Stale `waitlist_rate_limit` rows are never swept | **low** |

---

## A1-01 — A coordinator can make themselves the owner and lock the real owner out

**Severity: critical.**

### What

Anyone who can sign in to an agency — including the most junior coordinator — can create a second
login with **owner** rights, and then deactivate the real owner. They do it by writing one row
directly to the database from the browser, using the public key the app already ships. Every
"owner only" screen in the product — billing, team, agency identity and retention settings,
"send to everyone" — is protected by a check this bypasses.

### Where

- `supabase/migrations/0006_auth.sql:218` — `grant select, insert, update, delete on %I to authenticated`,
  whose table list at line 205 includes `app_user_invites`.
- `supabase/migrations/0006_auth.sql:53-57` — the only policy on that table is
  `using (agency_id = current_agency_id()) with check (agency_id = current_agency_id())`.
  A coordinator's own agency id satisfies it, so the policy does not stop them.
- `supabase/migrations/0006_auth.sql:68-124` — `ensure_app_user()` reads that table and inserts
  `app_users` with **whatever `role` the invite row names**.
- `lib/auth.ts:110` — `authState()` calls `ensure_app_user()` on every sign-in that has no
  `app_users` row yet, so the path is live in production today.
- `supabase/migrations/0011_accounts.sql:710` revoked `insert, update, delete` on **`app_users`**
  (this is what P19 closed) but left `app_user_invites` exactly as 0006 granted it. There are two
  invitation tables; only one of them is guarded.

### Proof

Script run against the live project. It creates its own agency, its own owner, its own
coordinator and its own accomplice, and deletes all of them in a `finally` block.

```
$ node a1-escalation.mjs
agency 275a5e95-4431-4333-9cdc-9201d4879359
coordinator provisioned as: {"id":"46f0f123-…","role":"coordinator","agency_id":"275a5e95-…"}

ATTACK 1  invite_team_member(role=owner) as coordinator -> BLOCKED: not_owner
ATTACK 2  direct INSERT into app_user_invites(role=owner) -> ALLOWED: [{"id":"5c474108-…","role":"owner","agency_id":"275a5e95-…"}]
          accomplice app_users row AFTER first sign-in: {"id":"cfbb9031-…","email":"a1-accomplice-…","role":"owner","agency_id":"275a5e95-…","active":true}
          is_agency_owner() for the accomplice session -> true
          accomplice can read the agency billing row -> {"id":"275a5e95-…","plan":"starter","subscription_status":"trialing","stripe_customer_id":null}
ATTACK 3  UPDATE agencies.seat_limit as coordinator -> BLOCKED: permission denied for table agencies
ATTACK 4  UPDATE own app_user_invites row to role=owner -> ALLOWED: [{"email":"a1-coord-…","role":"owner"}]
ATTACK 5  INSERT into admin_audit_log as coordinator -> BLOCKED: new row violates row-level security policy for table "admin_audit_log"
```

Note ATTACK 1 next to ATTACK 2: the supported path refuses the coordinator by name, and the
unsupported one right beside it does not. That is the whole finding.

A second script then proved the takeover is complete:

```
$ node a1-takeover.mjs
accomplice role: owner
accomplice removes the REAL owner -> ALLOWED
real owner row now: {"email":"a1-real-owner-…","role":"owner","active":false}
accomplice reads agency/billing row: {"id":"9991d315-…","plan":"starter","subscription_status":"trialing","trial_ends_at":"2026-10-05T11:07:30Z","seat_limit":3}
```

The escalated account used the *legitimate* `remove_team_member` RPC — its "never remove the last
owner" invariant is satisfied, because there are now two owners.

The single HTTP request that does it, with nothing but the anon key and a coordinator's session
cookie:

```
POST /rest/v1/app_user_invites
{ "agency_id": "<their own agency>", "email": "attacker@gmail.com",
  "role": "owner", "full_name": "x" }
```

### Impact

A coordinator — or anyone who obtains a coordinator's session — gets, inside their own agency:
the Stripe billing portal (change plan, cancel the subscription), full team management including
removing the real owner, the agency's legal-controller identity and its GDPR retention window,
and the "send an availability link to every promoter" button. They also bypass the seat limit
entirely, which is a direct revenue leak on a per-seat-capped plan.

It survives dismissal: a coordinator who expects to be let go can plant an invite row for a
personal address today and still hold owner access after their own account is deactivated, because
the invite is claimed by a *different* auth user.

It is **not** cross-tenant — RLS still confines the write to the attacker's own agency, which is
why this is not a platform-wide breach. It is a complete breach of one tenant by one of its own
staff, which is exactly the trust an agency is buying when it gives a coordinator a login.

It leaves **no audit trail**: `admin_audit_log` is for platform admins, and the agency-side team
screen only lists `agency_invitations`, which this path never touches.

### Suggested fix

The table should not be writable by `authenticated` at all. `ensure_app_user()` is
`security definer` and reads past RLS, so nothing in the application needs the grant.

1. New migration `0018`:
   ```sql
   revoke insert, update, delete on app_user_invites from authenticated;
   -- select may stay: the team screen shows pending invitations.
   ```
   This is the exact shape `0011_accounts.sql:710` used for `app_users`, and the comment there
   already explains why ("PostgREST is a public endpoint, the browser holds the anon key").
2. Add the assertion to `scripts/verify-isolation.ts`'s `checkPrivilegeEscalation`, beside the two
   that are already there: an ordinary member inserting into `app_user_invites` must be rejected,
   re-verified with the service-role client afterwards. That script would have caught this.
3. While there: decide whether `app_user_invites` should still exist. There are now two invitation
   mechanisms (`app_user_invites` from 0006, `agency_invitations` from 0011) and only the newer one
   is owner-gated, token-based, expiring and single-use. Retiring the older one removes the class
   of bug rather than this instance of it. That is a larger change and should be its own parcel —
   the revoke above is the fix to ship now.

---

## A1-02 — The waitlist rate limiter is driveable by anyone with the public anon key

**Severity: high.**

### What

The counter that protects the public sign-up form can be written by any anonymous visitor, with
any key and any time window they choose. About two hundred requests switch the form off for
everybody for the rest of the hour, and it can be repeated hourly. The same call also creates an
unbounded number of database rows.

### Where

- `supabase/migrations/0010_waitlist_hardening.sql:62-63` — the migration believes it has locked
  the function down:
  ```sql
  revoke all on function increment_waitlist_rate_limit(text, timestamptz) from public;
  grant execute on function increment_waitlist_rate_limit(text, timestamptz) to service_role;
  ```
  Its own comment says "anon/authenticated are not granted execute". They are — see A1-04 for why.
- `lib/waitlist/rate-limit.ts:20` — `GLOBAL_LIMIT = 200`.
- `lib/waitlist/rate-limit.ts:94-107` — the circuit breaker sums `request_count` across **every**
  `ip_hash` in the current window and refuses the submission when the total exceeds 200.
- `app/actions.ts:57-60` — `joinWaitlist` returns `rate_limited` and writes nothing.

### Proof

```
$ node a1-waitlist.mjs
live waitlist_rate_limit rows: [{"ip_hash":"e89b796f…","window_start":"2026-09-10T15:00:00+00:00","request_count":1},
                                {"ip_hash":"164be0f4…","window_start":"2026-09-10T16:00:00+00:00","request_count":3}]
current window start the app would use: 2026-09-21T11:00:00.000Z
  anon call #1 -> HTTP 200 count=1
  anon call #2 -> HTTP 200 count=2
  anon call #3 -> HTTP 200 count=3
  anon call #4 -> HTTP 200 count=4
  anon call #5 -> HTTP 200 count=5
row written by the ANONYMOUS caller: [{"ip_hash":"a1-audit-probe","window_start":"2026-09-23T13:00:00+00:00","request_count":5}]
cleanup: probe rows deleted
```

The request carries nothing but `NEXT_PUBLIC_SUPABASE_ANON_KEY`, which is in the browser bundle of
the public landing page:

```
POST /rest/v1/rpc/increment_waitlist_rate_limit
apikey: <anon key>
{ "p_ip_hash": "anything", "p_window_start": "2026-09-23T13:00:00Z" }
```

I deliberately poisoned a window fifty hours in the future rather than the current one, so the real
form was never affected. **I did not run the two hundred calls that would trip the live breaker** —
the arithmetic is read off `lib/waitlist/rate-limit.ts:104-107` and the primitive above is proven.
Stated plainly so nobody mistakes the reasoning for an observation.

### Impact

An unauthenticated attacker can switch off the only lead-capture surface the business has, for
everyone, for as long as they care to keep sending requests, at a cost of a few hundred HTTP calls
an hour. Nothing surfaces it: the visitor sees "too many requests" and the owner sees no signups.

Secondarily, each distinct `p_ip_hash` creates a row, and the only cleanup runs inside a real
submission (`lib/waitlist/rate-limit.ts:65-69`) — which the attack itself suppresses. The table
grows without bound while the form is disabled.

### Suggested fix

1. Remove the grant that should never have been there, in the same migration as A1-04:
   ```sql
   revoke execute on function increment_waitlist_rate_limit(text, timestamptz) from anon, authenticated;
   ```
   Keep the `service_role` grant. That alone closes this.
2. Make the breaker harder to poison even if a grant returns: `p_window_start` should not be a
   parameter at all. Compute it inside the function from `now()` (`date_trunc('hour', now())`), so
   a caller cannot choose the bucket. This is a one-line change to the function body and a matching
   change at `lib/waitlist/rate-limit.ts:79`.
3. Consider a `delete from waitlist_rate_limit where window_start < now() - interval '2 hours'` in
   the daily cron (`app/api/cron/daily/route.ts`) so the sweep does not depend on traffic the
   attack is suppressing — that also fixes A1-11.

---

## A1-03 — Field-report photo files are never deleted, by any code path

**Severity: high.**

### What

Photographs a promoter uploads at the end of a shift are stored as files. Nothing in the product
can ever delete one. If a promoter exercises her right to erasure, her photographs stay. If anyone
deletes the report those photographs belong to, the database row pointing at them disappears and
the file stays behind, with nothing left in the system that even knows it exists.

### Where

- `lib/checkins.ts:440` — `db.storage.from(PHOTO_BUCKET).upload(path, file, …)` is the **only**
  storage call in the entire repository. There is no `.remove(`, anywhere:
  ```
  $ grep -rn "\.remove(\|storage.from" app lib scripts --include=*.ts --include=*.tsx
  lib/checkins.ts:440:  const { error: uploadErr } = await db.storage.from(PHOTO_BUCKET).upload(path, file, {
  ```
- `lib/retention.ts:145-150` — `report_photos` is `action: "keep"`, "Flagged for review, not deleted."
- `lib/erasure.ts:286-292` — erasure counts the photos into `residual` and writes
  `residual_notes: "Manual review needed: report_photos=N"` (`lib/erasure.ts:313-318`). That note is
  the entire mechanism. There is no screen that shows it, no tool that acts on it, and no way for a
  coordinator to delete a photo even after reading it.
- `supabase/migrations/0001_init.sql:308` — `report_photos` cascades from `field_reports`, which
  cascades from `assignments`, which cascades from `promoters`.
- `supabase/migrations/0006_auth.sql:218` grants `authenticated` `delete` on `field_reports` and
  `report_photos`.

The brief recorded this as "erasure deletes `report_photos` rows but never deletes the files".
**That is not what the code does** — the rows are kept too, by design. Correcting it matters,
because it changes the fix: the gap is not a missing `storage.remove` beside an existing row
delete; it is that neither half exists, and the "manual review" the plan promises has no hands.

### Proof

The bucket is correctly private and correctly closed to anonymous callers:

```
$ node a1-storage.mjs
buckets: [{"id":"field-report-photos","public":false,"allowed":null,"limit":null}]
  public object URL    HTTP 400 {"statusCode":"404","error":"Bucket not found"}
  authenticated path   HTTP 400 {"statusCode":"404","error":"not_found","message":"Object not found"}
  anon list()          -> []
  anon createSignedUrl -> Object not found
  anon upload()        -> new row violates row-level security policy
```

The orphaning was then reproduced, in an agency this audit created and deleted:

```
$ node a1-orphan.mjs
set up: field_report 5ef0217a-… + photo file 220ce993-…/7f6b82b3-…/1789988751941.jpg

coordinator DELETE field_reports -> ALLOWED: [{"id":"5ef0217a-…"}]
report_photos rows remaining (cascade) -> []
FILE still in the bucket -> ["1789988751941.jpg"]

cleanup: removed probe object -> ok
cleanup: agency + auth user deleted
```

The row is gone, the image is not, and the only record of where the image lives went with the row.

I also checked the live bucket for pre-existing orphans and found **none** — the two objects in it
both have matching `report_photos` rows:

```
objects actually in the bucket: 2
    6dbe1b41-…/336273f5-…/1789317961114.png 463511 bytes 2026-09-13T16:46:02Z
    6dbe1b41-…/dcacbfe0-…/1789317231830.png 463511 bytes 2026-09-13T16:33:54Z
report_photos rows: both paths present, field reports a48a17c3-… and 0120de14-…
```

(My first attempt at this comparison reported two orphans. It was wrong: the query behind it had
failed on a non-existent `created_at` column and I had compared against an empty set. Recorded
because it is the I6 pattern and the corrected result is the one that counts.)

### Impact

Two distinct problems, same root cause.

**The erasure one.** A photograph of a shelf can contain a customer, a store employee, or the
promoter herself. `docs/gdpr.md`'s own reasoning says so — which is why the plan flags them for a
human. But there is no supported way for that human to act: no admin tool, no coordinator control,
no script. An agency that receives an Article 17 request today cannot fully honour it using the
product. Under GDPR that is the controller's failure, and the controller is the customer the owner
is about to sign.

**The orphan one.** Once the row is gone the file is unreachable by any query, so it cannot be
found by an erasure sweep, an export, or a support request. It is personal data with no owner and
no expiry, sitting in the bucket indefinitely. Every promoter delete, every campaign cleanup and
every coordinator tidying up a report widens it.

### Suggested fix

The behaviour that matches how the codebase already reasons — `field_reports` is the agency's
business record, the *promoter's* personal data is not — is:

1. **Add the missing primitive.** A `deleteReportPhotos(db, storagePaths)` in `lib/erasure.ts`
   that calls `db.storage.from("field-report-photos").remove(paths)` and then deletes the
   `report_photos` rows, in that order — file first, so a crash leaves a row pointing at a missing
   file (recoverable, visible) rather than a file nothing points at (invisible, forever).
2. **Give `erasePromoter` a mode.** Keep `report_photos` as `keep` for the routine retention sweep
   — a business record with a caveat. Add an explicit `photos: "delete"` option that
   `scripts/retention-sweep.ts` exposes and that a future subject-request tool calls. Record the
   count in `promoter_erasures.deleted_counts` so the receipt says what happened.
3. **Give the flag hands.** The `residual_notes` string is where this should surface. The smallest
   honest version is a script (`scripts/erasure-photos.ts <promoterId>`) that lists the surviving
   objects with signed URLs so a human can look, and deletes the ones they name. A UI is a later
   parcel; the ability to comply is not.
4. **Close the orphan path** with a database trigger on `report_photos` delete that writes the
   storage path to a small `orphaned_objects` table the daily cron drains, so a cascade can never
   again lose the only pointer. Alternatively revoke `delete` on `field_reports` and
   `report_photos` from `authenticated` and route deletion through a function — but the trigger is
   the one that survives a future cascade nobody predicted.

`supabase/migrations/0009_checkin.sql:19-30`'s reasoning for having no storage policies is sound
and should not be changed. The gap is application-side.

---

## A1-04 — `REVOKE … FROM PUBLIC` does not do what the migrations say it does

**Severity: medium.** (Root cause of A1-02; worth its own entry because it affects thirty-one
functions, not one.)

### What

Throughout the migrations, a function is locked down by revoking it from `public` and granting it
to one role. That does not remove the grant Supabase gives `anon` and `authenticated` by default,
so the functions stay callable by anyone on the internet. Today every one of them is still safe,
because each checks the caller inside its own body — but the protection the migrations claim to
have is not there, and the comments say otherwise.

### Where

The pattern appears at `0006_auth.sql:129`, `0010_waitlist_hardening.sql:62`,
`0011_accounts.sql:734-739`, `0013_admin.sql:90, 103, 275, 330, 386, 420, 445, 473, 498, 523, 545,
602, 625, 670, 701` and `0015_agency_identity_write.sql:41`.

`0013_admin.sql:196` is the one place that gets it right:
`revoke all on function _admin_write_audit(…) from public, anon, authenticated;` — and it is the
one function that actually answers `permission denied`.

### Proof

Unauthenticated calls carrying only the anon key, with correct argument names:

```
$ node a1-rpc-probe.mjs
  grant_agency_access              HTTP 401  permission denied for function grant_agency_access
  _admin_write_audit               HTTP 401  permission denied for function _admin_write_audit
  increment_waitlist_rate_limit    HTTP 200  1                      <-- granted to service_role only
  admin_suspend_agency             HTTP 400  "agency_not_found"     <-- body executed
  admin_change_plan                HTTP 400  "agency_not_found"
  admin_extend_trial               HTTP 400  "agency_not_found"
  admin_mark_deletion_request      HTTP 400  "agency_not_found"
  admin_view_agency_activity       HTTP 400  "agency_not_found"
  admin_agency_summary             HTTP 400  "not_platform_admin"
  create_agency_for_user           HTTP 400  "not_authenticated"
  invite_team_member               HTTP 400  "not_authenticated"
  set_team_member_role             HTTP 400  "not_authenticated"
  accept_agency_invitation         HTTP 400  "not_authenticated"
  ensure_app_user                  HTTP 200  null
```

Two functions answer `permission denied` (those revoked from the roles by name); the rest execute.

**The guards hold.** Against a *real* agency id the mutating admin functions refuse, and the row is
untouched — verified against a throwaway agency this audit created and deleted:

```
$ node a1-admin-oracle.mjs
throwaway agency 771ef1d0-…  {"suspended_at":null,"plan":"starter","deletion_requested_at":null}
--- ANONYMOUS calls against a REAL agency id ---
  admin_suspend_agency           HTTP 400  "not_platform_admin"
  admin_change_plan              HTTP 400  "not_platform_admin"
  admin_extend_trial             HTTP 400  "not_platform_admin"
  admin_mark_deletion_request    HTTP 400  "not_platform_admin"
  admin_view_agency_activity     HTTP 400  "not_platform_admin"
  admin_agency_summary           HTTP 400  "not_platform_admin"
agency row AFTER the anonymous attempts: {"suspended_at":null,"plan":"starter","deletion_requested_at":null,"trial_ends_at":null}
throwaway agency deleted: ok
```

The refusal comes from `_admin_write_audit` (`0013_admin.sql:175-177`), which the mutating
functions `perform` before their `update`. That is real defence and it worked.

### Impact

Two things, neither of them a breach today.

**The information leak is real but small.** Compare the two runs: a fake agency id answers
`agency_not_found`, a real one answers `not_platform_admin`. An anonymous caller therefore has an
oracle for "is this UUID a real agency". Because the ids are v4 UUIDs, nobody is going to guess
one; the leak matters if an id reaches an attacker some other way (a screenshot, a support ticket,
a URL). The cause is the existence check running before the admin check, at
`0013_admin.sql:346-348, 400-402, 429-431, 454-456, 481-483, 506-508, 531-533`.

**The structural risk is the bigger one.** Six mutating admin functions have exactly one thing
between an anonymous internet caller and an `update agencies`: one `perform _admin_write_audit(…)`
line. Any future admin function written in the same house style that forgets that line — or moves
it below its `update` — is an unauthenticated write to any customer's row. The migration comments
currently tell the next author that `revoke … from public` already handled it. It did not.

### Suggested fix

One new migration, `0018`:

1. Revoke by name everywhere the intent was "not the browser":
   ```sql
   revoke execute on function increment_waitlist_rate_limit(text, timestamptz) from anon, authenticated;
   revoke execute on function grant_agency_access(text, text, text, user_role) from anon, authenticated;
   revoke execute on function admin_extend_trial(uuid, integer, text) from anon;
   -- …and the same `from anon` for every other admin_* function; they are called by a signed-in
   -- platform admin, so `authenticated` must keep its grant.
   ```
   Keep `agency_invitation_preview(text)` granted to `anon` — `0011_accounts.sql:731` grants it
   deliberately, and it is the one function that legitimately needs it (the join page renders
   before sign-in). It answered `[]` to a made-up hash, which is correct.
2. Put `if not is_platform_admin() then raise exception 'not_platform_admin'; end if;` as the
   **first** statement of every `admin_*` function, above the existence check — the shape
   `admin_agency_summary` (`0013_admin.sql:305-307`) already uses. This removes the oracle and
   stops the guard depending on a `perform` further down.
3. Write down the rule where the next author will read it: `REVOKE … FROM PUBLIC` does not remove
   Supabase's default `anon`/`authenticated` grants. Revoke from the roles by name. A line in
   `docs/decisions.md` and a comment at the top of the next migration.

---

## A1-05 — "Read-only agency" is not read-only: eight write paths have no billing gate

**Severity: medium.**

### What

`docs/commercial-architecture.md` §3 promises that a cancelled subscription drops the agency to
read-only. Several screens still write.

### Where

Every action below reaches a write with no `checkBilling()` anywhere in its call chain:

| File | Action | Writes |
|---|---|---|
| `app/promoters/actions.ts:327` | `updatePromoter` | `promoters`, `promoter_areas`, `promoter_skills` |
| `app/promoters/actions.ts:408` | `archivePromoter` | `promoters.status` |
| `app/shifts/[id]/actions.ts:73` | `cancelAssignment` | `assignments` |
| `app/shifts/[id]/actions.ts:120` | `markNoShow` | `assignments` |
| `app/shifts/[id]/actions.ts:168` | `mintCheckinLink` | mints a live credential |
| `app/settings/messaging/actions.ts:21` | `saveAutoAvailabilityLinks` | `agencies.auto_availability_links` |
| `app/settings/messaging/actions.ts:60` | `sendAvailabilityLinksNow` | emails the whole roster |
| `app/settings/agency/actions.ts:23` | `saveAgencyIdentity` | `agencies` identity + retention |

```
$ for f in app/promoters/actions.ts "app/shifts/[id]/actions.ts" \
           app/settings/messaging/actions.ts app/settings/agency/actions.ts \
           "app/promoters/[id]/availability/actions.ts"; do
    echo "$f : checkBilling occurrences = $(grep -c checkBilling "$f")"; done
app/promoters/actions.ts : checkBilling occurrences = 3     <- createPromoter only
app/shifts/[id]/actions.ts : checkBilling occurrences = 0
app/settings/messaging/actions.ts : checkBilling occurrences = 0
app/settings/agency/actions.ts : checkBilling occurrences = 0
app/promoters/[id]/availability/actions.ts : checkBilling occurrences = 0
```

(`app/promoters/[id]/availability/actions.ts` is a false positive — it delegates to
`./data.ts:106-108`, which does gate. The other four do not delegate.)

`lib/billing/subscription.ts:372-388` is what they are skipping: for a `canceled` agency
`entitlement.access` is `read_only` and `checkBilling(e, "write")` returns
`{ allowed: false, block: "subscription_read_only" }`.

**Honest limit on this proof.** I established the missing call sites by reading and grepping, and
the gate's semantics from `lib/billing/subscription.ts`. I did **not** drive a cancelled agency
through the browser and press these buttons — `lib/billing/subscription.ts` is `server-only`, so it
cannot be exercised from a script, and standing up a cancelled tenant in the UI was more risk than
the finding warranted. The absence of a call site is conclusive for "there is no gate"; treat
"and therefore the write succeeds" as read off the code, not observed.

### Impact

A cancelled agency — one that has stopped paying — can still edit its roster, archive promoters,
cancel and no-show assignments, mint fresh promoter credentials, and email its entire roster. The
commercial promise in §3 is that they keep read and export and lose write; in practice they lose
only campaign, shift, brief, invitation and promoter *creation*. It is a revenue and contract
problem rather than a data-protection one, but it is a promise the product currently does not keep.

`mintCheckinLink` is the one with a security edge: it issues a signed credential, and a
subscription that has ended should not be able to mint new ones.

### Suggested fix

Add the established four-line pattern to each. From `app/campaigns/[id]/brief/actions.ts:27-31`:

```ts
const entitlement = await getEntitlement(user.agencyId);
if (entitlement && !checkBilling(entitlement, "write").allowed) {
  return { status: "error", reason: t("enforcement.…blocked_read_only") };
}
```

Two judgement calls for whoever implements it, both already reasoned about in
`docs/status/P27.md`'s gate table:

- `cancelAssignment` and `markNoShow` *release* capacity rather than consume it. P27's rule was not
  to block those (it exempted `revokeInvitation` and `removeMember` for exactly this reason), and
  leaving a cancelled agency unable to record that a promoter did not turn up would be worse than
  letting them. My recommendation: leave these two ungated and write the reason into the file, so
  the next audit reads a decision instead of a gap.
- `saveAgencyIdentity` sets the GDPR retention window. Blocking it could strand an agency that must
  shorten its own retention. Leave ungated, with a comment.

That leaves five to gate: `updatePromoter`, `archivePromoter`, `mintCheckinLink`,
`saveAutoAvailabilityLinks`, `sendAvailabilityLinksNow`.

---

## A1-06 — The billing gate fails open when the entitlement cannot be read

**Severity: medium.**

### What

Every billing check is written as "if we could read the subscription *and* it says no, refuse".
If the subscription cannot be read for any reason, the write goes through.

### Where

The idiom, repeated at `lib/invitations.ts:62`, `app/campaigns/new/actions.ts:74`,
`app/campaigns/[id]/actions.ts:40`, `app/campaigns/[id]/brief/actions.ts:29`,
`app/campaigns/[id]/shifts/new/actions.ts:106`, `app/promoters/[id]/invite/actions.ts:36`,
`app/shifts/sections/actions.ts:22, 62, 102`:

```ts
const entitlement = await getEntitlement(user.agencyId);
if (entitlement && !checkBilling(entitlement, "write").allowed) { … }
```

`lib/billing/subscription.ts:275-291` returns `null` whenever the `agencies` row does not come
back — a transient failure, an RLS miss, or a caller whose agency id is not their own.

`lib/invitations.ts:61` is the sharpest case. It runs on the **service-role** path but reads the
entitlement through the RLS-scoped client (`getEntitlement` → `createServerSupabase()`). Any future
caller of `createInvitation` outside a signed-in coordinator's request — a cron job, an `after()`
continuation, a queue worker — gets `null` and silently skips the gate. The comment at
`lib/invitations.ts:56-60` promises the opposite: "Any future caller of `createInvitation` inherits
the same guard for free."

### Proof

Read from the code; no runtime reproduction. `getEntitlement` is `server-only` and returning `null`
from it on demand means forcing an infrastructure failure against production, which is not a thing
I was willing to do. The control-flow claim is plain from the two files cited and needs no
instrumentation, but it is a code reading and is labelled as one.

### Impact

Low likelihood, and it is the *right* posture for suspension (`lib/auth.ts:55-59` argues fail-open
explicitly, so a dropped connection never locks a coordinator out mid-campaign). It is the wrong
posture for the *limits*: a failed read lets an agency past its seat and promoter caps.

The real cost is the comment in `lib/invitations.ts`, which tells the next author that a guard is
inherited when it is not. That is how a gap gets designed around.

### Suggested fix

1. Make `getEntitlement` distinguish "not found" from "could not read". Return a discriminated
   result rather than `null`, and let callers refuse on "could not read" for the limit actions
   while continuing to allow on `read`.
2. Give `lib/invitations.ts` an entitlement read that works on the path it actually runs on — an
   admin-client variant scoped by the `shift.agency_id` it has already fetched. Then correct the
   comment at line 56-60 to describe what the code does.
3. Smallest version, if the above is too large for now: change the comment. A guard that is
   documented as stronger than it is, is worse than one documented honestly.

---

## A1-07 — No abuse controls on any anonymous promoter endpoint

**Severity: medium.**

### What

Everything a promoter can do without logging in can be done as fast as the attacker likes. Nothing
counts attempts, nothing slows down, nothing alerts.

### Where

- `app/i/[token]/actions.ts:23` `respond`, `:45` `acknowledgeBrief`
- `app/c/[token]/actions.ts:18` `checkinWithGeo`, `:28` `checkinWithOverride`
- `app/c/[token]/report/actions.ts:66` `submitReport`
- `app/a/[token]/actions.ts:17` `saveDay`

`checkWaitlistRateLimit` (`lib/waitlist/rate-limit.ts`) is the only rate limiter in the codebase
and it is wired to exactly one caller, `app/actions.ts:57`.

`lib/checkins.ts:417-454` — `attachReportPhoto` caps each file at 8 MB and checks the MIME type,
but `app/c/[token]/report/actions.ts:118` loops over `formData.getAll("photos")` with **no cap on
the count**. The practical ceiling is `next.config.ts:15`'s `bodySizeLimit: "4mb"`, which does
contain it — but by accident of transport, not by a rule in this file.

### Proof

Absence of a mechanism, established by grep:

```
$ grep -rn "rateLimit\|rate_limit\|throttle" app lib --include=*.ts | grep -v waitlist
(no matches)
```

No runtime flooding was attempted against production.

### Impact

**What one valid promoter link buys an attacker.** Holding one invitation token, they can: read
that promoter's name, the campaign, the store, the date, the dress code and the pay rate
(`lib/invitations.ts:176-189`); accept or decline the shift in her name
(`lib/invitations.ts:199`); and — because `createCheckinLinkForInvitation`
(`lib/checkins.ts:164`) derives a check-in credential from an accepted invitation — then check in
as her and file the field report the client will be billed on. That chain is by design and is the
right design for a product with no promoter logins, but it means one forwarded WhatsApp message is
one promoter's whole shift.

What it does **not** buy: any other promoter, any other shift, any agency data, any contact
detail. `app/a/[token]/data.ts:20-40` is exemplary here — the column list is deliberate and the
comment explains every omission. The blast radius is genuinely one record.

The missing rate limits mean brute force against the token space is unthrottled. HMAC-SHA256 makes
that hopeless, so this is not how anyone gets in; the practical exposure is a promoter link
becoming a free write endpoint for junk field reports and photo uploads into the agency's storage.

### Suggested fix

1. Reuse the mechanism that exists. `lib/waitlist/rate-limit.ts` is already database-backed,
   atomic and hashes the IP — generalise it to `checkRateLimit(bucket, key, limit, windowMs)` and
   call it at the top of the six actions above, keyed on the token hash rather than the IP so one
   leaked link cannot be used as a firehose. Fix A1-02 first, or the generalised version inherits
   the hole.
2. Cap the photo count in `app/c/[token]/report/actions.ts` explicitly — `slice(0, 6)` with a
   message — so the limit is a product rule and not a side effect of `bodySizeLimit`.

---

## A1-08 — Promoter tokens cannot be revoked; an availability link lives 56 days

**Severity: low** — the design is documented and deliberate; recorded so it is a decision the owner
has seen rather than a surprise.

### Where

- `lib/availability-links.ts:8-27` — 56-day TTL, no stored hash, so no revocation. The file says so
  itself: "an availability link cannot be revoked early, only out-waited".
- `lib/checkins.ts:73-88` — `createCheckinLink` writes nothing, so a check-in token is stateless
  and cannot be revoked either. `lib/checkins.ts:155-163` re-mints one on every view of
  `/i/[token]`, each with a fresh expiry.
- `lib/tokens.ts:35-51` — `mintToken` has no nonce. Two tokens minted for the same record in the
  same second are byte-identical. Harmless without the signing secret, but it means a token is a
  pure function of `(purpose, id, expiry)` and there is no per-issue entropy.
- Contrast `lib/invitations.ts:157` and `:219`, which **do** re-check the stored `token_hash`.
  Invitations are revocable; check-in and availability links are not.

### Proof

`app/a/[token]/data.ts:73-77` gives the one escape hatch, and it works: an `archived` or
`blocklisted` promoter's link stops resolving. Since `lib/retention.ts:73` sets
`status -> 'archived'` on erasure, an erased promoter's availability link dies with her record.
Verified by reading both files; the status gate is unambiguous.

The check-in path has no equivalent. `lib/checkins.ts:205-224` checks only
`assignments.status === "cancelled"`, never the promoter's status or `anonymised_at`.

### Impact

A forwarded availability link works for up to eight weeks in a stranger's hands, showing that
promoter's name and her whole fortnight, and letting them rewrite it. The only remedy is to archive
the promoter, which is a heavier act than revoking a link.

After erasure, a surviving check-in token still resolves. No personal data leaks — `full_name` is
already `[erased]` by then (`lib/retention.ts:64`) — but a third party could still file a field
report against the tombstone.

### Suggested fix

None urgent. When `lib/tokens.ts` is next owned:

1. Add `"availability"` and `"checkin"` as first-class `TokenPurpose` values, retiring the
   `availability:<uuid>` prefix hack that `lib/availability-links.ts:32-43` documents.
2. Add a `promoter_link_tokens` table holding `(token_hash, purpose, record_id, revoked_at)` so
   the "re-issue and kill the old one" button the coordinator already expects actually kills it.
3. Check `promoters.anonymised_at` in `lib/checkins.ts:205` alongside the cancelled check.

---

## A1-09 — `lib/tokens.ts` is not `server-only`

**Severity: low.**

**Where.** `lib/tokens.ts` has no `import "server-only"`, yet it reads `TOKEN_SIGNING_SECRET`
(`lib/tokens.ts:26`). `lib/availability-links.ts` imports it and is *deliberately* not
`server-only` (its header explains why), so the chain is importable from a client component.

**Proof.** No client component imports it today:

```
$ grep -rln "@/lib/tokens" app lib components scripts
app/onboarding/join/[token]/actions.ts
app/onboarding/join/[token]/page.tsx
app/settings/team/actions.ts
lib/availability-links.ts
lib/briefs.ts
lib/checkins.ts
lib/invitations.ts
```

And the secret is not in any built client bundle:

```
$ node scan-bundles.js
client-bundle files scanned: 1372
no service-role key or token signing secret found in any .next*/static bundle
```

**Impact.** Next.js only inlines `NEXT_PUBLIC_*` into the browser, so an accidental client import
would **not** leak the secret — it would produce a token-minting function that throws at runtime on
a promoter-facing page. The cost is a missing guardrail: `server-only` would turn that mistake into
a build failure instead of a page that throws, which is precisely the class of bug I7 is about.

**Suggested fix.** Add `import "server-only";` to `lib/tokens.ts`, and split the two pure
helpers `lib/availability-links.ts` needs (`linkFor`, `acceptedInvitationStillReadable`) into a
sibling if the import graph then breaks. Same shape as `lib/team-shared.ts`.

---

## A1-10 — Raw Postgres error text can reach the coordinator's screen

**Severity: low.**

**Where.** `app/shifts/[id]/actions.ts:60` returns `err.message` straight to the client.
`lib/invitations.ts:92` throws `insertErr?.message` — a raw PostgREST/Postgres string, which can
name a column, a constraint or a policy.

**Proof.** Read from the two lines. Not triggered against production, because forcing an insert
failure means writing a bad row to a live table.

**Impact.** The reader is always a signed-in coordinator of the owning agency, so this discloses
nothing cross-tenant. It leaks schema detail to an authenticated attacker and it violates
`docs/commercial-architecture.md` §6's "never 'Something went wrong'" in the opposite direction —
a Postgres constraint name is not a message that says what to do next.

**Suggested fix.** Map the reason to a `t()` key, as `app/promoters/actions.ts` does, and log the
raw message server-side with `console.error("…", { code })` — the discipline the rest of the
codebase already keeps (see "what I checked and found clean").

---

## A1-11 — Stale `waitlist_rate_limit` rows are never swept

**Severity: low.**

**Where.** `lib/waitlist/rate-limit.ts:62-72` deletes rows older than two windows — but only from
inside a live submission. No form traffic, no cleanup.

**Proof.** The live table, read with the service role on 2026-09-21:

```
live waitlist_rate_limit rows: [{"ip_hash":"e89b796f…","window_start":"2026-09-10T15:00:00+00:00","request_count":1},
                                {"ip_hash":"164be0f4…","window_start":"2026-09-10T16:00:00+00:00","request_count":3}]
```

Eleven days old, two windows that closed on the 10th, still present.

**Impact.** Trivial at this size. It matters because it is the same table A1-02 can inflate, and
the cleanup that would bound it is suppressed by the attack that fills it.

**Suggested fix.** One line in `app/api/cron/daily/route.ts`, in the section that already runs
unconditionally:
`delete from waitlist_rate_limit where window_start < now() - interval '2 hours'`.

---

# What I checked and found clean

Each of these was actually exercised or read end to end, not assumed.

**Tenant isolation.** `scripts/verify-isolation.ts` run against the live database: **30/30
assertions passed**, covering `promoters`, `campaigns`, `shifts`, `invitations`, `assignments`,
`check_ins`, `field_reports` in both directions, plus both privilege escalations it was written
for. Beyond it, I probed all **35** tables PostgREST exposes with the anonymous key: 31 returned
zero rows, 4 (`admin_audit_log`, `billing_events`, `message_dispatches`, `platform_admins`)
returned `42501 permission denied`. Not one row leaked. A direct cross-tenant insert was rejected
by Postgres, not by application code.

**RLS coverage of every table.** All 35 exposed tables have `enable row level security` **and**
`force row level security` in the migrations, verified by reading `0002`, `0003:20`, `0004:18`,
`0006:49`, `0010:29`, `0011:161`, `0012:133`, `0013:69,137`, `0014:109`, `0016:50`, `0017:77`.
No policy anywhere is `using (true)`. Join tables without an `agency_id` (`promoter_areas`,
`promoter_skills`, `promoter_client_history`, `brief_ack`, `campaign_skills`) correctly inherit via
`exists (…)` against their parent.

**The admin console.** `/admin` is guarded at the layout (`app/admin/layout.tsx:24`) and every one
of the seven server actions re-derives membership with `requirePlatformAdmin()`
(`app/admin/agencies/[id]/actions.ts`, seven call sites). `platform_admins` grants `authenticated`
nothing (`0013_admin.sql:74`) and membership goes through a `security definer` function. A
non-admin gets 404, not 403 — the console's existence is not disclosed. `admin_audit_log` has
`update, delete` revoked from **`service_role` as well** (`0013_admin.sql:152`), which is genuinely
append-only rather than append-only-by-convention. A coordinator's attempt to forge an audit row
was rejected by RLS (ATTACK 5 above). Every mutating function writes the audit row *before* it
acts, and `_admin_write_audit` is the only function in the schema correctly revoked from `anon` and
`authenticated` by name.

**The cron route.** `lib/dispatch/cron-auth.ts` hashes both sides to 32 bytes before
`timingSafeEqual`, so no length leak and no throw. With `CRON_SECRET` unset every request is
refused. The response is counts only — no names, no addresses, no ids.

**The Stripe webhook.** Raw body read before parse, signature verified before anything else,
event recorded under a unique index before it is applied, 200 returned after recording even on
handler failure, duplicate delivery short-circuits. No payload is ever logged. Subscription state
is written only here — `0012_billing.sql:158` revokes `insert, update, delete` on `agencies` from
`authenticated`, and a coordinator's attempt to raise `seat_limit` was rejected with
`permission denied for table agencies` (ATTACK 3 above).

**The storage bucket.** `field-report-photos` is private (`public: false`). Anonymous callers
cannot read by path, list, sign a URL, or upload — all four refused, transcript in A1-03. The
coordinator's gallery signs URLs through the service role only after RLS has already returned the
rows, and re-checks the `<agency_id>/` path prefix before signing
(`app/campaigns/[id]/report/data.ts:349-356`) — a second, independent tenancy assertion. The
reasoning in `0009_checkin.sql:19-30` for having no storage policies is correct and should stand.

**Secrets.** `SUPABASE_SERVICE_ROLE_KEY` and `TOKEN_SIGNING_SECRET` appear in no client bundle —
1,372 files across every `.next*/static` tree scanned, zero hits. No client component reads
`process.env` at all. `NEXT_PUBLIC_*` is used only for the app URL, the Supabase URL and anon key,
and the two privacy-page strings, all of which are correctly public. `app/privacy/page.tsx:13`
throws when the legal entity is unset, so a privacy policy cannot be published without one.

**Logging.** All twenty `console.*` calls on server paths log a code, a status or an event id —
never a payload, an address, a name or a token. `app/actions.ts:83` logs `error.code` and not the
signup. The Stripe handler's file comment states the rule and the code keeps it.

**Geolocation (CLAUDE.md §3).** `lib/checkins.ts:324-333` computes the distance in a stack frame
and writes only `distance_from_store_m` and `within_geofence`. `check_ins` has no lat/lng columns.
No `watchPosition` anywhere in the repo. The manual override is always available and a geo
submission outside the fence is recorded, never refused.

**Erasure coverage (apart from A1-03).** `lib/retention.ts`'s `ERASURE_PLAN` names all fourteen
tables that can hold something about a promoter and justifies each decision. `erasePromoter` orders
its writes so a crash mid-run is recoverable, is idempotent via `anonymised_at`, and writes a
receipt to `promoter_erasures`. The `NOT_HELD` disclosure in `lib/erasure.ts:56-62` is exactly the
right instinct. `0017_message_dispatches.sql` was correctly added to the delete list.

**Consent (CLAUDE.md §2).** No consent-checkbox gate anywhere in the promoter flow. Grepped; there
is none. The legal basis is not being sourced from consent.

**Open redirects.** `app/login/actions.ts:21-24` and `app/login/callback/route.ts:6-9` both reject
anything not starting with a single `/`. `lib/supabase/middleware.ts:66` writes a relative path
only. All three checked by reading; the rule is the same in each.

**Cross-tenant ids from URLs.** Every admin-client call site was traced to its caller.
`app/shifts/[id]/actions.ts:45-50` re-checks both ids through the RLS client before
`createInvitation` touches the service role — the comment there names the exact risk and the code
matches it. `lib/checkins.ts:164` derives the assignment from the signed token, never from a URL
id. `app/a/[token]/data.ts:64` guards the record id against a UUID regex before the query, so a
namespaced availability id cannot reach Postgres as a cast error. I found no path where a URL id
reaches the admin client unverified.

**Owner-only actions.** Billing, team, messaging and agency identity all re-derive the owner from
the database inside each action (`ownerContext()` / `agencyIdentityOwnerContext()`), never from a
prop or a hidden field, and the `security definer` functions repeat the check. Correct — with the
caveat that A1-01 makes owner-hood something a coordinator can grant themselves, so these gates are
only as strong as that fix.

**Team invitation tokens (`agency_invitations`).** Owner-gated, hashed, expiring, single-use,
re-checked in Postgres, and the accept path carries only the token — no agency id crosses the wire.
This is the mechanism `app_user_invites` should be replaced by.

---

# What I could not test, and why

1. **`pg_catalog` directly.** The brief asks for SQL against the Supabase Management API to confirm
   `relrowsecurity` **and** `relforcerowsecurity` on every table, enumerate `pg_policies`, and read
   `pg_proc.proacl` / `information_schema.role_table_grants`. **No management token was made
   available to me** — the helper script exists and expects `SBT=<token>`, and the token value was
   never provided. I substituted black-box probes (all 35 tables and all 31 RPCs, anonymously and
   as a coordinator) plus a full read of the migrations. That is strong evidence and it found two
   grants that should not exist — but it cannot enumerate drift the way a catalog read can, and
   A1-04 proves that at least one intended REVOKE never took effect, which is exactly the class of
   drift a catalog read would list exhaustively. **Ask the owner for the token and re-run item 7.**
2. **The read-only-agency writes in A1-05 through the UI.** Established by grep, not by pressing
   the buttons as a cancelled tenant. See the honest-limit note in that finding.
3. **The waitlist denial of service to completion.** The write primitive is proven; the 200-request
   flood that would actually disable the live form was not run.
4. **Sign-in brute force.** `app/login/actions.ts:82` accepts a six-digit OTP with no application-
   level lockout; the only limiter is Supabase Auth's own, which I did not exercise because doing
   so means hammering the live auth service and risks tripping a project-wide limit for the owner.
   Worth confirming the Auth rate-limit settings in the Supabase dashboard before launch.
5. **Anything requiring a dev server.** I did not stand one up. This parcel is a read of code and a
   probe of the database; the screens themselves were audited as source. If a finding here needs to
   be seen in a browser before it is believed, say so and I will open it.
6. **Stripe end to end.** No Stripe keys are configured in this environment, so the webhook's
   signature check was audited by reading `lib/billing/webhook.ts`, not by sending a forged event.
7. **Email delivery paths.** Deliberately untouched — `RESEND_API_KEY` is live and the brief
   forbids triggering a send. `lib/messaging/email.ts` and `lib/dispatch/run.ts` were read; tenant
   scoping in the dispatcher is by construction (`agency_id` always comes from the promoter row,
   never from a caller) and suspended agencies are excluded at `lib/dispatch/run.ts:55`.

---

# Recommended order

1. **A1-01** before anything else, and before a paying customer has staff logins. It is one
   `revoke` statement plus one assertion in `verify-isolation.ts`.
2. **A1-02** and **A1-04** together — same migration, same root cause, and A1-02 is live on the
   public internet right now.
3. **A1-03** before the first real promoter uploads a photograph. The primitive is small; the
   policy decision around it is the part that needs the owner's sign-off.
4. **A1-05** and **A1-07** before launch. **A1-06**, **A1-09**, **A1-10**, **A1-11** in a quiet
   moment. **A1-08** when `lib/tokens.ts` is next owned.

---

## Verification after migration 0018 (2026-09-22)

Re-run of the original attacks against the patched production database, with the **public anon key**,
from a throwaway agency that the probe creates and deletes (`scratchpad/verify-0018.mjs`).

| Attack | Before | After |
| --- | --- | --- |
| A1-01 — coordinator INSERTs an `owner` invite | created an owner | **HTTP 403 `42501`** |
| A1-01b — coordinator PATCHes their own invite to `owner` | succeeded | **HTTP 403 `42501`** |
| A1-02 — anonymous drives `increment_waitlist_rate_limit` | executed | **HTTP 401 `42501`** |
| A1-04 — anonymous calls `admin_suspend_agency` | reached the body | **HTTP 401 `42501`** |

The denial is `permission denied for table/function` — a **grant-level** refusal, which happens before
RLS and therefore does not depend on the attacker's role being read correctly.

The paths the product needs were re-checked in the same run and still work: an anonymous visitor can
open a staff invitation link (200), a signed-in user is provisioned (`ensure_app_user` → 200, and the
seeded coordinator really comes back as `role: coordinator`), and an owner can still invite staff
(200; a later run returns `seat_limit_reached`, which is the trial's own seat rule, not a grant).

**Two lessons, both already paid for once in this repo.** The first run of this probe reported four
neat "BLOCKED" lines while holding *no session at all* (`Expected 3 parts in JWT; got 1`) — a negative
path that short-circuits proves nothing. The second run reported "BROKEN — an owner can no longer
invite staff" purely because the probe guessed the RPC argument names: `create_agency_for_user` takes
`(p_name, p_city, p_timezone, p_full_name)` and `invite_team_member` takes `p_invitation_id`, not
`p_agency_id`; a wrong name is PGRST202, which is an HTTP **404** and reads exactly like a revoked
grant. Argument names now come from `pg_proc`, the same way the migration itself does.
