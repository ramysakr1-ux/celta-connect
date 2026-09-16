# Trainee workspace — complete spec for Claude Code (15 Sep 2026)

One document for the whole candidate side. Supersedes `for-claude-code-trainee-workspace-live-audit-2026-09-15.md` and `for-claude-code-trainee-hero-glass-card.md` (both folded in here). Read against `ramysakr1-ux/celta-connect@main`, tree e6f3019d5d4a.

Read: `layout.tsx`, `header-day-bar.tsx`, `course-stream-day.tsx`, `today-tab.tsx`, `focus-row.tsx`, `trainee-sidebar-nav.tsx`, `trainee-header-corner.tsx`, `trainee-mobile-nav(-tabs).tsx`, `portfolio-tabs.tsx`, `tp/page.tsx`, `tp/[tpNumber]/page.tsx`, `assignments/page.tsx`, `timetable/page.tsx`, `progress/page.tsx`, `celta5/*`, `resources/*`, `trainee-notebook.tsx`, `components/day-bar.tsx`, `lib/timetable-category-style.ts`. The assignment writer itself was audited 13 Sep (`for-claude-code-trainee-assignment-port-audit.md`) and is not repeated.

Mock: `Trainee Hero Glass Card.dc.html` (Demo clock tweak).

---

## Part 1 · What stays exactly as it is

- **Dark header.** Ink-warm 56px, wordmark + credit, proportional day bar (garnet-lift), "Day N of 20", avatar as palette picker. Confirmed right on 15 Sep against the live code; earlier critique was against a stale mock.
- **Header day bar and Your day both stay.** Bar = proportional timeline; boxes = the sequence. One `StreamDay`, so they agree.
- **Your day boxes**: fixed 128×104, identical, `CATEGORY_STYLE` glass, garnet marker rides the live box and never disappears, stacks below `lg`.
- **Room concept**: rail on Course Stream only; every other door is a room with one "Course stream" pill carrying `?from=`. Timetable and filmed-observation full-bleed.
- **Course Stream scope**: today and what I owe, nothing else. Catch-up never capped. Empty day shows the next day. Finished course says nothing about grades.
- **CELTA 5 booklet** (`c5-*` classes): a Cambridge document with its own typography. Leave it.
- **Notebook**: own paper palette, deliberately off the teal/garnet/gold system so it never reads as status. Leave it.
- **Timetable tiles**: identical size regardless of duration. Deadline hour set per event by the MCT; Connect enforces the day rule only.

## Part 2 · Fix (A — wrong or a rule broken)

**A1 · One door list.** Three navigations exist for the same rooms: desktop rail (5: Course Stream · Resource Hub · Teaching Practice · Written Assignments · CELTA 5), mobile bar (6: Today · Timetable · My teaching · Assignments · Resources · Progress), staff `PortfolioTabs` (7: adds Pre-course task and Progress). Export `SIDEBAR_TABS` once with `label` and `shortLabel`; derive the mobile bar and `PortfolioTabs` from it. Progress leaves both (retired 29 Aug: "CELTA 5 and Progress are exactly the same"); Pre-course task leaves the staff list (dropped 28 Aug). Timetable may stay as a mobile-only extra.

**A2 · Retire the Progress page as a destination.** It still renders (`progress/page.tsx`) with its own head and three sheets, and the mobile bar sends candidates there. Everything on it exists on CELTA 5. Keep the route as a redirect to `/celta5` so old links work.

**A3 · Trainer controls out of candidate rooms.** `tp/page.tsx` renders "Write TP feedback" for staff; `timetable/page.tsx` renders `SupervisedSessionsPanel` for staff; `tp/page.tsx` renders the staff-only "Criteria — stage 2 · N%" card. All three sit inside the candidate's room markup. Per the 15 Sep rule (a trainer opens a candidate page in the **trainer's** shell, "Viewing as tutor" banner, trainer actions in the trainer's own bar), move them into the staff wrapper in `layout.tsx` (the `PortfolioTabs` branch), not the room. The criteria % already shows in the staff header (trajectory pill, CELTA 5 meta); drop the card.

