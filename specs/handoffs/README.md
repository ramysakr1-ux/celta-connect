# Handoff: Centre Admin — Import tab

## Overview
The Import tab (screen `1b` in `Centre Admin.dc.html`) lets a Centre administrator bring an existing spreadsheet of people (candidates/tutors/volunteers) into Connect. This is a scoped handoff for that one screen/flow — see the full `design_handoff_centre_admin/` package for the rest of Centre Admin (Overview tab, four roles).

## About the Design Files
`Centre Admin.dc.html` is a design reference built in HTML — a high-fidelity prototype, not production code to copy directly. Recreate in the target codebase (repo: `ramysakr1-ux/celta-connect`, branch `main`) using its existing components/patterns. The Import tab is reached via the in-page tab control on that file (Roles / Import), screen id `1b`.

## Fidelity
High-fidelity. Colors, typography, spacing, and copy are final.

## Flow — four steps, tabs at top, one working panel below

### 1. Connect the sheet
Google Drive picker or drag-in `.xlsx`/`.csv`. Read-only access to the one chosen file, revocable immediately after import — nothing is written yet. One-time read, not a live sync; the source file keeps working normally afterward.

### 2. Match the columns
Connect auto-guesses field mapping from headers (name/email/phone/deposit usually match automatically). A centre's own vocabulary (e.g. a custom "Status" column) needs a human decision on values. Columns can be explicitly skipped.

### 3. See what happens
Full dry-run preview before anything is created: import count, duplicates, rows missing required data (e.g. no email — can't be invited later), and ambiguous values inferred at lower confidence — all flagged before commit.

### 4. Afterwards
Imported people land as **records only** — nobody is emailed automatically (a silent bulk-invite on import is the #1 risk to avoid; inviting is a separate, deliberate action later). The whole import is **undoable for 7 days**, provided nobody has been invited or paid since. Re-running the import **matches on email** and won't duplicate people already seen. The original spreadsheet is untouched and keeps working — most centres run both in parallel for a course or two.

## Design Tokens
- Ink: `oklch(23.5% 0.017 65)`
- Muted: `oklch(51% 0.017 70)`
- Teal (primary actions): `oklch(38% 0.072 195)`
- Gold (warnings): `oklch(60% 0.11 70)`
- Red (alerts, e.g. duplicates/missing data): `oklch(45% 0.16 27)`
- Green (positive/matched): `oklch(48% 0.09 150)`
- Card: `oklch(99.2% 0.005 90)`
- Border: `oklch(88% 0.016 82)`
- Page background: `oklch(92.5% 0.012 85)`
- Fonts: Karla (UI), Newsreader (headings)

## Interactions & Behavior
- Linear 4-step wizard — each step gates the next until required data is resolved (e.g. can't proceed past column matching until required fields are mapped or explicitly skipped).
- Step 3's dry-run is a hard gate: nothing is written to the database until the user commits from this preview.
- No auto-invite on import, ever — this is a stated risk to guard against, not just a default.
- Undo (7 days) and re-run dedup (match on email) are backend behaviors to implement, not simulated in the prototype — flag clearly to backend/API work.

## Assets
No external images. No icon library beyond inline SVG/CSS.

## Files
- `Centre Admin.dc.html` — full file; Import tab is screen `1b` inside it.
- `for-claude-code-centre-admin-full.md` — full source spec, Import section under "Import tab (`1b`)".
