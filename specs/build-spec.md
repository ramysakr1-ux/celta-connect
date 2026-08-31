# Connect — build spec

Written 7 Aug 2026 by the designer, for Claude Code. Repo: `ramysakr1-ux/celta-connect` @ `main`.

This is the companion to the HTML designs in the sibling project. **The designs are references, not production code** — recreate them in the Next.js/Tailwind/Supabase app using its existing patterns. Everything below is a decision made with Ramy during design and is not recoverable from the screens alone.

Read `specs/apply-to-app.md` first for the token mapping and the chat-pill / timetable specs. This document covers everything after that.

---

> **How this file is organised.** Part A is the course as candidates and tutors experience it. Part B is everything a centre administrator does. Part C is who can talk to whom. Part D is the interface itself. Part E is what is broken or undecided. Sections keep their original wording; only the order and the numbering have changed.

## 1. Rules that constrain the whole system

These came from Cambridge's syllabus, the CELTA 5 booklet, the centre's own assignment briefs, and Ramy's corrections. Encode them once, centrally, and read them everywhere — not as scattered `if` statements.

**Course shape**
- 120 contact hours; 6 hours of assessed teaching per candidate; 8 TPs is the usual shape.
- A candidate must teach at a range of levels.
- Entry forms are submitted to Cambridge **two weeks before the course starts**. Record `courses.entry_form_sent_at`. This date is a gate — see §4.
- Attendance requirement is a **centre setting** (this centre: 100%, camera-off on Zoom counts as absent). Do not hardcode 80% or 100% anywhere.

**Teaching practice**
- A TP group splits into **halves of three teaching on alternate days**. Not everyone teaches every day.
- **Group size is not always six.** The split is floor/ceil, not a special case: six → 3 + 3, five → 3 + 2, four → 2 + 2. The larger half takes the earlier TP day. Everything downstream — derived order, peer-observation cohort, the "no more than three TPs in one day" rule — reads the half's actual length, never the constant 3.
- Rotation is **derived**, not stored per round: base order + round index, wrapping within the half. Change the base order and every future round recalculates.
- A withdrawn candidate **leaves an empty slot**. Positions of the others do not change. Do not re-derive.
- Observation is **not transferable**. A tutor may not mark a lesson they did not watch. If a tutor leaves, the replacement observes the next lesson themselves.

**Observation of experienced teachers — Admin Handbook 10.1**
- Six hours' directed observation of experienced ELT professionals. All six may be live; **a maximum of three hours may be filmed**. Filmed observation counts toward the six.
- **Peer observation cannot be included** in the six hours. It is required as a course activity (candidates attend TP in groups so peer observation can take place) but is never counted here.
- **Demonstration classes** taught by a tutor or other experienced teacher and observed by trainees **do count** — a demo class led by a tutor with the TP students is recommended.
- Mixed-mode courses: candidates should observe **both online and face-to-face** lessons. Moodle courses: three hours come from the online materials, three must be live from the centre.
- The record of attendance at observed classes goes in the **CELTA 5**; the observed teacher signs it **where the centre requires** — so the signature column is centre-optional, not always shown.

**Teaching practice — Admin Handbook 9.1.3**
- All assessed TP must be observed by a **verified** CELTA tutor, and each candidate must be observed/assessed by **a minimum of two tutors** during the course.
- **Five of the six assessed hours must be whole-class teaching.** One assessed lesson may be one-to-one or paired, where the course programme includes one-to-one teaching.
- Maximum TP length is **3 hours per day** for tutors and candidates.

**Assessor visit — Admin Handbook 14.1 / 14.2**

The pack must contain, in addition to portfolios:
- individual **descriptions of the candidates with photographs** where possible
- the **course timetable**
- the **TP schedule** with arrangements for the day of assessment
- **written assignment titles**
- the **application file** — application forms and completed selection tasks for **both rejected and accepted applicants**. Applicants are first-class records (see "Application and selection" below), so the pack generates rather than being uploaded.
- **lesson plans** for candidates teaching that day (at the latest, at the start of the lesson)
- **attendance registers for the language students** attending TP classes (the volunteer register). **This is the only register the assessor pack needs.** Candidate attendance is not a separate list — it is recorded in the CELTA 5 and nowhere else, and no candidate attendance register should be built for the pack.
- a **sample candidate end-of-course report**
- a copy of the **last assessor's report**, shared by secure means
- the **double-marking record** (9.2.3)
- face-to-face only: map and accommodation details

Portfolio selection — **how many depends on which kind of assessment this is**, corrected 31 Aug 2026 against the real Administration Handbook (June 2025) 14.2:

- **regular assessment** (remote by default, the usual case): **two** portfolios read in full. Where more than two candidates are Fail, the assessor focuses on the borderline cases.
- **two-yearly face-to-face assessment**: **a minimum of four**, plus every portfolio provisionally graded Fail or potential Fail.

This line previously said "a minimum of four" flat, which is the two-yearly rule stated as though it were universal. The app already models the distinction — `courses.assessment_kind`, read by `src/lib/assessor-requirements.ts` — so the spec was the only thing left saying otherwise.

Whichever the count, the selection is made up of:
- **mandatory:** every candidate the assessor observes teaching; every candidate provisionally graded **Fail or potential Fail**; every **withdrawn** candidate (the assessor must check the file and comment in their report)
- **recommended:** candidates graded **Pass A or potential Pass A**
- the course admin picks the remainder. The app should propose the mandatory set automatically and let the admin complete it.

**The pack is sent two to three days before the visit, not opened on the day.** This is the deadline the app must work backwards from, and it changes what "complete" means: portfolios have to be finished, provisional grades recorded, and the double-marking sample done **before** that send date, not before the visit. Surface the send date on the course clock as its own milestone, warn when anything in the pack is incomplete as it approaches, and record when the pack was actually sent — an assessor arriving to material they have not been able to read in advance is a real finding against the centre.

The assessor co-observes 1.5+ hours of TP including feedback, across **at least two different candidates**, and reads the portfolio of at least one candidate they observed. There must be an opportunity for the assessor to talk to candidates **without tutors present**.

New centres: the assessor for a centre's **first course is nominated by Cambridge**, not selected by the centre.

**CELTA 5 — the document of record**
- The app's **digital replica is the original**. No printing, no scanning back in. It carries **digital signatures from tutors and candidates**.
- It is stored on the **centre's own storage**, not in Connect and not on the centre's Drive folder used for the course export — a separate, retained location accessible to Cambridge.
- **Signatures are typed once at enrolment and fixed for the course.** Each person types their name into a signature field during enrolment and confirms it; from then on signing anything is a single confirmation, never retyping and never drawing. There is no edit-your-signature setting — correcting a genuine mistake is a centre admin action with a reason recorded. The mark is **copied onto the document at the moment of signing**, not rendered live from the account, so nothing can reach back and alter an already-signed document. Stored with every signature: who, verified account, timestamp, document version, and whether it means agreement or receipt. **Name and Signed are separate fields** wherever a form asks for both (the CELTA 5 does): Name prints plainly in the body face, Signed renders the stored mark in the script face (Dancing Script, as the final report already does). Same string, two treatments. **Editing a signed document breaks its signature** — it shows as signed against an older version until re-signed, never silently.
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

**Resource hub — two additions**

*Input sessions are grouped under the session, not listed flat.* Each input session is a heading with its own material beneath it: slides, handout, recording. This is the one part of the hub that is not pure presentation over the existing `resources` query — it needs a **nullable session reference on a resource** (a `course_timetable_events` id) plus an optional recording link. **The recording is optional and never assumed**: the Recording pill appears only where a recording resource actually exists for that session. Sessions are not routinely recorded, and a card for an unrecorded session shows slides and handout alone with no empty slot implying something is missing. Without that field, Input Sessions stays a flat category like the others. **Group everywhere a real parent record already exists**, and only there: assignment briefs under their assignment (brief, resubmission cover sheet, and trainer-side the answer key and sample — the assignment id is already on the record), TP points under their round, coursebooks under book and level. All three need no new field. Lesson Planning stays flat: those files are genuinely independent and grouping them would invent a parent that does not exist.

*A TP7–8 material pool, separate from TP points.* Scanned pages and audio from books the course does not otherwise use, held as its own hub category. Spending the TP points library on the two lessons candidates choose for themselves would leave the next cohort meeting used material, so this pool sits apart and is restocked per course. Two resource types carry it: `scan` and `audio`. Items are claimable and exclusive — one item, one candidate — and a claim releases automatically if the candidate withdraws or changes lesson type.

**TP7 and TP8 — the syllabus planning grid**

For TP1–6 the tutor sets the point and the rotation assigns from the base order. **For TP7–8 this inverts: the grid is the source of truth.** The claim made in the grid creates the plan assignment, and the TP card, lesson plan and feedback form all read from it. The timetable only says when. (This is why `course_tp_schedule.tp_number` and `plan_assignments.tp_number` must widen from 1–6 to 1–8 — see `foundation-audit.md` problem 1.)

The grid is **its own page**, not a panel on the timetable: six candidates write into it over several days, while the timetable stays tutor-owned and read-only. The timetable carries a read-only strip linking to it.

*The suggestion is arithmetic, not judgement.* Across TP7 and TP8 each candidate should teach **one skills lesson and one language lesson, and each should be a type they have not taught before**. The grid reads their six completed TPs, finds the two gaps, and proposes. **Any type can be chosen.** Overriding the suggestion asks for one line of reasoning, which appears in the tutor's view and in the TP record. Two overrides in a group of six is a normal number, not a flag.

**Peer observation — the shared sheet**
- Peer observation is a required course activity but **never counts toward the six hours** (Admin Handbook 10.1). Log it separately; keep it out of the six-hour tally.
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

**Resource hub visibility — trainers see everything, trainees see part**

The hub has six sections; the candidate's Resources tab shows fewer. Set visibility **per section**, with sensible defaults a centre can change:

| Section | Trainer | Trainee |
| --- | --- | --- |
| Input sessions and their materials | yes | yes |
| Coursebooks | yes | yes |
| Multimedia | yes | yes |
| Assignment briefs | yes | yes |
| Forms and documents (blank PDFs, syllabus, appeals procedure) | yes | yes |
| **TP points library** | yes | **no** |
| **Centre documents** (policies, application files, assessor reports) | yes | **no** |

The TP points library is the important exclusion: a candidate seeing the scripted-through-to-aim-only progression, and next round's points before release, changes what teaching practice is for. Individual items can also be marked staff-only within an otherwise visible section.

**Close-out is staged over one week, not a single moment**

The sequence, in order:

1. **Export.** Everything becomes PDFs on the centre's Drive — portfolios per candidate, CELTA 5 records, reports, certificates, the grades report, the timetable as taught, the volunteer registers. This is the retention copy, and the centre owns it.
2. **Seven days of grace.** Everything stays live and readable in Connect for one week after close. Links keep working, including the assessor's. This is what catches the thing nobody noticed on the day — a missing signature, a report that needs re-sending, an assessor checking one more portfolio.
3. **Then erasure.** Candidate accounts, submissions, feedback, chat, tokens, links.

**What survives erasure, and only these:**

- **The course shell**, duplicated into the next course — resource hub, TP points library, assignment templates and criteria, timetable skeleton, time bands, tutor list, centre documents. Everything the centre built, none of the people.
- **Text fingerprints of submitted assignments**, for cross-course plagiarism scanning. Enough to match against, not enough to reconstruct or attribute without a deliberate lookup. This must be stated in the candidate agreement, since it is the one thing that outlives the deletion promise.

**Everything else goes**, and the portfolio is the thing that matters: it is exported to the centre and then removed from Connect.

**One rule for everyone: everything expires one week after the course end date.** Not different windows per role — candidates, tutors, volunteers, assessors, admins on that course, every link and every account, all at the same moment. One date to explain, one date to enforce, and nothing to remember.

The grace week is what makes it fair rather than abrupt. In those seven days:

- **Candidates** can download anything from their own portfolio. Tell them so in the final-day email, with the date.
- **Volunteers** can download their certificate and anything from their class.
- **Tutors** can retrieve anything they need before it goes.
- **The assessor** can check a portfolio after the visit.

After that the links stop working, for everyone, and the centre's Drive export is the record.

**No extension for appeals.** An appeal is against the centre, not against Connect, and the centre already holds the exported PDFs — portfolio, CELTA 5, reports, application file, everything Cambridge asks for in an appeal bundle. Connect holding a second copy adds nothing and complicates the promise. One week, for everyone, no exceptions.

**Erasure is permanent — there is no archive and no undelete.** Say so plainly on the close-out confirmation, because the difference between "archived" and "gone" is the difference between an inconvenience and a disaster. The export is the only copy that survives, which is why close-out must refuse to run if the export has not completed successfully.

The one deliberate exception is the platform owner, who can extend a course's expiry before it passes — for a centre that asks in time. After the week has run, nothing can be recovered, and that limitation is real rather than a policy.

**Retention rules that constrain close-out — Admin Handbook**

Close-out as designed erases at the end of the course. Cambridge requires several things to survive it:

