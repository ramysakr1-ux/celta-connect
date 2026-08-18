-- specs/remaining-compliance.md §5 "A Cambridge documents shelf": "CELTA 5,
-- centre responsibilities -- the centre must ensure the CELTA Syllabus and
-- the Administration Handbook are available on request, and must display
-- the Centre Authorisation Certificate. Add a shelf at organisation level,
-- above centre and course, holding Cambridge's own documents: CELTA
-- Syllabus, CELTA Administration Handbook, Centre Authorisation Certificate
-- (per centre -- approval is per centre, not per organisation), Cambridge
-- Appeals Procedure. One copy, read by every course. Visible to candidates,
-- tutors, admins and the assessor alike."
--
-- Confirmed per the audit: "Partially built -- resource-hub/page.tsx lists
-- syllabus and appeals among blank forms, but there's no organisation-level
-- shelf holding the handbook and authorisation certificate."

create table public.cambridge_documents (
  id uuid primary key default gen_random_uuid(),
  -- Exactly one of these two is set. Three of the four doc types are
  -- organisation-level when the centre belongs to one (nobody copies
  -- anything -- "one copy, read by every course"); the fourth
  -- (authorisation_certificate) is ALWAYS per-centre, since Cambridge
  -- approval itself is per centre, never per organisation, even inside a
  -- multi-branch org.
  organisation_id uuid references public.organisations (id) on delete cascade,
  center_id uuid references public.centers (id) on delete cascade,
  doc_type text not null check (doc_type in ('syllabus', 'admin_handbook', 'appeals_procedure', 'authorisation_certificate')),
  file_url text,
  storage_path text,
  uploaded_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  check ((organisation_id is not null) <> (center_id is not null)),
  check (file_url is not null or storage_path is not null),
  check (doc_type <> 'authorisation_certificate' or center_id is not null),
  unique (organisation_id, doc_type),
  unique (center_id, doc_type)
);
create index cambridge_documents_organisation_id_idx on public.cambridge_documents (organisation_id);
create index cambridge_documents_center_id_idx on public.cambridge_documents (center_id);

alter table public.cambridge_documents enable row level security;

-- "Visible to candidates, tutors, admins and the assessor alike" -- every
-- role reads through this same rule (own centre, or the organisation that
-- centre belongs to). An assessor's own no-session path already reads
-- through the admin client regardless, same as every other assessor-visible
-- table in this app.
create policy "cambridge_documents: same centre or same organisation can read"
on public.cambridge_documents for select
to authenticated
using (
  center_id = public.current_center_id()
  or organisation_id = (select c.organisation_id from public.centers c where c.id = public.current_center_id())
);

-- No insert/update/delete policy -- "one current version; editing changes
-- what both branches do" is deliberately careful, and who may upload
-- (centre.settings.edit capability, centre-permissions.ts) is an app-layer
-- concept RLS can't evaluate directly. Writes go through the admin client
-- after that check, same pattern as centre_roles (migration 0103).
