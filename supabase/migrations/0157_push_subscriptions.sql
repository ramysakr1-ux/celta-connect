-- for-claude-code-announcements.md's own "Build blockers" list: "no push
-- infra exists -- no service worker, no FCM/APNs. Volunteers also have no
-- persistent logged-in stream to push into." Web Push + VAPID, confirmed
-- with Ramy 2026-08-19.
--
-- Two owner shapes, exactly one set per row: profiles.id for every real
-- Supabase Auth account (trainer/trainee/admin), or volunteer_students.id
-- for volunteers -- who never get a real account (migration
-- 0030_volunteer_students.sql), but DO get one durable per-course token
-- reused on every visit to /student/[token], which is the natural anchor
-- for their subscription instead of a session. Assessors are read-only
-- and never a push audience per the spec, so no third owner column.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete cascade,
  volunteer_student_id uuid references public.volunteer_students (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz not null default now(),
  constraint push_subscriptions_one_owner check (
    (profile_id is not null and volunteer_student_id is null)
    or (profile_id is null and volunteer_student_id is not null)
  )
);

create index if not exists push_subscriptions_profile_id_idx on public.push_subscriptions (profile_id);
create index if not exists push_subscriptions_volunteer_student_id_idx on public.push_subscriptions (volunteer_student_id);

alter table public.push_subscriptions enable row level security;
-- No policies -- every write/read goes through the admin client from a
-- server action (session-based for staff, token-based for volunteers, who
-- have no auth.uid() to write an RLS policy against anyway). Same
-- no-self-service-policy pattern as centre_delete_codes.
