-- The centre chooses which portfolios the assessor moderates.
--
-- Ramy, 10 Sep 2026, looking at the live assessor pack: "why is the assessor
-- getting all those cards? Assessor should only have the ones that they're
-- going to check the portfolios for, not all of them."
--
-- The narrowing was built and worked. It just never engaged, on any course,
-- because profiles.selected_for_assessor_visit defaulted to TRUE. Every
-- candidate was born selected, so "has the centre narrowed this down?" --
-- which the pack asks as `some(c => !c.selected)` -- was false everywhere:
-- 12 of 12 on the demo course, 14 of 14 on C4/2026.
--
-- It also inverted the MCT's own control. The roster's "Select for assessor
-- visit" button could only ever REMOVE someone, since everybody arrived
-- already in.
--
-- CELTA 5's wording is that assessors "scrutinise a selection of portfolios to
-- moderate candidates' work" -- a selection somebody makes, not the whole
-- cohort by default. So the default becomes false and the centre opts people
-- in.
--
-- Existing rows are deliberately left alone. Which candidates an assessor
-- moderates is the centre's decision on a live course, not a migration's, and
-- the pack falls back to the full cohort (saying so) when nothing is selected
-- -- so no course loses anything by this.

alter table public.profiles
  alter column selected_for_assessor_visit set default false;

notify pgrst, 'reload schema';
