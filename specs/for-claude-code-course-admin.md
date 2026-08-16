# Course Admin — full spec, all four screens

Written 14 Aug 2026, for Claude Code. Repo: `ramysakr1-ux/celta-connect` @ `main`. Source: `Course Admin.dc.html` (renamed from `Centre Admin.dc.html` — see role note below).

## Role clarification — read this first
**Course Admin and Centre Admin are two separate roles with two separate links.** This file specs **Course Admin**: the CELTA main course tutor's own credentials to set up and run a course — roster, groups, invitations, course-level settings. It does **not** cover money or volunteer-student oversight. **Centre Admin** is a distinct, broader role (payments, admissions, volunteer management, centre ownership) — already outlined in `Admin Roles and Import.dc.html`'s "Centre administrator" role — and gets its own separate spec/build, not this one. Don't merge the two.

Within this file, the working principle is still: **the centre owns the shell, the course owns the people.** Anything reusable — TP points library, assignment briefs, resource hub, feedback style examples, the Drive connection — is shared across every course this trainer runs and survives close-out. Anything about a specific person (roster, groups, invitations) is course-level and is erased at close-out (per the one-week post-course retention policy).

## Screen 2a — Course setup: delivery mode (step 2 of 6)
Asked once, early, because the timetable, rotation, observation log, pre-course pack, and assessor pack all read this single field — changing it after setup means rebuilding the timetable.

**Three mode options**, radio-selected:
- **Face-to-face** — all TP on-site; input may still be online/Moodle. Sets: no mode column on the timetable; the 6 hours of experienced-teacher observation are face-to-face (up to 3 filmed); pre-course task Section 6 Part A shortens to two awareness-raising tasks.
- **Fully online** — all TP online, live, on the centre platform. Sets: requires a tutor demonstration lesson + an unassessed TP slot (≥20 min individual teaching) before assessed TP begins; observation is online-live (up to 3 hrs filmed); every tutor must evidence online teaching/training experience; extending beyond 4 weeks is advised for screen-time breaks and technical contingency.
- **Mixed-mode** — TP in both modes; each candidate teaches one level face-to-face and one online. Sets (shown with the two rules that bite, in red):
  - **One mode per block** — a TP group teaches only one mode at a time; never mixed inside one group at one stage. The timetable enforces this, doesn't just warn.
  - **Two hours minimum in each mode** (3/3 is Cambridge's "desirable"); the hours counter splits into two.
  - No required order between the two mode blocks, but if they split unevenly (e.g. 2hr/4hr), the 2-hour block goes first.
  - Observation must cover both modes — the observation log gains a mode field.
  - Add at least 1 day to the 20-day minimum for the mode transition.

Below the mode cards, 4 explanatory notes (color-coded by weight): mode is asked once and read everywhere; mode is defined by TP location per Cambridge Handbook 2.2.1, not input location; changing mode later requires JCA discussion + a revised timetable before Cambridge Admin approval; Moodle-delivered input on online/mixed courses must be augmented with the centre's own input, with a schedule given to the assessor of what's Moodle vs. centre-added.

## Screen 1a — Course admin home: courses by state
Header: Connect mark, "Course admin" badge, admin's name. Title: centre name + Cambridge centre number. A confirmation banner: "Centre number set — UK205 · Prints on every final report and cover sheet." "New course" primary button.

**Courses list, grouped by state (Running → Upcoming → Closed), never sorted by date** — a trainer running courses for years shouldn't have to scroll to find the live one. Each row: course name, dates, people count, progress/status text, state pill.

**Sidebar**: "Centre material" panel — counts of TP points library, assignment briefs, resource hub items, feedback style examples, coursebooks (all shared across this admin's courses). "What changed" notes panel.

**Admin chat bar** (persistent, bottom-center): a channel picker showing **courses, not people** — an admin thinks "tell C2's tutors," not "message Nadia." One channel per course, named "Centre admin" from the tutors' side so it's clear who's speaking and that they're off-course (naming note: this label may need revisiting to "Course admin" now that the role is renamed — flag for the tutor-facing chat pill copy too). Same reset schedule as every other channel on that course (see chat retention below) — admin messages are coordination, not a record.

**Chat reset setting** (course-level, sits beside the admin-chat notes): Nightly / Weekly / Custom-days toggle. Nightly is default. Custom reveals a day-count input. This is a **rolling window in days, never a fixed calendar cadence**, so it can't wipe mid-cycle on a part-time course spread over months. Applies identically to every chat channel on that course — trainer and trainee alike, not set separately per role.

## Screen 1b — One course: roster, groups, invitations
Header: course name/dates/mode/week, "Duplicate course" + "Invite people" (primary) actions.

**Roster** — one row per person: name, email, role (Tutor/Candidate, tutor role tinted with the accent color), join-state pill (Joined/Invited) — deliberately distinguishable, unlike an earlier build where an invited and joined person looked identical.

**Teaching practice groups** — two side-by-side group cards (e.g. Group ABC / Group DEF), each showing its assigned tutor + meeting days, and its members split into "First half" / "Second half" (the halves the rotation runs on). A warning banner appears when candidates aren't yet grouped: rotation can't be released until every candidate has a group — stated at the point that causes the block, not buried in help text.

**Invitations panel** — one card per role-link (Candidate link, Tutor link), each showing usage ("10 of 12 joined"), the link itself, and Copy / Email it / Regenerate actions together in one row. Regenerating invalidates the old link immediately; a footnote states this next to the button that causes it. Not-yet-joined people need the new link.

**Sidebar**: "What changed" notes.

## Screen 1c — Settings
Left rail nav: Centre profile, Google Drive, Assignment briefs, Feedback style, Tutors — active item has a colored left rule and a red dot flag if something there needs attention.

**Centre profile** — centre name + Cambridge centre number fields; both print on every course's cover sheet and final report.

**Google Drive** — connection status pill ("Connected"), plus rows for connected account, export folder path, and the CELTA 5 template filename. This is where course files are imported from at setup and exported to at close-out.

**Feedback style examples** — real snippets of the centre's own tutor-feedback voice, added once and used to calibrate the AI tone-cleanup on every rewrite thereafter (never to draft content, only to match house style).

**Footer**: Connect logo mark + version number, "Designed and built by Ramy" credit line.

## Design tokens
Ink `oklch(23.5% 0.017 65)`, muted `oklch(51% 0.017 70)`, teal (default accent, tutors) `oklch(38% 0.072 195)`, bronze `oklch(50% 0.09 62)`, gold (system rule / mixed-mode warnings) `oklch(60% 0.11 70)`, red (hard rule) `oklch(45% 0.16 27)`, border `oklch(88% 0.016 82)`, card `oklch(99.2% 0.005 90)`, cream shell `oklch(96.4% 0.014 85)`. Fonts: Karla (UI), Newsreader (headings), Instrument Serif italic (wordmark).

## Tweakable (already exposed as props in this file)
`density` (compact/comfortable/airy — controls row padding and outer spacing), `statusEmphasis` (quiet/balanced/loud — controls how strongly a status pill + rail announce state), `accent` (teal/bronze/ink-warm — the admin's brand color, applied to tutors' role text, active nav items, and primary buttons).

## Not covered here — separate spec needed
Centre Admin proper: payments/fees/deposits, admissions pipeline oversight, volunteer-student management, and the centre-owner role. Do not build these into Course Admin.
