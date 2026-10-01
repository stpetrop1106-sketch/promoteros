-- Promoter search that finds people who are actually there.
--
-- `app/promoters/page.tsx` searched with `full_name.ilike.%q%`. `ilike` is case-insensitive but
-- NOT accent-insensitive, which in Greek hides real people. Reproduced against this project:
--
--     ilike '%ΣΤΕΛΛΑ%'        -> 1 row        ilike '%Στέλλα%'        -> 0 rows
--     ilike '%μαρια%'         -> 1 row        ilike '%Μαρία%'         -> 3 rows
--     ilike '%Παπαδοπούλου%'  -> 5 rows       ilike '%παπαδοπουλου%'  -> 1 row
--
-- Type an accent where the data has none (or the reverse) and a promoter who exists is invisible.
-- Nobody types the same accents the data happens to carry, so this is not an edge case: it is the
-- normal way the search box is used.
--
-- ---------------------------------------------------------------------------------------------
-- WHY GENERATED COLUMNS AND NOT AN EXPRESSION INDEX
-- ---------------------------------------------------------------------------------------------
-- `where unaccent(full_name) ilike unaccent('%μαρια%')` is the right query, and an expression
-- index would make it fast — but the app cannot write that query. Search runs through PostgREST,
-- whose filter grammar is `column.operator.value`: there is no place to put a function call on the
-- left-hand side. An expression index would sit there unreachable while the app kept sending
-- `full_name.ilike.…`.
--
-- So the normalised form becomes a real column. `stored generated` rather than a trigger or an
-- application-maintained column, because it cannot drift: seed.ts, the promoter form, the bulk
-- importer and any future lane all get the same value for free, and nobody can forget to update it.
--
-- ---------------------------------------------------------------------------------------------
-- WHY TWO COLUMNS
-- ---------------------------------------------------------------------------------------------
-- `search_name` folds case and accents. That alone fixes the bug above.
--
-- `search_name_latin` additionally transliterates Greek to Latin, so a coordinator who types
-- "Maria Papadopoulou" on a Latin keyboard — or whose roster arrived from a client's Latin-script
-- spreadsheet — finds "Μαρία Παπαδοπούλου". `unaccent` does not do this: it removes accents, it
-- does not change script.
--
-- They are deliberately separate. Transliteration involves judgement calls (see `greek_to_latin`);
-- if one of them is ever wrong, only the Latin-script convenience degrades — plain Greek search,
-- which is the reported bug and the overwhelming majority of real use, keeps working.

-- ---------------------------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------------------------
-- Both live in `extensions`, the Supabase convention: `public` is exposed through PostgREST and an
-- extension's functions have no business being part of the published API.
create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------------------------
-- immutable_unaccent
-- ---------------------------------------------------------------------------------------------
-- A generated column's expression must be IMMUTABLE. `unaccent(text)` is only STABLE, because it
-- resolves the default text-search dictionary through `search_path` at call time. The two-argument
-- form takes the dictionary explicitly and is IMMUTABLE; naming it schema-qualified means this
-- function's result does not depend on `search_path` either, so no `set search_path` is needed
-- (and leaving it off keeps the function inlinable).
create or replace function public.immutable_unaccent(input text)
returns text
language sql
immutable
strict
parallel safe
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, input)
$$;

comment on function public.immutable_unaccent(text) is
  'IMMUTABLE wrapper around unaccent(), so it can be used in a generated column and an index. Mirrored in TypeScript by normaliseSearchText() in lib/promoters/search.ts.';

