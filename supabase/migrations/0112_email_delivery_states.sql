-- for-claude-code-email-inventory.md, "Delivery & bounce handling":
-- "Four states from the mail provider: sent, delivered, opened, bounced."
--
-- Migration 0108 had two, sent/failed, where "sent" meant only that the
-- provider accepted the API call. Demonstrated live on 2026-08-16: an email to
-- an address at a domain that cannot receive mail was logged as "sent". The
-- spec's own line is the fix -- "delivery is tracked via the provider's
-- webhook... never assumed from a successful send."

alter table public.applicant_emails drop constraint if exists applicant_emails_status_check;
alter table public.applicant_emails add constraint applicant_emails_status_check check (status in (
  -- The provider accepted it. Says nothing about arrival.
  'sent',
  -- The provider confirmed delivery to the receiving server.
  'delivered',
  -- "shown for chasing purposes only, never treated as proof (image-blocking
  -- makes it unreliable both ways)".
  'opened',
  -- The one that creates a task.
  'bounced',
  -- Our own send call threw -- distinct from a provider bounce, because
  -- nothing ever left.
  'failed'
));

-- The provider's own id, so a webhook can find the row it belongs to. Without
-- it, delivery events arrive with nothing to attach to.
alter table public.applicant_emails add column provider_message_id text;
create unique index applicant_emails_provider_message_id_idx
  on public.applicant_emails (provider_message_id)
  where provider_message_id is not null;

-- "the provider's plain-language reason ('no such domain,' never a status
-- code)".
alter table public.applicant_emails add column bounce_reason text;
alter table public.applicant_emails add column delivered_at timestamptz;
alter table public.applicant_emails add column opened_at timestamptz;
alter table public.applicant_emails add column bounced_at timestamptz;

-- "**Only 'bounced' creates a task** -- on the admissions screen, scoped to the
-- candidate... Doesn't auto-clear; stays open until a later message to that
-- address delivers."
--
-- A task rather than a status on the email, because the thing needing action
-- outlives the message: the address is wrong, and it stays wrong until someone
-- fixes it or a later send to the same address succeeds.
create table public.email_bounce_tasks (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers (id) on delete cascade,
  applicant_id uuid references public.applicants (id) on delete cascade,
  email_address text not null,
  reason text,
  -- "After **two consecutive bounces** to the same address, Connect stops
  -- sending and requires a new address." Counted here so the send path has one
  -- place to ask.
  consecutive_bounces integer not null default 1,
  -- Cleared when a later message to that address delivers, never by someone
  -- ticking it off.
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (center_id, email_address)
);
create index email_bounce_tasks_center_id_idx on public.email_bounce_tasks (center_id) where resolved_at is null;

alter table public.email_bounce_tasks enable row level security;

create policy "email_bounce_tasks: admissions staff read their centre's"
on public.email_bounce_tasks for select
to authenticated
using (public.can_handle_admissions() and center_id = public.current_center_id());