**A4 · Preview-as-trainee on Written Assignments shows the staff state.** `isStaffViewer` there tests role only; `tp/page.tsx` tests `preview !== "trainee"`. Read the param the same way so preview shows the dashed not-yet-open cards.

**A5 · Garnet as decoration.** `sheet-garnet` alternates by index on: Written Assignments cards (`(Math.floor(i/2)+(i%2))%2`), Progress sheets, TP room "Carried forward", every section of the single-TP page (brief · plan · analysis · materials · self-eval · feedback), Resource Hub list items, observation tasks. Each is commented "decorative, no status meaning". But garnet **does** mean something on the same screens: overdue in Catch up, the live marker, Assignment 5, "Not to standard", formal letters. A candidate cannot tell "this card is garnet because it is second" from "this card is garnet because something is wrong". Remove `sheet-garnet` as an alternation everywhere in the candidate shell. Where a card needs to say which assignment it is, colour it from `ASSIGNMENT_INFO` (A1–A4 warm/ink family, A5 garnet — the assignments handoff). Cards that need no meaning get the plain card.

**A6 · `--trainee-plum`.** Used on the single-TP page's Materials card and as the assignments card fallback. Not a system colour; nothing else uses it. Replace with the ink spine.

## Part 3 · Align (B — inconsistency a candidate will notice)

