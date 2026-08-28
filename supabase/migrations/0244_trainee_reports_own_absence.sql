-- Ramy, 29 Aug 2026: "the trainee side should also show the attendance...
-- it's like for absences. If they skip something, then they have to record
-- it."
--
-- Today a candidate can READ their own absences (policy from 0006) but only
-- a trainer can insert one, so the only way an absence is recorded is a
-- tutor typing it in after the fact. That is the wrong way round for the
-- thing the candidate is meant to declare, and it means the CELTA 5's
-- attendance page depends on someone else remembering.
--
-- Insert only, and deliberately not update or delete: a declared absence is
-- a record, not a draft. If a candidate gets it wrong they tell their
-- tutor, who can already fix it under the existing trainer policy.
drop policy if exists "attendance_absences: trainee reports their own absence" on public.attendance_absences;
create policy "attendance_absences: trainee reports their own absence"
on public.attendance_absences for insert
to authenticated
with check (
  trainee_id = auth.uid()
  -- Pinned to their own course, so a row cannot be filed against a course
  -- the candidate is not on even if the client sends a different id.
  and course_id = public.current_course_id()
  -- tutor_comment belongs to the tutor. A candidate declaring an absence
  -- must not be able to write the tutor's response to it at the same time.
  and tutor_comment is null
);
