# All Connect emails — full specs for code

One box: colors, layout, and the exact wording. No copy in this doc is placeholder — send it as final.

## Visual spec (applies to every email surface — the "All Emails" summary view, and each rendered email template)

**Fonts**: Karla (400/500/600/700) for all UI text and body copy. Newsreader (500/600, has italic) for headlines/section titles only.

**Colors (oklch)**
- Ink (body text): `oklch(23.5% 0.017 65)`
- Muted (secondary text): `oklch(51% 0.017 70)`
- Headline tint: `oklch(30% 0.042 58)`
- Page background: `oklch(92.5% 0.012 85)`
- Card background: `oklch(99.5% 0.004 90)` (also seen as `oklch(99.2% 0.005 90)`)
- Card border: `oklch(89.5% 0.012 82)`
- Pill/chip background: `oklch(96.4% 0.011 85)`
- Teal (setup/informational): `oklch(37.5% 0.058 195)`
- Gold (waiting/time-limited): `oklch(60–63% 0.096–0.11 70–72)`
- Red (rejection/warning): `oklch(45% 0.15–0.16 27)`
- Green (confirmation/positive): `oklch(48% 0.09 150)`

Each email/category gets one accent color as a top spine (3px border) or label tint — the only color-coding device.

**Layout**: cards on a warm off-white page background, 6px border radius, generous padding (16–18px), a colored top border marking category, subject line bold at ~13.5–14px, body copy at 12–14px muted-ink, tags as pill chips, CTA as a filled button in the category accent, footnote/small print at 10.5–11.5px muted.

**Sender rule**: every email displays from the centre's name (e.g. "Meridian English Centre" or "International House Istanbul-Izmir · via Connect"), never "Connect" or "CELTA Connect" as the visible sender.

---

## 1. Applying

**1. Application received** — to Applicant, from Connect (no-reply)
> Subject: *(acknowledgement — plain, no wording drafted beyond: confirms receipt, states a date by which they'll hear. No further copy written for this one; it's the shortest email in the set.)*

**2. Pre-interview task ready** — to Applicant, no-reply
> Subject: **Your pre-interview task is ready in Connect**
Tells them the task is waiting; the task itself opens in Connect and autosaves. Carries: link to the task only.

**3. Interview invite (task read clear)** — to Applicant, from admissions
> Subject: **Meridian English Centre · your CELTA interview — choose a time**
> Heading: We would like to meet you
>
> Dear Leyla,
> Thank you for the written tasks — we have read them and we would like to meet you.
> The interview takes about 45 minutes. We will talk about your teaching, and work through some of the language from your task together. There is nothing to prepare.
> Choose whichever of the times below suits you. If none of them work, reply to this email and we will find another.
>
> CTA: **Choose a time**
> Footnote: Times are held for 48 hours. Monday interviews are in person at the centre; Thursday interviews are online.

---

## 2. The decision

**4. Offer** — to Applicant, from admissions
> Subject: **Meridian English Centre · your place on CELTA C3/2024**
> Heading: We would like to offer you a place
>
> Dear Leyla,
> Following your written task and your interview on 11 December, we are offering you a place on CELTA course C3/2024, running 8 January to 2 February, full time.
> Your extended writing task was strong on organisation and substance — you described what your teacher actually did rather than how it felt, which is exactly the habit this course builds on. We will work on phonology with you; both analysis items were left blank and that is worth attention early.
> The course fee is 32,000 TL. Use the link below to accept your place — it sets up your workspace, where your pre-course task and reading list are waiting. For payment options, including instalments, contact the centre office on +90 212 000 0000 or reply to this email.
>
> CTA: **Accept your place**
> Footnote: Please accept within 14 days. We will hold your place until 22 December, after which it goes to the waiting list.

*(Equivalent template, generic course, sent as the acceptance/deposit email — see §3 item 8 below, same job, different wording variant used in Course Emails.dc.html.)*

**5. Not suitable — after task** — to Applicant, from the tutor (human-written, never generated)
> Subject: **Meridian English Centre · your CELTA application**
> Heading: We are not taking your application further
>
> Dear Selin,
> Thank you for applying to CELTA at Meridian English Centre, and for the time you gave to the written task.
> We are not taking your application to interview. The language awareness section showed gaps that would make the first two weeks of the course very difficult — the analysis items described the language rather than analysing it, and meaning and form were not separated.
> This is not a judgement about whether you can teach, and it is not final. Work through a grammar reference written for teachers — Parrott or Swan — and apply again for a later course. We would read a fresh application properly.
>
> Footnote: If you would like to talk it through before reapplying, reply and Ramy Sakr will call you.

