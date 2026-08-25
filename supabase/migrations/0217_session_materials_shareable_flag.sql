-- Ramy, 25 Aug 2026: "I don't want it to read lunch for the trainees.
-- That would be ridiculous." The session-materials pickers (both trainer
-- and trainee) were filtering course_timetable_events by "anything that
-- isn't a TP" -- which also pulls in every purely-logistic milestone
-- ("Lunch", "Assignment writing time", "TP feedback & planning") since
-- those share the same `type` as a real demo lesson or GTKY session.
-- A trainer now opts an event in explicitly when creating/editing it,
-- rather than the picker guessing from type/title.
alter table public.course_timetable_events add column shares_materials boolean not null default false;
