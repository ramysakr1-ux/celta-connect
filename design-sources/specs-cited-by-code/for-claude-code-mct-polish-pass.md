# MCT screens — polish pass, for Claude Code

Written 16 Sep 2026. One pass over the nine MCT-facing screens: small aesthetic touches plus nine structural fixes. Every change is in the HTML in this folder; this file says what changed, why, and what to build. Nothing here rewrites the earlier specs for these screens — it layers on top of them.

Repo: `ramysakr1-ux/celta-connect`. Build in the codebase's own components; the HTML is the reference, not code to copy.

---

## 0 · Cross-cutting tokens (apply everywhere)

- **One border grey.** `oklch(88% 0.016 82)`. Replaces 88%/0.014, 90%/0.012 and 92%/0.01 variants, and the assignments board's 91.2%/0.0152.
- **One card radius.** 12px for panels and cards (was 14px on trainer pages, 8px on admin). Row/tile radius stays 6–10px.
- **One card shadow.** `0 1px 2px oklch(0% 0 0 / 0.04), 0 8px 24px oklch(30% 0.04 58 / 0.06)` on every white panel. Previously only the first panel on a page had it.
- **Hover lift = "this opens".** Cards and rows that navigate lift: `transform: translateY(-2px)`, shadow `0 2px 4px oklch(23.5% 0.017 65 / 0.05), 0 14px 30px oklch(30% 0.04 58 / 0.12)`, 200ms `cubic-bezier(.2,.8,.2,1)`. Read-only rows (announcement messages) do **not** lift. Chips and pills that toggle lift 1px only.
- **Entrance.** Panels rise in on first paint: `opacity 0 → 1, translateY(8px) → 0`, 420ms, same easing, staggered 60–140ms between panels. No entrance on route change within a page.
- **Motion respects `prefers-reduced-motion`.** Disable lift and entrance when set.

---

## 1 · Today (`Trainer Homepage v4.dc.html`)

**Duplication removed.** "Your day" listed the Assignment 1 submission, which is also the A1 marking item in Needs you. Rule: *Your day shows only time-bound sessions the trainer is named on; anything that is a task lives in Needs you and nowhere else.* Assignment collection is a task, not a session.

**"Also under Today" chip row.** Corrected 15 Sep after reading `main`: the live hub already has the right rule (`(hub)/README.md`) — Today’s Also-under is Announcements (MCT), Concerns, Support access, one door each, and Assignments is already a tab. Do **not** move Announcements into the nav. The design mock’s six-chip row was stale; the only change is the pill tint (see §0: not gold, so gold stays a role colour).

**One red thing.** The "Write TP feedback" primary button was garnet, same as the "cannot reach 6 hours" banner. The button is now ink-brown `oklch(30% 0.042 58)` with a brown-tinted shadow. Garnet is reserved for the banner (and the MCT role pill). ACT keeps gold as its accent.

**Date heading** `white-space: nowrap` so "Friday 11 September · 12:40" never breaks.

**Motion.** Needs-you rows slide 3px right on hover; flagged tiles lift and ring; assessor card lifts; panels rise in with 0/60/80/140ms stagger.

## 2 · Roster (`Trainer Roster Redesign v2.dc.html`)

**Six columns by default, nine on demand.** Default: Candidate · TPs passed · Assessed hrs · Attendance · Flags · Contact. ("Passed", not "taught" — Ramy, 5 Sep; the mock’s label is wrong.) The detail switch (renamed "Show full detail") adds Assignments, Criteria met, Provisional, plus the existing per-row progress strip. Rationale: the default question is "who is in trouble", already answered by at-risk-first sort plus flags; the other three are marking/assessor questions.

Grid columns: default `290px 170px 140px 130px 1fr 90px`; detail `290px 150px 130px 110px 150px 110px 130px 1fr 90px`. Frozen (withdrawn) rows span 4 or 7 accordingly.

**Filming consent collapses when complete.** While anyone is outstanding: the chip cloud as before. Once all twelve have signed: one teal line, "Everyone has signed · filming can go ahead", and the download link. Computed from consent state, not a toggle.

**Motion.** Stat cards lift and rise in; consent chips lift 1px with an accent inset ring; row hover eases 140ms instead of snapping.

## 3 · Timetable view (`Timetable View.dc.html`)

**Admin column is now the same width as the time bands** — `minmax(118px, 1fr)` instead of a fixed 150px. Deadlines were visually outweighing TP. Day gutter stays 64px.

Motion already specified in `for-claude-code-timetable-view.md` → Motion (tile lift, join halo, diagonal ripple on week change). Tiles remain identical in size — settled.

## 4 · Timetable editing / DragBoard (`Timetable Refresh.dc.html`)

**New: consequence strip.** The spec says moving a session moves everything tied to it (assignment release/due dates, criteria gate, feedback and planning slots, announcements, "Waiting on you"). The tool never showed this before the drop. Now:

