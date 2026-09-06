# Volunteer students page (trainer tab) — v2 build spec

Design reference: `Volunteer Students v2.dc.html` (README.md in this folder has every measurement and colour). This file is what changes in the codebase and why.

## 1. What the current page gets wrong
- The trainer register is a flat list (name, copy link, remove). Class/level, attendance and hours are not on it, so a tutor can't see who is drifting or who never received their link.
- The v1 redesign (`Volunteer Register.dc.html`) introduced a **"10 of 12 classes needed" eligibility rule with "can miss n more" text. That rule does not exist.** `build-spec.md` → "Volunteer attendance and certificates — the hours model" is the only model: hours, cumulative across courses, certificate at 160 h, no percentage, no threshold. Remove any such rule if it was built.
- Nothing shows the day-before RSVP aggregate to the trainer (`for-claude-code-volunteer-rsvp.md` §3 asked for it on Roster; it belongs on this page too, per class, with names).

## 2. Page structure (`/trainer/volunteers`)
1. Header + actions (Filming consent form, Register view link, Add student → inline add row).
2. **Today strip** — only when a TP volunteer session exists today.
3. **Register grouped by class** — one card per class, students as rows.
4. **Student card** — right column, sticky, driven by the selected row. No separate route.

## 3. Attendance and hours — computed, never entered
Per student per held event, from `volunteer_attendance` join/leave sums via `computeSessionTicks` with the centre's settings:
- `present` — minutes ≥ threshold (default 90 = 2 of 3 lessons). Banks `session_length_hours` (default 2.25).
- `one_lesson` — 45 ≤ minutes < threshold. Recorded, banks 0.
- `absent` — < 45 or no record after the event.
Hours banked = Σ present × session hours **across all courses for the `volunteer_person_id`** (same query the Centre Admin volunteer pool uses). Next milestone = first of `[40, 80, 120, 160]` above hours.

Generalise the threshold to the session's lesson count: `need = ceil(lessons * 2/3)`; the rule line in the header prints `"Present means {need} of a session's {lessons} lessons and banks the whole {hours} h"`. On a two-lesson day that reads 1 of 2 and 1½ h. Read `lessons`, `threshold_minutes`, `session_hours`, `milestones`, `target_hours` from centre settings.

Face-to-face events have no Zoom data: the tutor's manual tick on the timetable event writes the same `volunteer_attendance` row; this page never has its own tick control.

## 4. Today strip data
For today's TP event(s), per class:
- `coming` = rows in `volunteer_confirmations` for the event.
- `cant` = rows in `volunteer_declines` for the event.
- `no_reply` = registered − coming − cant. Never read as a no.
- `in_room` = live Zoom participants matched to `volunteer_student` (webhook `participant_joined` without a later `participant_left`). Until the event is over, the today segment shows dashed (unmarked) or teal-30% (in the room). After the event closes, the tick is computed as §3 and the segment becomes present / one lesson / absent.
Chip state precedence: in_room > coming > cant > (underway ? not_joined_yet : no_reply).
Headcount line: before start `"{coming} coming · {cant} can't · {no_reply} no reply"`; underway `"{in_room} in the room · {coming} said they were coming"`.
Top-right summary is the same across every class on the page.

## 5. Register row
Columns: Student (+ drift note) · This course (12 segments = `course_tp_schedule` volunteer events for that class, in date order) · Hours banked of 160 (+ next milestone, gold bar) · Link (last_opened; "Never opened" when null) · Copy.
Drift note: `one_lesson ≥ 2` → amber "{n} one-lesson marks — leaving early"; else `absent ≥ 2` → red "{n} absences". Class header counts students with a drift note as "drifting" and null `last_opened` as "never opened link".

## 6. Student card
Hours card text: `"{prior} h from {n} earlier course(s) + {here} h here. {gap} h to the {milestone}-hour {milestone|certificate} — {ceil(gap / session_hours)} more classes."` When ≥ target: `"Certificate earned. Hours keep accruing on the record."`
Session list: held events newest first + today's; state text per §3/§4. Link facts: today's reply, last opened, filming consent, expires (course end).
Actions: Copy, Re-issue (new token, old one dies, attendance and hours untouched), Remove (attendance record stays, link dies).

## 7. Add student
Fields: name, class (select from this course's volunteer classes), **email**. Email is what links the new registration to an existing `volunteer_person_id` (auto-link on exact email match, otherwise the pool's manual "Same person as…" — never by name). Button "Add and send link" sends the volunteer invitation immediately.

## 8. Roles
MCT and ACT see the same page and data. No spec restricts an ACT's view of volunteers; if a restriction exists in code, hide write actions (Add / Remove / Re-issue / Share) for ACT, not rows.

## 9. Remove / do not build
- Any "X% attendance", "n of 12 needed", "can miss n more" on the trainer or volunteer side.
- Any manual mark/tick control on this page (ticks live on the timetable event for face-to-face).
- Per-class hours math on the volunteer's own page (already covered by `for-claude-code-volunteer-rsvp.md` §1).

## 10. Open questions for the user
- Should the ACT be able to add/remove volunteers, or is that MCT/admin only?
- Does the Today strip also need to appear on the Roster page (as the RSVP spec suggested), or is this page enough now that it exists here?
