-- SS14 -- volunteer-student (TP student) register + tokenized link auth.
-- Volunteer students never get a real Supabase Auth account (per the
-- architecture plan's auth model: only trainee/trainer keep real login;
-- assessor/volunteer get tokenized, course-scoped, auto-expiring links).
-- course_access_tokens is that mechanism -- /student/[token] resolves a row
-- here via the admin client (no auth.uid() session exists for this path,
-- mirrors how /join/[token] already resolves course join tokens).

create table public.volunteer_students (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  removed_at timestamptz -- manual removal only (SS14.4), never auto-deleted
);

create index volunteer_students_course_id_idx on public.volunteer_students (course_id);

-- 'register_viewer' is a fourth link kind, distinct from the app's own
-- `admin` UserRole: it's for center business/admissions staff who have no
-- app account at all and aren't allowed on the course itself -- a
-- read-only, no-login link scoped to just the volunteer register
-- (name + attendance), not portfolio/trainee data.
create table public.course_access_tokens (
  token uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  role text not null check (role in ('volunteer_student', 'assessor', 'register_viewer')),
  volunteer_student_id uuid references public.volunteer_students (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint course_access_tokens_volunteer_scope check (
    (role = 'volunteer_student' and volunteer_student_id is not null)
    or (role in ('assessor', 'register_viewer') and volunteer_student_id is null)
  )
);

create index course_access_tokens_course_id_idx on public.course_access_tokens (course_id);

-- Attendance is tracked against TP-type timetable events (when volunteers
-- are actually in the room), not a separate ad-hoc schedule -- reuses
-- course_timetable_events (migration 0026) rather than inventing a second
-- notion of "session."
create table public.volunteer_attendance (
  id uuid primary key default gen_random_uuid(),
  volunteer_student_id uuid not null references public.volunteer_students (id) on delete cascade,
  timetable_event_id uuid not null references public.course_timetable_events (id) on delete cascade,
  marked_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (volunteer_student_id, timetable_event_id)
);

-- "Share with students" (SS7 addendum) fans a TP material out to the whole
-- volunteer register at once -- not per-individual targeting, so this is a
-- course-scoped list, not a join table against volunteer_students.
create table public.volunteer_shared_materials (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  tp_material_id uuid not null references public.tp_materials (id) on delete cascade,
  shared_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (course_id, tp_material_id)
);

create index volunteer_shared_materials_course_id_idx on public.volunteer_shared_materials (course_id);

alter table public.volunteer_students enable row level security;
alter table public.course_access_tokens enable row level security;
alter table public.volunteer_attendance enable row level security;
alter table public.volunteer_shared_materials enable row level security;

-- Trainer/admin manage their own course's register, tokens, attendance, and
-- shares. Volunteer/assessor readers never hold a Supabase session, so they
-- reach this data exclusively through the admin client after server-side
-- token validation -- no anon/authenticated SELECT policy is needed or
-- granted for those roles.

create policy "volunteer_students: trainer/admin manage their course"
on public.volunteer_students for all
to authenticated
using (
  (public.is_trainer() or public.is_admin())
  and course_id in (select id from public.courses where center_id = public.current_center_id())
)
with check (
  (public.is_trainer() or public.is_admin())
  and course_id in (select id from public.courses where center_id = public.current_center_id())
);

create policy "course_access_tokens: trainer/admin manage their course"
on public.course_access_tokens for all
to authenticated
using (
  (public.is_trainer() or public.is_admin())
  and course_id in (select id from public.courses where center_id = public.current_center_id())
)
with check (
  (public.is_trainer() or public.is_admin())
  and course_id in (select id from public.courses where center_id = public.current_center_id())
);

create policy "volunteer_attendance: trainer/admin manage their course"
on public.volunteer_attendance for all
to authenticated
using (
  (public.is_trainer() or public.is_admin())
  and volunteer_student_id in (
    select id from public.volunteer_students
    where course_id in (select id from public.courses where center_id = public.current_center_id())
  )
)
with check (
  (public.is_trainer() or public.is_admin())
  and volunteer_student_id in (
    select id from public.volunteer_students
    where course_id in (select id from public.courses where center_id = public.current_center_id())
  )
);

create policy "volunteer_shared_materials: trainer/admin manage their course"
on public.volunteer_shared_materials for all
to authenticated
using (
  (public.is_trainer() or public.is_admin())
  and course_id in (select id from public.courses where center_id = public.current_center_id())
)
with check (
  (public.is_trainer() or public.is_admin())
  and course_id in (select id from public.courses where center_id = public.current_center_id())
);
