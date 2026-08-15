-- Payments -- provider bridge, not a payment processor. Supersedes the
-- "payment is outside the app, no provider, ever" position from earlier the
-- same day (see the now-outdated comment in dashboard/admissions/actions.ts)
-- -- Ramy revisited that decision via a written spec later the same
-- session: Connect still never touches card data or holds funds, but can
-- now be linked to a third-party provider (Stripe) as a status bridge --
-- the provider processes the charge, Connect reflects what it reports.
--
-- Design: `payment_plans` is the agreed total + instalment count for one
-- applicant; `payments` is one row per instalment (the unified list the UI
-- shows -- provider-sourced and manually-marked rows coexist here, `source`
-- distinguishes them); `payment_provider_transactions` is the raw webhook
-- event log (audit trail + idempotency key, never shown directly to
-- staff); `payment_notifications` turns a missed instalment into a task --
-- "automation stops at 'tell someone', never escalates to 'do something
-- about it' on its own."

create table public.payment_plans (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  applicant_id uuid not null references public.applicants (id) on delete cascade,
  total_amount numeric not null check (total_amount > 0),
  currency text not null,
  instalment_count integer not null default 1 check (instalment_count >= 1),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id),
  -- One active plan per applicant for v1 -- keeps the UI to one list, not a
  -- history of superseded plans. Revisit if a real re-plan case shows up.
  unique (applicant_id)
);
create index payment_plans_center_id_idx on public.payment_plans (center_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers (id) on delete cascade,
  payment_plan_id uuid not null references public.payment_plans (id) on delete cascade,
  instalment_index integer not null check (instalment_index >= 1),
  amount numeric not null check (amount > 0),
  currency text not null,
  due_date date,

  status text not null default 'pending' check (status in ('pending', 'paid', 'missed', 'refunded')),
  -- null until resolved one way or another -- a payment link having been
  -- sent doesn't yet mean the applicant used it; this is set the moment a
  -- provider webhook or a manual mark actually lands.
  source text check (source in ('provider', 'manual')),

  -- Provider-sourced fields
  provider text,
  provider_checkout_url text,
  provider_transaction_id text,

  -- Manually-marked fields -- "never 'confirmed', always 'marked by' a
  -- named person" for this half, same principle as the old fee_paid model
  -- it replaces.
  marked_by uuid references public.profiles (id),
  marked_note text,

  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (payment_plan_id, instalment_index)
);
create index payments_center_id_idx on public.payments (center_id);
create index payments_plan_id_idx on public.payments (payment_plan_id);
create index payments_status_due_date_idx on public.payments (status, due_date);

-- Raw webhook event log -- never shown directly to staff, exists for audit
-- + idempotency (a provider can and will redeliver the same event).
create table public.payment_provider_transactions (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers (id) on delete cascade,
  provider text not null default 'stripe',
  provider_event_id text not null,
  payment_id uuid references public.payments (id) on delete set null,
  event_type text not null check (event_type in ('payment_succeeded', 'payment_failed', 'refunded')),
  amount numeric,
  currency text,
  raw_payload jsonb not null,
  received_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);
create index payment_provider_transactions_center_id_idx on public.payment_provider_transactions (center_id);

-- "A missed instalment... becomes a payments task that sits until a human
-- acts on it." Only ever inserted by the cron (admin client), never by a
-- staff action -- no authenticated INSERT policy needed, matches the
-- shape but not the earlier missing-INSERT-policy bug on
-- admissions_notifications (that one was hit by session-client inserts;
-- this table never is).
create table public.payment_notifications (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers (id) on delete cascade,
  payment_id uuid not null references public.payments (id) on delete cascade,
  type text not null check (type in ('instalment_missed')),
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index payment_notifications_center_id_idx on public.payment_notifications (center_id);

-- ============================================================
-- RLS -- same handling/deciding split as applicants: view is any
-- admissions staff, money decisions (plan setup, marking paid, sending a
-- payment link) require can_decide_admissions(), matching sendOffer/
-- rejectApplicant. No anonymous-write policy anywhere -- the webhook
-- handler writes via the admin client, same as /apply and /offer/[token].
-- ============================================================
alter table public.payment_plans enable row level security;
alter table public.payments enable row level security;
alter table public.payment_provider_transactions enable row level security;
alter table public.payment_notifications enable row level security;

create policy "payment_plans: admissions staff view their centre's"
on public.payment_plans for select to authenticated
using (public.can_handle_admissions() and center_id = public.current_center_id());

create policy "payment_plans: deciders manage their centre's"
on public.payment_plans for all to authenticated
using (public.can_decide_admissions() and center_id = public.current_center_id())
with check (public.can_decide_admissions() and center_id = public.current_center_id());

create policy "payments: admissions staff view their centre's"
on public.payments for select to authenticated
using (public.can_handle_admissions() and center_id = public.current_center_id());

create policy "payments: deciders manage their centre's"
on public.payments for all to authenticated
using (public.can_decide_admissions() and center_id = public.current_center_id())
with check (public.can_decide_admissions() and center_id = public.current_center_id());

create policy "payment_provider_transactions: admissions staff view their centre's"
on public.payment_provider_transactions for select to authenticated
using (public.can_handle_admissions() and center_id = public.current_center_id());

create policy "payment_notifications: admissions staff view their centre's"
on public.payment_notifications for select to authenticated
using (public.can_handle_admissions() and center_id = public.current_center_id());
