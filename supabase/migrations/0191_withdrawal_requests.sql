-- connect-withdrawal-precourse-scope-spec-2026-08-21.md item 2: the
-- candidate-facing self-serve request Withdrawal Form.dc.html describes,
-- kept fully separate from the existing staff-initiated flow
-- (withdraw-card.tsx / status-actions.ts, untouched). Submitting this does
-- NOT execute the withdrawal or deferral itself -- it's a request that
-- lands in front of the trainer, who still runs withdrawTrainee() /
-- markForDeferral() to actually action it (same as if they'd typed the
-- reason themselves). The candidate's own note, confirmations and
-- signature are preserved here rather than discarded once actioned, so
-- the trainer's own decision has the candidate's real words attached.
create table public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  trainee_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  kind text not null check (kind in ('withdraw', 'defer')),
  reason_tag text,
  note text,
  effective_date date,
  -- Withdrawal-only ("would you like to keep attending sessions?") --
  -- null on a deferral request, where it doesn't apply.
  still_attending boolean,
  -- Snapshot of which confirmation sentences were shown and ticked, for
  -- the trainer's own record -- not re-derived from the kind later, in
  -- case the confirmation wording changes after this request was signed.
  confirmations text[] not null default '{}',
  signed_name text not null,
  signed_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'actioned')),
  actioned_by uuid references public.profiles (id) on delete set null,
  actioned_at timestamptz,
  created_at timestamptz not null default now()
);

create index withdrawal_requests_trainee_id_idx on public.withdrawal_requests (trainee_id);
create index withdrawal_requests_course_id_idx on public.withdrawal_requests (course_id);

alter table public.withdrawal_requests enable row level security;

create policy "withdrawal_requests: trainee manages their own"
on public.withdrawal_requests for all
to authenticated
using (trainee_id = auth.uid())
with check (trainee_id = auth.uid());

create policy "withdrawal_requests: trainer/admin read and action requests on their course"
on public.withdrawal_requests for all
to authenticated
using ((public.is_trainer() or public.is_admin()) and course_id = public.current_course_id())
with check ((public.is_trainer() or public.is_admin()) and course_id = public.current_course_id());
