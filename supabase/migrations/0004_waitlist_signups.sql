-- Public pre-launch registrations are product leads, not tenant data. They are
-- intentionally isolated from agency tables and have no public RLS policy.
create table waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(trim(full_name)) between 2 and 120),
  work_email text not null check (char_length(trim(work_email)) between 3 and 254),
  email_normalized text generated always as (lower(trim(work_email))) stored unique,
  company_name text not null check (char_length(trim(company_name)) between 2 and 160),
  job_title text check (char_length(trim(job_title)) <= 120),
  promoter_count text not null check (promoter_count in ('1-30', '31-100', '101-300', '300+')),
  primary_challenge text check (char_length(trim(primary_challenge)) <= 1000),
  utm_source text check (char_length(trim(utm_source)) <= 120),
  utm_medium text check (char_length(trim(utm_medium)) <= 120),
  utm_campaign text check (char_length(trim(utm_campaign)) <= 120),
  created_at timestamptz not null default now()
);

alter table waitlist_signups enable row level security;
alter table waitlist_signups force row level security;

comment on table waitlist_signups is
  'Pre-launch interest registrations. No anonymous database policy exists; the validated server action writes through the service role.';
