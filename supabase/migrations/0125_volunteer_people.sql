-- Volunteer identity across courses. Every volunteer signup today creates a
-- brand-new volunteer_students row scoped to one course, with no way to know
-- the same human volunteered on an earlier course too -- so "hours toward
-- certificate, accumulated across every course" (for-claude-code-centre-admin-full.md)
-- was impossible to compute. Ramy, 2026-08-17: auto-match on email when it's
-- on file (rare -- most signups have none), otherwise an admin links two
-- records manually from the Volunteer pool screen. Never auto-match on name
-- alone -- a wrong merge would silently combine two different people's hours
-- into one certificate total.

create table if not exists public.volunteer_people (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers (id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

-- Partial (email is optional): only rows that DO have an email need to be
-- unique per centre, so the auto-match lookup has exactly one candidate.
create unique index if not exists volunteer_people_center_email_idx
  on public.volunteer_people (center_id, email) where email is not null;

alter table public.volunteer_students
  add column if not exists volunteer_person_id uuid references public.volunteer_people (id) on delete set null;

create index if not exists volunteer_students_person_idx on public.volunteer_students (volunteer_person_id);

alter table public.volunteer_people enable row level security;

drop policy if exists "volunteer_people: trainer/admin manage their centre" on public.volunteer_people;
create policy "volunteer_people: trainer/admin manage their centre"
on public.volunteer_people for all
to authenticated
using ((public.is_trainer() or public.is_admin()) and center_id = public.current_center_id())
with check ((public.is_trainer() or public.is_admin()) and center_id = public.current_center_id());
