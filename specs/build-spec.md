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
- the **application file** — application forms and completed selection tasks for **both rejected and accepted applicants**. Applicants are first-class records (see "Application and selection" below), so the pack generates rather than being uploaded.
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
2. **Stored as documents.** The centre's own timetable, policies, and anything else it attaches. Uploaded at the start of the course, never parsed, held for the assessor pack and the close-out export. *(The application file used to live here. It does not any more — see "Application and selection".)*

Retention note: the most sensitive data in the system is not in either category — it is the **rejected applicants** held as records under § Application and selection. They never became candidates and never accepted terms, yet their files are retained for the assessor. They fall under the same retention and deletion rules as candidate data, and must be named explicitly in the centre's privacy terms and on the application form itself.

**Announcements are schedulable, and they duplicate.**
- An announcement may be posted now or **anchored to a timetable event** — "the day before Assignment 3 is due", "when round 4 is released", "two days before the assessment visit". Never to an absolute date.
- The anchor is what makes duplication work: a whole course's announcements can be written once at setup and carried into every later course as part of the centre's shell (alongside the resource hub, TP points, timetable skeleton and assignment templates). The new course's timetable supplies the dates; nothing is edited.
- Each announcement carries a **keep-on-duplicate flag**, default on for anchored ones and off for ad-hoc ones ("Room 2 projector is fixed"), which are specific to a single course.
- **Scheduling is a default, not a lock.** Every scheduled announcement carries **Post now**, and can be edited or skipped at any point before it fires. Posting early cancels the schedule rather than duplicating the message. A trainer must never have to wait for their own announcement.
- Anchored announcements that never fire — because their event was removed from the timetable — should surface as a warning at close-out rather than disappearing silently.

**Navigation — one change from the code.** The canonical trainer tabs today are Today, Roster, Timetable, Volunteers, Teaching Practice (also matching `/rotation` and `/coursebooks`), Audio Library, Grades Report. **Replace the Audio Library tab with a Resource hub tab.** Audio is material, and it never justified a place in the header while coursebooks and TP points — which are larger — did not have one. The hub holds six sections: TP points, coursebooks, multimedia, assignment briefs, input sessions, centre documents. `/audio` and `/coursebooks` become sections within it; keep the routes and redirect. Rotation stays under Teaching Practice. The candidate portfolio stays reachable from a roster row, not the nav.

