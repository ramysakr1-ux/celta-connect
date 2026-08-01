-- Syllabus Planning Grid: TP7/TP8 only, NOT drawn from the TP Points
-- Library. A simple shared form (Name/Main Aim/Sub Aim/Material -- "Name"
-- is just the trainee's own profile, not a stored field) visible to the
-- whole cohort at once; trainees self-select and log their own lesson.
-- Confirmed against the center's real Syllabus Planning Grid document:
-- exactly these fields, no date/level/signature fields exist.
--
-- Soft-conflict flagging (two trainees picking the same Material) is
-- computed at read time in the app, not enforced here -- no unique
-- constraint on material, per the user's explicit "keep it simple, soft
-- warning only" decision.

create table public.syllabus_planning_entries (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  tp_number smallint not null check (tp_number in (7, 8)),
  trainee_id uuid not null references public.profiles (id) on delete cascade,
  main_aim text not null,
  sub_aim text,
  material text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, tp_number, trainee_id)
);

create index syllabus_planning_entries_course_id_idx on public.syllabus_planning_entries (course_id);

create trigger set_updated_at before update on public.syllabus_planning_entries
for each row execute function public.set_updated_at();

alter table public.syllabus_planning_entries enable row level security;

create policy "syllabus_planning_entries: cohort reads their course's entries"
on public.syllabus_planning_entries for select
to authenticated
using (course_id = public.current_course_id());

create policy "syllabus_planning_entries: admin reads entries in their center"
on public.syllabus_planning_entries for select
to authenticated
using (
  public.is_admin()
  and course_id in (select id from public.courses where center_id = public.current_center_id())
);

create policy "syllabus_planning_entries: trainee manages their own entry"
on public.syllabus_planning_entries for all
to authenticated
using (trainee_id = auth.uid())
with check (trainee_id = auth.uid() and course_id = public.current_course_id());

create policy "syllabus_planning_entries: trainer manages entries in their course"
on public.syllabus_planning_entries for all
to authenticated
using (public.is_trainer() and course_id = public.current_course_id())
with check (public.is_trainer() and course_id = public.current_course_id());

create policy "syllabus_planning_entries: admin manages entries in their center"
on public.syllabus_planning_entries for all
to authenticated
using (
  public.is_admin()
  and course_id in (select id from public.courses where center_id = public.current_center_id())
)
with check (
  public.is_admin()
  and course_id in (select id from public.courses where center_id = public.current_center_id())
);
