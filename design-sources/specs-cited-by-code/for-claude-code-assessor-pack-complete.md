# Assessor pack — complete spec for Claude Code (15 Sep 2026)

Read against `ramysakr1-ux/celta-connect@main` (tree e6f3019d5d4a): `assessor/page.tsx` (the pack), `assessor/{application-files,assignment-titles,double-marking,lesson-plans,marking-guidance,gate}/page.tsx`, `portfolio/[traineeId]/assessor-landing.tsx` (a candidate's portfolio as the assessor sees it), `components/assessor-readonly-banner.tsx`, and the assessor branches already read in `trainer/(hub)/layout.tsx`, `trainer-tabs.tsx`, `timetable/page.tsx`, `volunteers/page.tsx`, `portfolio/[traineeId]/layout.tsx`. Design reference: `Assessor Landing v2.dc.html`.

Not read: `appian-reference.tsx`, `candidate-wall.tsx` and the rest of the MCT-side `/trainer/assessor` tab (that is the trainer's tab, audited under the hub), the pack PDF route. The pack's own `page.tsx` is 85KB and was read to the candidate grid; the cohort/centre document panels and the visit-day panel were read via search only.

Severity: **A** wrong or rule broken · **B** inconsistency · **C** polish.

---

## Part 1 · What stays

- **Identity.** Ink-warm header with a 3px gold rule, gold wordmark, "Assessor · read-only" pill, the day bar in gold, Open Appian + Download whole pack. The assessor is the third role colour (ink-warm + gold) and it is applied consistently across the pack, the read-only banner and the BackLink pill. Keep.
- **Read-only banner.** Sticky, ink-warm, "Read-only" gold tag, context sentence, two-step way out (candidate's portfolio → pack) with the app's gold BackLink pill. Correct after the 30 Aug fix.
- **Candidate portfolio landing** (`assessor-landing.tsx`): four figures, special-arrangements strip (arrangements, never the reason), numbered cards in Handbook 12.1.1 order with the visit-day plan lifted out, three secondary pills, withdrawal letter for a withdrawn candidate. This is Ramy's 30 Aug spec built as spoken. Keep.
- **Sample logic.** Three states (centre chose a sample / nobody chosen / everyone chosen), full cohort one click away, never a restriction. Keep.
- **Rules built as data**: requirements panel from `assessor-requirements.ts` with Handbook §, double-marking count that scales with cohort, Appian reference card with the grade-form state, grading meeting rendered only into the assessor's own view and never stored. Keep.
- **Laptop-only note** rather than a phone rebuild. Ramy's call, keep.
- **The rail is dropped for an assessor inside a portfolio** ("it should be the whole page"). This is the first working instance of the "viewer's own shell" rule; keep.

## Part 2 · Fix (A)

**A1 · Two different page heads across the pack's own sub-pages.** The pack (`assessor/page.tsx`) uses Newsreader 28/600 with an 11/700/0.1em eyebrow inside `.frame`. Its five sub-pages (application files, assignment titles, double-marking, lesson plans, marking guidance) use `fontFamily: "Georgia, serif"` 26/600 h1 and Georgia 19/600 h2 — Georgia, not Newsreader. The gate page uses Tailwind `font-serif text-2xl`. Three fonts for one role. All assessor heads: Newsreader, 26/600 title, 11/700/0.1em eyebrow, in `.frame`. Make it one `AssessorHead` and use it on the pack and every sub-page.

**A2 · Progress still labelled in the assessor banner.** `PATH_LABELS` carries `/portfolio/[id]/progress → "Progress"`. The route is being retired (trainee spec A2). Remove the label once the redirect lands so the banner never says "You're viewing X's progress".

**A3 · Hover on assessor cards uses `assessor-hover-fill` on the candidate grid but `assessor-hover` on the portfolio landing cards and pills.** Both open a record; one is a fill, the other a ring. Same rule as both other shells: one hover for "this opens". Use the ring (`assessor-hover`) everywhere; fill is for buttons.

**A4 · Trainer-side link into the assessor route.** Already filed on the trainer side (hub audit A3): the tutor Assignments board links to `/assessor/double-marking`, which needs the assessor cookie. Noted here because the fix may land on this side (a `/trainer/assessor/preview` redirect that sets the preview cookie then forwards).

## Part 3 · Align (B)

**B1 · Left-edge colour on every card, three meanings.** Candidate cards: amber if flagged, teal otherwise. Portfolio landing numbered cards: amber if open, teal if complete. Withdrawal letter: amber. Special arrangements strip: amber. Cohort/centre document cards: `card-gold`, `card-amber`. Amber is doing "flagged", "incomplete", "attention" and "a kind of document". Reduce: amber = needs the assessor's attention (flagged, incomplete); teal = complete; no edge for neutral documents (use the panel's accent in the header only). Documents stop carrying edges.

**B2 · Requirements panel accent "gold", centre documents "garnet", cohort documents none.** Panel accents are decorative, not semantic, and garnet appears nowhere else in the assessor identity (which is ink-warm + gold). Drop garnet from the pack; panels take gold or nothing.

**B3 · Two constant sets in one file.** `assessor/page.tsx` declares `TEAL = oklch(37.5% 0.058 195)` at the top and `TEAL = oklch(38% 0.072 195)` again inside the component, plus `GOLD` (63% 0.096 72) and `GOLD_UNDERLINE` (60% 0.11 70) as two golds. Import from `lib/hub-accent` / a shared `assessor-tokens` and delete the local copies; the two teals should be one.

**B4 · Figures row.** Pack head: `Figure` at Newsreader 21px with an 11px label. Portfolio landing: `Figure` at 21px with a 10px/600/0.05em label. Same component name, two implementations. Make it one.

**B5 · Sub-page cards.** Sub-pages use `.card` with inline `padding: "18px 20px"`, `marginTop: 14 / 26` per item; the pack uses `.card` at `15px 16px` and a grid gap. One card padding (16px) and a flex gap instead of per-item margins.

**B6 · Motion.** No hover lift anywhere in the assessor pack; the trainer hub and candidate shell now have it on openable cards. Same rule here: candidate cards, numbered portfolio cards, document rows that open → lift 2px/200ms; figures, requirement rows, read-only strips → none. `prefers-reduced-motion` respected.

## Part 4 · Polish (C)

- C1 · `HeaderCredit onDark` on the pack header and on every trainer-hub page the assessor tours. Pack landing only.
- C2 · The pack page is 85KB in one server component with inline styles throughout. Sub-components (`Panel`, `Figure`, candidate card, document row) should move to a `components/assessor/` folder so the five sub-pages can share them (A1, B4, B5 depend on it).
- C3 · The phone note says "laptop or tablet" but the layout is measured at 1440. Say "laptop".
- C4 · Sub-page eyebrows read `subject="the course"` in the banner → "You're viewing the course's assignment titles". Fine. But the banner's fallback label for an unknown path is the humanised last segment; add `/assessor/application-files → "Application files"` explicitly (it currently relies on the fallback).

## Part 5 · Design reference

`Assessor Landing v2.dc.html` is the design the pack was built from (candidate wall, three groups, rail with pack/day/handbook). The live pack follows it in structure but has since grown the requirements band, the Appian card, the sample toggle and the visit-day panel, all Ramy-directed after the mock. The live page is the source of truth; the mock is reference for card anatomy only. No new mock is needed for this side.

## Part 6 · Order

A1 (one head, one font) with C2 (extract components) · A3 (one hover) · B1+B2 (edge and panel colour) · B3+B4+B5 (tokens, figure, card) · B6 (motion) · A2 after the trainee Progress redirect · C1/C3/C4 whenever.
