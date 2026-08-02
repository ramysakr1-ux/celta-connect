-- Adds the two fields needed to render a real Written Assignments card
-- (due date + free-text tutor feedback) -- neither existed before. The
-- assignment "description" and word-count range are fixed CELTA boilerplate
-- (same for every trainee), so they live as static reference content in
-- src/lib/assignment-info.ts, not as columns here.

alter table public.assignments add column due_date date;
alter table public.assignments add column tutor_feedback text;
