# Paste this to Claude Code

After phase 6, before the two waiting orders.

---

Before starting the next orders, please read `specs/foundation-audit.md` and act on it. It is a review of migrations 0001–0048 against the design specs, looking only at things that get expensive to fix later.

Three of the four foundations are right, and worth saying so: the timetable genuinely owns the course clock, assignment rounds are section-scoped with a good trigger guarding the comment columns, and rotation derives position from a base order rather than storing it. All three match the design.

There are five problems. Two are structural and I would like them fixed before more screens are built on them.

## 1. TP7 and TP8 cannot be assigned

`course_tp_schedule.tp_number` and `plan_assignments.tp_number` are both `check (tp_number between 1 and 6)`, but `course_timetable_events.linked_tp_number` allows 1–8 and migration 0025 is `syllabus_planning_tp7_8`. So the timetable can schedule the last two lessons and rotation cannot assign them.

Widen both constraints to 1–8.

## 2. There is no TP group of six — only one level of grouping

`course_subgroup_members` has `unique (trainee_id)`, so a trainee belongs to exactly one subgroup and there is one level of grouping.

The design assumes two. A **TP group of six** owns a tutor, a chat channel and the peer-observation cohort. It splits into **halves of three** who teach on alternate days — the Cambridge rule is a maximum of three TPs per day, so six candidates cannot all teach on the same day.

With one level, either the subgroup is six and there is no alternate-day split, or the subgroup is three and there is nothing for the group chat channel, the five peer observers, or "this tutor's group" to attach to.

Suggested fix, which is the smaller of the two options: add `half smallint` to `course_subgroup_members`, treat the subgroup as the group of six, and change `assign_tp_round` to rotate **within the half** rather than across the whole subgroup. Everything currently attached to the subgroup stays attached.

The alternative is a parent `course_tp_groups` table, which is cleaner on paper and a much larger migration. Your call — you know the schema better than I do.

**Please clear any populated `plan_assignments` rows and re-run afterwards**, since the position calculation changes.

## 3, 4 and 5 — when convenient, but not at the very end

- **A late submission is impossible.** `submit_assignment_round()` raises when `due_date < current_date` with no override. A candidate an hour late cannot submit at all, so the conversation happens offline and the app has no record. Allow it, mark it late, let the tutor decide.
- **`assignment_type` is a closed four-value check.** The plagiarism reflection (a centre sanction, specified in `build-spec.md`) and conflated assignments both need a migration to exist. Better as a per-centre row than a constraint.
- **`tutor_role` is on `profiles`, not per course.** A tutor cannot be MCT on one course and TP tutor on another. Also missing `trainer_in_training`, which has real Cambridge rules — verification before training, name on the entry form, does not count toward the two-verified-tutor minimum, and needs a named supervisor (usually but not always the MCT). `external_assessor` probably does not belong in that list at all, since an assessor has no account.

## One request

If any of this is wrong — particularly the single-level grouping, which may have a reason I cannot see from reading migrations — say so rather than changing it. You have been in this schema for weeks and I have only read it.

Other specs worth knowing about, all in `specs/`:

- `design-files.md` — which design files are current and which are superseded. Nine are marked with a red banner; do not build from those.
- `green.md` — exactly which greens go and which stay.
- `build-spec.md` — everything else, including the Cambridge rules.
