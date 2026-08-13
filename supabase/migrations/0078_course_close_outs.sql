-- specs/build-spec.md §2 "Export is the mirror" + build order #20 "Close-out --
-- export, erase, duplicate". Duplicate already exists (courses.duplicated_from_course_id,
-- src/app/dashboard/admin/actions.ts); this is the export+erase half, protected in
-- three layers per the course-lifecycle spec: technical verify -> signed receipt ->
-- 7-day grace-hold wipe. Nothing is wiped until the signed receipt returns -- the
-- push itself is not the trigger.

-- "Cambridge has not confirmed final grades" is one of §2's three close-out blocking
-- rules. The centre decides this, the app never computes it -- same "let a human
-- decide, don't calculate it" pattern already used for deferral_transfers.hours_carried.
alter table public.courses add column cambridge_grades_confirmed_at timestamptz;
alter table public.courses add column cambridge_grades_confirmed_by uuid references public.profiles(id);

-- "a deferred candidate has no destination course chosen (or an explicit 'hold at
-- centre' flag)" -- without this flag, a deferral genuinely meant to sit unlinked for
-- months (Handbook 6.9 allows up to 6/12 months for re-integration) would block the
-- source course's close-out indefinitely.
alter table public.deferral_transfers add column hold_at_centre boolean not null default false;

create table public.course_close_outs (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null unique references public.courses(id) on delete cascade,
  center_id uuid not null references public.centers(id),
  status text not null default 'not_started' check (status in (
    'not_started', 'verifying', 'verify_failed', 'ready_to_export', 'exporting', 'export_failed',
    'awaiting_receipt', 'grace_period', 'wiped'
  )),
  verification_report jsonb,
  verified_at timestamptz,
  verified_by uuid references public.profiles(id),
  drive_folder_id text,
  drive_folder_url text,
  exported_at timestamptz,
  exported_by uuid references public.profiles(id),
  export_error text,
  -- "an automated message asks the centre to confirm receipt with a digital
  -- signature + timestamp" -- kept to the tone of a warm confirmation, not a legal
  -- e-sign product: the signer types their name, the app timestamps it.
  receipt_requested_at timestamptz,
  receipt_signed_name text,
  receipt_signed_at timestamptz,
  receipt_signed_by uuid references public.profiles(id),
  grace_period_ends_at timestamptz,
  wiped_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index course_close_outs_center_id_idx on public.course_close_outs (center_id);

alter table public.course_close_outs enable row level security;

-- Close-out lives entirely under Centre Admin (build-spec §1 item 19/20), same
-- admin-only gate as course duplication (src/app/dashboard/admin/actions.ts uses
-- requireRole("admin"), not the trainer-or-admin pattern seen elsewhere) -- this is
-- a destructive, centre-level action, not a trainer one. Writes go through the admin
-- client from server actions regardless (the flow needs the service-role client to
-- call the Drive API with the centre's stored refresh token, and to erase across
-- every trainee-owned table at wipe time, well beyond any one caller's own RLS grants).
create policy "course_close_outs: admin reads their centre's close-outs"
on public.course_close_outs for select
to authenticated
using (public.is_admin() and center_id = public.current_center_id());
