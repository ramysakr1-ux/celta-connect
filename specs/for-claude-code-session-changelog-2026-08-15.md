# Session changelog — 15 Aug 2026, consolidated

Everything decided/built today, in one place, so nothing has to be pieced together from separate spec files. Supersedes conflicting detail in any individual spec below where noted.

## Decisions made
1. **Teaching Practice screen**: the spec's marking-queue (list, sorted by urgency, click a row to open one lesson) supersedes the earlier Aug 6 "one tab, two cards" call. Two-card layout is dead — do not build it.
2. **CELTA 5 / self-assessment**: gets its own 6th nav tab, named **"Progress"** (not "CELTA 5", not folded into "My teaching", not link-only).
3. **"Self-study" is retired as a label.** Anywhere a trainee works independently but **submits something a trainer checks**, rename to **"Supervised review"** (reviewing a prior input session) or the specific assignment name (e.g. "LFC assignment writing"). These count as contact hours. A task with no submission stays unsupervised self-study and does NOT get this treatment or the hour count.
4. **Announcements**: full list and trigger logic finalized (see `for-claude-code-announcements.md`). 8 items flagged as build-blocked on missing infra (push, tutor-group ownership model, pacing-cap rule, register-logged schema gap, level/group-change mechanism, Stage 3 milestone, group-scoped deadlines) — do not attempt these until scoped separately.
5. **Stage 2 tutorial booking**: position-based (1st/2nd/3rd...), not clock-time slots. Per-TP-group visibility and booking, not cohort-wide. One anchored announcement when the block appears; no per-booking notification (the sheet is the source of truth).
6. **Timetable base unit**: 15 minutes, not 45 — lets variable-length sessions (75 min, 90 min blocks) sit on one consistent grid.
7. **Timetable tile visual system**: tinted-per-category surface (not plain white/one color), title + trainer initials + one specific fact per tile. Click any tile → detail panel. Drag → live-validated (clean/dependency-shift/blocked) → cascade-confirm listing everything that moves with it.
8. **Color palette**: staying with the current "warm archive" direction (cream page, near-white/sand card, teal accent, gold/red/grey categories) after reviewing ~30 alternatives. No change applied.
9. **Tracking systems consolidated into one**: every trackable trainee activity (attendance, TP stages, supervised-review quiz score+time, observation hours, Stage 2/3 tutorial booking status, CELTA 5 sign-off, assignments, FOL error-log entries) becomes a **column on Roster's Standing table**, not a bespoke screen per activity. New trackable thing = new column, never a new screen. This retires the standalone "Supervised review — completion" screen as a top-level nav destination — its content becomes that column's drill-down.

## Built this session (files)
- `Trainee Walkthrough.dc.html` — added Stage 2 booking screen ('1b2').
- `Trainer Walkthrough.dc.html` — added Stage 2 tutorial sheet ('1d2') and Supervised-review completion screen ('1d3', to be absorbed into Roster per decision #9 above, not left as a separate destination).
- `Test-Teach-Test Input Session.dc.html` — added teach-stage and Test-2 examples; reordered so Stage 4 follows the reading directly.
- `Text-Based Teaching Input Session.dc.html`, `PPP Input Session.dc.html` — added language-focus/practice example cards; Text-Based also got a highlighting-stage card folded into the same section and into the debrief reorder.
- `Supervised Review Quiz.dc.html` — three topics (language sessions, phonology, classroom management), notes recap → 12-min 10-question timed quiz → trainee sees score, trainer sees completion+time+score (once wired into the unified table).
- `Timetable Drag Prototype.dc.html` — full 4-week drag/validate/detail-panel prototype, warm/brass tile styling.
- Several palette/tile-option exploration files (`Palette Candidates.dc.html`, `Connect Baseline Palettes.dc.html`, `Tile Options.dc.html`, `Sand Swatch on Connect.dc.html`) — exploration only, nothing applied to production files.

## Specs written this session
- `for-claude-code-announcements.md` — full announcement list, triggers, shared rules, blockers.
- `for-claude-code-timetable-tiles.md` — tile system, drag, validation, detail panel, 15-min grid unit.
- `for-claude-code-progress-tab.md` — 6th tab decision.
- `for-claude-code-supervised-review.md` — renaming + contact-hour justification + trainer visibility requirement.
- `for-claude-code-unified-tracking.md` — the one-system decision (#9 above), full column list.
- `for-claude-code-trainer-remaining-screens.md` — updated with the marking-queue supersession note and the Stage 2 booking-sheet mechanics.

## Explicitly NOT decided / still open
- Whether Progress tab later also houses Stage 1/2/3 tutorial outcomes long-term.
- Quiz content/format for observation-review tasks beyond the language/phonology/classroom-management three already built.
- Full read-only (non-admin) timetable view — **resolved 16 Aug: this note was stale.** `for-claude-code-timetable-view.md` already specs it in full (glass-card color system, "Mine" filter, live-now bar). Build from that file.
- Week 5 (part-time) structure.
- Centre Admin Payments/Volunteers detail screens.
- Final compliance-audit pass.

## Instruction to Code
**Build from this file first.** Where an older individual spec conflicts with something listed under "Decisions made" above, this file wins — the individual spec files still hold the fuller detail/reasoning, but the decision list here is the current source of truth on anything that changed today.
