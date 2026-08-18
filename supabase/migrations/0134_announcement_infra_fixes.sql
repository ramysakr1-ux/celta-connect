-- for-claude-code-announcement-infra-fixes.md, items 1 and 2.

-- Item 1: staggered ABC/DEF deadlines. A nullable FK, not a hardcoded
-- abc/def enum -- group names are admin-chosen free text (established
-- earlier: course_tp_groups.name), never a fixed pair. Null = whole
-- cohort (today's only behavior); set = this event applies to one group
-- only, e.g. a second assignment_due row for the same assignment_type on
-- a different date for the other group.
alter table public.course_timetable_events
  add column if not exists tp_group_scope_id uuid references public.course_tp_groups (id) on delete set null;

-- Item 2: "register never logged" vs "logged, zero present" were
-- indistinguishable before this -- volunteer_attendance has no row either
-- way. Stamped by setAttendance() regardless of attendee count.
alter table public.course_timetable_events
  add column if not exists register_submitted_at timestamptz;
