-- P21 — Waitlist hardening: rate limiting for the public signup endpoint.
--
-- `joinWaitlist` (app/actions.ts) is unauthenticated and writes to the database. Posted to a
-- community, it meets bots. An in-memory counter would be per-process and reset on every
-- deploy or cold start — on serverless that is effectively no limit — so this is a real
-- table with a windowed counter, checked from `lib/waitlist/rate-limit.ts`.
--
-- Keyed by a HASHED ip. We never store a raw IP: it is personal data under GDPR and there is
-- no product reason to keep it once the rate-limit window has passed.
--
-- MANAGER: this file is written, not applied. Run it in the Supabase SQL editor, then
-- `npm run verify:waitlist` still passes (it does not touch this table) and a submission
-- from the deployed form should still succeed once.

create table waitlist_rate_limit (
  ip_hash text not null,
  window_start timestamptz not null,
  request_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (ip_hash, window_start)
);

-- The hot path (one lookup per submission) is covered by the primary key. This index
-- supports the cleanup delete and the global-ceiling sum, both of which filter or group by
-- window_start across every ip_hash, which the primary key's (ip_hash, window_start) order
-- does not serve well.
create index waitlist_rate_limit_window_idx on waitlist_rate_limit (window_start);

alter table waitlist_rate_limit enable row level security;
alter table waitlist_rate_limit force row level security;
-- No policies, deliberately — exactly like waitlist_signups. Only the service role touches
-- this table, from the rate-limit check itself.

comment on table waitlist_rate_limit is
  'Windowed request counters for the public waitlist endpoint, keyed by an HMAC-hashed IP address. Never stores a raw IP. Rows older than two windows are deleted opportunistically by the application on each check, so this never needs a scheduled job to stay bounded.';

-- Atomic increment-and-read. Application code cannot safely do "select the count, then
-- insert-or-update it" — two concurrent requests from the same IP could both read the same
-- starting count and both be let through. A single upsert with `on conflict ... do update`
-- is atomic in Postgres and returns the post-increment count in one round trip.
create function increment_waitlist_rate_limit(p_ip_hash text, p_window_start timestamptz)
returns integer
language sql
security definer
set search_path = public
as $$
  insert into waitlist_rate_limit (ip_hash, window_start, request_count, updated_at)
  values (p_ip_hash, p_window_start, 1, now())
  on conflict (ip_hash, window_start)
  do update set
    request_count = waitlist_rate_limit.request_count + 1,
    updated_at = now()
  returning request_count;
$$;

comment on function increment_waitlist_rate_limit is
  'Atomically increments and returns the request count for one ip_hash in one time window. Called once per waitlist submission attempt, before the row is inserted into waitlist_signups.';

-- The function runs as its definer (the migration role, which has table access) rather than
-- the caller, but the service-role client is the only caller in practice — anon/authenticated
-- are not granted execute, matching the "no public policy" posture of waitlist_signups.
revoke all on function increment_waitlist_rate_limit(text, timestamptz) from public;
grant execute on function increment_waitlist_rate_limit(text, timestamptz) to service_role;
