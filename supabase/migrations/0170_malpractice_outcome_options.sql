-- for-claude-code-malpractice-outcomes.md (Desktop, 2026-08-20): Handbook
-- 8.2.4 requires the centre to hold its own internal malpractice policy --
-- Connect must never invent one. A case resolves to whichever outcome the
-- centre's own policy defines, not a hardcoded upheld/not_upheld pair.
--
-- Each outcome carries two real, executable consequence flags -- what the
-- reference design's four example outcomes actually differ on beneath their
-- labels. A "written warning" or any other policy nuance lives in the
-- centre's own label text, not as more booleans here: Connect records and
-- displays the decision, it doesn't generate warning letters or referrals
-- on its own.
create table public.malpractice_outcome_options (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers (id) on delete cascade,
  label text not null,
  fails_assignment boolean not null default false,
  flagged_for_referral boolean not null default false,
  created_at timestamptz not null default now()
);

create index malpractice_outcome_options_center_id_idx on public.malpractice_outcome_options (center_id);

alter table public.malpractice_outcome_options enable row level security;

create policy "malpractice_outcome_options: trainer/admin manage their center's outcomes"
on public.malpractice_outcome_options for all
to authenticated
using (
  (public.is_trainer() or public.is_admin())
  and center_id = public.current_center_id()
)
with check (
  (public.is_trainer() or public.is_admin())
  and center_id = public.current_center_id()
);

-- The case keeps its own copy of what an outcome meant AT THE TIME it was
-- picked (fails_assignment/flagged_for_referral denormalized below, same as
-- decision_notes already does for the tutor's reasoning) -- editing or
-- deleting a centre's outcome option later must never rewrite history on an
-- already-decided case. outcome_option_id is kept only as a soft pointer
-- back to which option was used, for a centre that wants to audit that.
alter table public.malpractice_cases drop constraint if exists malpractice_cases_outcome_check;
alter table public.malpractice_cases add column outcome_option_id uuid references public.malpractice_outcome_options (id) on delete set null;
alter table public.malpractice_cases add column fails_assignment boolean;
alter table public.malpractice_cases add column flagged_for_referral boolean;
