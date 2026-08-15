-- Focus on the Learner -- pooled observation model, replacing the old
-- "profile one learner individually" version (src/lib/assignment-info.ts's
-- description, specs/build-spec.md's assignment-deadlines section). Every
-- candidate logs into one shared class_error_log; on the Day-10 divergence
-- session they claim specific problems from the pool via fol_claims,
-- server-validated (duplicate/category/evidence/vagueness), never
-- trainer-reviewed.
--
-- The "sign-up profile" (six written answers + audio recording) this spec
-- assumed already existed under admissions does not -- confirmed with Ramy
-- 2026-08-14 that it actually belongs to the volunteer-student sign-up flow
-- (Volunteer Sign-Up.dc.html, not yet built), so it's added here to
-- volunteer_students, the correct owner of that data, not applicants.

alter table public.volunteer_students
  add column signup_written_answers jsonb, -- [{question, answer}] x6, per Volunteer Sign-Up.dc.html screen 3/5
  add column signup_audio_url text, -- screen 4/5
  add column signup_completed_at timestamptz;

-- Split into its own table (not more columns on volunteer_students) so the
-- Day-10 gate can be a single, simple RLS policy on a narrow surface,
-- rather than needing column-level security on a table trainers already
-- read freely year-round.
create table public.volunteer_signup_profiles (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  volunteer_student_id uuid not null references public.volunteer_students (id) on delete cascade,
  written_answers jsonb not null default '[]', -- [{question, answer}] x6
  audio_url text,
  transcript text,
  transcript_generated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (volunteer_student_id)
);
create index volunteer_signup_profiles_course_id_idx on public.volunteer_signup_profiles (course_id);

-- "Every candidate contributes to one shared log" -- pooled, not
-- per-trainee. learner_id is a real register row, never free text, per
-- spec.
create table public.class_error_log (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  logged_by_candidate_id uuid not null references public.profiles (id) on delete cascade,
  learner_id uuid not null references public.volunteer_students (id) on delete cascade,
  tp_class text not null,
  tp_number smallint not null check (tp_number between 1 and 8),
  lesson_stage text,
  problem_type text not null check (problem_type in ('grammar', 'pronunciation')),
  note text not null,
  logged_at timestamptz not null default now()
);
create index class_error_log_course_id_idx on public.class_error_log (course_id);

-- "No two fol_claims rows in the same course with the same normalized
-- problem_description + problem_type" -- enforced as a real constraint,
-- not just app-level checking, via a case-insensitive/trimmed expression
-- index rather than a stored normalized column.
create table public.fol_claims (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  candidate_id uuid not null references public.profiles (id) on delete cascade,
  problem_type text not null check (problem_type in ('grammar', 'pronunciation')),
  problem_description text not null,
  source text not null check (source in ('pooled_log', 'signup_recording')),
  claimed_at timestamptz not null default now()
);
create unique index fol_claims_unique_problem_idx
  on public.fol_claims (course_id, problem_type, lower(trim(problem_description)));
create index fol_claims_course_id_idx on public.fol_claims (course_id);

-- Day-10 divergence-session gate: the 10th distinct timetabled date for a
-- course, compared against today. Returns false (not an error) when fewer
-- than 10 timetabled dates exist yet -- "before that date, candidates
-- should get nothing back if they try, not an error revealing it exists."
create function public.fol_divergence_session_reached(target_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select current_date >= tenth_day.event_date
      from (
        select distinct event_date
        from public.course_timetable_events
        where course_id = target_course_id
        order by event_date
        offset 9 limit 1
      ) tenth_day
    ),
    false
  );
$$;

-- ============================================================
-- RLS
-- ============================================================
alter table public.volunteer_signup_profiles enable row level security;
alter table public.class_error_log enable row level security;
alter table public.fol_claims enable row level security;

create policy "volunteer_signup_profiles: trainer/admin manage their course"
on public.volunteer_signup_profiles for all to authenticated
using ((public.is_admin() or public.is_trainer()) and course_id = public.current_course_id())
with check ((public.is_admin() or public.is_trainer()) and course_id = public.current_course_id());

-- The gate: a trainee only ever sees this row once the course has reached
-- its 10th timetabled day. No special-casing in app code needed -- the
-- query just returns nothing until then.
create policy "volunteer_signup_profiles: trainees view after divergence session"
on public.volunteer_signup_profiles for select to authenticated
using (
  public.current_role() = 'trainee'
  and course_id = public.current_course_id()
  and public.fol_divergence_session_reached(course_id)
);

-- Trainees need to pick a real learner from their TP class's register when
-- logging an observation -- volunteer_students had no trainee-facing SELECT
-- policy at all before this (only trainer/admin could read it).
create policy "volunteer_students: trainees view their course's register"
on public.volunteer_students for select to authenticated
using (public.current_role() = 'trainee' and course_id = public.current_course_id());

create policy "class_error_log: trainees log their own course's observations"
on public.class_error_log for insert to authenticated
with check (public.current_role() = 'trainee' and logged_by_candidate_id = auth.uid() and course_id = public.current_course_id());

-- "Visible to the whole cohort of 6" -- pooled read, not scoped to the
-- logging candidate.
create policy "class_error_log: course members view the pool"
on public.class_error_log for select to authenticated
using (course_id = public.current_course_id());

create policy "fol_claims: trainees claim for their own course"
on public.fol_claims for insert to authenticated
with check (public.current_role() = 'trainee' and candidate_id = auth.uid() and course_id = public.current_course_id());

-- "No visible 'who else claimed what'" -- a trainee sees only their own
-- claims; trainer/admin see all of them (needed for Day-12 marking
-- cross-check against class_error_log/transcripts).
create policy "fol_claims: trainees view their own"
on public.fol_claims for select to authenticated
using (public.current_role() = 'trainee' and candidate_id = auth.uid() and course_id = public.current_course_id());

create policy "fol_claims: trainer/admin view their course's"
on public.fol_claims for select to authenticated
using ((public.is_admin() or public.is_trainer()) and course_id = public.current_course_id());
