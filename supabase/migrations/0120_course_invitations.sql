-- Per-person course invitations.
--
-- Three things in the specs all need the same missing thing:
--
--   1. "A role is invited, never self-selected, and nothing in Connect
--      promotes an account on its own" (the getting-started letter). Today the
--      trainer join link is shared and the join form asks the arriving person
--      to choose their own tutor role -- the opposite of that rule.
--   2. The Invitations panel's usage count, "10 of 12 joined"
--      (for-claude-code-course-admin.md, screen 1b). A shared link cannot know
--      how many were invited, only how many arrived.
--   3. The roster's Joined / Invited pills, "deliberately distinguishable,
--      unlike an earlier build where an invited and joined person looked
--      identical" -- which requires knowing about someone before they arrive.
--
-- And Ramy, 2026-08-16, on the tutor role specifically: the invitation carries
-- it, "but there should be an option where the course admin can change that.
-- There's a possibility that the MCT can no longer work, and then the ACT
-- becomes the MCT."
--
-- The shared join links stay. They are how a cohort of candidates is let in
-- without typing twelve addresses, and nothing here removes them; this is the
-- named-invitation path alongside.

create table if not exists public.course_invitations (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  center_id uuid not null references public.centers (id) on delete cascade,

  email text not null,
  full_name text,

  -- Which door they come in by.
  role text not null check (role in ('trainee', 'trainer')),
  -- Only meaningful for trainers. Null is a real state: an invitation may
  -- deliberately not pin a role down yet.
  tutor_role text check (tutor_role is null or tutor_role in (
    'main_course_tutor',
    'assistant_course_tutor',
    'teaching_practice_tutor',
    'input_session_tutor',
    'external_assessor'
  )),

  -- Bound to the address, per the letter: "the invitation is bound to that
  -- address -- forwarding it doesn't work, by design."
  token text not null unique default encode(gen_random_bytes(24), 'hex'),

  invited_by uuid references public.profiles (id) on delete set null,
  invited_at timestamptz not null default now(),
  -- Set when they actually create their account. The gap between invited_at
  -- and this is what the roster's Invited pill is showing.
  accepted_at timestamptz,
  accepted_profile_id uuid references public.profiles (id) on delete set null,
  -- Revoked rather than deleted: who was invited and never came is worth
  -- being able to see.
  revoked_at timestamptz,

  -- One live invitation per address per course. A second invite to the same
  -- person should update the first, not sit beside it.
  unique (course_id, email)
);

create index if not exists course_invitations_course_idx
  on public.course_invitations (course_id)
  where accepted_at is null and revoked_at is null;

alter table public.course_invitations enable row level security;

-- Staff on the centre read them. The invited person does not need a policy:
-- they arrive holding a token and are resolved through the admin client
-- before any session exists.
drop policy if exists "course invitations: centre staff read" on public.course_invitations;
create policy "course invitations: centre staff read"
on public.course_invitations for select
to authenticated
using (center_id = public.current_center_id());

-- Only ONE main course tutor per course at a time.
--
-- The announcements rule reads it with maybeSingle(): "course-wide broadcast,
-- MCT only". Two MCT rows would make that query return an error rather than a
-- person, and the check fails OPEN -- so a course with two MCTs would silently
-- let every tutor broadcast. Reassigning the role has to move it, not add a
-- second one.
create unique index if not exists course_tutors_one_mct_idx
  on public.course_tutors (course_id)
  where tutor_role = 'main_course_tutor' and left_at is null;
