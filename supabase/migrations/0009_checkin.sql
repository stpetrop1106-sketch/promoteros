-- P9 — check-in and field report.
--
-- This migration deliberately does NOT touch check_ins: it already has no lat/lng columns
-- (see 0001_init.sql), which is a legal constraint (CLAUDE.md §3, decisions.md D4), not an
-- oversight to "fix" here. Nothing in this file adds a position column anywhere.
--
-- Two things were actually missing for P9:
--   1. A Storage bucket for field-report photos.
--   2. One index that 0001 did not add (field_reports and check_ins already got a unique
--      index on assignment_id for free from their `unique (assignment_id)` constraints).
--
-- MANAGER: this file is written, not applied. Run it in the Supabase SQL editor — see
-- docs/status/P9.md for exactly what to verify afterwards.

insert into storage.buckets (id, name, public)
values ('field-report-photos', 'field-report-photos', false)
on conflict (id) do nothing;

-- No storage.objects policies for anon/authenticated roles are added here, on purpose.
--
-- Every read and write to this bucket goes through `lib/checkins.ts`'s `attachReportPhoto`,
-- which verifies our own signed, single-use token (lib/tokens.ts) in application code and
-- only then calls the service-role client — the same "verify first, service role after"
-- shape already used by /i/[token] and /c/[token] for every other table. Supabase storage
-- policies are evaluated against Postgres auth context (anon/authenticated/service_role);
-- they have no way to check an HMAC token embedded in a URL path, so a policy that claimed
-- to allow "an anonymous token-verified upload" would not actually verify anything — it
-- would just be an anonymous-write policy with a misleading name. Writing that would be
-- worse than writing nothing: it would look like a safeguard and not be one. The service
-- role bypasses storage RLS entirely, which is what every write in this bucket relies on.

create index if not exists report_photos_field_report_id_idx
  on report_photos (field_report_id);
