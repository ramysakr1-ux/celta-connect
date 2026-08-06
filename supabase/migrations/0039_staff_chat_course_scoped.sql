-- Staff chat, rescoped from center-wide to course-wide, trainer-only
-- (Ramy, 2026-08-05): "you cannot be on the course unless registered as
-- one of the trainers on the course." No exception for admin/ownership --
-- not even for the centre's own admin. MCT and ACT are both just
-- role = 'trainer' in this app's terms, no separate sub-role needed.
--
-- (A future super-admin emergency-access override is a real, explicitly
-- wanted exception -- "in case there's a problem I need to fix" -- but
-- that role doesn't exist yet, see project_admin_email_migration memory.
-- Not implemented here; when that role is built, it should be a genuine
-- override on top of this trainer-only rule, not baked into it now.)
--
-- Previously scoped by center_id, so two concurrent courses at the same
-- center would wrongly share the same "All Staff"/"Trainers" channels.
-- Also consolidates the old two-channel-type model (center_trainers +
-- all_staff) into one, since there's no longer an admin-inclusion
-- distinction between them to justify two types.

alter table public.staff_channels add column course_id uuid references public.courses (id) on delete cascade;
create index staff_channels_course_id_idx on public.staff_channels (course_id);

drop trigger if exists sync_staff_channel_membership on public.profiles;
drop function if exists public.sync_staff_channel_membership();
drop function if exists public.ensure_center_staff_channels(uuid);

create function public.ensure_course_staff_channel(p_course_id uuid, p_center_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_channel_id uuid;
begin
  select id into v_channel_id
  from public.staff_channels
  where course_id = p_course_id and type = 'all_staff';

  if v_channel_id is null then
    insert into public.staff_channels (center_id, course_id, type, name)
    values (p_center_id, p_course_id, 'all_staff', 'Staff chat')
    returning id into v_channel_id;
  end if;

  return v_channel_id;
end;
$$;

create function public.sync_staff_channel_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_channel_id uuid;
begin
  -- Only registered trainers, on the specific course they're registered
  -- for -- no admin exception, ever. Anything else means: make sure
  -- they're not left in a stale channel (role change, course change,
  -- course_id cleared), then stop.
  if new.role != 'trainer' or new.course_id is null then
    delete from public.staff_channel_members m
    using public.staff_channels sc
    where m.channel_id = sc.id and sc.type = 'all_staff' and m.profile_id = new.id;
    return new;
  end if;

  v_channel_id := public.ensure_course_staff_channel(new.course_id, new.center_id);

  -- Moved to a different course -- drop membership in any other
  -- course-team channel first, so someone doesn't stay reachable in a
  -- course they've left.
  delete from public.staff_channel_members m
  using public.staff_channels sc
  where m.channel_id = sc.id and sc.type = 'all_staff' and m.profile_id = new.id and sc.id != v_channel_id;

  insert into public.staff_channel_members (channel_id, profile_id)
  values (v_channel_id, new.id)
  on conflict do nothing;

  return new;
end;
$$;

create trigger sync_staff_channel_membership
after insert or update of course_id, role on public.profiles
for each row execute function public.sync_staff_channel_membership();

-- Clear out the old center-scoped channels/messages/memberships entirely
-- (test data only at this point, nothing of real value lost) and rebuild
-- correctly scoped ones via the new trigger logic.
delete from public.staff_channels where type in ('center_trainers', 'all_staff');

do $$
declare
  p record;
begin
  for p in
    select id, course_id, center_id from public.profiles
    where role = 'trainer' and course_id is not null
  loop
    perform public.ensure_course_staff_channel(p.course_id, p.center_id);
    insert into public.staff_channel_members (channel_id, profile_id)
    select sc.id, p.id from public.staff_channels sc
    where sc.course_id = p.course_id and sc.type = 'all_staff'
    on conflict do nothing;
  end loop;
end $$;

-- DMs: same-course now, not same-center, and trainer-only (no admin).
create or replace function public.get_or_create_dm_channel(other_profile_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_my_role public.user_role;
  v_my_course uuid;
  v_my_center uuid;
  v_other_role public.user_role;
  v_other_course uuid;
  v_channel_id uuid;
begin
  if v_me = other_profile_id then
    raise exception 'Cannot start a DM with yourself.';
  end if;

  select role, course_id, center_id into v_my_role, v_my_course, v_my_center from public.profiles where id = v_me;
  select role, course_id into v_other_role, v_other_course from public.profiles where id = other_profile_id;

  if v_my_role != 'trainer' or v_other_role != 'trainer' then
    raise exception 'DMs are only available between trainers registered on the same course.';
  end if;

  if v_my_course is null or v_my_course is distinct from v_other_course then
    raise exception 'Can only message trainers on your own course.';
  end if;

  select m1.channel_id into v_channel_id
  from public.staff_channel_members m1
  join public.staff_channel_members m2 on m2.channel_id = m1.channel_id
  join public.staff_channels sc on sc.id = m1.channel_id
  where sc.type = 'dm' and m1.profile_id = v_me and m2.profile_id = other_profile_id;

  if v_channel_id is not null then
    return v_channel_id;
  end if;

  insert into public.staff_channels (center_id, course_id, type) values (v_my_center, v_my_course, 'dm')
  returning id into v_channel_id;

  insert into public.staff_channel_members (channel_id, profile_id)
  values (v_channel_id, v_me), (v_channel_id, other_profile_id);

  return v_channel_id;
end;
$$;

-- RLS insert policy: drop the is_admin() allowance, trainer-only now.
drop policy if exists "staff_messages: members can send messages in their channels" on public.staff_messages;
create policy "staff_messages: members can send messages in their channels"
on public.staff_messages for insert
to authenticated
with check (
  sender_id = auth.uid()
  and public.is_trainer()
  and exists (
    select 1 from public.staff_channel_members m
    where m.channel_id = staff_messages.channel_id and m.profile_id = auth.uid()
  )
);
