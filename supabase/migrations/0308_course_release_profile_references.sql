-- Close-out's wipe cannot finish for any course a candidate has restarted
-- or deferred from.
--
-- This is 0251 again, one scope down. That migration found that 35 tables
-- hold foreign keys to profiles.id WITHOUT on delete cascade, so deleting
-- an auth.users row -- which cascades its profiles row -- fails on a
-- foreign-key violation, and fixed it for "delete this centre".
--
-- The course close-out wipe (src/lib/course-close-out/wipe.ts) does exactly
-- the same thing and never got the same treatment. restart_transfers
-- .source_trainee_id and deferral_transfers.source_trainee_id are both NOT
-- NULL references to profiles with no on-delete clause, so a candidate who
-- failed, then restarted on the next course, cannot be deleted when their
-- original course is closed out. The cron's deleteUser() raises, the course
-- is left half-wiped with some accounts already gone, its status stays
-- 'grace_period', and every following night tries and fails the same way.
--
-- Nobody has hit it because no course has ever been closed out (walked
-- 15 Sep 2026).
--
-- Same generic walk as 0251, so a table added next month is handled without
-- editing this again: for every FK pointing at profiles, null the column
-- where it is nullable (the row survives, only the "who did this" pointer
-- goes) or delete the referencing row where it is NOT NULL (the row cannot
-- exist without its actor). Scoped strictly to the TRAINEES of one course:
-- tutors are never deleted by close-out, and no other course is touched.
--
-- Safe to re-run.
create or replace function public.course_release_trainee_references(p_course_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  nullable boolean;
begin
  for r in
    select
      con.conrelid::regclass::text as tbl,
      att.attname::text            as col
    from pg_constraint con
    join unnest(con.conkey) with ordinality as k(attnum, ord) on true
    join pg_attribute att on att.attrelid = con.conrelid and att.attnum = k.attnum
    where con.contype = 'f'
      and con.confrelid = 'public.profiles'::regclass
      and con.conrelid <> 'public.profiles'::regclass
  loop
    select not a.attnotnull into nullable
    from pg_attribute a
    where a.attrelid = r.tbl::regclass and a.attname = r.col;

    if nullable then
      execute format(
        'update %s set %I = null where %I in (select id from public.profiles where course_id = $1 and role = ''trainee'')',
        r.tbl, r.col, r.col
      ) using p_course_id;
    else
      execute format(
        'delete from %s where %I in (select id from public.profiles where course_id = $1 and role = ''trainee'')',
        r.tbl, r.col
      ) using p_course_id;
    end if;
  end loop;
end;
$$;

revoke all on function public.course_release_trainee_references(uuid) from public, anon, authenticated;

comment on function public.course_release_trainee_references(uuid) is
  'Releases every foreign key pointing at the TRAINEES of one course, so close-out can delete their accounts. Course-scoped twin of centre_release_profile_references (0251).';

notify pgrst, 'reload schema';

select
  p.proname as function,
  pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('centre_release_profile_references', 'course_release_trainee_references')
order by p.proname;
