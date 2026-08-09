-- Centre Admin.dc.html 2a's online-mode impact row: "Every tutor on the
-- course must be able to evidence online teaching or training experience."
-- Per-course, not per-profile -- a tutor could be evidenced on one course
-- and not another (they may have taught online elsewhere, or not yet on
-- this centre's platform), so this lives on course_tutors alongside
-- tutor_role/verified_at, the same per-course pattern 0051 already
-- established for trainer-in-training verification.

alter table public.course_tutors
  add column online_experience_evidenced boolean not null default false,
  add column online_experience_note text;
