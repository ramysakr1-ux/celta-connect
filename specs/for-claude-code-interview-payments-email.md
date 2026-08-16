# Handover — interview booking, payments, email delivery

Three screens designed, none yet in the repo. Source: `specs/admissions-and-close-out.md` §2–5. Designs: `Interview Booking.dc.html`, `Payments.dc.html`, `Email Delivery.dc.html`.

## 1. Interview booking

- **The interview log entry is the event.** Email to admissions + the named interviewer (with a link to the marked pre-interview task) and optional Slack/Teams are copies — if the copies fail, the booking still happened.
- **A panel books both interviewers as one slot** — for a trainer in training sitting in, or a second opinion on a borderline applicant.
- Blocking a booked slot requires rebooking the applicant first; they're emailed by a person, not automatically.
- **When there's nothing to offer:** never invent a slot. Applicant gets an honest holding email ("we would like to meet you, we are finding a time, we will write within two working days"); admissions sees a flag that doesn't clear until slots exist.
- **Seven fixed questions + two drawn per applicant.** Fixed set is the centre's own, imported at setup like assignment briefs — editable, ships with a Connect starter set. The bank checks coverage against what Handbook 6.2 asks selection to assess, showing **None** where an area has no question (e.g. no digital-literacy question until the centre runs mixed-mode, at which point 6.2 requires one).
- **Drawn pair** comes from rows the pre-interview task reading flagged, weakest first — suggested, never auto-asked. What was actually asked is what goes on the record. This is why **the task is marked before the interview.**
- **Interview record**: fixed questions/answers, drawn questions/answers, two signatures typed at the end with both people still in the room — **Interviewer required**, **Applicant optional but worth having** (confirms notes reflect the conversation if a rejection is challenged). Online interviews sign the same way.

## 2. Payments

- **Connect never holds money and never decides a refund.**
- Four methods: bank transfer (most common), cash, card (optional), employer/sponsor invoice.
- **Card is the centre's own provider account** (iyzico/PayTR for Turkish cards, Stripe/Mollie/Adyen elsewhere). Connect stores a reference only, never card numbers. The Pay link in the acceptance email opens the provider's own page; provider settles to the centre's bank; Connect is told it happened.
- **Confirmed vs Marked by [name]** — the core distinction. A card payment says "Confirmed" because the provider said so. Everything else (transfer, cash, invoice) says "Marked by" + a name. Same figure, different kind of fact — never collapse these into one status.
- **One currency per course**, set by the centre.
- **Instalments are a decision, not a default.** A missed instalment is a payments task, never an automatic consequence — nobody loses a place because a card expired.
- **A waiver/discount records who agreed it and in what role.**
- **Two routes to the workspace invitation**, and the record says which: Automatic (a cleared payment through a connected provider fires it) or Manual (an administrator marks the place secured and sends it — used when terms are agreed and money is coming later). Until sent, the applicant exists only on the admin's admissions page — no account, no Connect access.

## 3. Email delivery

- **Nineteen emails total, nobody receives more than five.** A candidate accepted/enrolled/passed gets: acknowledgement, interview invitation, offer, workspace invitation, starts-Monday. Nothing during the five weeks — course communication is in-app announcements only.
- **Every email is from the centre** — sender is the centre's name, reply-to is a centre address. Connect never appears in anyone's inbox.
- **Three reply routes** per email type: do-not-reply (automated confirmations, task-waiting, workspace ready, staff invitations), replies-to-admissions (interview invitation, offer, all three waiting-list emails, assessor pack), replies-to-the-tutor-who-wrote-it (both rejections, both welcome emails).
- **Money and onboarding never share an email** — the offer carries fee + deadline only; the workspace invitation follows once the deposit clears.
- **Three waiting-list emails, not one:** on the list (position + date), a place opened (48-hour clock), course filled before a place came free.
- **No BCC, ever.** Four delivery states from the mail provider: sent, delivered, opened, bounced.
  - **Bounced is the only state that produces a task** — stays open until delivered, shows the provider's plain-language reason ("no such domain," not a status code).
  - After two failed attempts to the same address, Connect stops trying and asks for a new one; correcting it resends automatically, both attempts stay on record.
  - **Opened is shown for chasing, never treated as proof** (image blocking makes it unreliable both ways).
  - The bounce that matters most: a workspace invitation bouncing to a paid-up candidate.

## Data model notes

- Interview slots need a `panel` flag (2 interviewers) and link to the pre-interview task's flagged-weak-areas for drawing the two extra questions.
- Payment records need a `source` enum (`provider_confirmed` | `marked_manual`) plus `marked_by` (nullable, required when manual) — never a single boolean `paid`.
- Instalment plans are a schedule of dates/amounts against one payment record, not separate payment rows.
- Every outbound email needs a delivery-state row (sent/delivered/opened/bounced timestamps) sourced from the mail provider's webhook, not assumed from send success.
