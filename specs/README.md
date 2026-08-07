# Connect — handoff to Claude Code

Everything in this folder is written against `ramysakr1-ux/celta-connect` @ `main`. Read in this order.

## What changed on 7 August 2026

If you have an earlier copy of these specs, these are the decisions made since:

- **The product is renamed to Connect.** `rename-to-connect.md` is new and locked. Do that pass first.
- **The identity is a tile lockup** — the unchanged mark inside a warm dark tile, gold word, one-line descriptor. The existing spin stays but slows to **90s**, applied to the SVG only, never the tile.
- **A new token, `--color-ink-warm`** `oklch(30% 0.042 58)`, for the tile, headings, primary buttons and ticked boxes on entry surfaces.
- **Green is gone as a *meaning*, not as a colour.** The pale teal-green `--color-accent` stays exactly as it is — hover washes, selected rows, the chat pill's chip, `.sheet-accent` entry cards. What goes is green as the success signal: `.pill-success` and `.status-pill-on-track` become ink on the neutral tint. **See `green.md` for the precise token-by-token list** — that file exists because the earlier one-line version of this was too vague to build from.
- **Five invitation flows, each with its own terms** — trainee, trainer, centre admin, assessor, volunteer. Accounts and terms on one card; assessors and volunteers accept instead of signing up.
- **Volunteer certificates are earned in hours, not levels or courses.** 90 minutes of Zoom presence earns a tick, a tick credits 2¼ hours, and the certificate sits at 160 hours.
- **Announcements are schedulable and duplicate with the course**, anchored to timetable events rather than dates, each with Post now.
- **The Resource hub replaces the Audio Library tab** and holds six sections.
- **Peer observation has a full model** — five note-takers, feedback-slot reveal, self-evaluations and group feedback written at once, notes kept out of the portfolio.
- **Prompts adapt to delivery mode** (face-to-face vs online) and **self-evaluation prompts resolve through a fallback chain** (lesson plan → TP point → stage criteria).
- **Four letters** — Fail, assignment warning, withdrawal, deferral — with derived signatories.
- **Bug 9 added**: the broadcast composer lives inside a candidate's portfolio and needs moving.
- The canonical trainer tabs are seven: **Today, Roster, Timetable, Volunteers, Teaching Practice, Resource hub, Grades Report**. Rotation and Coursebooks are routes under Teaching Practice, not tabs. The portfolio is reached from a roster row.

## Designs to build against

In the design project, all current:

| File | Covers |
| --- | --- |
| `Trainer Walkthrough.dc.html` | All seven trainer tabs plus rotation, portfolio and announcements |
| `Trainee Walkthrough.dc.html` | The candidate's five tabs, landing page first |
| `Invitations.dc.html` | Five invitation emails and their acceptance screens |
| `Letters.dc.html` | Fail, assignment warning, withdrawal, deferral |
| `Observations.dc.html` | Observation log and the peer observation sheet |
| `Volunteer View.dc.html`, `Volunteer Register.dc.html` | Volunteer side, both roles |
| `CELTA 5 Record.dc.html`, `Grades Report.dc.html`, `Assessor Visit.dc.html` | Assessment and the visit |
| `Assignment Review.dc.html`, `Lesson Plan.dc.html`, `TP Record.dc.html`, `Forms.dc.html` | Marking and the TP loop |
| `Resource Hub.dc.html`, `Course Close-out.dc.html`, `Centre Admin.dc.html`, `Demo Links.dc.html` | Material, lifecycle, admin |
| `Connect Wordmark.dc.html` | The locked identity |

Older files still on the pre-rename palette: `Resource Hub.dc.html`, `App Redesign.dc.html`, `Timetable Refresh.dc.html`. Take their structure, not their colours.

## Whose brand appears where

**Connect brands the software. The centre brands the paper.**

