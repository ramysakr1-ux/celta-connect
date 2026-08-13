-- project_grading_feedback_trainer_awareness.md §2 "auto-tagging engine":
-- "On by default, disable-able in settings." One centre-wide toggle rather
-- than per-trainer -- matches the existing settings surface (feedback
-- style examples, tutor management) which is all centre-scoped.
alter table public.centers add column auto_tag_criteria_enabled boolean not null default true;
