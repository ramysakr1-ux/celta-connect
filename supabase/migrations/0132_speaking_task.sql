-- Pre-interview speaking task (design_handoff_pre_interview_speaking).
-- Third, independent component of the application alongside the existing
-- extended writing task and language awareness -- its own prompt set, its
-- own submission. Deliberately does NOT include a transcript column:
-- Ramy, 2026-08-17, "we don't need a transcript for the [applicants]" --
-- unlike volunteer-signup recordings (which trainees later quote from as
-- FOL evidence, decision 9 in twenty-decisions.md), this recording is
-- reviewed directly by a person, no stored transcript needed.
create table public.speaking_task_prompts (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers (id) on delete cascade,
  prompt_text text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.speaking_task_prompts enable row level security;

-- No anon/public policy, matching application_writing_prompts (0081) --
-- the apply page reads via the admin client, bypassing RLS entirely, same
-- as every other public-form read on this table.
create policy "speaking_task_prompts: centre staff manage their own"
on public.speaking_task_prompts for all
to authenticated
using (public.can_handle_admissions() and center_id = public.current_center_id())
with check (public.can_handle_admissions() and center_id = public.current_center_id());

alter table public.applicants
  add column if not exists speaking_task_prompt_id uuid references public.speaking_task_prompts (id) on delete set null,
  add column if not exists speaking_task_audio_url text,
  add column if not exists speaking_task_submitted_at timestamptz;

-- Storage for the recording. Same reasoning as volunteer-signup-audio
-- (migration 0089): an applicant never gets a real Supabase session, so
-- the upload happens server-side via the admin client from
-- submitApplication, not a direct browser->Storage write -- no
-- "authenticated" RLS policy can apply to the writer. Admissions staff get
-- read access to listen on the Candidate Record page.
insert into storage.buckets (id, name, public)
values ('applicant-speaking-task-audio', 'applicant-speaking-task-audio', false)
on conflict (id) do nothing;

create policy "applicant-speaking-task-audio: admissions staff read their centre's"
on storage.objects for select
to authenticated
using (
  bucket_id = 'applicant-speaking-task-audio'
  and public.can_handle_admissions()
  and (storage.foldername(name))[1] = public.current_center_id()::text
);
