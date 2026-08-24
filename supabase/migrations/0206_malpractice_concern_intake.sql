-- Malpractice.dc.html "1b Raising it": a manual concern a tutor raises
-- themselves, from the assignment being marked -- distinct from a scanner
-- finding (plagiarism_scanner_findings), which already knows its own
-- matched passage/source. "What kind of concern is this?" (four named
-- categories, the design's own reference case) plus free-text findings.
--
-- Ramy, 2026-08-25: scoped to assignments/TPs only -- CELTA 5 concerns
-- already have their own separate channels, deliberately not this table.
--
-- "A note is not a case" (the design's own case note) -- most manual
-- concerns turn out to be nothing, so this is a genuinely separate,
-- lighter-weight table from malpractice_cases rather than a third status
-- on it. A note that IS escalated becomes a real malpractice_cases row
-- (via openCase, unchanged) rather than this row growing into one --
-- keeps every existing case query (the case list, the assessor pack) from
-- needing to filter out dismissed notes.
create table public.malpractice_concern_notes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  trainee_id uuid not null references public.profiles (id) on delete cascade,
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  assignment_round text not null check (assignment_round in ('first', 'resubmission')),
  kind text not null check (kind in ('unattributed_source', 'collaboration', 'undeclared_ai', 'other')),
  findings text not null,
  raised_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create index malpractice_concern_notes_course_id_idx on public.malpractice_concern_notes (course_id);
create index malpractice_concern_notes_assignment_id_idx on public.malpractice_concern_notes (assignment_id);

alter table public.malpractice_concern_notes enable row level security;

create policy "malpractice_concern_notes: trainer/admin manage notes in their course"
on public.malpractice_concern_notes for all
to authenticated
using ((public.is_trainer() or public.is_admin()) and course_id = public.current_course_id())
with check ((public.is_trainer() or public.is_admin()) and course_id = public.current_course_id());

-- A case opened directly from this intake flow (rather than from a
-- scanner finding, or with no prior context at all) carries its own
-- opening kind/findings -- same self-contained shape malpractice_cases
-- already has for candidate_account/decision_notes, so the case page's
-- timeline can show "Concern raised" without an extra join back to a
-- notes table. Cases opened the old way (scanner finding, or the bare
-- button with no form) simply leave these null, same as today.
alter table public.malpractice_cases add column concern_kind text check (concern_kind in ('unattributed_source', 'collaboration', 'undeclared_ai', 'other'));
alter table public.malpractice_cases add column initial_findings text;
