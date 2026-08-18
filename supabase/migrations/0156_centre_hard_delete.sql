-- for-claude-code-centre-settings.md addendum: "Delete this centre...
-- every course, candidate record, and CELTA 5 in the centre becomes
-- inaccessible." Confirmed with Ramy 2026-08-19: hard-delete, immediately,
-- no grace period -- distinct from close-out's own export-then-erase
-- pattern, which is a per-course, planned wind-down, not this.
--
-- Checked the actual FK graph before writing this rather than assuming:
-- the overwhelming majority of tables already cascade from centers (47
-- FKs checked; all but a handful are `on delete cascade`, most of them
-- transitively through courses.center_id, which itself cascades). Three
-- real exceptions needed explicit handling:
--   - profiles.center_id is `on delete restrict` (deliberately, so a
--     centre can't vanish out from under active accounts by accident) --
--     profiles must be gone before the centre row can go. profiles.id
--     itself cascades from auth.users, so the calling code deletes
--     auth.users via the Admin API first (not raw SQL -- auth.users is
--     managed by Supabase's own auth service); this function only handles
--     the plain-SQL half.
--   - restart_transfers.center_id and deferral_transfers.center_id have
--     no ON DELETE clause at all (defaults to NO ACTION) and don't
--     cascade via source_course_id either -- explicit deletes here.
-- course_close_outs.center_id also has no ON DELETE clause, but its rows
-- are already removed via course_close_outs.course_id's own cascade once
-- courses.center_id cascades the courses themselves -- included below
-- anyway, defensively, since a query is cheap and a wrong assumption here
-- is not.
--
-- security definer + a fixed search_path so this runs with the owner's
-- privileges regardless of caller, same reasoning as current_center_id()
-- and friends already use.
create or replace function public.centre_hard_delete(p_center_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Guard: refuse silently on a centre that still has profiles left --
  -- the caller is expected to have already removed every auth.users
  -- account for this centre (which cascades their profiles row). This
  -- function is the "everything else" half, never the whole operation on
  -- its own, so a stray remaining profile means the caller sequenced
  -- things wrong rather than something this function should paper over.
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

-- "Delete specifically also gets identity re-verification on top of the
-- role gate and type-to-confirm: ... a confirmation code emailed to the
-- owner, before the delete actually executes." Chose the emailed-code
-- path over password re-entry -- same guarantee, without a password ever
-- touching a server action's plain-text formData. One row per request;
-- a code is single-use (consumed_at) and expires in 15 minutes so an old
-- email lying around doesn't stay a live key to the centre indefinitely.
create table public.centre_delete_codes (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers (id) on delete cascade,
  requested_by uuid not null references public.profiles (id),
  code text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index centre_delete_codes_center_id_idx on public.centre_delete_codes (center_id);

alter table public.centre_delete_codes enable row level security;
-- No policies -- this table is never read or written under a session-
-- scoped client, only the admin client from the delete-centre server
-- actions. Same "no self-service policy" pattern as centre_roles' own
-- write path.
