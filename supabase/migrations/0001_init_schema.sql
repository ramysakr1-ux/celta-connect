-- Celta Connect: core schema, roles, and Row-Level Security
-- Step 1 of the phased build: centers -> courses -> profiles (3 roles),
-- plus the operational tables needed by the trainee/trainer dashboards,
-- TP Hub, and CELTA 5 record page (steps 2-4). Admissions/ATS tables are
-- deliberately deferred to the last build phase.

-- ============================================================
-- ENUMS
-- ============================================================

create type public.user_role as enum ('trainee', 'trainer', 'admin');

create type public.submission_status as enum (
  'not_submitted',
  'pending',
  'submitted',
  'resubmission_required',
  'approved'
);

create type public.criteria_status as enum ('not_yet_assessed', 'developing', 'met', 'not_met');

create type public.attendance_status as enum ('present', 'absent');

-- ============================================================
-- CENTERS  (top-level multi-tenant unit)
-- ============================================================

create table public.centers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  center_number text,
  logo_url text,
  primary_color text,
  accent_color text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- COURSES  (a single CELTA cohort/run within a center)
-- ============================================================

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers (id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  duplicated_from_course_id uuid references public.courses (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint courses_dates_check check (end_date >= start_date)
);

create index courses_center_id_idx on public.courses (center_id);

-- ============================================================
-- PROFILES  (one row per auth.users, carries role + tenancy)
-- ============================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null, -- must match passport name for trainees
  role public.user_role not null,
  center_id uuid not null references public.centers (id) on delete restrict,
  -- Admins may be scoped to a center without a single course (cross-course
  -- oversight); trainers/trainees belong to exactly one course.
  course_id uuid references public.courses (id) on delete set null,
  terms_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint profiles_course_required_for_trainer_trainee check (
    role = 'admin' or course_id is not null
  )
);

create index profiles_center_id_idx on public.profiles (center_id);
create index profiles_course_id_idx on public.profiles (course_id);

-- ============================================================
-- TPS  (Teaching Practice observations, TP1-TP8)
-- ============================================================

create table public.tps (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  trainee_id uuid not null references public.profiles (id) on delete cascade,
  trainer_id uuid references public.profiles (id) on delete set null,
  tp_number smallint not null check (tp_number between 1 and 8),
  lesson_type text,
  main_aim text,
  sub_aim text,
  stage_grades jsonb not null default '{}'::jsonb,
  observation_notes text,
  scheduled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trainee_id, tp_number)
);

create index tps_course_id_idx on public.tps (course_id);
create index tps_trainee_id_idx on public.tps (trainee_id);

-- ============================================================
-- ASSIGNMENTS  (written assignments: white box / resubmission box)
-- ============================================================

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  trainee_id uuid not null references public.profiles (id) on delete cascade,
  assignment_type text not null check (
    assignment_type in ('Focus on Learner', 'LRT', 'Skills', 'LfC')
  ),
  first_submission_url text,
  first_status public.submission_status not null default 'not_submitted',
  first_submitted_at timestamptz,
  resubmission_url text,
  resubmission_status public.submission_status not null default 'not_submitted',
  resubmission_submitted_at timestamptz,
  final_grade text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trainee_id, assignment_type)
);

create index assignments_course_id_idx on public.assignments (course_id);
create index assignments_trainee_id_idx on public.assignments (trainee_id);

-- ============================================================
-- CELTA5 MATRIX  (Cambridge criteria: 1d, 2a-2g, 3a-3b, 4b-4k, 5b-5m)
-- ============================================================

create table public.celta5_matrix (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  trainee_id uuid not null references public.profiles (id) on delete cascade,
  criteria_code text not null,
  status public.criteria_status not null default 'not_yet_assessed',
  tutor_comments text,
  tutorial_transcript_summary text,
  updated_at timestamptz not null default now(),
  unique (trainee_id, criteria_code)
);

create index celta5_matrix_course_id_idx on public.celta5_matrix (course_id);
create index celta5_matrix_trainee_id_idx on public.celta5_matrix (trainee_id);

-- ============================================================
-- ATTENDANCE
-- ============================================================

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  trainee_id uuid not null references public.profiles (id) on delete cascade,
  session_id text not null,
  join_timestamp timestamptz,
  status public.attendance_status not null default 'absent',
  created_at timestamptz not null default now()
);

create index attendance_course_id_idx on public.attendance (course_id);
create index attendance_trainee_id_idx on public.attendance (trainee_id);

-- ============================================================
-- FINANCES  (strict admin-only; trainer/trainee must have zero access)
-- ============================================================

create table public.finances (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  total_fee numeric(10, 2) not null default 0,
  amount_paid numeric(10, 2) not null default 0,
  balance_due numeric(10, 2) generated always as (total_fee - amount_paid) stored,
  payment_notes text,
  updated_at timestamptz not null default now(),
  unique (profile_id, course_id)
);

-- ============================================================
-- RESOURCES  (Resource Hub: per-center assignment briefs/templates)
-- ============================================================

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers (id) on delete cascade,
  course_id uuid references public.courses (id) on delete cascade, -- null = shared across the center
  title text not null,
  file_url text not null,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index resources_center_id_idx on public.resources (center_id);

-- ============================================================
-- HELPER FUNCTIONS (security definer to avoid RLS recursion on profiles)
-- ============================================================

create function public.current_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create function public.current_center_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select center_id from public.profiles where id = auth.uid();
$$;

