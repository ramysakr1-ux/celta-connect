-- Add the "Refresher training" tutor role.
--
-- Admin Handbook §3.7.3 lists six tutor roles for the entry form: Main Course
-- Tutor, Assistant Course Tutor, Input Tutor, Teaching Practice Tutor,
-- Trainer-in-training, and Refresher training. The enum carried every one but
-- the last -- a tutor re-accrediting could not be recorded in their real role.
-- (Trainer-in-training is handled separately, via is_trainer_in_training, so it
-- is not an enum value here.)
--
-- Three tables carry the same tutor_role check: profiles, course_tutors and
-- course_invitations. Each is a plain inline `check (...)`, whose auto-generated
-- name is <table>_<column>_check (confirmed against pg_constraint). Drop and
-- re-add each with the extra value. course_invitations allows NULL; the others
-- do not, so that one keeps its `is null or` prefix.

alter table public.profiles drop constraint if exists profiles_tutor_role_check;
alter table public.profiles add constraint profiles_tutor_role_check check (
  tutor_role in (
    'main_course_tutor',
    'assistant_course_tutor',
    'teaching_practice_tutor',
    'input_session_tutor',
    'external_assessor',
    'refresher_training'
  )
);

alter table public.course_tutors drop constraint if exists course_tutors_tutor_role_check;
alter table public.course_tutors add constraint course_tutors_tutor_role_check check (
  tutor_role in (
    'main_course_tutor',
    'assistant_course_tutor',
    'teaching_practice_tutor',
    'input_session_tutor',
    'external_assessor',
    'refresher_training'
  )
);

alter table public.course_invitations drop constraint if exists course_invitations_tutor_role_check;
alter table public.course_invitations add constraint course_invitations_tutor_role_check check (
  tutor_role is null or tutor_role in (
    'main_course_tutor',
    'assistant_course_tutor',
    'teaching_practice_tutor',
    'input_session_tutor',
    'external_assessor',
    'refresher_training'
  )
);
