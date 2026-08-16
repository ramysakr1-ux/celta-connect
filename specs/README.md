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

## Also decided on 7 August, after the first handoff

- **Application and selection is a full area now**, not uploaded documents: pipeline, applicant file, marking scheme, an AI reading, a public centre-branded form on a per-centre subdomain, and six reply emails.
- **Payment stays outside the app.** The offer email names the fee and points at the centre office; a tutor ticks "fee paid".
- **The pre-course task** is Cambridge's 2018 edition, served as-is, with a centre supplement for online teaching and the use of L1.
- **`green.md` is new** and supersedes the one-line "green is gone" note.

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
| `Applications.dc.html` | Application pipeline, applicant file, public form, six reply emails |
| `Connect Wordmark.dc.html` | The locked identity |

Older files still on the pre-rename palette: `Resource Hub.dc.html`, `App Redesign.dc.html`, `Timetable Refresh.dc.html`. Take their structure, not their colours.

## Whose brand appears where

**Connect brands the software. The centre brands the paper.**

- **In the app** — the tile lockup, top left of every screen. This is Connect's surface.
- **In invitation emails** — the tile lockup, because the recipient is being invited into Connect and needs to recognise it. Subject line still leads with the centre.
- **On every document that leaves the system** — letters, cover sheets, CELTA 5, reports, certificates, the assessor pack — **the centre's logo and name, and no Connect mark at all.** These are the centre's documents, submitted to Cambridge or handed to candidates; platform branding on them is both wrong and presumptuous.

So each centre uploads its logo at setup, alongside its name and address, and every generated document carries it. Where no logo has been uploaded, print the centre's name in the same position rather than falling back to a Connect mark.

The one exception is the designer credit line (`Connect · designed and built by Ramy`), which appears in the Centre Admin and sign-in footers only — never on a document.

## Read this first: `foundation-audit.md`

Five problems in the current schema, two of them expensive to fix later. It carries the exact instruction to act on. Nothing else in this folder matters as much — a screen built on the wrong grouping model has to be rebuilt.

## Which design files to build from

**Read `design-files.md` first.** Twenty-odd designs were built across several sessions, and some are superseded explorations. That file lists which is current and which to ignore — building from a stale one is the failure mode that already happened once.

All design files are now on the current branding ("Connect", never "Connect CELTA") and the current palette (no green as a success colour).

## The specs

**0. `green.md`** — exactly which greens go and which stay, token by token. Short; read it before touching any status pill.


**1. `rename-to-connect.md`** — do this first, in one pass, before any feature work.
The product is renamed from *Connect CELTA* to **Connect**. Branding only: no routes, data, or behaviour change. Includes the new tile lockup (mark in an ink square, gold word, one-line descriptor), the find-and-replace table, and — critically — the list of CELTA references that **must not** be renamed, because they name Cambridge's own artefacts (`CELTA 5`, the Administration Handbook, syllabus criteria, `celta5` tables).

The domain stays `celtaconnect.com`. The brand is Connect; the domain is a legacy address. The spec explains how to keep the two from fighting.

**2. `apply-to-app.md`** — the token mapping, plus detailed specs for the chat pill and the timetable finish.
The chat pill replaces the current `StaffChatDrawer` chrome: always visible, dimmed at rest, keyboard-reachable. The timetable keeps its transposed orientation and equal cell dimensions; only the finish changes — hairlines instead of coloured boxes.

**3. `build-spec.md`** — everything else, in five parts: **A** the course as candidates and tutors meet it, **B** centre administration, **C** who can talk to whom, **D** the interface, **E** what is broken or undecided.
Constraining rules from Cambridge's syllabus and handbook, build order for 22 screens, the Drive import/export model, the three leaving statuses, the guidance system, mobile scope, nine bugs found in the current build, and three genuinely open questions.

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

1. ~~Carried TPs and the six hours?~~ **Answered:** no carry-over. The candidate redoes the whole second half of the new course regardless of whether she'd reached 50% or 60% on the old one — the app does not credit TPs done past halfway. The app defaults to hours already assessed and lets a tutor change it with a note.
2. Rejected applicants stay in the applications area and the assessor sees all of them. Narrowly still open: **how long is the file kept, and what does the application form tell them when they apply?**
3. ~~Which storage holds the CELTA 5?~~ **Answered:** blank original in the Resource hub as the centre's reference copy; the working record is the built-in CELTA 5; the completed, signed version exports at close-out.

## Not yet designed

Specified in `build-spec.md` but never drawn. Build from the prose.

- **Extension** — a candidate with special consideration finishing after the end date. Reuses the deferral shell in `Letters.dc.html` with three fields changed.
- **Tutorial records as working forms** — Stage 1, 2 and 3. Parked deliberately: they are CELTA 5 sections, and blank PDFs cover them for now. Stage 3 is the one to build first, since the Fail letter quotes it.
- **The attendance register** in the assessor pack.
- **Conflated assignments** — two briefs as one document, both parts passing independently.
- **Plagiarism and malpractice** — an allegation, an investigation, an outcome. No home in the app today, and an assessor will ask.
- **Appeals and complaints** — the candidate's form and the centre's written response. Handbook 15; currently an uploaded PDF with nowhere for the response to live.
- **Grade query reply** — the explanation a tutor sends when a candidate asks why they got a Pass and not a Pass B. Generated from the record (TP outcomes, criteria met, assignments, tutorials, letters, the slash justification), edited and signed by a person, never sent automatically. Specified in `build-spec.md`; answering these well ends most of them before they become appeals.
- **Special consideration mid-course** — distinct from the declaration at application.
- **The centre's pre-course supplement** — six to eight tasks on teaching online and the use of L1.


`twenty-decisions.md` — the short version of the build spec: the decisions that are easy to reverse by accident and expensive to discover late. Read before `build-spec.md`.
