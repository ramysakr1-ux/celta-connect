-- Ramy, 28 Aug 2026: "the logic behind everything" -- same current_date-
-- reads-UTC bug as 0232, found in two more live functions while auditing
-- every current_date usage across the migrations history.

-- ------------------------------------------------------------------
-- fol_divergence_session_reached (0088): a real RLS gate on
-- volunteer_signup_profiles ("trainees view after divergence session"),
-- not just cosmetic -- it currently opens/closes on the UTC calendar day,
-- not the course's own centre's local day. Off by several hours around
-- local midnight for any centre away from UTC.
-- ------------------------------------------------------------------
create or replace function public.fol_divergence_session_reached(target_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select (now() at time zone coalesce(ctr.time_zone, 'Europe/Istanbul'))::date >= tenth_day.event_date
      from public.courses c
      join public.centers ctr on ctr.id = c.center_id
      join (
        select distinct event_date
        from public.course_timetable_events
        where course_id = target_course_id
        order by event_date
        offset 9 limit 1
      ) tenth_day on true
      where c.id = target_course_id
    ),
    false
  );
$$;

-- ------------------------------------------------------------------
-- run_final_day_withdrawal_sweep (0186): the daily cron auto-withdrawal
-- sweep compared every course's end_date against one shared UTC
-- current_date, rather than each course's own centre's local date --
-- across a fleet of centres in different timezones, a single UTC cutoff
-- can't be right for all of them at once.
-- ------------------------------------------------------------------
create or replace function public.run_final_day_withdrawal_sweep()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles p
  set course_status = 'withdrawn',
      course_status_set_at = now(),
      course_status_note = 'Auto-withdrawn: the final-day declaration was never signed and no final grade was ever recorded, after the course''s own end date passed.'
  from public.courses c
  join public.centers ctr on ctr.id = c.center_id
  join public.celta5_records r on true
  where p.course_id = c.id
    and r.trainee_id = p.id
    and p.role = 'trainee'
    and p.course_status = 'active'
    and c.end_date < (now() at time zone coalesce(ctr.time_zone, 'Europe/Istanbul'))::date
    and r.trainee_signoff_final_at is null
    and r.final_recommended_grade is null;
end;
$$;
