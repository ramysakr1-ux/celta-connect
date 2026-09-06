# Zoom auto-attendance — real spec (OAuth + webhook)

Nothing like this exists today. `zoom_url` on a timetable event is just a stored link — no Zoom API connection, no OAuth, no webhook. Every attendance record right now comes from a trainer manually checking boxes in the Attendance panel (`setAttendance` action, `volunteer_attendance` table). This spec is what's needed to make Zoom participation populate that table automatically, with manual entry kept as the correction path, not removed.

## Why

`Volunteer Journey Demo.dc.html` showed this as if it already worked ("computed automatically... nobody manually ticks a register") — that was a demo promise, not a built feature. This spec is what turns it real.

## Scope

### 1. OAuth connection, per centre

- Centre admin connects a Zoom account once (Settings — new "Zoom" section): standard OAuth authorization-code flow against Zoom's app.
- Store `access_token`, `refresh_token`, `expires_at` on a new `centre_zoom_connections` table (one row per centre, since a centre's meetings are hosted under its own Zoom account).
- Token refresh handled server-side before each API call/webhook lookup.
- Show connection status in Centre Settings: connected/not connected, which Zoom account email, a disconnect button.

### 2. Matching a timetable event to a real Zoom meeting

- When a trainer adds/edits a timetable event's Zoom link, extract the Zoom meeting ID from the URL (`zoom.us/j/<meetingId>`).
- Store that meeting ID on the event row (`zoom_meeting_id` column) — needed to match incoming webhook events back to the right session.

### 3. Webhook endpoint

- New route: `src/app/api/webhooks/zoom/route.ts`, mirroring the existing `stripe`/`resend` webhook routes (raw-body signature verification via Zoom's webhook secret, then parse).
- Subscribe to `meeting.participant_joined` and `meeting.participant_left` events (Zoom app's event subscription config, set once per app, not per centre).
- On each event: look up the timetable event by `zoom_meeting_id`, resolve the participant to a `volunteer_student` (see matching below), upsert a `volunteer_attendance` row with join/leave timestamps.

### 4. Matching a Zoom participant to a volunteer_student

- Zoom participant data includes an email if the participant signed in with one, or just a display name if they joined anonymously/from a phone.
- Match priority: participant email → `volunteer_students.email` (exact match) first; fall back to display-name fuzzy match against `volunteer_students.name` only as a suggestion, never auto-confirmed.
- Unmatched participants (no email match, no confident name match) land in a "needs review" list on the event's Attendance panel — trainer resolves manually, same UI as today's checkbox list, just pre-filled where matched.

### 5. Manual entry stays

- The existing `setAttendance` checkbox form remains the correction/override path — a trainer can always add, remove, or fix a record regardless of what Zoom reported. Auto-attendance populates the same table; it doesn't replace the manual UI.
- Attendance panel should show a small "via Zoom" vs "marked manually" indicator per row so a trainer can tell which records came from where.

### 6. What doesn't need building

- No live "who's in the meeting right now" view — this is post-hoc attendance recording, not real-time monitoring.
- No per-trainer Zoom accounts — meetings are hosted under the centre's one connected account.

## Open questions for Code to flag back if relevant

- Zoom's participant-joined event fires per join, including rejoins after a drop — dedupe logic needed so one candidate re-joining twice doesn't look like two people.
- Whether Zoom's free/basic plan tier (vs. licensed) supports these webhook event types — worth a quick check before committing scope.
