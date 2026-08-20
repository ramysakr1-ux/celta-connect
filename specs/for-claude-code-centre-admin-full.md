# Centre Admin — complete spec, verified against live code

Verified directly against `preview/centre-admin-import` (commit `ac33a855eaa6`) on 2026-08-19. Replaces every prior Centre Admin spec — this matches the real implementation, not design intent.

## Role clarification
Centre Admin (`/centre`) and Course Admin (`/dashboard/admin`, own spec: `for-claude-code-course-admin.md`) are two separate roles/builds — never merge them. Routing (`getCentreRoleContext` / `landingFor`) sends centre-role holders to `/centre`, Course Admin holders to `/dashboard/admin`.

## Multi-branch, built in from the start
The Overview **aggregates across every centre (branch) the signed-in person holds a role at** — not just one. A `?branch=` query param narrows the view to one branch; it can never widen it beyond what the person's `centre_roles` grants actually cover. Reads go through the admin client because RLS's "my centre" resolves to exactly one centre and can't express "every branch I hold a role at" — authority is enforced explicitly via `ctx.availableCenterIds`, not implicitly via RLS. Course rows tag their branch name when more than one branch is in view; the branch always travels with the course name since a code is ambiguous across cities.

## Tabs — exactly three (`centre-tabs.tsx`)
**Overview**, **Roles**, **Import**, left-aligned under the header, in that order. Everything else reachable from within a panel (pipeline links to Admissions) or the Centre settings screen — not from the tab bar itself.

## The four roles — real capability strings, not just labels
Permissions are granular capabilities (`can()`/`canView()` against strings like `payments.view`, `admissions.view`, `volunteers.view`, `roles.grant`, `course.create`, `import.run`, `centre.settings.edit`), defined in `src/lib/auth/centre-permissions.ts`. The Roles tab's `RoleStrip` shows all four as equal segments; selecting one reveals its exact permission list and a closing rule, sourced from the design verbatim rather than paraphrased:

