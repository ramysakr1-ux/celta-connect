-- connect-platform-owner-role-spec-2026-08-22.md. Run after 0192 has
-- committed (see that file's comment). A platform_owner sits above every
-- centre admin: visibility across all centres, can create a centre and its
-- first admin, can promote/demote roles. The spec's own stated preference:
-- "platform_owner implicitly satisfies any admin check" rather than
-- touching every admin-gated route/policy one by one -- is_admin() is
-- exactly that single choke point at the database layer (52 policies
-- across the schema call it), so widening it here is the low-risk version
-- of that ask. A handful of RLS policies and trigger functions predate
-- is_admin() and check profiles.role = 'admin' inline instead; those are
-- widened individually below since there was never a central point to fix
-- for them.
--
-- Deliberately NOT covered here: true cross-centre RLS (every policy below
-- still scopes to the viewer's OWN center_id). The platform-owner-only
-- screen this migration supports reads/writes through the service-role
-- admin client instead, same pattern already used elsewhere in this app
-- for admin-service-role listing pages -- so it doesn't need RLS to see
-- across centres. Per the spec's own scope note, a full cross-centre RLS
-- model is deferred to a follow-up, not built here.

-- profiles_course_required_for_trainer_trainee (0001): admins may have a
-- null course_id (cross-course oversight); platform_owner is the same
-- shape -- not tied to any one course either.
alter table public.profiles drop constraint profiles_course_required_for_trainer_trainee;
alter table public.profiles add constraint profiles_course_required_for_trainer_trainee check (
  role in ('admin', 'platform_owner') or course_id is not null
);

-- The central admin gate. Every one of the 52 policies that call
-- is_admin() picks this up automatically.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role() in ('admin', 'platform_owner');
$$;

-- --- The handful of policies/functions written against profiles.role =
-- 'admin' directly instead of is_admin() (predate it, or were never
-- migrated onto it). Widened individually so a platform_owner gets the
-- same admin-equivalent behaviour everywhere, not just wherever is_admin()
-- happened to already be used. ---

-- 0092: admin course-chat channel membership.
create or replace function public.ensure_course_admin_channel(p_course_id uuid, p_center_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_channel_id uuid;
  v_course_name text;
begin
  select id into v_channel_id from public.staff_channels where course_id = p_course_id and type = 'course_admin';
  if v_channel_id is not null then
    return v_channel_id;
  end if;

  select name into v_course_name from public.courses where id = p_course_id;

  insert into public.staff_channels (center_id, course_id, type, name)
  values (p_center_id, p_course_id, 'course_admin', v_course_name)
  returning id into v_channel_id;

  insert into public.staff_channel_members (channel_id, profile_id)
  select v_channel_id, p.id from public.profiles p where p.center_id = p_center_id and p.role in ('admin', 'platform_owner')
  on conflict do nothing;

  return v_channel_id;
end;
$$;

create or replace function public.sync_admin_channel_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role not in ('admin', 'platform_owner') then
    delete from public.staff_channel_members m
    using public.staff_channels sc
    where m.channel_id = sc.id and sc.type = 'course_admin' and m.profile_id = new.id;
    return new;
  end if;

  insert into public.staff_channel_members (channel_id, profile_id)
  select sc.id, new.id from public.staff_channels sc
  where sc.center_id = new.center_id and sc.type = 'course_admin'
  on conflict do nothing;

  return new;
end;
$$;

-- 0103: centre_roles / course_administrator_scope / centre_owner_actions visibility.
drop policy if exists "centre_roles: admins see grants in their own centre" on public.centre_roles;
create policy "centre_roles: admins see grants in their own centre"
on public.centre_roles for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'platform_owner')
      and p.center_id = centre_roles.center_id
  )
);

drop policy if exists "course_administrator_scope: visible with its grant" on public.course_administrator_scope;
create policy "course_administrator_scope: visible with its grant"
on public.course_administrator_scope for select
to authenticated
using (
  exists (
    select 1 from public.centre_roles r
    where r.id = course_administrator_scope.centre_role_id
      and (
        r.profile_id = auth.uid()
        or exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role in ('admin', 'platform_owner') and p.center_id = r.center_id
        )
      )
  )
);

drop policy if exists "centre_owner_actions: readable inside the centre" on public.centre_owner_actions;
create policy "centre_owner_actions: readable inside the centre"
on public.centre_owner_actions for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'platform_owner')
      and p.center_id = centre_owner_actions.center_id
  )
);

-- 0102: spreadsheet imports.
drop policy if exists "spreadsheet_imports: admins read their centre's imports" on public.spreadsheet_imports;
create policy "spreadsheet_imports: admins read their centre's imports"
on public.spreadsheet_imports for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'platform_owner')
      and p.center_id = spreadsheet_imports.center_id
  )
);

drop policy if exists "spreadsheet_imports: admins create imports in their centre" on public.spreadsheet_imports;
create policy "spreadsheet_imports: admins create imports in their centre"
on public.spreadsheet_imports for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'platform_owner')
      and p.center_id = spreadsheet_imports.center_id
  )
);

drop policy if exists "spreadsheet_imports: admins update their centre's imports" on public.spreadsheet_imports;
create policy "spreadsheet_imports: admins update their centre's imports"
on public.spreadsheet_imports for update
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'platform_owner')
      and p.center_id = spreadsheet_imports.center_id
  )
);

-- 0110: areas of responsibility.
drop policy if exists "centre_areas: the centre's admins can see who holds what" on public.centre_areas;
create policy "centre_areas: the centre's admins can see who holds what"
on public.centre_areas for select
to authenticated
using (
  profile_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'platform_owner') and p.center_id = centre_areas.center_id
  )
);

-- 0148: trainer-in-training access.
create or replace function public.tit_can_access_course_tutor(target_course_tutors_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.course_tutors ct
    join public.courses c on c.id = ct.course_id
    where ct.id = target_course_tutors_id
      and (
        ct.profile_id = auth.uid()
        or ct.supervisor_profile_id = auth.uid()
        or exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role in ('admin', 'platform_owner') and p.center_id = c.center_id
        )
      )
  );
$$;
