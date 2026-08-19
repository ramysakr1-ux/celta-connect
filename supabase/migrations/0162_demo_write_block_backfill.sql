-- migration 0079's own comment claimed "a new table added later that
-- follows the same naming convention is covered automatically without a
-- follow-up migration" -- false. The trigger-installer is a one-time DO
-- block reading information_schema.columns at the moment 0079 itself ran,
-- not a schema-level event trigger, so it only ever attached
-- block_demo_writes to tables that existed AT THAT POINT. 82 migrations
-- since then have added tables with center_id/course_id/trainee_id/etc
-- columns (nearly everything built since -- payments, admissions AI
-- triage, Trainer-in-Training, branch referral, this session's own work)
-- and NONE of them got the trigger. /demo is a live, reachable route
-- (src/app/demo/route.ts), so this was a real, currently-open gap in the
-- "every write genuinely blocked at the database layer" guarantee, not a
-- theoretical one.
--
-- Same function, unchanged -- re-declared defensively in case this ever
-- runs against an environment where 0079 didn't. Same installer DO block,
-- run again against the CURRENT schema so every qualifying table --
-- old and new -- ends up covered. Idempotent: drop-if-exists/create on
-- every matching table, so re-running this against already-covered tables
-- is a no-op, not a duplicate.

create or replace function public.block_demo_center_writes() returns trigger as $$
declare
  row_data jsonb := to_jsonb(coalesce(new, old));
  target_center_id uuid;
begin
  if row_data ? 'center_id' then
    target_center_id := (row_data->>'center_id')::uuid;
  elsif row_data ? 'id' and tg_table_name = 'centers' then
    target_center_id := (row_data->>'id')::uuid;
  elsif row_data ? 'course_id' then
    select center_id into target_center_id from public.courses where id = (row_data->>'course_id')::uuid;
  elsif row_data ? 'trainee_id' then
    select center_id into target_center_id from public.profiles where id = (row_data->>'trainee_id')::uuid;
  elsif row_data ? 'sender_id' then
    select center_id into target_center_id from public.profiles where id = (row_data->>'sender_id')::uuid;
  elsif row_data ? 'tp_plan_id' then
    select c.center_id into target_center_id
    from public.tp_plans p join public.courses c on c.id = p.course_id
    where p.id = (row_data->>'tp_plan_id')::uuid;
  elsif row_data ? 'assignment_id' then
    select c.center_id into target_center_id
    from public.assignments a join public.courses c on c.id = a.course_id
    where a.id = (row_data->>'assignment_id')::uuid;
  elsif row_data ? 'channel_id' then
    select center_id into target_center_id from public.staff_channels where id = (row_data->>'channel_id')::uuid;
  end if;

  if auth.role() = 'authenticated' and target_center_id is not null
     and exists (select 1 from public.centers where id = target_center_id and is_demo = true) then
    raise exception 'This is a shared demo -- changes are not saved.';
  end if;

  return coalesce(new, old);
end;
$$ language plpgsql security definer set search_path = public;

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

  execute 'drop trigger if exists block_demo_writes on public.centers; ' ||
    'create trigger block_demo_writes before update or delete on public.centers ' ||
    'for each row execute function public.block_demo_center_writes();';
end $$;
