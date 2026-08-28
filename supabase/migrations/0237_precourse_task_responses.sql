-- Ramy, 28 Aug 2026: "Who said everything has happened on paper? It's not
-- happening on paper. It's happening here." The pre-course task shipped as a
-- read-only reader with a per-section "Mark done" toggle -- the original
-- spec's model was that candidates worked on paper and the tutor read the
-- paper copy on day one. That's reversed now: candidates answer the task
-- inside Connect, their answers save as they type, and nothing is printed or
-- handed in.
--
-- pre_course_task_items already holds the prompt and (where Cambridge
-- supplies one) the answer key. What was missing was anywhere to put the
-- candidate's OWN answer, so this adds it: one row per candidate per task.
create table if not exists pre_course_task_responses (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references pre_course_task_items(id) on delete cascade,
  trainee_id uuid not null references profiles(id) on delete cascade,
  -- Deliberately free-form text even though phase 2 will type each task
  -- (open answer / correct-or-not / matching): a structured task's answer is
  -- stored as JSON text in the same column rather than as a second typed
  -- column, so adding a new task shape later never needs another migration.
  -- `response_kind` records how to read it.
  response text not null default '',
  response_kind text not null default 'text' check (response_kind in ('text', 'json')),
  updated_at timestamptz not null default now(),
  unique (item_id, trainee_id)
);

create index if not exists pre_course_task_responses_trainee_idx
  on pre_course_task_responses (trainee_id);

alter table pre_course_task_responses enable row level security;

-- A candidate reads and writes only their own answers. Deliberately no
-- delete policy -- clearing an answer is an update to '', not a row removal,
-- so autosave can never race a delete.
drop policy if exists "own responses readable" on pre_course_task_responses;
create policy "own responses readable" on pre_course_task_responses
  for select using (trainee_id = auth.uid());

drop policy if exists "own responses insertable" on pre_course_task_responses;
create policy "own responses insertable" on pre_course_task_responses
  for insert with check (trainee_id = auth.uid());

drop policy if exists "own responses updatable" on pre_course_task_responses;
create policy "own responses updatable" on pre_course_task_responses
  for update using (trainee_id = auth.uid()) with check (trainee_id = auth.uid());

-- Staff on the candidate's own course can read (never write) answers. Ramy:
-- "tutors don't really need to see the trainees' answers... could be a side
-- view" -- so this is read-only by design, feeding the existing portfolio
-- page a trainer already opens, not a new marking surface.
drop policy if exists "course staff read responses" on pre_course_task_responses;
create policy "course staff read responses" on pre_course_task_responses
  for select using (
    exists (
      select 1
      from profiles staff, profiles candidate
      where staff.id = auth.uid()
        and candidate.id = pre_course_task_responses.trainee_id
        and staff.role in ('trainer', 'admin', 'platform_owner')
        and (staff.role in ('admin', 'platform_owner') or staff.course_id = candidate.course_id)
    )
  );
