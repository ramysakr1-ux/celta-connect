-- Trainee-facing chat, built on the same staff_channels/staff_messages
-- tables as the trainer-only staff chat (0008/0039) rather than a parallel
-- schema -- same membership-gated RLS shape already does the right thing,
-- it just needs trainees let in for their own rows. Two pieces:
--
-- 1) One auto-provisioned 'tp_group' channel per course_subgroup ("TP
--    Group" chat) -- every trainee in that subgroup is a member, synced
--    off course_subgroup_members the same way the trainer course channel
--    is synced off profiles.role/course_id in 0039.
-- 2) Trainee <-> trainer DMs ("message their TP tutor") -- extends
--    get_or_create_dm_channel, which was trainer-only in 0039, rather than
--    adding a second DM function. Trainee <-> trainee DM and anything
--    touching admin/assessor/volunteer stays unsupported -- trainees talk
--    to each other via the group channel above, not 1:1.

create function public.is_trainee()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role() = 'trainee';
$$;

alter table public.staff_channels add column subgroup_id uuid references public.course_subgroups (id) on delete cascade;
create unique index staff_channels_subgroup_unique_idx on public.staff_channels (subgroup_id) where subgroup_id is not null;

create function public.ensure_subgroup_chat_channel(p_subgroup_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_channel_id uuid;
  v_course_id uuid;
  v_center_id uuid;
  v_name text;
begin
  select id into v_channel_id from public.staff_channels where subgroup_id = p_subgroup_id;
  if v_channel_id is not null then
    return v_channel_id;
  end if;

  select sg.course_id, sg.name, c.center_id into v_course_id, v_name, v_center_id
  from public.course_subgroups sg
  join public.courses c on c.id = sg.course_id
  where sg.id = p_subgroup_id;

  insert into public.staff_channels (center_id, course_id, subgroup_id, type, name)
  values (v_center_id, v_course_id, p_subgroup_id, 'tp_group', v_name)
  returning id into v_channel_id;

  return v_channel_id;
end;
$$;

create function public.sync_subgroup_chat_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_channel_id uuid;
begin
  if tg_op = 'DELETE' then
    delete from public.staff_channel_members m
    using public.staff_channels sc
    where m.channel_id = sc.id and sc.subgroup_id = old.subgroup_id and m.profile_id = old.trainee_id;
    return old;
  end if;

  if tg_op = 'UPDATE' and old.subgroup_id is distinct from new.subgroup_id then
    delete from public.staff_channel_members m
    using public.staff_channels sc
    where m.channel_id = sc.id and sc.subgroup_id = old.subgroup_id and m.profile_id = old.trainee_id;
  end if;

  v_channel_id := public.ensure_subgroup_chat_channel(new.subgroup_id);
  insert into public.staff_channel_members (channel_id, profile_id)
  values (v_channel_id, new.trainee_id)
  on conflict do nothing;

  return new;
end;
$$;

create trigger sync_subgroup_chat_membership
after insert or update of subgroup_id or delete on public.course_subgroup_members
for each row execute function public.sync_subgroup_chat_membership();

-- Backfill existing subgroup members (subgroups/rotation already in use
-- ahead of this migration, e.g. the seeded QA trainees -- see
-- reference_qa_test_accounts memory).
do $$
declare
  r record;
begin
  for r in select subgroup_id, trainee_id from public.course_subgroup_members loop
    perform public.ensure_subgroup_chat_channel(r.subgroup_id);
    insert into public.staff_channel_members (channel_id, profile_id)
    select sc.id, r.trainee_id from public.staff_channels sc where sc.subgroup_id = r.subgroup_id
    on conflict do nothing;
  end loop;
end $$;

-- DMs: allow trainer<->trainee on the same course, in addition to the
-- existing trainer<->trainer case. Still same-course only, still no
-- trainee<->trainee, still no admin.
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

  if v_my_course is null or v_my_course is distinct from v_other_course then
    raise exception 'Can only message people on your own course.';
  end if;

  if not (
    (v_my_role = 'trainer' and v_other_role = 'trainer')
    or (v_my_role = 'trainer' and v_other_role = 'trainee')
    or (v_my_role = 'trainee' and v_other_role = 'trainer')
  ) then
    raise exception 'DMs are only available between a trainer and a trainee, or between two trainers, on the same course.';
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

-- staff_messages INSERT policy: let trainees send too, still gated by
-- actual channel membership (a trainee is never a member of a channel they
-- shouldn't be in, since membership itself is only ever granted by the
-- security-definer functions above).
drop policy if exists "staff_messages: members can send messages in their channels" on public.staff_messages;
create policy "staff_messages: members can send messages in their channels"
on public.staff_messages for insert
to authenticated
with check (
  sender_id = auth.uid()
  and (public.is_trainer() or public.is_trainee())
  and exists (
    select 1 from public.staff_channel_members m
    where m.channel_id = staff_messages.channel_id and m.profile_id = auth.uid()
  )
);
