-- Centre Admin "Import" tab (for-claude-code-centre-admin-full.md §Import tab):
-- bring an existing applicant spreadsheet in as records, with a dry-run before
-- anything is written and an undo afterwards.
--
-- The spec's non-negotiable is that an import NEVER emails anyone: "an import
-- that silently emails forty people is the fastest way to lose a centre in its
-- first hour." Nothing here writes to any invitation/email path -- imported
-- people are `applicants` rows and nothing else, and inviting them stays the
-- separate deliberate action it already is.

create table public.spreadsheet_imports (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers (id) on delete cascade,
  -- applicants.intake_course_id is NOT NULL, so every import targets one
  -- intake. The spec's flow doesn't mention picking a course; it has to.
  intake_course_id uuid not null references public.courses (id) on delete cascade,

  source_filename text not null,
  -- Header -> applicant field, e.g. {"E-mail": "email", "Notes": null}. A null
  -- value is an explicit skip ("Not imported" in the spec's mapping table),
  -- which is deliberately different from a header being absent.
  column_mapping jsonb not null default '{}',
  -- The centre's own status vocabulary -> our applicants.stage values, e.g.
  -- {"phone int.": "interview_completed"}. "every centre has a status column
  -- and no two use the same vocabulary", so this can never be inferred alone.
  status_value_mapping jsonb not null default '{}',
  -- The four counts shown on the preview, frozen at commit time so the
  -- "Afterwards" screen reports what actually happened rather than recomputing
  -- against data that may have moved on.
  tallies jsonb not null default '{}',

  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  -- Set when an admin undoes the import. Kept as a row (not deleted) so a
  -- re-run can still tell it happened.
  undone_at timestamptz,
  undone_by uuid references public.profiles (id)
);
create index spreadsheet_imports_center_id_idx on public.spreadsheet_imports (center_id);

-- What lets undo remove exactly what this import created and nothing else --
-- an applicant added by hand five minutes later must survive it. ON DELETE SET
-- NULL rather than CASCADE: deleting the import record must never be a way to
-- silently delete real people.
alter table public.applicants add column import_id uuid references public.spreadsheet_imports (id) on delete set null;
create index applicants_import_id_idx on public.applicants (import_id);

alter table public.spreadsheet_imports enable row level security;

-- Same admin-only gate as the rest of Centre Admin. Note the four-role model
-- in the spec (centre administrator / manager / course administrator / owner)
-- does not exist yet -- profiles.role is still flat 'admin' -- so this is
-- written against what exists today and will need revisiting when roles land.
create policy "spreadsheet_imports: admins read their centre's imports"
on public.spreadsheet_imports for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.center_id = spreadsheet_imports.center_id
  )
);

create policy "spreadsheet_imports: admins create imports in their centre"
on public.spreadsheet_imports for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.center_id = spreadsheet_imports.center_id
  )
);

create policy "spreadsheet_imports: admins update their centre's imports"
on public.spreadsheet_imports for update
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.center_id = spreadsheet_imports.center_id
  )
);
