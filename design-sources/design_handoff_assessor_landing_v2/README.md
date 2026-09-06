# Handoff: Assessor landing — v2, the candidate wall

## Overview
Redesign of the assessor's landing page (`/assessor`, token-gated, read-only). Built for the two or three days before the visit: the candidate wall on the left is the reading list, grouped in Handbook order with one sentence per card on why the portfolio is on the list; the rail on the right carries the pack, the day, and what the Handbook asks. No dashboard figures, no banners, no dark header. Brown ink on paper.

## About the design file
`Assessor Landing v2.dc.html` is a design reference in HTML, not production code. Open beside `support.js`. Rebuild in `ramysakr1-ux/celta-connect` on the existing `src/app/assessor/page.tsx` data (`assessor-pack-contents.ts`, `assessor-requirements.ts`, `appian-reference.tsx`).

## Fidelity
High on layout, grouping rules, copy, colour, type. Names, grades, dates, pack states are sample data. 12 candidates shown (7 selected + withdrawn by default; toggle shows all 12).

## Page frame
Paper card `oklch(97.5% .008 88)`, 1px border, radius 6, 1440 wide (fluid in build: `max-width`, wall wraps to 2 columns under ~1200, rail stacks under ~900).

**Header** (padding 22/32/0): row — Instrument Serif italic "Connect" brown `oklch(30% .042 58)` · pill `ASSESSOR · READ-ONLY` (brown text, 1px `oklch(80% .03 70)` border) · 11.5px muted "Nothing you open here is recorded against a candidate. Link works until 14 Dec." Below: Newsreader 36px/500 "International House Istanbul · CELTA, November 2026" · 13px muted context line (dates, count, tutors, visit date and days out).
Right: **Open Appian ↗** (brown fill, paper text) · **Download whole pack ↓** (outline) · under them 11.5px "Course notification `CN-2026-11-TR0412-07` Copy" (mono).

**Body** grid `minmax(0,1fr) 340px`, padding 24/32/32. Wall has right padding 32 + 1px right border; rail has left padding 28.

## Candidate wall
Sections in this fixed order; a section is omitted when empty:
1. **You will watch these two teach** — candidates on the day's TP schedule. Note: "TP7 · Group A · one portfolio of the two must be read". Card top edge brown.
2. **Fail or potential Fail** — provisional Fail or Fail/Pass, not already in 1. Heading red `oklch(45% .16 27)`, note "read before anything else". Card top edge red.
3. **Potential Pass A** — provisional Pass A. Note "recommended".
4. **The centre's selection** — remaining selected candidates.
5. **Withdrawn** — muted heading, cards at 70% opacity.
Section heading: Newsreader 18px/600 + 12px muted note (defaults to "n candidates"). Cards grid `repeat(3, 1fr)`, gap 12.

**Card** (white, 1px border, radius 6, padding 14/16/12, 3px inset top edge per section, hover border brown; whole card links to the portfolio):
- Newsreader 19px/600 name + 11px `Group A` · grade pill right (22px, 10.5px/700): Pass A gold 20% tint / `oklch(40% .09 68)`; Pass B `oklch(93% .012 85)`; Pass `oklch(95% .008 85)` muted; Fail and Fail/Pass red 14% tint / red; Withdrawn no fill.
- Why line 12px, min-height 34px, one sentence from the section (observe: "Teaching while you are here. Read this one in full." · fail: "Potential Fail. The Handbook asks you to read borderline cases first." red · passA: "Tutors expect Pass A. Worth reading to confirm the standard." amber · centre: "Put forward by the centre." muted · withdrawn: "Withdrew 18 Nov. Check the letter and the application.") plus an appended completeness issue when present ("CELTA 5 stage 2 not signed."), then the whole line goes amber.
- Footer (hairline top): three dots + labels `CELTA 5 · TPs · Assign.` (ink = complete, amber = incomplete; tooltip explains) · right `TP 6/8`.

Wall footer 11.5px: "7 of 12 put forward by the centre. The final selection is yours, in consultation with the centre (§15.1)." · right **View the whole cohort / Back to the selection**. Full cohort adds the unselected candidates into section 4.

## Rail
All rail headings: 10px/700 uppercase brown, 0.11em tracking.
- **The pack** — right 11px status "14 of 16 in · 1 missing · 1 on the day" (amber when anything missing). One line per document: 10px square (ink filled = in, amber 35% = partial, hollow amber border = missing, hollow grey = later) · 12px name (amber when missing) · 10.5px meta right. Hairline dividers. Rows link to the document. Order: cohort documents then centre documents (from `assessor-pack-contents.ts`).
- **Monday 30 November** — right link "Course timetable →". Rows `44px 1fr`: 11px time · 12px title (600 for TP lessons, 400 otherwise) · 10.5px sub. Footer 10.5px "Which two you observe is decided on the day. Lesson plans are handed over as each lesson starts."
- **What the Handbook asks of this visit** — Show/Hide (default shown). Seven items: 12px/600 label + §cite right · 11px detail (red when the detail is course-specific and urgent, e.g. "2 are potential Fail on this course — read those.").
- **Also on file** (hairline top): Malpractice this course · Provisional grades · Input schedule — label muted, value as link.

## Rules
- Grouping is computed from: day TP schedule (observe), provisional grade (Fail, Fail/Pass, Pass A), centre selection flag, withdrawal.
- Completeness dots: CELTA 5 signed through the current stage; every taught TP has published feedback; every submitted assignment marked (resubmissions included).
- Pack states: `in` (uploaded), `part` (partially complete, e.g. grade form), `missing` (requested, not uploaded), `later` (provided on the day). Missing items are the centre's to add; nothing app-generated is in the pack.
- Requirements text comes from `assessor-requirements.ts`; the course-specific numbers (Fail count, meeting requests) are interpolated.
- On the visit day the header context line reads "your visit is today"; no other layout change.

## Tokens
Ink `oklch(23.5% .017 65)` · Muted `oklch(51% .017 70)` · Brown `oklch(30% .042 58)` · Gold `oklch(60% .11 70)` · Amber `oklch(44% .1 68)` · Red `oklch(45% .16 27)` · Paper `oklch(97.5% .008 88)` · Card `oklch(99.2% .005 90)` · Border `oklch(88% .016 82)` · Links teal `oklch(38% .072 195)`. Karla UI, Newsreader headings, Instrument Serif italic wordmark, ui-monospace for the Appian reference.

## Files
- `Assessor Landing v2.dc.html` — the design (needs `support.js`).
- `support.js` — runtime.
- `for-claude-code-assessor-landing-v2.md` — build spec.
- `Assessor Visit.dc.html` — the earlier design of this page, superseded.
