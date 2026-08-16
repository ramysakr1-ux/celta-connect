# Connect — the twenty decisions

The full specification is `build-spec.md`. This is the short version: the decisions that are easy to reverse by accident and expensive to discover late. Everything here is settled. If the build contradicts one of these, the build is wrong.

Read this first, then the full spec.

---

## The course

**1 · Five weeks, Fridays off.** Twenty working days, Monday to Thursday, over five calendar weeks. This is the default and what a new course duplicates. Four weeks stays available but is no longer suggested — it has twelve legal deadline days against the twelve it needs, so nothing can move afterwards.

**2 · The timetable is the spine.** Assignment deadlines, marking slots, filmed observations, announcement anchors, the divergence session and staggered submission dates all derive from it. Nothing carries an absolute date; everything is anchored to an event and re-anchors when the start date changes.

**3 · Connect refuses to publish a timetable whose deadline falls before its evidence exists.** FOL cannot be due before the divergence session. This is a validation rule, not a warning.

**4 · Assigned and due are two different questions.** A brief goes out the day the input session teaches it. It falls due when the evidence exists. FOL is set on day 1 and due on day 12.

**5 · Nothing is resubmitted after the course closes.** An assignment that cannot fit its resubmission inside the course was set too late. The only exception is a Cambridge-approved extension.

**6 · Submissions are staggered by group, resubmissions are shared.** Two in-dates per assignment, one shared resubmission day. A candidate never sees the other group's date — only tutors and the assessor pack show both.

**7 · Lesson planning is timetabled, not homework.** The group that is not teaching tomorrow plans today, with a tutor in the room.

---

## Assessment and evidence

**8 · The plagiarism scanner never produces a percentage.** A number invites a threshold and a threshold becomes a rule. Show the matched passage, its length and its source. A flag is not a case, and creates no record until a tutor opens one. Tutors only, never the candidate. Built as a provider interface so an external checker can be added later without a rebuild.

**9 · Learner recordings are never auto-transcribed.** Speech recognition repairs the errors that are the evidence. Prompts become timeline markers with loop and slow playback instead; candidates transcribe what they quote.

**10 · Written tasks come before acceptance** (Handbook 6.2), and **special-arrangements requests reach Cambridge before acceptance** (6.4). Both block the Accept action rather than appearing as tasks. The task itself opens in Connect and is never emailed as an attachment; the **pre-course** task is self-check, so nothing is handed in and the answer key is released to the whole cohort at a point the centre sets.

**11 · Rejected applicants' records are never deleted** (11.2). They stay in the pipeline marked not accepted — the assessor asks for them, and a centre with no rejections looks like one that accepts everybody.

**11a · The app never writes a rejection.** A reading of the written task triages into three lanes — clear books an interview automatically after a fifteen-minute hold, borderline queues for a human, clear problems notify a tutor. At no confidence and under no setting does software refuse an applicant, because a candidate turned down can ask why and the answer has to be a person's words. Auto-booking is switched on only after shadow mode has produced evidence for the threshold.

**11b · A waiting list is an interviewed list, and it is per course.** Only interviewed-and-suitable applicants are offerable. Everyone carries which course they are waiting for, with its dates and mode — somebody waiting for the summer intake is never rolled onto April. Offers expire and pass to the next person automatically.

**12 · Discretion is written down, not ticked.** Under 20, or no formal qualifications, are permitted at centre discretion but require a written judgement on the record.

**12a · Marked is not verified, and the record says which.** A card payment reads *Confirmed* because a provider said so; a transfer or cash reads *Marked by* and a name. The same distinction governs everything Connect cannot check for itself — it holds the centre's assertion and who made it, never a tick that implies proof. Connect never holds money and never decides a refund.

**12b · Leaving mid-course has three shapes, and the halfway point decides.** Below it, a **centre deferral** — the centre's own arrangement under 6.9, a place on a later course without a new fee, no Appian form, recorded on both courses. Above it, a **Cambridge deferral** — Appian form, Cambridge confirms, grade recorded as deferred, six months from the end of the original course for full-time and twelve for part-time, same mode unless agreed in writing and familiarisation owed if it changes. The app refuses to record a centre deferral past the halfway point.

