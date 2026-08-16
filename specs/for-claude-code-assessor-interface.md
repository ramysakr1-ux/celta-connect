# Assessor interface — full spec (single screen, no tabs)

Written 14 Aug 2026, for Claude Code. Repo: `ramysakr1-ux/celta-connect` @ `main`. Source: `Assessor Visit.dc.html`, screen 1a.

Unlike the trainer and trainee apps, the assessor has **one screen, no tabs, no account** — a single tokenised link that expires after a set date, opening directly into this view. Nothing here can be edited; no action taken is recorded against a candidate.

## What triggers this
"Export for assessor" (a trainer/admin action) does two things at once:
1. Writes the pack to the centre's own Drive folder (viewing rights via a link, nothing retained by Cambridge).
2. Mints the tokenised link that opens this same material live in the app, so the assessor can move between a portfolio, the grades report, and the timetable without downloading anything.

Before it runs, it must check the pack is actually complete and name what isn't (an unrated criterion, an unresolved assignment, an open Stage 3, a missing signature) — it should refuse quietly rather than export a gap, since portfolios must be complete immediately before the visit.

**Two hard rules**: read-only truly means read-only (enforced by giving the assessor no account at all, not just hidden buttons), and the pack carries only full name and course number as identifying data per Cambridge's requirement — nothing else.

## Layout

**Top bar**: teal banner stating "Assessor access — read-only. Nothing you open here can be edited, and no action you take is recorded against a candidate," plus the link's expiry date.

**Header**: Connect mark + wordmark, "Assessor · read-only" label, and a "Download whole pack" button.

**Title block**: centre name/code/course code/dates, "Assessor visit — [date]" heading, and a readiness pill: "Send the pack by [date]" (gold, N days out) with a note that everything must be complete by *that* date, not the visit date. Beside it, 3-4 readiness figures (Send by date, portfolios complete count, assessed hours logged, grades entered count).

**Main grid (1.6fr : 1fr):**

### Left — Candidate portfolios (grid of cards, 2 columns)
One card per candidate: name, meta line (TPs/hours/levels), grade pill (Pass A gold, Pass B silver, Pass neutral, Fail red), and 3 status dots (CELTA 5 complete, TPs complete, Assignments complete — green if met, amber if not). A flagged issue (e.g. "Stage Three record still open," "Assignment 3 resubmission unresolved") shows as an amber note and an amber card border. Clicking a card opens that candidate's full portfolio (booklet, TPs, assignments).

### Right — four stacked panels
1. **Cohort documents** — grades report, course timetable, assignment briefs, tutor list/roles. All "Live" status, each with an "Open" action.
2. **On the day** (gold label) — the visit-day schedule: which TPs are observable and when (with Zoom link timing for online ones), the tutor meeting slot, and a count of candidates who requested to speak with the assessor.
3. **Centre documents** — centre authorisation certificate, candidate agreement/policies, application and selection notes, the most recent prior assessor report (kept here so it's never hunted for), and marking guidance (the centre's standardisation evidence, dated, for what counts as "met" per criterion).
4. **Not in this pack** — explicitly lists what's excluded and why: the assessor's own report (goes to Cambridge's own secure system, not here), staff chat (trainer-only, resets on the centre's schedule), trainee-only chat (a deliberate privacy boundary).

## Open questions (unresolved — ask the user, don't invent)
- Confirm the exact centre-level document list against what a real assessor visit requires.

## Resolved 16 Aug
- **Portfolio count is not size-scaled.** Unlike double-marking's sample (3/4/5 by cohort size), portfolio selection is a flat minimum of four plus fixed mandatory categories (everyone the assessor observes teaching, every Fail/potential-Fail, every withdrawn candidate) — see `build-spec.md` line 57. No centre-nomination step; the categories are the rule regardless of course size. The app proposes the mandatory set automatically; the admin picks the remainder (recommended: Pass A/potential Pass A candidates).
- **The observation link is the same link the trainees already use** for that specific TP session — no separate assessor-only joining link. Which TPs the assessor observes (typically the Fail/potential-Fail and Pass A/potential-Pass-A candidates from the portfolio selection above) is **decided in advance manually by the MCT**, not automated — the app surfaces the mandatory-category candidates as a starting point, but the actual observation schedule is the MCT's call.
- **Triage notification routing, "clear problems" lane.** Resolved: same rule as interview booking — goes to whoever's configured as interviewer for that course/intake, least-loaded this intake, admin can override to a named person. In-app flag, never a push (rule 18).

## Design tokens
Ink `oklch(23.5% 0.017 65)`, muted `oklch(51% 0.017 70)`, teal (action) `oklch(38% 0.072 195)`, gold (Pass A / on-the-day emphasis) `oklch(60% 0.11 70)`, red (Fail) `oklch(45% 0.16 27)`, amber (needs attention) `oklch(44% 0.1 68)`, silver (Pass B) `oklch(65% 0.008 90)`, card `oklch(99.2% 0.005 90)`, border `oklch(88% 0.016 82)`, page bg `oklch(92.5% 0.012 85)`. Fonts: Karla (UI), Newsreader (headings).
