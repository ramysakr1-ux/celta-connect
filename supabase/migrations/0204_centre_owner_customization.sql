-- for-claude-code-centre-owner-role-customizer.md: two Centre Owner-only
-- capabilities on top of the already-live Centre Admin family --
-- cross-branch visibility, and a per-centre override layer on top of the
-- fixed MATRIX in centre-permissions.ts (including owner-defined custom
-- roles and capabilities).

-- ============================================================
-- 1. Cross-branch visibility (multi-branch centres only)
-- ============================================================
-- Directional and per-pair: "Downtown can see Riverside" is a separate
-- setting from "Riverside can see Downtown" (Centre Owner Landing.dc.html
-- shows both independently toggled). Default 'blocked' -- migrations 0193
-- and 0194 both flag true cross-centre visibility as explicitly deferred;
-- this is the real decision that resolves that deferral, opt-in only.
create table public.centre_branch_visibility (
  id uuid primary key default gen_random_uuid(),
  viewer_center_id uuid not null references public.centers (id) on delete cascade,
  target_center_id uuid not null references public.centers (id) on delete cascade,
  visibility text not null default 'blocked' check (visibility in ('view_only', 'blocked')),
  set_by uuid references public.profiles (id) on delete set null,
  set_at timestamptz not null default now(),
  unique (viewer_center_id, target_center_id),
  check (viewer_center_id != target_center_id)
);
create index centre_branch_visibility_viewer_idx on public.centre_branch_visibility (viewer_center_id);
create index centre_branch_visibility_target_idx on public.centre_branch_visibility (target_center_id);

alter table public.centre_branch_visibility enable row level security;

-- Only the owner of either branch may set it; anyone with a centre role at
-- either branch may read it (the setting itself isn't sensitive, only the
-- data it exposes -- and that data has its own RLS).
create policy "centre_branch_visibility: centre-roles holders at either branch read"
  on public.centre_branch_visibility for select
  using (
    exists (
      select 1 from public.centre_roles r
      where r.revoked_at is null
        and r.center_id in (centre_branch_visibility.viewer_center_id, centre_branch_visibility.target_center_id)
        and r.profile_id = auth.uid()
    )
  );

create policy "centre_branch_visibility: a centre owner at either branch sets it"
  on public.centre_branch_visibility for all
  using (
    exists (
      select 1 from public.centre_roles r
      where r.revoked_at is null
        and r.role = 'centre_owner'
        and r.center_id in (centre_branch_visibility.viewer_center_id, centre_branch_visibility.target_center_id)
        and r.profile_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.centre_roles r
      where r.revoked_at is null
        and r.role = 'centre_owner'
        and r.center_id in (centre_branch_visibility.viewer_center_id, centre_branch_visibility.target_center_id)
        and r.profile_id = auth.uid()
    )
  );

-- ============================================================
-- 2. Custom roles a centre owner has defined
-- ============================================================
-- Deliberately not added to centre_roles.role's fixed check constraint --
-- that constraint is dropped below in favour of app-level validation
-- (either a built-in CentreRole or a row in this table for the same
-- center_id), since a CHECK can't reference another table's live rows.
create table public.centre_custom_roles (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers (id) on delete cascade,
  role_key text not null,
  label text not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (center_id, role_key)
);
create index centre_custom_roles_center_id_idx on public.centre_custom_roles (center_id);

alter table public.centre_custom_roles enable row level security;

create policy "centre_custom_roles: centre-roles holders read their centre's custom roles"
  on public.centre_custom_roles for select
  using (
    exists (
      select 1 from public.centre_roles r
      where r.revoked_at is null and r.center_id = centre_custom_roles.center_id and r.profile_id = auth.uid()
    )
  );

create policy "centre_custom_roles: a centre owner manages their centre's custom roles"
  on public.centre_custom_roles for all
  using (
    exists (
      select 1 from public.centre_roles r
      where r.revoked_at is null and r.role = 'centre_owner' and r.center_id = centre_custom_roles.center_id and r.profile_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.centre_roles r
      where r.revoked_at is null and r.role = 'centre_owner' and r.center_id = centre_custom_roles.center_id and r.profile_id = auth.uid()
    )
  );

alter table public.centre_roles drop constraint if exists centre_roles_role_check;
-- Same reason: an invite can now name a custom role too.
alter table public.centre_admin_invites drop constraint if exists centre_admin_invites_role_check;

-- ============================================================
-- 3. Custom capabilities a centre owner has defined
-- ============================================================
create table public.centre_custom_capabilities (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers (id) on delete cascade,
  capability_key text not null,
  label text not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (center_id, capability_key)
);
create index centre_custom_capabilities_center_id_idx on public.centre_custom_capabilities (center_id);

alter table public.centre_custom_capabilities enable row level security;

create policy "centre_custom_capabilities: centre-roles holders read their centre's custom capabilities"
  on public.centre_custom_capabilities for select
  using (
    exists (
      select 1 from public.centre_roles r
      where r.revoked_at is null and r.center_id = centre_custom_capabilities.center_id and r.profile_id = auth.uid()
    )
  );

create policy "centre_custom_capabilities: a centre owner manages their centre's custom capabilities"
  on public.centre_custom_capabilities for all
  using (
    exists (
      select 1 from public.centre_roles r
      where r.revoked_at is null and r.role = 'centre_owner' and r.center_id = centre_custom_capabilities.center_id and r.profile_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.centre_roles r
      where r.revoked_at is null and r.role = 'centre_owner' and r.center_id = centre_custom_capabilities.center_id and r.profile_id = auth.uid()
    )
  );

-- ============================================================
-- 4. Per-centre capability overrides
-- ============================================================
-- "capability, role, centre_id, granted_level... can()/canView() check the
-- override first, falling back to MATRIX when no override exists." role_key
-- and capability_key are plain text rather than FKs to the built-in enums,
-- since they must also hold a custom role/capability's key.
create table public.centre_permission_overrides (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers (id) on delete cascade,
  role_key text not null,
  capability_key text not null,
  granted_level text not null check (granted_level in ('full', 'view', 'none')),
  set_by uuid references public.profiles (id) on delete set null,
  set_at timestamptz not null default now(),
  unique (center_id, role_key, capability_key)
);
create index centre_permission_overrides_center_id_idx on public.centre_permission_overrides (center_id);

alter table public.centre_permission_overrides enable row level security;

create policy "centre_permission_overrides: centre-roles holders read their centre's overrides"
  on public.centre_permission_overrides for select
  using (
    exists (
      select 1 from public.centre_roles r
      where r.revoked_at is null and r.center_id = centre_permission_overrides.center_id and r.profile_id = auth.uid()
    )
  );

create policy "centre_permission_overrides: a centre owner manages their centre's overrides"
  on public.centre_permission_overrides for all
  using (
    exists (
      select 1 from public.centre_roles r
      where r.revoked_at is null and r.role = 'centre_owner' and r.center_id = centre_permission_overrides.center_id and r.profile_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.centre_roles r
      where r.revoked_at is null and r.role = 'centre_owner' and r.center_id = centre_permission_overrides.center_id and r.profile_id = auth.uid()
    )
  );
