# Centre Admin — full spec: roles, access model, and both tabs

Written 14 Aug 2026, for Claude Code. Repo: `ramysakr1-ux/celta-connect` @ `main`. Source: `Centre Admin.dc.html` (merged file: Overview / Roles / Import tabs; formerly two files, "Centre Admin" dashboard and "Admin Roles and Import").

## Role clarification
**Centre Admin and Course Admin are two separate roles with two separate logins.** `Course Admin.dc.html` is the CELTA main course tutor's own credentials to run their own course(s) — roster, groups, invitations, course settings; no money, no volunteers, no centre-wide view. This file, Centre Admin, is the broader, money-and-oversight role. Don't merge the two builds.

## Access model
- **Login + password for every role here, never a link.** Only assessors and volunteer students (external, one-time participants) use a tokenised link with no account — see `for-claude-code-entry-screens.md` and `for-claude-code-assessor-interface.md`. Every Centre Admin-family role signs in like a trainer, at `Entry.dc.html`.
- **Unbounded headcount.** Any number of people can hold Centre administrator, Centre manager, or Course administrator at one centre. Centre owner is meant to be rare — typically one person, the director — but nothing technically caps it.
- **Roles are invited, never self-selected.** The invitation itself carries the role; there is no screen anywhere that promotes an account. A forwarded invite link cannot create an administrator.
- **Two supported account shapes, both real, centre's choice per person:**
  1. **Separate login per role** — a person holding two roles (say, Centre manager and Course administrator) gets two separate accounts/invites and switches by signing into the other one. Clean audit trail: every action is unambiguously "as X."
  2. **One login, roles combine** — a single account can hold Centre manager + Centre administrator + Course administrator at once; permissions simply union together, no in-app switcher. Centre owner is the one exception: always its own separate account, since it exists as the rare emergency "way back in," not a daily-driver login layered onto someone's regular admin work.
- **The tutor-overlap rule (already a stated design rule, keep it)**: a Centre administrator who is also a registered tutor on a course gets that course's chat and grading as a tutor, on that course — the two role-sets never merge into one combined power. This is distinct from the Centre-Admin-family combination above.

## The four roles (Roles tab, `1a`)

### Centre administrator (teal)
The working role. Creates and edits courses, invites tutors/candidates/volunteers, sees and edits fees/deposits/payments, forms groups and publishes timetables, exports the assessor pack.
Cannot: use course chat (trainer-only, no admin exception), grade or mark anything, see lesson feedback or CELTA 5 records.

### Centre manager (gold)
Read-only across the whole centre. Built for someone who wants the numbers — enrolment, pipeline stage, fees/deposits/outstanding balances, completion figures — without being able to change anything. The restriction is structural, not a hidden permission check: edit/invite/chat buttons are simply absent from the UI, not present-but-blocked. Cannot see candidate work, feedback, or grades.

### Course administrator (muted/grey)
Everything a Centre administrator can do, scoped to a named list of courses rather than the whole centre — for a centre where different people run different intakes. Scope is a list of specific courses, not a date range or category; when someone leaves, their courses are reassigned individually, on purpose, so it's never silently orphaned. Cannot create new courses or change centre settings.

### Centre owner (red)
Full access to everything inside this centre, nothing outside it. Meant for the director, for when an administrator leaves without handing over, or a course ends up unowned. Can do everything a Centre administrator can, plus: see every course in the centre (never another centre), restore a deleted course within 30 days, reassign an unowned course, appoint/remove administrators. Still cannot grade, mark, or read course chat — those stay tutor-only even for the owner. Every owner action leaves a digital footprint (who, what, when) — visible logging, not silent senior access.

### Cross-cutting rules
- **Course chat is closed to every admin role, including the owner.** Tutors write candidly in a course channel because they know exactly who reads it; one admin exception ends that permanently.
- **Seeing a course you don't teach on is a trainer-to-trainer grant, never self-service.** E.g. a Centre owner who isn't an approved trainer never gets into feedback, tutorials, or CELTA 5 records — those need an approved-trainer grant from someone who already holds it (ultimately tracing back to the course's main tutor). Whoever opens a record this way leaves a trace: who looked, at what, when — and the grant itself (who gave it, on what basis) is on the record too.
- **Nobody at Connect (the platform) holds a key to any centre's data.** The owner's reach stops at the centre boundary; there's no cross-centre role. Platform support only gets in when a centre explicitly invites them, for a stated period, logged.

## Import tab (`1b`) — bringing in an existing spreadsheet
Four-step flow, tabs at the top, one working panel below:
1. **Connect the sheet** — Drive pick or drag-in `.xlsx`/`.csv`. Read-only access to the one chosen file, revocable immediately after import; nothing is written yet. It's a one-time read, not a live sync — the source file keeps working normally afterward.
2. **Match the columns** — Connect auto-guesses field mapping from headers (name/email/phone/deposit usually match automatically); a centre's own vocabulary (e.g. a custom "Status" column) needs a human decision on values. Columns can be explicitly skipped.
3. **See what happens** — a full dry-run preview before anything is created: import count, duplicates, rows missing required data (e.g. no email — can't be invited later), and ambiguous values inferred at a lower confidence, all flagged before commit.
4. **Afterwards** — imported people land as records only, nobody is emailed automatically (a silent bulk-invite on import is treated as the #1 risk to avoid). The whole import is undoable for 7 days provided nobody invited/paid since. Re-running the import matches on email and won't duplicate people already seen. The original spreadsheet is untouched and keeps working — most centres run both in parallel for a course or two.

## Overview tab — home screen content
Financial summary strip (collected this month, outstanding balance, deposits held, refunds pending), all courses across the centre grouped by admin/mode/balance/state, admissions pipeline stage counts, a payments-needing-attention list (e.g. missed instalments), and the volunteer pool with hours-toward-certificate progress accumulated across every course and level a volunteer has worked.

## Design tokens
Ink `oklch(23.5% 0.017 65)`, muted `oklch(51% 0.017 70)`, teal (Centre administrator / primary actions) `oklch(38% 0.072 195)`, gold (Centre manager / warnings) `oklch(60% 0.11 70)`, red (Centre owner / alerts) `oklch(45% 0.16 27)`, green (positive/matched) `oklch(48% 0.09 150)`, card `oklch(99.2% 0.005 90)`, border `oklch(88% 0.016 82)`, page bg `oklch(92.5% 0.012 85)`. Fonts: Karla (UI), Newsreader (headings). Header mark: current tile-lockup (interlocking Cs in a dark rounded-square tile), spinning slowly (54s loop, rotateY, `prefers-reduced-motion` respected) — matches `Connect Wordmark.dc.html`.