- **Application forms and selection tasks must be kept for six months after the end of the course**, and be available on assessment day. This includes **rejected applicants**. **The centre holds this, not Connect.** The close-out export delivers everything as PDFs to the centre's Drive, and the six-month obligation runs against the centre's own copy. Connect erases on schedule; what the centre does with its files after six months is the centre's decision. This is the same position as every other document: the centre owns the course, Connect is where it was run.
- **Cambridge reserves the right to request portfolios for moderation and awards meetings**, after the course. **Cambridge does not accept hard copies** — portfolios must be electronic and securely stored, which the Drive export satisfies.
- Centres keep **electronic summary records of candidate progress and back-up records** (feedback sheets, progress and tutorial records).
- **Tutors retain a record of the provisional grades agreed at the grading meeting**, to refer to when completing the centre grade approval form in Appian.
- **The assessor's report is the property of Cambridge**, confidential, and **must not be quoted from or used for advertising**. Nothing in the design breaches this — it is a constraint on marketing, not on the app. Two build rules follow: the demo course must never contain real assessor report text, and a freelance tutor sees the report at the centre rather than receiving an exportable copy (2.4.6).

So the close-out sequence is one staged erasure, same clock for everyone including rejected applicants: export everything at close (PDFs to the centre's Drive, including rejected applicants' files), seven days of grace, then erase. Connect never holds anything for six months — that retention is the centre's own responsibility once the files are theirs, who may keep copies indefinitely on its own Drive. **Resolved 16 Aug, corrects an earlier draft of this line that had Connect holding applicant records for six months — it does not.**

**AI-assisted marking is a per-tutor, per-course permission**

Not on for everyone, and not a platform-wide switch. Three levels, all off by default:

1. **Centre setting** — whether the centre permits it at all.
2. **Course setting** — whether it is on for a given course.
3. **Per-tutor** — which named tutors may use it on that course.

So one tutor can use it while the others on the same course do not, which is the requested behaviour and also the right compliance posture: it makes usage a deliberate, recorded, named decision rather than a default.

**No AI attribution on a tutor's work.** A candidate is being assessed; a tutor is not. A tutor consulting a reference book, a coursebook or a colleague does not stamp their feedback with the source, and a reading tool is the same kind of thing. The declaration rules attach to **being assessed**, not to being a person — the same tutor writing a master's dissertation is a student again and declares.

So: **once a tutor has reviewed a suggested comment or rating, it is simply their comment or rating.** No badge, no "suggested by AI", no attribution anywhere — not on the marked assignment, not on the cover sheet, not in the portfolio, not in the assessor pack.

**Keep the pre-review state, but stop calling it AI.** The dashed, tinted, unmistakable state stays — its purpose is not attribution but **preventing a tutor sending text they have not read**, the same reason an editor highlights unsaved changes. Label it *"not yet reviewed"*, not *"suggested by AI"*. It disappears the moment the tutor touches it.

**Audit at the course level, not per comment.** Do not stamp individual comments. Keep a simple course-level record — which tutors had the permission, and that suggestions were generated — so a centre can answer a direct question without every document carrying a mark. That is enough for an assessor and invisible to everyone else.

**Still non-negotiable regardless of permission:** it never pre-fills a decision without review, the overall comment is always the tutor's own writing, nothing generated reaches a candidate unreviewed, and it is never a second marker.

**Chat retention is a centre setting**

Midnight clearing is the default and the promise made on the bar, but it can be turned off or extended per centre. Three positions, and the centre picks:

- **Clear at midnight** (default) — nothing survives, the bar says so, and the promise is kept.
- **Retain for a set period** — 7 or 30 days, chosen by the centre. The bar's wording changes to match; never state a promise the setting does not keep.
- **Retain for the course** — cleared at close-out with everything else.

There is no technical difficulty. The trade is real though: retention makes chat discoverable in a complaint or an appeal, which cuts both ways — it protects a tutor accused of something they did not say, and it exposes an off-hand remark made at 11pm. A centre choosing retention should be told that plainly at the point of choosing.

Whatever the setting, the countdown and the wording on the bar must reflect it exactly. The one unacceptable outcome is a bar promising a midnight clear on a centre that retains.

**Appian is outside the app, and grades go in twice by two different people**

The centre receives a **course number** from Cambridge. Then:

1. The **MCT enters the provisional grades in Appian**, then sends the course number to the assessor.
2. The assessor now has the provisionals, and comes to the **grade meeting** with them.
3. The provisionals are discussed at the meeting.
4. The centre sends the **final report to the assessor**.
5. The **assessor enters the final grades in Appian** — not the centre.

So Connect never writes to Appian. It holds the course number, records that each step happened and when, and links out. Two consequences:

- The **provisional grades must be exportable in the order Appian wants them**, so the MCT is copying from a list rather than hunting through portfolios. This is the one place a small formatting decision saves real time.
- **The final report is the handover artefact.** After the grade meeting it goes to the assessor, and the assessor does the rest. The app's job ends with producing it.

Record `courses.appian_course_number`, and timestamps for provisionals-entered, number-sent-to-assessor, grade-meeting-held, final-report-sent. Those five facts are what a centre needs to answer "where are we".

**Trainers-in-training — Admin Handbook 3.7.4 and 3.7.5**

A person learning to become a CELTA tutor, working on a live course under supervision. Not a fifth candidate role and not a tutor role — a distinct status with its own rules.

- **Verification comes first, always.** A trainer-in-training **must be formally verified by Cambridge before training takes place**; training undertaken without prior verification **will not be acknowledged**. The app must therefore hold a verification date and **refuse to assign the role without one**, with the reason stated. This is the single most expensive thing to get wrong — a course's worth of training discarded.
- Their **name goes on the course entry form**, alongside the verified tutors. Add them to the entry-form record, marked as trainer-in-training.
- **They do not count toward the two-verified-tutor minimum.** A course still needs two verified tutors normally involved in all aspects — input, TP, feedback, tutorials and marking. A trainer-in-training is additional to that, never a substitute, and the app should say so if a course is staffed with one verified tutor plus a TinT.
- **Mode-shadowing rules.** They may train on any course type, but:
  - trained **online only** → must shadow **at least one TP group** (two weeks of TP and associated activities at one level) on a **face-to-face** course before tutoring face-to-face;
  - trained **face-to-face only** → must shadow at least one TP group of an **online** course before tutoring online or mixed-mode;
  - trained on a **mixed-mode course covering both modes in equal measure** (TP, input and feedback in both) → eligible for both.
  So the app tracks **which modes they have trained in**, and warns when a course would put them outside what they are eligible for.
- **The assessor visit needs an extra day booked** to assess the trainer-in-training, where the centre is on the **external** scheme. Surface this when scheduling the visit — it is a real cost and easily forgotten.
- Two schemes exist: **internal** (centres approved to manage training themselves) and **external**. The requirements differ; the **CELTA Trainer-in-Training Handbook** on the Cambridge Support Site is the source, and the centre uploads it like its other policy documents.

**Resolved:**
1. **Whose name goes on a trainer-in-training's work?** A supervisor countersigns, usually but not always the MCT — a named person on the record, defaulting to MCT but changeable per course. Every piece of work a TinT produces carries both names, on the same pattern as double-marked assignments.
2. **Does their marking count toward the double-marking sample?** No — the supervisor's countersignature is the first mark. A TinT's mark never counts as one of the two independent marks in the sample.
3. **Do candidates know they're being observed by a trainer-in-training?** Yes — they're told there is a trainer in training on the course. No further disclosure or consent process needed beyond that.

**Related, from the same section:**
- Tutors must work on a course **at least every two years** to keep verified status; lapsed status requires retraining and standardisation. Worth a quiet flag on a tutor record approaching two years since their last course.
- Roles logged in Appian: **Main Course Tutor** and **Assistant Course Tutor** — which matches the four-role list already in the spec.
- **Freelance tutors**: check verification before employing, request references from two previous centres, include liaison time in the terms. They must respond quickly after the course, **particularly on candidate appeals** — so a freelance tutor's access cannot be cut at close-out while an appeal window is open.
- Centres **send freelance tutors the assessor's recommendations**, but **must not copy them the report** — they may see it at the centre. That is a real permission rule: report visible on site, not exportable to a freelancer.

**Application and selection — Admin Handbook 7.2 and 7.3**

Applicants are **first-class records, not uploaded documents.** The file exists from first contact; an accepted applicant becomes a candidate with nothing retyped. See `Applications.dc.html`.

- **Entry requirements (7.3), all four required.** At least 18 — Cambridge recommends 20 or over, 18–20 at the centre's discretion. An awareness of language and competence in written and spoken English sufficient to undertake the course and prepare to teach a range of levels — recommended level C2 or C1+. A standard of education equivalent to that required for entry into higher education; where formal qualifications are absent, the centre may accept at its discretion if screening is convincing, and the evidence must be recorded. CELTA is for applicants with little or no ELT experience; some experience with little formal training may be considered.
- **Selection process (7.2).** Selection is conducted by **verified course tutors** or a nominated person at the centre. **All applicants must be interviewed** — online or face to face, in surroundings where privacy can be assured. **All applicants must submit written tasks before being accepted**, and those tasks must include **language awareness tasks and an extended writing task**. For courses with an online TP element, the interview should be conducted online on the centre's teaching platform, and the process must assess **digital literacy**.
- **The extended writing task offers a choice of prompt.** The centre defines three or four — one narrative, one descriptive, one argumentative — and the applicant picks one. Three or four, not ten: enough that nobody is stuck with a prompt they have nothing to say about, few enough that a tutor knows them by heart. **The marking criteria do not change with the prompt** (organisation, accuracy, range, holding a position for 400 words), which is what keeps the writing comparable and a rejection defensible under 7.2. Record which prompt they chose — the choice is itself a small piece of evidence.
- Prompts, like interview questions and assignment criteria, are **centre settings imported at setup**, with defaults supplied. Different centres select for different things.
- **Equality of opportunity** is the centre's responsibility, and questions about physical and mental health must follow local legislation. The app must not force a health question; it offers a single optional "anything we should know" field and leaves the wording to the centre.
- **Candidates must be told**, and it should be recorded that they were: completing the course does not guarantee success; there are **no exemptions or recognition of prior learning**; and on mixed-mode courses, the additional demand of changing TP mode.
- **Applicants who cannot attend significant parts of the course must not be accepted** (6.5). Ask at application, not at enrolment.
- **Special requirements (7.4)** are declared at application, so arrangements exist on day one rather than being improvised in week two.
- **Six replies, and nobody is left without one.** All are centre-branded, sent from the centre, with the Connect mark absent.
  - **Offer** — names what was strong and what will need work, states the fee, and carries one link that confirms the place, takes the candidate agreement, sets up the workspace and delivers the pre-course task. Accepting is what creates the account. Include an accept-by date and say what happens after it.

  - **Rejection before interview** — the applicant is not taken to interview on the strength of the task alone. The harder of the two to write, because nobody has met them: it must name the specific gap, since a bare "not suitable" from someone who never spoke to them is the version people repeat to others. Says it is not final and what would change it.
  - **Rejection after interview** — written by the tutor who interviewed them, and names what happened in the room. They gave up an afternoon and met a person; the letter should read as though it was written by that person.
  - Both require a **human-written reason** before they can be sent, and neither is ever generated.
  - **Not this time, no place available** — sends **automatically** when the waiting-list deadline passes with no place freed. Nothing about the applicant is being judged, so no human sentence is required; it apologises, explains that the course filled, and carries them to the next intake unless they opt out. Silence at this point is the worst outcome and it is exactly what happens when it is left to a person to remember.
  - **A place has come free** — triggered by a withdrawal, deferral, unaccepted or expired offer. The app names who is next and drafts it. **A named day and hour, not a number of days**, because the course is close and there is usually more than one person waiting; the email says so plainly and the button carries the countdown. **On expiry the app moves to the next person on the list and drafts the same email**, so the list keeps working without anyone remembering to work it. Declining costs them nothing — they carry to the next intake with task and interview still on file.
  - **The distinction that matters:** an apology for a full course is automatic; a rejection on the merits never is. The app must refuse to send a merit rejection without a human-written reason.
  - **Waiting list** — position, the course, and **a date by which they will hear either way**. Without that date it is just an unanswered application. Their task and interview stay on file so they never repeat them, and the application rolls into the next intake automatically unless they opt out. When a place frees, the app notifies the centre and shows who is next; the list is worked in order.
- **Rejections require a written reason.** The applicant may ask, and the assessor may look. The reason goes into the letter the applicant receives.

**Payment is outside the app, deliberately.** Nothing in Connect takes money. The offer email **states the fee and directs the applicant to the centre** — phone number and a reply-to — for payment options, instalments and deposits. A tutor or administrator ticks **fee paid** on the applicant record when it lands, with a free-text note for reference numbers or instalment arrangements.

Everything else in these emails is fed from records that already exist: course name, dates, number and mode from the **course record**; places remaining from the **cap minus accepted offers**; the fee amount and currency from a **field on the course**; the applicant's name, spelled their way, from their **own application form** (never retyped between there and the certificate); what was strong and what needs work from the **five marking rows and the tutor's notes**; the pre-course task and reading list from the **Resource hub**.

Reconsider a payment integration only when a second centre asks. It brings refunds, partial payments, deposits, currency handling and reconciliation with it — a large piece of work for a problem most small centres solve with a bank transfer.