**Peer observation — the shared sheet**
- Peer observation is a required course activity but **never counts toward the six hours** (Admin Handbook 9.1). Log it separately; keep it out of the six-hour tally.
- **Five take notes during each lesson** — everyone in the group of six except the candidate teaching. Notes are private while being written; one sheet per lesson.
- **Two prompts per note, never more, and both are single-line boxes.** An observer is there to watch a lesson, not to type through one — the note should take under a minute and read as a jotting. Cap each at roughly 140 characters and let it be obvious from the box height. Anything longer gets filled in carelessly, and short notes make for sharper feedback.
- **The task is generated from the criterion the cohort is working on**, which comes from that week's input session. Week one asks about instructions (4c), week four about staging and pace. The same criterion is what tutors mark on each candidate's own next lesson — so watching for it and being assessed on it are the same act. This is the thread: input session → criterion → TP point → peer task → TP feedback.
- **The feedback slot on the timetable reveals every note at once.** Not the lesson end, not all-notes-submitted — the slot. The tutor may open it early. Never gate on every note being finished; one person forgetting would block the group.
- **From that moment the group splits, and everyone writes.** The three who **taught** write their **self-evaluations**. The three who **did not teach today** read all the notes and agree the **group feedback**. Nobody sits waiting while others talk about them.
- **Then one-to-one oral feedback**, using the notes. The tutor marks the self-evaluations while it happens.
- **Afterwards the candidates who taught receive the written peer notes and keep them — but NOT in the portfolio.** Peer feedback is not a Cambridge document. Keeping it out of the assessed record is also what lets it stay candid.
- **Where it sits:** on the candidate's own **TP record** for that lesson, below the assessed material, in a block headed "From your peers". Same page as their plan, self-evaluation and tutor feedback, because that is where they will look for it — but visually and structurally outside the assessment.
- **The boundary, stated once:** observation of experienced teachers (live, filmed, or a tutor's demo) is recorded in **CELTA 5 and the portfolio** — it is the Cambridge record of the six hours. Peer observation is **excluded** from CELTA 5, the portfolio, the grade review, the assessor pack, and the close-out export. Two different things that happen to share a form.
- Needs a `peer_observations` table; nothing in the current build has one.

**Prompts adapt to the delivery mode**

Every generated prompt — peer observation tasks, self-evaluation questions, TP point wording — is written twice, once per mode, and the course's mode decides which is served. Criterion 4c is the same criterion either way; only the language changes.

| | Face-to-face | Online |
|---|---|---|
| 4c instructions | "Where did instructions land? Watch the room after you stop talking." | "Where did instructions land? Watch the tiles after you stop talking." |
| Grouping | pairs, monitoring, moving between tables | breakout rooms, dropping in, timing the return |
| Materials | handouts, board work, realia | shared screen, annotation, chat, links |
| Attention | eye contact, seating, board position | cameras, spotlighting, chat as a channel |

On a **mixed-mode course** the mode is a property of the individual lesson, not the course — the timetable already knows which lessons are online, so read it from there rather than a course-level setting. A candidate teaching online on Tuesday and in a room on Thursday gets the right vocabulary each day.

Where a criterion genuinely has no online analogue (or vice versa), the alternate reads as guidance rather than a forced translation. Do not invent a breakout-room equivalent of walking between tables where none exists.

**Self-evaluation — prompts resolve through a fallback chain**

The form is never generic. Its prompts are drawn from the most specific thing available for that lesson, falling back in this order:

1. **The lesson plan**, if one was submitted — its stated aims, anticipated problems and personal aims. The candidate evaluates against what they said they would do, which is the sharpest version.
2. **The TP point**, if there is no plan — the aim and focus the tutor assigned for that round.
3. **The stage of the course and its criteria**, if there is neither — the criteria the cohort is being assessed on at that point, which is also what the peer observation task is drawn from.

Each level down is less specific but never empty; there is no state in which the candidate sees a blank form. The form should say which source it used ("From your lesson plan" / "From TP3 points" / "Stage 2 criteria"), so a candidate who skipped their plan can see the consequence.

This is the same criteria thread as everywhere else: input session → criterion → TP point → lesson plan → self-evaluation → peer task → tutor feedback. One vocabulary the whole course speaks.

**Application and selection — Admin Handbook 6.2 and 6.3**

Applicants are **first-class records, not uploaded documents.** The file exists from first contact; an accepted applicant becomes a candidate with nothing retyped. See `Applications.dc.html`.

- **Entry requirements (6.3), all four required.** At least 18 — Cambridge recommends 20 or over, 18–20 at the centre's discretion. An awareness of language and competence in written and spoken English sufficient to undertake the course and prepare to teach a range of levels — recommended level C2 or C1+. A standard of education equivalent to that required for entry into higher education; where formal qualifications are absent, the centre may accept at its discretion if screening is convincing, and the evidence must be recorded. CELTA is for applicants with little or no ELT experience; some experience with little formal training may be considered.
- **Selection process (6.2).** Selection is conducted by **verified course tutors** or a nominated person at the centre. **All applicants must be interviewed** — online or face to face, in surroundings where privacy can be assured. **All applicants must submit written tasks before being accepted**, and those tasks must include **language awareness tasks and an extended writing task**. For courses with an online TP element, the interview should be conducted online on the centre's teaching platform, and the process must assess **digital literacy**.
- **The extended writing task offers a choice of prompt.** The centre defines three or four — one narrative, one descriptive, one argumentative — and the applicant picks one. Three or four, not ten: enough that nobody is stuck with a prompt they have nothing to say about, few enough that a tutor knows them by heart. **The marking criteria do not change with the prompt** (organisation, accuracy, range, holding a position for 400 words), which is what keeps the writing comparable and a rejection defensible under 6.2. Record which prompt they chose — the choice is itself a small piece of evidence.
- Prompts, like interview questions and assignment criteria, are **centre settings imported at setup**, with defaults supplied. Different centres select for different things.
- **Equality of opportunity** is the centre's responsibility, and questions about physical and mental health must follow local legislation. The app must not force a health question; it offers a single optional "anything we should know" field and leaves the wording to the centre.
- **Candidates must be told**, and it should be recorded that they were: completing the course does not guarantee success; there are **no exemptions or recognition of prior learning**; and on mixed-mode courses, the additional demand of changing TP mode.
- **Applicants who cannot attend significant parts of the course must not be accepted** (6.5). Ask at application, not at enrolment.
- **Special requirements (6.4)** are declared at application, so arrangements exist on day one rather than being improvised in week two.
- **Rejections require a written reason.** The applicant may ask, and the assessor may look. The reason goes into the letter the applicant receives.
- **The application page is public and centre-branded.** The centre links to it from their own website. It carries the **centre's logo and name prominently, with the Connect mark small in the footer** — the one public surface where both appear, because an applicant benefits from knowing what system they are entering. Serve it from a **per-centre subdomain** (`iti.celtaconnect.com/apply`) so the address reads as the centre's page; build the routing for this early rather than retrofitting it.
- **Links are unlimited and filtered.** One permanent link per centre is the default, and the form asks which intake. A centre may generate as many as it wants — per course, per campus, per advertising source — each carrying its own filter. Per-source links also tell a centre where its applicants actually come from.
- **AI reads the written task; a person decides.** The app may generate a reading of the extended writing task and the language awareness answers **against the centre's own marking scheme** — never against a general notion of quality. Rules, non-negotiable:
  - It produces **observations and a where-to-look**, never a score, a ranking, or an accept/reject. The strongest wording it may use is "worth interviewing" or "worth a careful interview".
  - Each observation cites what it is reading — "both phonology items blank", "one comma splice in 400 words" — so a tutor can check it in seconds rather than trusting it.
  - It is **always labelled as a suggestion**, visually distinct from anything a person wrote, and it is **never shown to the applicant** or included in the assessor pack.
  - A tutor's decision is recorded independently. If the app ever lets a tutor accept a suggestion with one click, it has become the decision-maker — so it must not.
  - **Rejections still require a human-written reason.** A generated sentence is not a reason, and an applicant challenging a rejection is entitled to a person's judgement.
  - Because the process must demonstrate equality of opportunity (6.2), record that a suggestion was generated and what it said. An unexamined model quietly filtering applicants is precisely the risk here.
- **Rejected applicants' files are retained** for the course they applied to, appear in the assessor pack, and are deleted with everything else at close-out.

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
  - **Signatories are derived, not fixed.** If a course tutor gave the tutorial or marked the assignment, there are three: that tutor, **the main course tutor countersigning**, and the candidate acknowledging receipt. If the MCT did it themselves, the first two collapse into one and the letter has two. The app knows who conducted the tutorial and who marked the assignment, so it decides — and a tutor can still add or remove a signatory before issuing. The MCT's name must appear either way: it is what makes the notice the centre speaking rather than an individual.
  - The candidate acknowledges receipt, not agreement — refusing to sign does not invalidate the notice, and it is recorded as unacknowledged for the assessor.
  - Withdrawal and deferral keep **two** signatures. Those are agreements between the candidate and the centre, not notices issued to a candidate.
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
9. **The broadcast composer is inside a candidate's portfolio.** `src/app/portfolio/[traineeId]/broadcast-composer.tsx` posts to the whole cohort but is only reachable by opening one trainee's page. Move it to `/trainer` (Today) or its own route; `postBroadcast` and the `course_broadcasts` table stay unchanged.

---

## 9. Still open — needs Ramy before building

1. Do carried TPs count toward the six assessed hours on a deferral's new course?
2. What is the retention and consent position for **rejected applicants**? Their files are required for the assessor and are held as first-class records (§ Application and selection), but they never became candidates and never accepted any terms. The application form itself needs to state how long their data is kept and on what basis.
3. Does the centre's Drive hold the CELTA 5, or is "the centre's own storage" a separate location? (Ramy: separate. Confirm which.)

**Answered during design — recorded above, listed here for traceability:** provisional grade pairs and the slash rule; warning letters and Stage 3 triggers; second/double marking (numbers, blind vs check, who chooses); resubmission deadlines on the timetable; filmed and peer observation; volunteer class levels; assessor documents and portfolio selection; the CELTA 5 as digital original; cover sheet round scope and one PDF per assignment.

---

## 10. Design system

Tokens, radius, fonts and component classes are already correct in `globals.css` — keep them. Newsreader for headings and figures, Karla for everything else, Instrument Serif/Sans **only** in `Wordmark`. Teal primary, gold reserved (wordmark, Pass A, system-rule dots), cream ground, hairlines over fills, no box-shadows outside floating overlays.

Two patterns used throughout the designs and worth making shared components:

- **A 3px left rule** in place of a background fill, coloured by category. Used in the timetable, TP record, and every list where an item has a type.
- **A small gold dot** meaning "a system rule is in force" — the chat reset, a locked timetable, a released grade, an expiring link. One dot, one meaning, everywhere.