**6. Not suitable — after interview** — to Applicant, from the tutor (human-written)
> Subject: **We are not able to offer you a place**
> Heading: We are not able to offer you a place this time
>
> Dear Tolga,
> Thank you for coming in on 13 December. It was a good conversation and I am sorry this is not the answer.
> We are not offering you a place. Your written task was accurate and well organised, but when we worked through the target language together it was clear that analysing language — separating meaning, form and pronunciation — is not yet somewhere you can start from, and the first fortnight would be very hard.
> You teach already and you clearly think about it. What is missing is a specific, learnable thing. Spend some time with Parrott, apply again for the May course, and we will look at it fresh.
>
> Footnote: Ramy Sakr will call you this week if you would like to go through it.

**7. Waiting list** — to Applicant, from admissions
> Subject: **Meridian English Centre · you are on the waiting list for C3/2024**
> Heading: You are second on the waiting list
>
> Dear Yasemin,
> We would like to have you on CELTA C3/2024, but the course is full. You are second on the waiting list.
> Places do come free — candidates withdraw, defer, or do not take up an offer — and when one does, we work down the list in order. We will tell you either way by 2 January, six days before the course starts.
> If nothing opens, we will carry your application to the March course automatically, with nothing further for you to do. Tell us if you would rather not.
>
> Footnote: Your written task and interview stay on file, so you would not repeat them.

**8. List closed** — to Applicant, from admissions (sends automatically on the promised date)
> Subject: **Meridian English Centre · your CELTA application**
> Heading: The course filled before a place came free
>
> Dear Yasemin,
> We said we would tell you either way by today, so: no place opened on C3/2024. We are sorry — you were second on the list and it was close.
> This is nothing to do with your application, which was strong. The course simply filled.
> We have carried you to the March course, starting 4 March, with nothing further for you to do. Your written task and interview stay on file, so you would not repeat either. Tell us if you would rather we did not.
>
> Footnote: Sent automatically on the date we promised. If you would like to talk it through, reply and Ramy Sakr will call you.

**9. Place freed** — to Applicant, from admissions (48-hour clock)
> Subject: **Meridian English Centre · a place has opened on C3/2024**
> Heading: A place has come free — it is yours if you want it
>
> Dear Yasemin,
> A candidate has withdrawn from C3/2024 and you were next on the list, so the place is yours. The course runs 8 January to 2 February, full time.
> We know this is short notice — it starts in eleven days. Your written task and interview are already on file, so there is nothing to repeat. The fee is 32,000 TL; contact the office about payment, and the pre-course task takes about four hours.
> Please tell us by 6pm on Friday 29 December. There are others on the list behind you, and if we have not heard we will pass the place on.
>
> CTA: **Accept — 2 days left**
> Footnote: Declining costs you nothing: we carry you to the March course automatically, with your task and interview still on file.

---

## 3. Before the course

**10. Acceptance / deposit-secures-place** — to Candidate, from the Course Director, no-reply
> Subject: **Your place on CELTA IT059 · 6 January – 1 February**
>
> Dear Aylin,
> We are pleased to offer you a place on CELTA IT059, running from 6 January to 1 February at our Istanbul centre.
> The course fee is 24,500 TL. To secure the place we need a deposit of 5,000 TL by Friday 12 December. After that date the place is offered to the next applicant — we will not chase you for it, so please treat this part as the deadline it is.
>
> Button: **Pay the deposit** — A receipt is sent automatically. The balance is due by 20 December.
>
> Once the deposit clears, there are two more things to do, and neither is urgent.
>
> Button: **Set up your Connect account** — This is where the whole course lives — your timetable, your lesson plans, your assignments.
>
> Second, the pre-course task. It takes most people eight to ten hours spread over a few weeks, and you hand it in on the first morning. It is not graded. Do not leave it until the week before.
> You will hear from us again the Friday before the course starts, with your group, your level, and what happens on day one. Nothing else is expected before then.
> If anything changes for you between now and January, tell us early — we can almost always help.
>
> Nazlı Aydın
> Course Director

**11. Deposit cleared / workspace invitation** — to Candidate, no-reply
> Subject: **Meridian English Centre · your CELTA workspace is ready**
> Heading: Your CELTA workspace is ready
>
> Sara — you are enrolled on C2/2024 at Meridian English Centre. Your tutors are Ramy Sakr and Hakan Şen. Everything for the course lives behind the link below: your timetable, teaching practice, assignments and feedback.
>
> Facts: Course · C2/2024, full-time 4 weeks / Starts · Monday 6 November, 9:00 / Before day one · Pre-course task, about 4 hours
> CTA: **Set up your account**
> Footnote: The link is yours alone and expires when the course ends. You will be asked to agree to the candidate terms as you set up — it takes a minute.

