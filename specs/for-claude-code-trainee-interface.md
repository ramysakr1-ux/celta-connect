# Trainee interface — full spec, all five tabs

Written 14 Aug 2026, for Claude Code. Repo: `ramysakr1-ux/celta-connect` @ `main`. Source: `Trainee Walkthrough.dc.html` (current, authoritative). **`Trainee Home.dc.html` is superseded — do not build from it.**

**Nav/header corrected 28 Aug 2026 — Ramy confirmed the built version is
the one going forward, per a later design handoff; the five-tab/56px-header
description this doc originally had is wrong and removed.** Rest of this
doc (Today tab detail, etc.) still stands.

Nav is a 232px left "Workspace" sidebar rail (`trainee-sidebar-nav.tsx`),
seven items: Course Stream, Pre-course task, Resource Hub, Teaching
Practice, Written Assignments, CELTA 5, Progress. "My timetable" and (when
teaching that day) "Open TP{N} plan" are two pills on the Course Stream
page's own header, top right (`today-tab.tsx`) — not part of a shared top
nav bar. No grades tab, no grades anywhere in the trainee app.

## 1. Today — landing page, where the trainee arrives every morning

Eyebrow: course + week, e.g. "ITI Istanbul C2/2024 · four weeks · week 2". Heading: today's date. Actions: "My timetable" (secondary), "Open TP2 plan" (primary, only when teaching today).

Three panels (1.2fr : 1fr : 1fr):
1. **You teach today** (accent tint, only rendered on a teaching day) — the single most important fact of the day in serif type: which TP, when, where, level, group size, teaching order. Two buttons: "Join the room" (primary) and "Open your plan". Nothing above this panel.
2. **Announcements** (gold label) — up to 3 items, newest first, pinned ones bold with a gold left rule. Author + relative time under each.
3. **Waiting on you** — max 3 action items (assignment due, self-evaluation due, observation hours to log). Never a longer list — anything further out belongs on the Timetable tab, not here.

## 2. Timetable — read-only, filtered to this trainee

Heading: week range. One panel, one row per day: day label, title, time/room/detail line. The trainee's own TP lessons get a teal left rule and bold text; lessons they only observe get a grey rule. A "Today" or "Plan due" pill on the relevant rows. Single action: "Add to my calendar".

## 3. My teaching — the TP record, with no grades anywhere

Heading: progress count, e.g. "3 of 8 taught · 4.5 hours assessed". Two panels (1.5fr : 1fr):
1. **Your lessons** — one row per TP, in order. Past lessons show "To standard" / similar outcome pill (never a grade); today's lesson gets a "Today" pill; future ones show "Plan due" or "Not yet assigned". No grade column, ever — a candidate sees whether a lesson met standard and what to do next, nothing else.
2. **Carried forward** (gold label) — starred action points from the most recent feedback, shown as personal aims already folded into the next plan.

### 3a. Single lesson drill-down (tap a row in "Your lessons")
Breadcrumb back to My teaching. Three panels:
1. **Your lesson plan** — main aim, personal aims, anticipated problems, procedure summary.
2. **Your self-evaluation** — written before feedback is visible, so it's an independent account, not a reply.
3. **Tutor's feedback** — overall standard line, starred/carried action points (gold rule), unstarred praise/notes. Footer notes that "From your peers" commentary sits below this, outside the assessed record — visible to the trainee, never marked, never in the portfolio.

## 4. Assignments — four total, one resubmission each

Heading: what's due, e.g. "1 due today". Two panels (1.4fr : 1fr):
1. **Your four** — one row per assignment: submission/mark date, outcome pill (Pass / Pass on resub / Due today / not yet open). Footer: must pass 3 of 4, one resubmission each; withdrawing an unmarked submission doesn't use up the resubmission.
2. **Writing in progress** (accent tint, only while drafting) — autosave status ("Saved 2 minutes ago" — no manual save button), live word count against the target range, and a reminder that Submit is a separate, deliberate action — nothing is visible to a tutor until it's pressed. Once submitted, the trainee can withdraw it only while it's unopened; once a tutor opens it, it locks to "being marked."

## 5. Resources — read-only subset of the centre's material

Heading: "Everything the centre has given you". Three panels (210px : 1fr : 1fr):
1. **Sections** — Input sessions, Coursebooks, Multimedia, Assignment briefs, Forms and documents. Fewer sections than the trainer sees — TP points and centre documents are staff-only, not shown here.
2. **Input sessions** (this week) — one row per session with its materials list and the exact timetable slot; each links to the criterion it covers.
3. **Forms and documents** — blank PDFs of every built-in form (lesson plan template, self-evaluation form, syllabus, appeals procedure) for when the platform is down or paper is preferred.

## Footer (every screen)
Persistent message bar for the trainee's TP group chat (e.g. "Group ABC"), which clears at midnight — shown with a live countdown. Not a permanent record; purely a same-day coordination channel.

## Design tokens
Ink `oklch(30% 0.042 58)`, body `oklch(23.5% 0.017 65)`, muted `oklch(51% 0.017 70)`, teal (action) `oklch(37.5% 0.058 195)`, gold (system rule/carry-forward) `oklch(63% 0.096 72)`, amber (due/warning) `oklch(44% 0.095 68)`, border `oklch(89.5% 0.012 82)`, card `oklch(99.5% 0.004 90)`, page bg `oklch(92.5% 0.012 85)`. Fonts: Karla (UI), Newsreader (headings/big numbers), Instrument Serif italic (wordmark only).

## Governing principle
Every screen answers "what's happening now, what's waiting on me" before anything else — this is a once-in-a-lifetime, high-anxiety four-week experience for the trainee, so panels are deliberately short (e.g. "Waiting on you" caps at 3 items) rather than exhaustive.
