# Filmed observation — group watch session, full spec

Written 18 Aug 2026, for Claude Code. Covers the new filmed-observation experience: a scheduled group viewing of a pre-recorded lesson, with live chat, built-in discussion breaks, a criterion-driven observation task, and automatic logging into the existing Observations hours/log. Design files: `Filmed Observation Watch - Group.dc.html` (primary — native video controls), `Filmed Observation Watch - Custom Player.dc.html` (alternate player skin, same layout, not yet chosen), `Filmed Observation Task.dc.html` (the standalone task page). Builds on the existing `Observations.dc.html` (hours tally + log, now with expandable filmed rows) and `Timetable Refresh.dc.html` (which already schedules "Filmed observation 1–4/5" slots).

## What this replaces / extends
Today, filmed lessons are logged after the fact via a checkbox on the generic observation form (`Observations.dc.html`, mode = Filmed). That log/evidence view is unchanged and still the source of truth for the 6-hour requirement (no more than 3 of 6 hours may be filmed). What's new is the actual **watching experience** — previously nothing modeled how a trainee gets from the timetable to actually viewing the film.

## The model: scheduled group watch, individually rewatchable
- Filmed observations happen at a scheduled timetable slot (already exists: `Timetable Refresh.dc.html` cells like "Filmed observation 2", some marked `zoom: true`).
- All trainees in the group watch the same recording together, synchronously, in-app — not a live broadcast of a real classroom; the "film" is a pre-recorded lesson, so there's no risk of "missing the start" in the traditional sense.
- **The session is recorded/persisted.** Anyone who misses the live sitting (absence, timezone, etc.) can log in afterward and watch the same session solo, at their own pace — same screen, same chat history visible (read-only context), just without anyone else active. This is a deliberate design choice: don't gate the observation hour on live attendance.
- A reminder surfaces in the trainee's portfolio (same "action needed" card pattern as elsewhere) 10 minutes before the scheduled start.

## Screen: `Filmed Observation Watch`
Layout: two-column. Left column (~78% width): video + break/status messaging. Right column (340px): stacked **Group chat** panel above a compact **Observation task** summary panel.

### Header
- Breadcrumb-style label: `Connect · Filmed observation N of 4 · group session`.
- Lesson title = whatever the trainer sets per session (no hardcoded topic — the earlier build used a placeholder, corrected to read "Filmed lesson — focus set by the trainer per session").
- Presence row: overlapping avatar stack of everyone currently in the session + a "{n} of {n} joined" label.

### Video area
- 16:9 container. Trainer loads a link to the licensed recording before the session starts (no automatic fetching or embedding of third-party content by the system — the trainer supplies a URL they hold rights to, or an internally-hosted file).
- Empty state: "No recording loaded" placeholder with a note that the trainer attaches it pre-session.
- **Two player options, not yet decided between:**
  1. **Native controls** (`- Group.dc.html`): a plain `<video controls>` element. Simple, accessible, gets browser-native fullscreen/volume/seek for free.
  2. **Custom player skin** (`- Custom Player.dc.html`): our own control bar — play/pause button, scrubber with **break markers baked directly into the timeline** (small ticks at each scheduled discussion break), current/duration time, playback-speed control, fullscreen toggle. More build effort, but lets the scrubber visually communicate where the breaks are, and keeps the whole surface visually consistent with the rest of Connect instead of browser chrome.
- A small caption line under the video states how many discussion breaks are scheduled and which one is current.

### Discussion breaks
- The recording has **scheduled pause points** (this mock uses 3) baked in at specific timestamps.
- At each one, playback auto-pauses and a full-bleed overlay appears on the video: break number ("break 2 of 3"), a countdown timer (mm:ss), a discussion prompt specific to that break, and a "Resume now" button for anyone who wants to skip the wait.
- Countdown auto-resumes playback at zero; "Resume now" resumes immediately.
- Prompts should be trainer-authored per session, tied to what's happening on-screen at that timestamp (e.g. "what did you notice about how instructions were given in this stage?").

### Group chat panel
- Live message list (name, colored by sender, message text) + a text input with Send.
- Persists with the session recording — visible as read-only history to anyone rewatching solo later.
- No moderation/reporting spec'd here — flag if needed before build.

### Observation task (compact, in-session)
- Shows the linked criterion for context (e.g. "4c · giving clear instructions") and a single quick-note field.
- A link out to the full task page ("See the full task page ↗") for the complete set of prompts — kept compact here so it doesn't crowd the chat during live viewing.

## Screen: `Filmed Observation Task` (full page)
Standalone page, linked from the watch screen (and presumably from the observation log entry after the fact).

- Breadcrumb back to the session.
- Header: lesson title, level, learner count, length.
- **Criterion strip** — two-part banner: "Input session this week" (e.g. Classroom management — giving instructions) → "Criterion" (e.g. 4c · give clear instructions and instruction-checking questions). Same visual pattern as the peer-observation "chain" component already in `Observations.dc.html`.
- **The task itself is generated from that criterion, not fixed content.** This build's example (giving instructions) shows:
  - Two open-text prompts tied directly to the criterion ("Note two examples of clear instructions," "One moment where instructions could have been clearer").
  - One general open prompt ("What would you borrow for your own teaching?").
  - One quick segmented rating relevant to the criterion (here: pace — too slow / just right / too fast).
  - A "Notes against the recording" timestamped list (reused pattern from `Observations.dc.html`'s filmed-row expansion) — click a timestamp to jump the recording back to that point.
- A different week's criterion (e.g. eliciting/concept-checking) would swap in different prompts and a different rating axis, but keep this same shape: 2–3 criterion-specific prompts + 1 general prompt + timestamped notes.
- Footer: autosave indicator + "Mark as complete" button.

## Data flow / integration
- **Autosave**: task responses save continuously as the trainee types; no explicit save action required.
- **Completion**: "Mark as complete" is the only explicit submission action. It is what:
  1. Logs the session into the trainee's Observations log (`Observations.dc.html`) as a new "Filmed" row, with hours counted toward the 6-hour total (subject to the existing 3-hour filmed cap).
  2. Locks or archives the task responses (exact lock behavior — editable after completion or not — not yet decided, flag before build).
- If a trainee is still writing when the video ends, nothing auto-submits — the task panel simply stays open and available until they mark it complete themselves.
- Rewatching solo after missing the live session uses the identical screen and task; "Mark as complete" still applies the same way.

## Open questions / not yet decided
1. **Player choice** — native vs. custom skin. Both are built; pick one (or A/B doesn't apply here, just pick).
2. **Task edit-after-completion** — locked or still editable once marked complete?
3. **Chat moderation** — anything needed, or is it low-stakes enough to skip?
4. **Break authoring** — where/how does a trainer set the break timestamps and prompts for a given recording? Not designed yet; assumed to live wherever the trainer uploads/links the recording.
5. **Compliance note** — filmed observation hours already cap at 3 of 6 per Admin Handbook 9.1 (existing rule, enforced in `Observations.dc.html`); confirm this scheduled-group-watch model doesn't need separate Cambridge sign-off beyond what's already covered for filmed observation generally.
