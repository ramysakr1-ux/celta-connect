-- migration 0079's own trigger-installer only covers tables that existed
-- when it ran -- malpractice_concern_notes (0206) is new since then, so a
-- demo visitor's session could write real, permanent rows there
-- unprotected (confirmed live 2026-08-25 testing 0206: the note-save path
-- went through in the demo where the case-open path was correctly
-- blocked). Re-running 0079's exact discovery block picks up every table
-- added since, not just this one -- idempotent (drop if exists, then
-- recreate), safe to run again even where the trigger already exists.
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
