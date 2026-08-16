-- The candidate-concerns meeting, Handbook 14.2.
--
-- Assessor Visit.dc.html's "On the day" panel ends with "a count of candidates
-- who requested to speak with the assessor". Nothing in the app recorded that,
-- so the count could only ever have been zero or invented.
--
-- A candidate asking to speak to the assessor privately is the one channel
-- that deliberately bypasses their tutors, so two rules are built into the
-- shape of this table rather than left to the UI:
--
--   1. Tutors must not be able to read it. The RLS below grants SELECT to
--      nobody at all -- the assessor screen reads it through the admin client,
--      scoped to the course their token resolves to, and the trainee reads
--      only their own row. A tutor querying this table gets nothing.
--   2. The assessor sees a COUNT before the visit, not the names or the
--      substance. Who said what is for the meeting itself; a list of names
--      circulating beforehand would deter exactly the candidate this exists
--      for.
--
-- No note column on purpose. If a candidate could type their concern here it
-- would sit in a database read by people they did not choose to tell.

create table if not exists public.assessor_meeting_requests (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  trainee_id uuid not null references public.profiles (id) on delete cascade,
  requested_at timestamptz not null default now(),
  -- Withdrawing a request must be possible: someone may resolve the matter
  -- with their tutor before the visit and not want the meeting.
  withdrawn_at timestamptz,
  -- One live request per candidate per course.
  unique (course_id, trainee_id)
);

create index if not exists assessor_meeting_requests_course_idx
  on public.assessor_meeting_requests (course_id)
  where withdrawn_at is null;

alter table public.assessor_meeting_requests enable row level security;

-- A candidate sees and manages only their own request. Nobody else gets a
-- SELECT policy at all -- not tutors, not centre admins.
drop policy if exists "assessor requests: own row" on public.assessor_meeting_requests;
create policy "assessor requests: own row"
on public.assessor_meeting_requests for select
to authenticated
using (trainee_id = auth.uid());

drop policy if exists "assessor requests: candidate creates own" on public.assessor_meeting_requests;
create policy "assessor requests: candidate creates own"
on public.assessor_meeting_requests for insert
to authenticated
with check (trainee_id = auth.uid());

drop policy if exists "assessor requests: candidate withdraws own" on public.assessor_meeting_requests;
create policy "assessor requests: candidate withdraws own"
on public.assessor_meeting_requests for update
to authenticated
using (trainee_id = auth.uid())
with check (trainee_id = auth.uid());
