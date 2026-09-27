-- Two more answers on the waitlist form, so a signup says something useful before anyone replies.
--
-- The form already collected name, work email, company, promoter count and the biggest difficulty.
-- What it could not say was HOW the agency runs shifts today, or whether they actually want to be
-- called — which is the difference between a list of addresses and a list of conversations worth
-- having while the product is still in early access.
--
-- Additive and nullable on purpose: every row written before this migration stays valid and needs
-- no backfill, and nothing that reads the table has to change.

alter table waitlist_signups
  add column current_tooling text,
  add column wants_demo boolean;

comment on column waitlist_signups.current_tooling is
  'How the agency schedules shifts today (spreadsheet, messaging app, internal system, other). Self-reported on the waitlist form; null for rows created before 0020.';

comment on column waitlist_signups.wants_demo is
  'Whether they asked to be contacted for a short walkthrough. Null means the question was not asked (pre-0020) rather than "no".';

-- The promoter-count ranges on the form changed (1–25 / 26–50 / 51–100 / 101–250 / 250+) and the
-- column carried a CHECK pinned to the four old ones. Without this the redesigned form would have
-- collected nothing at all: every submission failed with 23514 and the visitor was told "try again
-- in a moment", which would never have worked. Found by submitting the real form rather than by
-- reading the schema.
--
-- The old values stay allowed. Rows already collected under them are valid data, and a constraint
-- that invalidates history is a constraint that blocks the next deploy.
alter table waitlist_signups drop constraint waitlist_signups_promoter_count_check;

alter table waitlist_signups add constraint waitlist_signups_promoter_count_check
  check (promoter_count = any (array[
    '1-25', '26-50', '51-100', '101-250', '250+',
    '1-30', '31-100', '101-300', '300+'
  ]));
