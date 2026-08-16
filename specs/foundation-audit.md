# Foundation audit — 7 Aug 2026

Read against `ramysakr1-ux/celta-connect@main`, migrations 0001–0048. Only the four things that are expensive to fix late. Surface issues (copy, colour, spacing) deliberately ignored — those are cheap at any point.

**Verdict: the foundations are sound.** Three of four are right. There are five specific problems, two of which are genuinely expensive.

---

## What is right, and worth saying so

**The timetable owns the clock.** `course_timetable_events` is documented as "the single source of truth for the whole course clock (This Week panel, assignment due/overdue states, TP dates)", with `courses.timetable_locked_at` recording commitment. Assignment links are by `assignment_type`, not per-trainee — correct, since a due date is course-wide.

**Assignment rounds are section-scoped.** `assignment_section_responses` carries `first_response` / `first_comments` / `resubmission_response` / `resubmission_comments` per section. Exactly the model the design needs — a resubmission rewrites one section, not the document. Better than specified: a trigger strips comment columns on any trainee write, so a raw client call cannot fake tutor comments.

**Rotation is derived, not stored.** `base_slot` per member, position computed as `((base_slot + (tp_number - 1)) % size) + 1`. Editing the base order only affects rounds not yet populated, by construction. This is right.

---

## Expensive — fix before more screens are built

### 1. TP7 and TP8 cannot be assigned

`course_tp_schedule.tp_number` and `plan_assignments.tp_number` are both `check (tp_number between 1 and 6)`. But `course_timetable_events.linked_tp_number` allows 1–8, and migration 0025 is named `syllabus_planning_tp7_8`.

So the timetable can schedule TP7 and TP8, and the rotation cannot assign them. A candidate's last two lessons have no plan assignment.

**Fix:** widen both constraints to 1–8. Cheap now, and every screen built on `plan_assignments` inherits the ceiling if left.

### 2. There is no "TP group of six" — only subgroups

`course_subgroup_members` has `unique (trainee_id)`, so a trainee belongs to exactly one subgroup, ever. There is one level of grouping, not two.

The design assumes two: a **TP group of six** (which owns a tutor, a chat channel, and a peer-observation cohort) splitting into **halves of three** that teach on alternate days.

With one level, either:
- a subgroup is six, and all six rotate together with no alternate-day split; or
- a subgroup is three, and the group of six does not exist — so there is nothing for the TP group chat channel, the five peer observers, or "this tutor's group" to attach to.

**This is the expensive one.** Peer observation, chat scoping and tutor assignment all hang off the group of six. Adding the level later means migrating existing rows and touching every RLS policy that joins through subgroups.

**Fix:** add `half smallint` to `course_subgroup_members`, treat the subgroup as the six, and make `assign_tp_round` rotate **within the half** rather than across the subgroup. Everything else stays attached to the subgroup as it already is. (The alternative — a parent `course_tp_groups` table — is cleaner on paper and a much larger migration.)

**Migration warning:** this changes the position calculation, so any rounds already populated in a test database will hold wrong positions and must be cleared and re-run. Do it before there is real data.

---

## Cheaper, but wrong

### 3. A late submission is impossible

`submit_assignment_round()` raises *"The deadline for this assignment has passed"* when `due_date < current_date`, and there is no override.

A candidate who misses a deadline by an hour cannot submit at all. In practice a tutor will accept late work and there is no way to record it — the app forces the conversation offline and then has no record of what happened.

**Fix:** allow late submission, mark it late, and let the tutor decide. `submitted_late boolean` on the round. The tutor's judgement is the mechanism, not the constraint.

### 4. `assignment_type` is a closed four-value list

`check (assignment_type in ('Focus on Learner', 'LRT', 'Skills', 'LfC'))`.

The plagiarism reflection cannot be created without a migration, and neither can a conflated assignment (two briefs as one document, counting as two).

**Fix:** either add `'plagiarism_reflection'` now, or drop the check and make the type a row in a per-centre table. The second is better and matches "criteria are data, not code".

### 5. `tutor_role` is per-person, not per-course

`profiles.tutor_role` holds one value for the person. A tutor who is MCT on one course and TP tutor on another cannot be both, and the value follows them between courses.

Also missing: **`trainer_in_training`**, which is a real Cambridge role with its own rules — verification before training, name on the entry form, does not count toward the two-verified-tutor minimum, needs a named supervisor.

`external_assessor` is in the list but an assessor has no account and arrives by token, so it may not belong there at all.

**Fix:** move the role to the course–tutor join, allow more than one per course, add `trainer_in_training`, and add a `supervisor_id` on that row for TinTs.

---

## What I could not check from the schema

- Whether the UI actually gates on `timetable_locked_at` — the migration is explicit that the DB does not enforce the lock, the app does.
- Whether the four-role list is used consistently in the interface.
- Anything about the trainer-in-training, peer observation, malpractice, applications or appeals models, which do not exist in migrations yet.

---

## The instruction to hand over

> Read `specs/foundation-audit.md`. Fix problems 1 and 2 before building further.
>
> **1.** Widen `course_tp_schedule.tp_number` and `plan_assignments.tp_number` from `between 1 and 6` to `between 1 and 8`. The timetable already allows 8 and migration 0025 covers TP7–8.
>
> **2.** Add `half smallint` to `course_subgroup_members`. The subgroup is the TP group of six; the half is the three who teach on a given day. `assign_tp_round` rotates within the half, not across the subgroup. Clear any populated `plan_assignments` rows and re-run, since positions change.
>
> Then 3, 4 and 5 in the same file when convenient.

## Recommendation

Fix **1 and 2 now**, before more screens are built on them. Both are structural and both get more expensive with every route that reads them.

**3, 4 and 5** can wait for a batch, but should not wait until the end — they are one-migration fixes each and they change behaviour people will otherwise design around.

Everything else can accumulate safely for a single reconciliation pass.
