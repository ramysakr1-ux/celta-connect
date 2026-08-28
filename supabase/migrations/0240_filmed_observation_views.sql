-- Ramy, 28 Aug 2026, approving the filmed-observations panel design.
--
-- The design distinguishes four states per session, and three of them were
-- already computable from existing tables (recording attached or not, task
-- response saved, task marked complete). The fourth -- "Recording attached
-- - not opened yet" versus "Watched" -- had nothing behind it: no table
-- recorded that a candidate ever opened a recording.
--
-- Rather than fake it from the task response (a candidate can watch and
-- write nothing, which would read as never having watched), this records
-- the view itself. Marked when the watch screen loads, the same way
-- scavenger_hunt_progress marks a real page visit rather than asking for a
-- checkbox.
create table if not exists filmed_observation_views (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references filmed_observation_sessions(id) on delete cascade,
  trainee_id uuid not null references profiles(id) on delete cascade,
  first_opened_at timestamptz not null default now(),
  unique (session_id, trainee_id)
);

create index if not exists filmed_observation_views_trainee_idx
  on filmed_observation_views (trainee_id);

alter table filmed_observation_views enable row level security;

-- A candidate records and reads only their own views. Insert-only by
-- design: "first opened" never changes, so there is no update policy and a
-- re-visit is a no-op conflict rather than a rewrite.
drop policy if exists "own views readable" on filmed_observation_views;
create policy "own views readable" on filmed_observation_views
  for select using (trainee_id = auth.uid());

drop policy if exists "own views insertable" on filmed_observation_views;
create policy "own views insertable" on filmed_observation_views
  for insert with check (trainee_id = auth.uid());

-- Course staff can see who has opened what, so a tutor running the session
-- knows who still has not watched. Read-only, same shape as the pre-course
-- response policy.
drop policy if exists "course staff read views" on filmed_observation_views;
create policy "course staff read views" on filmed_observation_views
  for select using (
    exists (
      select 1
      from profiles staff, profiles candidate
      where staff.id = auth.uid()
        and candidate.id = filmed_observation_views.trainee_id
        and staff.role in ('trainer', 'admin', 'platform_owner')
        and (staff.role in ('admin', 'platform_owner') or staff.course_id = candidate.course_id)
    )
  );
