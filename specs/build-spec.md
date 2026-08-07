# Connect CELTA — build spec

Written 7 Aug 2026 by the designer, for Claude Code. Repo: `ramysakr1-ux/celta-connect` @ `main`.

This is the companion to the HTML designs in the sibling project. **The designs are references, not production code** — recreate them in the Next.js/Tailwind/Supabase app using its existing patterns. Everything below is a decision made with Ramy during design and is not recoverable from the screens alone.

Read `specs/apply-to-app.md` first for the token mapping and the chat-pill / timetable specs. This document covers everything after that.

---

## 0. Rules that constrain the whole system

These came from Cambridge's syllabus, the CELTA 5 booklet, the centre's own assignment briefs, and Ramy's corrections. Encode them once, centrally, and read them everywhere — not as scattered `if` statements.

**Course shape**
- 120 contact hours; 6 hours of assessed teaching per candidate; 8 TPs is the usual shape.
- A candidate must teach at a range of levels.
- Entry forms are submitted to Cambridge **two weeks before the course starts**. Record `courses.entry_form_sent_at`. This date is a gate — see §4.
- Attendance requirement is a **centre setting** (this centre: 100%, camera-off on Zoom counts as absent). Do not hardcode 80% or 100% anywhere.

**Teaching practice**
- A TP group splits into **halves of three teaching on alternate days**. Not everyone teaches every day.
- Rotation is **derived**, not stored per round: base order + round index, wrapping within the half. Change the base order and every future round recalculates.
- A withdrawn candidate **leaves an empty slot**. Positions of the others do not change. Do not re-derive.
- Observation is **not transferable**. A tutor may not mark a lesson they did not watch. If a tutor leaves, the replacement observes the next lesson themselves.

**Observation of experienced teachers — Admin Handbook 9.1**
- Six hours' directed observation of experienced ELT professionals. All six may be live; **a maximum of three hours may be filmed**. Filmed observation counts toward the six.
- **Peer observation cannot be included** in the six hours. It is required as a course activity (candidates attend TP in groups so peer observation can take place) but is never counted here.
- **Demonstration classes** taught by a tutor or other experienced teacher and observed by trainees **do count** — a demo class led by a tutor with the TP students is recommended.
- Mixed-mode courses: candidates should observe **both online and face-to-face** lessons. Moodle courses: three hours come from the online materials, three must be live from the centre.
- The record of attendance at observed classes goes in the **CELTA 5**; the observed teacher signs it **where the centre requires** — so the signature column is centre-optional, not always shown.

**Teaching practice — Admin Handbook 10.2**
- All assessed TP must be observed by a **verified** CELTA tutor, and each candidate must be observed/assessed by **a minimum of two tutors** during the course.
- **Five of the six assessed hours must be whole-class teaching.** One assessed lesson may be one-to-one or paired, where the course programme includes one-to-one teaching.
- Maximum TP length is **3 hours per day** for tutors and candidates.

**Assessor visit — Admin Handbook 13.1 / 13.2**

The pack must contain, in addition to portfolios:
- individual **descriptions of the candidates with photographs** where possible
- the **course timetable**
- the **TP schedule** with arrangements for the day of assessment
- **written assignment titles**
- the **application file** — application forms and completed selection tasks for **both rejected and accepted applicants**. *Nothing in the app currently holds rejected applicants; this needs a data model.*
- **lesson plans** for candidates teaching that day (at the latest, at the start of the lesson)
- **attendance registers for the language students** attending TP classes (the volunteer register)
- a **sample candidate end-of-course report**
- a copy of the **last assessor's report**, shared by secure means
- the **double-marking record** (8.2.3)
- face-to-face only: map and accommodation details

Portfolio selection — a minimum of four, made up of:
- **mandatory:** every candidate the assessor observes teaching; every candidate provisionally graded **Fail or potential Fail**; every **withdrawn** candidate (the assessor must check the file and comment in their report)
- **recommended:** candidates graded **Pass A or potential Pass A**
- the course admin picks the remainder. The app should propose the mandatory set automatically and let the admin complete it.

The assessor co-observes 1.5+ hours of TP including feedback, across **at least two different candidates**, and reads the portfolio of at least one candidate they observed. There must be an opportunity for the assessor to talk to candidates **without tutors present**.

New centres: the assessor for a centre's **first course is nominated by Cambridge**, not selected by the centre.