- **The application page is public and centre-branded.** The centre links to it from their own website. It carries the **centre's logo and name prominently, with the Connect mark small in the footer** — the one public surface where both appear, because an applicant benefits from knowing what system they are entering. Serve it from a **per-centre subdomain** (`iti.celtaconnect.com/apply`) so the address reads as the centre's page; build the routing for this early rather than retrofitting it.
- **The intake dropdown shows real availability, and only when it is low.** Each open course lists as "places available", or "3 places left" when the remaining count is at or below the centre's threshold (default 4), or "full — waiting list". The number is always the true one and disappears once it rises again. **No manufactured scarcity**: no "filling fast", no countdown, no invented figure. Scarcity that is not a fact stops being information and becomes a technique, and a centre director spots it. Full courses stay selectable as a waiting-list application, since a withdrawal or deferral can free a place two weeks out.
- **Links are unlimited and filtered.** One permanent link per centre is the default, and the form asks which intake. A centre may generate as many as it wants — per course, per campus, per advertising source — each carrying its own filter. Per-source links also tell a centre where its applicants actually come from.
- **The centre's real briefs are already structured, and the structure should be kept.** Reading FOL and SRT closely (10–11 tables each) shows they are not prose documents at all:
  - **Per-section submission boxes.** Every part carries its own "First submission" box and "Resubmission (yes/no)" box, so a resubmission is already section-scoped in the paper version. The app's round model matches this exactly — build fields per section, not per assignment.
  - **"Preparing" and "Writing" are separated** in every section: what to do before writing, then what to actually write. Keep that split — it is why candidates arrive with the right material.
  - **Instructions are already bulleted.** The prose-only instruction in the boilerplate contradicts the briefs' own layout. Bullets are correct for SRT's and FOL's instruction sections and for LRT's analysis fields.
  - **FOL and SRT are effectively tables.** FOL wants two mistakes per problem with student name, spoken or written, lesson stage, and the correct version — that is a table, not a paragraph. Its pronunciation section wants **IPA transcription of both the wrong and correct forms**. Build these as small structured tables with named columns.
  - **SRT supplies a fixed group profile** (B1, 10 mixed-nationality students, mid-20s, career and IELTS motivations, keen to communicate, find grammar tedious, spoken accuracy needs work) and three texts in an appendix. The profile is centre content and should be a template field, editable per course.
  - **"DO NOT attach multiple tasks"** — one task only, because tutors cannot pick the preferred one for the candidate. Enforce it: one attachment per task slot.

- **The briefs carry hidden required words as a malpractice tripwire — keep this.** Each section quietly instructs the candidate to use a specific unrelated word in their answer ("use the word 'Easter' in your answer", then 'Christmas', then 'wedding', varying by section and by assignment). A candidate who generates or copies a section will not include the word, because the instruction is in the brief rather than in the text being copied. It costs nothing, it is invisible to anyone who has not read the brief, and it catches exactly the case the scanner cannot: text generated fresh, matching nothing.
  For the app: store the required word **per section, per course**, rotate it each course alongside the item sets, and check for it automatically on submission. A missing word is **not** an accusation — it surfaces as a finding for the tutor in the same list as a scanner match ("section 2 does not contain the required word"), because a candidate can simply have missed the instruction. Never show the requirement or the check to the candidate beyond the brief itself, and never auto-fail on it.

- **Language analysis is written under sub-headings, in bullets — not continuous prose.** Each LRT item gets three labelled fields: **Meaning**, **Form**, **Pronunciation** (**Register** in place of pronunciation for the functional exponent), each taking short bullets rather than a paragraph. Three reasons: it is how language analysis is conventionally set out, so it is what a candidate will do in a real lesson plan; a candidate cannot quietly skip pronunciation by burying it mid-paragraph, because the field sits there empty; and the key's per-part thresholds line up field by field, which makes both the tutor's marking and the reading's observations specific to a sub-part rather than to the whole item.
  **Drop "the assignment should be written in continuous prose" for LRT only.** It is right for the other three and wrong here.
  Empty sub-fields are shown as empty rather than hidden — an unwritten Pronunciation heading is itself the finding.
- **AI may read an assignment against the key, the same way it reads the selection task.** Same shape, same limits, same rules — this is not a second mechanism.
  - It reads the submission **against the centre's own key and criteria**, never against a general notion of quality. The key already states what is enough for Met, so the reading has a real reference rather than an opinion.
  - **The marking sequence.** Submitted → the reading runs → the tutor opens the assignment and reads it themselves, with the reading's marks already in the margins → they accept, edit or delete each one → they write the overall comment. The reading precedes the tutor and never replaces them.
  - **Ticks where something is simply right**, with no comment attached. A criterion met with nothing to say gets a tick and the tutor moves on; most of a good assignment should be silent.
  - **Comments on strengths, not only faults.** "This is the level of detail the criterion asks for" on the paragraph that got it right is worth more to a candidate than three corrections — and marking energy usually runs out before the praise gets written, so this is where it genuinely helps.
  - **Margin notes look unfinished until touched** — a tint or marker that clears the moment a tutor edits — so nobody sends generated text believing they wrote it.
  - **The overall comment is always the tutor's.** The reading never drafts it. It is the part the candidate reads first and remembers, and the one place a person has to say something to another person.
  - It produces **per-criterion observations that cite the text** — "criterion 1: the Vocabulary 2 field analyses the present perfect, not the item set"; "stress is marked on three of four items". Never a mark, never Met/Not met, never a percentage.
  - **It may suggest a rating, and a tutor may accept it in one click** — the same pattern `computeCriteriaSuggestion` already uses for Stage 2 ratings ("a starting point for the trainer's Stage 2 rating, never a final answer — always shown as editable"). Three conditions make that safe:
    - **Accepting is recorded as accepting.** Every rating stores whether it was the tutor's own or a suggestion taken unedited, and the second marker and the assessor can see which. Not to police anyone — it makes rubber-stamping a visible fact rather than an invisible suspicion, and a tutor who accepts twelve suggestions in four minutes should be legible.
    - **The overall comment must still be written.** A criterion can be accepted with a click; an assignment cannot be returned with no words in it.
    - **A Not met outcome always requires a written reason**, whoever proposed it, because the candidate reads it and may appeal on it.
  - It is **visible to tutors only**, labelled as a suggestion, visually distinct from anything a person wrote, and **never shown to the candidate** or included in the assessor pack.
  - It is **most useful on the mechanical criteria** and should be scoped there: word count against the range, whether a named reference appears in the body, whether stress is marked, whether all four items were actually analysed, whether the AI declaration matches citations present in the text. Those are checkable. Whether an analysis is *correct* is a tutor's judgement and the reading should say less, not more, about it.
  - **Double-marking is unaffected.** Cambridge requires a minimum of two tutors involved in assessing written work; a machine reading is not a marker and cannot count as either.
  - Record that a suggestion was generated and what it said, for the same reason as at selection: an unexamined model quietly shaping assessment outcomes is the risk, and an audit trail is what makes it examinable.

- **Answer keys state how much is enough, not only what is correct.** A key that lists every correct point silently becomes a checklist, and a tutor starts marking against completeness rather than against the criterion. Every key entry carries an explicit **"Enough for Met"** line — "meaning and form, plus either stress or the weak form, not both" — because a Pass does not require perfection. A candidate can omit things, and can be wrong about things, and still meet the criterion.
  The test to encode in the guidance: **would the analysis mislead a learner?** A wrong transcription of one vowel is a comment on the work. Analysing the wrong item, or stating a rule that is not true, is Not met.
  Keys are **staff-only**, in the hub's staff section beside the TP points library, and **rewritten each course with the item set** — an old key invites a tutor to mark this year's item against last year's answer.
- **Marking scheme for the selection task.** Five rows, each **Above / At standard / Below**, with a required note on any Below: **language awareness** (the analysis and correction items), then four on the writing — **accuracy**, **organisation**, **range**, **substance**. Deliberately the same shape as the Standard of English criterion on the assignment cover sheets, so a weak writer is visible at selection rather than in week two. The criteria do not change with the chosen prompt. The scheme is a centre setting imported at setup.

**Selection lives outside the course, and outside course roles.**

Applications exist before a course starts and are handled by people who may never be on it — a registrar, an office manager, a director. Two consequences for the permission model:

- **A staff role that is centre-level, not course-level.** Not "course admin". Someone who can see and act on the pipeline for every course at the centre, without being a tutor on any of them, and without access to candidate assessment. Selection itself must still be *conducted* by a verified course tutor or a nominated person (7.2), so the role distinguishes **handling** an application (booking, chasing, correspondence) from **deciding** on one (interview, marking, accept/reject), and only verified tutors or nominees can do the second.
- **Late applications after the course has started** must still work. The pipeline is attached to the centre and filtered by intake, never gated on the course being in a pre-start state.
- Such a person may be given a **tokenised link** to the pipeline rather than a full account, on the same pattern as the assessor: read plus the specific actions they need, expiring, revocable.

**Notifications on the pipeline.** Selection is the one place in the app where a delay costs a place. Notify the centre when:
- an application is **submitted** — with the applicant's name, which intake they chose, and a one-line read of the writing task if one has been generated;
- a **task is returned**, since that is the moment an interview can be booked;
- an **interview record is completed**, prompting a decision;
- an application has been **sitting without a decision** for the centre's own threshold — default five working days. This is the one that matters: applicants who wait go elsewhere.

Notifications carry the applicant's name and stage, never a suggested verdict — a nudge must not become a recommendation. Delivered in-app and by email, per person, with per-type opt-out.

- **AI reads the written task; a person decides.** The app may generate a reading of the extended writing task and the language awareness answers **against the centre's own marking scheme** — never against a general notion of quality. Rules, non-negotiable:
  - It produces **observations and a where-to-look**, never a score, a ranking, or an accept/reject. The strongest wording it may use is "worth interviewing" or "worth a careful interview".
  - Each observation cites what it is reading — "both phonology items blank", "one comma splice in 400 words" — so a tutor can check it in seconds rather than trusting it.
  - It is **always labelled as a suggestion**, visually distinct from anything a person wrote, and it is **never shown to the applicant** or included in the assessor pack.
  - A tutor's decision is recorded independently. If the app ever lets a tutor accept a suggestion with one click, it has become the decision-maker — so it must not.
  - **Rejections still require a human-written reason.** A generated sentence is not a reason, and an applicant challenging a rejection is entitled to a person's judgement.
  - Because the process must demonstrate equality of opportunity (7.2), record that a suggestion was generated and what it said. An unexamined model quietly filtering applicants is precisely the risk here.
- **Rejected applicants' files are retained** for the course they applied to, appear in the assessor pack, and are deleted with everything else at close-out.

**Pre-course task — Cambridge's, plus a centre supplement**

- The centre's uploaded task is Cambridge's **Pre-Course Task, © UCLES 2018** — five sections mapped to the five CELTA units, ungraded, handed in on day one. It is the most recent official version in circulation (the other is © UCLES 2004). Serve it as-is; never rewrite it.
- **It predates the current syllabus.** The syllabus is the **July 2021 edition**, and the 2018 task says nothing about **teaching in virtual classrooms** or **the use of L1** — both of which candidates now meet on the course.
- So the gap is **online teaching** — a centre running mixed-mode courses sends candidates a pre-course task that says nothing about the mode half their teaching practice will be in.
- **Build a centre supplement, not a replacement.** Six to eight short tasks in the same shape as Cambridge's, sitting after theirs as a clearly-marked section: **teaching online, and the use of L1**. Nothing on young learners — CELTA is teaching English to adults. Centre-authored, so it duplicates with the course shell and a centre can edit it. Other centres already do this — the British Council's pre-interview task carries its own pronunciation section alongside the Cambridge material.
- Cambridge's task and the centre supplement are **visually distinct** in the candidate's workspace, and the supplement never claims to be Cambridge's.

**Grade query — the reply before an appeal**

A candidate unhappy with their grade emails asking why. Handbook 16 covers the formal Internal Complaints Procedure and then Cambridge appeal stages, but almost every case starts as an informal email, and answering it well ends most of them there.

Build a **grade explanation** the tutor generates and edits, drawn entirely from the record:

- The grade awarded, and what the descriptors for that grade and the one above actually say (Appendix 2 wording, already in `GRADE_DESCRIPTORS`).
- **Teaching practice**: lessons taught, hours assessed, and the outcome of each — the pattern is usually the answer, since Pass B and Pass A require sustained performance rather than good lessons.
- **Criteria met**, out of the total, and specifically which of the higher-grade criteria were not met.
- **Assignments**: outcomes and how many needed a resubmission.
- **Tutorials and any letters issued**, with dates — evidence they were told at the time rather than surprised at the end.
- The written justification, if the provisional carried a slash.

Then the honest sentences a tutor writes themselves: what would have made the difference, and what happens next if they are still unsatisfied — the centre's Internal Complaints Procedure, then Cambridge Appeal Stage One.

Rules: it is **generated but never sent automatically**; the tutor edits and signs it. It quotes the record rather than re-arguing the grade — a candidate is entitled to see the evidence, not to a second assessment. It is **filed with the course** and appears in the assessor pack. And it is never a defence: if reading it back shows the grade was wrong, the centre says so and corrects it.

