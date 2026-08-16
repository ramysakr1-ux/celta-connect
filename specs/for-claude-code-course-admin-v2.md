# Course Admin.dc.html — full design spec

## Tokens
Karla (400–700, UI), Newsreader (500/600, headings). Ink `oklch(23.5% 0.017 65)` · muted `oklch(51% 0.017 70)` · warm dark `oklch(30% 0.042 58)` (headers, banners) · teal/accent `oklch(38% 0.072 195)` (primary actions, links) · gold `oklch(60% 0.11 70)` (attention/callouts) · bronze `oklch(50% 0.09 62)` · red `oklch(45% 0.16 27)` · card `oklch(99.2% 0.005 90)` · border `oklch(88% 0.016 82)` · page `oklch(92.5% 0.012 85)` · outer section bg `oklch(96.4% 0.014 85)`. No green anywhere in this file — the one instance (a "centre number set" callout) was corrected to the warm dark tone.

## New-course wizard (6 steps, identical card+sidebar layout: 1.15fr form card / 1fr sidebar notes, 20px gap)
Each step: eyebrow "New course · [centre] [code] · step N of 6", Newsreader 22px title, muted description, then fields, then a teal "Continue to [next]" button. Sidebar holds 1–2 note cards explaining what's locked, deferred, or downstream.

1. **Course details** — Cambridge centre number (locked, prefilled), course code, internal course name, start/end dates, max cohort size. Sidebar: tutors are assigned later on the roster, not here; centre number is locked (set in Centre Admin).
2. **Delivery mode** — 3 radio-style cards (defined by where TP happens, not input) with a live "impact" panel showing downstream effects of the picked mode.
3. **Dates and timetable pattern** — weekday input start time, TP block start time, days-off pill selector, and a gold callout: confirming here generates timetable tiles automatically (28 tiles typical for a 4-week course) — tiles can be moved individually afterward without altering the pattern.
4. **Capacity and pricing** — course fee, deposit, deposit-due window, payment provider (Stripe only — sidebar flags PayPal/others as unbuilt, per the payment-provider spec).
5. **Assign tutors** — single email + role dropdown (reusing the roster's role-invite control) to guarantee a Main Course Tutor exists before launch; "Skip — I'll assign a tutor later" escape hatch.
6. **Review and launch** — a locked summary table (course / delivery / capacity / tutors) + "Launch course" (bold teal) / "Back to edit". Sidebar: launching moves the course to Centre home under "Open" and activates its Invitations panel.

## Centre home (1a)
Courses grouped by state (Open / In progress / Closing / Archived), each a row card: name, code, dates, mode chip, cohort-fill bar, tutor avatars, status pill. Density toggle (compact/comfortable/airy) controls row padding globally.

## Course workspace — Invitations (1b)
Two invite paths, stacked in one panel:
1. **Invite a tutor by name** (new) — email field, role dropdown (Main Course Tutor / Assistant Course Tutor / TP Tutor / Input Tutor / Assessor (if known)), "Send invite as [role]" button. The role travels with the invite; changeable later from the roster.
2. **Or share a general link** — the original candidate-link and tutor-link cards (Copy / Email it / Regenerate), unchanged, for bulk/self-serve joining.

## Roster (1b, table below Invitations)
Rows for tutors and candidates together. Tutor rows: name/email + a clickable role pill (teal text, caret) — opens a dropdown of the same 5 roles; picking one reassigns immediately, highlighted bold+tinted if current. Candidate rows: plain "Candidate" label, not clickable. Right-aligned status pill (Joined/Invited).

## Centre material, chat, other tabs
Centre material: TP points library, resource hub, etc. — card grid, unchanged from prior spec. Tutors ↔ centre admin chat channel: retention toggle (nightly reset / custom days), unchanged.

## Source
`Course Admin.dc.html` — full working file included.