**CELTA 5 — the document of record**
- The app's **digital replica is the original**. No printing, no scanning back in. It carries **digital signatures from tutors and candidates**.
- It is stored on the **centre's own storage**, not in Connect CELTA and not on the centre's Drive folder used for the course export — a separate, retained location accessible to Cambridge.
- **Every tutorial record** follows the same pattern: tutor's signature + date; the candidate ticks *"I have read and agree with the summarising comments"* and signs + dates. Neither is complete without both.
- **Final-day declaration**, headed *"TO BE COMPLETED ON THE FINAL DAY OF THE COURSE"* — five checkboxes the candidate ticks, verbatim: *I have completed six hours of assessed teaching practice at at least two levels; I have completed six hours of observation of experienced teachers; I have completed four written assignments; The written assignments are my own work; I have completed all records.* Then candidate's signature + date, and **"Accepted by tutor"** + date. The app can pre-verify every one of the five from its own records and show the candidate what it knows — but the tick is theirs.
- This declaration is what decides **Withdrawn vs Fail** (see §3): an unsuccessful candidate who does not attend the final day and has not signed it is Withdrawn, not Fail.
- A further box, **"Information for the CELTA Grade Review — tutor comments on action points detailed in Stage Three progress record"**, must be completed for every candidate whose portfolio is submitted to Cambridge. It asks whether the candidate did or did not demonstrate effectiveness in the areas identified, referencing feedback in final lessons and/or written assignments.
- Note the rule embedded in the first checkbox: **six hours of assessed TP at at least two levels**. Track levels taught, not only hours.

**Two kinds of centre upload — treat them differently**

1. **Parsed into templates.** Assignment briefs and cover sheets, converted at centre setup into criteria rows, comment slots and section prompts. The source file is finished after import; never served, never round-tripped.
2. **Stored as documents.** The application file (application forms and completed selection tasks for **accepted and rejected** applicants), the centre's own timetable, and anything else the centre attaches. Uploaded at the start of the course, never parsed, held for the assessor pack and the close-out export.

Category 2 carries the most sensitive data in the system — **rejected applicants never became candidates and never signed anything**, yet their files are here. They must be covered by the same retention and deletion rules as candidate data, and named explicitly in the centre's privacy terms.

**Volunteer students**
- A volunteer belongs to a **class at a specific level** (Elementary, Upper-Intermediate, etc.), not merely to the course. Candidates must teach at a range of levels, so the class is what a TP is scheduled against.
- No account. A tokenised link, a consent gate, and their own class list, attendance, and handouts.

**Volunteer attendance and certificates — the hours model**
- **Certificates are earned by hours, never by levels or by courses.** Volunteers move between levels depending on what is running (A2 this course, B1 the next), which is not their doing. Cambridge puts one CEFR level at roughly **200 guided learning hours**, while one CELTA course gives a volunteer about **30**. A level is therefore the wrong unit and a course is too small; hours carry across both.
- Hours are **cumulative across courses and across levels**, held against the person, not the enrolment.
- **How a tick is earned.** A TP session is three 45-minute lessons (135 minutes). Presence is measured from **Zoom's join and leave timestamps, summed across rejoins** — dropping out and rejoining is not penalised, since connection loss is common and not the volunteer's fault. **Presence is enough: there is no camera rule for volunteers.** The camera-off-counts-as-absent rule applies to candidates only.
  - Under 90 minutes → **no tick**. Five minutes is nothing; one lesson is not enough.
  - **90 minutes or more → one tick**, and the tick credits the session **in full at 135 minutes (2¼ hours)**, whether they stayed 90 or 135. Deliberately generous: it removes any reason for a volunteer to watch the clock, and the 45-minute difference is not worth the complexity of pro-rating.
- **The certificate sits at 160 hours** — 80% of the 200 guided learning hours Cambridge suggests for one CEFR level. The volunteer never sees that calculation; they see a number and how far off it is. 160 hours is roughly 71 classes, or four to five courses, so **staging posts at 40, 80 and 120** keep the next milestone close enough to matter.
- The **90-minute threshold, the session length, the milestone values and the 160-hour target are all centre settings.** Do not hardcode.
- **Face-to-face sessions** have no Zoom timestamps; the tutor ticks the register directly and the same hours follow.
- Per-course attendance is shown to the volunteer as a plain count of classes, with **no percentage and no threshold** — the hours bank is the incentive, and making a volunteer do arithmetic about their own certificate is pressure with no purpose.

**Written assignments**