- Clicking a tile selects it: teal 2px ring on the tile, every other tile fades to 55%.
- A sticky strip appears above the board, ink-brown, headed **"Moving this moves"** with the event title, dependent count, and one chip per dependent.
- Dependents are computed from the real graph, not hard-coded. Categories a tile can carry:
  - TP → its feedback slot (same day), the other group's planning slot (previous day), criteria scope opened by earlier sessions, "You teach today" announcement.
  - Input session → assignments gated by it, sub-criteria coming into scope at the next TP, recorded briefing + Q&A anchors, resource-hub session card.
  - Deadline → the two marking slots after it, the shared resubmission day, candidates' "Waiting on you", and the rule check (group must not be teaching that day).
  - Course end → close-out gate, final portfolio check, and the constraint that all resubmissions fall before it.
- While dragging, the strip should live-update the dependent dates for the hovered drop day and turn a chip garnet if the drop would break a rule (deadline lands on the group's teaching day, evidence not yet available, Friday/Saturday). Drop is refused on a garnet chip, per the existing validation rule.
- × or clicking the selected tile again clears the selection. Clicking a tile also opens the existing detail panel (shown as 1b).

**Tiles** use `cursor: grab`, lift 2px with a 1.02 scale on hover.

## 5 · Teaching Practice (`Teaching Practice v2.dc.html`)

Owed-lesson cards lift 3px on hover and keep their coloured top edge (inset 3px) plus the standard lift shadow. Cards rise in.

## 6 · Assignments — marking board (`design_handoff_tutor_assignments/Tutor Assignments Board v1.dc.html`)

**Chip legend replaces the italic sentence.** Four chips in the grid header: Passed (filled teal), Needs someone (gold tint + border), Needs settling (garnet tint + border), Not yet open (dashed grey). Same treatment as the cells themselves so the legend is literally the vocabulary.

**Header eyebrow** gets `min-width: 0; white-space: nowrap; text-overflow: ellipsis` so it never wraps over the h1. Card meta line ("Opens D9 · due D10") likewise single-line.

**Borders** unified to `oklch(88% 0.016 82)`. Assignment cards and queue items lift on hover (they open).

Sample tracker on the right is kept: it carries assessor-sampling logic (4 in sample, every Not-met included) that the grid does not show.

## 7 · Announcements (`Course Announcements.dc.html`)

**Timetable anchor is the primary label.** Every message row now leads with a chip naming the event it hangs off (e.g. "TP4 · Mon", "Receptive Skills"), tinted with the message's spine colour. Kind and time drop to a small uppercase meta line beneath. Left column widens to 150px; the right-hand anchor column is removed. This makes the page's one idea — nothing is dated, everything is anchored — visible on every row.

**No hover lift.** These rows do not open; the lift added earlier in the pass was removed.

## 8 · Using Connect — trainer session (`Using Connect - Trainers Input Session.dc.html`)

Interactive cards (tabs, today cards, auto cards, hunt checklist) lift on hover. No structural change. **Flag, not fix:** this is a reference sheet with flip cards, not a timed 45-minute session like the other 25. Either label it "reference sheet" in the hub or build it out to the session frame in a later pass.

## 9 · Course Admin landing (`Course Administrator Landing.dc.html`)

**One list, stage pill.** Three stage groups (Interviewing · 1, Launching · 1, Running · 2) collapse into a single list. Each row: stage pill (Interviewing teal tint, Launching gold tint, Running grey) · course name + meta · status text · arrow. Running rows sit at 80% opacity, full on hover. Grid `120px minmax(0,1fr) auto auto`. Closed courses stay as the one-line history link. Reintroduce grouping only when a centre has 8+ live courses.

## 10 · Trainer opening a trainee's page — full view, no trainee shell

When a trainer — MCT or ACT alike — opens anything that belongs to a candidate (an assignment submission, a lesson plan, a TP record, a portfolio, a certificate/CELTA 5 page), it opens **in the trainer's own frame**, full width, with none of the trainee-side chrome:

- No trainee side panel, no trainee nav, no "Waiting on you", no trainee notebook or five-doors rail. The trainer already has their own header and nav; the candidate's shell is noise.
- Content fills the trainer content area. The trainer header stays; a thin read-only banner beneath it names whose page it is: "Viewing as tutor · Sara Yılmaz · Assignment 2 (LRT), round 1" with a back link to where the trainer came from (board, roster, TP list).
- Trainer-side actions (mark, add criteria feedback, sign, return) render in the trainer's own action bar, not inside the trainee layout.
- This applies to every entry point: assignments board cell, roster row → portfolio, Needs-you item, TP list → plan/record, assessor sample links.
- Same rule for the assessor and centre roles: a candidate's page is always shown inside the viewer's own shell, never the candidate's.

---

## Not changed, on purpose

- Timetable tiles: identical size regardless of duration.
- Assessor sample tracker on the assignments board.
- DragBoard's laptop-only gate for add/generate/bands.

## Open

- Using Connect trainer session: reference sheet or full session? (see §8)
- Deadline hour: **settled 16 Sep** — set per deadline event on the timetable by the MCT/course admin; Connect enforces the day rule only. Documented in `design_handoff_timetable_view/timetable-logic.md`.
