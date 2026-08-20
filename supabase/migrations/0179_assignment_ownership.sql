-- connect-spec-corrections-for-claude-code.md item 7: "not a system-fixed
-- rule. The MCT assigns which tutor owns which assignments... manually,
-- per course... a tutor's TP group and their assignment-marking ownership
-- are separate fields, since they don't necessarily match." Marking itself
-- stays open (any trainer on the course can still mark anything, same as
-- today) -- this is visibility/assignment of who's SUPPOSED to own it, not
-- a new hard gate nobody asked for.
alter table public.course_tutors
  add column owned_assignment_types text[] not null default '{}'
  check (owned_assignment_types <@ array['Focus on Learner', 'LRT', 'Skills', 'LfC']::text[]);
