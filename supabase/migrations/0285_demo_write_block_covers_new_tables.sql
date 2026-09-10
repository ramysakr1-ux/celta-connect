-- The shared demo was not read-only.
--
-- Migration 0079 promised that "a new table added later that follows the same
-- naming convention is covered automatically without a follow-up migration."
-- It is not. Its DO block ran once, over the tables that existed in August, and
-- nothing has re-run it since. Fifteen tables added after it -- including
-- course_broadcast_reads, written this morning -- carry a center_id, course_id
-- or trainee_id and have no trigger on them at all.
--
-- Found 10 Sep 2026 by the write-path harness, which signed in as a demo
-- trainee and successfully wrote to the demo course. The demo tells every
-- visitor "This is a shared demo -- changes are not saved." For these tables it
-- was saving them, and the demo is ONE shared centre, so a visitor's marks
-- carried over to whoever opened it next:
--
--   scavenger_hunt_progress      one visitor's "2 of 6 found" became everyone's
--   pre_course_task_responses    one visitor's answers became everyone's
--   course_broadcast_reads       notices read once showed read for good
--   assessor_prep_marks          a demo assessor's ticks persisted
--   consultation_blocks/slots    a demo trainee could book a real-looking slot
--
-- The same loop, re-run. It drops and recreates, so it is safe on tables that
-- already have the trigger, and safe to run again.
--
-- This does not make 0079's claim true for tables added AFTER today -- that
-- would need an event trigger on CREATE TABLE, which is a bigger hammer than
-- this schema wants. What it does is make the fix one line to re-run, and say
-- plainly that re-running it is a step, not an automatic.

do $$
declare
  t record;
begin
  for t in
    select distinct c.table_name
    from information_schema.columns c
    join information_schema.tables tbl
      on tbl.table_schema = c.table_schema and tbl.table_name = c.table_name and tbl.table_type = 'BASE TABLE'
    where c.table_schema = 'public'
      and c.column_name in ('center_id', 'course_id', 'trainee_id', 'sender_id', 'tp_plan_id', 'assignment_id', 'channel_id')
      and c.table_name not in ('centers')
  loop
    execute format(
      'drop trigger if exists block_demo_writes on public.%I; ' ||
      'create trigger block_demo_writes before insert or update or delete on public.%I ' ||
      'for each row execute function public.block_demo_center_writes();',
      t.table_name, t.table_name
    );
  end loop;
end $$;
