-- Ramy, 25 Aug 2026: "unassessed is the same thing as getting to know
-- you... it's gonna read whatever is on the timetable" -- and then,
-- pushing back on treating the trainer side as separate: "why can't the
-- trainers upload... it would read demo lesson, and then the next one
-- would read getting to know you." One shared table instead of two --
-- neither GTKY nor a demo lesson fits the existing tp_materials system
-- (that one requires a trainee-owned tp_plans row, which a trainer
-- teaching a demo lesson never has, and which GTKY's own fixed-activity-
-- bank model was never built around either). This is deliberately NOT
-- keyed to tp_plans/gtky_assignments -- just the calendar event itself,
-- so either a trainee or a trainer can share against whichever session is
-- theirs, and the volunteer-facing card can read the event's own title
-- verbatim instead of assuming a "TP{n}" format.
create table public.session_materials (
  id uuid primary key default gen_random_uuid(),
  timetable_event_id uuid not null references public.course_timetable_events (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  uploaded_by uuid not null references public.profiles (id) on delete cascade,
  storage_path text,
  file_name text,
  file_type text check (file_type in ('pdf', 'image', 'pptx', 'docx')),
  slides_url text,
  created_at timestamptz not null default now()
);

create index session_materials_event_id_idx on public.session_materials (timetable_event_id);
create index session_materials_course_id_idx on public.session_materials (course_id);

alter table public.session_materials enable row level security;

-- Whoever shared it manages it -- same "you own what you uploaded"
-- shape as tp_materials, just without that table's tp_plans dependency.
-- The course_id check covers both a trainee (profiles.course_id) and a
-- trainer/admin (current_course_id(), the active-course switch) in one
-- policy rather than needing two.
create policy "session_materials: uploader manages their own"
on public.session_materials for all
to authenticated
using (uploaded_by = auth.uid())
with check (
  uploaded_by = auth.uid()
  and (
    course_id = public.current_course_id()
    or course_id = (select course_id from public.profiles where id = auth.uid())
  )
);

create policy "session_materials: trainer/admin read their course"
on public.session_materials for select
to authenticated
using ((public.is_admin() or public.is_trainer()) and course_id = public.current_course_id());
