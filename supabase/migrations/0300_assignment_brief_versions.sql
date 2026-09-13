-- A submitted assignment keeps the brief it was written against.
--
-- The bug this closes, found 13 Sep 2026 on the walkthrough course:
-- assignment_section_responses is keyed by section_key, and a brief's section
-- KEYS change whenever a centre edits its sections. Every answer and every
-- tutor comment already written against the old keys is then orphaned. The
-- assignment still opens; every section simply reads "(no response)". Thirty-
-- one submissions across two centres were in that state, silently, and any
-- centre editing a brief mid-course would do the same thing again.
--
-- Re-keying the old answers onto the new sections (scripts/realign-assignment-
-- responses.mjs) repairs the damage but is the wrong rule: a candidate's
-- submitted work is evidence, and evidence does not change its meaning
-- because somebody edited the question afterwards. Administration Handbook
-- June 2025 12.1.1 puts "the four completed written assignments marked by
-- course tutors (both first and resubmissions, where applicable)" in the
-- portfolio the assessor reads and Cambridge reviews.
--
-- So: every published version of a brief is kept, and a submission is stamped
-- with the version it answered. A candidate still writing always follows the
-- current brief; one who has handed in keeps theirs, marking and cover sheet
-- included.
--
-- Re-runnable.

create table if not exists public.assignment_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.assignment_templates(id) on delete cascade,
  center_id uuid not null references public.centers(id) on delete cascade,
  assignment_type text not null,
  -- 1, 2, 3 ... per template. The number a tutor would say out loud.
  version int not null,
  sections jsonb not null default '[]'::jsonb,
  format text not null default 'structured' check (format in ('prose', 'structured')),
  published_at timestamptz not null default now(),
  published_by uuid references public.profiles(id) on delete set null,
  unique (template_id, version)
);

create index if not exists assignment_template_versions_template_idx
  on public.assignment_template_versions (template_id, version desc);

alter table public.assignments
  -- Stamped when the candidate SUBMITS -- the moment the work becomes
  -- evidence. Null on a draft, which follows the current brief.
  add column if not exists template_version_id uuid references public.assignment_template_versions(id) on delete set null;

-- Seed version 1 from whatever each published brief says today, and stamp
-- every submission that already exists with it. Without this, every
-- assignment submitted before today would read as "no version" and fall back
-- to the current brief -- which is the behaviour being fixed.
insert into public.assignment_template_versions (template_id, center_id, assignment_type, version, sections, format, published_at)
select t.id, t.center_id, t.assignment_type, 1, t.sections, t.format, coalesce(t.published_at, t.created_at)
from public.assignment_templates t
where not exists (
  select 1 from public.assignment_template_versions v where v.template_id = t.id
);

-- The candidate's centre is looked up in the WHERE, not joined in the FROM:
-- an UPDATE ... FROM cannot reference the update target from inside a join
-- condition ("there is an entry for table a, but it cannot be referenced from
-- this part of the query").
update public.assignments a
set template_version_id = v.id
from public.assignment_template_versions v
join public.assignment_templates t on t.id = v.template_id
where a.template_version_id is null
  and a.first_status <> 'not_submitted'
  and v.version = 1
  and t.assignment_type = a.assignment_type
  and t.center_id = (select p.center_id from public.profiles p where p.id = a.trainee_id);

alter table public.assignment_template_versions enable row level security;

-- Read is as wide as the brief itself: a candidate reads the version they
-- answered, a tutor reads any version at their centre, and the assessor's
-- own client is service-role. There is deliberately no insert/update/delete
-- policy -- versions are written by the publish action, and a published
-- version is never edited or deleted. That is the whole point of it.
drop policy if exists "assignment_template_versions: centre members read" on public.assignment_template_versions;
create policy "assignment_template_versions: centre members read"
on public.assignment_template_versions for select
to authenticated
using (
  center_id in (
    select p.center_id from public.profiles p where p.id = (select auth.uid())
    union
    select r.center_id from public.centre_roles r
      where r.profile_id = (select auth.uid()) and r.revoked_at is null
  )
);

notify pgrst, 'reload schema';

-- Proof it ran.
select
  to_regclass('public.assignment_template_versions') as versions_table,
  (select count(*) from public.assignment_template_versions) as versions_seeded,
  (select count(*) from public.assignments where template_version_id is not null) as submissions_stamped;