- **Centre administrator** (teal) — runs admissions, payments, course setup. Full yes on: create/edit courses, invite people, edit fees/deposits/payments, form groups, publish timetables, export the assessor pack. No on: course chat, grading, lesson feedback, CELTA 5 records.
- **Centre manager** (gold) — read-only everywhere a Centre administrator can act. "The absence of an edit button everywhere is the whole design" — restrictions are structural (buttons don't render), never a blocked click.
- **Course administrator** (grey) — scoped to named courses, not the whole centre; other courses show in outline/read-only. Cannot create a course or touch centre settings. Scope reassignment on departure is deliberately manual, not automatic — it forces someone to notice what was theirs.
- **Centre owner** (red) — restore a deleted course within 30 days, reassign an unowned course, appoint/remove administrators, full settings/payments/admissions/volunteers access with every action logged. Read-only on course administration itself, never grade/mark, and never gets into a course's own content without an invite from that course's main tutor. "Nobody at Connect holds a key to a centre's courses, and there is no role above this one."

## Overview tab — real content, confirmed
- Header actions, each gated on its own capability (so a Centre manager sees neither): **Export financials** (`payments.view`, downloads `/centre/financials.csv`), **Invite people** (`roles.grant`, links to Roles).
- **Four money metrics** (shown only with `payments.view`): Collected this month, Outstanding balance, Deposits held, Refunds pending — each with a supporting note; outstanding/refunds-pending turn red when non-zero.
- **All courses**, one list, branch-tagged when multi-branch, each row showing amount owed (or "Fully paid") and a state pill — **Running** (teal), **Upcoming** (gold — something's coming that needs preparing), **Closed** (grey, deliberately inert).
- **Email couldn't be delivered** — bounced-email tasks surfaced here (not just on the admissions screen), because a bounced workspace invitation to a paid-up candidate is the one nobody can afford to miss. Shows the provider's own bounce reason, never a status code; escalates to "Sending stopped" at 2+ consecutive bounces.
- **Admissions pipeline** (`admissions.view`) — stage counts, with a per-branch split beneath each stage when multiple branches are in view.
- **Payments needing attention** (`payments.view`) — missed instalments only, branch-tagged.
- **Volunteer pool** (`volunteers.view`) — grouped by linked `volunteer_person_id` (an unlinked volunteer is its own group of one), hours computed with the same `computeSessionTicks` math the per-course register uses, but summed across every course/level the person has worked. Auto-linked when a signup's email matches an existing record; otherwise linked manually — never guessed from name alone.
- **New course** button, gated on `course.create`, links to `/dashboard/admin` (Course Admin owns course creation).

## Import tab (`/centre/import`)
Gated on `import.run`; a Centre manager (also technically `admin`-flagged) is redirected to `/centre` even on direct URL access, not just hidden from nav.
- If the centre has no courses yet, the wizard doesn't render — an import needs a specific intake to land on.
- **`ImportWizard`** component handles column-mapping and dry-run preview; existing applicant emails are sent to the client (emails only, nothing else) so duplicate-flagging happens live as the admin maps, though the commit step re-checks server-side regardless.
- **Recent imports** list: filename, count imported, date, and an undo state — "undo until {date}" within the undo window, "undone" if already reverted, or "older than N days, now ordinary data" once the window's closed. `UndoImportButton` only renders while still undoable.
- The page's back-link reads "Back to centre admin" and points at `/centre` (fixed 2026-08-20 — it previously pointed at `/dashboard/admin`, Course Admin's route, a leftover from before the two roles were split into separate routes).

## Settings — platform support access (built)
This is the exact grant flow specced in `for-claude-code-platform-support-access.md`, now live in `centre/settings/support-access-tab.tsx`:
- support@celtaconnect.com has no standing access; every grant is time-boxed, scoped, and permanently logged — including declined or revoked ones.
- **This screen only grants billing scope** (fees, deposits, course setup, no course content) and only to those with `centre_administrator`/`centre_owner`. Course-scoped access (grades, marking, that course's timetable) is granted separately, from that course's own main tutor's screen — matching the original spec's scope-matched-granter design exactly.
- Required reason (free text) + duration (6h / 24h / 72h) fields, submit via `grantBillingSupportAccess`.
- **Access log**: every grant ever made for the centre, each showing scope, reason, granter, timestamp, duration, and status (Active/Expired/Revoked pill) — course chat inclusion flagged separately (`+ course chat`) since it's a rare, explicitly-approved exception. Active grants get a Revoke action.

## Access model
- **Login + password for every role here, never a link.** Only assessors and volunteer students (external, one-time participants) use a tokenised link with no account. Every Centre Admin-family role signs in like a trainer.
- **Unbounded headcount.** Any number of people can hold Centre administrator, Centre manager, or Course administrator at one centre. Centre owner is meant to be rare — typically one person, the director — but nothing technically caps it.
- **Roles are invited, never self-selected.** The invitation itself carries the role; there is no screen anywhere that promotes an account.
- **Two supported account shapes, both real, centre's choice per person**: separate login per role (clean per-role audit trail), or one login with roles unioned together (Centre owner is always its own separate account, the one exception).
- **The tutor-overlap rule**: a Centre administrator who is also a registered tutor on a course gets that course's chat and grading as a tutor, on that course — the two role-sets never merge into one combined power.

## Design tokens
Ink `oklch(23.5% 0.017 65)`, muted `oklch(51% 0.017 70)`, teal (Centre administrator / primary) `oklch(38% 0.072 195)`, gold (Centre manager / Upcoming state) `oklch(60% 0.11 70)`, red/destructive (Centre owner / alerts) `oklch(45% 0.16 27)`, green (positive) `oklch(48% 0.09 150)`, border `oklch(88% 0.016 82)`, card `oklch(99.2% 0.005 90)`, page bg `oklch(92.5% 0.012 85)`. "Running" previously used a pale green wash — retired 16 Aug 2026 in favor of teal, since green was too close to "positive/matched" elsewhere. Fonts: Karla (UI), Newsreader (headings), Instrument Serif italic (wordmark, gold). Header mark: dark rounded-square tile with interlocking Cs, spinning slowly (54s loop, rotateY, `prefers-reduced-motion` respected).

## Branding
Small mark + "Connect" wordmark at top; centered mark-icon-only + "Designed and built by Ramy" at bottom, via the shared `<DesignerCredit />` component — same position on every landing/home screen. Never on an exported or Cambridge-facing document.