- Four assignments; **a candidate must pass 3 of 4 to be eligible for a PASS**.
- **One resubmission per assignment.** Fail on resubmission is a distinct outcome from Fail.
- Passing on first or second submission **does not affect the certificate grade**.
- Each assignment has **its own criteria list**, in its own order, imported from the centre's own cover sheet. Criteria are data. Never hardcode them.
- Assignments may be **conflated** — two briefs delivered as one document, counting as two, both parts must pass independently. The data model must allow one submission to satisfy two assignment records.
- **Double-marking — Admin Handbook 8.2.3.** A minimum of two tutors must be involved in marking. **A proportion of each assignment must be double-marked**, by candidate count: up to 9 candidates → **3 of each assignment**; up to 16 → **4**; up to 24 → **5**. The sample **must include any fail assignments**. Double-marking means checking the first marker's grading and comments; both tutors **initial** the assignment. **Blind double-marking** (each tutor marks independently, then they discuss and agree) is recommended but not required — support both modes, blind as an option, not the default.
- **Who double-marks whom is the centre's choice** — commonly tutors who swap TP groups mark each other's candidates. Do not encode a pairing rule. The app assigns and tracks; the centre decides.
- The centre **must keep a record of which assignments were double-marked**, and assessors may ask to see it. Generate that record automatically and include it in the assessor pack.
- **Resubmission deadlines live on the timetable**, like every other date — not computed from the return date. A **48-hour minimum** between returning marked work and the resubmission deadline is the guideline; it is centre-configurable, not fixed. Warn when a deadline gives a candidate less than the centre's minimum.
- **Cover sheet prints only the comments belonging to its own round.** The exported PDF is **one file per assignment**, containing both rounds clearly separated: outcome at the top (e.g. *Pass on Resubmission*), then the first submission with its comments, then the resubmission with its comments. The distinction between rounds must be unmistakable; one file per assignment is enough.
- Marked as **Met / Not met per criterion, per round** — not content/English pass marks. (An earlier design had this wrong.)
- Cover sheet carries: date, 1st marker, 2nd marker; four outcome boxes (Pass, Resubmission Needed, Pass on Resubmission, Fail on Resubmission); overall comment per round; the seven-point declaration including the AI conversation link.

**Grades**
- Provisional grades are trainer-only and never visible to a candidate before release.
- Provisional values are either **definite** (Fail, Pass, Pass B, Pass A) or **undecided**, written with a slash (Fail/Pass, Pass/Pass B, Pass B/Pass A). A slash means the tutors have not yet decided between two adjacent grades.
- **Withdrawal is a selectable value in both the provisional and final grade lists**, not only a status arrived at by event.
- **Warning letters are generated by state, and are safeguards** — nobody may reach a final grade without having been warned in writing. Two triggers:
  - A provisional grade of **Fail/Pass** → the candidate is given a **Stage 3 tutorial** and a **warning fail letter** stating what they must do to pass the course.
  - **Failing one written assignment** → a warning letter stating that they cannot fail another.
  - Both are drafted by the app with the specifics filled in (as the withdrawal letter is), signed, filed in the portfolio, and visible in the assessor pack as evidence the warning was given.
- **Stage 3 tutorials — Admin Handbook 9.2, verbatim triggers.** Stage 3 progress checks must be completed **in the final third of the course** for all candidates who: were **not to standard at Stage 2**; were **at standard at Stage 2 but are not making the expected progress** in the second half; were **above standard at Stage 2 but are not making the expected progress** in the second half; or **have received indications of Pass B or Pass A but have not maintained their progress**. All four are derivable by the app from the Stage 2 record plus subsequent TP outcomes — flag them rather than relying on a tutor to notice. In every case a tutorial must be given **and the whole tutorial record completed**. A centre may additionally give Stage 3 tutorials to everyone (centre setting).
- **Stage 1** is carried out on all candidates; a tutorial at Stage 1 is optional. **Stage 2** is carried out on all candidates and **requires a one-to-one tutorial**, ordinarily at the halfway point — after 3 hours' TP, when candidates swap tutors/TP groups — but the trigger is **hours of assessed TP, not calendar position** (a nine-lesson course puts it at 2h40 or 3h20). Derive it from assessed hours. The **final progress record must be completed for all candidates**. Minimum one tutorial per candidate overall, recorded in the CELTA 5.
- **Fail letter — Admin Handbook 9.2.** Potential Fail candidates are issued a Fail letter making the possible Fail outcome clear and **drawing attention to the action points detailed by the tutors in the CELTA 5**. It must be issued **with at least two lessons left to teach**, so the candidate can respond. The app should therefore warn when a Fail-risk candidate has fewer than two TPs remaining and no letter issued. It is filed in **CELTA 5 Section A** and appears in the assessor pack.
- **Mixed-mode rule:** if a candidate receives a Stage 3 tutorial and is borderline Pass/Fail, their **final two assessed TP lessons must be in the same mode** (all online or all face-to-face). Enforce this when scheduling.
- Final grades are **subject to confirmation by Cambridge**. The app is never the authority.
- Withdrawn and Extension are real outcome values alongside Pass A / Pass B / Pass / Fail.

