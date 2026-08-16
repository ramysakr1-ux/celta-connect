# Design handoffs — the current set

Every spec Ramy has sent, in one place and under version control. Copied in on
2026-08-16 after they'd been spread across four Desktop zips and a `specs/`
directory whose newest file was nine days old — which is how a session ended up
quoting an eleven-day-old note as current and building Centre Admin inside the
wrong chrome.

**Read from here, not from the Desktop.** If a newer bundle arrives, copy it in
and note what changed.

## Build specs

| File | Covers | State |
|---|---|---|
| `for-claude-code-centre-admin-full.md` | Centre Admin: four roles, access model, Overview + Import | **Built** — `/centre` |
| `for-claude-code-payment-provider.md` | Provider connection screen, five providers | **Built** — `/centre/payments`, list widened to nine |
| `for-claude-code-email-inventory.md` | 19 emails, AI triage lanes, bounce handling, assessor pack | **Barely started** — 5 of 19 emails; log built, delivery states not |
| `for-claude-code-compliance-audit.md` | 19 gaps against Cambridge documents | **Not audited** — 3 confirmed built, 16 unverified |
| `for-claude-code-trainer-homepage.md` | Trainer Today tab | **Built** |
| `for-claude-code-trainer-remaining-screens.md` | Trainer screens | **Built** (see the walkthrough sweep) |
| `for-claude-code-unified-tracking.md` | ARCHITECTURAL: one Roster column per trackable item | **Built** — binds all future work |
| `for-claude-code-timetable-tiles.md` | Timetable tile system | **Built** |
| `for-claude-code-supervised-review.md` | Supervised review sessions | **Built** |
| `for-claude-code-progress-tab.md` | Trainee Progress tab | **Built** (closed, no changes needed) |
| `for-claude-code-session-changelog-2026-08-15.md` | What shipped on 15 Aug | Reference |

## Design files (`.dc.html`)

These are prototypes in a template format that **does not render outside the
design tool** — served through a browser they show raw `{{ }}` placeholders.
Read the data arrays inside the `<script>` block instead; that is where the real
content lives (role permission lists, step definitions, sample rows).

`Centre Admin.dc.html`, `Payments.dc.html`, `Course Admin.dc.html`,
`Trainer Homepage.dc.html`, `Trainer Walkthrough.dc.html`

## Referenced but never received

The email inventory cites these as its sources. None has ever arrived, so where
it is terse there is reasoning we don't have:

- `specs/admissions-and-close-out.md`
- `specs/twenty-decisions.md`
- `specs/for-claude-code-interview-payments-email.md`
- `specs/review-notes.md`
- `specs/for-claude-code-announcements.md`
- `Course Emails.dc.html` — the actual email copy
- `Presentation.dc.html` — the fees slide

## Open decisions, flagged not guessed

- **Which tutor** gets the "clear problems" notification. The email inventory
  proposes the MCT as a reasonable default and explicitly says not to build a
  silent one.
- **Course administrator scope** has no UI — the schema holds "administers these
  named courses" but nothing assigns them.
