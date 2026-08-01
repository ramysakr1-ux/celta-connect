-- Full rebuild of the CELTA 5 model to match the real Cambridge CELTA 5
-- Candidate Record Booklet (CELTA5: July 2023), instead of the simplified
-- version originally guessed at. No real trainee data exists yet, so old
-- tables are dropped and recreated rather than altered in place.

-- ============================================================
-- DROP OBSOLETE TABLES
-- ============================================================

drop table if exists public.tps cascade;
drop table if exists public.attendance cascade;
drop table if exists public.celta5_matrix cascade;
drop table if exists public.celta5_records cascade;

-- ============================================================
-- ENUMS
-- ============================================================

create type public.criteria_rating as enum ('S+', 'S', 'N', 'X');
create type public.standard_rating as enum ('above_standard', 'to_standard', 'not_to_standard');
create type public.pass_fail as enum ('pass', 'fail');

-- ============================================================
-- COURSES: total_hours (booklet default 120)
-- ============================================================

alter table public.courses add column total_hours numeric(6, 1) not null default 120;

-- ============================================================
-- TP_LESSONS  (open log of taught lessons, replacing fixed TP1-8)
-- ============================================================

create table public.tp_lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  trainee_id uuid not null references public.profiles (id) on delete cascade,
  trainer_id uuid references public.profiles (id) on delete set null,
  lesson_date date,
  length_minutes integer,
  level text,
  learner_count integer,
  lesson_focus text,
  tutor_assessment public.standard_rating,
  tutor_comments text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tp_lessons_course_id_idx on public.tp_lessons (course_id);
create index tp_lessons_trainee_id_idx on public.tp_lessons (trainee_id);

alter table public.tp_lessons enable row level security;

create policy "tp_lessons: trainee can read their own lessons"
on public.tp_lessons for select
to authenticated
using (trainee_id = auth.uid());

create policy "tp_lessons: trainer manages lessons in their course"
on public.tp_lessons for all
to authenticated
using (public.is_trainer() and course_id = public.current_course_id())
with check (public.is_trainer() and course_id = public.current_course_id());

create policy "tp_lessons: admin manages lessons in their center"
on public.tp_lessons for all
to authenticated
using (
  public.is_admin()
  and course_id in (select id from public.courses where center_id = public.current_center_id())
)
with check (
  public.is_admin()
  and course_id in (select id from public.courses where center_id = public.current_center_id())
);

create trigger set_updated_at before update on public.tp_lessons
for each row execute function public.set_updated_at();

-- ============================================================
-- OBSERVATIONS  (Record of Observations of Experienced Teachers)
-- Self-reported by the trainee; trainer/admin can view and manage.
-- ============================================================

