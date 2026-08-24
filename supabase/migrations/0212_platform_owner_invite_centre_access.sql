-- Closes the gap flagged in enter/[centerId]/route.ts's own comment: a
-- platform_owner clicking "Open" on an Invited centre from the Command
-- Center logs the visit correctly, but current_center_id() -- the function
-- every centre-scoped RLS policy relies on -- only ever honoured a live
-- centre_roles grant (or the person's own home centre). It didn't know
-- platform_owner_invites existed, so is_admin() already being widened to
-- include platform_owner (migration 0193) didn't actually grant anything
-- here: center_id = current_center_id() never matched.
--
-- is_admin() already covers platform_owner unconditionally -- this is the
-- other half: current_center_id() now also resolves to an Invited centre
-- when profiles.active_center_id points there and a live (not revoked)
-- platform_owner_invites row backs it. That combination is what the whole
-- app's existing "admin can act in their center" policies already check,
-- so this one function change is what makes those policies start covering
-- an Invited platform_owner too, with no per-table follow-up needed.
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
          or (
            p.role = 'platform_owner'
            and exists (
              select 1 from public.platform_owner_invites i
              where i.center_id = p.active_center_id
                and i.revoked_at is null
            )
          )
        )
    ),
    (select p2.center_id from public.profiles p2 where p2.id = auth.uid())
  );
$$;

-- Same widening for the switcher's own "every centre reachable" list.
create or replace function public.my_center_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.center_id from public.profiles p where p.id = auth.uid() and p.center_id is not null
  union
  select r.center_id from public.centre_roles r where r.profile_id = auth.uid() and r.revoked_at is null
  union
  select i.center_id from public.platform_owner_invites i
  join public.profiles p on p.id = auth.uid() and p.role = 'platform_owner'
  where i.revoked_at is null;
$$;
