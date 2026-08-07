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

**Retention rules that constrain close-out — Admin Handbook**

Close-out as designed erases at the end of the course. Cambridge requires several things to survive it:

- **Application forms and selection tasks must be kept for six months after the end of the course**, and be available on assessment day. This includes **rejected applicants**. **The centre holds this, not Connect.** The close-out export delivers everything as PDFs to the centre's Drive, and the six-month obligation runs against the centre's own copy. Connect erases on schedule; what the centre does with its files after six months is the centre's decision. This is the same position as every other document: the centre owns the course, Connect is where it was run.
- **Cambridge reserves the right to request portfolios for moderation and awards meetings**, after the course. **Cambridge does not accept hard copies** — portfolios must be electronic and securely stored, which the Drive export satisfies.
- Centres keep **electronic summary records of candidate progress and back-up records** (feedback sheets, progress and tutorial records).
- **Tutors retain a record of the provisional grades agreed at the grading meeting**, to refer to when completing the centre grade approval form in Appian.
- **The assessor's report is the property of Cambridge**, confidential, and **must not be quoted from or used for advertising**. Nothing in the design breaches this — it is a constraint on marketing, not on the app. Two build rules follow: the demo course must never contain real assessor report text, and a freelance tutor sees the report at the centre rather than receiving an exportable copy (2.4.6).

So the close-out sequence is not one erasure but a staged one: export everything at close, erase candidate workspaces and accounts, **hold applicant records six months**, and keep the centre's exported copies indefinitely on its own Drive.

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

**Trainers-in-training — Admin Handbook 2.4.4 and 2.4.5**

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

**Open questions for the centre**
1. **Whose name goes on a trainer-in-training's work?** Answered in practice: a **supervisor countersigns**, and that is **usually but not always the MCT**. So the supervisor is a named person on the TinT's record, defaulting to the MCT and changeable per course — not derived from the MCT role. Every piece of work a TinT produces carries both names, theirs and their supervisor's, on the same pattern as double-marked assignments.
2. Does their marking count toward the **double-marking sample**, or is a verified tutor's countersignature the first mark?
3. Do candidates know they are being observed by a trainer-in-training, and does anything need saying to them?

**Related, from the same section:**
- Tutors must work on a course **at least every two years** to keep verified status; lapsed status requires retraining and standardisation. Worth a quiet flag on a tutor record approaching two years since their last course.
- Roles logged in Appian: **Main Course Tutor** and **Assistant Course Tutor** — which matches the four-role list already in the spec.
- **Freelance tutors**: check verification before employing, request references from two previous centres, include liaison time in the terms. They must respond quickly after the course, **particularly on candidate appeals** — so a freelance tutor's access cannot be cut at close-out while an appeal window is open.
- Centres **send freelance tutors the assessor's recommendations**, but **must not copy them the report** — they may see it at the centre. That is a real permission rule: report visible on site, not exportable to a freelancer.

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

- **A staff role that is centre-level, not course-level.** Not "course admin". Someone who can see and act on the pipeline for every course at the centre, without being a tutor on any of them, and without access to candidate assessment. Selection itself must still be *conducted* by a verified course tutor or a nominated person (6.2), so the role distinguishes **handling** an application (booking, chasing, correspondence) from **deciding** on one (interview, marking, accept/reject), and only verified tutors or nominees can do the second.
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
  - Because the process must demonstrate equality of opportunity (6.2), record that a suggestion was generated and what it said. An unexamined model quietly filtering applicants is precisely the risk here.
- **Rejected applicants' files are retained** for the course they applied to, appear in the assessor pack, and are deleted with everything else at close-out.

**Pre-course task — Cambridge's, plus a centre supplement**

- The centre's uploaded task is Cambridge's **Pre-Course Task, © UCLES 2018** — five sections mapped to the five CELTA units, ungraded, handed in on day one. It is the most recent official version in circulation (the other is © UCLES 2004). Serve it as-is; never rewrite it.
- **It predates the current syllabus.** The syllabus is the **July 2021 edition**, and the 2018 task says nothing about **teaching in virtual classrooms** or **the use of L1** — both of which candidates now meet on the course.
- So the gap is **online teaching** — a centre running mixed-mode courses sends candidates a pre-course task that says nothing about the mode half their teaching practice will be in.
- **Build a centre supplement, not a replacement.** Six to eight short tasks in the same shape as Cambridge's, sitting after theirs as a clearly-marked section: **teaching online, and the use of L1**. Nothing on young learners — CELTA is teaching English to adults. Centre-authored, so it duplicates with the course shell and a centre can edit it. Other centres already do this — the British Council's pre-interview task carries its own pronunciation section alongside the Cambridge material.
- Cambridge's task and the centre supplement are **visually distinct** in the candidate's workspace, and the supplement never claims to be Cambridge's.

**Grade query — the reply before an appeal**

A candidate unhappy with their grade emails asking why. Handbook 15 covers the formal Internal Complaints Procedure and then Cambridge appeal stages, but almost every case starts as an informal email, and answering it well ends most of them there.

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

**Plagiarism — Admin Handbook 8.2.3 and 8.2.4.** Candidates must **confirm in writing** that assignments are their own work; this does not exclude joint preparation and discussion, but they must not collaborate to the extent of submitting substantially similar assignments. Centres must provide guidance on what plagiarism is and how to avoid it, hold an internal policy stating the penalties, deal with detected plagiarism under their malpractice policy, and **must not knowingly submit plagiarised work to Cambridge for moderation**. Candidates must be told that awarding bodies apply severe penalties for plagiarism in externally moderated work — **from loss of marks to disqualification and a ban on re-entry for up to three years**.

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