-- ---------------------------------------------------------------------------------------------
-- greek_to_latin
-- ---------------------------------------------------------------------------------------------
-- Expects text that has ALREADY been lowercased, unaccented and final-sigma-folded — i.e. exactly
-- the `search_name` expression below. That is why it only has to know about lowercase, unaccented
-- Greek letters.
--
-- The mapping is the one the Greek passport office uses (ELOT 743), because that is the spelling a
-- Greek person actually writes their own name in when they write it in Latin letters:
--   Παπαδοπούλου -> papadopoulou   Χατζή -> chatzi   Θεοδώρου -> theodorou
--   Αγγελική     -> angeliki       Ευαγγελία -> evangelia
--
-- Digraphs are handled before the 1:1 pass because they are not compositional: ου is "ou", not
-- "oy"; γγ is "ng", not "gg". Deliberately NOT handled: μπ -> b and γκ -> g, which are right at the
-- start of a word ("Μπάμπης" -> "babis") and wrong in the middle ("Λαμπρόπουλος" -> "labropoulos"
-- instead of "lampropoulos"). A rule that is wrong more often than right costs more than it buys.
--
-- Transliteration is inherently lossy: someone who writes "Eftychia" will not find "Ευτυχία"
-- (ευ -> ev gives "evtychia"), and "Hatzi" will not find "Χατζή". Those searches return nothing
-- today either, so this is strictly an improvement — but it is not a promise of completeness.
create or replace function public.greek_to_latin(input text)
returns text
language sql
immutable
strict
parallel safe
as $$
  select translate(
    replace(replace(replace(replace(replace(replace(replace(
      input,
      'ου', 'ou'),
      'αυ', 'av'),
      'ευ', 'ev'),
      'γγ', 'ng'),
      'θ',  'th'),
      'χ',  'ch'),
      'ψ',  'ps'),
    'αβγδεζηικλμνξοπρσςτυφω',
    'avgdeziiklmnxoprsstyfo'
  )
$$;

comment on function public.greek_to_latin(text) is
  'ELOT 743 transliteration of already-normalised lowercase unaccented Greek. Mirrored in TypeScript by toLatin() in lib/promoters/search.ts — the two MUST agree or search silently misses rows.';

-- ---------------------------------------------------------------------------------------------
-- The columns
-- ---------------------------------------------------------------------------------------------
-- `translate(…, 'ς', 'σ')` is not decoration. JavaScript's toLowerCase() applies the Unicode
-- final-sigma rule and Postgres's lower() does not:
--
--     "ΣΤΕΛΛΑΣ".toLowerCase()  ->  'στελλας'     (final sigma)
--     lower('ΣΤΕΛΛΑΣ')         ->  'στελλασ'     (ordinary sigma)
--
-- The query is normalised in TypeScript and the column in SQL, so without this fold the two sides
-- would disagree about every Greek name ending in sigma — which is most male Greek surnames.
alter table promoters
  add column if not exists search_name text
    generated always as (
      translate(public.immutable_unaccent(lower(full_name)), 'ς', 'σ')
    ) stored;

alter table promoters
  add column if not exists search_name_latin text
    generated always as (
      public.greek_to_latin(translate(public.immutable_unaccent(lower(full_name)), 'ς', 'σ'))
    ) stored;

comment on column promoters.search_name is
  'full_name lowercased, unaccented, final sigma folded. What the search box filters on. Generated: never written by the application.';
comment on column promoters.search_name_latin is
  'search_name transliterated to Latin (ELOT 743), so a Latin-keyboard search finds a Greek-script name. Generated: never written by the application.';

-- ---------------------------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------------------------
-- A substring search is `like '%maria%'`, which no btree index can serve — the leading wildcard
-- makes the ordering useless. Trigram GIN indexes are the one thing that does: pg_trgm breaks both
-- the column and the pattern into three-character grams and matches on those.
--
-- Caveat worth knowing: a pattern with fewer than 3 non-wildcard characters has no trigram to look
-- up, so a one- or two-letter search still falls back to a scan. At 62 promoters that is free; at
-- 50,000 it is a scan of one agency's slice, since RLS has already narrowed it.
create index if not exists promoters_search_name_trgm_idx
  on promoters using gin (search_name extensions.gin_trgm_ops);

create index if not exists promoters_search_name_latin_trgm_idx
  on promoters using gin (search_name_latin extensions.gin_trgm_ops);

-- New columns are covered by the table-level grant 0006_auth.sql already made to `authenticated`,
-- and by the `tenant_isolation` policy from 0002_rls.sql: a generated column is part of the row, so
-- it is behind exactly the same RLS as `full_name` it is derived from. Nothing to add.

-- PostgREST caches the schema; without this the new columns are invisible to the API until the
-- next reload. Supabase's event trigger normally does this by itself — harmless either way.
notify pgrst, 'reload schema';
