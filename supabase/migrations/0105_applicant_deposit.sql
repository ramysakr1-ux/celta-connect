-- The deposit is what lets a centre invite someone onto a course before the
-- balance is settled -- "maybe they haven't paid in full, but they paid a
-- deposit" (Ramy, 2026-08-16). Nothing modelled it: migration 0087 built a
-- provider status bridge, which answers "has instalment 3 been paid", not
-- "may we invite this person yet". Nothing marked any instalment as the
-- deposit, and sending an offer never referenced money at all.
--
-- It lives on the applicant rather than inside payment_plans on purpose. A
-- deposit normally arrives BEFORE any schedule is agreed -- it secures the
-- place, the balance gets planned afterwards -- but a `payments` row can only
-- exist inside a plan, and a plan needs a total and an instalment count. On
-- the applicant, "paid a deposit, nothing else agreed yet" is recordable,
-- which is the common case.
--
-- Deposits are frequently taken by bank transfer, so this is a record of what
-- a named person observed, never a claim Connect processed anything -- same
-- "never 'confirmed', always 'marked by'" principle as the manual half of
-- payments.

alter table public.applicants add column deposit_amount numeric check (deposit_amount > 0);
alter table public.applicants add column deposit_currency text;
alter table public.applicants add column deposit_paid_at timestamptz;
alter table public.applicants add column deposit_marked_by uuid references public.profiles (id);
alter table public.applicants add column deposit_note text;

-- A deposit recorded as paid with no amount would show up in "deposits held"
-- as nothing, which is worse than not recording it.
alter table public.applicants add constraint applicants_deposit_needs_amount
  check (deposit_paid_at is null or deposit_amount is not null);

create index applicants_deposit_paid_at_idx on public.applicants (deposit_paid_at)
  where deposit_paid_at is not null;
