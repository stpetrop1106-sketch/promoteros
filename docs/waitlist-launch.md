# Waitlist launch checklist

Everything that must be true before this link is posted to an email list or an industry
community — i.e. before a stranger opens it. Written for parcel P21; read `docs/keys-needed.md`
and `docs/decisions.md` D5 alongside this.

---

## 1. Blocking — must be true before the link is public

### 1.1 Real legal entity on the privacy page

`app/privacy/page.tsx` reads `NEXT_PUBLIC_LEGAL_ENTITY_NAME` and `NEXT_PUBLIC_PRIVACY_EMAIL` and
**deliberately throws** if either is unset. That guard is correct and must not be relaxed — but
today `.env` only has placeholders:

```
NEXT_PUBLIC_LEGAL_ENTITY_NAME=PromoterOS (dev)
NEXT_PUBLIC_PRIVACY_EMAIL=privacy@example.invalid
```

The privacy page names a **data controller**. Publishing it with a placeholder entity and an
`.invalid` email address is not a smaller version of compliance — it is a page that falsely
claims to identify who is responsible for the data. **This is the single item that blocks
posting the link anywhere public.** Set both to real values in the production environment
(Vercel project settings, not `.env`) before deploying.

### 1.2 Migration 0010 must be applied

`supabase/migrations/0010_waitlist_hardening.sql` adds the `waitlist_rate_limit` table and the
`increment_waitlist_rate_limit` function that `lib/waitlist/rate-limit.ts` calls. **This agent
cannot run DDL against the live database — the manager must run this file in the Supabase SQL
editor before the form is used publicly.** Until it is applied, every waitlist submission will
fail at the rate-limit check with a Postgres "function does not exist" error surfaced as
`waitlist.status.error`, which fails closed (no signup is silently lost, but none succeed either).

### 1.3 Deployment

- A real domain with HTTPS (see `docs/keys-needed.md` §3 — Vercel + a domain). Magic-link email
  sender identity and phone geolocation elsewhere in the product both depend on this too, so it
  is shared infrastructure, not waitlist-specific.
- Vercel region **Frankfurt (fra1)**, matching the Supabase project, so registrant data stays in
  the EU.
- `TOKEN_SIGNING_SECRET` must be set in the deployed environment — the rate limiter hashes IPs
  with it (`lib/waitlist/rate-limit.ts`). It is already in `.env` for local use; carry the same
  value (or rotate to a new one, consistently) into Vercel's environment variables.

---

## 2. The GDPR position

- **Legal basis is contract-necessity / pre-contractual steps plus legitimate interest — never a
  consent checkbox.** See `docs/decisions.md` D5: the Greek DPA has fined a company €150,000 for
  treating consent as freely given where a power imbalance exists, and the same reasoning applies
  to a lead-capture form pitched at a professional evaluating a business tool — consent is not the
  posture we want as the default legal basis for any data collection in this product. The privacy
  page (`app/privacy/page.tsx`, keys `privacy.basis_*`) already states this correctly; do not add
  a consent checkbox to `WaitlistForm` to "be safe" — it would contradict the stated basis.
- **Retention is 12 months** from registration (`privacy.retention_body`, both locales), unless a
  commercial relationship starts first or the registrant asks for earlier deletion. There is no
  automated enforcement of the 12-month cutoff yet — nothing purges old rows on a schedule. That
  is acceptable for a pre-launch waitlist at today's likely volume, but track it as the same class
  of item as `G2` in `docs/build-plan.md` §11.2 (retention enforced by a scheduled job) if the
  waitlist runs for a year.
- **The erasure path, today:** there is no self-service deletion or admin UI for the waitlist (out
  of scope for this parcel — see §4 below). If someone asks to be removed, honour it by running,
  in the Supabase SQL editor, against the live project:

  ```sql
  delete from waitlist_signups where email_normalized = lower(trim('their@email.com'));
  ```

  This is a real, working erasure path — it is manual, not absent. If waitlist volume grows
  enough that manual deletion becomes routine, that is when a self-service or admin path earns
  its build cost, not before.

---

## 3. How to check signups

There is no dashboard. Two ways to look, both using the service role, both from your own
machine only:

1. **Supabase SQL editor** — for a one-off look or a specific query:
   ```sql
   select full_name, work_email, company_name, promoter_count, created_at
   from waitlist_signups
   order by created_at desc;
   ```
2. **`scripts/waitlist-export.ts`** — for a readable summary plus a CSV you can open in a
   spreadsheet:
   ```
   npx tsx --env-file=.env scripts/waitlist-export.ts
   ```
   Prints the total count, signups per day, a breakdown by `promoter_count`, and a breakdown by
   `utm_source`, then writes every row to `waitlist-export.csv` in the project root. Pass a
   different path as the first argument to write elsewhere:
   ```
   npx tsx --env-file=.env scripts/waitlist-export.ts ~/Desktop/waitlist-2026-09.csv
   ```
   **This file contains real people's names, emails and company names.** `.gitignore` already
   excludes `*.csv` (verified — see the `# Never commit agency data` block, which covers every
   CSV in the repo, not only seed data) so a default-path export cannot be committed by accident,
   but treat the file as sensitive regardless of where it lands: do not paste its contents
   anywhere, and delete it once you are done with it if it leaves your machine.

---

## 4. Deliberately not built

- **No confirmation email sent today.** The adapter exists (`lib/waitlist/email.ts`, same shape
  as `lib/messaging/index.ts`: `NullEmailAdapter` default, `ResendAdapter` behind
  `RESEND_API_KEY`), and `joinWaitlist` calls it after every successful signup — but with no
  `RESEND_API_KEY` set, `NullEmailAdapter` just logs and a registrant gets only the on-page
  success message. Sending a real email needs a Resend account and a verified sending domain —
  see `docs/keys-needed.md` §1, a 🟡 (needed before a real user, not blocking the build). Once
  `RESEND_API_KEY` and `RESEND_FROM_ADDRESS` are set in the deployed environment, confirmations
  start sending with no code change. A failed or skipped email never fails the signup — the row
  is already saved by the time the adapter runs.
- **No CRM integration.** Signups live in `waitlist_signups` and nowhere else. Exporting to a CSV
  (§3) is the bridge to whatever Stella uses to track outreach until a real integration is worth
  building.
- **No automated retention enforcement.** See §2 — the 12-month figure is stated on the privacy
  page but not yet enforced by a job.

---

## 5. Quick reference — what's already true

- Insert, case-insensitive duplicate rejection (`23505`), and anonymous-read isolation are all
  verified against the live table by `npm run verify:waitlist` — see `docs/status/P21.md` for the
  latest run's output.
- Rate limiting is database-backed (`waitlist_rate_limit`, migration 0010), roughly 3 submissions
  per hashed IP per hour plus a 200/hour global circuit breaker, both enforced before the insert
  in `app/actions.ts`. A tripped limit returns `waitlist.status.rate_limited` — a specific,
  honest message, not a silent success and not "something went wrong".
- The honeypot field (`website`) already existed in the form the other tool built; bots that fill
  it get a fake success with no database write, so they get no signal either way.
