# PromoterOS waitlist launch checklist

The landing page writes registrations to Supabase. It does not send email or use a spreadsheet:
Supabase is the single source of truth, which makes each registration searchable, exportable and
protected from anonymous reads.

## Before the first public link

1. Apply `supabase/migrations/0004_waitlist_signups.sql` to the same Supabase project used by the
   app. Use the Supabase SQL Editor or the normal migration deployment flow. Do not edit an applied
   migration.
2. Set these environment variables locally and in Vercel:

   ```text
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   SUPABASE_SERVICE_ROLE_KEY=
   NEXT_PUBLIC_LEGAL_ENTITY_NAME=
   NEXT_PUBLIC_PRIVACY_EMAIL=
   ```

   `NEXT_PUBLIC_LEGAL_ENTITY_NAME` and `NEXT_PUBLIC_PRIVACY_EMAIL` are deliberately required: the
   public privacy page will fail closed if they are missing rather than publishing an anonymous notice.
3. Run the database proof from the project directory:

   ```bash
   npm run verify:waitlist
   ```

   The check creates one synthetic `example.test` registration, confirms that duplicate emails are
   rejected without case sensitivity, confirms that the anonymous Supabase key cannot read it, and
   removes the synthetic record again.
4. Run the production build and submit a real test registration from the deployed preview URL.
   Confirm it is visible in Supabase Table Editor → `waitlist_signups` and that a repeated submission
   shows the already-registered message.

## Reading campaign demand

The `waitlist_signups` table keeps the submission time, work email, company, role, promoter-count
range, free-text operational challenge, and `utm_source`, `utm_medium`, `utm_campaign` values. For
ads, link to the landing page with UTM parameters, for example:

```text
/?utm_source=linkedin&utm_medium=paid&utm_campaign=launch-agencies
```

This makes it possible to compare qualified agency interest by campaign without introducing a second
database or copying personal data into a spreadsheet.
