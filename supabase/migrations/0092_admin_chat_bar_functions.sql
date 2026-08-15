-- "Course admin and centre admin or centre owner -- all the administrators
-- ... can chat with each other. The trainers are inside the course, and
-- they are not connected to what's outside the course. What's outside is
-- outside, what's inside is inside." (Ramy, 2026-08-14, resolving a real
-- conflict between this spec and the already-locked-in "no admin
-- exception, ever" rule on course chat from migration 0039.)
--
-- So this is a genuinely SEPARATE, admin-only channel, one per course, for
-- admins to coordinate about that course with each other -- it does NOT
-- add admins to the trainer-only channel `sync_staff_channel_membership`
-- (0039) manages, and that function/trigger is untouched here. A distinct
-- trigger function, a distinct additive RLS policy -- "what's inside
-- [trainer course chat] stays inside" is fully preserved, not weakened.

create function public.ensure_course_admin_channel(p_course_id uuid, p_center_id uuid)
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
  select v_channel_id, p.id from public.profiles p where p.center_id = p_center_id and p.role = 'admin'
  on conflict do nothing;

  return v_channel_id;
end;
$$;

-- New course -> provision its admin channel immediately.
create function public.provision_course_admin_channel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_course_admin_channel(new.id, new.center_id);
  return new;
end;
$$;

create trigger provision_course_admin_channel
after insert on public.courses
for each row execute function public.provision_course_admin_channel();

-- New admin -> join every course_admin channel at their centre. Someone
-- who stops being admin (role change) is removed from all of them, same
-- "don't leave someone reachable somewhere they've left" principle as
-- 0039's trainer sync -- but this is its own distinct trigger function,
-- deliberately not touching sync_staff_channel_membership at all.
create function public.sync_admin_channel_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role != 'admin' then
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

create trigger sync_admin_channel_membership
after insert or update of role, center_id on public.profiles
for each row execute function public.sync_admin_channel_membership();

-- Admins can send in course_admin channels specifically -- additive to
-- (not replacing) the existing trainer/trainee-only INSERT policy from
-- 0041, which stays exactly as-is.
create policy "staff_messages: admins can send in course_admin channels"
on public.staff_messages for insert
to authenticated
with check (
  sender_id = auth.uid()
  and public.is_admin()
  and exists (
    select 1 from public.staff_channel_members m
    join public.staff_channels sc on sc.id = m.channel_id
    where m.channel_id = staff_messages.channel_id and m.profile_id = auth.uid() and sc.type = 'course_admin'
  )
);

-- Backfill: every course that already exists gets its admin channel now.
do $$
declare
  c record;
begin
  for c in select id, center_id from public.courses loop
    perform public.ensure_course_admin_channel(c.id, c.center_id);
  end loop;
end;
$$;