**Chat**
- Resets at local midnight, every channel, no exceptions. Never a record of assessment.
- Trainees never get a cohort-wide channel — only their TP group and DMs to their own tutors. Staff channels are trainer-only, no admin exception (migration 0039).

---

## 1. Build order

Nothing below depends on anything above it being perfect, but this order avoids rework.

1. **Shell** — one 56px header replacing the current three bars. Wordmark left, nav, view-switcher, name. (`App Redesign.dc.html` 1a)
2. **Chat pill** — replaces `StaffChatDrawer` chrome; see `specs/apply-to-app.md` §1. Add the trainee/volunteer channel rules from §6 below.
3. **Timetable finish** — `specs/apply-to-app.md` §2. Everything downstream reads from it.
4. **Command Centre / Today** — replaces the marketing hero on `/trainer`. (`App Redesign.dc.html` 1a)
5. **Roster + portfolio** (1b, 1d)
6. **Rotation board** (`Rotation.dc.html`) — halves of three, derived order.
7. **TP points library and assignment** (`TP Points.dc.html`) — four release styles: scripted, framework, coaching prose, minimal.
8. **TP record** (`TP Record.dc.html`) — plan, procedure, self-evaluation, feedback in one screen with the form sticky right.
9. **Lesson plan** (`Lesson Plan.dc.html`) — narrow-left/wide-right; procedure table with fixed columns; timing sum against lesson length.
10. **Forms** (`Forms.dc.html`) — TP feedback, self-evaluation.
11. **Assignments** (`Assignment Review.dc.html`) — marking, resubmission side-by-side, four cover sheets.
12. **CELTA 5** (`CELTA 5 Record.dc.html`) — candidate and tutor columns, two counters.
13. **Grades report** (`Grades Report.dc.html`) — cohort sheet + per candidate; criteria lists generated from the CELTA 5 matrix.
14. **Assessor pack** (`Assessor Visit.dc.html`) — read-only token link. **Add the attendance register** (not yet designed; assessors ask for it and it may go to Cambridge).
15. **Trainee home** (`Trainee Home.dc.html`) — next session, announcements, waiting on you.
16. **Volunteers** (`Volunteer View.dc.html`, `Volunteer Register.dc.html`)
17. **Enrolment forms** (`Enrolment Forms.dc.html`) — candidate agreement, AI disclaimer, special consideration, complaints route.
18. **Pre-course task** (`Pre-Course Task.dc.html`) — five sections, aggregate view for the tutor.
19. **Centre admin** (`Centre Admin.dc.html`) — profile, Drive, brief import, tutors.
20. **Close-out** (`Course Close-out.dc.html`) — export, erase, duplicate.
21. **Demo** (`Demo Links.dc.html`) — flagged clone of the real app.
22. **Mobile** (`Mobile.dc.html`) — per-role scope, see §7.

---

## 2. Centre setup and the Drive model

**Import is a conversion, not a storage mode.** A centre connects Drive once and points at its brief and cover-sheet documents. The app parses them into template records: criteria rows, comment slots, section prompts, word limits. After import the source documents are finished — never served to a candidate, never round-tripped. Only the centre's *wording* survives, as data.

Consequence: no `.docx` is ever uploaded by a candidate or downloaded by a tutor as part of the assessment loop. Everything between import and export is app-native.

**Export is the mirror.** At close-out, one action writes the whole course to Drive as PDFs: folder per candidate (cover sheets, assignments, TP records with plans and feedback, self-evaluations, observations, CELTA 5, final report, certificate), plus course-level documents (grades report, timetable as taught, attendance register, tutor list). That export **is** the retention copy Cambridge requires, and it lives on the centre's Drive, not in the app.

**Sync is one-way, app → Drive, on release.** Never two-way. A file edited in Drive after marking would diverge silently from the record that generated it.

