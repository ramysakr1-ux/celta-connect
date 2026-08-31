-- Extend the existing management log down to course level.
--
-- Ramy, 31 Aug 2026: "if only one person is doing the job, then obviously
-- that's it. But if more than one person [is] sharing the same job... then it
-- should have the same treatment as the centre owner. It should leave a
-- digital footprint." And: "if one day the centre owner decides to give
-- whatever right to Centre observer, then it would leave a digital footprint."
--
-- That second case already does. centre_owner_actions (0103) records
-- permission_override.set and .reset, custom_role.add, custom_capability.add,
-- roles.grant/revoke/invite, areas.assign and branch_visibility.set. I told
-- him there was no audit log anywhere -- that was wrong, and worth writing
-- down: I had searched for table names containing log/audit/history, and this
-- one is named for its actor rather than its function.
--
-- What is genuinely missing is everything one level down, in Course Admin,
-- which is where he was looking when he raised it. Changing a tutor's role on
-- a running course is a bare update: no previous value, no actor, no time.
-- Since the Main Course Tutor is named on the entry form submitted to
-- Cambridge, a mid-course change there is exactly the kind of thing that
-- should be attributable.
--
-- So: one log, not two. A second table would mean two readers, two shapes and
-- an eventual argument about which one a given action belongs in. The table
-- keeps its name -- renaming it would rewrite RLS policies across two
-- migrations and two pages for a naming nicety -- but its comment now says
-- what it actually is.

alter table public.centre_owner_actions
  add column if not exists course_id uuid references public.courses (id) on delete cascade,
  add column if not exists previous_value text,
  add column if not exists new_value text;

create index if not exists centre_owner_actions_course_idx
  on public.centre_owner_actions (course_id, created_at desc);

comment on table public.centre_owner_actions is
  'Append-only record of management actions in a centre: who did what, when, and where possible what it was before. Despite the name it is not owner-only -- course-level actions (tutor roles, entry form) are logged here too, from migration 0263. Written by the service role via src/lib/activity-log.ts; never updated or deleted.';

comment on column public.centre_owner_actions.course_id is
  'Set for course-level actions; null for centre-level ones (roles, capabilities, settings).';
comment on column public.centre_owner_actions.previous_value is
  'Human-readable prior state, e.g. "Assistant course tutor". Null when the thing did not exist before. The point of the log is the change, not just the event.';
comment on column public.centre_owner_actions.new_value is
  'Human-readable new state, in the same words the interface uses.';

-- actor_profile_id is NOT NULL and references profiles with no on-delete
-- behaviour declared, which means a profile cannot be deleted while it has log
-- rows. That is the correct posture for an audit trail and is left as is.
