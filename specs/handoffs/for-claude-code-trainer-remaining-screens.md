# Trainer interface — remaining 8 screens (companion to for-claude-code-trainer-homepage.md)

Written 14 Aug 2026, for Claude Code. Repo: `ramysakr1-ux/celta-connect` @ `main`. Source: `Trainer Walkthrough.dc.html`, screens 1b–1j. Read `for-claude-code-trainer-homepage.md` first for the header, nav, and design tokens shared by every trainer screen — not repeated here.

Nav: `Today, Roster, Timetable, Volunteers, Teaching Practice, Resource hub, Grades Report` — 7 tabs. **Rotation, Portfolio and Announcements are not tabs** — they're reached by drilling into Teaching Practice, a Roster row, and Today respectively.

## 2. Roster
Heading: candidate count. Actions: "Export CSV", "Add candidate" (primary). One panel, full width: a table, one row per candidate — Assessed hrs, TPs, Assignments left, Criteria %, Attendance %, Provisional grade. Clicking a row opens that candidate's Portfolio (see below). A **slashed provisional** (e.g. "Fail / Pass") means tutors haven't settled between two adjacent grades — shown bold in red, blocks finalization until a written justification exists, and is what triggers a Stage 3 tutorial and a Fail letter.

## 3. Timetable
Heading: week range. Actions: "Time bands", "Add event", "Lock timetable" (primary, with a status dot). One panel: **days as rows, time bands as columns** — deliberately transposed from a typical calendar grid. First column is admin/deadlines (assignment due dates, TP points releases), then one column per time band. The timetable is the clock the whole app reads from — TP dates, deadlines, and "this week" all derive from it, so it must be locked before rotation rounds can be assigned.

### 3a. Stage 2 tutorial booking sheet — new, drill-down from a Timetable slot

Same underlying mechanism as the existing "Consultation" bookable band and the interview-availability slot model — not a new booking engine, a new use of the one that exists.

