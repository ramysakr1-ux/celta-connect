# For Claude Code — admissions, staffing and close-out

Paste-ready handover for the work designed 8–9 August 2026. Read `specs/admissions-and-close-out.md` for the full detail; this is the build order and the things that will be got wrong.

Repo: `ramysakr1-ux/celta-connect`, branch `main`, path `src`.

---

## What this adds

Nine new screens and four corrections to existing behaviour. Nothing here changes the timetable, teaching practice, assignments or the CELTA 5.

| Area | New | Design file |
|---|---|---|
| Applying | Four applicant steps, five acknowledgements | `Applications.dc.html` |
| Triage | Three lanes, hold, shadow mode | `Interview Booking.dc.html` |
| Interviews | Availability patterns, multiple interviewers | `Interview Availability.dc.html` |
| Interviews | Fixed question bank plus drawn slots | `Interview Questions.dc.html` |
| Admissions | Waiting list, per course | `Waiting List.dc.html` |
| Money | Payment methods, ledger, providers | `Payments.dc.html` |
| Email | Delivery states and bounce tasks | `Email Delivery.dc.html` |
| Staffing | Who is on which course | `Course Staffing.dc.html` |
| Leaving | Four cases, admin side | `Withdrawal.dc.html` |
| Closing | Export vs duplicate | `Course Close-Out.dc.html` |

---

## Build order

**1 — Corrections to what exists.** Small, and they unblock the rest.

- Drop the enquiry stage from the pipeline. Five stages: applied, interviewed, offered, deposit paid, paid in full.
- The pre-course task is self-check. Remove any hand-in; add a cohort-wide answer-key release at a date the centre sets.
- The pre-interview task opens in Connect and autosaves. The email only links to it.
- Acceptance email: next steps numbered — account setup first, then the pre-course task.

**2 — Email delivery.** Everything else generates email, so this comes before the screens that send it.

- Store per-message state: `sent`, `delivered`, `opened`, `bounced`, with provider timestamps and the bounce reason as text.
- A bounce creates a task on the admissions screen scoped to the candidate. It does not auto-clear — it clears when a later message to that address is delivered.
- After two consecutive bounces to an address, stop sending to it and require a new one.
- Correcting an address resends automatically. Both attempts stay on the record.
- No BCC anywhere.

**3 — Application acknowledgements and the commitments document.**

- Five required ticks before submit.
- Store the **rendered text** of the commitments document as it stood at submission, not a version id. An assessor must be shown the words.

**4 — Interview availability.** Booking depends on it.

- Per-interviewer weekly pattern: days, hours, mode, plus a 24-hour cut-off and a slot length with gap.
- Generate bookable slots N weeks ahead from the pattern; regenerate unbooked slots when the pattern changes, never booked ones.
- Blocking: single session, a range, and centre-wide closures set once for everybody.
- Blocking a **booked** slot requires rebooking first.
- Concurrency: several interviewers free at the same time is normal. Assign by least-loaded this intake, overridable to a named interviewer. A panel occupies two interviewers as one booking.

**5 — Triage and booking.**

- The reading writes a per-criterion verdict (`meets` / `flag`) plus a confidence line. Never a score, never a decision.
- Three lanes as in the spec. **No code path produces a rejection email.**
- Fifteen-minute hold with a visible Hold action; the hold is recorded with who pressed it.
- A held invitation can be sent manually by a tutor. Record which route it took.
- Shadow mode is a centre setting: the reading runs and records, sending is disabled.

**6 — Question bank.**

- Fixed questions belong to the centre, seeded from a shipped starter set, editable and reorderable.
- Coverage areas are checked against the bank and report `None` where uncovered.
- Drawn slots are filled from the flagged criteria, weakest first, before the interview. Empty if nothing is flagged. The interviewer can replace them; store what was asked.

**7 — Waiting list.**

- Per course, with a candidate able to be on several.
- Offerable only if interviewed and suitable **and** waiting for that course.
- Rank by outcome then application date; a tutor can reorder with a recorded reason.
- Offer expires (default 48h) and passes to the next person automatically; the first is told.
- Accepting one list removes them from the others.

**8 — Payments.**

- Methods: transfer, cash, card, sponsor invoice. Card is optional per centre.
- Provider connection stores a reference only. No card data ever reaches Connect.
- Every payment row records **confirmed by provider** or **marked by person + name + role**.
- Currency is per course; fee and deposit are separate amounts, not a percentage.
- Instalment schedules are optional; a missed instalment creates a payments task and never an automatic consequence.

**9 — Staffing, withdrawal, close-out.** These are largely reads over existing data plus state.

---

## The things that will be got wrong

**Two numbers describing the same thing must come from the same place.** Every count on these screens is derived from the collection it sits above. This was the single most common defect during design — a header asserting a total the list below contradicted.

**The invitation trigger is "deposit recorded", not "card paid".** A bank transfer marked by an administrator days later fires the same thing.

**Six months runs from the issuing of results, and the deferral window from the end of the original course.** Two different anchors. The deferral window is six months if the *original* course was full-time, twelve if it was part-time — set by the course they left, not the one they return on.

**A mode change on a Cambridge deferral obliges familiarisation activities** (7.9). That is a requirement, not a note.

**The grade explanation must be generated before close-out.** After the export there is nothing to generate it from. It goes inside each portfolio alongside the CELTA 5.

**Close-out exports the portfolio with the CELTA 5 inside it.** Not as sibling files. A centre that stores them separately has to reassemble both to answer one appeal.

**Duplicating a course copies its shape, never its people.** Timetable, sessions, briefs, announcements and their anchors. No candidate data.

**Read-only means the buttons are absent**, not disabled — same rule as elsewhere in the app.

---

## Open

- ~~Whether the tutorial stages should be renamed "progress stage 1/2/3" to avoid collision with Cambridge's Appeal Stage One.~~ **Resolved 16 Aug, corrected against the CELTA 5 source: use "Progress Record — Stage 1/2/3" verbatim** (the CELTA 5 booklet's own heading) — not "Progress Report." See `admissions-and-close-out.md` §9.
- The welcome email's activities link needs a fallback for a candidate who has not set up their account. Preferred: the link goes to the activities and sign-in intercepts, so the email carries one link and no conditional wording.
- `Compliance Audit.dc.html` still lists nineteen open Cambridge requirements — ten needing build, nine needing validation against this repo. Unchanged by this work.
