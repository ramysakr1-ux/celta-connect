-- Volunteer View.dc.html: "Can't make it? -> Let them know -- a one-tap
-- decline, not an email, because attendance changes the lesson (a TP with
-- two learners is different)." No existing mechanic records a volunteer's
-- own self-reported non-attendance -- volunteer_attendance (0030) only
-- records ACTUAL attendance, marked by staff after the fact. This is the
-- opposite: a volunteer telling their tutor ahead of time that they won't
-- be there.
create table public.volunteer_declines (
  id uuid primary key default gen_random_uuid(),
  volunteer_student_id uuid not null references public.volunteer_students (id) on delete cascade,
  timetable_event_id uuid not null references public.course_timetable_events (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (volunteer_student_id, timetable_event_id)
);

create index volunteer_declines_event_idx on public.volunteer_declines (timetable_event_id);

alter table public.volunteer_declines enable row level security;

-- No auth.uid() session exists on the volunteer's own path at all (same as
-- volunteer_students itself, migration 0030) -- writes go through the admin
-- client from a token-scoped server action, same trust boundary as
-- volunteer sign-up. Staff read their own course's declines to know who
-- won't be there.
create policy "volunteer_declines: trainer reads their course's declines"
on public.volunteer_declines for select
to authenticated
using (
  public.is_trainer()
  and volunteer_student_id in (
    select id from public.volunteer_students where course_id = public.current_course_id()
  )
);

create policy "volunteer_declines: admin reads their center's declines"
on public.volunteer_declines for select
to authenticated
using (
  public.is_admin()
  and volunteer_student_id in (
    select id from public.volunteer_students
    where course_id in (select id from public.courses where center_id = public.current_center_id())
  )
);
