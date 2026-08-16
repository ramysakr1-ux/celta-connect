# Review notes — August 2026

Comments captured during Ramy's walkthrough. Not yet applied; to be discussed at the end of the pass.

## Presentation.dc.html

- Slide 5 (Deposits / Course Emails) — approved as is.
- **Name: "Connect", not "CELTA Connect" — resolved, see `rename-to-connect.md` (locked 7 Aug).** The domain `celtaconnect.com` is a legacy address only, never spelled out as the brand; emails send with display name `Connect`, sender address may be `@celtaconnect.com` but nobody reads that. Slide 5 and the rest of the deck/app/emails should already match; if anything still shows "CELTA Connect" spelled out as the product name, that's a stale miss to fix against the locked spec, not an open question.Decide once, then apply everywhere.

## New — Interview Booking.dc.html

Agreed in session, drawn as `Interview Booking.dc.html`:

- The reading triages into three lanes: clear → auto-book, mixed/borderline → human queue, clear problems → notify a tutor. **It never writes a rejection at any confidence.**
- A 15-minute hold between verdict and email. Two jobs: it reads as a person rather than a machine, and it is a cancellation window with a Hold button in the admin queue.
- Interview availability is the centre's own, not the course timetable — an interviewer is rarely teaching the course they recruit for. Configurable: open slots or three offered times; days and hours per centre.
- One booking, announced in three places. The interview log entry **is** the event; email (admissions + named interviewer) and optional Slack/Teams are copies. If the copies fail the booking still happened.
- Shadow mode first: the reading is recorded on every application from day one and sends nothing, so the threshold is set on evidence. Also answers the assessor — the reading informed an invitation to interview, never a place, an offer, or a rejection.

Open: whether applicants also record themselves (currently only volunteer learners do).

## Parked — taking payment through Connect

Raised in session, **not being built now.** Recorded so the option is not lost.

Today: no money connection anywhere in Connect. Payment status is marked by hand by whoever holds the payments area — the record keeps who marked it, when, and in what role, but Connect is taking their word for it. That is honest for a first version and matches how small centres already work. Reality is messy: cash, bank transfer, instalments.

If a centre ever wants card payment, the shape:

- Connect never holds money. The centre connects **their own** account with a provider (Stripe, or iyzico for Turkish cards and instalments); Connect stores only a reference. Money moves provider → centre's bank.
- The acceptance email carries a Pay deposit link → provider's hosted page → provider confirms → the pipeline stage flips itself. "Paid" then means it arrived, with the bank's timestamp rather than an administrator's memory.
- Cost: roughly 2–3% per transaction, plus KYC onboarding with the provider.
- Must support both routes: card automatic, bank transfer and cash marked by hand. A card-only design does not match how centres actually get paid.
- Instalments change the model — Turkish cards routinely split over 3/6/9 months, which turns the fee from a number into a schedule, and the pipeline from paid/not-paid into on-schedule/behind.

Cheaper middle options if the manual version needs shoring up:
- Show the assertion: "marked paid by Nazlı, 14 Feb" rather than bare "paid".
- Periodic reconciliation against an uploaded bank statement — matches amounts to expected fees, flags drift, no integration.

## Reference Timetable.dc.html

4. ~~Drop the four-week shape.~~ **Not a decision — a labelling bug, fixed.** The reference timetable holds three shapes: four weeks, five weeks with Fridays off, and five weeks with Wednesdays off. The last two were both labelled just "Five weeks", so the third tab looked like a duplicate and part-time looked missing. Now labelled "Five weeks, Fridays off" and "Five weeks, Wednesdays off". Part-time was never in this file — it lives in `Part-Time Course.dc.html`. Open question: should part-time appear here as a fourth shape, since a centre choosing a reference course would expect it in one place?

## Course Emails.dc.html

1. **Acceptance email — order the next steps.** In the acceptance email to Eileen (the first of the three), the next-steps list should be explicitly numbered in this order: **1. set up your Connect account, 2. the pre-course task.** Currently the account setup is not stated as step one before the task.

2. **Pre-course task — resolved 16 Aug.** Self-check inside Connect, never emailed as content or handed in. Sequence: offer email (fee/deposit/deadline only) → deposit clears → workspace invitation → the welcome email (sent the Friday before, or the centre's chosen point) carries the login link → candidate logs in, finds the three get-to-know-Connect activities alongside the pre-course task in the same place. Nothing is submitted; the answer key releases to the whole cohort at the centre's chosen date.

3. **Welcome email — the activities link needs a fallback for people not yet signed up.** The welcome email points candidates at their three get-to-know-you activities. If they have not set up their Connect account yet, the link should still work: it goes to the activities, and anyone not signed in lands on sign-up first, then arrives there.
   - If that redirect already happens, no copy change needed.
   - If it does not, the email needs a line — if you have not set up your Connect account yet, do that first, then your three activities are waiting.
   - Either way: one link, not two. The candidate should not have to work out which applies to them.
