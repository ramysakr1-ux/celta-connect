-- The centre grade approval form, submitted in Appian: recorded.
--
-- Administration Handbook June 2025, 14.4, the last step of the grading
-- sequence: after the assessor's report, "The centre subsequently confirms
-- the final recommended grades on the centre grade approval form." Connect
-- recorded Cambridge's confirmation (cambridge_grades_confirmed_at, the
-- close-out tick) but not the centre's own submission that precedes it --
-- the same gap 0289 closed for the Centre Grade form, and Ramy's call on
-- 12 Sep 2026 was the same: a shared tick, MCT or Course Admin, whoever
-- first, logged with their name (markGradeApprovalFormSubmitted).
--
-- Re-runnable.

alter table public.courses
  add column if not exists grade_approval_form_submitted_at timestamptz,
  add column if not exists grade_approval_form_submitted_by uuid references public.profiles (id);

comment on column public.courses.grade_approval_form_submitted_at is
  'When the centre marked the centre grade approval form as submitted in Appian (Administration Handbook 14.4). Null until then.';
comment on column public.courses.grade_approval_form_submitted_by is
  'Who marked it -- the main course tutor or Course Admin.';
