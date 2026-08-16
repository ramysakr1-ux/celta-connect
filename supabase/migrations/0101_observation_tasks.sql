-- Observation Tasks: "directed, assignable, submittable" observation
-- activities, replacing the bare self-reported log as the trainer-facing
-- way to require a specific observation. A submission auto-creates a real
-- `observations` row (see observation_id below) so it counts toward the
-- existing 6-hour requirement (observation-hours.ts) through the same one
-- function everything else already reads -- no second hour-tracking system.

create table public.observation_tasks (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  instructions text not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.observation_task_submissions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.observation_tasks(id) on delete cascade,
  trainee_id uuid not null references public.profiles(id) on delete cascade,
  -- Set once the trainee submits -- the real observations row their response
  -- created, so hours-computation never needs to know tasks exist at all.
  observation_id uuid references public.observations(id) on delete set null,
  response text not null,
  submitted_at timestamptz not null default now(),
  unique (task_id, trainee_id)
);

alter table public.observation_tasks enable row level security;
alter table public.observation_task_submissions enable row level security;

create policy "observation_tasks: trainer manages their course's tasks"
on public.observation_tasks for all
to authenticated
using (public.is_trainer() and course_id = public.current_course_id())
with check (public.is_trainer() and course_id = public.current_course_id());

create policy "observation_tasks: admin manages their center's tasks"
on public.observation_tasks for all
to authenticated
using (public.is_admin() and course_id in (select id from public.courses where center_id = public.current_center_id()))
with check (public.is_admin() and course_id in (select id from public.courses where center_id = public.current_center_id()));

create policy "observation_tasks: trainee reads their course's tasks"
on public.observation_tasks for select
to authenticated
using (course_id = public.current_course_id());

create policy "observation_task_submissions: trainee manages their own submissions"
on public.observation_task_submissions for all
to authenticated
using (
  trainee_id = auth.uid()
  and task_id in (select id from public.observation_tasks where course_id = public.current_course_id())
)
with check (
  trainee_id = auth.uid()
  and task_id in (select id from public.observation_tasks where course_id = public.current_course_id())
);

create policy "observation_task_submissions: trainer reads their course's submissions"
on public.observation_task_submissions for select
to authenticated
using (
  public.is_trainer()
  and task_id in (select id from public.observation_tasks where course_id = public.current_course_id())
);

create policy "observation_task_submissions: admin reads their center's submissions"
on public.observation_task_submissions for select
to authenticated
using (
  public.is_admin()
  and task_id in (
    select id from public.observation_tasks
    where course_id in (select id from public.courses where center_id = public.current_center_id())
  )
);
