-- connect-spec-corrections-for-claude-code.md item 10 (Admin Handbook):
-- "Five of the assessed hours must be whole class teaching... one observed
-- and assessed lesson may be given to single or paired students... This
-- lesson should not be either of the two final lessons." Three rules, all
-- enforced at the DB level so they hold regardless of which screen writes
-- the row:
--   1. TP7/TP8 (the final two, see delivery-mode.ts's own "final two
--      assessed" framing) can never be one_to_one_or_small_group -- a
--      check constraint.
--   2. At most one such lesson per candidate across the whole course -- a
--      partial unique index, same reservation-via-unique-index pattern as
--      tp_material_pool_claims (migration 0180): the DB itself is the
--      race-safe cap, not application-level counting.
--   3. Peer-group teaching and placement/interview sessions were never
--      tracked as plan_assignments rows at all (they're outside the 6
--      assessed TP rounds entirely), so nothing here needs to exclude them
--      -- they already don't participate.
alter table public.plan_assignments
  add column class_grouping text not null default 'whole_class'
    check (class_grouping in ('whole_class', 'one_to_one_or_small_group'));

alter table public.plan_assignments
  add constraint plan_assignments_no_1to1_on_final_two
    check (not (class_grouping = 'one_to_one_or_small_group' and tp_number in (7, 8)));

create unique index plan_assignments_one_1to1_per_trainee_uidx
  on public.plan_assignments (trainee_id)
  where class_grouping = 'one_to_one_or_small_group';
