-- Make the import policies ask what a role can DO, not what it is CALLED.
--
-- Found 2026-08-30, answering Ramy's "if I create a role and assign it,
-- would it actually work?"
--
-- Almost everywhere, yes: the grant forms offer custom roles, the action
-- validates them against centre_custom_roles, migration 0204 deliberately
-- dropped centre_roles.role's check constraint for exactly this, and
-- grantFor() reads centre_permission_overrides BEFORE the built-in matrix,
-- so a custom role's powers come entirely from the pills the owner sets.
--
-- spreadsheet_imports was the one place that did not follow. Its policies
-- (migration 0104) name the four built-in roles literally, so a custom
-- "Centre Director" given Import candidates = Full would see the Import
-- tab, choose a file, and have the database refuse the insert. It is the
-- only capability in the family enforced by RLS rather than by can() with
-- the admin client, so it is the only one that could disagree.
--
-- The same hardcoding broke the built-in roles in both directions, which is
-- the more interesting half:
--
--   * An owner setting "Import candidates" to None for Centre manager
--     removed the button but not the permission -- the row was still
--     insertable by anything that reached the table.
--   * An owner granting it to Course administrator showed the button and
--     then failed at the database.
--
-- So this resolves the capability the same way the app does: an override
-- row wins if one exists, otherwise fall back to what the built-in matrix
-- says (centre-permissions.ts MATRIX -- import.run is held by
-- centre_administrator and centre_owner only). Custom roles have no matrix
-- entry, so they are None until the owner grants them, which is exactly how
-- the customizer describes a new role: "starting at None everywhere".
--
-- Safe to re-run.

create or replace function public.centre_role_grants_capability(p_capability text, p_level text default 'full')
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.centre_roles r
    left join public.centre_permission_overrides o
      on o.center_id = r.center_id
     and o.role_key = r.role
     and o.capability_key = p_capability
    where r.profile_id = auth.uid()
      and r.revoked_at is null
      and r.center_id = public.current_center_id()
      and coalesce(
            o.granted_level,
            -- The built-in default for this capability, mirroring MATRIX.
            case
              when p_capability = 'import.run'
               and r.role in ('centre_administrator', 'centre_owner') then 'full'
              else 'none'
            end
          ) = p_level
  );
$$;

comment on function public.centre_role_grants_capability(text, text) is
  'Does the caller hold any live centre role here whose effective grant for this capability is p_level? Honours centre_permission_overrides, including for owner-defined custom roles.';

drop policy if exists "spreadsheet_imports: only import.run may create" on public.spreadsheet_imports;
drop policy if exists "spreadsheet_imports: only import.run may update" on public.spreadsheet_imports;

create policy "spreadsheet_imports: only import.run may create"
on public.spreadsheet_imports for insert
to authenticated
with check (
  center_id = public.current_center_id()
  and (
    public.centre_role_grants_capability('import.run')
    -- Transitional, unchanged from 0104: an admin with no centre_roles
    -- grant at all keeps working exactly as before.
    or not exists (select 1 from public.centre_roles r where r.profile_id = auth.uid() and r.revoked_at is null)
  )
);

create policy "spreadsheet_imports: only import.run may update"
on public.spreadsheet_imports for update
to authenticated
using (
  center_id = public.current_center_id()
  and (
    public.centre_role_grants_capability('import.run')
    or not exists (select 1 from public.centre_roles r where r.profile_id = auth.uid() and r.revoked_at is null)
  )
);

-- The read policy deliberately keeps naming roles: 0104's reasoning was that
-- reading the history of imports is not a write and the whole admin family is
-- entitled to the numbers. That is a statement about the family, not about a
-- capability, so there is no capability to resolve. A custom role is added to
-- it here so it is not the one role locked out of a screen it can otherwise use.
drop policy if exists "spreadsheet_imports: the centre's admin family can read them" on public.spreadsheet_imports;

create policy "spreadsheet_imports: the centre's admin family can read them"
on public.spreadsheet_imports for select
to authenticated
using (
  center_id = public.current_center_id()
  and (
    exists (
      select 1 from public.centre_roles r
      where r.profile_id = auth.uid()
        and r.revoked_at is null
        and r.center_id = public.current_center_id()
    )
    or not exists (select 1 from public.centre_roles r where r.profile_id = auth.uid() and r.revoked_at is null)
  )
);
