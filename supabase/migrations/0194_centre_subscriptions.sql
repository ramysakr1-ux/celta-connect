-- Command center (specs/for-claude-code-command-center-belongs-in-connect.md):
-- MRR, renewals due and outstanding invoices need somewhere real to come
-- from. Nothing in the schema tracks a centre's subscription to Connect
-- itself -- `payments`/`payment_plans` (0087) are a candidate's course fees
-- paid TO a centre, a different relationship entirely. No payment provider
-- is wired for this yet (per that spec, that's deliberately its own later
-- piece of work), so this is hand-entered by the platform owner -- same
-- "never auto-confirmed, always marked by a named person" shape as the
-- existing payments system, not a live billing feed.
--
-- centre_subscriptions: one active plan per centre, mirrors payment_plans'
-- unique(applicant_id) "one active plan, revisit if a real history case
-- shows up" choice. centre_invoices: one row per billing period, the thing
-- "outstanding invoices" and "renewals due" are actually counted from.
create table public.centre_subscriptions (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers (id) on delete cascade,
  plan_name text not null,
  monthly_amount numeric not null check (monthly_amount > 0),
  currency text not null,
  status text not null default 'active' check (status in ('trial', 'active', 'past_due', 'cancelled')),
  renewal_date date,
  notes text,
  marked_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (center_id)
);
create index centre_subscriptions_status_idx on public.centre_subscriptions (status);
create index centre_subscriptions_renewal_date_idx on public.centre_subscriptions (renewal_date);

create trigger set_updated_at before update on public.centre_subscriptions
for each row execute function public.set_updated_at();

create table public.centre_invoices (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers (id) on delete cascade,
  centre_subscription_id uuid references public.centre_subscriptions (id) on delete set null,
  amount numeric not null check (amount > 0),
  currency text not null,
  due_date date,
  status text not null default 'outstanding' check (status in ('outstanding', 'paid', 'void')),
  note text,
  marked_by uuid references public.profiles (id),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index centre_invoices_center_id_idx on public.centre_invoices (center_id);
create index centre_invoices_status_due_date_idx on public.centre_invoices (status, due_date);

-- RLS is defense-in-depth here, not the access-control mechanism -- the
-- command center route reads/writes through the service-role admin client,
-- same pattern as /platform (0193's comment on why: this is the one screen
-- meant to see across every centre, and true cross-centre RLS is out of
-- scope). Deliberately platform_owner only, not is_admin() -- this is
-- Ramy's own revenue data, a centre's own admin should not see it just for
-- holding 'admin' at their centre.
alter table public.centre_subscriptions enable row level security;
alter table public.centre_invoices enable row level security;

create policy "centre_subscriptions: platform owner only"
on public.centre_subscriptions for all to authenticated
using (public.current_role() = 'platform_owner')
with check (public.current_role() = 'platform_owner');

create policy "centre_invoices: platform owner only"
on public.centre_invoices for all to authenticated
using (public.current_role() = 'platform_owner')
with check (public.current_role() = 'platform_owner');
