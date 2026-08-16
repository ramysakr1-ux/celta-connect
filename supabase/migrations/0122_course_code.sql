-- Course Admin.dc.html, screen 1 of the setup wizard: "Course setup — course
-- details". Two of its fields had nowhere to go.
--
-- "Course code" — C3/2024 in the design. Ramy, 2026-08-16: "the course code is
-- the course number", the one Cambridge issues. Distinct from the design's
-- "Course name (internal, candidates don't see this)", which is a centre's own
-- label like "January intensive 2024".
--
-- Nullable: the design says "get them right here", which is advice, not a
-- constraint. A centre sets a course up before Cambridge issues the number.
alter table public.courses add column if not exists course_code text;

comment on column public.courses.course_code is
  'The Cambridge course number (C3/2024), per Course Admin.dc.html step 1. Distinct from name, which the design marks internal and candidates never see.';

-- "Maximum cohort size", also step 1. application_cap already exists and caps
-- APPLICATIONS; this is the size of the cohort itself.
alter table public.courses add column if not exists cohort_size integer;

comment on column public.courses.cohort_size is
  'Maximum cohort size, per Course Admin.dc.html step 1. Distinct from application_cap, which limits applications rather than places.';
