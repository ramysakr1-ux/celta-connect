-- The green light. Ramy, 2026-08-16, resolving how a candidate gets into
-- Connect: "The link only goes there once they are accepted on the course, or
-- once the centre admin signals that they are accepted. This could be done
-- after they pay in full, or pay a deposit, or they promise to pay. But before
-- they receive the Connect link, there should be a green light from the
-- centre."
--
-- So access is gated on a DECISION, not on a payment. That distinction is the
-- whole design: a centre that lets someone start on a promise can do so, and a
-- centre that insists on cleared funds can do that instead, without the
-- software having an opinion about which is correct.
--
-- It also settles a conflict. The app currently creates the account when the
-- offer link is accepted, which means a candidate can hold full workspace
-- access having paid nothing and having had no green light at all. That path
-- has to move behind this gate.
--
-- The automatic case still exists and is not in tension with this: when a
-- connected provider confirms payment, that confirmation can BE the green
-- light, recorded here with released_reason = 'provider_confirmed'. Same shape
-- as refunds in 0116 -- manual or automatic depending on the centre's setup.

alter table public.applicants add column if not exists workspace_released_at timestamptz;
alter table public.applicants add column if not exists workspace_released_by uuid references public.profiles (id) on delete set null;
alter table public.applicants add column if not exists workspace_released_reason text
  check (workspace_released_reason is null or workspace_released_reason in (
    -- Cleared funds, by whatever route.
    'paid_in_full',
    'deposit_paid',
    -- "or they promise to pay" -- a real, chosen state, not a loophole. Named
    -- explicitly so a centre can see who was let in on trust and chase them.
    'promised_to_pay',
    -- A provider webhook confirmed payment and released it without a person.
    'provider_confirmed',
    -- Scholarship, staff place, transfer from another intake.
    'other'
  ));
alter table public.applicants add column if not exists workspace_released_note text;

comment on column public.applicants.workspace_released_at is
  'When the centre green-lit workspace access. Null means no Connect link has been sent, whatever has been paid.';
comment on column public.applicants.workspace_released_reason is
  'Why access was granted. promised_to_pay is deliberate and visible, so a centre can see who is in on trust.';

-- Anyone already holding an account plainly had their green light, whatever
-- the old flow called it -- backfilled so the new gate does not read as though
-- every existing candidate is unreleased.
update public.applicants
   set workspace_released_at = coalesce(workspace_released_at, accepted_at, deposit_paid_at),
       workspace_released_reason = coalesce(workspace_released_reason, 'other'),
       workspace_released_note = coalesce(workspace_released_note, 'Backfilled: predates the green-light gate.')
 where stage = 'accepted'
   and workspace_released_at is null;