**12. Welcome — one week before** — to Candidate, from the Course Director
> Subject: **CELTA IT059 starts Monday — here is your group and your first activity**
>
> Dear Aylin,
> We start at 09:30 on Monday 6 January, in Room 6 on the second floor. Bring the pre-course task and something to write with. Nothing else.
> You are in Group ABC, teaching the elementary class. Your tutors are Nazlı Aydın and Deniz Arslan.
> On Monday afternoon, after the demo lesson, each of you will spend twenty minutes with the class doing a getting-to-know-you activity. It is not assessed, nobody is watching, and it is meant to be enjoyable. We have put three to choose from in Connect — have a look this weekend and pick whichever appeals.
>
> Button: **See your three activities** — Two minutes. Choose one, and that is genuinely all the preparation Monday needs.
>
> Everything else on Monday is watching and listening. There is nothing else to prepare.
> Your tutors will answer any questions on the first morning, so please do not worry about anything between now and then.
>
> See you Monday.
> Nazlı Aydın, Course Director

**13. Late enrolment welcome** — to Candidate, from the Course Director
> Subject: **Welcome to CELTA IT059 — starting Monday, and what to ignore**
>
> Dear Emre,
> Welcome to CELTA IT059. A place came free and we are glad you took it — but you have four days rather than four weeks, so this email is mostly about what you can safely ignore.
> We start at 09:30 on Monday 6 January, Room 6, second floor. You are in Group DEF, teaching the elementary class, with Nazlı Aydın and Deniz Arslan.
> The pre-course task normally takes eight to ten hours. Do what you can and bring whatever you have — nobody will comment on how much. You can finish it during the first week.
>
> - Setting up Connect — a minute at most, and worth doing before Monday.
> - The getting-to-know-you activity — twenty minutes on Monday afternoon, three to choose from, unassessed. Pick one if you have time. If not, your tutor will choose for you and that is completely fine.
> - Everything else can wait until you are here.
>
> Button: **Set up Connect and see your activities** — The only thing on this list worth doing before Monday.
>
> Starting late is much more common than you would think, and it makes no difference at all to how the course goes or how you are assessed.
> If you would rather talk it through before Monday, call me on the centre number and ask for me directly.
>
> Nazlı Aydın, Course Director

---

## 4. Staff and assessor

**14. Tutor added** — to Tutor, no-reply
> Subject: **Meridian English Centre · you have been added as a course tutor**
> Heading: You have been added as a tutor
>
> Hakan — Ramy Sakr has added you to C2/2024 at Meridian English Centre as a TP tutor. Your groups and teaching practice will appear once the course is set up.
>
> Facts: Course · C2/2024, full-time 6 Nov–7 Dec / Your role · TP tutor / Added by · Ramy Sakr, main course tutor
> CTA: **Set up your account**
> Footnote: You will only do this once. On later courses at this centre you sign in as normal.

**15. Centre created** — to Centre admin, no-reply
> Subject: **Meridian English Centre · your centre is ready on Connect**
> Heading: Your centre is ready
>
> Ayşe — Meridian English Centre has been set up. From here you add tutors and courses, import your own assignment briefs, connect your Drive, and export everything at the end of each course.
>
> Facts: Centre · Meridian English Centre, Türkiye / Your role · Centre administrator / To do first · Connect Drive, then import your briefs
> CTA: **Set up your account**
> Footnote: You do not need to be on a course. Your link opens the centre, not a cohort.

**16. Interview booked** — to Tutor + admin, no-reply
> Subject: **An interview has been booked**
To whoever holds admissions and to the named interviewer, with a link to the marked task. Carries: time, the marked task.

**17. Reading flagged (clear problems)** — to Tutor, no-reply
> Subject: **An application needs a tutor**
Sent when a reading finds clear problems. No email goes to the applicant. Carries: which rows, confirmation nothing was sent.

**18. Assessor visit pack** — to Assessor, from admissions, no account/no password
> Subject: **Meridian English Centre · assessment visit pack for C2/2024**
> Heading: Your assessment pack is ready
>
> The pack for C2/2024 at Meridian English Centre is prepared and read-only: portfolios, the timetable, teaching practice arrangements for the day, written assignment titles, the application file and the attendance registers.
>
> Facts: Visit · Thursday 30 November / Portfolios · 6, including 2 potential fails / Access ends · when the course closes, 7 Dec
> CTA: **Open the assessment pack**
> Footnote: No account and no password. The link identifies you; opening it is all that is needed.
>
> Gate screen (before the pack opens) — "Before you open the pack": three terms to accept — use this material only to assess this course, not copy/share/retain it; will not copy or reverse-engineer the platform; will keep candidate/student information confidential; understands access ends when the course closes.
> Button: **Agree and open the pack**

