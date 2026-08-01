-- One-time bootstrap: creates a starter center + course, and promotes
-- ramysakr1@gmail.com (created via Supabase Dashboard -> Authentication ->
-- Add user) to an admin profile so there's a way into the app at all.
-- Rename the center/course later from the admin dashboard once it exists.

do $$
declare
  v_center_id uuid;
  v_course_id uuid;
  v_user_id uuid;
begin
  select id into v_user_id from auth.users where email = 'ramysakr1@gmail.com';

  if v_user_id is null then
    raise exception 'No auth user found for ramysakr1@gmail.com. Create it first via Supabase Dashboard -> Authentication -> Add user.';
  end if;

  insert into public.centers (name)
  values ('My Center')
  returning id into v_center_id;

  insert into public.courses (center_id, name, start_date, end_date)
  values (v_center_id, 'Demo CELTA Course', current_date, current_date + interval '4 weeks')
  returning id into v_course_id;

  insert into public.profiles (id, email, full_name, role, center_id, course_id)
  values (v_user_id, 'ramysakr1@gmail.com', 'Ramy Sakr', 'admin', v_center_id, v_course_id);
end $$;