**Then the course closes.** Candidate accounts, submissions, feedback, chat and tokens are removed from the app; links stop working. The shell duplicates into the next course: resource hub, TP points library, assignment templates and criteria, timetable skeleton, time bands, tutor list, centre documents. Everything the centre built, none of the people.

**Blocking rules on close-out** — do not allow it while:
- a deferred candidate has no destination course chosen (or an explicit "hold at centre" flag);
- an extension is outstanding;
- Cambridge has not confirmed final grades. Hold the erasure, not the export.

---

## 3. Leaving the course — three statuses, not one

This is the area most likely to be built wrong. Three distinct things:

**Withdrawal** — formal and final. Requires a signed letter (the app generates it; see `Enrolment Forms.dc.html`). No reversal. A withdrawn candidate may still attend sessions unobserved and unassessed, so **withdrawn is a status, not a deletion**.
- Withdraw **before** `entry_form_sent_at`: Cambridge never sees them. Internal event only.
- Withdraw **after**: they appear in provisional and final grades with outcome **Withdrawn**.
- Their portfolio is **paused, not erased** — read-only, and it stays in the assessor pack marked Withdrawn, because assessors do ask to see withdrawn files.
- TP: the slot empties; nobody else moves.

**Deferral** — Admin Handbook 6.9: allowed **only if the candidate has completed more than half the course**, in exceptional circumstances, at the centre's discretion. Otherwise it is a withdrawal.
- Cambridge process: centre submits a deferral form via Appian → Cambridge confirms → the **original** course records the final grade as **Deferred** → the candidate's name is added to the **new** course's entry form marked deferred → the assessor is told in advance and given the previous assessor's comments → both centre and assessor confirm the final result at the end.
- Re-integration normally **no later than six months** after the original course ends (12 months part-time). Surface that deadline in the app.

**First-half withdrawal with a restart** — Admin Handbook 6.9, a separate case: a candidate forced to withdraw in the first half may, at the centre's discretion, **start a new course from the beginning without paying a new fee**, and *"can transfer any successful assessment to the new course."* Teaching starts again from TP1; passed assignments carry. This is not a deferral and must not reuse the deferral flow.

**Withdrawn vs Fail is decided by attendance and the CELTA 5 declaration, not by choice** (Admin Handbook 10.4):
- Attends to the end and submits a portfolio, even incomplete → **Fail**.
- Does not attend the final day and has not signed the CELTA 5 declaration → **Withdrawn**.
- Attends the whole course but declines assessment, in writing → **Withdrawn**.
- No portfolio available for grade review → **Withdrawn**.
- Withdrawn portfolios are not submitted to Cambridge, but **the assessor must check the file and record the reason** in their report — so it stays in the assessor pack.
- Freeze at the point they stop: portfolio locked, out of rotation and marking queue, link opens read-only.
- They are absent from the grades report and present in the roster as Deferred.
- At close-out the record **transfers** to the destination course rather than being erased, and also exports to Drive.
- The deferred candidate is added to the **new** course's entry form marked as deferred. **The assessor is informed.**
- What carries: completed TPs read-only and credited, with numbering continuing (TP4 next); passed assignments with their original marker; an open resubmission keeps its one remaining chance, deadline from the new timetable; CELTA 5 criteria stay met, each recording who assessed them and on which course.
- What does not carry: chat, links, workspace URL.
- **Open question for Ramy:** do carried TPs count toward the six assessed hours on the new course? This decides the new rotation.

**Extension** — for special consideration (illness, dyslexia, declared at enrolment). The candidate completes **after the official end date** and the final grade is recorded as **extension**. Close-out waits.

**Staff changes.** A tutor is deactivated, never deleted. Everything they wrote or signed keeps their name permanently — including if they die. Going forward, one name replaces another: the successor takes the group, the marking queue and the channels from that point. They may not mark an observation they did not watch.

---

## 4. `entry_form_sent_at` — why it matters

One field, four behaviours:

1. Decides whether a withdrawal is internal or a reportable **Withdrawn** outcome.
2. Fixes candidate **names** — the certificate prints the name on the entry form. After sending, warn on any name edit; it now diverges from what Cambridge holds.
3. Fixes the **cohort**. Adding a candidate after entry must be explicit and warned, or you get a full portfolio with no Cambridge entry, discovered at grading.
4. It is the one date on the course clock that does **not** derive from the timetable — it comes from Cambridge's calendar.

---

## 5. Guidance, not tours

