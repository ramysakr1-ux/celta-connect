-- spreadsheet_imports' policies (migration 0102) were written before the role
-- family existed, so they gate on profiles.role = 'admin'. A Centre manager is
-- also a flat 'admin', and an import creates people -- squarely the "edit
-- anything at all" that role may never do.
--
-- The app now checks this too (dashboard/admin/import), but the app should not
-- be the only thing standing between a read-only role and writing rows.
--
-- has_centre_role() resolves against the centre the caller is currently acting
-- in (migration 0103), so this is centre-correct for someone holding roles at
-- two branches: importing in one says nothing about the other.

drop policy if exists "spreadsheet_imports: admins read their centre's imports" on public.spreadsheet_imports;
drop policy if exists "spreadsheet_imports: admins create imports in their centre" on public.spreadsheet_imports;
drop policy if exists "spreadsheet_imports: admins update their centre's imports" on public.spreadsheet_imports;

-- Reading the history of imports is not itself a write, and the Centre manager
-- is explicitly entitled to the numbers -- so any role in the family may see
-- that an import happened. Only acting is restricted.
create policy "spreadsheet_imports: the centre's admin family can read them"
on public.spreadsheet_imports for select
to authenticated
using (
  center_id = public.current_center_id()
  and (
    public.has_centre_role('centre_administrator')
    or public.has_centre_role('centre_manager')
    or public.has_centre_role('course_administrator')
    or public.has_centre_role('centre_owner')
    -- Transitional: an admin with no centre_roles grant yet keeps working
    -- exactly as before, so applying this migration cannot lock anyone out
    -- mid-rollout. Remove once every admin has been granted a role.
    or not exists (select 1 from public.centre_roles r where r.profile_id = auth.uid() and r.revoked_at is null)
  )
);

create policy "spreadsheet_imports: only import.run may create"
on public.spreadsheet_imports for insert
to authenticated
with check (
  center_id = public.current_center_id()
  and (
    public.has_centre_role('centre_administrator')
    or public.has_centre_role('centre_owner')
    or not exists (select 1 from public.centre_roles r where r.profile_id = auth.uid() and r.revoked_at is null)
  )
);

create policy "spreadsheet_imports: only import.run may update"
on public.spreadsheet_imports for update
to authenticated
using (
  center_id = public.current_center_id()
  and (
    public.has_centre_role('centre_administrator')
    or public.has_centre_role('centre_owner')
    or not exists (select 1 from public.centre_roles r where r.profile_id = auth.uid() and r.revoked_at is null)
  )
);
