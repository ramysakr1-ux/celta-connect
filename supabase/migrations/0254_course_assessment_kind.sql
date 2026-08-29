-- What the assessor is required to do on this visit depends on which KIND of
-- assessment it is, and the numbers are different enough to matter:
--
--   regular     -- two portfolios read in full (Handbook 14.2/15.1)
--   two_yearly  -- a minimum of four, PLUS every portfolio provisionally
--                  graded Fail or potential Fail
--
-- Handbook 13.1: "Every CELTA course must be assessed by a Cambridge
-- English-approved assessor normally towards the end of the course. The
-- default position for regular assessments is for them to be conducted
-- remotely, with longer, face-to-face assessments taking place once every two
-- years."
--
-- Note this is NOT the same axis as remote vs face-to-face. 13.1 continues:
-- "where a centre prefers, the remote, regular assessment can be conducted
-- face-to-face, provided the centre meets the cost of any expenses incurred."
-- A regular assessment held in person is still a regular assessment and still
-- reads two portfolios, so the requirement counts key off this column and not
-- off how the assessor attends.
--
-- Defaults to 'regular', which is the Handbook's own default and the right
-- answer for every course except the one in every two-year cycle.

alter table public.courses
  add column if not exists assessment_kind text not null default 'regular'
    check (assessment_kind in ('regular', 'two_yearly'));

comment on column public.courses.assessment_kind is
  'Handbook 13.1: regular (remote by default, two portfolios read in full) or two_yearly (longer face-to-face, minimum four portfolios plus all Fail/potential Fail). Drives the requirement counts shown in the assessor pack. Not the same as how the assessor attends.';
