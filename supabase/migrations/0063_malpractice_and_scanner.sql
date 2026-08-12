-- build-spec.md "Suspected plagiarism" / "Assignment 5 -- the plagiarism
-- assignment" / "Plagiarism scanner". specs/README.md lists this whole
-- area as "Not yet designed... build from the prose" -- this migration is
-- that build. Reuses assignment_type_definitions (0050), which was
-- deliberately created ahead of time anticipating exactly this feature --
-- the Plagiarism Reflection type is upserted into it lazily (per centre,
-- on first use) from the deciding action, not seeded here.
--
-- Three new tables:
-- 1. malpractice_cases -- opened by a tutor from a finding (or from their
--    own observation with no finding at all -- trigger_finding_id is
--    nullable). Marking pauses on the linked assignment while
--    status = 'open'. A not-upheld decision must leave no trace on the
--    candidate's grade/status -- nothing outside this table changes for
--    that outcome, which is deliberate: not-upheld is the common case
--    (specs/dry-run.md) and must read as "nothing happened" everywhere
--    except the case record itself, which stays as evidence the centre
--    looked properly.
-- 2. plagiarism_scanner_findings -- a match the scanner produced. Not a
--    case on its own. Visible to trainers/admins only, on the assignment
--    itself when they open it to mark -- never a roster badge, never an
--    email, never a candidate name pushed anywhere.
-- 3. submission_text_fingerprints -- the cross-course archive the scanner
--    diffs against. Deliberately has NO foreign keys with cascade delete
--    into courses/assignments: the spec requires this archive to survive
--    close-out erasure of the course/assignment rows themselves ("keeps a
--    text fingerprint of past submissions, not the submissions
--    themselves"). course_id/source_assignment_id are plain uuids here,
--    not references -- whoever builds close-out must NOT point its
--    erasure cascade at this table.

create table public.malpractice_cases (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  trainee_id uuid not null references public.profiles (id) on delete cascade,
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  assignment_round text not null check (assignment_round in ('first', 'resubmission')),
  opened_by uuid not null references public.profiles (id),
  opened_at timestamptz not null default now(),
  -- "Their account is recorded, in their words" -- put to the candidate in
  -- person per spec, not an async self-service form, so this is the tutor
  -- transcribing what was said, not a trainee-writable field. Required
  -- before a decision (checked in the deciding action, not a DB
  -- constraint, since it's filled in after opened_at in a separate step).
  candidate_account text,
  candidate_account_recorded_at timestamptz,
  status text not null default 'open' check (status in ('open', 'decided')),
  outcome text check (outcome in ('upheld', 'not_upheld')),
  -- "The decision comes from your own malpractice policy -- Connect never
  -- invents a penalty." This is the tutor's own reasoning, not a computed
  -- field.
  decision_notes text,
  decided_by uuid references public.profiles (id),
  decided_at timestamptz,
  -- Set only when outcome = 'upheld' and the linked assignment fails --
  -- the auto-created Plagiarism Reflection assignment for this case.
  reflection_assignment_id uuid references public.assignments (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint malpractice_cases_decided_fields check (
    status = 'open' or (outcome is not null and decided_by is not null and decided_at is not null)
  ),
  constraint malpractice_cases_decide_needs_account check (
    status = 'open' or candidate_account is not null
  )
);

create index malpractice_cases_course_id_idx on public.malpractice_cases (course_id);
create index malpractice_cases_assignment_id_idx on public.malpractice_cases (assignment_id);

create table public.plagiarism_scanner_findings (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  round text not null check (round in ('first', 'resubmission')),
  section_key text not null,
  field_type text not null check (field_type in ('prose', 'analysis')),
  matched_text text not null,
  match_length int not null,
  source_type text not null check (source_type in ('same_course', 'cross_course_archive', 'brief', 'model_answer')),
  -- Set only for source_type = 'same_course': the other assignment the
  -- match came from, so a tutor who opens the finding can see it.
  source_assignment_id uuid references public.assignments (id) on delete set null,
  -- Set only for source_type = 'cross_course_archive'. Names the course
  -- and date, never the previous candidate, per spec -- unless a tutor
  -- opens the source assignment, which may no longer exist by then (the
  -- fingerprint outlives it), so this label is the durable record.
  source_course_label text,
  -- Which scan produced this -- built_in today, room for a third-party
  -- provider later without a schema change.
  provider text not null default 'built_in',
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id),
  -- Set once a tutor opens a case from this finding. A case can gather
  -- more than one finding, so this is finding -> case, not the reverse.
  case_id uuid references public.malpractice_cases (id) on delete set null,
  created_at timestamptz not null default now()
);

create index plagiarism_scanner_findings_assignment_id_idx on public.plagiarism_scanner_findings (assignment_id);
create index plagiarism_scanner_findings_case_id_idx on public.plagiarism_scanner_findings (case_id);

create table public.submission_text_fingerprints (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers (id) on delete cascade,
  -- Deliberately not a foreign key -- see file header. Denormalized label
  -- alongside it so a match is still meaningful after the course row is
  -- gone.
  course_id uuid not null,
  course_label text not null,
  assignment_type text not null,
  section_key text not null,
  field_type text not null check (field_type in ('prose', 'analysis')),
  -- Word-shingle set for comparison (see the scanner's built-in provider).
  -- Stored as an array rather than one blob so a match can report which
  -- shingles hit without re-deriving them from raw text -- and so this
  -- table never needs to hold the original submission text itself, only
  -- its fingerprint, which is the whole point of it surviving close-out.
  shingles text[] not null,
  -- Deliberately not a foreign key -- see file header.
  source_assignment_id uuid,
  created_at timestamptz not null default now()
);

create index submission_text_fingerprints_center_id_idx on public.submission_text_fingerprints (center_id);
create index submission_text_fingerprints_shingles_idx on public.submission_text_fingerprints using gin (shingles);

-- assignments: which case (if any) is currently blocking this assignment's
-- marking, and which case (if any) this assignment itself IS the
-- reflection for. Both nullable, both set by the case-deciding action.
alter table public.assignments add column open_case_id uuid references public.malpractice_cases (id) on delete set null;
alter table public.assignments add column reflection_for_case_id uuid references public.malpractice_cases (id) on delete set null;

alter table public.malpractice_cases enable row level security;
alter table public.plagiarism_scanner_findings enable row level security;
alter table public.submission_text_fingerprints enable row level security;

-- Trainer/admin only, matching the assignments RLS pattern in 0001 -- a
-- trainee has no access to any of these three tables. The in-person
-- conversation is the candidate's notification; nothing here is meant to
-- reach them until (and unless) the tutor acts on it through the normal
-- assignment/portfolio surfaces.
create policy "malpractice_cases: trainer/admin manage cases in their course"
on public.malpractice_cases for all
to authenticated
using ((public.is_trainer() or public.is_admin()) and course_id = public.current_course_id())
with check ((public.is_trainer() or public.is_admin()) and course_id = public.current_course_id());

create policy "plagiarism_scanner_findings: trainer/admin manage findings in their course"
on public.plagiarism_scanner_findings for all
to authenticated
using (
  (public.is_trainer() or public.is_admin())
  and exists (
    select 1 from public.assignments a
    where a.id = plagiarism_scanner_findings.assignment_id
      and a.course_id = public.current_course_id()
  )
)
with check (
  (public.is_trainer() or public.is_admin())
  and exists (
    select 1 from public.assignments a
    where a.id = plagiarism_scanner_findings.assignment_id
      and a.course_id = public.current_course_id()
  )
);

-- Fingerprints are written by the scan step (admin client, see
-- src/lib/plagiarism/scan.ts) and read by trainers/admins in the same
-- centre when a cross-course finding is opened -- never trainee-visible.
create policy "submission_text_fingerprints: trainer/admin read their centre's archive"
on public.submission_text_fingerprints for select
to authenticated
using ((public.is_trainer() or public.is_admin()) and center_id = public.current_center_id());
