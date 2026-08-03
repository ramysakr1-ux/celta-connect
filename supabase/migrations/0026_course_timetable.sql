-- §1.1a "THE COURSE TIMETABLE" (architecture-plan.md) -- the structured,
-- dated-event object that becomes the single source of truth for the whole
-- course clock (This Week panel, assignment due/overdue states, TP dates).
-- This migration lands the data object + lock mechanism only. The full
-- reusable-skeleton/duplicate-and-redate builder UI is explicitly allowed
-- to be built in stages per the doc -- this schema is shaped to support
-- that target model even though the first UI on top of it is a plain
-- list editor, not a week/day grid yet.
--
-- Assignment links are by assignment_type (text), not a specific trainee's
-- assignments row -- a timetable event is a course-wide date (e.g. "Focus
-- on the Learner is due"), not any one trainee's submission.

create table public.course_timetable_events (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  type text not null check (
    type in ('input_session', 'tp', 'assignment_due', 'resubmission_due', 'milestone')
  ),
  title text not null,
  event_date date not null,
  event_time time,
  tag text, -- semantic tag driving colour (e.g. a tutor's name, 'individual', 'whole_group')
  linked_assignment_type text,
  linked_tp_number smallint check (linked_tp_number between 1 and 8),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index course_timetable_events_course_id_idx on public.course_timetable_events (course_id);
create index course_timetable_events_date_idx on public.course_timetable_events (course_id, event_date);

create trigger set_updated_at before update on public.course_timetable_events
for each row execute function public.set_updated_at();

-- Flexible while building, frozen once committed -- when set, the whole
-- course clock (due dates, overdue states, resubmission windows) treats
-- this timetable as final. Editing after lock is still technically
-- possible at the DB level (RLS doesn't enforce the lock itself, the app
-- does, same as tp_plans.submitted_at's lock pattern) -- the column here
-- only records the moment of commitment.
alter table public.courses add column timetable_locked_at timestamptz;

alter table public.course_timetable_events enable row level security;

create policy "course_timetable_events: cohort reads their course's timetable"
on public.course_timetable_events for select
to authenticated
using (course_id = public.current_course_id());

create policy "course_timetable_events: admin reads timetables in their center"
on public.course_timetable_events for select
to authenticated
using (
  public.is_admin()
  and course_id in (select id from public.courses where center_id = public.current_center_id())
);

create policy "course_timetable_events: trainer manages their course's timetable"
on public.course_timetable_events for all
to authenticated
using (public.is_trainer() and course_id = public.current_course_id())
with check (public.is_trainer() and course_id = public.current_course_id());

create policy "course_timetable_events: admin manages timetables in their center"
on public.course_timetable_events for all
to authenticated
using (
  public.is_admin()
  and course_id in (select id from public.courses where center_id = public.current_center_id())
)
with check (
  public.is_admin()
  and course_id in (select id from public.courses where center_id = public.current_center_id())
);
