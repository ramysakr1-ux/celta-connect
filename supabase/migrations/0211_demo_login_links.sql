-- for-claude-code-demo-login-links.md: platform_owner signs in as any role
-- on any centre for demo purposes -- explicitly NOT the Owner/Invited
-- access model (no silent viewing, always logged). Every link redeems
-- through this app's own token (login_token), not a raw Supabase magic
-- link handed to the user directly, so revoke/expiry is enforced by this
-- table regardless of which of the 6 roles it's for.
--
-- Ramy confirmed 2026-08-25: for a real (non-demo) centre with no seeded
-- fake accounts, the mechanism is a clearly-flagged SYNTHETIC profile
-- created the first time a link is generated for a given (centre, role)
-- and reused after that -- not true impersonation of a real person's
-- account. is_platform_demo_login marks those profiles so they're
-- identifiable anywhere they surface (a real centre's own roster/tutor
-- list included).
alter table public.profiles
  add column is_platform_demo_login boolean not null default false;

create table public.platform_demo_login_links (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers (id) on delete cascade,
  role_key text not null check (role_key in ('mct', 'act', 'trainee', 'assessor', 'volunteer', 'centre_admin')),
  login_token text not null unique,
  -- mct/act/trainee/centre_admin: a synthetic profiles row (Supabase Auth
  -- user + profile), reused across generations for the same (centre, role).
  synthetic_profile_id uuid references public.profiles (id) on delete set null,
  -- assessor/volunteer: no profiles row at all in this app (course_access_
  -- tokens' own cookie/token gate) -- this is that token, so the same
  -- revoke path (delete the row) also kills the underlying access.
  course_access_token text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_used_at timestamptz
);

alter table public.platform_demo_login_links enable row level security;

create policy "platform_demo_login_links: platform_owner only"
on public.platform_demo_login_links for all
to authenticated
using (public.current_role() = 'platform_owner')
with check (public.current_role() = 'platform_owner');
