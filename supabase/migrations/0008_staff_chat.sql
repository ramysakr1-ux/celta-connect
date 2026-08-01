-- Staff-side chat: separate from any future trainee-facing chat, and
-- trainees get zero visibility -- no RLS policy here ever matches a
-- trainee, and channels/memberships can only be created via the
-- security-definer functions below, never directly by a client.

create type public.staff_channel_type as enum ('center_trainers', 'all_staff', 'dm');

create table public.staff_channels (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers (id) on delete cascade,
  type public.staff_channel_type not null,
  name text,
  created_at timestamptz not null default now()
);

create table public.staff_channel_members (
  channel_id uuid not null references public.staff_channels (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (channel_id, profile_id)
);

create table public.staff_messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.staff_channels (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index staff_channels_center_id_idx on public.staff_channels (center_id);
create index staff_channel_members_profile_idx on public.staff_channel_members (profile_id);
create index staff_messages_channel_idx on public.staff_messages (channel_id, created_at);

-- ============================================================
-- Auto-provisioning: one "Trainers" and one "All Staff" channel per
-- center, membership synced automatically as trainer/admin profiles
-- are created.
-- ============================================================

create function public.ensure_center_staff_channels(p_center_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.staff_channels (center_id, type, name)
  select p_center_id, 'center_trainers', 'Trainers'
  where not exists (
    select 1 from public.staff_channels where center_id = p_center_id and type = 'center_trainers'
  );

  insert into public.staff_channels (center_id, type, name)
  select p_center_id, 'all_staff', 'All Staff'
  where not exists (
    select 1 from public.staff_channels where center_id = p_center_id and type = 'all_staff'
  );
end;
$$;

create function public.sync_staff_channel_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trainers_channel_id uuid;
  v_all_staff_channel_id uuid;
begin
  if new.role not in ('trainer', 'admin') then
    return new;
  end if;

  perform public.ensure_center_staff_channels(new.center_id);

  select id into v_trainers_channel_id
  from public.staff_channels where center_id = new.center_id and type = 'center_trainers';
  select id into v_all_staff_channel_id
  from public.staff_channels where center_id = new.center_id and type = 'all_staff';

  if new.role = 'trainer' then
    insert into public.staff_channel_members (channel_id, profile_id)
    values (v_trainers_channel_id, new.id)
    on conflict do nothing;
  end if;

  insert into public.staff_channel_members (channel_id, profile_id)
  values (v_all_staff_channel_id, new.id)
  on conflict do nothing;

  return new;
end;
$$;

create trigger sync_staff_channel_membership
after insert on public.profiles
for each row execute function public.sync_staff_channel_membership();

-- Backfill for centers/profiles that already existed before this migration.
do $$
declare
  c record;
  p record;
begin
  for c in select id from public.centers loop
    perform public.ensure_center_staff_channels(c.id);
  end loop;

  for p in select id, center_id, role from public.profiles where role in ('trainer', 'admin') loop
    if p.role = 'trainer' then
      insert into public.staff_channel_members (channel_id, profile_id)
      select sc.id, p.id from public.staff_channels sc
      where sc.center_id = p.center_id and sc.type = 'center_trainers'
      on conflict do nothing;
    end if;

    insert into public.staff_channel_members (channel_id, profile_id)
    select sc.id, p.id from public.staff_channels sc
    where sc.center_id = p.center_id and sc.type = 'all_staff'
    on conflict do nothing;
  end loop;
end $$;

-- ============================================================
-- DMs: created on demand, one channel per unique pair.
-- ============================================================

create function public.get_or_create_dm_channel(other_profile_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_my_role public.user_role;
  v_my_center uuid;
  v_other_role public.user_role;
  v_other_center uuid;
  v_channel_id uuid;
begin
  if v_me = other_profile_id then
    raise exception 'Cannot start a DM with yourself.';
  end if;

  select role, center_id into v_my_role, v_my_center from public.profiles where id = v_me;
  select role, center_id into v_other_role, v_other_center from public.profiles where id = other_profile_id;

  if v_my_role not in ('trainer', 'admin') or v_other_role not in ('trainer', 'admin') then
    raise exception 'DMs are only available between trainers and admins.';
  end if;

  if v_my_center is null or v_my_center is distinct from v_other_center then
    raise exception 'Can only message staff in your own center.';
  end if;

  select m1.channel_id into v_channel_id
  from public.staff_channel_members m1
  join public.staff_channel_members m2 on m2.channel_id = m1.channel_id
  join public.staff_channels sc on sc.id = m1.channel_id
  where sc.type = 'dm' and m1.profile_id = v_me and m2.profile_id = other_profile_id;

  if v_channel_id is not null then
    return v_channel_id;
  end if;

  insert into public.staff_channels (center_id, type) values (v_my_center, 'dm')
  returning id into v_channel_id;

  insert into public.staff_channel_members (channel_id, profile_id)
  values (v_channel_id, v_me), (v_channel_id, other_profile_id);

  return v_channel_id;
end;
$$;

-- ============================================================
-- RLS -- membership-gated, no policy ever matches a trainee since
-- trainees never get a staff_channel_members row.
-- ============================================================

alter table public.staff_channels enable row level security;
alter table public.staff_channel_members enable row level security;
alter table public.staff_messages enable row level security;

create policy "staff_channels: members can read their channels"
on public.staff_channels for select
to authenticated
using (
  exists (
    select 1 from public.staff_channel_members m
    where m.channel_id = staff_channels.id and m.profile_id = auth.uid()
  )
);

create policy "staff_channel_members: members can read fellow members of shared channels"
on public.staff_channel_members for select
to authenticated
using (
  exists (
    select 1 from public.staff_channel_members m2
    where m2.channel_id = staff_channel_members.channel_id and m2.profile_id = auth.uid()
  )
);

create policy "staff_messages: members can read messages in their channels"
on public.staff_messages for select
to authenticated
using (
  exists (
    select 1 from public.staff_channel_members m
    where m.channel_id = staff_messages.channel_id and m.profile_id = auth.uid()
  )
);

create policy "staff_messages: members can send messages in their channels"
on public.staff_messages for insert
to authenticated
with check (
  sender_id = auth.uid()
  and (public.is_trainer() or public.is_admin())
  and exists (
    select 1 from public.staff_channel_members m
    where m.channel_id = staff_messages.channel_id and m.profile_id = auth.uid()
  )
);

-- No INSERT/UPDATE/DELETE policy on staff_channels/staff_channel_members
-- for regular users -- those only ever change via the security-definer
-- functions/trigger above, never directly from the client.

-- ============================================================
-- Realtime
-- ============================================================

alter publication supabase_realtime add table public.staff_messages;
