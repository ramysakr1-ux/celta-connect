-- for-claude-code-pre-course-task-screens.md: "Find your way around" --
-- six real questions, each self-resolves to "Found" the moment the
-- trainee actually navigates to the correct place in the product. No
-- typed answer, no manual "mark as found" -- instrumented navigation
-- events only (see src/lib/scavenger-hunt.ts for the question list and
-- where each one is marked found).

create table public.scavenger_hunt_progress (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  trainee_id uuid not null references public.profiles (id) on delete cascade,
  question_key text not null,
  found_at timestamptz not null default now(),
  unique (trainee_id, question_key)
);

create index scavenger_hunt_progress_course_id_idx on public.scavenger_hunt_progress (course_id);
create index scavenger_hunt_progress_trainee_id_idx on public.scavenger_hunt_progress (trainee_id);

alter table public.scavenger_hunt_progress enable row level security;

create policy "scavenger_hunt_progress: trainee manages their own progress"
on public.scavenger_hunt_progress for all
to authenticated
using (trainee_id = auth.uid())
with check (trainee_id = auth.uid());

create policy "scavenger_hunt_progress: trainer reads their course's progress"
on public.scavenger_hunt_progress for select
to authenticated
using (public.is_trainer() and course_id = public.current_course_id());
