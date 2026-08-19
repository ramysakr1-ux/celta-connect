-- Launch-readiness pass: sendSignInLink, requestPasswordReset (both public,
-- unauthenticated, now send a real tracked email per for-claude-code-email-
-- delivery-tracking.md) and signIn (password login) all had zero rate
-- limiting -- the same open-ended abuse shape /apply had before
-- 0165_apply_rate_limit.sql, applied here for the equivalent auth-flow
-- routes. One shared table, bucketed by `kind` rather than three near-
-- identical one-off tables.
create table public.auth_ip_attempts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('sign_in_link', 'password_reset', 'sign_in_password')),
  ip_address text not null,
  created_at timestamptz not null default now()
);

create index auth_ip_attempts_kind_ip_created_idx on public.auth_ip_attempts (kind, ip_address, created_at);

alter table public.auth_ip_attempts enable row level security;
-- No policies -- written and read only via the admin client, same as
-- apply_ip_attempts.
