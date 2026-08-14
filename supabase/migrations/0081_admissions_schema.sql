-- specs/build-spec.md "Application and selection" + Ramy's admissions
-- handover. Phase A: schema only. Run after 0080 (which added the
-- 'admissions' enum value in its own transaction).

-- ============================================================
-- Handling vs deciding (6.2): a centre-level admissions role can see and
-- act on the pipeline (booking, chasing, payment ticking, correspondence)
-- for every course at the centre without being a tutor on any of them.
-- Deciding (interview record, accept/reject) requires being a verified
-- course tutor (trainer/admin) OR a nominated admissions person -- the
-- explicit per-profile flag below, off by default, set by an admin.
-- ============================================================
alter table public.profiles add column can_decide_admissions boolean not null default false;

create function public.can_handle_admissions()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or public.is_trainer() or public.current_role() = 'admissions';
$$;

create function public.can_decide_admissions()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or public.is_trainer()
    or (public.current_role() = 'admissions' and coalesce(
      (select can_decide_admissions from public.profiles where id = auth.uid()), false
    ));
$$;

-- ============================================================
-- Centre settings, imported at setup, ship with Connect defaults.
-- ============================================================

-- "The centre defines three or four -- one narrative, one descriptive, one
-- argumentative" for the extended writing task.
create table public.application_writing_prompts (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers (id) on delete cascade,
  prompt_type text not null check (prompt_type in ('narrative', 'descriptive', 'argumentative')),
  prompt_text text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index application_writing_prompts_center_id_idx on public.application_writing_prompts (center_id);

-- "Seven fixed questions... imported at setup like assignment briefs...
-- checks coverage against what Handbook 6.2 asks selection to assess."
-- coverage_area is a fixed small set, not user-free-text, so "None" can be
-- computed by checking which areas have zero active questions.
create table public.interview_questions (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers (id) on delete cascade,
  question_text text not null,
  coverage_area text not null check (coverage_area in (
    'motivation_suitability', 'language_awareness', 'classroom_presence',
    'flexibility_openness', 'digital_literacy', 'time_commitment', 'other'
  )),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index interview_questions_center_id_idx on public.interview_questions (center_id);

-- "Links are unlimited and filtered... per course, per campus, per
-- advertising source." One permanent centre-wide link is just a row with
-- intake_course_id null.
create table public.application_links (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers (id) on delete cascade,
  label text not null,
  intake_course_id uuid references public.courses (id) on delete set null,
  token text not null unique,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index application_links_center_id_idx on public.application_links (center_id);

-- ============================================================
-- The applicant record itself -- "first-class records, not uploaded
-- documents. The file exists from first contact."
-- ============================================================
create table public.applicants (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers (id) on delete cascade,
  intake_course_id uuid not null references public.courses (id) on delete cascade,
  source_link_id uuid references public.application_links (id) on delete set null,

  full_name text not null,
  email text not null,
  phone text,

  -- 6.3 entry requirements -- evidence recorded, not gated by a rigid form.
  date_of_birth date,
  education_summary text,
  elt_experience_summary text,

  -- 6.4 special requirements, declared at application so arrangements
  -- exist on day one. 6.5: ask whether they can attend significant parts
  -- of the course. Deliberately a single optional free-text field for
  -- health-adjacent disclosure, never a forced/structured health question.
  special_requirements text,
  cannot_attend_note text,
  anything_else text,

  -- "Candidates must be told... and it should be recorded that they were"
  acknowledged_no_guarantee_at timestamptz,
  acknowledged_no_exemptions_at timestamptz,
  acknowledged_mixed_mode_demand_at timestamptz,

  -- Extended writing task -- "the choice is itself a small piece of
  -- evidence" -- and the language awareness task.
  writing_task_prompt_id uuid references public.application_writing_prompts (id),
  writing_task_submission text,
  language_awareness_submission jsonb not null default '[]',

  -- AI reading of the written task (optional, later phase) -- always a
  -- suggestion, never shown to the applicant, never a score.
  ai_reading_summary jsonb,
  ai_reading_generated_at timestamptz,

  -- Marking scheme for the selection task -- five rows, same shape as the
  -- Standard of English cover-sheet criterion.
  marking_language_awareness text check (marking_language_awareness in ('above', 'at', 'below')),
  marking_language_awareness_note text,
  marking_accuracy text check (marking_accuracy in ('above', 'at', 'below')),
  marking_accuracy_note text,
  marking_organisation text check (marking_organisation in ('above', 'at', 'below')),
  marking_organisation_note text,
  marking_range text check (marking_range in ('above', 'at', 'below')),
  marking_range_note text,
  marking_substance text check (marking_substance in ('above', 'at', 'below')),
  marking_substance_note text,
  marked_by uuid references public.profiles (id),
  marked_at timestamptz,

  stage text not null default 'submitted' check (stage in (
    'submitted', 'task_returned', 'interview_booked', 'interview_completed',
    'offer_sent', 'accepted', 'rejected_before_interview', 'rejected_after_interview',
    'waiting_list', 'not_this_time', 'withdrawn_application'
  )),

  -- Rejections: "require a written reason... never generated."
  rejection_reason text,
  rejected_at timestamptz,
  rejected_by uuid references public.profiles (id),

  -- Offer + acceptance -- "one link that confirms the place, takes the
  -- candidate agreement, sets up the workspace... accepting is what
  -- creates the account." fee_* is tracking only, never a real payment
  -- integration (build-spec.md's explicit position, confirmed 2026-08-14).
  offer_sent_at timestamptz,
  offer_accept_by date,
  offer_token text unique,
  accepted_at timestamptz,
  fee_amount numeric,
  fee_currency text,
  fee_paid boolean not null default false,
  fee_paid_marked_by uuid references public.profiles (id),
  fee_paid_note text,
  fee_paid_at timestamptz,
  waiver_note text,
  waiver_agreed_by uuid references public.profiles (id),
  waiver_agreed_role text,

  -- Waiting list -- "position, the course, and a date by which they will
  -- hear either way." place_offered/expires drive the 48-hour countdown
  -- email + auto-advance-on-expiry.
  waiting_list_position integer,
  waiting_list_hear_by date,
  waiting_list_opt_out boolean not null default false,
  place_offered_at timestamptz,
  place_offer_expires_at timestamptz,

  -- Set once accepted and the real trainee account is created (reusing
  -- join/[token]/actions.ts's account-creation shape, keyed by
  -- offer_token instead of a course join token).
  resulting_trainee_id uuid references public.profiles (id),

  notification_opt_outs text[] not null default '{}',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index applicants_center_id_idx on public.applicants (center_id);
create index applicants_intake_course_id_idx on public.applicants (intake_course_id);
create index applicants_stage_idx on public.applicants (stage);

-- ============================================================
-- Interview booking
-- ============================================================
create table public.interview_slots (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers (id) on delete cascade,
  intake_course_id uuid not null references public.courses (id) on delete cascade,
  interviewer_id uuid not null references public.profiles (id) on delete cascade,
  -- "A panel books both interviewers as one slot."
  panel boolean not null default false,
  second_interviewer_id uuid references public.profiles (id),
  slot_date date not null,
  slot_time time not null,
  duration_minutes integer not null default 30,
  mode text not null check (mode in ('online', 'face_to_face')),
  booked_applicant_id uuid references public.applicants (id),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index interview_slots_center_id_idx on public.interview_slots (center_id);
create index interview_slots_intake_course_id_idx on public.interview_slots (intake_course_id);

create table public.interview_records (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references public.applicants (id) on delete cascade,
  slot_id uuid references public.interview_slots (id),

  -- [{question_id, question_text, answer_text}] -- "what was actually
  -- asked is what goes on the record."
  fixed_questions jsonb not null default '[]',
  -- [{question_text, answer_text, drawn_reason}] -- reason cites the weak
  -- area from the pre-interview task reading that suggested it.
  drawn_questions jsonb not null default '[]',

  -- "Two signatures typed at the end with both people still in the room."
  interviewer_signature_name text,
  interviewer_signed_at timestamptz,
  applicant_signature_name text,
  applicant_signed_at timestamptz,

  overall_notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index interview_records_applicant_id_idx on public.interview_records (applicant_id);

-- ============================================================
-- Staff notifications on the pipeline -- "submitted / task returned /
-- interview completed / sitting without a decision (default 5 working
-- days)." In-app + email, per-type opt-out (applicants.notification_opt_outs
-- above is the applicant side; this is the staff side).
-- ============================================================
create table public.admissions_notifications (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers (id) on delete cascade,
  applicant_id uuid not null references public.applicants (id) on delete cascade,
  type text not null check (type in ('submitted', 'task_returned', 'interview_completed', 'stale_no_decision')),
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index admissions_notifications_center_id_idx on public.admissions_notifications (center_id);

-- Centre's own threshold for "sitting without a decision" -- default 5
-- working days, per the spec.
alter table public.centers add column admissions_stale_threshold_days integer not null default 5;

-- ============================================================
-- RLS -- same shape as everywhere else in this schema: staff read/write
-- scoped to their own centre, service-role for anything crossing that
-- boundary (the public application form's own INSERT goes through the
-- admin client from a server action, same as /join/[token] -- there is no
-- anonymous-write RLS policy here by design).
-- ============================================================
alter table public.application_writing_prompts enable row level security;
alter table public.interview_questions enable row level security;
alter table public.application_links enable row level security;
alter table public.applicants enable row level security;
alter table public.interview_slots enable row level security;
alter table public.interview_records enable row level security;
alter table public.admissions_notifications enable row level security;

create policy "application_writing_prompts: admissions staff manage their centre's"
on public.application_writing_prompts for all to authenticated
using (public.can_handle_admissions() and center_id = public.current_center_id())
with check (public.can_handle_admissions() and center_id = public.current_center_id());

create policy "interview_questions: admissions staff manage their centre's"
on public.interview_questions for all to authenticated
using (public.can_handle_admissions() and center_id = public.current_center_id())
with check (public.can_handle_admissions() and center_id = public.current_center_id());

create policy "application_links: admissions staff manage their centre's"
on public.application_links for all to authenticated
using (public.can_handle_admissions() and center_id = public.current_center_id())
with check (public.can_handle_admissions() and center_id = public.current_center_id());

create policy "applicants: admissions staff handle their centre's"
on public.applicants for select to authenticated
using (public.can_handle_admissions() and center_id = public.current_center_id());

create policy "applicants: deciders update their centre's"
on public.applicants for update to authenticated
using (public.can_decide_admissions() and center_id = public.current_center_id())
with check (public.can_decide_admissions() and center_id = public.current_center_id());

create policy "interview_slots: admissions staff manage their centre's"
on public.interview_slots for all to authenticated
using (public.can_handle_admissions() and center_id = public.current_center_id())
with check (public.can_handle_admissions() and center_id = public.current_center_id());

create policy "interview_records: deciders manage their centre's"
on public.interview_records for all to authenticated
using (
  public.can_decide_admissions()
  and exists (select 1 from public.applicants a where a.id = interview_records.applicant_id and a.center_id = public.current_center_id())
)
with check (
  public.can_decide_admissions()
  and exists (select 1 from public.applicants a where a.id = interview_records.applicant_id and a.center_id = public.current_center_id())
);

create policy "admissions_notifications: admissions staff read their centre's"
on public.admissions_notifications for select to authenticated
using (public.can_handle_admissions() and center_id = public.current_center_id());