- **In the app** — the tile lockup, top left of every screen. This is Connect's surface.
- **In invitation emails** — the tile lockup, because the recipient is being invited into Connect and needs to recognise it. Subject line still leads with the centre.
- **On every document that leaves the system** — letters, cover sheets, CELTA 5, reports, certificates, the assessor pack — **the centre's logo and name, and no Connect mark at all.** These are the centre's documents, submitted to Cambridge or handed to candidates; platform branding on them is both wrong and presumptuous.

So each centre uploads its logo at setup, alongside its name and address, and every generated document carries it. Where no logo has been uploaded, print the centre's name in the same position rather than falling back to a Connect mark.

The one exception is the designer credit line (`Connect · designed and built by Ramy`), which appears in the Centre Admin and sign-in footers only — never on a document.

## The specs

**0. `green.md`** — exactly which greens go and which stay, token by token. Short; read it before touching any status pill.


**1. `rename-to-connect.md`** — do this first, in one pass, before any feature work.
The product is renamed from *Connect CELTA* to **Connect**. Branding only: no routes, data, or behaviour change. Includes the new tile lockup (mark in an ink square, gold word, one-line descriptor), the find-and-replace table, and — critically — the list of CELTA references that **must not** be renamed, because they name Cambridge's own artefacts (`CELTA 5`, the Administration Handbook, syllabus criteria, `celta5` tables).

The domain stays `celtaconnect.com`. The brand is Connect; the domain is a legacy address. The spec explains how to keep the two from fighting.

**2. `apply-to-app.md`** — the token mapping, plus detailed specs for the chat pill and the timetable finish.
The chat pill replaces the current `StaffChatDrawer` chrome: always visible, dimmed at rest, keyboard-reachable. The timetable keeps its transposed orientation and equal cell dimensions; only the finish changes — hairlines instead of coloured boxes.

**3. `build-spec.md`** — everything else.
Constraining rules from Cambridge's syllabus and handbook, build order for 22 screens, the Drive import/export model, the three leaving statuses, the guidance system, mobile scope, eight bugs found in the current build, and three genuinely open questions.

## What the designs are

The `.dc.html` files in the design project are **references, not production code**. Recreate them in Next.js/Tailwind using the app's existing patterns. Lift exact values — colours, spacing, type sizes, SVG path data — but do not copy the files.

## Rules worth reading twice

These came out of long conversations with Ramy and are not recoverable from the screens:

- A TP group splits into **halves of three teaching on alternate days**. Rotation is derived from a base order, never stored per round.
- A withdrawn candidate **leaves an empty slot**. Nobody else moves.
- **Observation is not transferable.** A tutor may not mark a lesson they did not watch.
- Assignment criteria are **data, imported from the centre's own cover sheets**. Never hardcode them.
- A candidate must pass **3 of 4** assignments. **One resubmission** each.
- Provisional grades with a **slash** (Fail/Pass, Pass/Pass B, Pass B/Pass A) mean undecided, and block finalisation until a written justification exists.
- **Warning letters are generated by state** — a Fail/Pass provisional, or one failed assignment. Nobody reaches a final grade without having been warned in writing.
- **Double-marking** is required by cohort size: 3 of each assignment up to 9 candidates, 4 up to 16, 5 up to 24, always including any fails.
- The **entry form date** is a gate. Before it, a withdrawal is internal; after it, a reportable outcome.
- The **timetable is the clock.** TP dates, deadlines, resubmission dates, "this week" — everything derives from it. Lock it before assigning rounds.
- Chat resets at **local midnight**, every channel, no exceptions.

## Still open — ask Ramy

1. Do carried TPs count toward the six assessed hours on a deferral's new course?
2. Retention and consent position for **rejected applicants**, whose files the assessor requires but who never signed anything.
3. Which storage holds the CELTA 5 — it is explicitly *not* the course Drive folder.

## Not yet designed

- The leaving flow as a single screen (withdrawal / deferral / extension with the entry-form gate)
- The attendance register in the assessor pack
- Conflated assignments — two briefs as one document, both parts passing independently
