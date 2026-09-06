# Volunteer attendance messaging — complete spec (RSVP email + push copy fix)

Supersedes the messaging sections of `for-claude-code-volunteer-rsvp.md` with exact, approved copy and design (see `Volunteer Attendance Notifications Preview.dc.html` for the visual reference). The hours-math removal and aggregate-visibility asks from that earlier spec still stand — this file adds the finalized message content on top.

## 1. Fix: 30-minutes-before push notification copy

**Current** (`volunteer-session-reminder-cron.ts`): title "Your class starts in 30 minutes", body "Join here."

**Problem**: "Join here" implies the room/link is ready now. It isn't — the room isn't ready 30 minutes out, so the copy is misleading.

**Fix**: Keep the notification firing at the same 25-35-minute-out window (no change to timing/cron), but change the body to tell the volunteer the actual time they should join — **5 minutes before the lesson's real start time**, computed per-event, never a fixed clock time:

- Title: "Your class starts in 30 minutes" (unchanged — this is accurate, it's the notification's own timing, not a join instruction)
- Body: "Please join at {startTime - 5min} — the room won't be ready before then." — e.g. for a 10:00 start, "Please join at 9:55 — the room won't be ready before then."

Compute `{startTime - 5min}` from the actual event's `event_time`, not hardcoded.

## 2. New: day-before RSVP email

Sent the evening before each TP session, to every registered volunteer for that session who hasn't already declined.

**Timing must be relative to the session's own time, not a fixed clock hour.** A full-time course's sessions run in the morning/afternoon; a part-time course can run in the evening — a flat "send at 6:00 PM" would land after some part-time classes have already started, or with almost no notice before others. Compute the send time as a fixed offset before the session starts (e.g. "the evening before, X hours ahead" or "N hours before start, rounded to the previous evening") — confirm the exact rule with the user, but it must be a function of each session's actual `event_time`, never a global fixed hour.

**Sender**: "Connect" only — not the centre name. Push notifications already can't carry centre branding at the OS level (tied to the app's own service worker, not the centre), so this keeps the two consistent: Connect is who's sending it.

**Subject**: "Tomorrow's class — will you be there?"

**Body content**, in order:
1. Connect logo mark (existing brand mark used across all Connect emails)
2. Heading: "See you tomorrow, {volunteer first name}?"
3. One line: "Your {course name} class is tomorrow. Let your teachers know if you'll make it — it helps them plan the lesson." — the course/centre name belongs in this body line, not the sender field.
4. A facts box with three rows:
   - Date: "Tomorrow, {full day name} {date}" (e.g. "Tomorrow, Thursday 27 August")
   - Time: the session's actual start time
   - Where: **"In person at the centre" or "Zoom"** — whichever applies to that specific session (mirrors the same online/in-person logic already used elsewhere, e.g. the student dashboard's "Online" / "In person at the centre" line)
5. Two buttons side by side: **"Yes, I'll be there"** and **"Can't make it"**
6. Small print: "Tapping either button opens your class page — no login needed. This link is yours alone."

**Behavior**:
- "Yes, I'll be there" → records a confirmation for that event (new table, e.g. `volunteer_confirmations`), then opens the volunteer's own `/student/[token]` page.
- "Can't make it" → reuses the existing decline flow (`volunteer_declines`, same table the current "Can't make it? → Let them know" button already writes to) — one decline mechanism, not two.
- A volunteer who does nothing stays "unknown" — never inferred as a no.
- One email per volunteer per event — same idempotency approach as the existing `volunteer_session_reminders_sent` guard, needs its own guard table for this new email.

## 3. Still open (per the earlier spec, unchanged)

- Push-only vs. also-email for the day-before prompt for volunteers who never subscribed to push — this spec assumes email is the day-before channel (since it needs richer content — buttons, facts box — than a push notification can carry), with the existing push infrastructure staying reserved for the 30-minute reminder only. Confirm this reading is right before building.
- The aggregate view (e.g. "5 of 8 confirmed for tomorrow") for whoever manages volunteers — still needs a "where does it live" decision (Today page vs. Volunteers page).
- Whether tapping the push notification should deep-link straight into Zoom for online sessions instead of the volunteer's dashboard page (current behavior always opens the dashboard first).
