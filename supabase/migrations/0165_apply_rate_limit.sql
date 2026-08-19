-- /apply (src/app/apply/actions.ts) is a fully public, unauthenticated
-- Server Action -- no session, no token, reachable by anyone. Every
-- submission triggers a real Anthropic/OpenAI-costing AI triage call
-- (runSelectionTaskTriage) and sends a real email to whatever address the
-- caller puts in the form, with no rate limiting at all. That's an open
-- cost-abuse vector and an email-relay-abuse vector (the centre's real
-- domain sending "We have your application" to arbitrary addresses) on a
-- live public form. One tiny row per attempt, keyed by IP, counted over a
-- rolling window before the action does anything else. Volume here is
-- centre-scale (dozens of applications, not millions), so no pruning job --
-- can be added later if this table ever actually grows large enough to
-- matter.
create table public.apply_ip_attempts (
  id uuid primary key default gen_random_uuid(),
  ip_address text not null,
  created_at timestamptz not null default now()
);

create index apply_ip_attempts_ip_created_idx on public.apply_ip_attempts (ip_address, created_at);

alter table public.apply_ip_attempts enable row level security;
-- No policies -- written and read only by submitApplication via the admin
-- client, same as every other service-role-only table.