That way a centre wanting Turnitin, Copyleaks, or an AI-text checker can have it added as a second provider whose findings appear in the same table alongside the internal ones, labelled with which provider found them. Nothing downstream changes: the case flow, the timeline and the assessor pack are already provider-agnostic.

Three things to hold to when a third party is added: the **licence and cost belong to the centre**, not to Connect; a candidate's work being **sent to an external service must be disclosed** in the candidate agreement before it happens, since they accepted terms that did not mention it; and an external tool's **score is never shown or stored as a verdict** — the same rule that applies to the built-in scanner.

**Appeals — Admin Handbook 15**

Three steps, and the app's job differs at each.

**15.1 · At the centre, before anything formal.** The handbook is specific about what a tutor should do when a candidate is unhappy with the recommended grade: *"A tutor should go through the coursework with the candidate, showing the evidence on which the grading decision was based… refer to overall grade descriptors, to specific assessment criteria and to evidence from teaching practice feedback and lesson plans in the candidate's portfolio."* That is exactly the grade explanation specified above — it is not a nicety, it is the procedure. Candidates must also be told that **all recommended grades remain provisional until confirmed by Cambridge** after Grade Review by a Joint Chief Assessor.

**15.2 · Appeal Stage One.** Available only after the candidate has been through **all stages of the centre's Internal Complaints Procedure** and remains dissatisfied, **and once the result is confirmed by Cambridge**. There is an administrative fee. **Cambridge must receive the appeal via the centre within two weeks of the candidate receiving their final result**, and the appeal must be made by the candidate, not a third party.

The process: the centre gives the candidate the **Cambridge Teaching Qualifications Stage One Appeal Form** (downloaded from the Cambridge Support Site — the app does not reproduce it). The candidate completes it and returns it to the centre. The centre **writes a response** to the issues raised, then sends the form and its response to `TeachingAwardAppeals@CambridgeEnglish.org` **within two weeks of receiving the completed form**, along with the candidate's **portfolio and application and selection notes**, sent electronically and securely by the same route as portfolios for moderation.

What Cambridge scrutinises, and therefore what the app must be able to produce as a bundle:
- the Stage One form, completed by the candidate
- the **candidate portfolio**
- the **application and selection notes** — which is why applicant records matter beyond selection
- the **assessor report**
- the **centre's response** to the appeal
- the centre's **terms and conditions for refunds, including a copy of the Candidate Agreement**

So the app should offer an **appeal bundle** action that assembles all of it — the same machinery as the assessor pack, different recipient. The two-week clocks are the thing to surface: both are short and both are the centre's responsibility to meet.

**15.3 · Appeal Stage Two** — independent review, on the candidate's own request, using Cambridge's Stage Two form. Nothing for the app to do beyond keeping the Stage One bundle retrievable.

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
- **The new course should be the same mode of delivery as the original** (face-to-face, online, mixed) unless the candidate agrees otherwise **in writing**. If the mode changes, the centre must provide **familiarisation activities**. The app should warn when a destination course is a different mode, capture the written agreement, and prompt for the familiarisation plan.
- **Everything freezes as it stands, complete or not.** Whatever the candidate had on the day they stopped is preserved exactly: TPs taught, assignments passed, an assignment mid-marking, a resubmission not yet returned, criteria met, self-evaluations, tutorial records. Nothing is discarded for being incomplete and nothing is re-judged. It travels to the destination course as their **portfolio** — the same place it lived on the original course — and it also exports to the centre's Drive at close-out of the original course, so there is a record either way.
- **How many hours carry is the centre's judgement, not a calculation.** 6.9 asks the centre to weigh how much was completed, how the candidate performed, and what the break will do to the outcome. Default the carried figure to the hours already assessed, let a tutor change it, and require a note when they do. The level of support offered should scale with the length of the gap.

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

1. ~~Do carried TPs count toward the six assessed hours on a deferral's new course?~~ **Answered by Handbook 6.9: there is no fixed rule.** The centre "should consider how much of the course has been completed, the candidate's performance on the original course and the impact the break may have on the final outcome". So the app must let the centre decide per candidate how many hours carry and how many lessons the new course gives them — never compute it. Default the field to the hours completed and let a tutor change it, with a required note when they do.
2. What is the retention and consent position for **rejected applicants**? Their files are required for the assessor and are held as first-class records (§ Application and selection), but they never became candidates and never accepted any terms. The application form itself needs to state how long their data is kept and on what basis.
3. ~~Which storage holds the CELTA 5?~~ **Answered.** The blank original lives in the **Resource hub**, under Forms and documents, as the centre's reference copy — not visible to candidates as something they fill in. At the start of the course candidates sign the disclaimers; everything after that is done in the **built-in CELTA 5 record**; on the final day they sign the declaration; and at close-out the completed record is exported as a digital original alongside the rest of the course.

**Answered during design — recorded above, listed here for traceability:** provisional grade pairs and the slash rule; warning letters and Stage 3 triggers; second/double marking (numbers, blind vs check, who chooses); resubmission deadlines on the timetable; filmed and peer observation; volunteer class levels; assessor documents and portfolio selection; the CELTA 5 as digital original; cover sheet round scope and one PDF per assignment.

---

## 10. Design system

Tokens, radius, fonts and component classes are already correct in `globals.css` — keep them. Newsreader for headings and figures, Karla for everything else, Instrument Serif/Sans **only** in `Wordmark`. Teal primary, gold reserved (wordmark, Pass A, system-rule dots), cream ground, hairlines over fills, no box-shadows outside floating overlays.

Two patterns used throughout the designs and worth making shared components:

- **A 3px left rule** in place of a background fill, coloured by category. Used in the timetable, TP record, and every list where an item has a type.
- **A small gold dot** meaning "a system rule is in force" — the chat reset, a locked timetable, a released grade, an expiring link. One dot, one meaning, everywhere.
