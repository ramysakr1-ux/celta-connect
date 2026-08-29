-- Stage Three: centre discretion above Cambridge's floor.
--
-- CELTA Administration Handbook 10.2 lets a centre give Stage Three
-- tutorials to every candidate, over and above the cases where Cambridge
-- requires one. Ramy, 29 Aug 2026: "leave it to the centre to decide, with
-- the exception of a violation of the Cambridge rules" -- so this setting
-- can only ADD candidates, never remove one Cambridge requires. The four
-- mandatory triggers live in src/lib/stage3-triggers.ts and are evaluated
-- independently of this flag.
--
-- Default false: triggers-only is the Cambridge baseline, and a centre
-- opting everyone in should be a deliberate act, not something inherited.
alter table public.centers
  add column if not exists stage3_for_all_candidates boolean not null default false;

comment on column public.centers.stage3_for_all_candidates is
  'Handbook 10.2 centre option: give Stage Three to every candidate. Raises Cambridge''s floor, never lowers it -- the four mandatory triggers apply regardless.';
