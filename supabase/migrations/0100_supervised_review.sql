-- for-claude-code-supervised-review.md (2026-08-15): timetable slots
-- previously labelled "Self-study" get renamed to "Supervised review"
-- (reviewing a prior input session) or "[X] writing" (time set aside to
-- write an assignment) -- but the rename is only earned by a real
-- submit-and-check structure: the trainee must submit something, the
-- trainer must check it, and that supervision+submission is what
-- justifies counting the slot as contact time (vs. genuine unsupervised
-- self-study, which isn't renamed and isn't counted).
--
-- New event type rather than reusing 'milestone' -- this needs its own
-- submission/completion tracking table, which a generic milestone has no
-- reason to carry.
alter table public.course_timetable_events drop constraint course_timetable_events_type_check;
alter table public.course_timetable_events add constraint course_timetable_events_type_check check (
  type in ('input_session', 'tp', 'assignment_due', 'resubmission_due', 'milestone', 'supervised_session')
);

-- One row per trainee per supervised session. time_spent_seconds accrues
-- via periodic heartbeats while the task is open (see
-- portfolio/[traineeId]/supervised/[eventId]/page.tsx) -- real elapsed
-- time, not a self-report, since the whole point per the spec is a signal
-- beyond pass/fail completion (e.g. ticked complete in 90 seconds vs 20
-- minutes). response is deliberately one generic text field, not
-- "reflection" or "quiz answer" specifically -- the spec's own open
-- question (reread-only vs reread+quiz) isn't resolved yet, so this needs
-- to satisfy either shape without presupposing which.
create table public.supervised_session_completions (
  id uuid primary key default gen_random_uuid(),
  timetable_event_id uuid not null references public.course_timetable_events (id) on delete cascade,
  trainee_id uuid not null references public.profiles (id) on delete cascade,
  started_at timestamptz not null default now(),
  time_spent_seconds integer not null default 0,
  response text,
  submitted_at timestamptz,
  checked_at timestamptz,
  checked_by uuid references public.profiles (id) on delete set null,
  unique (timetable_event_id, trainee_id)
);

create index supervised_session_completions_event_idx on public.supervised_session_completions (timetable_event_id);
create index supervised_session_completions_trainee_idx on public.supervised_session_completions (trainee_id);

alter table public.supervised_session_completions enable row level security;

create policy "supervised_session_completions: trainee manages their own"
on public.supervised_session_completions for all
to authenticated
using (trainee_id = auth.uid())
with check (trainee_id = auth.uid());

create policy "supervised_session_completions: trainer/admin manage rows in their course"
on public.supervised_session_completions for all
to authenticated
using (
  (public.is_trainer() or public.is_admin())
  and exists (
    select 1 from public.course_timetable_events e
    where e.id = supervised_session_completions.timetable_event_id
      and e.course_id = public.current_course_id()
  )
)
with check (
  (public.is_trainer() or public.is_admin())
  and exists (
    select 1 from public.course_timetable_events e
    where e.id = supervised_session_completions.timetable_event_id
      and e.course_id = public.current_course_id()
  )
);
