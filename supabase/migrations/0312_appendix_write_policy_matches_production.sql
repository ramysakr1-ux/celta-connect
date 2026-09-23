-- Make a replay of this repo produce the policy production actually has.
--
-- Found while backfilling the migration ledger (23 Sep 2026). 0302 creates
-- "assignment_appendices: trainee attaches while unlocked". Production has no
-- such policy -- it has "assignment_appendices: trainee attaches to the open
-- round" instead, and that one is STRICTER:
--
--   0302 in this repo   : the round is open  (a.first_status = 'not_submitted'
--                         OR resubmission_required AND resubmission not
--                         submitted) -- and never looks at which round the
--                         APPENDIX belongs to.
--   production          : the appendix's OWN round is the open one
--                         (round = 'first' AND first_status = 'not_submitted')
--                         OR (round = 'resubmission' AND ...).
--
-- The repo's version lets a candidate attach a row marked round =
-- 'resubmission' while the first round is still open, and attach to the first
-- round while only the resubmission is open. Production does not. So the
-- database was tightened at some point and the migration was never written --
-- which nobody could see, because the ledger stopped at 0264 and nothing
-- compared the two.
--
-- Rather than edit 0302, which is history and may have run elsewhere, this
-- states the end state. On production it is a no-op: the same policy is
-- dropped and recreated identically. On a replayed database it replaces the
-- looser one 0302 leaves behind.
--
-- Re-runnable. Both names are dropped so it does not matter which one a given
-- database is carrying.

drop policy if exists "assignment_appendices: trainee attaches while unlocked" on public.assignment_appendices;
drop policy if exists "assignment_appendices: trainee attaches to the open round" on public.assignment_appendices;

create policy "assignment_appendices: trainee attaches to the open round"
on public.assignment_appendices for all
to authenticated
using (exists (
  select 1 from public.assignments a
  where a.id = assignment_appendices.assignment_id
    and a.trainee_id = (select auth.uid())
    and (
      (assignment_appendices.round = 'first' and a.first_status = 'not_submitted'::submission_status)
      or (assignment_appendices.round = 'resubmission'
          and a.first_status = 'resubmission_required'::submission_status
          and a.resubmission_status = 'not_submitted'::submission_status)
    )
))
with check (exists (
  select 1 from public.assignments a
  where a.id = assignment_appendices.assignment_id
    and a.trainee_id = (select auth.uid())
    and (
      (assignment_appendices.round = 'first' and a.first_status = 'not_submitted'::submission_status)
      or (assignment_appendices.round = 'resubmission'
          and a.first_status = 'resubmission_required'::submission_status
          and a.resubmission_status = 'not_submitted'::submission_status)
    )
));

notify pgrst, 'reload schema';

-- Expect exactly one row, named for the open round.
select policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename = 'assignment_appendices'
  and policyname like '%attaches%';
