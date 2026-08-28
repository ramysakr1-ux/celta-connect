-- Ramy, 29 Aug 2026: "Stage One is auto-drafted by joining the tagged
-- strengths and action points from TP feedback. The trainee sees nothing
-- until the tutor hits Release to trainee; before that they get a 'not yet
-- released' state. Tutor can also un-release."
--
-- Today stage1_completed_at does two jobs at once: it means "the tutor
-- finished writing this" AND it is what the trainee's page keys off to show
-- it. So finishing Stage One publishes it in the same action, and a tutor
-- has no way to draft, review, or hold it back -- nor to take it back if
-- they filed it early.
--
-- Splitting the two: completed_at stays "the tutor finished it",
-- released_at becomes "the trainee can see it".
alter table public.celta5_records
  add column if not exists stage1_released_at timestamptz;

-- Existing records: anything already completed was, by the old behaviour,
-- already visible to its trainee. Backfilling from completed_at keeps that
-- true rather than silently retracting reports candidates have read.
update public.celta5_records
set stage1_released_at = stage1_completed_at
where stage1_completed_at is not null
  and stage1_released_at is null;

comment on column public.celta5_records.stage1_released_at is
  'When the tutor released Stage One to the trainee. Null means drafted but not visible. Separate from stage1_completed_at, which only means the tutor finished writing it.';

-- Ramy settled the un-release rule on his own criterion -- "it could
-- vanish, doesn't really matter as long as they read it and sign it". So
-- the gate is the signature, not the edit:
--
--   * Before the candidate signs, un-release freely. It disappears from
--     their view, the tutor revises, re-releases. Nothing is lost because
--     nothing has been attested to.
--   * Once they HAVE signed, the signature attests to specific text. A
--     tutor who still needs to revise re-releases, and re-releasing clears
--     the signature so the candidate signs the new version.
--
-- Enforced here rather than only in the action, so a signature can never
-- point at text that has since changed regardless of which code path moved
-- it. Clearing the signature is deliberate and destructive-by-design: it is
-- the mechanism, not a side effect.
create or replace function public.celta5_stage1_release_clears_signature()
returns trigger
language plpgsql
as $$
begin
  -- Only when the released moment actually changes to a new one, so an
  -- unrelated update to the row cannot wipe a signature.
  if new.stage1_released_at is distinct from old.stage1_released_at
     and new.stage1_released_at is not null
     and old.stage1_candidate_signed_at is not null then
    new.stage1_candidate_signed_at := null;
    new.stage1_candidate_signature_name := null;
  end if;
  return new;
end;
$$;

drop trigger if exists celta5_stage1_release_clears_signature on public.celta5_records;
create trigger celta5_stage1_release_clears_signature
before update on public.celta5_records
for each row
execute function public.celta5_stage1_release_clears_signature();
