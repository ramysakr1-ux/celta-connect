# Announcements — full list, triggers and logic

Written 15 Aug 2026, for Claude Code. Companion to `for-claude-code-trainer-remaining-screens.md` §9 (composer/scheduled/posted UI) and §3a (Stage 2 booking sheet). This file is the single list of every announcement instance and its trigger logic — copy is a starting point, not final wording.

## Shared rules (apply to every announcement below)
- **One stream** on the candidate's home screen, under the next session, above the to-do list. Broadcast and personal messages mix in the same stream — a candidate cares what's next, not which category it is.
- **Anchored to a timetable event or a system event, never a fixed date.** This is what lets a whole course's announcement set duplicate into the next course and re-anchor automatically.
- **A message stops the moment its subject changes state.** Withdrawn candidate never gets "you teach tomorrow"; a cancelled TP cancels its own reminder.
- **Pacing cap**: one routine message a day; a second waits for tomorrow. Empty days are fine.
- **Push notification** only for cancellation, room change, or something already late. No email during the course.
- **Every scheduled (timetable-anchored) announcement** carries Post now / Edit / Skip, editable up to the moment it fires (see trainer-remaining-screens.md §9 for the UI).
- **Audience determines who can send it**, not role: course-wide broadcast is MCT-only; a message to one TP group can be sent by any tutor attached to that group.

## A. Timetable-anchored (fire automatically the moment the timetable is published)

| Trigger | Audience | Copy starting point |
| --- | --- | --- |
| Day before an assignment's deadline | Whole cohort (or one group, if staggered ABC/DEF dates) | "Assignment [N] is due tomorrow — the brief is in the hub." |
| A TP round is released | Whole cohort | "TP[N] points are released — start planning." |
| 2 days before the assessor visit | Whole cohort | "Your assessor visits on [day]." |
| Morning before the final day | Whole cohort | "Final day — bring your portfolio complete." |
| Stage 2 tutorial block added to a group's timetable slot | That TP group only | "Stage 2 tutorials [day] — book your spot." (links to booking sheet, §3a) |
| Stage 1 / Stage 3 tutorial window opens | Whole cohort or named candidate, depending on whether the stage applies to all or one | "Stage [1/3] progress checks start this week." |

## B. System-event (fire when the thing happens, not on a schedule)

| Trigger | Audience | Copy starting point |
| --- | --- | --- |
| An assignment is marked / feedback returned | The one candidate | "Assignment [N] feedback is ready." |
| A tutorial is booked (Stage 2 sheet, or any bookable slot) | The one candidate who booked | Confirmation only shown on the sheet itself, not pushed — see §3a, "the sheet is the source of truth." |
| Resubmission required | The one candidate | "Assignment [N] needs resubmission — due [date]." |
| A candidate's level/group changes | Whole cohort or the affected candidate, depending on scope | "You're now in Group [X]." |

## C. Volunteer / Zoom

| Trigger | Audience | Copy starting point |
| --- | --- | --- |
| Volunteer session starting soon | Registered volunteers for that session | "Your class starts in 30 minutes — join here." |
| Attendance register not logged after a session | The trainer who ran it | "Register [session] hasn't been logged yet." |

## D. Tutor-typed (rare, kept rare by design)
- Course-wide broadcast: MCT only. Before sending, the composer states who it reaches and how many ("this goes to 12 candidates and 3 tutors now").
- Group message: any tutor attached to that group, same reach-confirmation line, scoped to the group.

## Build blockers — flagged by Claude Code, not design decisions

These items in the tables above have no supporting infrastructure or data model today. Listed here so they're not mistaken for ready-to-build; each needs its own scoping pass before implementation.

- **Push notifications** (cancellation/room-change/late-item pushes, volunteer "starts in 30 min"): no push infra exists — no service worker, no FCM/APNs. Volunteers also have no persistent logged-in stream to push into.
- **"Any tutor attached to a group" sending**: no tutor-to-group ownership model exists — `course_tutors` links a profile to a whole course, not a subgroup. Group-scoped sending (Stage 2 booking nudge, group messages) needs this first.
- **Pacing cap** (max 1/day, defer excess to tomorrow): needs a real prioritization rule for which reminder wins when several land the same day — not yet decided.
- **"Register not logged" trainer reminder**: schema can't currently distinguish "logged, zero present" from "never logged" — needs a schema fix, not a heuristic guess.
- **Level/group-change announcement**: there's no existing way to move a trainee between subgroups anywhere in the app yet, so this announcement has nothing to hook to.
- **Stage 3 tutorial window**: no Stage 3 milestone exists on the timetable (only Stage 1); Stage 3 is conditional per-candidate, not a whole-cohort date, so it can't be a timetable-anchored announcement as written.
- **Staggered ABC/DEF deadlines**: `course_timetable_events` has no group-scoping column, so a staggered per-group deadline can't be told apart from a single course-wide one today.

## Two safeguards (repeat from build-spec.md, restated here so this file is self-contained)

1. A message stops the moment its subject's state changes.
2. A tutor can see what's queued for the next few days and hold anything before it fires — the first time an automated reminder says something untrue, the whole stream loses credibility.
