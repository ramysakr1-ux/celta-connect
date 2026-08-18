-- Filmed observation -- group watch session (design_handoff_filmed_observation_
-- watch, written 18 Aug 2026). Models the actual watching experience for the
-- filmed-observation slots the timetable already schedules ("Filmed
-- observation 1-4/5", milestone events) -- previously nothing modeled how a
-- trainee got from the timetable to actually viewing the film. The existing
-- observations table (0006) stays the single source of truth for the 6-hour
-- requirement / 3-hour filmed cap (observation-hours.ts); this feature only
-- ever feeds it a real row, the same way observation_task_submissions (0101)
-- already does for directed observation tasks.
--
-- One watch session per timetable event (whole-cohort, not per TP
-- half/subgroup -- "Filmed observation N" milestones are single events, not
-- duplicated per half the way TP events are). The session is recorded/
-- persisted rather than a live-only broadcast: anyone who misses the
-- scheduled sitting can log in afterward and watch solo at their own pace,
-- same screen, same chat history visible read-only -- so nothing here gates
-- the observation hour on live attendance.
create table public.filmed_observation_sessions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  timetable_event_id uuid not null unique references public.course_timetable_events (id) on delete cascade,
  lesson_title text,
  recording_url text,
  length_minutes integer,
  -- Read-only context for the trainee's Task page header ("lesson title,
  -- level, learner count, length") -- about the recorded lesson, not the
  -- trainee's own attendance, so the trainer sets these, not the viewer.
  level text,
  learner_count integer,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on column public.filmed_observation_sessions.recording_url is
  'Trainer-supplied link to a licensed recording they hold rights to, or an internally-hosted file -- never fetched/embedded automatically by the system.';
comment on column public.filmed_observation_sessions.length_minutes is
  'Trainer-set expected length -- feeds the observations row a session creates on completion, same as the manual length field on a self-reported observation.';

create index filmed_observation_sessions_course_id_idx on public.filmed_observation_sessions (course_id);

-- Scheduled pause points baked into the recording. At each one, playback
-- auto-pauses and a discussion prompt shows with a countdown; "Resume now"
-- skips the wait.
create table public.filmed_observation_breaks (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.filmed_observation_sessions (id) on delete cascade,
  break_number smallint not null check (break_number > 0),
  timestamp_seconds integer not null check (timestamp_seconds >= 0),
  duration_seconds integer not null default 180 check (duration_seconds > 0),
  prompt text not null,
  unique (session_id, break_number)
);

-- Live group chat during the watch, visible read-only to a solo rewatcher
-- afterward -- no moderation modeled (spec flagged it as an open question;
-- every other chat surface in this app -- staff chat, course stream -- has
-- none either, so this matches the existing bar).
create table public.filmed_observation_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.filmed_observation_sessions (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index filmed_observation_messages_session_id_idx on public.filmed_observation_messages (session_id, created_at);

-- Trainer-authored per session (not AI-generated -- the spec's "generated
-- from that criterion, not fixed content" is read here as "varies per
-- session's linked criterion," same authored-per-instance shape peer
-- observation sheets already use for prompt_1/prompt_2). One task per
-- session.
create table public.filmed_observation_tasks (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.filmed_observation_sessions (id) on delete cascade,
  criteria_codes text[] not null default '{}',
  prompt_1 text not null,
  prompt_2 text not null,
  general_prompt text not null default 'What would you borrow for your own teaching?',
  rating_label text not null default 'Pace',
  rating_options text[] not null default array['Too slow', 'Just right', 'Too fast'],
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- One response per trainee per task. Autosaves continuously; "Mark as
-- complete" is the one explicit submission action -- it locks the row
-- (completed_at set) and creates the real observations row (filmed=true)
-- that observation-hours.ts actually reads, mirroring observation_task_
-- submissions' own observation_id link.
create table public.filmed_observation_task_responses (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.filmed_observation_tasks (id) on delete cascade,
  trainee_id uuid not null references public.profiles (id) on delete cascade,
  response_1 text,
  response_2 text,
  response_general text,
  rating text,
  -- [{ "timestamp_seconds": 145, "note": "..." }, ...] -- click a timestamp
  -- to jump the recording back to that point, same pattern as the filmed-row
  -- expansion on the existing Observations log.
  timestamped_notes jsonb not null default '[]'::jsonb,
  completed_at timestamptz,
  observation_id uuid references public.observations (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (task_id, trainee_id)
);

create trigger set_updated_at
  before update on public.filmed_observation_task_responses
  for each row execute function public.set_updated_at();

alter table public.filmed_observation_sessions enable row level security;
alter table public.filmed_observation_breaks enable row level security;
alter table public.filmed_observation_messages enable row level security;
alter table public.filmed_observation_tasks enable row level security;
alter table public.filmed_observation_task_responses enable row level security;

-- Sessions: trainer/admin author and manage; the whole cohort (trainer,
-- trainee, admin alike -- current_course_id() matches any profile whose own
-- course_id matches) can read, since every course member can end up
-- watching or rewatching.
create policy "filmed_observation_sessions: trainer manages their course's sessions"
on public.filmed_observation_sessions for all
to authenticated
using (public.is_trainer() and course_id = public.current_course_id())
with check (public.is_trainer() and course_id = public.current_course_id());

create policy "filmed_observation_sessions: admin manages their center's sessions"
on public.filmed_observation_sessions for all
to authenticated
using (public.is_admin() and course_id in (select id from public.courses where center_id = public.current_center_id()))
with check (public.is_admin() and course_id in (select id from public.courses where center_id = public.current_center_id()));

create policy "filmed_observation_sessions: cohort reads their course's sessions"
on public.filmed_observation_sessions for select
to authenticated
using (course_id = public.current_course_id());

-- Breaks: same shape, scoped through the parent session's course.
create policy "filmed_observation_breaks: trainer manages their course's breaks"
on public.filmed_observation_breaks for all
to authenticated
using (
  public.is_trainer()
  and session_id in (select id from public.filmed_observation_sessions where course_id = public.current_course_id())
)
with check (
  public.is_trainer()
  and session_id in (select id from public.filmed_observation_sessions where course_id = public.current_course_id())
);

create policy "filmed_observation_breaks: admin manages their center's breaks"
on public.filmed_observation_breaks for all
to authenticated
using (
  public.is_admin()
  and session_id in (
    select id from public.filmed_observation_sessions
    where course_id in (select id from public.courses where center_id = public.current_center_id())
  )
)
with check (
  public.is_admin()
  and session_id in (
    select id from public.filmed_observation_sessions
    where course_id in (select id from public.courses where center_id = public.current_center_id())
  )
);

create policy "filmed_observation_breaks: cohort reads their course's breaks"
on public.filmed_observation_breaks for select
to authenticated
using (session_id in (select id from public.filmed_observation_sessions where course_id = public.current_course_id()));

-- Messages: any cohort member reads and posts as themselves -- the group
-- chat is the one surface here that's genuinely open to trainees writing,
-- not just reading.
create policy "filmed_observation_messages: cohort reads their course's messages"
on public.filmed_observation_messages for select
to authenticated
using (session_id in (select id from public.filmed_observation_sessions where course_id = public.current_course_id()));

create policy "filmed_observation_messages: cohort posts as themselves"
on public.filmed_observation_messages for insert
to authenticated
with check (
  author_id = auth.uid()
  and session_id in (select id from public.filmed_observation_sessions where course_id = public.current_course_id())
);

-- Tasks: trainer/admin author; cohort reads.
create policy "filmed_observation_tasks: trainer manages their course's tasks"
on public.filmed_observation_tasks for all
to authenticated
using (
  public.is_trainer()
  and session_id in (select id from public.filmed_observation_sessions where course_id = public.current_course_id())
)
with check (
  public.is_trainer()
  and session_id in (select id from public.filmed_observation_sessions where course_id = public.current_course_id())
);

create policy "filmed_observation_tasks: admin manages their center's tasks"
on public.filmed_observation_tasks for all
to authenticated
using (
  public.is_admin()
  and session_id in (
    select id from public.filmed_observation_sessions
    where course_id in (select id from public.courses where center_id = public.current_center_id())
  )
)
with check (
  public.is_admin()
  and session_id in (
    select id from public.filmed_observation_sessions
    where course_id in (select id from public.courses where center_id = public.current_center_id())
  )
);

create policy "filmed_observation_tasks: cohort reads their course's tasks"
on public.filmed_observation_tasks for select
to authenticated
using (session_id in (select id from public.filmed_observation_sessions where course_id = public.current_course_id()));

-- Responses: trainee manages only their own row. Locked once completed_at is
-- set is enforced in the server action, not RLS -- the same trust boundary
-- every other autosave-then-lock form in this app uses (e.g. TP feedback).
create policy "filmed_observation_task_responses: trainee manages their own response"
on public.filmed_observation_task_responses for all
to authenticated
using (
  trainee_id = auth.uid()
  and task_id in (
    select t.id from public.filmed_observation_tasks t
    join public.filmed_observation_sessions s on s.id = t.session_id
    where s.course_id = public.current_course_id()
  )
)
with check (
  trainee_id = auth.uid()
  and task_id in (
    select t.id from public.filmed_observation_tasks t
    join public.filmed_observation_sessions s on s.id = t.session_id
    where s.course_id = public.current_course_id()
  )
);

create policy "filmed_observation_task_responses: trainer reads their course's responses"
on public.filmed_observation_task_responses for select
to authenticated
using (
  public.is_trainer()
  and task_id in (
    select t.id from public.filmed_observation_tasks t
    join public.filmed_observation_sessions s on s.id = t.session_id
    where s.course_id = public.current_course_id()
  )
);

create policy "filmed_observation_task_responses: admin reads their center's responses"
on public.filmed_observation_task_responses for select
to authenticated
using (
  public.is_admin()
  and task_id in (
    select t.id from public.filmed_observation_tasks t
    join public.filmed_observation_sessions s on s.id = t.session_id
    where s.course_id in (select id from public.courses where center_id = public.current_center_id())
  )
);