**AI and plagiarism — the actual rules**

Cambridge's own guidance (*Advice on the use of generative AI in assessed work*, May 2024) is specific, and its disclaimer is already written. Use its wording, not a paraphrase. Note it is explicitly "subject to constant review and may be amended, re-written or revoked" — so hold it as an uploaded centre document rather than hardcoded text.

**Permitted, per the disclaimer candidates sign:**
- generating ideas for teaching practice, including texts and activities
- initial research for written assignments, including generating a bibliography
- proofreading work

**Treated as malpractice, and results in failing the work:**
- generating a lesson plan, a language analysis, or a written assignment using AI
- using AI for any purpose beyond those permitted
- **failing to acknowledge AI use, regardless of scope or purpose** — this one stands alone: unattributed use is malpractice even where the use itself would have been allowed

**Referencing.** All AI use must be referenced in a recognised style used consistently; **APA is recommended**. Both an in-text citation and a reference-list entry are required. The in-text citation must state the prompt or prompts, put the AI-aided text in quotes so it is identifiable, and name the tool with the date. The reference entry is author, date, title (model name, italicised, with "[Large language model]"), and a URL linking as directly as possible to the conversation.

**Plagiarism — Admin Handbook 9.2.3 and 9.2.4.** Candidates must **confirm in writing** that assignments are their own work; this does not exclude joint preparation and discussion, but they must not collaborate to the extent of submitting substantially similar assignments. Centres must provide guidance on what plagiarism is and how to avoid it, hold an internal policy stating the penalties, deal with detected plagiarism under their malpractice policy, and **must not knowingly submit plagiarised work to Cambridge for moderation**. Candidates must be told that awarding bodies apply severe penalties for plagiarism in externally moderated work — **from loss of marks to disqualification and a ban on re-entry for up to three years**.

**What this means for the submission form.** Two things are required before an assignment will send, and the app blocks on both: the **own-work declaration**, and the **AI declaration** — either "not used" or a conversation link plus the citations. **Word the question to name proofreaders explicitly**: "Did you use any AI tool, including a proofreader such as Grammarly?" Cambridge permits proofreading and requires only that it be referenced; naming the tool is the centre's own addition to its brief and worth keeping, because many candidates do not think of a spellchecker as AI, and the offence Cambridge penalises is unacknowledged use rather than use. Grammarly is a browser extension and works in any text field, so it cannot be blocked and should not be — the declaration is the control. The permitted and prohibited lists are shown at the point of declaring, not only at enrolment, because that is when a candidate is deciding.

**The unproofread-original requirement is dropped.** The current brief asks for it when AI-assisted proofreading was used, but nobody can prove a draft is the original, so it collects a file that means nothing while adding a step to every submission. The declaration and the conversation link carry the weight instead — and Cambridge's own guidance requires referencing, not evidence of drafting.

**Do not block paste, and do not try to disable proofreaders.**

Both are possible and both are wrong here.

- Grammarly honours `data-gramm="false"`, but it is an extension the candidate controls — they can re-enable it, use another tool, or draft elsewhere. It is a request, not a control.
- Blocking paste is easy to implement and trivial to defeat: drag-and-drop, another browser, a phone beside the screen. It punishes the honest candidate writing 1,000 words in a second language who drafted in Word when the connection dropped, or who wants to paste a quotation typed carefully with the phonemic symbols correct.
- Most fundamentally it treats coursework as an exam. Assignments are prepared over days, with research and proofreading both permitted. The barrier stops nobody determined and irritates everyone else.

**Record that a large paste happened, but never treat it as evidence.** The distinction matters. Drafting in Google Docs over three evenings is legitimate and is what a careful person does, and it pastes identically to pasting a classmate's paragraph — so the fact proves nothing on its own.

What it is useful for is **context beside a finding that already exists**. If the scanner matches 94 words in section 3, knowing that section 3 arrived as a single paste is worth something to the tutor reading both. On its own, with no match, it means nothing and must not be surfaced at all.

So: log it, show it **only alongside a scanner finding on the same section**, phrase it as a fact rather than a flag ("section 3 was pasted in one insertion, 22 Nov 23:58"), never count it toward anything, never open a case from it, and never let it appear on a submission that has no other finding. If a tutor asks why a clean assignment shows nothing, the answer is that there is nothing to show.

What actually works is text compared against text — the scanner — and a tutor asking the candidate about their own writing.

**Assignment 5 — the plagiarism assignment (a centre sanction, not a Cambridge assignment)**

Set when an upheld plagiarism case results in a failed assignment. The candidate resubmits the original with one chance, and additionally writes this. Due by the end of the course.

**The design problem to avoid.** A research essay on "what plagiarism is" can itself be plagiarised — it is generic, widely written about, and the candidate writing it has already demonstrated a willingness. It also teaches nothing: a week later they can define plagiarism and still not see what they did wrong.

**Make it about their own case, not about plagiarism in general.** Four short sections, 750–1,000 words:
1. **What happened** — in their own words, what they submitted and how it came about. Not an apology; an account.
2. **Which rule it breached** — quoting the centre's policy and the Cambridge guidance they accepted at account setup, and saying which clause and why. This is where the reading happens, and it is reading of documents they already signed.
3. **Why it matters here** — what it would mean for a learner, a colleague, or a centre if a teacher's materials or claims were not their own. Ties it to the profession rather than to school rules.
4. **What they will do differently** — specific: how they will note sources while reading, how they will use AI and declare it, what they will do at 1am with a deadline in seven hours.

Sections 1 and 4 cannot be copied from anywhere, and section 2 requires quoting documents specific to this centre. The scanner still runs on it.

**Rules:**
- It is **not numbered as a Cambridge assignment** in the candidate's workspace or on any Cambridge-facing document. Label it plainly — "Plagiarism reflection" — and keep it visually distinct from the four.
- It **does not count toward the 3-of-4 rule** and cannot raise or lower the certificate grade. It is a condition of the centre, not of the qualification.
- **One chance, pass or fail**, as with the resubmission it accompanies.
- It **belongs to the malpractice case**, appearing on the case timeline and in the case record, not in the assignment run.
- Marked by the tutor who handled the case, not necessarily the assignment marker.
- **Close-out cannot complete while it is outstanding** — same rule as an open appeal.
- It goes in the portfolio and the assessor pack **with the case**, because an assessor asking how the centre handled plagiarism should see both the decision and what followed.

**Plagiarism scanner — built in, with room for a third party**

Runs automatically on submission, visible to tutors only, never to the candidate. See `Malpractice.dc.html` frame 1a.

- **Compares against what the centre already holds**: other submissions on the same course, the centre's archive of previous cohorts, the assignment brief, and any model answers. **Not the open web** — a general web check is a different product with a licence attached.
- **Never produces a similarity percentage.** A number invites a threshold, a threshold becomes a rule, and a percentage has decided cases it should not have. Show the matched passage, what it matched, and its length; a person reads both.
- A flag is **not a case** and creates no record against the candidate until a tutor opens one.

**It must exclude the brief itself, or every submission matches every other.** A candidate's document contains the assignment's own headings, its prompts, the criteria, quoted source sentences the brief supplied, and any tables it asked them to fill in. Every candidate has that text, so a naive scan flags all eight submissions against each other and is instantly useless.

Handle it structurally rather than by tuning a threshold:

- **The brief is a known document.** It was imported at setup, so the app already holds its exact text and can subtract every passage that came from it — headings, prompts, criteria wording, supplied examples.
- **Sections are already separate fields.** Candidates write into the structured sections defined by the template, so the app compares **only the text they typed**, never the scaffolding around it. This is the strongest reason to keep assignments app-native rather than uploaded documents.
- **Quotations they attributed are excluded** where the referencing convention makes them identifiable, and shown as attributed rather than flagged.
- **Two candidates analysing the same coursebook item will share phrasing** — the target sentence, the grammatical terminology, the phonemic transcription. Short matches inside a language-analysis field are expected; the scanner should weight **continuous prose** far more heavily than analysis fields, and say which kind of field a match sits in.

The Emre/Sara example in the design is exactly this test: 94 continuous words in a prose section, differing in register from the writing around them, and both citing the same page. Length, field type and register are what make it worth a look — not similarity in the abstract.

**Notifications on findings — a nudge, never an alarm.**

No email, no badge on a roster row, no red dot on a candidate. Two nudges only:

1. **A line on the marking tutor's Today screen** — "2 assignments have scanner findings" — visible to that tutor only, with **no candidate names**. It is a reason to open the marking queue, not a judgement. Clicking it goes to the queue, where the findings sit on the assignments themselves.
2. **At close-out**, any finding never opened surfaces as a blocker-level note: "3 findings on this course were never reviewed." An unread finding is the real failure mode — not a missed case, but nobody having looked.

What must never happen: a push or email naming a candidate ("Possible plagiarism — Emre Doğan"). That arrives on a phone at 11pm and creates a verdict before anyone has read the passage, and most findings turn out to be a shared textbook definition. Badges on rosters are also out — a marker on a row is visible to anyone walking past a screen, including candidates.

**Where a finding surfaces.** Not on a scanner page — nobody visits one. It appears **on the assignment, when a tutor opens it to mark**: a quiet band above the first section naming the match, its length and its source, with the passage highlighted inline and a side-by-side view one click away. The scanner screen remains as a per-assignment overview for the main course tutor, not as the place findings are discovered. **Nothing appears on the roster, the pipeline, or anywhere the candidate can see.**

**Cross-course matches** are the reason the centre archive is worth having: a candidate copying from a cohort two years ago is invisible to a tutor who was not there. The finding names **the course and the date, not the previous candidate**, unless the tutor opens it — old cohorts are other people's data, and most of these turn out to be a shared textbook definition. Cross-course scanning must survive close-out deletion, which means the archive keeps a **text fingerprint of past submissions, not the submissions themselves**; state that in the candidate agreement.

**Designed to accept an external checker later.** Build the scan as a **provider interface**, not as one hard-coded routine: a submission goes in, and a list of findings comes back — each with a matched passage, a source, a length, and a confidence the app does not display as a number. The built-in centre-archive check is simply the first provider.

That way a centre wanting Copyscape, Turnitin, Copyleaks, or an AI-text checker can have it added as a second provider whose findings appear in the same table alongside the internal ones, labelled with which provider found them. Nothing downstream changes: the case flow, the timeline and the assessor pack are already provider-agnostic.

Three things to hold to when a third party is added: the **licence and cost belong to the centre**, not to Connect; a candidate's work being **sent to an external service must be disclosed** in the candidate agreement before it happens, since they accepted terms that did not mention it; and an external tool's **score is never shown or stored as a verdict** — the same rule that applies to the built-in scanner.

**Appeals — Admin Handbook 16**

Three steps, and the app's job differs at each.

**16.1 · At the centre, before anything formal.** The handbook is specific about what a tutor should do when a candidate is unhappy with the recommended grade: *"A tutor should go through the coursework with the candidate, showing the evidence on which the grading decision was based… refer to overall grade descriptors, to specific assessment criteria and to evidence from teaching practice feedback and lesson plans in the candidate's portfolio."* That is exactly the grade explanation specified above — it is not a nicety, it is the procedure. Candidates must also be told that **all recommended grades remain provisional until confirmed by Cambridge** after Grade Review by a Joint Chief Assessor.

**16.2 · Appeal Stage One.** Available only after the candidate has been through **all stages of the centre's Internal Complaints Procedure** and remains dissatisfied, **and once the result is confirmed by Cambridge**. There is an administrative fee. **Cambridge must receive the appeal via the centre within two weeks of the candidate receiving their final result**, and the appeal must be made by the candidate, not a third party.

The process: the centre gives the candidate the **Cambridge Teaching Qualifications Stage One Appeal Form** (downloaded from the Cambridge Support Site — the app does not reproduce it). The candidate completes it and returns it to the centre. The centre **writes a response** to the issues raised, then sends the form and its response to `TeachingAwardAppeals@CambridgeEnglish.org` **within two weeks of receiving the completed form**, along with the candidate's **portfolio and application and selection notes**, sent electronically and securely by the same route as portfolios for moderation.

What Cambridge scrutinises, and therefore what the app must be able to produce as a bundle:
- the Stage One form, completed by the candidate
- the **candidate portfolio**
- the **application and selection notes** — which is why applicant records matter beyond selection
- the **assessor report**
- the **centre's response** to the appeal
- the centre's **terms and conditions for refunds, including a copy of the Candidate Agreement**

So the app should offer an **appeal bundle** action that assembles all of it — the same machinery as the assessor pack, different recipient. The two-week clocks are the thing to surface: both are short and both are the centre's responsibility to meet.

**16.3 · Appeal Stage Two** — independent review, on the candidate's own request, using Cambridge's Stage Two form. Nothing for the app to do beyond keeping the Stage One bundle retrievable.

Two consequences worth stating. **A candidate's file cannot be deleted at close-out while an appeal window is open or an appeal is running** — the two-week window runs from their receiving the final result, which is after close-out. And **application and selection notes are appeal evidence**, which settles why they are retained rather than discarded once a course begins.

