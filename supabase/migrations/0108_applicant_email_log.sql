-- Nothing recorded whether an applicant email was ever sent. The only trace
-- anywhere was `applicants.offer_sent_at`; send a rejection or a waiting-list
-- email and the database looked identical afterwards. So the Centre Admin view
-- Ramy asked for -- "whether they were sent or not" -- had nothing to read.
--
-- Logged inside sendApplicantEmail (the single send path, six call sites
-- including the crons), so a new email type cannot forget to record itself.
--
-- Failures are logged too, deliberately: an email that bounced is exactly the
-- one a centre needs to know about, and a log that only kept successes would
-- quietly imply everyone was contacted.

create table public.applicant_emails (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers (id) on delete cascade,
  applicant_id uuid references public.applicants (id) on delete set null,

  -- The two not-yet-built types are listed now so building them later needs no
  -- migration: 'interview_invitation' (sent when a candidate passes the
  -- pre-interview task) and 'welcome' (on acceptance / the Friday before the
  -- course starts).
  type text not null check (type in (
    'offer', 'rejection', 'waiting_list', 'place_freed', 'not_this_time',
    'interview_invitation', 'welcome'
  )),

  to_email text not null,
  subject text not null,

  -- 'sent' means the provider accepted it, never that it was read or even
  -- delivered -- delivery webhooks are a separate, unbuilt piece, so the
  -- wording here must not overclaim.
  status text not null check (status in ('sent', 'failed')),
  error text,

  -- Null for anything a cron sent, which is how the UI can say "sent
  -- automatically" rather than naming a person who didn't do it.
  sent_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index applicant_emails_center_id_idx on public.applicant_emails (center_id, created_at desc);
create index applicant_emails_applicant_id_idx on public.applicant_emails (applicant_id);

alter table public.applicant_emails enable row level security;

-- Same audience as the rest of admissions: is_admin() or is_trainer() or a
-- nominated admissions handler. Read-only from a session -- rows are written
-- server-side by the send path, so a log entry can't be forged or suppressed.
create policy "applicant_emails: admissions staff read their centre's"
on public.applicant_emails for select
to authenticated
using (public.can_handle_admissions() and center_id = public.current_center_id());