create function public.current_course_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select course_id from public.profiles where id = auth.uid();
$$;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role() = 'admin';
$$;

create function public.is_trainer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role() = 'trainer';
$$;

-- ============================================================
-- ROW-LEVEL SECURITY
-- ============================================================

alter table public.centers enable row level security;
alter table public.courses enable row level security;
alter table public.profiles enable row level security;
alter table public.tps enable row level security;
alter table public.assignments enable row level security;
alter table public.celta5_matrix enable row level security;
alter table public.attendance enable row level security;
alter table public.finances enable row level security;
alter table public.resources enable row level security;

-- ---------- centers ----------

create policy "centers: members can read their own center"
on public.centers for select
to authenticated
using (id = public.current_center_id());

create policy "centers: admins can update their own center"
on public.centers for update
to authenticated
using (id = public.current_center_id() and public.is_admin());

-- ---------- courses ----------

create policy "courses: members can read courses in their center"
on public.courses for select
to authenticated
using (center_id = public.current_center_id());

create policy "courses: admins manage courses in their center"
on public.courses for all
to authenticated
using (center_id = public.current_center_id() and public.is_admin())
with check (center_id = public.current_center_id() and public.is_admin());

-- ---------- profiles ----------

create policy "profiles: users can read their own profile"
on public.profiles for select
to authenticated
using (id = auth.uid());

create policy "profiles: trainers can read trainees in their course"
on public.profiles for select
to authenticated
using (
  public.is_trainer()
  and role = 'trainee'
  and course_id = public.current_course_id()
);

create policy "profiles: admins can read everyone in their center"
on public.profiles for select
to authenticated
using (public.is_admin() and center_id = public.current_center_id());

create policy "profiles: admins manage everyone in their center"
on public.profiles for all
to authenticated
using (public.is_admin() and center_id = public.current_center_id())
with check (public.is_admin() and center_id = public.current_center_id());

create policy "profiles: users can update their own onboarding fields"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- ---------- tps ----------

create policy "tps: trainee can read their own TPs"
on public.tps for select
to authenticated
using (trainee_id = auth.uid());

create policy "tps: trainer/admin can read TPs in their course"
on public.tps for select
to authenticated
using (
  (public.is_trainer() or public.is_admin())
  and course_id = public.current_course_id()
);

create policy "tps: trainer/admin manage TPs in their course"
on public.tps for all
to authenticated
using (
  (public.is_trainer() or public.is_admin())
  and course_id = public.current_course_id()
)
with check (
  (public.is_trainer() or public.is_admin())
  and course_id = public.current_course_id()
);

-- ---------- assignments ----------

create policy "assignments: trainee can read their own assignments"
on public.assignments for select
to authenticated
using (trainee_id = auth.uid());

create policy "assignments: trainee can submit their own work"
on public.assignments for update
to authenticated
using (trainee_id = auth.uid())
with check (trainee_id = auth.uid());

create policy "assignments: trainer/admin can read assignments in their course"
on public.assignments for select
to authenticated
using (
  (public.is_trainer() or public.is_admin())
  and course_id = public.current_course_id()
);

create policy "assignments: trainer/admin manage assignments in their course"
on public.assignments for all
to authenticated
using (
  (public.is_trainer() or public.is_admin())
  and course_id = public.current_course_id()
)
with check (
  (public.is_trainer() or public.is_admin())
  and course_id = public.current_course_id()
);

-- ---------- celta5_matrix ----------

create policy "celta5: trainee can read their own matrix"
on public.celta5_matrix for select
to authenticated
using (trainee_id = auth.uid());

create policy "celta5: trainer/admin manage matrix in their course"
on public.celta5_matrix for all
to authenticated
using (
  (public.is_trainer() or public.is_admin())
  and course_id = public.current_course_id()
)
with check (
  (public.is_trainer() or public.is_admin())
  and course_id = public.current_course_id()
);

-- ---------- attendance ----------

create policy "attendance: trainee can read their own attendance"
on public.attendance for select
to authenticated
using (trainee_id = auth.uid());

create policy "attendance: trainer/admin manage attendance in their course"
on public.attendance for all
to authenticated
using (
  (public.is_trainer() or public.is_admin())
  and course_id = public.current_course_id()
)
with check (
  (public.is_trainer() or public.is_admin())
  and course_id = public.current_course_id()
);

-- ---------- finances (admin-only, full stop) ----------

create policy "finances: admins only, scoped to their center"
on public.finances for all
to authenticated
using (
  public.is_admin()
  and course_id in (
    select id from public.courses where center_id = public.current_center_id()
  )
)
with check (
  public.is_admin()
  and course_id in (
    select id from public.courses where center_id = public.current_center_id()
  )
);

-- No policy is created for 'trainer' or 'trainee' -- RLS defaults to deny,
-- so those roles have zero access to this table, matching the spec.

-- ---------- resources ----------

create policy "resources: members can read resources in their center"
on public.resources for select
to authenticated
using (center_id = public.current_center_id());

create policy "resources: trainer/admin manage resources in their center"
on public.resources for all
to authenticated
using (
  (public.is_trainer() or public.is_admin())
  and center_id = public.current_center_id()
)
with check (
  (public.is_trainer() or public.is_admin())
  and center_id = public.current_center_id()
);

-- ============================================================
-- updated_at maintenance
-- ============================================================

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.tps
for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.assignments
for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.celta5_matrix
for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.finances
for each row execute function public.set_updated_at();
