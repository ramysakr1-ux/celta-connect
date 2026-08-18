-- Trainer-in-Training (TinT) full portfolio workspace, per
-- specs/for-claude-code-trainer-in-training.md. Confirmed unbuilt per the
-- build audit: "Only the verification-date gate and supervisor countersign
-- exist (course_tutors.is_trainer_in_training/verified_at/
-- supervisor_profile_id, migration 0051). No scheme distinction,
-- headline-stats screen, 8-task checklist, Task Twelve/Thirteen docs,
-- 16-item Task Record, reflective essay, mode-shadow restriction,
-- blind-marking comparison, candidate disclosure, 2-year staleness flag,
-- extra assessor day, or double-marking exclusion." This migration builds
-- the whole workspace's data model.
--
-- Core principle carried through every table here: "the TinT has no
-- official capacity with candidates... no document a candidate relies on
-- ever carries the TinT's signature." Every table below is private
-- TinT+supervisor evidence -- no RLS policy anywhere grants a trainee role
-- access to any of it.

create table public.tit_records (
  id uuid primary key default gen_random_uuid(),
  course_tutors_id uuid not null unique references public.course_tutors (id) on delete cascade,
  -- "Required only when: the TinT trains on the External scheme, or the
  -- Internal scheme at a centre other than the one nominating them." A
  -- real, distinct fact the centre records -- not derivable from anything
  -- else in the schema.
  scheme text not null default 'internal' check (scheme in ('internal', 'external')),
  -- "A TinT is approved only for the mode(s) they trained in." Subset of
  -- f2f/online; a mixed-mode course with equal coverage of both qualifies
  -- for both, so this is a set, not a single value.
  modes_trained text[] not null default '{}',
  reflective_essay text,
  reflective_essay_submitted_at timestamptz,
  portfolio_submitted_at timestamptz,
  -- "Three possible outcomes... confirmed as Assistant Course Tutor (not
  -- yet Main Course Tutor); training extended; or not verified."
  outcome text check (outcome in ('confirmed_act', 'extended', 'not_verified')),
  outcome_decided_at timestamptz,
  outcome_note text,
  -- Screen 1c, external scheme (or internal-at-a-non-nominating-centre)
  -- only. "Connect prepares the day and the portfolio; it never produces
  -- or holds this report" -- so only booking/completion dates live here,
  -- never the Assessor Moderation Report itself.
  assessor_day_booked_at timestamptz,
  assessor_day_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tit_records_course_tutors_id_idx on public.tit_records (course_tutors_id);

