-- 0303 -- An appendix belongs to the round it was attached for, and a
-- submitted round is a record.
--
-- 0302's trainee policy tested only "is a round open", not "is THIS row's
-- round the open one". So during a resubmission window a candidate could
-- delete or edit the appendices attached to their FIRST submission -- the
-- ones already marked, already on the cover sheet, already part of what the
-- tutor decided on. Round 1 is closed once it is handed in; only the round
-- currently open can be written to.

drop policy if exists "assignment_appendices: trainee attaches while unlocked" on public.assignment_appendices;
create policy "assignment_appendices: trainee attaches to the open round"
on public.assignment_appendices for all
to authenticated
using (exists (
  select 1 from public.assignments a
  where a.id = assignment_appendices.assignment_id
    and a.trainee_id = (select auth.uid())
    and (
      (assignment_appendices.round = 'first'
        and a.first_status = 'not_submitted'::submission_status)
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
      (assignment_appendices.round = 'first'
        and a.first_status = 'not_submitted'::submission_status)
      or (assignment_appendices.round = 'resubmission'
        and a.first_status = 'resubmission_required'::submission_status
        and a.resubmission_status = 'not_submitted'::submission_status)
    )
));

notify pgrst, 'reload schema';

select policyname
from pg_policies
where tablename = 'assignment_appendices'
  and policyname = 'assignment_appendices: trainee attaches to the open round';
