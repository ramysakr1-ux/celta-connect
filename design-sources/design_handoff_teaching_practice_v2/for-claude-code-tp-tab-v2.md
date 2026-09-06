# Teaching Practice tab — v2 build spec (feedback-owed queue)

Design: `Teaching Practice v2.dc.html`; README.md in this folder has every measurement, colour and state. Files touched: `src/app/trainer/(hub)/tp/page.tsx`, `src/lib/tp-marking-queue.ts`.

## 1. Purpose
List every taught lesson the viewer still owes written feedback on, as cards showing what is already available to write from (live notes, self-evaluation, draft). One click → candidate's TP page, feedback editor open. Today's session and tomorrow's slots below as context. Nothing on the page is edited in place.

## 2. Queue (`tp-marking-queue.ts`)
Replace the three-bucket shape with:

**owed[]** — `slot.end_at < now()` AND no `tp_feedback` with `published_at` for (lesson, assigned_tutor).
Per item: tp_number, slot (date, index, start), candidate (id, name, group, tutor), point (title, aim_type via `aim-type.ts`, level), `age_hours`, `is_late = age_hours > centre.feedback_same_day_hours`, `notes = { count, criteria[] }` from the tutor's live observation sheet for that lesson, `self_evaluation = { received_at } | { due_at }`, `draft = { points, criteria_tagged } | null` from an unpublished `tp_feedback`, `standing_flag` (roster flag text if the candidate is at risk / last grade NS, else null).
Sort `slot.end_at` ascending. Scope: `mine` (assigned tutor = viewer); MCT may also fetch `others` (other tutors' owed, same shape) for the Show toggle. ACT: `mine` only.

**today** — the live TP session for a group the viewer covers: date, tp_number, group, level, room, observers (non-teaching half), peer_task_criterion, feedback_session_at, slots[] each `{ start, candidate, point, state: taught | now | next, live_notes_count }`.

**tomorrow** — next teaching day's slots for covered groups: `{ start, candidate, plan_status: submitted | missing, plan_due_at }`.

## 3. Page (`tp/page.tsx`)
Header: title, role pill (role colour), debt line built from `owed.length` and late count, context line, links to `/trainer/rotation` and `/trainer/roster`.
Cards grid per README. Card link: `/trainer/candidates/{id}/tp/{tp_number}?feedback=open`. Button label: `draft ? 'Continue draft' : 'Write feedback'`. Card footer: `standing_flag ?? (self_evaluation.received_at ? 'Everything is in' : 'Can start now; release waits for the self-eval')`.
"On your desk" rows are read-only status; no handlers.
MCT: when `others.length > 0` render the line "{n} more owed by {tutor} ({group})" + Show/Hide (`?others=1`); shown cards merge into the grid by age.
Today card: hidden when no live session. Timeline progress = index of `now` slot / (slots − 1). Feedback session is the last stop.
Empty owed: italic "Nothing owed. Every taught lesson has your feedback."

## 4. Role colour
Use the existing role accent tokens from Roster v2 / Tutorials: MCT garnet, ACT gold. Apply to pill, card edges, age pills (not late), CTA (deep shade), Today eyebrow/progress, hovers. Late is red in both roles. Do not use teal on this page.

## 5. Drop-off
Card leaves `owed` on `tp_feedback.published_at` set. Not on candidate release, not on peer-note reveal. Drafts remain.

## 6. Out of scope (do not add)
Counters/tiles, candidate × TP grid, grades, attendance, rotation setup, plan-check or release workflow, manual ticks of any kind.

## 7. Settings read
`centre.feedback_same_day_hours`; course TP calendar and slot lengths; peer task criterion per TP.

## 8. Open questions
- Should the "None — write from film" state also deep-link to the lesson recording?
- Should the ACT see the other group's owed count (number only, no cards), or nothing (spec: nothing)?