---

## 5. Volunteers

**19a. Signed up** — to Volunteer, no-reply
> Subject: **Thank you for volunteering**
Confirms it arrived and says honestly that classes run every few months. Carries: no account created.

**19b. Class starting** — to Volunteer, from admissions, no account/no password
> Subject: **Meridian English Centre · your free English classes start Monday**
> Heading: Your free English classes start Monday
>
> Thank you for volunteering. You will be in the Upper-Intermediate class, taught by teachers training to become qualified English teachers, with an experienced tutor watching every lesson.
>
> Facts: Your class · Upper-Intermediate / When · Mon–Fri, 9:30–12:00, from 6 November
> CTA: **Join here**
> Footnote: No account and no password. Keep this email — the same link opens your class each time.

---

## Formal letters (not counted in the 19, sent mid-course/end-of-course)

**Progress warning (Fail risk)** — to Candidate, signed by course tutor + main course tutor
> Subject line/doc title: Notice following Stage 3 tutorial — at risk of a Fail outcome
>
> Dear Mert,
> Following your Stage 3 tutorial on 20 November with Hakan Şen, we are writing to make clear that on your current progress you are at risk of a Fail outcome on this course. This letter is not a decision. It is a formal notice, given while you still have two assessed lessons to teach, so that you have the opportunity and the information to change the outcome.
> Your tutors have identified the following action points in your CELTA 5 record. They are the areas your final two lessons will be judged against.
>
> Action points: give one instruction, check it, stop / plan for the time you have / anticipate the language learners will need, not the language you intend to teach.
> Closing: Your final two lessons are on 27 and 29 November, both face to face. Please come and talk to your tutor before the first of them — the slots are in the timetable, and we would rather you used one than not.

**Assignment warning (one failed assignment)** — to Candidate
> Doc title: Notice following a failed assignment
>
> Dear Emre,
> Your resubmission of Assignment 2, Language Related Tasks, has not met the assessment criteria. As you have already used the one resubmission available for that assignment, it is recorded as a Fail.
> A candidate must pass three of the four written assignments to be eligible for a Pass on this course. You have passed one and failed one, with two still to submit. This means you cannot fail another assignment.
> Closing: Assignment 3 is due on 27 November and Assignment 4 on 1 December. Both must pass. Your tutor Hakan Şen has offered a tutorial before you submit Assignment 3; please take it.

**Withdrawal** — written by the candidate, countersigned by the centre
> I am writing to confirm that I am withdrawing from the CELTA course C2/2024 at ITI Istanbul, with effect from 22 November 2023.
> My reason for withdrawing is: a change in my work circumstances which means I can no longer attend the remaining teaching practice days.
> I understand that because the course entry form was submitted to Cambridge on 23 October 2023, my result will be recorded and reported as Withdrawn. I understand that this is final and that I cannot rejoin this course.

**Deferral** — centre record + candidate letter
> Dear Can,
> Following your request of 23 November and the medical certificate you provided, ITI Istanbul supports your application to defer completion of CELTA course C2/2024 to a subsequent course. You have completed more than half of this course, which is the condition Cambridge requires for a deferral rather than a withdrawal.
> The centre is submitting a deferral form in Appian, giving full details of the reasons and the arrangements for your re-integration and completion. Cambridge then confirms the arrangements. Your result on this course will be recorded as Deferred on the centre grade form, and your name added to the entry form of your destination course marked as deferred. The assessor for that course will be told in advance and given the previous assessor's comments.
> Closing: You must complete on a course finishing no later than 1 June 2024 — six months from the end of this one. We will hold your place on the February and April courses; tell us which suits you when you are ready.

---

## Source files (where code should read these from, verbatim)
- `Applications.dc.html` — interview invite, offer, both rejections, waiting list, list closed, place freed
- `Course Emails.dc.html` — acceptance, welcome, late-enrolment welcome
- `Invitations.dc.html` — trainee/trainer/centre admin/assessor/volunteer invitations (short form)
- `Certificates and Emails.dc.html` — the longer invitation variants + gate-screen terms
- `Letters.dc.html` — progress warning, assignment warning, withdrawal, deferral
