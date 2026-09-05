-- Staff chat retention, swept by the database instead of by page loads.
--
-- Until now src/lib/staff-chat.ts ran the sweep on every hub page load:
-- a channels lookup, a courses lookup and one DELETE per distinct
-- retention value, per request, per tutor -- and only when somebody
-- opened a page (perf audit, 5 Sep 2026). Same rule, now hourly here:
-- every channel except the permanent centre_admin one loses messages
-- older than its course's chat_retention_days (default 1 = "nightly");
-- "course" mode has no rolling cutoff at all -- it is cleared at close-out
-- (course-close-out/wipe.ts), never here.

create or replace function public.sweep_staff_chat_retention()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from public.staff_messages m
  using public.staff_channels c
  left join public.courses co on co.id = c.course_id
  where m.channel_id = c.id
    and c.type <> 'centre_admin'
    and coalesce(co.chat_retention_mode, '') <> 'course'
    and m.created_at < now() - (coalesce(co.chat_retention_days, 1) || ' days')::interval;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

select cron.unschedule('staff-chat-retention-sweep')
where exists (select 1 from cron.job where jobname = 'staff-chat-retention-sweep');

select cron.schedule(
  'staff-chat-retention-sweep',
  '23 * * * *',
  $$ select public.sweep_staff_chat_retention(); $$
);
