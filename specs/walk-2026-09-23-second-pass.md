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
| `f47316e9` | The grade form told a tutor "Admin Handbook 10.2: a fail-risk letter **must** be issued with **at least two assessed lessons** still to teach". 10.2, continuing onto printed page 31, says potential Fail candidates "**should** also be issued with a Fail letter... **ideally** with at least two **lessons** left to teach". Two overstatements in one line, and on a course past that point it read as a breached obligation rather than late guidance. `src/lib/letters/fail-risk.ts` had quoted it correctly all along, one file away from the screen that got it wrong. |
| `a6e6edf8` | **The TinT asynchronous ceiling was measured against the wrong denominator.** TinT Handbook 2026 p7 puts both figures on one basis — "observation of 80% of a CELTA course... Asynchronous observation of up to 10% OF THE COURSE". `inputObservedPct` divided by the course's input sessions; `inputAsyncPct`, the line below it on the same card, divided by sessions observed so far. The error only runs one way: strictest at the start, when least is known. A TinT who had watched 10 of 33 with 2 async read 20% and tripped the alarm, where the course basis reads 6%. The demo's real breach still trips (5 of 33 = 15%). |

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

- **The grade form and the TinT card, walked after the first write-up**
  (`f47316e9`, `a6e6edf8`) — see the table. Both were Cambridge wording or
  arithmetic, neither visible to any automated check.
- **Handbook 10.2 carries two unrelated rules** and both citations of it in
  the app are right: the roster cites it for Stage 2 at the halfway point
  ("after 3 hours' TP"), the grade form for the fail letter. It is
  "Tutorials and records of progress", and it runs across printed pages
  30-31.
- **TinT: TP and feedback can never be asynchronous** (TinT Handbook p7,
  same sentence as the 10% ceiling). Already correct — those rows pass
  `showAsync={false}` and the heading says so. The server action would
  still accept `asynchronous=on` for a TP event from a crafted POST; the
  UI never offers it, so this is hardening, not a bug.
- **Resource hub chips with no number** (Input sessions, Centre documents)
  are deliberate: "A count appears only when there is something to count",
  because every count reading 0 on a fresh course looked broken rather
  than empty.

## Open

- ~~**`next/font/google` fails production builds intermittently.**~~
  **CLOSED `aac33040` — the four faces are self-hosted.** The Google loader
  fetches them at BUILD time, so every production build depended on a
  network call that sometimes did not answer: three failures today, two on
  Vercel and one locally, each followed by a passing retry. Downloaded as
  the latin subset only (matching the `subsets: ["latin"]` already asked
  for) and as the variable font where one exists, so one file covers every
  weight: newsreader 132KB, instrument-sans 57KB, karla 32KB,
  instrument-serif-italic 16KB. The weight ranges and `font-stretch` are
  Google's own descriptors read from the css2 API, not guessed, and
  Instrument Serif is declared **italic** because the file is the italic
  cut — calling it normal lets the browser synthesise a second slant.
  The CSS variable names are untouched, which is the whole contract with
  globals.css and the Wordmark. Verified live: all four register with the
  right ranges, the wordmark still paints Instrument Serif italic 400, and
  **zero** `fonts.gstatic.com` / `fonts.googleapis.com` references survive
  in the build output or on the page. All four are SIL OFL 1.1; licence and
  copyright lines are in `src/app/fonts/`.
- ~~**Feedback sessions are still identified by title.**~~
  **CLOSED — migration `0311` gave it a type** (`8a035f83`, restoring
  `0fe15372`). Four shapes were in the table and all four real: `Feedback /
  Self-evaluations lead`, `Feedback / Written feedback only` from the
  generator, `Written feedback only / Final TP, no live session` from the
  seed, and `Giving feedback on tasks` — an INPUT session about feedback
  that must never match. `includes` caught the fourth, `startsWith` missed
  the third. Worse, generator and seed disagreed, so the assessor's
  visit-day note fired on a seeded course and stayed silent on a generated
  one — on the last TP day, which is where a visit lands.
  Two facts, two columns: `type = 'feedback'` and `feedback_written_only`.
  A written-only day keeps the feedback type deliberately — the candidate
  must still see it; what differs is that nobody can sit in it — so
  `isFeedbackSession` asks whether it exists and
  `isObservableFeedbackSession` whether anyone can attend, which is what
  Handbook 14.2 wants. The note now names which of the two problems it
  found.
  **The lesson that cost the most here: a migration reporting the right
  numbers is not proof it ran on the right database.** Two runs from the
  SQL editor returned `32 4 0 1` against a database that was not this one.
  `supabase_migrations.schema_migrations` tracks only to 0264 while the
  repo is at 0311 — everything since has been applied by hand — so that
  table cannot tell you what has landed either. Check over a direct
  Postgres connection (`information_schema.columns`, `pg_constraint`), not
  through PostgREST, whose stale schema cache looks identical to a
  migration that never ran. Code that needs a migration must not be pushed
  until that check passes; this one was, and was reverted within minutes
  because `timetable-skeleton` inserting `type='feedback'` against the old
  CHECK would have broken timetable generation for every new course.
- ~~**The walkthrough course still has `accepting_applications` set**~~
  **CLOSED** — turned off on Ramy's instruction. No course that has ended
  is flagged open any more.

  It comes back on a re-clone: `clone-walkthrough-course.mjs` copies the
  demo course row wholesale (`select("*")` then `remapRow`), and the demo
  course is deliberately `accepting_applications: true`. Ramy: "leave it."
  Harmless either way — the date guard keeps a finished course off
  `/apply` whatever the flag says.

**Nothing is open from this walk.**
