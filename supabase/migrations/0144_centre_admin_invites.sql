-- Invitations.dc.html 1c: "account + centre agreement, once per centre" for
-- a new centre admin. This is NOT the self-promotion migration 0103 forbids
-- ("roles are invited, never self-selected... a forwarded invite link
-- cannot create an administrator" -- that rule is about nobody granting
-- themselves a role). Confirmed with Ramy 2026-08-18: the first
-- centre_owner is created automatically at subscription checkout, never
-- through a manual link; this table is only for an existing centre_owner
-- deliberately adding a second admin/manager to their own centre
-- afterward -- still gated by roles.grant, same as grantCentreRole().
--
-- Centre-scoped and persistent (no expiry), not course-scoped like
-- course_access_tokens -- a centre admin's access outlives any one course,
-- so it doesn't belong on that table.
create table public.centre_admin_invites (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers (id) on delete cascade,
  role text not null check (role in (
    'centre_administrator',
    'centre_manager',
    'course_administrator',
    'centre_owner'
  )),
  token uuid not null default gen_random_uuid(),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  used_at timestamptz,
  used_by uuid references public.profiles (id),
  revoked_at timestamptz,
  unique (token)
);
create index centre_admin_invites_center_id_idx on public.centre_admin_invites (center_id);

alter table public.centre_admin_invites enable row level security;

-- No SELECT/INSERT/UPDATE policy at all -- same reasoning as centre_roles
-- (migration 0103). Creating, listing and revoking an invite is a Centre
-- owner power, checked server-side before the admin client is used; and the
-- page that redeems one (/join-centre/[token]) has no session to scope a
-- policy to in the first place, the same trust boundary as courses'
-- trainee_join_token/trainer_join_token.