- **Setup**: the tutor places a Stage 2 tutorial block on the timetable for their own TP group only — date, start time, duration (e.g. 90 min). No slot count is entered; the tutor just makes the block long enough to fit the group (their judgement, not a computed minimum).
- **Slots**: the block divides into fixed 15-minute positions (90 min → 6 slots). Slots are shown and booked as **position, not clock time** — "1st", "2nd", "3rd"... — with a shared note under the sheet: "Around 15–20 min each, starting from [block start time]. Running a few minutes over is normal — check with your group before you assume you're late." No slot carries an exact promised time beyond the first.
- **Visibility and booking**: visible only to trainees in that tutor's own TP group (ABC never sees DEF's sheet). Any member of the group can claim the next open position; first to book gets 1st, etc. One booking per trainee. A trainee can release their slot back to open (not swap directly into another's).
- **The sheet is the source of truth.** No notification fires when someone else in the group books — a trainee opens the sheet to see what's left, the same as Consultation. Nothing pings the group per-booking.
- **The one announcement**: when the block is added to the timetable, a single per-group (not broadcast) message fires: "Stage 2 tutorials [day] — book your spot", linking straight to the sheet. Anchored to the timetable slot, not a fixed date, so it re-anchors on duplication like every other announcement.
- **Tutor's view**: the same sheet, read/write — sees all positions filled or open, who's in each, and can adjust the block length if it turns out too short (unbooked positions regenerate; anyone already booked keeps their position, matching the interview-slot precedent of never disturbing an existing booking when a pattern changes).

## 4. Teaching Practice — the marking queue

**Supersedes the Aug 6 "one tab, two cards" decision.** That call — one card the trainee's whole record, one card feedback, click a card to expand everything inside it — does not scale to a trainer watching up to 8 candidates × 8 TPs at once; the job is triage, not browsing. This list/queue layout is what stands. Build this, not two cards.

Heading: "N lessons waiting on you" (dynamic count of rows in panel 1). Actions: "TP points library" (secondary), "Write feedback" (primary). Two panels, grid-template-columns `1.4fr 1fr`, gap 18px, panels vertically top-aligned.

**Panel shell** (both panels): background `oklch(99.5% 0.004 90)` (card white), border `1px solid oklch(89.5% 0.012 82)`, border-radius 6px, padding `16px 18px`, internal `display:flex; flex-direction:column; gap:13px`.

**Panel label** (top of each panel): 10.5px, weight 700, letter-spacing 0.12em, uppercase, color `oklch(51% 0.017 70)` (muted grey — neutral panels) or `oklch(63% 0.096 72)` (gold) if the panel needs a gold label — this queue does not.

### Panel 1 — "Waiting on you" (1.4fr)
One row per lesson needing action, sorted by urgency (feedback due → teaching now → planned). Row structure, each `10px 0` vertical padding, `1px solid color-mix(in srgb, oklch(89.5% 0.012 82) 42%, transparent)` bottom border, `display:flex; gap:12px; align-items:flex-start`:
- **Status rule**: 3px-wide bar, `align-self:stretch`, border-radius 2px, flex:none. Color by state — amber `oklch(44% 0.095 68)` for feedback due, teal `oklch(37.5% 0.058 195)` for teaching now, muted grey `oklch(51% 0.017 70)` for planned.
- **Text block**: flex:1, column, gap 3px. Title line 13px, weight 600 (bold), color `oklch(23.5% 0.017 65)` (body ink). Subtext line 11.5px, weight 400, color `oklch(51% 0.017 70)`, line-height 1.45 — candidate name · TP number as title, lesson topic + date/time as sub.
- **Status pill**: flex:none, inline-flex, `padding:2px 9px`, border-radius 999px (full pill), font 11px weight 600, small 5px dot (currentColor) + label. Three states:
  - Feedback due: bg `oklch(94.5% 0.065 85)`, ink `oklch(44% 0.095 68)` (amber).
  - Teaching now: bg `oklch(93.5% 0.033 235)`, ink `oklch(42% 0.09 250)` (blue).
  - Planned: bg `oklch(93.5% 0.008 85)`, ink `oklch(51% 0.017 70)` (grey).

Footer (11.5px, `oklch(51% 0.017 70)`, line-height 1.5): starred action points from the last feedback carry automatically into that candidate's next lesson plan as personal aims — the loop the whole course runs on.

### Panel 2 — "Your groups" (1fr)
One row per TP group the trainer owns: name (13px, weight 600, body ink) + member list (11.5px sub, muted) on the left, meeting days right-aligned (12px, muted, tabular-nums). No rule bar, no pill.

Footer: group composition rule, e.g. "Six candidates, two halves of three, alternate days. No more than three TPs in one day."

Clicking a row in either panel opens that one lesson full-screen (plan / self-evaluation / feedback / TP points stacked in reading order) — never an inline expansion in place. That drill-down is screen 8 (Portfolio → one TP), reached the same way a Roster row opens a Portfolio.

### 4a. Rotation (drill-down from Teaching Practice, not its own tab)
Heading: "Who teaches when". Actions: "Change base order", "Release round N" (primary, with dot). One panel: a grid, candidates as rows, TP1–TP8 as columns, each cell showing teaching order (1st/2nd/3rd) for that round. Rule: nobody teaches first twice in a row. If a candidate withdraws, their slot simply empties — others keep their positions, nothing re-derives.

## 5. Grades Report — the one tab an assessor also sees, trainer-only until release
Heading: "Grade meeting, [date]". Actions: "Export report", "Record final grades" (primary). Two panels (1.3fr : 1fr):
1. **Undecided — needs justification** (gold label) — candidates with a slashed provisional, red bold text, showing Stage 3 tutorial / Fail letter status and a pill. A Fail letter must be issued with at least two lessons left to teach.
2. **Settled** — one row per final grade band (Pass A, Pass B, Pass, Fail, Withdrawn) with candidate counts. Footer: final grades are subject to Cambridge confirmation — the app is never the authority.

## 6. Volunteers — the language students who make TP possible
Heading: "N registered, N in today". Actions: "Send links", "Add volunteer" (primary). Two panels (1.3fr : 1fr):
1. **Register (today's session)** — one row per volunteer, hours attended this session and tick/no-tick status. Join/leave times sum across rejoins; 90 minutes earns a tick, and the tick credits the whole session (e.g. 2¼ hours) regardless of the exact time logged.
2. **Hours toward certificates** — running total per volunteer against the certificate threshold (e.g. 160 hrs), accumulated across courses and levels since volunteers move between levels depending on what's running.

## 7. Resource hub — one tab, six sections, replaces the old Audio Library tab
Heading: "Reused every course". Actions: "Upload", "New TP point" (primary). Three panels (190px : 1fr : 1fr):
1. **Sections** — TP points, Coursebooks, Multimedia, Assignment briefs, Input sessions, Centre documents, each with a count.
2. **TP points** — one row per point: release style (Scripted / Framework / Coaching prose / Aim only, getting less prescriptive as the course progresses), which TP round(s), source coursebook/unit, usage count. A TP point is assigned to a round from Teaching Practice, written and stored here.
3. **Input sessions** — one row per session with its materials list and timetable week. Centre-level content: survives close-out and duplicates into the next course. Nothing candidate-specific lives here.

## 8. Portfolio — reached by clicking a Roster row, not a tab
Breadcrumb: "← Roster · [name] · tracking [grade]". Actions: "Preview as trainee", "Write TP[N] feedback" (primary). Three panels (210px : 1.25fr : 1fr):
1. **Workspace** — a rail (not an accordion) linking every section of this candidate's record: course stream, teaching practice, written assignments, CELTA 5, attendance — each one click away from every other.
2. **Written assignments** — one row per assignment with mark status pill (Pass / Pass on resub / Due / Not open). Marked Met/Not met against the centre's own imported criteria. One resubmission each; withdrawing before marking never consumes it.
3. **CELTA 5** — a big-figure panel: criteria met count and percentage with a progress bar. Stage 2 is blind — the candidate self-assesses before seeing the tutor's column, both sign digitally, and the final-day declaration decides Withdrawn vs. Fail.

## 9. Announcements — currently mis-located inside a candidate's portfolio; should not be
Heading: "Announcements". Actions: "Schedule for later", "Post to cohort" (primary). Three panels (equal thirds):
1. **Write an announcement** — draft text, recipient count, send timing (now or anchored to a timetable event), pin toggle, and a "keep when the course duplicates" toggle. There's no cohort chat channel, so this is the only way to reach everyone at once; candidates see it on their home screen directly under their next session, above their to-do list.
2. **Scheduled** (gold label) — announcements written once and fired automatically by the timetable (e.g. "sends 2 days before the assessment visit"). Always anchored to a timetable event, never a fixed date, so the set duplicates correctly into the next course. Any can be sent early ("Post now"), edited, or skipped — scheduling is a default, not a lock.
3. **Posted** — history of sent announcements, author and date, pinned ones flagged.

**Known bug to fix, not preserve**: in the code today this composer lives at `/portfolio/[traineeId]/broadcast-composer.tsx` — a trainer has to open one candidate's page to post to the whole cohort. It belongs on Today or its own route, not inside a single candidate's portfolio.

### Edit, on the Scheduled panel — fully specified, build it

"Post now" and "Skip" are already wired; "Edit" is not. Design is final — implement as follows, no further design decisions needed.

- **Trigger**: an "Edit" text action sits beside "Post now" on each Scheduled row, same 12px weight-600 teal (`oklch(37.5% 0.058 195)`) styling, separated by a 1px muted divider (`oklch(89.5% 0.012 82)`).
- **Editable at any point before the announcement fires** — this is not restricted to "still fully scheduled." An announcement that has already gone out to part of the cohort (e.g. sent early to some via a rolling send, or partially delivered) can still be edited going forward; editing never un-sends or retroactively changes copies already delivered. If any recipient has already received it, show a one-line notice inside the form: "N recipients already have the original wording — this change reaches everyone else only."
- **Interaction**: clicking Edit replaces that row in place (not a modal, not a new page) with an inline form, same row width, expanding the panel. Row's rule-bar color switches to teal while editing to mark it active.
- **Form fields**, top to bottom, 10px gap:
  1. Message text — textarea, same 13px/body-ink styling as the row's own title text, auto-height, 1px border `oklch(89.5% 0.012 82)`, 6px radius, 8px padding.
  2. Send timing — the existing anchor picker (event dropdown + offset, e.g. "2 days before the assessment visit"), reusing the Write-an-announcement panel's own timing control. Never a bare date.
  3. Pin toggle and "keep on duplicate" toggle — same toggle control as the composer panel, one row each, label left / toggle right.
- **Actions row**, right-aligned, 8px gap: "Cancel" (secondary style, border `oklch(89.5% 0.012 82)`, bg card white) and "Save" (primary teal, `oklch(37.5% 0.058 195)` bg, white text) — same button tokens as elsewhere on this screen.
- **Cancel** discards edits and collapses back to the normal row, no confirmation needed (nothing was sent).
- **Save** validates message text is non-empty and an anchor is set; on success collapses back to the normal row with updated text/sub, and the row briefly shows a "Saved" pill (grey, `oklch(93.5% 0.008 85)` bg / `oklch(51% 0.017 70)` ink) for ~2s in place of the action links.
- **Concurrency**: editing does not lock the row from Post now/Skip elsewhere — last write wins, no merge UI needed at this scale (single trainer per course).
