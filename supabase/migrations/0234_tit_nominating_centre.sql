-- Ramy, 28 Aug 2026: for-claude-code-trainer-in-training.md line 51 --
-- "Required only when: the TinT trains on the External scheme, or trains
-- on the Internal scheme at a centre other than the one nominating them."
-- The extra-assessor-day gate (requiresAssessorDay in workspace.tsx) only
-- ever checked scheme === 'external' -- the Internal-at-a-different-centre
-- case had no column to record it at all, even though 0148's own comment
-- already anticipated it ("a real, distinct fact the centre records -- not
-- derivable from anything else in the schema"). Defaults to true (same
-- centre) so every existing row keeps its current (correct, scheme-only)
-- gate behavior until someone explicitly marks a record otherwise.
alter table public.tit_records
  add column trains_at_nominating_centre boolean not null default true;

comment on column public.tit_records.trains_at_nominating_centre is
  'False when this TinT trains (Internal scheme) at a centre other than the one that nominated them -- triggers the extra assessor day (screen 1c) same as External scheme.';
