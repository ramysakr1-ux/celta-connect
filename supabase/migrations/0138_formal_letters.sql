-- Letters.dc.html, "written by the system, signed by a person": Fail-risk,
-- assignment-warning, withdrawal, and deferral letters all share one shape
-- (letterhead, facts, drafted body, optional list, closing, signatures,
-- filed note) and one lifecycle (drafted -> tutor edits -> issued -> filed,
-- candidate acknowledges). One table across all four rather than four
-- near-identical ones -- what differs between them is the data that fills
-- the template, not the template or the lifecycle itself.
--
-- Withdrawal keeps its own existing operational model (profiles.course_
-- status et al, migration 0066) untouched -- this table only adds the
-- letter-issuance record layered on top for the two genuinely new letter
-- types (Fail-risk, assignment-warning) and deferral (layered on the
-- existing deferral_transfers row). Withdrawal's own letter PDF is
-- upgraded to match this spec's content without migrating its persistence.
--
-- snapshot is a written record, not a live view: Admin Handbook 9.2 (Fail-
-- risk) and 6.9 (deferral) are both cited as real compliance requirements
-- in the source design, so what was actually sent must stay stable even if
-- the underlying record (e.g. a criteria rating) changes afterward.
create table public.formal_letters (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  trainee_id uuid not null references public.profiles (id) on delete cascade,
  letter_type text not null check (letter_type in ('fail_risk', 'assignment_warning', 'deferral')),
  snapshot jsonb not null,
  issued_at timestamptz not null default now(),
  issued_by uuid not null references public.profiles (id),
  -- Same confirmed_at + narrow-RLS pattern as individual_tutorial_invites
  -- (0129): the server action is the trust boundary that only ever writes
  -- this one column on the trainee's own row.
  acknowledged_at timestamptz,
  related_assignment_id uuid references public.assignments (id) on delete set null,
  related_deferral_transfer_id uuid references public.deferral_transfers (id) on delete set null,
  created_at timestamptz not null default now()
);

create index formal_letters_course_id_idx on public.formal_letters (course_id);
create index formal_letters_trainee_id_idx on public.formal_letters (trainee_id);

alter table public.formal_letters enable row level security;

create policy "formal_letters: trainer manages their course's letters"
on public.formal_letters for all
to authenticated
using (public.is_trainer() and course_id = public.current_course_id())
with check (public.is_trainer() and course_id = public.current_course_id());

create policy "formal_letters: admin manages their center's letters"
on public.formal_letters for all
to authenticated
using (public.is_admin() and course_id in (select id from public.courses where center_id = public.current_center_id()))
with check (public.is_admin() and course_id in (select id from public.courses where center_id = public.current_center_id()));

create policy "formal_letters: trainee reads their own letters"
on public.formal_letters for select
to authenticated
using (trainee_id = auth.uid());

create policy "formal_letters: trainee acknowledges their own letter"
on public.formal_letters for update
to authenticated
using (trainee_id = auth.uid())
with check (trainee_id = auth.uid());