**B1 · One room head.** Today: Course Stream eyebrow 11/700/0.14em + 32px h1; TP room eyebrow 11/600/0.1em + 24px h2; Written Assignments no eyebrow, 20px h2; Timetable no head; Progress eyebrow + 24px; Resource Hub a **dark ink band** with a 30px white h1 (the trainer assignments board's idiom); single-TP page h1 20px or 24px depending on branch; CELTA 5 20px h2. Build `RoomHead` (eyebrow 11/700/0.12em muted · Newsreader 26px/600 ink title · optional one-line meta 12.5 muted · actions right, h-38 radius 6) and use it in every room. Resource Hub loses the band. Timetable gets a head: eyebrow "Week N of 5 · Group ABC", title = date range, action = calendar.

**B2 · One card surface.** Candidate rooms use `.sheet` (the staff document idiom with its shadow) for everything; Your day and the timetable use the glass tile. Rule: **plain card** (`--color-card`, 10px radius, hairline border, no shadow) for static content; **glass tile** (`CATEGORY_STYLE`) for anything that is a timetable event (Your day, hero, Next for you, timetable, filmed-observation session card, tutorial/consultation slot). No `.sheet` in the candidate shell.

**B3 · One edge idiom.** Currently: 3px coloured top edge (assignment cards, Progress, TP room criteria), 3px left edge (TP rows, teal today / muted otherwise), glass top spine (tiles), `border-t-primary` (Your lessons). After B2: glass tiles keep the top spine; plain cards have no coloured edge; the TP room rows lose the left edge (the pill already says the state).

**B4 · Course Stream hero becomes the glass tile.** Full spec below (Part 5).

**B5 · Assignment card "Tutor feedback" preview.** Falls back to the first section comment when the overall comment is empty. Once the 13 Sep port audit's "overall tutor comment visible to candidate" lands, remove the fallback — a section note quoted as the verdict is worse than "No feedback yet".

**B6 · Single-TP page section nav.** A sticky `nav.sheet !p-1.5` of anchor pills over six `sheet` sections. Keep the anchors; after B2 the nav is a plain pill row, sections are plain cards, feedback and self-evaluation may keep a subtle tint (teal for feedback, none for self-eval) since those two carry meaning.

**B7 · Resource Hub cards.** `sheet trainee-hover` list items with garnet alternation (A5) and three different card sizes (`p-4` sheets, `p-[11px_12px]` inset cards, `px-3 py-2` rows). One card, one padding (14px), plain surface, hover lift only on items that open.

**B8 · Typography scale.** Body-ish sizes in use: 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14. Reduce to: 11 (eyebrows, meta labels), 12.5 (meta, sub-lines), 13.5 (body, row titles), 16 (lede); serif 20 / 26 / 32 / 44 for section, room, hero, hero-time. Apply as the rooms are touched, not as a separate pass.

## Part 4 · Polish (C)

- C1 · `HeaderCredit` on every room. Landing (Course Stream) only.
- C2 · Day bar accent: garnet-lift means "elapsed" here, "overdue" in Catch up, "now" on the track. Gold (the wordmark's) for the elapsed fill would free garnet for lateness and the marker. One value in `header-day-bar.tsx`. Ramy's call.
- C3 · Notebook pen: `bottom-2` on desktop sits in the chat pill's row. Confirm no overlap at 1280.
- C4 · `today-tab.tsx` (54KB): hero state machine and Waiting-list builder should be two files before more states arrive.
- C5 · Motion, both shells (from the MCT polish pass §0): openable cards lift 2px / 200ms `cubic-bezier(.2,.8,.2,1)`; read-only cards do not; panels rise in on first paint (0/60/120/180ms stagger), never on route change; honour `prefers-reduced-motion`. Your day boxes lift only while joinable.

## Part 5 · Course Stream hero as the glass tile

Mock: `Trainee Hero Glass Card.dc.html`. Nothing about the header, day bar or Your day changes.

**Layout.** Two columns `minmax(0,1fr) 320px`, gap 14, stretch; below `lg` the right card drops under. Eyebrow (greeting · date · clock) stays above.

**Hero card.** Style from `CATEGORY_STYLE[slot.category]` (own TP = `rm` white glass). `backdrop-filter: blur(10px)`, 1px border `white/0.8`, **3px** top spine in `accent`, radius 14, padding `22px 26px 20px`, shadow `0 10px 28px ink/0.09, inset 0 1px 0 white/0.85`. Grid `auto minmax(0,1fr) auto`, gap 24, centred.
- Col 1: start time Newsreader 44/600 ink-warm tabular; countdown beneath 11/700/0.1em uppercase muted (garnet while live). Right border `ink/0.1`, padding-right 24.
- Col 2: pill row (gold "YOU TEACH" 20px + "TP1 · D · Group DEF" 12/600 muted) · title Newsreader 28/600 ink `text-wrap: balance` · meta 12.5 muted (existing `bigSub`).
- Col 3: primary 40px radius 8 "Join the room" — teal + 6px gold dot when joinable (10 min before → end), otherwise `ink/0.06` fill, muted, "Opens 10 min before", `pointer-events: none`; after the lesson "Room closed". Secondary 36px "Open your plan", `white/0.5` fill, `ink/0.15` border.
- Live marker: while live, the garnet 2px marker crosses the hero at `elapsed/duration`, 8px past top and bottom, 10px dot at top. Same `now` as everything else.
- Hover: lift 2px, 220ms. Cursor default; the buttons are the targets.

**Next for you.** Next non-lunch slot's category decides the tint (usually `wg` teal). Radius 14, padding `18px 20px`, 3px spine. Eyebrow "NEXT FOR YOU" 10.5/700/0.12em in the accent; up to three rows: time 12/700 tabular muted (44px col) · title 13/600 · sub 11.5 muted. Read-only, no lift.

**States** (same `heroKind` machine): `teaching` = above. `teaching_tomorrow` / `teaching_next` = same card, countdown "Tomorrow · 09:30" / "Friday · 09:30", no Join. `teaching_unrecorded` / `teaching_done` / `teaching_unscheduled` / `precourse_gtky` / `course_finished` = same shape in `iw` tint, no time column, `genericHero.big` as title, `bigSub` as meta, one action. Non-teaching day with sessions = first session's tint, "You observe today — Deniz at 09:30, Priya at 10:15", peer-task action.

## Part 6 · Order

A1+A2 (door list, Progress redirect) · A3+A4 (staff controls out, preview param) · A5+A6 (garnet decoration, plum) · B1 (RoomHead) · B2+B3+B7 (surface pass) · B4 (hero) · B5/B6/B8 as touched · C whenever.
