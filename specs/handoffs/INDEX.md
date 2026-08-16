# Design handoffs — where the specs live

**`specs/*.md` is the source of truth.** The complete set (43 files) landed on
2026-08-16 and is version-controlled. Read from there, not from the Desktop.

This folder holds only what doesn't belong alongside them:

- **`.dc.html` design files** — prototypes in a template format that **does not
  render outside the design tool**. Served through a browser they show raw
  `{{ }}` placeholders. Read the data arrays inside the `<script>` block
  instead; that's where the real content lives (role permission lists, step
  definitions, email copy, sample rows).
- **`compliance-audit-findings.md`** — our per-item verdicts against
  `specs/for-claude-code-compliance-audit.md`, written 2026-08-16.

## Why this folder exists at all

Before 2026-08-16 the specs were spread across four Desktop zips and a `specs/`
directory whose newest file was nine days old. Only two handoffs had ever been
committed. That scattering cost a full morning: a session quoted an eleven-day-
old note as current work, and Centre Admin was built inside the wrong chrome
because its layout spec hadn't arrived. The design team believed everything was
already on GitHub; it wasn't.

If a newer bundle arrives, copy it into `specs/` and note what changed.

## Design files and the specs they belong to

| Design file | Written spec |
|---|---|
| `All Emails.dc.html` | `for-claude-code-email-inventory.md` |
| `Email Delivery.dc.html` | same |
| `Interview Availability/Booking/Questions.dc.html` | `for-claude-code-interview-payments-email.md` |
| `Centre Admin.dc.html` | `for-claude-code-centre-admin-full.md`, `centre-admin-layout-design-spec.md` |
| `Payments.dc.html` | `for-claude-code-payment-provider.md`, `for-claude-code-payments-bridge.md` |
| `Course Admin.dc.html` | `for-claude-code-course-admin.md` |
| `Trainer Homepage/Walkthrough.dc.html` | `for-claude-code-trainer-homepage.md`, `-remaining-screens.md` |
| `Course Commitments`, `Filming Consent`, `Volunteer Sign-Up Desktop` | no written spec yet |

## Superseded in the repo by the complete set

`build-spec.md` grew 698 → 1252 lines and was restructured (11 sections → 24
plus a long tail). New sections cover ground built on 2026-08-16 from other
specs — **admin roles, organisations with more than one branch, sharing between
branches, importing an existing spreadsheet** — so what shipped that day should
be reconciled against them before more is built on top.

`README.md`, `chat-pill-and-timetable.md`, `design-files.md` and
`for-claude-code-unified-tracking.md` were also updated. `dry-run.md` and
`rename-to-connect.md` exist only in the repo and were kept.
