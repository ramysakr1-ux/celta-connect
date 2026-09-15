-- Who may invite Connect's owner into a centre, and who may revoke that.
--
-- 0208 gave platform_owner_invites one policy, "for all" to ANY live
-- centre_roles holder at that centre. The app has always gated both actions
-- on centre.settings.edit, so the two layers disagreed: through the session
-- client the read-only Centre observer and the Course administrator could
-- both create the standing invite and revoke it, neither of which they may
-- do through the screen (walked 15 Sep 2026).
--
-- Reading stays open to the whole admin family: whether their centre has
-- invited Connect in, and the disclosure log beside it, is exactly the kind
-- of thing a read-only role exists to see.
--
-- Safe to re-run.

-- centre_role_grants_capability() (0258) was written for the import policies
-- and knows one built-in default, import.run -- every other capability falls
-- through to 'none' unless the centre has an explicit override row. Using it
-- for a second capability means teaching it that capability's defaults, or
-- the policy below would lock out the Centre manager and the Centre owner
-- too. The cases mirror MATRIX in src/lib/auth/centre-permissions.ts,
-- including the Centre observer's 'read' on centre.settings.edit added
-- 15 Sep 2026.
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
            -- The built-in defaults for this capability, mirroring MATRIX.
            case
              when p_capability = 'import.run'
               and r.role in ('centre_administrator', 'centre_owner') then 'full'
              when p_capability = 'centre.settings.edit'
               and r.role in ('centre_administrator', 'centre_owner') then 'full'
              when p_capability = 'centre.settings.edit'
               and r.role = 'centre_manager' then 'view'
              else 'none'
            end
          ) = p_level
  );
$$;

comment on function public.centre_role_grants_capability(text, text) is
  'Does the caller hold any live centre role here whose effective grant for this capability is p_level? Honours centre_permission_overrides, including for owner-defined custom roles. Built-in defaults are known for import.run and centre.settings.edit.';

drop policy if exists "platform_owner_invites: centre-roles holders manage their own centre's invite" on public.platform_owner_invites;
drop policy if exists "platform_owner_invites: the admin family reads their centre's" on public.platform_owner_invites;
drop policy if exists "platform_owner_invites: only centre.settings.edit may write" on public.platform_owner_invites;

create policy "platform_owner_invites: the admin family reads their centre's"
on public.platform_owner_invites for select
to authenticated
using (
  exists (
    select 1 from public.centre_roles r
    where r.profile_id = (select auth.uid())
      and r.center_id = platform_owner_invites.center_id
      and r.revoked_at is null
  )
);

create policy "platform_owner_invites: only centre.settings.edit may write"
on public.platform_owner_invites for all
to authenticated
using (
  center_id = public.current_center_id()
  and public.centre_role_grants_capability('centre.settings.edit')
)
with check (
  center_id = public.current_center_id()
  and public.centre_role_grants_capability('centre.settings.edit')
);

notify pgrst, 'reload schema';

select
  polname as policy,
  case polcmd
    when 'r' then 'select'
    when 'a' then 'insert'
    when 'w' then 'update'
    when 'd' then 'delete'
    else 'all'
  end as command
from pg_policy
where polrelid = 'public.platform_owner_invites'::regclass
order by polname;
