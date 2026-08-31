-- Ramy, 28 Aug 2026: "no project if we don't fix this." getCentreRoleContext
-- (src/lib/auth/centre-roles.ts) fetched grants, invites, course-admin scope,
-- overrides, custom roles, and custom capabilities as up to 6 separate round
-- trips to Supabase's REST API, even fully parallelized within a request --
-- each one still pays real network latency, and multiplies under concurrent
-- load since every one of those is a separate call to Supabase.
--
-- This function returns every field the app-side logic in centre-roles.ts
-- needs in ONE round trip. It does NOT replicate the authorization decision
-- logic (activeCenterId resolution, role computation, which override rows
-- apply) -- that stays in TypeScript exactly as it already is, unchanged and
-- already correct. This function only collapses the DATA FETCHING: it
-- returns the raw rows for both candidate centre ids (home and the
-- requested active centre) so the app can resolve which one is actually
-- active itself, the same way it already does.
create or replace function get_centre_role_data(
  p_profile_id uuid,
  p_center_id uuid,
  p_active_center_id_requested uuid,
  p_is_platform_owner boolean
)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'grants', (
      select coalesce(jsonb_agg(jsonb_build_object('id', id, 'center_id', center_id, 'role', role)), '[]'::jsonb)
      from centre_roles
      where profile_id = p_profile_id and revoked_at is null
    ),
    'invites', (
      select case when p_is_platform_owner then
        coalesce(jsonb_agg(jsonb_build_object('center_id', center_id)), '[]'::jsonb)
      else '[]'::jsonb end
      from platform_owner_invites
      where p_is_platform_owner and revoked_at is null
    ),
    -- Every course_administrator_scope row for any course_administrator
    -- grant this profile holds, at any centre -- the app filters this down
    -- to the specific grant for the resolved active centre, same as before.
    'course_admin_scope', (
      select coalesce(jsonb_agg(jsonb_build_object('centre_role_id', cas.centre_role_id, 'course_id', cas.course_id)), '[]'::jsonb)
      from course_administrator_scope cas
      where cas.centre_role_id in (
        select id from centre_roles
        where profile_id = p_profile_id and revoked_at is null and role = 'course_administrator'
      )
    ),
    -- Overrides/custom roles/capabilities for BOTH candidate centres (home
    -- and the requested active centre) -- activeCenterId can only ever
    -- resolve to one of these two, so fetching both and letting the app
    -- pick is cheap and correct regardless of which one wins.
    'overrides', (
      select coalesce(jsonb_agg(jsonb_build_object('center_id', center_id, 'role_key', role_key, 'capability_key', capability_key, 'granted_level', granted_level)), '[]'::jsonb)
      from centre_permission_overrides
      where center_id = p_center_id or center_id = p_active_center_id_requested
    ),
    'custom_roles', (
      select coalesce(jsonb_agg(jsonb_build_object('center_id', center_id, 'role_key', role_key, 'label', label)), '[]'::jsonb)
      from centre_custom_roles
      where center_id = p_center_id or center_id = p_active_center_id_requested
    ),
    'custom_capabilities', (
      select coalesce(jsonb_agg(jsonb_build_object('center_id', center_id, 'capability_key', capability_key, 'label', label)), '[]'::jsonb)
      from centre_custom_capabilities
      where center_id = p_center_id or center_id = p_active_center_id_requested
    )
  );
$$;

-- Called only via the service-role admin client (same as every query it
-- replaces already was), so no RLS grant is needed for anon/authenticated.
revoke all on function get_centre_role_data(uuid, uuid, uuid, boolean) from public, anon, authenticated;
