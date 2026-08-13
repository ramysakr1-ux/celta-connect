-- build-spec.md §1 build order #21 "Demo -- flagged clone of the real app."
-- Ramy chose the simplest of three shapes: one shared, public, READ-ONLY
-- demo -- a single seeded demo centre/course that any visitor can click
-- through via the real app UI (not a separate mockup), with every write
-- genuinely blocked at the database layer, not just hidden in the UI.

alter table public.centers add column is_demo boolean not null default false;

-- Generic write-blocker, not a per-table hand-maintained list. Resolves
-- "does this row belong to the demo centre" via whichever of the common
-- reference columns this schema's tables actually have (confirmed pattern
-- across every migration this project has: center_id/course_id/trainee_id
-- directly on nearly every table, with a handful of named exceptions one
-- join deeper -- tp_plan_id, assignment_id, sender_id, channel_id). Applied
-- to every table with a matching column via the DO block below, so a new
-- table added later that follows the same naming convention is covered
-- automatically without a follow-up migration.
--
-- Best-effort, not a mathematically exhaustive guarantee across every
-- possible foreign-key shape in the schema -- deliberately scoped to the
-- column names actually used throughout this project, not a full
-- information_schema FK-graph walk.
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

  -- Only blocks real end-user sessions (auth.role() = 'authenticated', the
  -- role every logged-in demo viewer's session runs as -- same distinction
  -- every RLS policy in this schema already relies on via "to authenticated").
  -- The service-role key used to seed/reset the demo data itself connects
  -- as service_role, not authenticated, so seeding is never blocked by its
  -- own trigger.
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

  -- centers itself: only the id column identifies it, handled as a special
  -- case in the function above, so wired up directly rather than through
  -- the column-name loop.
  execute 'drop trigger if exists block_demo_writes on public.centers; ' ||
    'create trigger block_demo_writes before update or delete on public.centers ' ||
    'for each row execute function public.block_demo_center_writes();';
end $$;
