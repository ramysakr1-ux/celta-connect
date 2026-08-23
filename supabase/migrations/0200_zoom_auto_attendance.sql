-- for-claude-code-zoom-auto-attendance.md: real OAuth + webhook so Zoom
-- participation populates volunteer_attendance automatically. Nothing like
-- this existed before -- zoom_url was just a stored link, every register
-- came from a trainer manually checking boxes (setAttendance). Manual
-- entry stays as the correction path; this only adds a second, automatic
-- writer into the same table (see the "source" column below).

-- 1. Per-centre Zoom OAuth connection. One per centre, same shape as
-- center_google_connections (migration 0012): no RLS policies granted on
-- purpose -- access_token/refresh_token are live credentials and must
-- never be readable via the browser client, only through the service-role
-- admin client server-side.
create table public.centre_zoom_connections (
  center_id uuid primary key references public.centers (id) on delete cascade,
  connected_by uuid references public.profiles (id) on delete set null,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  zoom_account_email text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.centre_zoom_connections enable row level security;

create trigger set_updated_at before update on public.centre_zoom_connections
for each row execute function public.set_updated_at();

-- 2. The Zoom meeting ID behind an event's zoom_url, extracted once when
-- the link is entered (addTimetableEvent) -- needed to match an incoming
-- webhook event back to the right timetable row. Indexed since that's
-- exactly the webhook's lookup.
alter table public.course_timetable_events add column zoom_meeting_id text;

create index course_timetable_events_zoom_meeting_id_idx
  on public.course_timetable_events (zoom_meeting_id)
  where zoom_meeting_id is not null;

-- 3. volunteer_attendance grows a source + join/leave timestamps. Presence
-- itself is still row-existence (unchanged -- see volunteer-attendance.ts,
-- the certificate-hours model stays block-based, not minute-based); these
-- are additive/informational so a trainer can tell an auto-recorded row
-- from one they ticked themselves, per the spec's "via Zoom vs marked
-- manually" indicator.
alter table public.volunteer_attendance add column source text not null default 'manual' check (source in ('manual', 'zoom'));
alter table public.volunteer_attendance add column joined_at timestamptz;
alter table public.volunteer_attendance add column left_at timestamptz;
alter table public.volunteer_attendance add column zoom_participant_email text;

-- 4. A Zoom participant the webhook couldn't confidently resolve to a
-- volunteer_student -- lands here for the trainer to review, same
-- checkbox-list UI as today, pre-filled with a suggested match where a
-- fuzzy name match exists (never auto-confirmed -- only an exact email
-- match ever writes to volunteer_attendance directly). One partial unique
-- index dedupes rejoins when the participant has an email; a participant
-- with no email (anonymous/phone join) can produce more than one row on
-- repeated rejoin -- accepted, flagged rather than solved (dedupe-by-
-- name-only risks merging two different anonymous joiners).
create table public.zoom_unmatched_participants (
  id uuid primary key default gen_random_uuid(),
  timetable_event_id uuid not null references public.course_timetable_events (id) on delete cascade,
  zoom_email text,
  zoom_display_name text not null,
  suggested_volunteer_student_id uuid references public.volunteer_students (id) on delete set null,
  joined_at timestamptz not null,
  left_at timestamptz,
  resolved_at timestamptz,
  resolved_volunteer_student_id uuid references public.volunteer_students (id) on delete set null,
  resolved_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index zoom_unmatched_participants_event_idx on public.zoom_unmatched_participants (timetable_event_id);

create unique index zoom_unmatched_participants_event_email_idx
  on public.zoom_unmatched_participants (timetable_event_id, zoom_email)
  where zoom_email is not null and resolved_at is null;

create trigger set_updated_at before update on public.zoom_unmatched_participants
for each row execute function public.set_updated_at();

alter table public.zoom_unmatched_participants enable row level security;

-- Trainer/admin review their own course's unmatched list -- same scoping
-- shape as volunteer_attendance's own policy (0030), joined through the
-- timetable event instead of volunteer_students since this table has no
-- volunteer_student_id of its own until resolved.
create policy "zoom_unmatched_participants: trainer/admin manage their course"
on public.zoom_unmatched_participants for all
to authenticated
using (
  (public.is_trainer() or public.is_admin())
  and timetable_event_id in (
    select id from public.course_timetable_events
    where course_id in (select id from public.courses where center_id = public.current_center_id())
  )
)
with check (
  (public.is_trainer() or public.is_admin())
  and timetable_event_id in (
    select id from public.course_timetable_events
    where course_id in (select id from public.courses where center_id = public.current_center_id())
  )
);
