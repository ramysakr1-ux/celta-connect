# Entry screens — changes made this session

Written 14 Aug 2026, for Claude Code. Repo: `ramysakr1-ux/celta-connect` @ `main`. Source: `Entry.dc.html`.

## 1. Sign-in copy fix (real bug)
Old copy wrongly said "Trainees, assessors and volunteer students don't sign in." Trainees **do** sign in — they set up a password-protected account once, from their one-time join link, then sign in like a trainer for the rest of the course. Only assessors and volunteers never get an account; their link is all they ever use. New copy: "Assessors and volunteer students don't sign in — you have your own link. Trainees sign in here too, after setting up an account from their join link."

## 2. "Email me a sign-in link" — confirmation screen (new)
This button previously had no result. Added a "Check your email" card, shown after clicking it:
- Confirms a sign-in link was sent to the account's email.
- States the link expires in 15 minutes and works once.
- "Send again" link.
- Fully automatic server-side (an email-sending service fires on click) — nothing for a human to operate.
- Card uses the red tint (`color-mix(in oklab, oklch(45% 0.15 27) 6%, oklch(99.2% 0.005 90))`), not white.

## 3. "Send reset link" (forgot password) — confirmation screen (new)
Same treatment for the existing password-reset gate: a "Check your email" card stating "If an account exists for that address, a reset link is on its way" (deliberately the same wording whether or not the account exists, so the flow can't be used to enumerate accounts), 15-minute expiry, "Send again" link. Same red-tint card styling.

## 4. Trainee join agreement — now 4 lines
Removed: "I will not copy or share course materials or other candidates' work" (trainees are allowed to keep/use course materials — not a real restriction).
Now: (1) attendance/plagiarism/complaints/resubmission policies, (2) own work per assignment, (3) private workspace link, (4) no reverse-engineering the platform.

## 5. Trainer join agreement — now 3 lines
Removed two clauses that didn't belong to a trainer's own responsibilities: a Drive-deletion clause (centre admin's job, not a trainer's) and a portfolio-retention disclosure (a system fact, not a trainer commitment).
Now: (1) candidate work/grades/records are confidential, (2) trainer will follow the centre's malpractice and safeguarding procedures, (3) no reverse-engineering the platform (last, matching order requested).
Removed entirely: the staff-chat-resets clause (redundant — the chat-retention setting isn't something a trainer agrees to, it's centre config).

## 6. Chat retention — now centre-configurable (see also `Chat Pill.dc.html`)
No longer hardcoded to "resets nightly." One centre-wide, per-course setting: a rolling day-count window (Nightly = 1 day, Weekly = 7 days, or a custom day count for e.g. a part-time course) — never a fixed calendar cadence, so it can't wipe mid-cycle regardless of course length. Applies identically to trainer and trainee chat; not set separately per role. Copy across the app now says "resets on the centre's schedule" instead of a hardcoded interval.

## 7. Logo
Sign-in card and both gate cards updated to the current tile-lockup mark (interlocking Cs in a rounded square tile, "Connect" beside it) — no leftover flat mark or separate "CELTA" text anywhere in this file.

## Design tokens (unchanged, for reference)
Ink `oklch(30% 0.042 58)`, red (dead-ends/confirmations) `oklch(45% 0.15 27)`, gold `oklch(60% 0.11 70)`, teal (action) `oklch(38% 0.072 195)`, muted `oklch(51% 0.017 70)`, cream card `oklch(96.4% 0.014 85)`.
