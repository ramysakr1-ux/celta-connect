-- TP Video Library: a plain, separate library of external training-video
-- links (Cambridge's own filmed-observation DVD library, etc.) -- same
-- shape as tp_audio_library (migration 0046), but link-based rather than
-- Storage-uploaded, since these files run 200-260MB+ and Supabase's free
-- tier caps individual Storage uploads at 50MB (Ramy, 2026-08-21 -- chose
-- links over a Pro-plan upgrade). Host the actual video wherever
-- (YouTube unlisted, Vimeo, Google Drive share link, etc.) and paste the
-- link here; never fetched/embedded automatically, same posture as
-- filmed_observation_sessions.recording_url already takes for a related
-- but structurally different feature.
--
-- Deliberately NOT the same table as filmed_observation_sessions
-- (migration 0137) or the resources table's 'filmed_observations'
-- category -- both are different concepts (see below) and reusing either
-- would create a confusing naming collision:
--   - filmed_observation_sessions: YOUR OWN cohort's live-filmed TP
--     lesson, hard-tied to a real timetable event, bundled with consent
--     tracking, scripted pause points, and a trainer-authored task.
--   - resources category 'filmed_observations': a label inside the
--     general staff-document shelf, unrelated in practice.
--   - tp_video_library (this table): a plain, standalone, centre-wide
--     shelf of third-party training videos -- browse and watch, no task,
--     no consent, no timetable link. Structurally identical to the audio
--     library, just video instead of audio.
create table public.tp_video_library (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers (id) on delete cascade,
  title text not null,
  description text,
  video_url text not null,
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tp_video_library_center_id_idx on public.tp_video_library (center_id);

create trigger set_updated_at before update on public.tp_video_library
for each row execute function public.set_updated_at();

alter table public.tp_video_library enable row level security;

create policy "tp_video_library: trainer/admin manage their center's videos"
on public.tp_video_library for all
to authenticated
using (
  (public.is_trainer() or public.is_admin())
  and center_id = public.current_center_id()
)
with check (
  (public.is_trainer() or public.is_admin())
  and center_id = public.current_center_id()
);

-- Same-centre trainee read, matching tp_audio_library's own trainee-read
-- fix (migration 0076) from the start rather than needing a second pass --
-- nothing sensitive here (a title, description, and a link), and this
-- content is meant to be trainee-visible.
create policy "tp_video_library: same-center trainees can read"
on public.tp_video_library for select
to authenticated
using (center_id = public.current_center_id());