**Two cases the design deliberately does not handle**

- **Cambridge confirming a grade different from the centre's recommendation.** Rare to the point of never in practice. Handle it as a **manual override on the certificate and the final record**, with the confirmed grade recorded alongside the recommended one and a note. Do not build a workflow for it.
- **A course changing mode mid-flight.** Mode is set per lesson on the timetable and normally decided in advance in course settings, so a planned change is an ordinary edit. An emergency change works the same way: change the lessons, and the mode-aware prompts follow. The consequences that need watching are already specified elsewhere — a Stage 3 borderline candidate's final two assessed lessons must be in the same mode, and observation hours still cap filmed at three of six. Nothing further is needed.

**Volunteer students**
- A volunteer belongs to a **class at a specific level** (Elementary, Upper-Intermediate, etc.), not merely to the course. Candidates must teach at a range of levels, so the class is what a TP is scheduled against.
- No account. A tokenised link, a consent gate, and their own class list, attendance, and handouts.

**Volunteer attendance and certificates — the hours model**
- **Certificates are earned by hours, never by levels or by courses.** Volunteers move between levels depending on what is running (A2 this course, B1 the next), which is not their doing. Cambridge puts one CEFR level at roughly **200 guided learning hours**, while one CELTA course gives a volunteer about **30**. A level is therefore the wrong unit and a course is too small; hours carry across both.
- Hours are **cumulative across courses and across levels**, held against the person, not the enrolment.
- **How a tick is earned.** A TP session is three 45-minute lessons (135 minutes). Presence is measured from **Zoom's join and leave timestamps, summed across rejoins** — dropping out and rejoining is not penalised, since connection loss is common and not the volunteer's fault. **Presence is enough: there is no camera rule for volunteers.** The camera-off-counts-as-absent rule applies to candidates only.
  - **90 minutes or more → present.** Credits the session **in full at 135 minutes (2¼ hours)**, whether they stayed 90 or 135. Deliberately generous: it removes any reason to watch the clock, and pro-rating the last 45 minutes is not worth the complexity.
  - **45 to 89 minutes → one lesson.** Recorded on the register as a distinct mark, but **credits no hours toward the certificate**. It exists because a tutor seeing someone who repeatedly arrives for one lesson has a different problem from someone who never comes, and the register should show the difference.
  - **Under 45 minutes → absent.**
  - Only **present** counts toward the 160-hour certificate. The partial is a register state, not a fraction of an hour — nothing part-credits.
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
- **Double-marking — Admin Handbook 9.2.3.** A minimum of two tutors must be involved in marking. **A proportion of each assignment must be double-marked**, by candidate count: up to 9 candidates → **3 of each assignment**; up to 16 → **4**; up to 24 → **5**. The sample **must include any fail assignments**. Double-marking means checking the first marker's grading and comments; both tutors **initial** the assignment. **Blind double-marking** (each tutor marks independently, then they discuss and agree) is recommended but not required — support both modes, blind as an option, not the default.
- **Who double-marks whom is the centre's choice** — commonly tutors who swap TP groups mark each other's candidates. Do not encode a pairing rule. The app assigns and tracks; the centre decides.
- The centre **must keep a record of which assignments were double-marked**, and assessors may ask to see it. Generate that record automatically and include it in the assessor pack.
- **Assignment deadlines anchor to TP rounds where the task depends on teaching, not to fixed days.** Focus on the Learner cannot be written before the candidate has taught the group four times — the brief asks for difficulties noticed across TP1–4 — so it **opens after TP4 completes** and is due a set number of days after that. Lessons from the Classroom must fall after the last observed lesson. Language Related Tasks and the Skills Related Task do not depend on having taught, so they can sit on fixed dates.
  The failure this prevents: a fixed "day 9" deadline on FOL becomes impossible if the rotation or the timetable shifts TP4 later, and the app would be asking for work the candidate cannot yet do. Same mechanism as scheduled announcements — anchor to the event, let the timetable supply the date.
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
- **Stage 3 tutorials — Admin Handbook 10.2, verbatim triggers.** Stage 3 progress checks must be completed **in the final third of the course** for all candidates who: were **not to standard at Stage 2**; were **at standard at Stage 2 but are not making the expected progress** in the second half; were **above standard at Stage 2 but are not making the expected progress** in the second half; or **have received indications of Pass B or Pass A but have not maintained their progress**. All four are derivable by the app from the Stage 2 record plus subsequent TP outcomes — flag them rather than relying on a tutor to notice. In every case a tutorial must be given **and the whole tutorial record completed**. A centre may additionally give Stage 3 tutorials to everyone (centre setting).
- **Stage 1** is carried out on all candidates; a tutorial at Stage 1 is optional. **Stage 2** is carried out on all candidates and **requires a one-to-one tutorial**, ordinarily at the halfway point — after 3 hours' TP, when candidates swap tutors/TP groups — but the trigger is **hours of assessed TP, not calendar position** (a nine-lesson course puts it at 2h40 or 3h20). Derive it from assessed hours. The **final progress record must be completed for all candidates**. Minimum one tutorial per candidate overall, recorded in the CELTA 5.
- **The order of letter, record and signature is not fixed.** A centre may issue the Fail letter first, release the Stage 3 record for the candidate to read in their own time, and hold the tutorial afterwards. The app must not impose a sequence on those three. The one thing it does enforce: **the tutorial must be held**, and if the candidate has not signed the record by the time it starts, they sign during it.
- **Fail letter — Admin Handbook 10.2.** Potential Fail candidates are issued a Fail letter making the possible Fail outcome clear and **drawing attention to the action points detailed by the tutors in the CELTA 5**. It must be issued **with at least two lessons left to teach**, so the candidate can respond. The app should therefore warn when a Fail-risk candidate has fewer than two TPs remaining and no letter issued. It is filed in **CELTA 5 Section A** and appears in the assessor pack.
- **Mixed-mode rule:** if a candidate receives a Stage 3 tutorial and is borderline Pass/Fail, their **final two assessed TP lessons must be in the same mode** (all online or all face-to-face). Enforce this when scheduling.
- Final grades are **subject to confirmation by Cambridge**. The app is never the authority.
- Withdrawn and Extension are real outcome values alongside Pass A / Pass B / Pass / Fail.

**Extensions — Admin Handbook 7.8, checked.** Two different things share the word.

**Nothing is resubmitted after the course closes.** Every assignment, and every resubmission, is submitted inside the course. LFC is deliberately last and gets the shortest window of the four — set around day 15, in on day 18, resubmitted on day 19 — which is why it must be the easiest and most structured of the four. An assignment that cannot fit its resubmission inside the course has been set too late; it is not deferred past the end date. The only exception is a Cambridge-approved extension (below).

*Assignment extension (common).* A new date on one assignment inside a running course. The handbook does not govern it; 6.3 asks the centre to state its own policy on deferrals and extensions in the candidate agreement. Centre decision, reason recorded on the file and visible in the assessor pack, never in the final report, never announced to the cohort. It moves the deadline only — the one-chance resubmission rule, word count, criteria and plagiarism check are all unchanged. **Warn when the new date squeezes the resubmission window**: a candidate granted four days near the end can silently lose the second chance they are entitled to.

*Course extension (rare).* Completing assessment after the official end-of-course date. Exceptional circumstances only, for a candidate who has completed a substantial part of the course or was granted additional time for special requirements (e.g. dyslexia). **All extensions must be agreed with Cambridge in advance.** Process: centre submits a deferral/extension form via Appian → Cambridge confirms → the grade is recorded as **Extension** on the Centre Grade Approval form → when the candidate finishes, the centre confirms the result with the assessor → both centre and assessor inform CELTA Admin of the agreed final grade. **Maximum one month after the course ends** — count it down in the app. An open extension **blocks close-out**, exactly as an open appeal does; the course cannot erase while someone is still submitting into it.

**Chat**
- Resets at local midnight, every channel, no exceptions. Never a record of assessment.
- Trainees never get a cohort-wide channel — only their TP group and DMs to their own tutors. Staff channels are trainer-only, no admin exception (migration 0039).

---

## 2. Build order

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


---

# Part A — The course

## 3. Timetable strip

- Every TP row is **read-only**, including the candidate's own. Aims, books and order are changed in the syllabus planning grid only.
- The **planning slot** is the one exception: a real timetabled 45 minutes, the only row that opens the grid in edit mode, and the only row carrying a lock countdown.
- The row's link changes destination with course state: grid (unplanned) → grid read-only (locked) → lesson feedback (taught).
- An unplanned TP still shows time, room and level with aims visibly empty. The timetable never waits for the grid.

## 4. Syllabus planning grid — flags

Two severities, visually distinct, neither blocking submission.

**Clash (red).** The class would meet the same thing twice on the same day:
- same material page claimed by two candidates;
- **overlapping exercises** on a shared page (Deniz ex. 1–3, Aylin ex. 3–5 → ex. 3 twice);
- **same aim / language point from different books** — the one people miss, because nothing about the page numbers looks alike. Compare aims, not just materials.

**Consider (gold).** Shape-of-day nudges, dismissible with no reason required:
- all lessons on one day being the same category (three language lessons in a row, then three skills the next day) — suggest alternating so learners are not given a whole morning of grammar;
- offered as a suggested swap between two candidates, never as an instruction.

Flags are advisory. The grid can be locked and submitted with unresolved flags; unresolved clashes are surfaced to the tutor at lock time.

## 5. The class error log

Candidates already sit through every classmate's lesson doing peer observation, and the learners are on the register. One tap turns a noticed error into evidence.

**Identity on online courses.** Three layers, cheapest first: (1) the sign-up confirmation tells learners to join with the name they registered with; (2) each learner gets a unique Zoom registration link so they arrive under their registered name regardless of device name, configured once per course; (3) whatever is left appears as **unmatched participants** — expect two or three per class, not one ("MacBook Pro", "ayse.k", "iPhone (2)"). The tutor maps them in one tap while admitting the waiting room, matched by participant ID and remembered for the rest of the course. **Logging is never blocked by this**: an error logged against an unmatched participant is held and attributed retroactively the moment the match is made.

**Capture (during peer observation).** Learner picked from the register — never typed. Stage and timestamp taken from the open lesson plan. Type is grammar / pronunciation / vocabulary. Free text is what the learner actually said or wrote.

**Logging is not feedback.** Nothing logged reaches the candidate who was teaching. It is about the learners, not the lesson. Mixing the two makes observers reluctant to log anything.

**The pool is collective.** All observers' entries are visible to the whole TP group, grouped into recurring problems. A problem with three or more examples from different learners clears the threshold the briefs ask for ("three examples of the same problem to ensure these are genuine areas for development rather than isolated mistakes"). Below three, it is flagged as thin.

**The divergence session.** A timetabled 45 minutes before FOL is written, all candidates plus a tutor. Each claims a focus and their learners. Claims are visible; two candidates may share a *problem* but not the same learner pair. Thin evidence is flagged at the moment of claiming, not in resubmission notes a fortnight later.

