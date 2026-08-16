-- "Refunds pending" -- the fourth stat card on Centre Admin's Overview
-- (Centre Admin.dc.html). There was nothing behind it: payment_instalments has
-- a 'refunded' status, but that is a finished state, so the card could only
-- ever have read zero.
--
-- Ramy, 2026-08-16, on what pending means: "if the money hasn't returned yet,
-- like, they agreed to a refund. And if Connect is connected to a provider,
-- and is waiting for that money to go out until it does -- or maybe the centre
-- admin would just click on it as in it's done. So it could be manual or it
-- could be automatic depending on the setting."
--
-- So a refund is agreed first and settled second, and the gap between those
-- two is the whole point of the card. A centre that agreed a refund three
-- weeks ago and never sent it needs to see that.

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers (id) on delete cascade,
  -- Either origin: a refund can be owed against an instalment already paid, or
  -- against a deposit taken before the candidate ever had an account.
  payment_instalment_id uuid references public.payment_instalments (id) on delete set null,
  applicant_id uuid references public.applicants (id) on delete set null,

  amount numeric(10, 2) not null check (amount > 0),
  currency text not null,
  reason text,

  -- 'pending' is the agreed-but-not-returned state the card counts.
  -- 'completed' means the money has actually left.
  -- 'cancelled' is for a refund agreed and then called off -- it must not
  -- silently vanish, because somebody was told it was coming.
  status text not null default 'pending' check (status in ('pending', 'completed', 'cancelled')),

  -- How it will be settled. Decided per refund rather than per centre, because
  -- a centre with a provider connected still refunds the occasional cash
  -- payment by hand.
  settlement text not null default 'manual' check (settlement in ('manual', 'provider')),
  -- The provider's own id once a payout is initiated, so a webhook can find
  -- this row -- same pattern as applicant_emails.provider_message_id.
  provider_refund_id text,

  agreed_by uuid references public.profiles (id) on delete set null,
  agreed_at timestamptz not null default now(),
  -- Set when the money actually left, by webhook or by a person ticking it.
  completed_at timestamptz,
  completed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index refunds_center_pending_idx on public.refunds (center_id) where status = 'pending';
create unique index refunds_provider_refund_id_idx
  on public.refunds (provider_refund_id)
  where provider_refund_id is not null;

alter table public.refunds enable row level security;

-- Reading a refund is reading money, so it follows payments visibility: the
-- read-only Centre manager sees them, which is the point of that role.
create policy "refunds: centre staff read their centre's"
on public.refunds for select
to authenticated
using (center_id = public.current_center_id());

-- Writes go through the admin client after the action checks payments.edit,
-- the same pattern the rest of Centre Admin uses -- the capability matrix
-- lives in TypeScript and RLS cannot see it.
