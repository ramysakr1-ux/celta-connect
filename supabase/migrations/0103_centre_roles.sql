-- The Centre Admin role family, per for-claude-code-centre-admin-full.md:
-- Centre administrator, Centre manager, Course administrator, Centre owner.
-- Role names are kept exactly as the spec writes them.
--
-- Until now `profiles.role` has been a single flat 'admin' doing the work of
-- two roles the specs say must never be merged ("Centre Admin and Course Admin
-- are two separate roles with two separate logins... don't merge the two
-- builds"), which is why an admin signing in lands on a course-shaped screen.
--
-- A grant is (person, centre, role). That shape is what the spec's two
-- supported account shapes need -- "one login, roles combine" is several rows
-- for one person, "separate login per role" is rows on different people -- and
-- it is also what lets one person hold roles in two centres at once. Two
-- branches are two `centers` rows with two Cambridge centre numbers (a
-- Cambridge rule, confirmed by Ramy 2026-08-16), never one centre with
-- sub-entities: anything that merged them would eventually print the wrong
-- centre number on a report.

create table public.centre_roles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  center_id uuid not null references public.centers (id) on delete cascade,
  role text not null check (role in (
    'centre_administrator',
    'centre_manager',
    'course_administrator',
    'centre_owner'
  )),
  -- "Roles are invited, never self-selected -- the invitation itself carries
  -- the role; there is no screen anywhere that promotes an account." Recording
  -- who granted it is what makes that auditable after the fact.
  granted_by uuid references public.profiles (id),
  granted_at timestamptz not null default now(),
  -- Revoked rather than deleted, so "who could do what, when" survives someone
  -- leaving. Every read below filters on revoked_at is null.
  revoked_at timestamptz,
  unique (profile_id, center_id, role)
);
create index centre_roles_profile_id_idx on public.centre_roles (profile_id);
create index centre_roles_center_id_idx on public.centre_roles (center_id);

-- "Scope is a list of specific courses, not a date range or category... when
-- someone leaves, their courses are reassigned individually, on purpose, so
-- it's never silently orphaned." A list, exactly as written.
--
-- Course administrator additionally requires Cambridge approval (Ramy,
-- 2026-08-16: "has to be a Cambridge authorised person" -- in practice the
-- MCT, course coordinator, or a centre manager who is themselves a CELTA/Delta
-- trainer). The app already models that as a `course_tutors` row for the
-- course, carrying verified_at; no new approval column is invented here. The
-- permission layer requires both this scope row AND a course_tutors row.
create table public.course_administrator_scope (
  id uuid primary key default gen_random_uuid(),
  centre_role_id uuid not null references public.centre_roles (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  unique (centre_role_id, course_id)
);
create index course_administrator_scope_course_id_idx on public.course_administrator_scope (course_id);

-- "Every owner action leaves a digital footprint (who, what, when) -- visible
-- logging, not silent senior access." Ramy 2026-08-16 sharpened what the owner
-- may do into three separate rules: read-only on course administration; NO
-- access to the course itself without an invite from the course MCT; and free
-- to intervene on everything else, logged. This table is the third rule's
-- footprint.
create table public.centre_owner_actions (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers (id) on delete cascade,
  actor_profile_id uuid not null references public.profiles (id),
  action text not null,
  target_table text,
  target_id uuid,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index centre_owner_actions_center_id_idx on public.centre_owner_actions (center_id, created_at desc);

-- Which centre this person is currently acting in. profiles.center_id stays
-- their home centre and is unchanged, so a single-centre person behaves
-- exactly as before. Only the switcher writes this.
alter table public.profiles add column active_center_id uuid references public.centers (id) on delete set null;

-- 153 RLS policy references across 33 migrations resolve "my centre" through
-- this one function, so changing it here carries all of them without a single
-- policy being rewritten.
--
-- The active centre is honoured ONLY when a live role grant backs it (or it is
-- simply the person's home centre). That way active_center_id is a preference,
-- never an authority: setting it to a centre you hold nothing in grants
-- nothing and falls back to home.
create or replace function public.current_center_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select p.active_center_id
      from public.profiles p
      where p.id = auth.uid()
        and p.active_center_id is not null
        and (
          p.active_center_id = p.center_id
          or exists (
            select 1 from public.centre_roles r
            where r.profile_id = p.id
              and r.center_id = p.active_center_id
              and r.revoked_at is null
          )
        )
    ),
    (select p2.center_id from public.profiles p2 where p2.id = auth.uid())
  );
$$;

-- Every centre this person may switch into, for the switcher's own list.
create or replace function public.my_center_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.center_id from public.profiles p where p.id = auth.uid() and p.center_id is not null
  union
  select r.center_id from public.centre_roles r where r.profile_id = auth.uid() and r.revoked_at is null;
$$;

-- Does the caller hold this role in the centre they're currently acting in?
create or replace function public.has_centre_role(target_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.centre_roles r
    where r.profile_id = auth.uid()
      and r.role = target_role
      and r.revoked_at is null
      and r.center_id = public.current_center_id()
  );
$$;

alter table public.centre_roles enable row level security;
alter table public.course_administrator_scope enable row level security;
alter table public.centre_owner_actions enable row level security;

-- NOTE: these policies deliberately do NOT call current_center_id() or
-- has_centre_role(), because both read centre_roles -- a policy on this table
-- that called them would recurse. Same trap migration 0010 had to fix for
-- staff_chat. They compare against the profile row directly instead.

create policy "centre_roles: you can see your own grants"
on public.centre_roles for select
to authenticated
using (profile_id = auth.uid());

-- Anyone administering a centre can see who holds what there. Reading the
-- roster of roles is not itself a privileged action -- the spec's whole point
-- is that access is legible, not secret.
create policy "centre_roles: admins see grants in their own centre"
on public.centre_roles for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.center_id = centre_roles.center_id
  )
);

-- "Appoint and remove administrators" is a Centre owner power in the spec, and
-- roles are invited rather than self-selected -- so no INSERT/UPDATE/DELETE
-- policy is granted to anyone here. Granting runs server-side through the
-- admin client after the action checks the caller is an owner, the same
-- pattern applicants already uses (migration 0081). A self-service policy is
-- exactly what "no screen anywhere promotes an account" forbids.

create policy "course_administrator_scope: visible with its grant"
on public.course_administrator_scope for select
to authenticated
using (
  exists (
    select 1 from public.centre_roles r
    where r.id = course_administrator_scope.centre_role_id
      and (
        r.profile_id = auth.uid()
        or exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role = 'admin' and p.center_id = r.center_id
        )
      )
  )
);

-- The footprint is meant to be seen -- "visible logging, not silent senior
-- access" -- so anyone administering the centre can read it. Nobody can write
-- it from a session: entries are made server-side by the action that did the
-- thing, so a log entry can never be forged or suppressed by its subject.
create policy "centre_owner_actions: readable inside the centre"
on public.centre_owner_actions for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.center_id = centre_owner_actions.center_id
  )
);
