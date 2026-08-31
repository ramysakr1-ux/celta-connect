-- A manual override for the consequences of a failed written assignment.
--
-- Ramy, 31 Aug 2026: "There is, of course, an option to edit the provisional
-- grades after the grades meeting. So everything should be potentially
-- subject to manual override."
--
-- Two things follow automatically from a terminally failed assignment:
--   * the grade ceiling in src/lib/provisional-grade.ts (one fail blocks
--     Pass A; two blocks any pass), and
--   * the Stage Three trigger added the same day in src/lib/stage3-triggers.ts.
--
-- Both are correct defaults and neither should be absolute. A grades meeting
-- is exactly where a centre looks at a case the rules describe badly, and the
-- assessor has the final say regardless. So the override is manual, explicit,
-- and attributed -- it never fires on its own, and it cannot be set without a
-- reason, because the reason is the point: an unexplained override is
-- indistinguishable from a mistake when the assessor reads the record months
-- later.
--
-- Deliberately ONE override rather than one per consequence. Both consequences
-- come from the same fact, and a tutor who has decided that fact was handled
-- at the grades meeting has decided it for both. Splitting them would invite a
-- record where the ceiling was lifted but the Stage Three still demanded, which
-- describes nothing real.

alter table public.celta5_records
  add column if not exists assignment_fail_override_reason text,
  add column if not exists assignment_fail_override_by uuid references public.profiles(id) on delete set null,
  add column if not exists assignment_fail_override_at timestamptz;

comment on column public.celta5_records.assignment_fail_override_reason is
  'Why the automatic consequences of a failed written assignment (grade ceiling, Stage Three trigger) were set aside. Null means no override. Never set without the other two columns.';
comment on column public.celta5_records.assignment_fail_override_by is
  'Who overrode it. Kept for the assessor, who reads this record after the course has ended.';
comment on column public.celta5_records.assignment_fail_override_at is
  'When the override was recorded -- normally at or after the grades meeting.';

-- All three together or none: a reason with no author is not attributable, and
-- an author with no reason is not reviewable.
alter table public.celta5_records
  drop constraint if exists celta5_records_assignment_fail_override_complete;
alter table public.celta5_records
  add constraint celta5_records_assignment_fail_override_complete check (
    (assignment_fail_override_reason is null and assignment_fail_override_by is null and assignment_fail_override_at is null)
    or (assignment_fail_override_reason is not null and btrim(assignment_fail_override_reason) <> ''
        and assignment_fail_override_by is not null and assignment_fail_override_at is not null)
  );
