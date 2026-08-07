-- for-claude-code.md item 5: "tutor_role is on profiles, not per course. A
-- tutor cannot be MCT on one course and TP tutor on another." Investigated
-- and confirmed the real problem is bigger than tutor_role's location: a
-- tutor's account is not designed to outlive a single course at all --
-- there is no "add an existing tutor to a new course" flow anywhere in the
-- app today (join/[token]/actions.ts only ever inserts a brand-new
-- profiles row). Ramy confirmed (2026-08-08) tutors should have one
-- persistent account across every course they work on.
--
-- This migration builds the additive, safe half of that: a real per-course
-- tutor record. It deliberately does NOT touch profiles.course_id or
-- profiles.tutor_role, and does NOT touch current_course_id()/is_trainer()
-- or any RLS policy that reads them -- those stay exactly as they are
-- today (a profile's course_id remains "the course this login is
-- currently scoped to", which is still correct and still what every
-- existing RLS policy needs). course_tutors is a second, richer,
-- multi-row source of truth layered on top, not a replacement.
--
-- Still needed as a follow-up, deliberately NOT built here: the actual
-- admin UI to search for an existing tutor (by email, within the centre)
-- and add them to a new course. That's real feature work -- it has to
-- decide what happens to a tutor's access to their OLD course when they're
-- added to a new one (immediately revoked, or left alone until that old
-- course closes out normally, which is probably right since by the time a
-- tutor moves on, the old course has usually already closed out and erased
-- its trainee data anyway) -- not something to guess at inside a schema
-- migration.
--
-- trainer_in_training is a boolean flag here, not a profiles.role enum
-- value. public.user_role is a native Postgres enum (trainee/trainer/
-- admin) -- ALTER TYPE ... ADD VALUE has real same-transaction caveats,
-- and a TinT is fundamentally "a trainer with an extra status on this
-- particular course" (Admin Handbook 2.4.4/2.4.5: they need a verification
-- date and a supervisor per course, not a different account type), so a
-- flag on the per-course row is both safer and a better fit than widening
-- the enum.

create table public.course_tutors (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  tutor_role text check (
    tutor_role in (
      'main_course_tutor',
      'assistant_course_tutor',
      'teaching_practice_tutor',
      'input_session_tutor',
      'external_assessor'
    )
  ),
  -- Trainer-in-training, Admin Handbook 2.4.4/2.4.5. verified_at must be
  -- set before is_trainer_in_training can be true -- training undertaken
  -- without prior Cambridge verification "will not be acknowledged", so
  -- the app should refuse to flag someone as training without a
  -- verification date on file, not just display a warning after the fact.
  is_trainer_in_training boolean not null default false,
  verified_at timestamptz,
  -- Whoever countersigns their work -- Handbook: "usually but not always
  -- the MCT". A named person on this row, not derived from course_tutors'
  -- own MCT row, since the two can genuinely differ.
  supervisor_profile_id uuid references public.profiles (id) on delete set null,
  joined_at timestamptz not null default now(),
  -- null = still active on this course. Left rather than deleted so a
  -- tutor's course history (and the "verified within the last 2 years"
  -- check) survives them moving on.
  left_at timestamptz,
  created_at timestamptz not null default now(),
  unique (course_id, profile_id),
  constraint course_tutors_tit_requires_verification check (
    not is_trainer_in_training or verified_at is not null
  )
);

create index course_tutors_course_id_idx on public.course_tutors (course_id);
create index course_tutors_profile_id_idx on public.course_tutors (profile_id);

-- One-off backfill: every trainer profile that exists today gets a
-- course_tutors row for their current course, carrying over their existing
-- tutor_role. This is what makes the new table a true superset of what
-- profiles already recorded, rather than starting empty.
insert into public.course_tutors (course_id, profile_id, tutor_role, joined_at)
select course_id, id, tutor_role, created_at
from public.profiles
where role = 'trainer' and course_id is not null
on conflict (course_id, profile_id) do nothing;

alter table public.course_tutors enable row level security;

create policy "course_tutors: trainer reads their course's tutor list"
on public.course_tutors for select
to authenticated
using (public.is_trainer() and course_id = public.current_course_id());

create policy "course_tutors: trainee reads their course's tutor list"
on public.course_tutors for select
to authenticated
using (course_id = public.current_course_id());

create policy "course_tutors: admin manages tutors in their center's courses"
on public.course_tutors for all
to authenticated
using (
  public.is_admin()
  and exists (select 1 from public.courses c where c.id = course_tutors.course_id and c.center_id = public.current_center_id())
)
with check (
  public.is_admin()
  and exists (select 1 from public.courses c where c.id = course_tutors.course_id and c.center_id = public.current_center_id())
);
