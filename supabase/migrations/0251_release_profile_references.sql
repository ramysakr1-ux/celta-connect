-- "Delete this centre" cannot finish for any centre that has been used.
--
-- The flow (src/app/centre/settings/actions.ts) archives every course to
-- Drive, then deletes each profile's auth.users row -- which cascades the
-- profiles row -- and finally calls centre_hard_delete(). But 35 tables
-- hold foreign keys to profiles.id WITHOUT on delete cascade: audit and
-- provenance columns like applicant_emails.sent_by, payments.marked_by,
-- tp_points.created_by, centre_owner_actions.actor_profile_id. Most were
-- added in migrations later than centre_hard_delete (0156) and none were
-- ever added to it.
--
-- So deleteUser() fails with a foreign-key violation, the action returns
-- "Stopped partway through removing accounts", and running it again fails
-- the same way -- while the centre is left with some accounts already
-- gone. Found 29 Aug 2026 when the demo seed's own teardown hit exactly
-- this and left a centre with data and no working logins.
--
-- Released generically rather than table by table, so a table added next
-- month is handled without editing this again: walk pg_constraint for
-- every FK pointing at profiles and either null the column (nullable --
-- the row survives, only the "who did this" pointer goes) or delete the
-- referencing row (NOT NULL -- the row cannot exist without its actor).
--
-- Scoped strictly to one centre's own profiles. Nothing belonging to
-- another centre is touched.
create or replace function public.centre_release_profile_references(p_center_id uuid)
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
        'update %s set %I = null where %I in (select id from public.profiles where center_id = $1)',
        r.tbl, r.col, r.col
      ) using p_center_id;
    else
      execute format(
        'delete from %s where %I in (select id from public.profiles where center_id = $1)',
        r.tbl, r.col
      ) using p_center_id;
    end if;
  end loop;
end;
$$;

revoke all on function public.centre_release_profile_references(uuid) from public, anon, authenticated;

-- Belt and braces: centre_hard_delete() calls it too, so a caller that
-- forgets the step still succeeds rather than failing on a raw FK error.
create or replace function public.centre_hard_delete(p_center_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.centre_release_profile_references(p_center_id);

  -- Unchanged from 0156: the caller is expected to have removed every
  -- auth.users account for this centre, which cascades its profiles row.
  if exists (select 1 from public.profiles where center_id = p_center_id) then
    raise exception 'Profiles still exist for this centre -- delete their accounts first.';
  end if;

  delete from public.restart_transfers where center_id = p_center_id;
  delete from public.deferral_transfers where center_id = p_center_id;
  delete from public.course_close_outs where center_id = p_center_id;

  delete from public.centers where id = p_center_id;
end;
$$;

revoke all on function public.centre_hard_delete(uuid) from public, anon, authenticated;
