-- build-spec.md §13 and §14.
--
-- §13: "Optional tier above the centre. A single-centre customer never sees
-- it." Hence organisation_id is nullable and nothing requires it.
--
-- "**A branch is a centre, not a folder.** Cambridge approval is per centre --
-- each branch has its own approval number, assessor visits and Centre Grade
-- Approval forms. Courses, grades and the assessor pack stay centre-scoped
-- however large the organisation." So this adds a grouping ABOVE centres and
-- changes nothing below them.

create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.centers add column organisation_id uuid references public.organisations (id) on delete set null;
create index centers_organisation_id_idx on public.centers (organisation_id);

-- §13: "The organisation owner sees every branch's pipeline, enrolment and
-- completion, and appoints the centre owner at each branch. **That is all.** No
-- course chat, no grading, and no automatic admin rights inside a branch -- to
-- act at Istanbul they are made a centre admin at Istanbul, and the
-- attribution says so."
--
-- Deliberately its own table rather than a fifth centre_roles value: this role
-- is not scoped to a centre, and putting it there would make "every centre
-- role I hold" silently include something that grants nothing inside any
-- centre.
create table public.organisation_roles (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('organisation_owner')),
  granted_by uuid references public.profiles (id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (organisation_id, profile_id, role)
);
create index organisation_roles_profile_id_idx on public.organisation_roles (profile_id);

-- §14, candidate referral. "A referral is **not a re-application**. Everything
-- the candidate has done moves with them."
--
-- The originating record STAYS and is marked referred out -- "so its conversion
-- figures are not flattered by people who went elsewhere in the family" -- and
-- a new record is created at the receiving branch carrying the application,
-- the task and its mark, the interview notes and the pipeline position.
alter table public.applicants add column referred_to_center_id uuid references public.centers (id) on delete set null;
alter table public.applicants add column referred_from_applicant_id uuid references public.applicants (id) on delete set null;
alter table public.applicants add column referred_at timestamptz;
alter table public.applicants add column referred_by uuid references public.profiles (id);

-- "Audit: 'Referred to IT060 Istanbul by Selin Arıkan · 14 Dec 11:20',
-- readable at both ends." Both ends means both rows carry enough to render it:
-- the origin knows where it went, the destination knows where it came from.
create index applicants_referred_to_idx on public.applicants (referred_to_center_id)
  where referred_to_center_id is not null;

alter table public.organisations enable row level security;
alter table public.organisation_roles enable row level security;

-- Readable by anyone holding a role at a centre in the organisation, so a
-- branch admin can see the family they belong to. Written server-side only.
create policy "organisations: visible to their centres' admins"
on public.organisations for select
to authenticated
using (
  exists (
    select 1 from public.centers c
    join public.profiles p on p.center_id = c.id
    where c.organisation_id = organisations.id and p.id = auth.uid()
  )
  or exists (
    select 1 from public.organisation_roles r
    where r.organisation_id = organisations.id and r.profile_id = auth.uid() and r.revoked_at is null
  )
);

create policy "organisation_roles: you can see your own"
on public.organisation_roles for select
to authenticated
using (profile_id = auth.uid());
