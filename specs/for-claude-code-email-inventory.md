# Email inventory, triage routing, and the assessor pack — full spec for Claude Code

Written 16 Aug 2026, for Claude Code. Consolidates `specs/admissions-and-close-out.md` §2–5&9, `specs/twenty-decisions.md` (11, 11a, 17a, 17b), and `specs/for-claude-code-interview-payments-email.md`. Read those files for full reasoning; this is the assembled reference.

## Part 1 — The pre-interview task triage: who gets notified, and how

**The app never writes a rejection, at any confidence, under any setting** (rule 11a). The AI reading of the written pre-interview task only sorts into three lanes:

| Lane | What happens | Who sees it | How |
|---|---|---|---|
| Clear on every criterion | Invitation drafted, held 15 minutes, then auto-sent with interview times | Admissions (Centre administrator, or Course administrator if scoped to that course) sees the pending invitation with a visible **Hold** button during the 15-minute window | In-app only — nothing pushes; it's on the admissions screen |
| Mixed / borderline | Queued for a human. Nothing sent. | Admissions | In-app queue item |
| Clear problems | A tutor is notified. Nothing sent. The tutor reads it themselves. | A tutor | In-app flag — **not** push/email (rule 18: only cancellation, room change, or already-late items ever push) |

**Open gap, flag to code rather than guess:** the spec never names *which* tutor gets the "clear problems" notification. The closest governing pattern (`build-spec.md`) makes the **MCT** the one findable point of contact for a course — "the MCT's name must be the sender on every course email... so 'whoever emailed me' resolves to one findable person." Reasonable default: route to the MCT unless/until a real ownership model exists. Do not build a silent default without flagging it — this is a real open decision, not settled.

**Shadow mode first.** From the first application, the AI reading is recorded on every task but nothing is sent — tutors mark and decide as usual. After two cohorts of evidence (every AI verdict vs. every human decision), the auto-booking threshold for the "clear" lane is set from that evidence, not invented up front. Auto-booking only switches on once shadow mode has produced it.

**A held invitation can still be sent by hand** — an admin flags it, a tutor reads the task, disagrees, and sends the same template themselves. One template, two ways out, only ever one send; the record shows which route was used.

## Part 2 — Full email inventory (19 total, max 5 per successful candidate)

Every email: sender is the **centre's name** (never Connect), reply-to is a centre address. No BCC, ever — delivery is tracked via the provider's webhook (sent / delivered / opened / bounced), never assumed from a successful send.

### A. The standard successful path (5 emails)
1. **Acknowledgement** (application received) — *do-not-reply*
2. **Interview invitation** (with times, or the honest holding note if no slot exists yet: "we would like to meet you, we are finding a time, we will write within two working days") — *replies-to-admissions*, body explicitly invites a reply if none of the offered times suit
3. **Offer** — *replies-to-admissions* — carries **fee + deposit + deadline only**, nothing about onboarding (rule 17b: money and onboarding never share an email)
4. **Workspace invitation** — *do-not-reply* — fires once the deposit is recorded: **automatic** if a connected provider confirms payment, **manual** if an administrator marks it received. Until this is sent, the applicant exists only on the admin's admissions screen — no account, no Connect access.
5. **Starts-Monday / welcome** — *replies-to-the-tutor-who-wrote-it* (the MCT, whose name is the course's point of contact)

### B. Other emails (14 more, only sent when the case applies)
- **Two rejection emails** (one for the "clear problems" lane after tutor review, one for a borderline case a human decides against) — always *replies-to-the-tutor-who-wrote-it*, always hand-written/edited by a person, never auto-generated content
- **Interview holding email** — covered under #2 above when no slot exists
- **Three waiting-list emails** — *replies-to-admissions*:
  - On the list (position + date)
  - A place has opened (48-hour accept clock, stated plainly)
  - Course filled before a place came free
- **Late-enrolment welcome** — separate template, only for joining in the final days before day one (never for joining after day one — that's structurally refused)
- **Task-waiting notification** (pre-interview task or pre-course task ready to open) — *do-not-reply*
- **Workspace-ready confirmation** — *do-not-reply*
- **Staff invitations** (tutor/volunteer account setup) — *do-not-reply*
- **Assessor pack** (link, no account/password) — *replies-to-admissions*
- **Internal notifications** (bounce tasks, stalled-application nudges at the centre's own days-without-decision threshold, default 5 working days) — *do-not-reply*

### Delivery & bounce handling
- Four states from the mail provider: sent, delivered, opened, bounced.
- **Only "bounced" creates a task** — on the admissions screen, scoped to the candidate, with the provider's plain-language reason ("no such domain," never a status code). Doesn't auto-clear; stays open until a later message to that address delivers.
- After **two consecutive bounces** to the same address, Connect stops sending and requires a new address. Correcting it resends automatically; both attempts stay on record.
- "Opened" is shown for chasing purposes only, never treated as proof (image-blocking makes it unreliable both ways).
- The bounce that matters most: a **workspace invitation** bouncing to a paid-up candidate — a person with no way into the course they've paid for.

## Part 3 — The assessor pack: automatic, not filed manually

**No manual "move to assessor folder" step exists.** Being a record in the pipeline is what makes someone appear in the pack — this is structural, not an action anyone takes.

- **Rejected applicants' records are never deleted** (rule 11) — they stay in the pipeline marked "not accepted." `build-spec.md`: the application file covers "both rejected and accepted applicants... Applicants are first-class records." A centre with zero rejections on file looks like one that accepts everybody, which is itself a flag to an assessor.
- The pack includes: portfolios, candidate descriptions, the timetable, that day's TP schedule, assignment titles, **application files including rejected applicants**, lesson plans, and the volunteer attendance register (the only attendance register the pack needs — candidate attendance is not a separate list).
- Portfolio selection inside the pack: minimum of four, must include everyone the assessor observes teaching, everyone provisionally graded Fail/potential-Fail, and every withdrawn candidate.
- Retention: application forms and selection tasks (including rejected applicants') are kept for **six months after course end**, available on assessment day, then deleted at close-out along with everything else non-portfolio.
- Withdrawn candidates' files are **paused, not erased** — read-only, still in the assessor pack, because assessors do ask.
- A not-upheld plagiarism case still goes in the pack, evidence the centre looked properly.

## Governing rules that apply across all of the above
- **17a** — every record/send carries who did it and when; covering for someone is marked as such ("Sent by Ramy Sakr, covering admissions").
- **17b** — money and onboarding never share an email.
- **18** — one message a day at most; only cancellation, room change, or already-late items ever push; everything else waits for the recipient to open the app.
- **19** — nudges appear only when true and name their cause; no permanent progress bars.
