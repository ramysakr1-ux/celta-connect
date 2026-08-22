# Role-tinted backgrounds — final spec for Code (v2, replaces the last one)

Written 22 Aug 2026, for Claude Code. Supersedes `for-claude-code-role-tinted-backgrounds-final.md`
and everything before it (`for-claude-code-revert-background-darkening.md`,
`for-claude-code-systemic-contrast-fix.md`, `for-claude-code-command-center-visual-fix.md`).
Read this one — it carries the final decision after live comparison.

## What happened
A prior request made the app's background darker/warmer everywhere (`Visual Refresh.dc.html`,
superseded, kept as history). It made every card blend into the page — confirmed on
`/centre` (Centre overview), `/platform/command-center`, `/dashboard/admin` (Course Admin —
Courses, Coursebooks, Resource Hub). Fix: a background tint per role/area (four values, not
one), with card color and the full status-color system (teal/gold/amber/red) unchanged
everywhere.

## The four backgrounds

| Area | Background |
|---|---|
| **Inside the course** (trainee/tutor/TP/assignments day-to-day, and the Assessor view — same background, it's viewing the same content) | `oklch(85% 0.045 75)` — golden sand |
| **Centre Admin** | `oklch(82% 0.025 235)` — slate-blue |
| **Course Admin** (the MCT's own course setup/roster — a separate role from Centre Admin, see `specs/Course-Admin-Complete-Spec.md`) | `oklch(80% 0.03 108)` — warm olive |
| **Volunteer / Student** | `oklch(80% 0.03 335)` — dusty plum |

## Card color (all four areas, same value)
`oklch(97.8% 0.014 85)` — warm ivory. Not white, not the near-white `oklch(99.2% 0.005 90)`
used before. This one card value sits on all four backgrounds above with clear separation —
confirmed by side-by-side comparison, not a guess.

Borders/hairlines: `oklch(89.5% 0.012 82)` in all four areas.

## Why per-role, not one background
Confirmed with the user this reads as "which room you're in," layered under, not replacing,
the existing status-color meaning (teal = positive/primary/met, gold = system rule/Pass A/live
indicator, amber = needs attention, red = blocking). That system is unchanged and applies
identically inside all four backgrounds — do not let any area's tint bleed into a status pill,
button, or badge color.

## The Command Centre screen (`/platform/command-center`)
Two additional changes, beyond using the Centre Admin tint above:
1. **Drop the "PLATFORM · every centre at a glance" eyebrow label.** Replace with a personal,
   time-of-day greeting plus a one-line plain-language recap, e.g. an eyebrow of the current
   date, an `<h1>` reading "Good morning/afternoon/evening, [owner's first name]", and a
   subhead summarizing state in plain words (e.g. "4 centres running, 2 renewals due this
   week, nothing needs you right now"). This replaces a cold system label with something that
   feels like it's welcoming the owner, not labeling a page.
2. Everything else about this screen (KPI strip, per-centre list, per-product breakdown,
   payments section) is unchanged from the existing Command Center spec
   (`for-claude-code-command-center-belongs-in-connect.md`) — this only touches background
   tint and the top-of-page greeting.

## Implementation
Token-level, not per-page: whatever central place defines page background per route/role
should carry the four values above, keyed to the same role boundaries used elsewhere in the
app (Centre Admin routes, Course Admin routes, in-course routes incl. Assessor, Volunteer/
Student routes, and Command Centre using the Centre Admin tint). Card, border, and all status/
accent colors stay as single shared tokens across all four — only the page background token
varies by role.

## Verify after
Re-check `/centre` (Centre overview), `/dashboard/admin` (Course Admin), the in-course
trainee/tutor/TP screens, the Assessor view, Volunteer/Student pages, and
`/platform/command-center` — confirm each shows its assigned background with warm-ivory cards
now visibly separating from it (not blending, as in the screenshots that prompted this), and
that the Command Centre greeting reads as a welcome, not a label.