Three kinds only. No product tour, no coach marks, no persistent help panel.

1. **Empty states that teach** — Rotation before groups exist explains halves of three; the timetable before a skeleton explains generating one. They vanish when content arrives, so a tutor on their fourth course never sees them.
2. **Blocked actions that say why** — "Lock the timetable before assigning rounds." This is the strongest teaching mechanism in the app; make it consistent everywhere an action is disabled.
3. **One-time notes** on genuinely new concepts (self-evaluation, starred action points carrying forward). Dismissed permanently, per person.

Guidance differs by role: admin needs sequencing (setup is done once), trainers need only blocked-action explanations (they repeat the loop), trainees need the most (first and only time, and anxious).

---

## 6. Chat channel rules by role

- **Trainer** — centre trainers, all staff, TP group channels, DMs to trainers on the same course. As built.
- **Trainee** — their own TP group, and DMs to their own tutors. **No cohort-wide channel.** Chat is informal; deadlines and feedback live in the workspace, and the picker says so.
- **Admin** — may not be on any course. Their pill lists course tutor groups they administer, not candidates.
- **Assessor / volunteer** — no chat at all.

Everything resets at local midnight. The bar states the reset and counts down to it.

---

## 7. Mobile scope

Website, not an app — a link is the product. Offer "Add to Home Screen" for trainees only (daily use for five weeks).

- **Trainer** — capture, not marking. Points typed or dictated during a TP, tagged and timestamped against the right candidate, appearing in the feedback form on the laptop.
- **Trainee** — everything, one question per screen, dictation on the question itself. Some candidates have no laptop; a course that assumes one excludes them.
- **Assessor** — reading.
- **Admin** — status plus the one or two decisions only they can make.
- **Laptop only** — marking against criteria, the rotation board, the grade meeting, editing the timetable, centre setup. Say so on the phone rather than shipping a cramped version.

---

## 8. Bugs found in the current build

1. `message-thread.tsx` uses `scrollIntoView` — can scroll the whole page. Set `el.scrollTop = el.scrollHeight` on the panel instead.
2. `StaffChatDrawer` is invisible until hovered — undiscoverable and unreachable by keyboard. Replace with the dimmed-at-rest pill.
3. Roster rows carry `cursor-pointer` but only the name cell is a link. Make the whole row navigate.
4. Course Stream uses emoji (🎥, 📎) where the rest of the app uses lucide. Swap for `Video` and `Paperclip`.
5. The "Pinned" badge is solid `bg-gold` — the only solid-gold fill in the app. Gold is reserved for the wordmark and Pass A. Use `.pill-gold`.
6. Broadcast titles are larger than the section heading above them. 20px/600.
7. Course Stream aligns its sidebar with an invisible spacer `<h2>Spacer</h2>`. Use a shared grid header row.
8. `TraineeEyebrowLabel` renders inside the wordmark `<Link>`, making the label part of the click target.

---

## 9. Still open — needs Ramy before building

1. Do carried TPs count toward the six assessed hours on a deferral's new course?
2. Where do **applicants** live in the data model? The assessor requires the application file including **rejected** applicants, and the app currently has no concept of an applicant. Decided: uploaded as documents at course start (§ centre uploads) — but the retention and consent position for rejected applicants needs Ramy's sign-off.
3. Does the centre's Drive hold the CELTA 5, or is "the centre's own storage" a separate location? (Ramy: separate. Confirm which.)

**Answered during design — recorded above, listed here for traceability:** provisional grade pairs and the slash rule; warning letters and Stage 3 triggers; second/double marking (numbers, blind vs check, who chooses); resubmission deadlines on the timetable; filmed and peer observation; volunteer class levels; assessor documents and portfolio selection; the CELTA 5 as digital original; cover sheet round scope and one PDF per assignment.

---

## 10. Design system

Tokens, radius, fonts and component classes are already correct in `globals.css` — keep them. Newsreader for headings and figures, Karla for everything else, Instrument Serif/Sans **only** in `Wordmark`. Teal primary, gold reserved (wordmark, Pass A, system-rule dots), cream ground, hairlines over fills, no box-shadows outside floating overlays.

Two patterns used throughout the designs and worth making shared components:

- **A 3px left rule** in place of a background fill, coloured by category. Used in the timetable, TP record, and every list where an item has a type.
- **A small gold dot** meaning "a system rule is in force" — the chat reset, a locked timetable, a released grade, an expiring link. One dot, one meaning, everywhere.
