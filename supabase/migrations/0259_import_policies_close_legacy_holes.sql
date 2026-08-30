-- Close two holes in spreadsheet_imports' RLS, both found 2026-08-30 while
-- checking whether a custom Centre Owner role would really work.
--
-- HOLE 1 -- migration 0104 was silently reverted by migration 0193.
--
-- 0104 exists to stop the read-only role writing rows. Its own comment:
-- "this may be the only thing standing between a read-only role and writing
-- rows." It dropped 0102's three "admins ..." policies and replaced them
-- with capability-gated ones.
--
-- 0193 (platform_owner) then re-created all three from 0102's original text,
-- to add 'platform_owner' alongside 'admin'. It was a sweep across many
-- tables and did not notice that these three had been superseded 89
-- migrations earlier.
--
-- Postgres ORs permissive policies together, so from 0193 onward the
-- restriction was void: the surviving policy admits anyone whose
-- profiles.role is 'admin' at that centre, whatever their centre role. Every
-- centre-role holder in this database has profiles.role = 'admin' -- so the
-- Centre observer, whose entire definition is "cannot edit anything at all",
-- has been able to insert and update imports this whole time.
--
-- HOLE 2 -- the transitional fallback now admits trainees and trainers.
--
-- 0104 carried "or not exists (select 1 from centre_roles where profile_id =
-- auth.uid())" so that an admin who had not yet been granted a centre role
-- kept working mid-rollout, with "Remove once every admin has been granted a
-- role" written next to it.
--
-- That day has come and gone: every admin and platform_owner in this
-- database now holds a centre role. But the clause does not say "admin" --
-- it says "anyone with no centre role", which today is 19 trainees and 6
-- trainers. Combined with center_id = current_center_id(), every one of them
-- could read, insert and update their centre's import rows, which carry
-- candidate names, emails and the sheets they came from.
--
-- Verified before removing it: no admin or platform_owner relies on it.
--
-- platform_owner keeps explicit access, which was 0193's actual intent, and
-- does not depend on holding a centre_roles row at a centre they were
-- invited into (migration 0212).
--
-- Safe to re-run.

-- Hole 1: the superseded policies, gone for good this time.
drop policy if exists "spreadsheet_imports: admins read their centre's imports" on public.spreadsheet_imports;
drop policy if exists "spreadsheet_imports: admins create imports in their centre" on public.spreadsheet_imports;
drop policy if exists "spreadsheet_imports: admins update their centre's imports" on public.spreadsheet_imports;

create or replace function public.is_platform_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'platform_owner'
  );
$$;

comment on function public.is_platform_owner() is
  'Is the caller the platform owner? Used where a policy must admit them without depending on a centre_roles row.';

-- Hole 2: the transitional fallback is retired in all three.
drop policy if exists "spreadsheet_imports: the centre's admin family can read them" on public.spreadsheet_imports;
drop policy if exists "spreadsheet_imports: only import.run may create" on public.spreadsheet_imports;
drop policy if exists "spreadsheet_imports: only import.run may update" on public.spreadsheet_imports;

-- Reading the history of an import is not a write, and 0104's reasoning
-- holds: the whole admin family is entitled to the numbers. But "the family"
-- means holding a centre role here -- not merely lacking one.
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
    or public.is_platform_owner()
  )
);

create policy "spreadsheet_imports: only import.run may create"
on public.spreadsheet_imports for insert
to authenticated
with check (
  center_id = public.current_center_id()
  and (
    public.centre_role_grants_capability('import.run')
    or public.is_platform_owner()
  )
);

create policy "spreadsheet_imports: only import.run may update"
on public.spreadsheet_imports for update
to authenticated
using (
  center_id = public.current_center_id()
  and (
    public.centre_role_grants_capability('import.run')
    or public.is_platform_owner()
  )
);
