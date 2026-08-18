-- Interview Availability.dc.html: "Slots are generated from a rule, not
-- typed in every week." Confirmed unbuilt per the audit: "Slots are still
-- created one at a time by hand; no weekly recurrence, no closures."

-- Pattern's generation rule (interview length, gap, how far ahead, cut-off)
-- is centre-wide, per the mockup's "rules" panel -- one set of numbers, not
-- per interviewer. The per-interviewer part is WHICH days/hours, below.
alter table public.centers
  add column interview_slot_minutes integer not null default 45,
  add column interview_gap_minutes integer not null default 10,
  add column interview_weeks_ahead integer not null default 3,
  add column interview_cutoff_hours integer not null default 24;

-- "Each interviewer sets a weekly pattern once." One row per day-window;
-- someone can hold more than one window on the same weekday (a morning and
-- an afternoon slot, say), so this isn't one row per interviewer.
create table public.interview_availability_patterns (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers (id) on delete cascade,
  interviewer_id uuid not null references public.profiles (id) on delete cascade,
  -- 0=Sunday..6=Saturday, JS Date.getDay() convention (matches the rest of
  -- the app's date math, e.g. timetable-grid.ts).
  weekday integer not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  mode text not null check (mode in ('online', 'face_to_face')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);
create index interview_availability_patterns_interviewer_idx on public.interview_availability_patterns (interviewer_id);
create index interview_availability_patterns_center_idx on public.interview_availability_patterns (center_id);

-- "Blocking a day out": a single afternoon, a whole week, or -- nullable
-- interviewer_id -- a centre-wide closure "set once for everybody, not by
-- each interviewer separately." Null start_time/end_time means the whole
-- day. "An administrator can block on their behalf, and the entry says who
-- did it" -- blocked_by is always the acting staff member, never implied.
create table public.interview_blocks (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers (id) on delete cascade,
  interviewer_id uuid references public.profiles (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  start_time time,
  end_time time,
  reason text,
  blocked_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index interview_blocks_interviewer_idx on public.interview_blocks (interviewer_id);
create index interview_blocks_center_idx on public.interview_blocks (center_id);

alter table public.interview_availability_patterns enable row level security;
alter table public.interview_blocks enable row level security;

-- Same boundary as interview_slots itself (migration 0081): admissions
-- staff manage their own centre's rows, via the same can_handle_admissions()
-- + current_center_id() pair every other admissions table already uses.
create policy "interview_availability_patterns: admissions staff manage their centre's"
on public.interview_availability_patterns for all to authenticated
using (public.can_handle_admissions() and center_id = public.current_center_id())
with check (public.can_handle_admissions() and center_id = public.current_center_id());

create policy "interview_blocks: admissions staff manage their centre's"
on public.interview_blocks for all to authenticated
using (public.can_handle_admissions() and center_id = public.current_center_id())
with check (public.can_handle_admissions() and center_id = public.current_center_id());
