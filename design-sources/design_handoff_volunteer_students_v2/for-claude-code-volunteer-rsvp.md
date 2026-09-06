# Volunteer attendance — hide hours math, add day-before RSVP + admin visibility

## 1. Hide the per-class hours math from volunteers

`student/[token]/page.tsx`'s "Your hours" card currently says "Every class adds 2.25 hours" — remove that sentence entirely. Keep the progress bar and the "X hours from your certificate" line; a volunteer should see how close they are, not the per-class credit formula (so nobody reasons "I'll just show up to one more and I'm done" off math we don't want exposed).

Concretely: delete the "Every class adds {…} hours." sentence from the hours card. Everything else (hours credited, hours remaining, milestone bar) stays as is.

## 2. Day-before RSVP (new — doesn't exist today)

What exists: a 30-minutes-before-class push reminder (`volunteer-session-reminder-cron.ts`, fires once per event via `sendPushToOwners`) and a standing "Can't make it? → Let them know" decline button a volunteer can click any time before their class (`volunteer_declines` table). Neither asks for a yes/no in advance, and neither is timed the day before.

Add a new day-before cron (same pattern as the existing 30-minute one, new time window — the evening before or morning of, whichever the centre wants):

- For every TP event happening tomorrow, message each registered volunteer who hasn't already declined: "Your class is tomorrow at [time] — will you make it?" with two actions: **Yes** / **Can't make it**.
- Channel: push notification (reuse `sendPushToOwners`) to volunteers who've subscribed, since that's already wired up; decide with Code whether email is also needed for volunteers who never subscribed to push (likely yes — push adoption won't be 100%).
- "Yes" records a new `volunteer_confirmations` row (or similar) for that event; "Can't make it" reuses the existing decline flow/table. A volunteer who does nothing is neither confirmed nor declined — still "unknown," not read as a no.
- Idempotency guard needed the same way `volunteer_session_reminders_sent` already guards the 30-minute reminder — one day-before prompt per volunteer per event.

## 3. Surface the aggregate to whoever manages volunteers

The trainer (or centre admin, whichever role actually owns volunteer coordination — confirm with the user) needs to see, the day before a TP session: how many of the registered volunteers have confirmed, declined, or not yet responded. This is net-new — nothing today aggregates decline/confirmation counts anywhere a trainer can see them.

- Where it shows: **the Roster page** (trainer's overview of the course), and **to the specific trainees who are teaching that day's TP session** — they're the ones who need to know how many volunteer students will actually be there to teach. Not the volunteer-facing page itself (obviously) and not necessarily the Today page.
- Suggested shape: "5 of 8 confirmed for tomorrow's TP — 1 declined, 2 haven't responded" with a way to see who's in each bucket (names), not just the count, since a trainer planning class size needs to know who specifically isn't coming.

## Ask Code / confirm with the user before building

- Push-only, or also email, for volunteers who haven't subscribed to push?
- Exact timing for "day before" (evening before at a fixed hour, or morning-of)?
- Where the aggregate lives (Today page vs. Volunteers page) — see above.
