-- Volunteer day-before RSVP (design_handoff_volunteer_students_v2:
-- for-claude-code-volunteer-rsvp.md + for-claude-code-volunteer-messaging-
-- complete.md, Ramy 5 Sep 2026).
--
-- The day-before email already existed (channel 'email' in
-- volunteer_session_reminders_sent, 20h before each session's own start
-- time) but its two buttons both just opened the volunteer's page --
-- nothing was recorded. "Yes, I'll be there" now records a row here;
-- "Can't make it" reuses volunteer_declines (one decline mechanism, not
-- two). A volunteer who does nothing stays unknown -- never read as a no.

create table public.volunteer_confirmations (
  id uuid primary key default gen_random_uuid(),
  volunteer_student_id uuid not null references public.volunteer_students(id) on delete cascade,
  timetable_event_id uuid not null references public.course_timetable_events(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (volunteer_student_id, timetable_event_id)
);

create index volunteer_confirmations_event_idx on public.volunteer_confirmations(timetable_event_id);

-- All volunteer writes go through the service role (the token is the
-- identity -- a volunteer has no auth account), and the trainer hub reads
-- through hubReadClient. RLS on with read policies for signed-in staff,
-- same shape as volunteer_declines; no authenticated write path at all.
alter table public.volunteer_confirmations enable row level security;

create policy "volunteer_confirmations: trainer reads their course's rows"
on public.volunteer_confirmations for select
to authenticated
using (
  (select public.is_trainer()) and exists (
    select 1 from public.volunteer_students v
    where v.id = volunteer_confirmations.volunteer_student_id
      and v.course_id = (select public.current_course_id())
  )
);

create policy "volunteer_confirmations: admin reads their centres' rows"
on public.volunteer_confirmations for select
to authenticated
using (
  (select public.is_admin()) and exists (
    select 1 from public.volunteer_students v
    join public.courses c on c.id = v.course_id
    where v.id = volunteer_confirmations.volunteer_student_id
      and c.center_id = any(public.held_center_ids())
  )
);

-- "Never opened" on the trainer's register (v2 handoff, Link column):
-- stamped every time a volunteer_student token page is opened.
alter table public.course_access_tokens
  add column last_opened_at timestamptz;

notify pgrst, 'reload schema';
