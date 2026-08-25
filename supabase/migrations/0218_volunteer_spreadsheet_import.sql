-- Ramy, 25/26 Aug 2026: "is that something that could be just connected to
-- the drive... center management also have one" -- extends the existing
-- Centre Admin spreadsheet-import machinery (0102_spreadsheet_imports.sql,
-- built for applicants) to also cover volunteer students, reusing the same
-- real Google Drive picker, dry-run-before-write, and seven-day-undo
-- machinery rather than building a second, separate system.
--
-- `kind` distinguishes which table an import wrote to -- default 'applicants'
-- keeps every existing row's meaning unchanged. intake_course_id already
-- just means "which course", so it's reused as-is rather than renamed.
alter table public.spreadsheet_imports add column kind text not null default 'applicants' check (kind in ('applicants', 'volunteers'));

-- Same ON DELETE SET NULL reasoning as applicants.import_id: deleting the
-- import record must never be a way to silently delete real volunteers.
alter table public.volunteer_students add column import_id uuid references public.spreadsheet_imports (id) on delete set null;
create index volunteer_students_import_id_idx on public.volunteer_students (import_id);
