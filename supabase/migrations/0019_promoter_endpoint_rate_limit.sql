-- A real rate limit for the promoter-facing token endpoints (/i, /c, /a).
--
-- WHY THIS REPLACES WHAT WAS SHIPPED THREE DAYS AGO
-- -------------------------------------------------
-- The A3 audit found these endpoints had no limit of any kind: 40 rapid requests got 40 answers,
-- each costing database reads through the service-role client. The first fix put a counter in
-- `middleware.ts`, in memory. It passed its test on one machine and then did nothing at all in
-- production: 75 concurrent requests and 70 sequential requests were all answered 200. Vercel
-- serves requests from many short-lived instances, so a module-level Map starts empty over and
-- over.
--
-- `0010_waitlist_hardening.sql` had already written down exactly this, months earlier, for the
-- waitlist endpoint: "An in-memory counter would be per-process and reset on every deploy or cold
-- start — on serverless that is effectively no limit." That is the pattern this migration copies,
-- rather than inventing a second one.
--
-- WHAT IS AND IS NOT PROTECTED
-- ----------------------------
-- Keyed on a HASHED caller address and a bucket (which family of link), never on the token. A
-- token-keyed limit would let anyone lock a promoter out of their own shift by replaying a link
-- they had been forwarded — a limiter turned into a denial of service against the person it
-- exists to protect.
--
-- The IP is hashed with `TOKEN_SIGNING_SECRET` before it ever reaches this table. A raw IP is
-- personal data under GDPR and there is no product reason to keep one, which is the same
-- reasoning `waitlist_rate_limit` carries.

create table endpoint_rate_limit (
  bucket text not null,
  ip_hash text not null,
  window_start timestamptz not null,
  request_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (bucket, ip_hash, window_start)
);

-- The hot path is covered by the primary key. This one serves the sweep, which filters on
-- window_start across every bucket and ip_hash.
create index endpoint_rate_limit_window_idx on endpoint_rate_limit (window_start);

alter table endpoint_rate_limit enable row level security;
alter table endpoint_rate_limit force row level security;
-- No policies, deliberately, exactly like waitlist_rate_limit: only the service role reaches
-- this table, and only from the rate-limit check itself.

comment on table endpoint_rate_limit is
  'Windowed request counters for the anonymous promoter endpoints (/i, /c, /a), keyed by bucket and an HMAC-hashed IP. Never stores a raw IP, and never keys on a token — a token-keyed limit would let a forwarded link be used to lock a promoter out of their own shift.';

-- Atomic increment-and-read. "Select the count, then update it" races: two concurrent requests
-- from the same caller could both read the same starting value and both be allowed through.
create function increment_endpoint_rate_limit(
  p_bucket text,
  p_ip_hash text,
  p_window_start timestamptz
)
returns integer
language sql
security definer
set search_path = public
as $$
  insert into endpoint_rate_limit (bucket, ip_hash, window_start, request_count, updated_at)
  values (p_bucket, p_ip_hash, p_window_start, 1, now())
  on conflict (bucket, ip_hash, window_start)
  do update set
    request_count = endpoint_rate_limit.request_count + 1,
    updated_at = now()
  returning request_count;
$$;

comment on function increment_endpoint_rate_limit is
  'Atomically increments and returns the request count for one bucket and ip_hash in one window. Called once per request to an anonymous promoter endpoint, before any other query runs.';

-- Service role only. Granting this to `anon` would hand an attacker the counter itself: they
-- could inflate any ip_hash they chose and lock real promoters out — which is precisely the
-- A1-02 finding that 0018 had to close for the waitlist limiter.
revoke all on function increment_endpoint_rate_limit(text, text, timestamptz) from public;
revoke execute on function increment_endpoint_rate_limit(text, text, timestamptz) from anon, authenticated;
grant execute on function increment_endpoint_rate_limit(text, text, timestamptz) to service_role;
