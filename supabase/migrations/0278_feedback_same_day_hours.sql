-- How long after a lesson ends a tutor's written feedback is still "same
-- day" (design_handoff_teaching_practice_v2: the owed card's age pill turns
-- red past this). A real centre policy -- some centres say before you go
-- home, some allow the next morning -- so it is a setting, not a constant,
-- per Ramy's standing rule that anything the system decides should be
-- overridable by the people it decides for.
alter table public.centers
  add column feedback_same_day_hours integer not null default 24
  check (feedback_same_day_hours between 1 and 168);

notify pgrst, 'reload schema';
