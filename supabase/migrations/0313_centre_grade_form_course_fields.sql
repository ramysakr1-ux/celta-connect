-- The course-level half of the Cambridge Centre Grade Form.
--
-- Read off the live form in Appian against TR073-C17/2026 on 25 Sep 2026: it
-- opens with four free-text fields about the COURSE, all four required, 2000
-- characters each, before it reaches a single candidate --
--
--   Teaching Practice
--   Teaching Practice Supervision and Feedback
--   Tutorials
--   Additional Comments
--
-- They describe how the course ran, not how anybody taught, so they belong on
-- the course row beside grade_form_submitted_at (0289) rather than on any
-- candidate's celta5 record.
--
-- Re-runnable.

alter table public.courses
  add column if not exists grade_form_teaching_practice text,
  add column if not exists grade_form_tp_supervision text,
  add column if not exists grade_form_tutorials text,
  add column if not exists grade_form_additional_comments text;

comment on column public.courses.grade_form_teaching_practice is
  'Centre Grade Form (Appian), course-level field "Teaching Practice". Required on the form; 2000 characters.';
comment on column public.courses.grade_form_tp_supervision is
  'Centre Grade Form (Appian), course-level field "Teaching Practice Supervision and Feedback". Required on the form; 2000 characters.';
comment on column public.courses.grade_form_tutorials is
  'Centre Grade Form (Appian), course-level field "Tutorials". Required on the form; 2000 characters.';
comment on column public.courses.grade_form_additional_comments is
  'Centre Grade Form (Appian), course-level field "Additional Comments". Required on the form; 2000 characters.';