create table public.observations (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  trainee_id uuid not null references public.profiles (id) on delete cascade,
  observation_date date,
  length_minutes integer,
  level text,
  learners_present integer,
  lesson_focus text,
  filmed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index observations_course_id_idx on public.observations (course_id);
create index observations_trainee_id_idx on public.observations (trainee_id);

alter table public.observations enable row level security;

create policy "observations: trainee manages their own observations"
on public.observations for all
to authenticated
using (trainee_id = auth.uid())
with check (trainee_id = auth.uid());

create policy "observations: trainer can read observations in their course"
on public.observations for select
to authenticated
using (public.is_trainer() and course_id = public.current_course_id());

create policy "observations: admin can read observations in their center"
on public.observations for select
to authenticated
using (
  public.is_admin()
  and course_id in (select id from public.courses where center_id = public.current_center_id())
);

create trigger set_updated_at before update on public.observations
for each row execute function public.set_updated_at();

-- ============================================================
-- ATTENDANCE_ABSENCES  (simple absence log; hours_attended lives on
-- celta5_records as a single running total, per the booklet)
-- ============================================================

create table public.attendance_absences (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  trainee_id uuid not null references public.profiles (id) on delete cascade,
  session_date date,
  category text not null check (category in ('unavoidable', 'other')),
  reason text,
  work_made_up text,
  tutor_comment text,
  created_at timestamptz not null default now()
);

create index attendance_absences_course_id_idx on public.attendance_absences (course_id);
create index attendance_absences_trainee_id_idx on public.attendance_absences (trainee_id);

alter table public.attendance_absences enable row level security;

create policy "attendance_absences: trainee can read their own absences"
on public.attendance_absences for select
to authenticated
using (trainee_id = auth.uid());

create policy "attendance_absences: trainer manages absences in their course"
on public.attendance_absences for all
to authenticated
using (public.is_trainer() and course_id = public.current_course_id())
with check (public.is_trainer() and course_id = public.current_course_id());

create policy "attendance_absences: admin manages absences in their center"
on public.attendance_absences for all
to authenticated
using (
  public.is_admin()
  and course_id in (select id from public.courses where center_id = public.current_center_id())
)
with check (
  public.is_admin()
  and course_id in (select id from public.courses where center_id = public.current_center_id())
);

-- ============================================================
-- CELTA5_MATRIX  (per-criterion: candidate self-rating + tutor ratings,
-- split by stage since Stage 3 has no candidate column)
-- ============================================================

create table public.celta5_matrix (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  trainee_id uuid not null references public.profiles (id) on delete cascade,
  criteria_code text not null,
  candidate_status public.criteria_rating,
  tutor_status_stage2 public.criteria_rating,
  tutor_comments_stage2 text,
  tutor_status_stage3 public.criteria_rating,
  tutor_comments_stage3 text,
  updated_at timestamptz not null default now(),
  unique (trainee_id, criteria_code)
);

create index celta5_matrix_course_id_idx on public.celta5_matrix (course_id);
create index celta5_matrix_trainee_id_idx on public.celta5_matrix (trainee_id);

alter table public.celta5_matrix enable row level security;

-- No trainee SELECT policy here on purpose: trainees read their own matrix
-- exclusively through the get_my_celta5_matrix() function below, which
-- masks tutor_status_stage2/3 and tutor_comments_stage2/3 until the
-- corresponding stage is unlocked. Granting a direct policy here would let
-- a trainee query the raw table via the API and see tutor ratings early.

create policy "celta5_matrix: trainer manages matrix in their course"
on public.celta5_matrix for all
to authenticated
using (public.is_trainer() and course_id = public.current_course_id())
with check (public.is_trainer() and course_id = public.current_course_id());

create policy "celta5_matrix: admin manages matrix in their center"
on public.celta5_matrix for all
to authenticated
using (
  public.is_admin()
  and course_id in (select id from public.courses where center_id = public.current_center_id())
)
with check (
  public.is_admin()
  and course_id in (select id from public.courses where center_id = public.current_center_id())
);

create trigger set_updated_at before update on public.celta5_matrix
for each row execute function public.set_updated_at();

-- ============================================================
-- CELTA5_RECORDS  (course-level: Stage 1/2/3 + final grade)
-- ============================================================

create table public.celta5_records (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  trainee_id uuid not null references public.profiles (id) on delete cascade,

  hours_attended numeric(6, 1),

  -- Stage One: tutor-only, first third of the course.
  stage1_tutorial_given boolean not null default false,
  stage1_hours_taught numeric(6, 1),
  stage1_strengths text,
  stage1_action_plan text,
  stage1_completed_at timestamptz,

  -- Stage Two: mid-course. Candidate self-assesses first and submits
  -- (locking their own answers and unlocking the tutor's ratings for
  -- them to see). Tutor fields are only ever exposed to the trainee via
  -- get_my_celta5_record() once stage2_candidate_submitted_at is set.
  stage2_tutorial_given boolean not null default false,
  stage2_hours_taught numeric(6, 1),

  stage2_candidate_submitted_at timestamptz,
  stage2_candidate_overall public.standard_rating,
  stage2_candidate_notes text,
  stage2_candidate_written_assignments_notes text,
  stage2_candidate_other_notes text,

  stage2_tutor_overall public.standard_rating,
  stage2_tutor_notes text,
  stage2_tutor_written_assignments_notes text,
  stage2_tutor_other_notes text,
  stage2_completed_at timestamptz,

  -- Stage Three: conditional (only for candidates below/stalled at Stage
  -- 2), tutor-only, no candidate self-assessment column in the booklet.
  stage3_required boolean not null default false,
  stage3_tutorial_given boolean not null default false,
  stage3_hours_taught numeric(6, 1),
  stage3_tutor_overall public.standard_rating,
  stage3_tutor_notes text,
  stage3_tutor_written_assignments_notes text,
  stage3_tutor_other_notes text,
  stage3_finalized_at timestamptz,

  final_recommended_grade text check (
    final_recommended_grade in ('Pass', 'Pass B', 'Pass A', 'Fail')
  ),
  overall_notes text,

  updated_at timestamptz not null default now(),
  unique (trainee_id)
);

create index celta5_records_course_id_idx on public.celta5_records (course_id);

alter table public.celta5_records enable row level security;

-- No trainee SELECT policy here either -- see get_my_celta5_record() below.

create policy "celta5_records: trainer manages records in their course"
on public.celta5_records for all
to authenticated
using (public.is_trainer() and course_id = public.current_course_id())
with check (public.is_trainer() and course_id = public.current_course_id());

create policy "celta5_records: admin manages records in their center"
on public.celta5_records for all
to authenticated
using (
  public.is_admin()
  and course_id in (select id from public.courses where center_id = public.current_center_id())
)
with check (
  public.is_admin()
  and course_id in (select id from public.courses where center_id = public.current_center_id())
);

create trigger set_updated_at before update on public.celta5_records
for each row execute function public.set_updated_at();

-- Trainees update only their own self-assessment columns, via a
-- security-definer function (see below) rather than a direct RLS
-- policy, so the same statement can't accidentally also write to
-- tutor-owned columns.

-- ============================================================
-- MASKING FUNCTIONS (security definer: bypass RLS, enforce
-- trainee_id = auth.uid() manually, hide tutor fields until unlocked)
-- ============================================================

create function public.get_my_celta5_record()
returns public.celta5_records
language sql
stable
security definer
set search_path = public
as $$
  select
    id, course_id, trainee_id,
    hours_attended,
    stage1_tutorial_given, stage1_hours_taught, stage1_strengths,
    stage1_action_plan, stage1_completed_at,
    stage2_tutorial_given, stage2_hours_taught,
    stage2_candidate_submitted_at, stage2_candidate_overall,
    stage2_candidate_notes, stage2_candidate_written_assignments_notes,
    stage2_candidate_other_notes,
    case when stage2_candidate_submitted_at is not null then stage2_tutor_overall end,
    case when stage2_candidate_submitted_at is not null then stage2_tutor_notes end,
    case when stage2_candidate_submitted_at is not null then stage2_tutor_written_assignments_notes end,
    case when stage2_candidate_submitted_at is not null then stage2_tutor_other_notes end,
    case when stage2_candidate_submitted_at is not null then stage2_completed_at end,
    stage3_required, stage3_tutorial_given,
    case when stage3_finalized_at is not null then stage3_hours_taught end,
    case when stage3_finalized_at is not null then stage3_tutor_overall end,
    case when stage3_finalized_at is not null then stage3_tutor_notes end,
    case when stage3_finalized_at is not null then stage3_tutor_written_assignments_notes end,
    case when stage3_finalized_at is not null then stage3_tutor_other_notes end,
    stage3_finalized_at,
    final_recommended_grade, overall_notes, updated_at
  from public.celta5_records
  where trainee_id = auth.uid();
$$;

create function public.get_my_celta5_matrix()
returns setof public.celta5_matrix
language sql
stable
security definer
set search_path = public
as $$
  select
    m.id, m.course_id, m.trainee_id, m.criteria_code,
    m.candidate_status,
    case when r.stage2_candidate_submitted_at is not null then m.tutor_status_stage2 end,
    case when r.stage2_candidate_submitted_at is not null then m.tutor_comments_stage2 end,
    case when r.stage3_finalized_at is not null then m.tutor_status_stage3 end,
    case when r.stage3_finalized_at is not null then m.tutor_comments_stage3 end,
    m.updated_at
  from public.celta5_matrix m
  join public.celta5_records r on r.trainee_id = m.trainee_id
  where m.trainee_id = auth.uid();
$$;

-- ============================================================
-- ASSIGNMENTS: dual content/English sub-grades, per the booklet
-- ("marked for their content and their standard of English ... must
-- pass in both areas to be awarded an overall pass")
-- ============================================================

alter table public.assignments add column first_content_grade public.pass_fail;
alter table public.assignments add column first_english_grade public.pass_fail;
alter table public.assignments add column resubmission_content_grade public.pass_fail;
alter table public.assignments add column resubmission_english_grade public.pass_fail;

-- Candidate self-assessment submission: sets candidate_status per
-- criterion and, when submitting, locks in stage2_candidate_submitted_at.
-- Security definer so it can write despite there being no direct trainee
-- UPDATE policy on celta5_matrix/celta5_records.

create function public.submit_stage2_self_assessment(
  ratings jsonb, -- e.g. '{"1a": "S", "1b": "S+"}'
  overall public.standard_rating,
  notes text,
  written_assignments_notes text,
  other_notes text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  code text;
begin
  if not exists (select 1 from public.celta5_records where trainee_id = auth.uid()) then
    raise exception 'No CELTA 5 record found for this user.';
  end if;

  for code in select jsonb_object_keys(ratings) loop
    update public.celta5_matrix
    set candidate_status = (ratings ->> code)::public.criteria_rating
    where trainee_id = auth.uid() and criteria_code = code;
  end loop;

  update public.celta5_records
  set
    stage2_candidate_overall = overall,
    stage2_candidate_notes = notes,
    stage2_candidate_written_assignments_notes = written_assignments_notes,
    stage2_candidate_other_notes = other_notes,
    stage2_candidate_submitted_at = now()
  where trainee_id = auth.uid();
end;
$$;
