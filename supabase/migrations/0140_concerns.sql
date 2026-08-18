-- Enrolment Forms.dc.html 1c, "Raising a concern -- the internal complaints
-- route": Admin Handbook is explicit that an internal complaints procedure
-- must include final recourse to someone other than the tutors -- a
-- candidate who can only tell their assessor is not being offered one.
-- "CELTA is short and intensive, so a problem left for a week is a problem
-- that has already affected your course. Say it early."
create table public.concerns (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  trainee_id uuid not null references public.profiles (id) on delete cascade,
  route text not null check (route in ('tutor', 'mct', 'manager')),
  body text not null,
  -- "Anonymity is offered, not assumed... it should be honest about its
  -- limits rather than promising more than it can deliver." Enforced at the
  -- application layer, not RLS -- the staff-facing views simply never
  -- render trainee_id/name when this is true, same trust-boundary pattern
  -- this app already uses elsewhere (e.g. individual_tutorial_invites'
  -- narrow confirmed_at-only update). The trainee's own view of their own
  -- submission is unaffected -- anonymity is about what staff see, not
  -- about hiding it from the person who sent it.
  anonymous boolean not null default false,
  response text,
  responded_at timestamptz,
  responded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index concerns_course_id_idx on public.concerns (course_id);

alter table public.concerns enable row level security;

-- Course-wide staff visibility, same granularity as every other staff-
-- facing table in this app (RLS routes on course membership, not on which
-- of the three named recipients a concern happens to be addressed to --
-- "the centre replies to every concern," not one gatekept individual).
create policy "concerns: trainer manages their course's concerns"
on public.concerns for all
to authenticated
using (public.is_trainer() and course_id = public.current_course_id())
with check (public.is_trainer() and course_id = public.current_course_id());

create policy "concerns: admin manages their center's concerns"
on public.concerns for all
to authenticated
using (public.is_admin() and course_id in (select id from public.courses where center_id = public.current_center_id()))
with check (public.is_admin() and course_id in (select id from public.courses where center_id = public.current_center_id()));

create policy "concerns: trainee reads and creates their own"
on public.concerns for select
to authenticated
using (trainee_id = auth.uid());

create policy "concerns: trainee submits their own"
on public.concerns for insert
to authenticated
with check (trainee_id = auth.uid() and course_id = public.current_course_id());
