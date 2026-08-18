-- Grade Pipeline handoff, 2026-08-17: provisional grades move from "any
-- trainer edits directly" to propose (any tutor, attributed) -> approve
-- (MCT only, gates what's sent to the assessor). Ramy, 2026-08-17: editing
-- after approval resets to awaiting rather than locking -- a tutor can fix a
-- mistake without needing the MCT to manually unlock it, but nothing reaches
-- the assessor without the MCT looking at it again.
alter table public.celta5_records add column if not exists provisional_proposed_by uuid references public.profiles (id) on delete set null;
alter table public.celta5_records add column if not exists provisional_approved_at timestamptz;
alter table public.celta5_records add column if not exists provisional_approved_by uuid references public.profiles (id) on delete set null;

comment on column public.celta5_records.provisional_proposed_by is
  'Which tutor set the current provisional_grade -- the "Proposed by X" tag.';
comment on column public.celta5_records.provisional_approved_at is
  'Set only by the MCT. Null after any edit to provisional_grade/provisional_grade_upper -- editing un-approves rather than locking.';

-- The provisional-grade deadline is set by the MCT directly (course-level,
-- one deadline for the whole cohort), not computed from the assessor visit
-- date -- Ramy, 2026-08-17: "the assessor visit falls on a bun day... maybe
-- Friday will be appropriate, but maybe it doesn't," so the 2-days-before/
-- shift-to-Friday formula was dropped in favour of a real date the MCT
-- chooses with the actual timetable in view.
alter table public.courses add column if not exists provisional_grades_due_at timestamptz;

comment on column public.courses.provisional_grades_due_at is
  'MCT-set deadline for provisional grades to reach the assessor. Not computed from assessor_visit_date.';