-- 8 pre-course tasks (fixed list, Route One / Training and Development
-- programme -- the spec's own framing as "most common route"). task_key is
-- one of the 8 fixed keys the app seeds on TinT designation; free-standing
-- rows rather than 8 boolean columns so the list can be walked generically
-- in the UI.
create table public.tit_pre_course_tasks (
  id uuid primary key default gen_random_uuid(),
  tit_record_id uuid not null references public.tit_records (id) on delete cascade,
  task_key text not null,
  completed_at timestamptz,
  unique (tit_record_id, task_key)
);
create index tit_pre_course_tasks_tit_record_id_idx on public.tit_pre_course_tasks (tit_record_id);

-- Input sessions and TP(+feedback) the TinT observed. Headline stats ("%
-- of input observed", "% of TP/feedback observed", both must reach 80%)
-- are computed against the course's real course_timetable_events counts at
-- read time, never stored as a percentage -- same "derived, not stored"
-- principle rotation.ts already uses for TP dates.
create table public.tit_observed_sessions (
  id uuid primary key default gen_random_uuid(),
  tit_record_id uuid not null references public.tit_records (id) on delete cascade,
  timetable_event_id uuid not null references public.course_timetable_events (id) on delete cascade,
  -- "Input can be up to 10% asynchronous; TP/feedback never can be."
  -- Nothing else in the timetable model represents "watched a recording
  -- rather than sat in," so this is its own explicit flag.
  asynchronous boolean not null default false,
  observed_at timestamptz not null default now(),
  unique (tit_record_id, timetable_event_id)
);
create index tit_observed_sessions_tit_record_id_idx on public.tit_observed_sessions (tit_record_id);

-- Task Twelve Stage 1: pre-session handouts for TWO EXISTING sessions
-- (taught by other tutors) -- the TinT designs prep material only, never
-- the session itself.
create table public.tit_task12_stage1 (
  id uuid primary key default gen_random_uuid(),
  tit_record_id uuid not null references public.tit_records (id) on delete cascade,
  timetable_event_id uuid references public.course_timetable_events (id) on delete set null,
  handout_description text not null,
  filed_at timestamptz not null default now()
);
create index tit_task12_stage1_tit_record_id_idx on public.tit_task12_stage1 (tit_record_id);

-- Task Twelve Stage 2: minimum FOUR self-designed input sessions
-- delivered, "never reused from the centre's own Resource Hub library,"
-- each observed by the supervisor and producing two filed documents: the
-- TinT's own self-evaluation, and the supervisor's written feedback on
-- that specific session. Neither is countersigned or shown to candidates.
create table public.tit_delivered_sessions (
  id uuid primary key default gen_random_uuid(),
  tit_record_id uuid not null references public.tit_records (id) on delete cascade,
  title text not null,
  delivered_at date not null,
  self_evaluation text,
  self_evaluation_at timestamptz,
  supervisor_feedback text,
  supervisor_feedback_at timestamptz,
  created_at timestamptz not null default now()
);
create index tit_delivered_sessions_tit_record_id_idx on public.tit_delivered_sessions (tit_record_id);

-- TP feedback sessions the TinT conducted. Carries both Task Thirteen
-- documents: 1a4's private working copy (a draft assessment written
-- BEFORE seeing the supervisor's view, then discussed -- this never
-- reaches the candidate and carries no signature at all, existing purely
-- as evidence of how the TinT's judgement developed) and 1b2's separate
-- feedback-on-feedback (not what the feedback said, but how the TinT
-- delivered it -- discussed straight after each session, also private).
create table public.tit_feedback_sessions (
  id uuid primary key default gen_random_uuid(),
  tit_record_id uuid not null references public.tit_records (id) on delete cascade,
  trainee_id uuid references public.profiles (id) on delete set null,
  tp_number integer,
  conducted_at date not null,
  observed_by_supervisor boolean not null default false,
  -- 1a4
  private_draft text,
  supervisor_discussion_notes text,
  finalized_at timestamptz,
  -- 1b2
  feedback_on_feedback_notes text,
  feedback_on_feedback_at timestamptz,
  created_at timestamptz not null default now()
);
create index tit_feedback_sessions_tit_record_id_idx on public.tit_feedback_sessions (tit_record_id);

-- Two candidates followed start to end (confirmed against Task Nine: two,
-- not four), tracked via the Candidate Record CELTA 5 at beginning,
-- middle and end.
create table public.tit_candidates_followed (
  id uuid primary key default gen_random_uuid(),
  tit_record_id uuid not null references public.tit_records (id) on delete cascade,
  trainee_id uuid not null references public.profiles (id) on delete cascade,
  notes_beginning text,
  notes_middle text,
  notes_end text,
  unique (tit_record_id, trainee_id)
);
create index tit_candidates_followed_tit_record_id_idx on public.tit_candidates_followed (tit_record_id);

-- Shadow marking: a sample of assignments marked, always double-marked by
-- the supervisor.
create table public.tit_shadow_marking (
  id uuid primary key default gen_random_uuid(),
  tit_record_id uuid not null references public.tit_records (id) on delete cascade,
  assignment_id uuid references public.assignments (id) on delete set null,
  tit_grade text,
  supervisor_grade text,
  agreed boolean,
  marked_at timestamptz not null default now()
);
create index tit_shadow_marking_tit_record_id_idx on public.tit_shadow_marking (tit_record_id);

-- 16-item Task Record (Handbook Section 7), each task signed off by BOTH
-- the TinT and the supervisor. The handbook's own 16-item list isn't
-- reproduced in the design spec, so items are supervisor-labelled at
-- creation rather than hardcoded to an exact list this file doesn't give.
create table public.tit_task_record_items (
  id uuid primary key default gen_random_uuid(),
  tit_record_id uuid not null references public.tit_records (id) on delete cascade,
  item_number integer not null check (item_number between 1 and 16),
  label text not null default '',
  tit_signed_at timestamptz,
  supervisor_signed_at timestamptz,
  unique (tit_record_id, item_number)
);
create index tit_task_record_items_tit_record_id_idx on public.tit_task_record_items (tit_record_id);

alter table public.tit_records enable row level security;
alter table public.tit_pre_course_tasks enable row level security;
alter table public.tit_observed_sessions enable row level security;
alter table public.tit_task12_stage1 enable row level security;
alter table public.tit_delivered_sessions enable row level security;
alter table public.tit_feedback_sessions enable row level security;
alter table public.tit_candidates_followed enable row level security;
alter table public.tit_shadow_marking enable row level security;
alter table public.tit_task_record_items enable row level security;

-- Single access rule, shared by every table above: the TinT themselves,
-- their supervisor, or admin at the centre. Split into two functions
-- rather than one self-referencing tit_records lookup: a WITH CHECK on
-- tit_records' own INSERT can't safely re-query tit_records for the row
-- currently being inserted (visibility of an uncommitted row to a
-- sub-query run as part of evaluating its own INSERT's check is not
-- something to rely on), so the base function takes course_tutors_id
-- directly -- available straight off the new row's own column, no
-- self-lookup involved. Child tables' tit_record_id points at an ALREADY-
-- EXISTING parent row, so looking that parent's course_tutors_id up is
-- safe there.
create or replace function public.tit_can_access_course_tutor(target_course_tutors_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.course_tutors ct
    join public.courses c on c.id = ct.course_id
    where ct.id = target_course_tutors_id
      and (
        ct.profile_id = auth.uid()
        or ct.supervisor_profile_id = auth.uid()
        or exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role = 'admin' and p.center_id = c.center_id
        )
      )
  );
$$;

create or replace function public.tit_can_access(record_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.tit_can_access_course_tutor(
    (select course_tutors_id from public.tit_records where id = record_id)
  );
$$;

create policy "tit_records: TinT, supervisor and admin can access"
on public.tit_records for all
to authenticated
using (public.tit_can_access_course_tutor(course_tutors_id))
with check (public.tit_can_access_course_tutor(course_tutors_id));

create policy "tit_pre_course_tasks: same access as its record"
on public.tit_pre_course_tasks for all
to authenticated
using (public.tit_can_access(tit_record_id))
with check (public.tit_can_access(tit_record_id));

create policy "tit_observed_sessions: same access as its record"
on public.tit_observed_sessions for all
to authenticated
using (public.tit_can_access(tit_record_id))
with check (public.tit_can_access(tit_record_id));

create policy "tit_task12_stage1: same access as its record"
on public.tit_task12_stage1 for all
to authenticated
using (public.tit_can_access(tit_record_id))
with check (public.tit_can_access(tit_record_id));

create policy "tit_delivered_sessions: same access as its record"
on public.tit_delivered_sessions for all
to authenticated
using (public.tit_can_access(tit_record_id))
with check (public.tit_can_access(tit_record_id));

create policy "tit_feedback_sessions: same access as its record"
on public.tit_feedback_sessions for all
to authenticated
using (public.tit_can_access(tit_record_id))
with check (public.tit_can_access(tit_record_id));

create policy "tit_candidates_followed: same access as its record"
on public.tit_candidates_followed for all
to authenticated
using (public.tit_can_access(tit_record_id))
with check (public.tit_can_access(tit_record_id));

create policy "tit_shadow_marking: same access as its record"
on public.tit_shadow_marking for all
to authenticated
using (public.tit_can_access(tit_record_id))
with check (public.tit_can_access(tit_record_id));

create policy "tit_task_record_items: same access as its record"
on public.tit_task_record_items for all
to authenticated
using (public.tit_can_access(tit_record_id))
with check (public.tit_can_access(tit_record_id));
