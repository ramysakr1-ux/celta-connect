# Walk — second pass, 23 September 2026

Ramy: "now let's walk connect."

The morning's walk had been every role
(`specs/walk-2026-09-23-every-role.md`). This one started where that one
had not: the public front door, then the rooms a tutor lives in, reading
screens against each other and against the Handbook.

Eight commits, all built, pushed and verified live.

## Baselines

`npm run smoke:prod` clean before and after (221 pages, 9 roles).
`npm run check:browser --base https://www.celtaconnect.com` clean after
(81 pages, 6 roles). As with the morning, neither suite was ever going to
find what follows: every item is two screens disagreeing, or a screen
disagreeing with the Handbook.

**Run the browser check against production, not the dev server.** Its
`page.goto` timeout is 20-30s and a cold Turbopack route takes longer to
compile than that, so on localhost it fails route by route as it walks
into each uncompiled page — nothing to do with the code. It takes
`--base`.

## Found and fixed

| | |
|---|---|
| `8cda0f39` | **celtaconnect.com/apply offered the public one course: "CELTA Walkthrough (Ramy)", which ended on 18 September, labelled "places available".** It was the only course at the only real centre with `accepting_applications` set. The flag is the centre's switch for closing an intake early and cannot notice that the course is over. Guarded on the END date, not the start — a centre may legitimately take a late applicant after a course begins, and which day that stops being true is their policy; a finished course is not a policy question. Both ways in: `/apply?course=<id>` preselects an intake, so a stale link would otherwise submit against it. |
| `e431075c` | Same fault in `regenerateSlotsForInterviewer`: every generated interview slot is pinned to each `accepting_applications` intake, and every slot is in the FUTURE, so regenerating a pattern at Elmswood would have booked interviewers into next month against a course that had finished. |
| `d343765c` `24ea7e1e` | **The trainer's Assignments board read "Language Related Tasks 4 of 4 settled" while Today's banner said "LRT 0/4" one room away.** The second marks are stamped 24, 25 and 29 September. `/assessor/double-marking` had already hit this and patched `second_marker_recorded_at: asOf(...)` over the result of `assignmentAsOf` at its own call site; the board calls `assignmentAsOf` and nothing else. Moved into `assignmentAsOf` — **and note the second commit**: the first attempt put it after three early returns, which every affected row takes, so it cleared nothing. It now runs before them. |
| `3f822a26` | **Twenty assignment stamps dated after the course ends.** Now that every reader is as-of, a stamp past the end is invisible for ever: the double-marking sample could never reach §9.2.3's quota of four at any point in the course's life, and a fail sat permanently outside the sample. Cause is arithmetic on the deadline — LfC is due day 19, LRT 17/18, and the builders add +1, +2, +4, +5, +6. `atDayCapped` clamps them. Live rows repaired too, each moved stamp keeping its order so a countersign never predates its own submission. |
| `dcf13b06` | The roster heading read "6 of 12 candidates · Group B · 3 at risk" above a tile saying "2 At risk". The third was Marek Kowalski, who withdrew in week 2. `roster-table`'s tiles and `roster-row` both exclude a frozen record; the page heading counted every row. |
| `37cfdf27` | **Teaching Practice listed the same withdrawn candidate among today's observers and gave him tomorrow's 10:00 TP8 slot, "no plan yet, due 09:00".** He STAYS in `members` — the rotation is `rotationPosition(baseSlot, members.length, tp)`, so removing him would slide every other candidate onto the wrong slot time, and a mid-course withdrawal may still have taught lessons whose feedback is owed. Marked instead, and excluded from the two things still ahead of him. The tomorrow filter runs AFTER the map, because the slot time is `dayEvents[i]`. |
| `3a32d62f` | Today said "14:15 Feedback · Written feedback only"; the TP tab said "Feedback session · All three, A2 · Reveal peer notes after" for the same slot. The card asserted both lines as constants. It now uses the event's own title and detail. |
| `8453fdf0` | Six places decided whether a row is the TP feedback session, three different ways — `title === "Feedback"` in the timetable (x2), the trainee's rail and the assessor day (x2), `startsWith("feedback")` in the TP queue. They agree on today's data and disagree the moment a centre writes "Feedback - Group A". One shared predicate, the looser of the two. |

## Checked and NOT bugs — do not re-raise

- **No credit on the login page.** The credit is landing-only per shell
  (`project_connect_mark_never_changes`) and login is not a shell.
- **§9.2.3 cited for BOTH double-marking and one-resubmission.** Both are
  right. Printed page 28 holds the quota bands, "the sample checked should
  include any fail assignments", "initialled by both tutors", AND
  "resubmit any assignment that does not meet the specified criteria on
  one occasion only". Connect and Lite cite the same section for two
  different rules that genuinely both live there.
- **"0/4" as the double-marking quota on a course of 11.** Handbook
  §9.2.3: "10-16 candidates: four of each assignment to be
  double-marked."
- **The assessor tab's §14.2 lines.** Checked word for word against
  printed page 40: two portfolios in full, borderline cases where there
  are more than two Fails, co-observe two candidates for 1½ hours or
  more, at least one observed candidate's portfolio read, feedback
  observed on the day or an earlier session's if delayed. All accurate.
- **Volunteers: "10 h to 10" beside a student with 0 h banked, under a
  column headed "of 30".** `milestonesFor(30)` builds a 10/20/30 ladder;
  that is the next MILESTONE, not the certificate. Deliberate.
- **`/demo/centre-manager` 404s.** The centre manager's demo route is
  `/demo/centre-admin` (it mints `demo-centre-manager@...`). My URL, not a
  missing route.

## Open

- **`next/font/google` fails production builds intermittently.** One
  deploy this afternoon errored on "next/font/google queries have exactly
  one entry" fetching Newsreader in `src/app/layout.tsx`; another failed
  the same way five hours earlier. Local builds pass every time. A
  production deploy that depends on a font CDN at build time can fail for
  reasons that have nothing to do with the commit. Self-hosting the two
  faces would remove the dependency.
- **Feedback sessions are still identified by title.** The type column
  cannot answer it — "Feedback" and "Written feedback only" are both
  `supervised_session`. A dedicated type is the real fix, as migration
  0296 did for the unassessed teaching slot. `8453fdf0` only makes every
  room ask the same question.
- **The walkthrough course still has `accepting_applications` set** on a
  course that ended 18 Sept. Harmless now the guard is in, and it is
  Ramy's own private course, so the flag is his to clear.
