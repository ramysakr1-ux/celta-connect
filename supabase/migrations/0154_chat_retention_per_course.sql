-- Ramy, 2026-08-18: "chat retention lives in Course Admin, configured by
-- the MCT per course -- build-spec.md's 'centre setting' wording is
-- imprecise and should be read as 'course-level setting' instead."
--
-- Moves chat_retention_days from centers to courses. A channel with no
-- course (all_staff, centre_admin, dm -- the centre-wide ones) has no MCT
-- to set this for, so it keeps the same fixed default (1 day, midnight
-- clear) every channel already fell back to before this setting existed
-- at all.

alter table public.courses
  add column chat_retention_days integer;

alter table public.centers
  drop column chat_retention_days;
