-- for-claude-code-command-center.md: the platform-owner's access model into
-- other centres' data. Two real doors, nothing else:
-- 1. Owner -- centre_roles already has this (role = 'centre_owner'), no new
--    schema needed.
-- 2. Course role (MCT/ACT/etc, per Ramy 2026-08-25: "I should have access
--    into the course that I'm on, not just the centre that I own") --
--    course_tutors already has this, no new schema needed either.
-- 3. Invited -- a centre explicitly inviting the platform owner in. This is
--    genuinely new: a standing (not time-boxed, unlike platform_support_
--    grants' 6/24/72h windows) invite that a centre can revoke, plus a real
--    audit log every time it's actually used -- "I do not want a backdoor...
--    they can always send me an invite, and then I can go, and it will be
--    logged" (Ramy, 2026-08-25). Deliberately NOT platform_support_grants:
--    that table is scoped to the anonymous support@ account's time-boxed
--    course/billing grants, a different actor and a different shape.
create table public.platform_owner_invites (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers (id) on delete cascade,
  invited_by uuid references public.profiles (id) on delete set null,
  invited_at timestamptz not null default now(),
  note text,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles (id) on delete set null
);

create index platform_owner_invites_center_id_idx on public.platform_owner_invites (center_id);

alter table public.platform_owner_invites enable row level security;

-- A centre's own centre_roles holders can see whether they've invited the
-- platform owner in (and revoke it); the platform owner reads every row
-- (needs to know which centres it can enter) via the admin client in its
-- own server-only pages, not through this policy.
create policy "platform_owner_invites: centre-roles holders manage their own centre's invite"
on public.platform_owner_invites for all
to authenticated
using (
  exists (select 1 from public.centre_roles r where r.profile_id = auth.uid() and r.center_id = platform_owner_invites.center_id and r.revoked_at is null)
)
with check (
  exists (select 1 from public.centre_roles r where r.profile_id = auth.uid() and r.center_id = platform_owner_invites.center_id and r.revoked_at is null)
);

-- Every real access under an Invited grant, logged -- "they should see in
-- their own activity log that Ramy accessed their centre." Visible to that
-- centre's own centre_roles holders directly (this IS their disclosure
-- log), not just to the platform owner.
create table public.platform_owner_access_log (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null references public.platform_owner_invites (id) on delete cascade,
  center_id uuid not null references public.centers (id) on delete cascade,
  accessed_by uuid not null references public.profiles (id) on delete set null,
  page text not null,
  accessed_at timestamptz not null default now()
);

create index platform_owner_access_log_center_id_idx on public.platform_owner_access_log (center_id);

alter table public.platform_owner_access_log enable row level security;

create policy "platform_owner_access_log: centre-roles holders read their own centre's disclosure log"
on public.platform_owner_access_log for select
to authenticated
using (
  exists (select 1 from public.centre_roles r where r.profile_id = auth.uid() and r.center_id = platform_owner_access_log.center_id and r.revoked_at is null)
);

-- for-claude-code-command-center.md item 4: "Feedback & support... synced
-- automatically from support@celtaconnect.com." The receiving table for
-- whatever ingestion mechanism gets wired up later (IMAP poll or an inbound-
-- parse webhook) -- built now so the Command Center module has something
-- real to read the moment ingestion exists, deliberately not blocking on
-- that separate integration decision. No RLS beyond platform_owner: nobody
-- else should ever read the centre's own support traffic.
create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  from_email text not null,
  from_name text,
  center_id uuid references public.centers (id) on delete set null,
  subject text,
  snippet text not null,
  received_at timestamptz not null default now(),
  read_at timestamptz
);

create index support_messages_received_at_idx on public.support_messages (received_at desc);

alter table public.support_messages enable row level security;

create policy "support_messages: platform owner only"
on public.support_messages for all
to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'platform_owner'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'platform_owner'));