---

## People and permissions

**13 · Course chat membership is per-course, derived from being a registered trainer on that course.** Not from a global role. There is no admin path into a course channel and no override — that is the whole value of the rule.

**14 · Only the centre owner assigns roles, including their own.** Everyone sees everyone's role; nobody edits their own.

**15 · Every record carries who did it and when, shown in place.** Acting outside your own area of responsibility is marked as such: "Sent by Ramy Sakr, covering admissions". Without that, covering for a colleague is indistinguishable from interfering with them.

**16 · A branch is a centre, not a folder.** Cambridge approval is per centre, so courses, grades and the assessor pack stay centre-scoped however large the organisation gets. The organisation tier adds a view across and the power to appoint centre owners. Nothing more.

**17 · A trainer in training carries one visible name.** Feedback, marks and tutorials reach candidates under one tutor's name. Nothing reaches a candidate uncountersigned until a competency is independent — and the trainee trainer sees exactly what was cut and added, because that is the training.

---

## What the app says, and when

**17a · Every email is from the centre, and every send is checked.** The sender is the centre's name and reply-to is a centre address; Connect never appears in anyone's inbox. Each email declares its reply route — automated, to admissions, or to the tutor who wrote it — and rejections always route to the person who decided. Nobody is BCC'd on anything: delivery is reported by the provider and a **bounce** becomes a task that does not clear until the email is delivered.

**17b · Money and onboarding never share an email.** The offer carries the fee, the deposit and the deadline and nothing else. The workspace invitation follows when the centre marks the deposit received, and until that moment the applicant exists only on the administrator's screen — no account, no access.

**18 · One message a day at most, and only three ever push.** A cancellation, a room change, or something already late. Everything else waits for them to open the app. Messages stop when their subject changes state.

**19 · Nudges appear only when true, and name their cause.** No permanent progress bars — they become furniture by week two. An observation shortfall caused by missing a timetabled session is an absence: it is recorded on the CELTA 5, counts against the 120 hours, and watching the recording afterwards does not undo it. The message says so rather than implying it can be made good.

**20 · Empty states, task guides and warnings appear when plausible and vanish when not.** No dismiss buttons, because there is nothing to dismiss.

---

## Closing

**21 · Only the portfolios are archived.** One folder per candidate on the centre's own storage, with the CELTA 5 and the grade explanation **inside** it — including withdrawals and deferrals. Everything else the course owns is not evidence: the timetable, the sessions, the briefs and the announcements are duplicated into the next course, and candidate work is never copied forward.

**22 · The grade explanation is written for everyone, before the course closes.** It is generated from the live record, so it cannot exist afterwards — written once the grade is confirmed, not at the grade meeting where grades are still provisional. Six months of retention is an appeal window, not a filing convention, and close-out is refused while an extension, an undecided deferral or a live appeal is open.

---

## The one rule behind most of the others

Two numbers describing the same thing must come from the same place. Every count, total and summary on a screen is derived from the data it describes, never typed alongside it. Most of the defects found during design were a sentence asserting a number the data below it contradicted.


---

## Two things that are not on the list but govern it

**Finding things is part of learning the course.** An in-app assistant was designed and cut, because every question it answered well was a screen that had failed, and because following directions teaches you one path while hunting teaches you the shape of the place. Search exists in the resource hub only — the hub is genuinely large — and it finds things rather than answering questions. There is no global search and no assistant. `Look Around.dc.html` turns the same principle into the pre-course task.

**Nineteen Cambridge requirements are still open.** `Compliance Audit.dc.html` reads the Administration Handbook, the Syllabus and Assessment Guidelines, a completed CELTA 5 and the three centre guidance documents against every design. No contradictions were found; nineteen omissions were. Eight are validation rules alone, four are validation plus a field, six need new interface, and one is an open decision. Read that file before building anything in the timetable, admissions or assessor areas — several of the rules constrain screens that already exist.