**One log, three assignments.** FOL (learner needs), LRT (analyse a language item that actually arose in the room), LFC (the candidate's own patterns across their eight lessons).

**Authenticity.** Every entry is timestamped and tied to a real lesson, stage and learner, so a tutor can click a quoted example and see where it came from.

**Deadline readiness.** The app knows when a class has enough logged evidence for FOL to be writable, and warns when a timetable puts the deadline before the evidence exists.

## 6. FOL evidence — the agreed plan

No interview, no placement test, no day-one needs analysis. Evidence is gathered in four places.

**1. At sign-up (once, ever).** The volunteer answers five or six written questions — how long they have studied English, where, why now, what they find hardest, what they enjoy in class; Turkish is fine. Then two or three minutes of speaking against prompts that get gradually harder. **Never called a test.** No result to the learner, no level produced, not even in a hidden field. Consent taken at sign-up: shared with the centre for training, used in candidate coursework, not shared further.

**2. Returning learners.** Background answers persist — they do not change. The **recording is refreshed each course and carries its date**; an eighteen-month-old sample describes someone who no longer exists. A returning learner records for thirty seconds and answers nothing.

**The learner is a centre-level record, not a course-level one.**

**3. Day one.** Getting-to-know-you teaching after the demo lesson: 10 minutes each, 15 for a small group, pitched at the level they will teach. Unassessed, and meant to be enjoyable. Not an interview and not a needs analysis — first contact, with evidence as a bonus.

**4. Days 2–9 and day 10.** The class error log during peer observation, then the divergence session.

**Criterion coverage (Cambridge 2.1):** (a) background / previous learning / preferences comes *only* from the sign-up questions — that is why they exist; (b) needs from the pooled log plus the recording; (c)–(f) from input sessions, the candidate's own choices and the resource hub.

**Open:** whether the getting-to-know-you activity is free-form (more fun, patchier evidence) or given three suggested prompts (duller, comparable). Currently free, because the sign-up questions already carry (a).

## 7. Assignments in parts

An assignment may be staged into parts (the centre's Assignment 1: learner profile, then tasks chosen for that learner).

- Each part has its **own due date** and its own submitted state. Deadline warnings run per part — a candidate who missed Part 1 is chased even though the assignment is not due.
- **Criteria are the unit of assessment, not parts.** An assignment has ONE criteria set and ONE verdict. To pass, every criterion must be met. Each criterion carries a part attribute (which submission supplies its evidence) — the part has no verdict of its own.
- **Marking opens when all criteria have evidence**, i.e. when the last part is in. A tutor may read an early part but does not mark criteria that have nothing to judge yet.
- **Resubmission addresses the unmet criteria**, wherever in the document they sit. Met criteria are closed and are not re-read. The candidate is told the criteria (e.g. "1d and 1e"), never "redo Part 2".
- **One resubmission per assignment** — not per part, not per criterion. Still unmet after it → the assignment fails. One failed assignment is survivable; two fail the course.
- Assignments are met / not met only. There is no above-standard grade.
- On resubmission marking, the tutor sees the original submission, the feedback given, and the new version together.
- One notification per outcome, naming which part and why — never one message per part.
- The **portfolio still lists four assignments**; a staged one is a single row with two documents and two part verdicts inside it. The final report and assessor pack show one assignment and its attempt count. Part verdicts are retained on file for assessor queries.

Because parts are only scheduling, a centre can stage an assignment, un-stage it, or move a criterion between parts without touching how it is marked or reported.

## 8. Late enrolment cut-off

**On a full-time course, no candidate may be admitted once day one has begun.** The reason is not the missed demo lesson, the TP procedures session, or being absent when groups form and materials are claimed — all survivable. It is that **120 contact hours is a minimum, not a target**: a candidate who misses one day of twenty is below it, and there is no mechanism to make it up.

"Late enrolment" therefore means *enrolled in the final days before the course*, never *joined after it started*. The late-enrolment welcome email exists for that case only.

Part-time courses are a separate question — an evening session can be caught up across a longer calendar — and are deferred.

## 9. Leaving the course — three statuses, not one

This is the area most likely to be built wrong. Three distinct things:

**Withdrawal** — formal and final. Requires a signed letter (the app generates it; see `Enrolment Forms.dc.html`). No reversal. A withdrawn candidate may still attend sessions unobserved and unassessed, so **withdrawn is a status, not a deletion**.
- Withdraw **before** `entry_form_sent_at`: Cambridge never sees them. Internal event only.
- Withdraw **after**: they appear in provisional and final grades with outcome **Withdrawn**.
- Their portfolio is **paused, not erased** — read-only, and it stays in the assessor pack marked Withdrawn, because assessors do ask to see withdrawn files.
- TP: the slot empties; nobody else moves.

**Deferral** — Admin Handbook 7.9 (June 2025 edition; the 2022 edition's ">50% completed" threshold cited here previously is gone, corrected 2026-08-27): allowed when **the candidate has completed part of the course**, in exceptional circumstances, at the centre's discretion, and **only once the centre has consulted Cambridge English**.
- Cambridge process: centre submits a deferral form via Appian → Cambridge confirms → the **original** course records the final grade as **Deferred** → the candidate's name is added to the **new** course's entry form marked deferred → the assessor is told in advance and given the previous assessor's comments → both centre and assessor confirm the final result at the end.
- Re-integration normally **no later than six months** after the original course ends (12 months part-time). Surface that deadline in the app.
- **The new course should be the same mode of delivery as the original** (face-to-face, online, mixed) unless the candidate agrees otherwise **in writing**. If the mode changes, the centre must provide **familiarisation activities**. The app should warn when a destination course is a different mode, capture the written agreement, and prompt for the familiarisation plan.
- **Everything freezes as it stands, complete or not.** Whatever the candidate had on the day they stopped is preserved exactly: TPs taught, assignments passed, an assignment mid-marking, a resubmission not yet returned, criteria met, self-evaluations, tutorial records. Nothing is discarded for being incomplete and nothing is re-judged. It travels to the destination course as their **portfolio** — the same place it lived on the original course — and it also exports to the centre's Drive at close-out of the original course, so there is a record either way.
- **How many hours carry is the centre's judgement, not a calculation.** 7.9 asks the centre to weigh how much was completed, how the candidate performed, and what the break will do to the outcome. Default the carried figure to the hours already assessed, let a tutor change it, and require a note when they do. The level of support offered should scale with the length of the gap.

**First-half withdrawal with a restart** — Admin Handbook 7.9, a separate case: a candidate forced to withdraw in the first half may, at the centre's discretion, **start a new course from the beginning without paying a new fee**, and *"can transfer any successful assessment to the new course."* Teaching starts again from TP1; passed assignments carry. This is not a deferral and must not reuse the deferral flow.

**Withdrawn vs Fail is decided by attendance and the CELTA 5 declaration, not by choice** (Admin Handbook 11.4):
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
- **Answered:** no. A Cambridge deferral means completing the whole second half of the new course, assessed hours included — not resuming from the exact TP count reached. Someone who left at 50% or at 60% both simply do the new course's second half in full.

**Extension** — for special consideration (illness, dyslexia, declared at enrolment). The candidate completes **after the official end date** and the final grade is recorded as **extension**. Close-out waits.

**Staff changes.** A tutor is deactivated, never deleted. Everything they wrote or signed keeps their name permanently — including if they die. Going forward, one name replaces another: the successor takes the group, the marking queue and the channels from that point. They may not mark an observation they did not watch.

---


---

# Part B — Centre administration

## 10. Admin roles

Four, and nobody chooses their own — the invitation carries it.

- **Centre administrator.** Creates courses, invites people, handles fees and payments, forms groups, publishes timetables, exports the assessor pack. No grading, no course chat, no access to feedback or CELTA 5 records.
- **Centre manager.** Read-only across the whole centre: every course, the pipeline, fees, outstanding balances, enrolment figures. **The edit buttons are absent, not disabled** — a read-only role that hides restrictions behind error messages is worse than none.
- **Course administrator.** Centre-admin powers scoped to a named list of courses. Cannot create a course or change centre settings. When they leave, courses are reassigned individually — deliberately a small chore, so someone notices what was theirs.
- **Centre owner.** Full access to everything **inside one centre and nothing outside it** — held by the centre director, for when an administrator leaves without handing over or a course is left with nobody attached. Can appoint and remove administrators and restore a deleted course within 30 days.

**There is no cross-centre role.** The owner is the top of the tree and the tree is one centre. Nobody at Connect holds a key to a centre's courses; support access happens only by a centre's invitation, for a period the centre sets, and is logged with who, when, what and why — readable by the centre.

**Course chat is absent from every admin role, including centre owner.** No exception, ever.

A centre admin who is also a registered tutor on a course gets that course's chat and grading *as a tutor, on that course*. The roles never merge into one set of powers.

## 11. Areas of responsibility

Separate from the four admin roles. A **role** says what someone is capable of; an **area** says what is actually their job. Areas are assigned to named individuals: admissions and enrolment, payments, volunteers, timetabling, assessor liaison, close-out.

- **Everyone sees everything.** Areas never hide information.
- **Only the area's owner can act in it.** Everyone else sees the same screen with the action **attributed rather than absent** — where the owner sees "Send offer", a colleague sees "Selin handles offers", her name linking to a message. Hiding a button tells you nothing; naming the person answers the question you actually have.
- **The centre owner can act in any area**, because someone must when the area owner is ill, and that is an ordinary Tuesday rather than an emergency.
- **Areas can be handed over temporarily, with an end date**, so holiday cover does not become a permanent reassignment nobody remembers to undo.
- **Nobody edits their own role or their own areas.** The centre owner assigns both. Self-promotion must be impossible, or the ceiling on any admin's powers is whatever they feel like today.
- Profile details — name, contact, notification preferences — are self-editable. The role and areas sit alongside as plain labels with no edit affordance.
- A role or area change **appears in the admin room as a line**. A colleague quietly losing edit rights should not be a mystery.

### Every action names who did it

Areas make this essential rather than merely tidy. If the centre owner acts inside someone else's area — sends an offer, waives a fee, changes a deadline — and it goes wrong, the area's owner must not carry it.

- **Every record carries the acting user and a timestamp**, shown in place: "Offer sent by Ramy Sakr · 14 Dec 09:12", not "Offer sent".
- **Acting outside your own area is marked as such** on the record: "Sent by Ramy Sakr, covering admissions". The distinction between the person responsible for an area and the person who acted on one occasion is visible without opening a log.
- **The area owner is notified** when someone acts in their area. Not a request for permission — a statement, so they are not told by a candidate.
- **A per-record history** shows every change with who and when, readable by any admin. Not an export, not a support request: a line in the interface.
- This is what makes "the centre owner can act in any area" safe. Without attribution, covering for someone is indistinguishable from interfering with them, and nobody covers for anyone again.

## 12. Admin chat channel

**Centre-scoped, not course-scoped.** Members: centre owner, centre admins, centre manager, course admins. No tutors, no candidates.

- It does not reach into any course, so the trainer-only rule is untouched. Course channels do not appear in an admin's picker at all — there is nothing there they could join.
- **Named after the centre, not a course** ("ITI Istanbul · admin"), so nobody assumes a message reaches tutors.
- When an admin needs a tutor, the pill says so and points at the tutor's contact details on the roster row, rather than silently having no route.
- **The centre manager can post here**, despite being read-only everywhere else. Being unable to ask a question is a strange kind of read-only.

## 13. Organisations with more than one branch

Optional tier above the centre. A single-centre customer never sees it. The worked case: IH Istanbul and IH İzmir, one admin covering both, one owner wanting a single view.

**A branch is a centre, not a folder.** Cambridge approval is per centre — each branch has its own approval number, assessor visits and Centre Grade Approval forms. Courses, grades and the assessor pack stay centre-scoped however large the organisation.

**One account, roles at several branches.** Nobody logs in twice.

- The landing page **aggregates across every centre the person holds a role at**. Courses are listed with their branch; the pipeline is totalled with a per-branch split beneath.
- **A filter, not a switcher.** Switching context means re-orienting on every move; filtering keeps one page and narrows it on demand.
- **The branch always travels with the course code.** "IT059" is ambiguous across two cities, so it never appears alone.
- **One admin room per organisation**, not one per branch — an admin covering both cities is having one conversation.

**The organisation owner** sees every branch's pipeline, enrolment and completion, and appoints the centre owner at each branch. That is all. No course chat, no grading, and no automatic admin rights inside a branch — to act at Istanbul they are made a centre admin at Istanbul, and the attribution says so.

**Areas of responsibility work at both levels.** Someone can own payments organisation-wide but admissions at one branch only; the "Selin handles offers" attribution names the scope.

**Connect still holds no cross-centre key.** The organisation tier belongs to the customer, not to us.

## 14. Sharing between branches

### Candidate referral

A referral is **not a re-application**. Everything the candidate has done moves with them.

- Moves: application form (original submission date), pre-interview task **and its mark** (never re-marked), interview notes attributed to who wrote them, and their **position in the pipeline** — they arrive at Interviewed, not back at Enquiry.
- **A paid deposit stays at the branch that received it** until finance moves it deliberately. Two branches are two sets of books even inside one organisation.
- The originating branch keeps the record marked **referred out**, so its conversion figures are not flattered by people who went elsewhere in the family.
- The candidate gets **one email that asks them for nothing** and never uses the words referred or transferred. Their next action is unchanged: wait for an offer.
- Audit: "Referred to IT060 Istanbul by Selin Arıkan · 14 Dec 11:20", readable at both ends.
- One person holding admissions at both branches refers in a single action. Where nobody spans the two, it becomes a request the receiving branch accepts.

### Three document shelves

**Organisation** — read by every branch: assignment briefs and criteria, the pre-course pack, the GTKY activity bank, policies, the reference timetables. One current version; editing changes what both branches do. Nobody copies anything.

**Branch** — only this centre: room lists, the volunteer letter with the local address, local timetable templates, the Cambridge approval number and assessor contacts.

**Course** — never travels: TP materials, candidate work, feedback, CELTA 5 records, the assessor pack. Belongs to one cohort and one approval number; exported and erased at close-out.

**The test:** if editing a document should change what both branches do, it is organisation-level. If not, it is branch-level. If it belongs to one cohort and one approval number, it is course-level and does not move.

## 15. Importing an existing spreadsheet

A centre with forty applicants in a spreadsheet will not retype them, and asking them to reformat first is the same as asking them not to switch.

1. **Connect the sheet.** Google Drive (read-only, one file, revocable) or a dragged .xlsx/.csv. A one-time read, not a live link — the spreadsheet keeps working and nothing syncs.
2. **Match the columns.** Connect guesses from headings. What it cannot guess is the centre's own status vocabulary — every centre has a status column and no two use the same words.
3. **Preview before anything is written.** The whole import laid out with its problems on top: duplicates, missing emails, ambiguous statuses. This step is what stops a bad mapping becoming forty phantom candidates nobody can delete.
4. **Afterwards.** **No invitations are sent** — imported people are records, not accounts; inviting is a separate deliberate action. **Undo for seven days**, provided nobody has been invited or paid since. Re-runnable: matches on email, never duplicates.

## 16. Centre setup and the Drive model

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


---

# Part C — Communication

## 17. Chat channel rules by role

- **Trainer** — centre trainers, all staff, TP group channels, DMs to trainers on the same course. As built.
- **Trainee** — their own TP group, and DMs to their own tutors. **No cohort-wide channel.** Chat is informal; deadlines and feedback live in the workspace, and the picker says so.
- **Admin** — may not be on any course. Their pill lists course tutor groups they administer, not candidates.
- **Assessor / volunteer** — no chat at all.

Everything resets at local midnight. The bar states the reset and counts down to it.

---

## 18. Contacting a candidate outside Connect

Lives on the candidate's **roster row and profile**, headed **"Outside Connect — urgent only"** with one line beneath: everything else belongs in the app, where it is on the record and the whole group sees announcements.

- **Email** is a plain `mailto:` that opens the tutor's own mail client, pre-filled with the address and a subject carrying the course code. **Not** a send-from-the-app composer — the reply must land in the tutor's own inbox, where they will see it on a Sunday evening, rather than in a platform nobody is watching.
- **Phone** matters more than email for the real cases. The urgent message is almost never information; it is "you are not here and your TP starts in twenty minutes".
- **Visibility follows the chat rule**: tutors registered on that course, nobody else. No admin exception.
- Both are already collected at enrolment. The **enrolment terms must state plainly** that tutors on your course can contact you directly — a candidate receiving a call from a tutor they have never spoken to outside class should have been told it could happen.
- **Candidates see the centre's number, not a tutor's personal one.**

### Emailing the whole group

An **Email all candidates** action sits at course level, next to the roster rather than on any one row.

- It opens a `mailto:` with every address in **BCC**, never To or Cc. Candidates must not see each other's addresses — that is a data breach, not a matter of etiquette.
- **The app never renders a To-formatted list anywhere**, and never offers a "copy addresses" button. If a tutor cannot paste the list into the wrong field, they cannot make the mistake.
- Same visibility rule: tutors registered on that course. The action is absent for anyone else.
- The subject is pre-filled with the course code. The tutor writes the rest.
- **Still urgent-only.** A group email is even more tempting to misuse than a single one, because it feels like an announcement — and announcements belong in the app, where they are on the record, reach candidates who change their email, and appear in the assessor pack.

**Why the label matters:** without it, direct contact becomes the default. One tutor emails about a deadline, the candidate replies by email, and within a week half the course's decisions live in an inbox nobody else can see and nothing reaches the assessor pack.

## 19. `entry_form_sent_at` — why it matters

One field, four behaviours:

1. Decides whether a withdrawal is internal or a reportable **Withdrawn** outcome.
2. Fixes candidate **names** — the certificate prints the name on the entry form. After sending, warn on any name edit; it now diverges from what Cambridge holds.
3. Fixes the **cohort**. Adding a candidate after entry must be explicit and warned, or you get a full portfolio with no Cambridge entry, discovered at grading.
4. It is the one date on the course clock that does **not** derive from the timetable — it comes from Cambridge's calendar.

---


---

# Part D — Interface and platform

## 20. Design system

Tokens, radius, fonts and component classes are already correct in `globals.css` — keep them. Newsreader for headings and figures, Karla for everything else, Instrument Serif/Sans **only** in `Wordmark`. Teal primary, gold reserved (wordmark, Pass A, system-rule dots), cream ground, hairlines over fills, no box-shadows outside floating overlays.

Two patterns used throughout the designs and worth making shared components:

- **A 3px left rule** in place of a background fill, coloured by category. Used in the timetable, TP record, and every list where an item has a type.
- **A small gold dot** meaning "a system rule is in force" — the chat reset, a locked timetable, a released grade, an expiring link. One dot, one meaning, everywhere.

## 21. Guidance, not tours

Three kinds only. No product tour, no coach marks, no persistent help panel.

1. **Empty states that teach** — Rotation before groups exist explains halves of three; the timetable before a skeleton explains generating one. They vanish when content arrives, so a tutor on their fourth course never sees them.
2. **Blocked actions that say why** — "Lock the timetable before assigning rounds." This is the strongest teaching mechanism in the app; make it consistent everywhere an action is disabled.
3. **One-time notes** on genuinely new concepts (self-evaluation, starred action points carrying forward). Dismissed permanently, per person.

Guidance differs by role: admin needs sequencing (setup is done once), trainers need only blocked-action explanations (they repeat the loop), trainees need the most (first and only time, and anxious).

---

## 22. Mobile scope

Website, not an app — a link is the product. Offer "Add to Home Screen" for trainees only (daily use for five weeks).

- **Trainer** — capture, not marking. Points typed or dictated during a TP, tagged and timestamped against the right candidate, appearing in the feedback form on the laptop.
- **Trainee** — everything, one question per screen, dictation on the question itself. Some candidates have no laptop; a course that assumes one excludes them.
- **Assessor** — reading.
- **Admin** — status plus the one or two decisions only they can make.
- **Laptop only** — marking against criteria, the rotation board, the grade meeting, editing the timetable, centre setup. Say so on the phone rather than shipping a cramped version.

---


---

# Part E — Outstanding

## 23. Bugs found in the current build

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

## 24. Still open — needs Ramy before building

1. ~~Do carried TPs count toward the six assessed hours on a deferral's new course?~~ **Answered: no.** The candidate completes the whole second half of the new course regardless of exactly how much past the halfway point she reached — she does not carry partial credit for TPs beyond half. The centre "should consider how much of the course has been completed, the candidate's performance on the original course and the impact the break may have on the final outcome". So the app must let the centre decide per candidate how many hours carry and how many lessons the new course gives them — never compute it. Default the field to the hours completed and let a tutor change it, with a required note when they do.
2. What is the retention and consent position for **rejected applicants**? Their files are required for the assessor and are held as first-class records (§ Application and selection), but they never became candidates and never accepted any terms. The application form itself needs to state how long their data is kept and on what basis.
3. ~~Which storage holds the CELTA 5?~~ **Answered.** The blank original lives in the **Resource hub**, under Forms and documents, as the centre's reference copy — not visible to candidates as something they fill in. At the start of the course candidates sign the disclaimers; everything after that is done in the **built-in CELTA 5 record**; on the final day they sign the declaration; and at close-out the completed record is exported as a digital original alongside the rest of the course.

**Answered during design — recorded above, listed here for traceability:** provisional grade pairs and the slash rule; warning letters and Stage 3 triggers; second/double marking (numbers, blind vs check, who chooses); resubmission deadlines on the timetable; filmed and peer observation; volunteer class levels; assessor documents and portfolio selection; the CELTA 5 as digital original; cover sheet round scope and one PDF per assignment.

---



## Staggered submission dates

Every assignment has **two submission dates — one per teaching group — and one shared resubmission date.**

**Why.** A 09:00 deadline is really an evening-before deadline, and on any evening one group has just taught and the other has not. Each group therefore hands in on a morning it did not teach.

**Why resubmissions stay shared.** Most candidates pass first time, so a shared resubmission day is three or four scripts. The load problem only exists on the first submission. It also fits the legal deadline days exactly: 8 staggered submissions + 4 shared resubmissions = 12, which is every Tue–Thu day in a four-week course.

**Applies to both course shapes.** The five-week has 15 legal days, so it has room to spare.

**The candidate never works it out.**
- Their own date is what appears on their timetable, their to-do list and every reminder. **The other group's date is not shown to them at all.**
- The assignment card shows their group name beside the date, so it is visible without being explained.
- **Said once, in the briefing when the assignment is set:** "Your group's date is on your own timetable. ABC and DEF hand in on different mornings, so the date a classmate gives you may not be yours." Never repeated — every later reminder carries only their own date.
- The failure this prevents is a candidate asking a classmate who is in the other group.

**The tutor's view shows both dates**, because a tutor answering "when is it due" needs to know which answer to give. So does the assessor pack, where two dates for one assignment would otherwise look like an error.

**What a tutor actually gains** is not fairness — it is six scripts at a time instead of twelve, twice, with a day between. The same protected study hours do twice the work.


## Announcements and reminders

**One stream**, on the candidate's home screen under the next session. Group messages and personal ones are mixed deliberately — a candidate cares what they must do next, not which category it belongs to. Two feeds means checking two places and missing whichever is checked less.

**Two audiences, one stream.** Broadcast (level change today, assessor visiting) goes to everyone. Personal (your assignment is marked, your tutorial is booked, your group's deadline is tomorrow) goes to one person or one group. The audience varies per message; the stream does not.

**Three sources, all automatic except the last:**
1. **The timetable** — scheduled messages, anchored to events rather than dates. They exist the moment the timetable is published.
2. **System events** — marking finished, tutorial booked, resubmission required. Fire when the thing happens.
3. **A tutor typing** — rare, and should stay rare. **Permission is by audience, not by role:** a course-wide broadcast is the **course director (MCT) only**; a message to a single TP group can be sent by any tutor attached to that group. An assistant tutor runs their group daily and must be able to tell them things — removing that just pushes it into private messages, which is worse. Before any broadcast sends, it states who it reaches and how many ("this goes to 12 candidates and 3 tutors now"); most accidental sends die at that sentence.

**Anchors, never dates.** Evening before a TP, one day before a deadline, when marking finishes, morning of the changeover. Duplicate a course, change the start date, and the whole schedule re-anchors. A centre edits the wording once and it holds for every course afterwards.

**Pacing:** one routine message a day at most; a second waits for tomorrow. Empty days are correct and necessary — a stream that speaks daily stops being read by week two.

**Push notifications:** only three kinds ever leave the app — a cancellation, a room change, or something already late. **No email during the course**; email is for before it starts and after it ends.

**Two safeguards against clockwork:**
- **A message stops the moment its subject changes state.** A withdrawn candidate never gets "you teach tomorrow"; a cancelled TP cancels its own reminder.
- **A tutor can see what is queued for the next few days and hold anything.** The first time an automated reminder says something untrue, the whole stream loses its credibility.


## Resource hub — what belongs, and to whom

**Letters are not hub material.** Acceptance, rejection, welcome, warning, fail, deferral and extension letters belong to admissions and the candidate's file. The hub is course material; letters are correspondence about a person.

**The assessor never browses the hub.** They receive the assessor pack — a curated export built for one visit. A working hub full of half-finished material raises questions nobody needs to answer.

### Visibility

- **Trainer only:** marking criteria and standardisation notes, grade-meeting material, tutorial templates, blank CELTA 5s, anything naming a candidate, the reference timetable.
- **Both, different views:** TP points and course-book pages (a trainee sees their own plus classmates' watermarked; a tutor sees all). Assignments — brief shared, marking guidance not.
- **Trainee visible:** assignment briefs and examples, recommended reading, input materials, plagiarism/AI/appeals/netiquette policies, the pre-course pack, observation forms, filmed observations.

**The rule:** a trainee sees everything they need to do the work, and nothing about how it is judged.

### Categories currently missing

Pre-course pack (Cambridge task + centre Section 6 + day-one activity) · GTKY activity bank (organisation-level) · centre policies as distinct from Cambridge documentation · audio and class materials sitting beside the TP pages they belong to · peer-observation and error-log forms · marking criteria and standardisation notes.

### Input sessions are one card per session

Not a folder. Each session card carries its slides, handouts, links and recording, **attached to the timetable slot that delivers it**. A candidate opening Tuesday's "Teaching lexis" gets everything from that session in one place; a tutor preparing it next course finds last course's version already assembled. Duplicating a course brings the input materials with it, already on the right slots. This is the largest category in the hub.

## Trainer training — not yet designed

A trainer-in-training is running a course inside the course: their own schedule, their own observations, their own sign-off, and they are being assessed while candidates assume they are staff. This is a **parallel journey**, not a hub category, and nothing in the design touches it yet. See `CELTA_TIT_Training_Up_Schedule.pdf` in uploads.


## Decided — the course shape

**Five weeks, Fridays off.** Twenty working days over five calendar weeks, Monday to Thursday.

This is now the centre's default and the shape a new course duplicates. The four-week shape stays available in `Reference Timetable.dc.html` for centres that need it, but it is no longer what Connect suggests.

Why it wins, in the order that mattered:

- **Fifteen legal deadline days instead of twelve.** Four assignments need eight submission slots and four resubmission days. Four weeks has exactly twelve and no slack; five weeks has three spare, so a deadline can move afterwards without knocking another over.
- **Every resubmission fits inside the course.** In the four-week shape LFC lands on day 19 and the course closes on day 20, which is why most four-week centres take LFC resubmissions after close. Five weeks removes the need for that entirely, and the rule holds: nothing is resubmitted after the course closes.
- **No tutor marks at a weekend.** Deadlines snap to Tuesday–Thursday in both shapes, but only the five-week version has enough non-teaching days to make that comfortable rather than nominal.
- **The Friday is a genuine rest day, not a study day.** Candidates get a three-day gap once a week, and the level change gets a long weekend after it.

Contact hours and own-time hours are unchanged — 135 and 80. The five-week shape spreads the same course, it does not shorten it.


## Trainer in training — blind marking and input progression

Source is the Admin Handbook (3.7.4 and 13.7); `Trainer in Training.dc.html` holds the design.

**Blind marking.** The trainer in training receives a copy of assignments **already marked by the supervisor**, with the marks and comments withheld. They mark blind, then the two are compared side by side. Usually a couple of assignments rather than a full set — the point is calibration, not workload.

Connect holds both versions and shows them together. Neither the candidate nor the course record ever sees the trainee trainer's version.

**Input sessions delivered: three to four across the course**, roughly one a week. Progression is deliberate:

- **First** — one of the straightforward sessions, early, to get the experience of standing up.
- **Middle** — a language-focused session, which is the harder kind and where most trainee trainers find the gap.
- **Final** — one of the easier sessions again, at the end, so the last thing they do is one they can do well.

That last point is a design decision, not an accident of scheduling: a training programme that ends on someone's weakest session sends them away with the wrong impression of their own competence.

The app schedules these against real timetable slots, so a supervisor can see at a glance whether the progression has actually happened or whether all four landed in week three.


## Input session cards — specs

`Resource Hub.dc.html` holds the design — 2a is the course's sessions in timetable order, 1c is one session opened. Nine rules:

1. **One card per session, not per file.** Slides, handouts, links, audio and the recording on one card.
2. **Attached to the slot, not the date.** Move the slot and the card moves. Duplicate the course and every card arrives on the right slot.
3. **Deleting a slot orphans, never deletes.** The card goes to an unattached list.
4. **Tutor notes are a separate material on the same card**, trainer-only, never in the assessor pack unless added deliberately.
5. **Recordings appear only if recorded** — no placeholder row. Can be unpublished without deleting.
6. **Carried-over material is labelled**, and anything referencing the old level or dates is flagged.
7. **Gaps are visible in the category view** — that is what the grid is for.
8. **It links out, not in** — to the candidate's own lesson plan and the assignment the session feeds.
9. **The trainer-in-training programme reads it** — sessions a trainee trainer delivers are marked, so the supervisor can check the easy → language → easy progression happened.


## The candidate admissions record

`Candidate Record.dc.html`. Sourced from Admin Handbook 7.2, 7.3, 7.4 and 12.2.

**Contents.** Application form · identity authentication (passport, checked at interview, recorded with who checked it) · interview record naming the verified tutor or trained nominated person who conducted it · language awareness task · extended writing task · entry-requirement evidence (age, language level, education) · three signed acknowledgements · plagiarism policy signature · pre-course task · platform familiarisation task (online TP courses only).

**Three ordering rules that block acceptance, not tasks that sit in a list:**

1. **Written tasks before acceptance** (7.2 — "All applicants must submit written tasks before being accepted"). Both tasks marked before Accept is available.
2. **Special-arrangements requests to Cambridge before acceptance** (7.4). Asking in week one is too late.
3. **Rejections are never deleted** (12.2 — records of rejected candidates must be available to assessors). They stay in the pipeline marked not accepted, which also keeps the conversion figures honest.

**Discretion is written, not ticked.** Under 20, and no formal qualifications, are both permitted at centre discretion — but 7.3 asks for convincing evidence, so each needs a written judgement on the record.

**Online courses** get an online interview on the teaching platform plus a familiarisation task. On a face-to-face course those fields are hidden rather than shown as gaps.

**Retention.** Application forms and selection tasks kept six months after the course ends, available on assessment day, accepted and rejected alike. The date shows on every record.

**Plagiarism scanning** applies to the extended writing task as well as assignments — it is the obvious place for work that is not the applicant's own.


## Compliance audit — nineteen open gaps

Read the Administration Handbook (134 obligations), the Syllabus and Assessment Guidelines, a completed CELTA 5, and the AI, plagiarism and netiquette guidance against all designs. `Compliance Audit.dc.html` holds the full report. No contradictions found — all nineteen are omissions. Classified by what each fix costs: **eight are validation or a warning alone**, **four are validation plus a new field or figure**, **six need new interface only**, and **one is an open decision**. So ten of the nineteen need something built, not five.

**Timetable and TP rules to enforce (Handbook 3.7, 9.1.3, 9.1.4, 9.2, 10.2, 14.4)**

1. A candidate cannot teach twice in one day; a tutor is not expected to observe both groups in one day.
2. Five of the six assessed hours must be whole-class teaching, and the non-whole-class lesson may not be either of the final two. **Scheduling a one-to-one or small-group assessed lesson makes the "Teaching one to one" input session required**, timetabled before the lesson it prepares — a candidate should not be sent into a lesson type the course never taught.
3. At least 50% of TP with classes averaging eight students — derive from the register, warn when it can no longer be met.
4. TP must be split evenly between the two tutors.
5. Intensive TP blocks: two-day minimum break midway, no more than six consecutive TP days, and the block should not end on the final day.
6. Mixed-mode, Stage 3, borderline Pass/Fail → the final two assessed lessons must be in the same mode.
7. Materials prepared for LRT or SRT must not be the basis of an assessed lesson, or vice versa — raise as a note to the tutor, never an accusation.
8. End-of-course reports cannot be issued before the final day.

**Administrative deadlines and eligibility**

9. Course dates to Cambridge four weeks ahead (Moodle) or two weeks (other) — derive from start date and mode.
10. Certificates checked against the recommended grades on arrival; Cambridge contacted immediately on an error.
11. A tutor cannot work on two concurrent full-time courses — check at assignment.
12. The same assessor: no more than two consecutive courses, no more than two concurrent at a centre.

**Owed to candidates**

13. ~~A route to raise concerns with the assessor.~~ **Not a gap — already covered by the centre's process.** Candidates meet the assessor on their own, in a timetabled slot they are told about in advance, and can raise anything they like. The grade meeting follows the same day. So this is a named band on the timetable, not a screen and not a messaging feature. What the app owes it: the slot appears on the candidate's own timetable with the assessor named, and no tutor is listed as attending.
14. Two of the four assignments must be written in academic prose — mark the format on each brief.
15. Consultation time is a named component of the 120 hours; name it in the timetable bands. **Rule confirmed:** before an assignment's first submission, a candidate can book consultation with any tutor. Once they've submitted, consultation on that assignment is restricted to their own tutor only.
16. Asynchronous input must be paired with a live follow-up slot before it can be published.
17. The electronic candidate information sheet — fold into enrolment forms and populate the CELTA 5 header, including the ULN where a UK centre needs one.
18. A Cambridge documents shelf at organisation level: syllabus, handbook, authorisation certificate, appeals procedure.
19. **Netiquette contradicts the chat design.** Centre guidance tells candidates not to contact tutors late at night; the chat pill's midnight reset invites it. Needs a decision, not a fix.


## Removed — the assistant

An in-app assistant was designed and then cut. The reasoning, so it does not get re-proposed:

**Every question it answered well was a screen that had failed.** "Where are the audio files" has a real fix — audio sits on the TP card with the scanned pages — and an assistant that explains where things are makes bad navigation survivable instead of fixing it.

**It was least useful when someone needed help most.** The questions candidates lose sleep over are am I passing, is this good enough, was that lesson bad. Those are exactly the ones it had to refuse.

**Finding things is part of learning the course.** Following directions gets you to one file and teaches you nothing about what else was there. A candidate who has hunted through the hub once has a map of it. That is worth more than the minute the assistant would have saved.

**What covers the real need instead**, and better, because none of it waits to be asked: The Week Ahead, the announcement stream, the trainee walkthrough, the task guides for admins, and the nudges.

## Search — in the hub only

One field, in the resource hub, because the hub is genuinely large: input sessions, TP materials, assignments, Cambridge documents, reading, forms.

Not across the whole app. A global search invites the same shortcut the assistant did.

It finds things, it does not answer questions: a session, a plan, a file, a deadline, a form. No summaries, no citations, nothing that has to be kept true.


## Look around — the pre-course hunt

`Look Around.dc.html`. Ships with the Friday email; ten minutes, unassessed.

**A hunt, not a tour.** Five things to find, no directions, no screenshots, no "click here". Somebody shown where the audio lives has learnt one path; somebody who found it has learnt the shape of the hub. This is the same argument that removed the assistant.

**Five corners, one question each** — timetable, teaching practice, resource hub, assignments, contacts. Finding all five means having opened everything that matters in week one.

**The fifth is the real one:** "If you woke up ill at seven in the morning, who would you tell and how?" The answer is: **email the centre — the main course tutor, the same person whose name is on the course emails.**

Two consequences. The MCT's name must be the sender on every course email and must appear on the course page, so "whoever emailed me" resolves to one findable person. And an emailed absence at seven only helps if somebody reads it before the day starts — a TP at 09:30 with an absent candidate disrupts the other five, so the MCT needs that mail flagged rather than sitting in a general inbox.

**It is also the sign-in nudge** the Friday email really exists for. The tutor sees who has not opened it — the same list as who will arrive unprepared.

**The day-one session is twenty minutes inside orientation**, not a session of its own, and it starts from what people could not find rather than from slide one. Not repeated later: if something still cannot be found in week three, that is a screen to fix, not a session to run.


## Input sessions gate the feedback form

Each input session on the timetable is tagged with the Cambridge criterion and sub-criterion it teaches, from the real Appendix 1 — CELTA Criteria (five topics, lettered sub-criteria 1a–1d, 2a–2g, 3a–3b, 4a–4n, 5a–5n; e.g. "4b — ordering activities so that they achieve lesson aims"). An earlier pass invented a different lettering scheme not sourced from the actual document — corrected once flagged. Shown as a small badge on the session card itself, front-facing, before it is opened — so the mapping is visible while browsing, not hidden behind a click.

**The feedback form reads this mapping to gate scoring, not to gate praise:**

- **Marking a candidate down against a criterion whose input session has not yet happened on the timetable** — warn the tutor. It is very likely the tutor meant a different criterion, or the candidate is being penalised for something the course has not taught yet. The tutor can override and proceed; it is a warning, not a block.
- **Marking a candidate up (praising) against an uncovered criterion** — no warning. A strong candidate can exceed what has been explicitly taught, and crediting that is never a problem.

This only covers Week 1 so far, mapped by hand against the real timetable in `Timetable Refresh.dc.html`. The remaining weeks need the same treatment before the gate can run for the whole course — build it week by week as each week's real input sessions are confirmed, not from invented content.


## Language models (2d) — a baseline, not a session

"Providing accurate and appropriate models of oral and written language" (2d) is not taught by any single input session — it is a standing requirement of being in the room from day one, true of every tutor's language use from the first lesson. The feedback-form gate should treat 2d (and any criterion of this kind) as always-covered rather than tied to an input session, so it never triggers the "not yet taught" warning. Rapport (1d) and TTT (4g) are the opposite case: real skills, folded into the centre's "Classroom management" session rather than taught standalone — both now tagged there.


## The gate keys off the input session's timetable slot, not the TP number

Important for whoever builds this: "has this been taught yet" is never a TP-number comparison (TP1, TP2...) and never a date comparison against when a candidate happens to teach. It is strictly: **has the input session that carries this criterion already occurred in this course's timetable, at or before the point being marked.**

Two candidates in different TP groups can be marked on different calendar days for what is nominally "the same" TP round — the gate must not assume TP1 = day X for everyone. It looks up the criterion's input session, finds that session's timetable slot, and compares against the moment of marking. Nothing else.


## Criteria mapping — re-checked for overlap and gaps

Re-read all nine Week 1 sessions against the full Appendix 1 list a second time, adding real secondary criteria that were missed the first pass (not inventing new ones — only tagging what a session genuinely also covers):

- **Focus on the Learner** now carries 1a, 1b, 1c — it was left untagged before, which was wrong: the needs-analysis content of Assignment 1 is exactly Topic 1's criteria.
- **Classroom arrangements and material use** adds 4d (presenting materials professionally, copyright).
- **Lesson planning input** widens to 4a, 4b, 4e, 4f, 4h, 4j, 4k, 4m, 4n — a general lesson-planning session legitimately touches most of Topic 4's structural criteria.
- **Eliciting and concept checking** adds 2c (providing clear contexts).
- **Language analysis 1** adds 2b (identifying and correcting errors).
- **PPP** adds 4f (interaction patterns) and 2c (context when presenting).
- **Text-based teaching** adds 3b (producing language from a text-based task).

**One honest gap found, not fixed by inventing content:** there is no vocabulary/lexis input session in the real Week 1 timetable to overlap with "Eliciting and concept checking." A "Teaching vocabulary and lexis" session existed only in the earlier invented Week 2–5 content that was deleted once found to be unsourced. If Week 1 is meant to include dedicated vocabulary teaching, that session needs to be added to `Timetable Refresh.dc.html` first, the same way Week 1's real sessions were confirmed, before it can be criteria-mapped.


## Input session badges — loop vs language awareness

Fourteen individual input-session designs share a template, but were all labelled "loop input" regardless of type — overclaiming for six of them. Split honestly:

**Loop input** (the session stages itself exactly like the lesson type it teaches): PPP, Guided Discovery, Test-Teach-Test, Lesson Framework, Listening, Receptive Skills.

**Language awareness** (a content/technique session, not a lesson shape — nothing to self-referentially stage): Tense and Aspect, Language Analysis, MFP, Checking Meaning, Functional Language, Teaching Vocabulary.

Text-Based Teaching and Lesson Planning weren't reclassified this pass — worth a look before calling the set finished. All fourteen also now show the time range on each agenda block (was computed but never rendered in the template — fixed everywhere).
