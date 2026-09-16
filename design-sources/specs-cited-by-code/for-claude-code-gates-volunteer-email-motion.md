# Entry gates · Volunteer page · Emails · Demo · Motion rule (16 Sep 2026)

Last pass of the live audit. Read against `ramysakr1-ux/celta-connect@main` (tree 012cfc28e6de). Same severity scale as the other specs (**A** wrong · **B** inconsistency · **C** polish).

Read in full: `login/{page,login-form}.tsx`, `forgot-password/page.tsx`, `join/[token]/page.tsx`, `join-centre/[token]/page.tsx`, `offer/[token]/page.tsx`, `interview/[token]/page.tsx`, `register/[token]/page.tsx`, `page.tsx` (root redirect), `student/[token]/{page (to the truncation point ~50KB), greeting, signup-form, lesson-materials-card}.tsx`, `lib/email-layout.ts`, `demo/page.tsx`. By search: `globals.css` hover/motion classes, email template call sites. Not found on `main`: `not-found.tsx`, `error.tsx` (Next defaults are in use).

---

## 1 · Entry gates (login, forgot, join, join-centre, offer, interview)

### What stays
- **One entry idiom**: `entry-ground` → `.frame max-w-sm p-3` → `.sheet-entry p-8`, hero wordmark, one paragraph, form. Applied to all six. Correct per the 15 Aug entry-screens PDF.
- **Root `/` redirects to login** (15 Aug: nobody arrives at the bare domain). Correct.
- **"Set or reset"** instead of "Forgot?" (2 Sep). Correct.
- **Closed course ≠ broken link** on `/join` with the centre's email as the way out. Correct.
- **Offer deadline in the centre's clock, city named.** Correct.
- **Interview picker**: both zones, applicant's first; one reschedule then "contact the centre". Correct.

### Fix (A)
**A1 · Two sheet classes for one idiom.** Login and `/apply` and `/register` (expired) use `.sheet-accent`; forgot, join, join-centre, offer, interview use `.sheet-entry`. `sheet-accent` carries the coloured top rule (teal/gold by button, Ramy 26 Aug); `sheet-entry` does not. Login is the one gate with a teal button and no rule. One class: `sheet-entry` everywhere, with the top rule following the 26 Aug rule (teal when a primary button is present, gold otherwise). `/apply` keeps its own since it is a form, not a gate, but reads the same rule.

**A2 · Login button is `bg-ink-warm`; every other gate's primary is teal** (`bg-primary` on join, offer, join-centre forms; `bg-[#1a5c5e]` on volunteer signup). The 26 Aug rule ties the sheet's rule colour to "the green button"; login's button isn't green, so its rule can never be. Login primary → `bg-primary`.

**A3 · Error states are a bare red sentence** (`text-sm text-destructive`) under the wordmark on join, join-centre, offer, interview, register, student — six places. Login uses `.sheet-accent-alert` (a tinted box). One treatment: the alert box, with a heading ("This link has expired") and a body (who to ask). `sheet-entry` variant with the rule in `plain` brown, not red — a dead link is not an alarm.

### Align (B)
**B1 · Heading presence.** Forgot has a 24px serif h1; login, join, join-centre, offer, interview have none (paragraph straight under the mark). Give every gate one h1 at the h2 token (21px serif): "Sign in" · "Set or reset your password" · "Join {course}" · "Join {centre}" · "Your place on {course}" · "Pick your interview time". The paragraph follows.

**B2 · `/register/[token]` is not a gate but uses the gate's error sheet, then a full-page `.sheet` layout with `container py-8` and no header.** It's a room for centre staff without accounts; give it the same header strip the volunteer signup page has (wordmark · credit · clock) and plain cards, not `.sheet`.

## 2 · Volunteer student page

### What stays
- **Two structural layouts** (phone card 390/22px; desktop mat 1100/6px), by design, spec 1a/1b. Keep.
- Greeting computed on the client; hero card rebuilt as the design (date · Starts hh:mm · Where/Topic/Teacher · long Join pill · calendar square · decline). Keep.
- Three-row class glance, not a log (Ramy 25 Aug). Keep.
- Hours card with scaled milestones; "Not marked yet" third state. Keep.
- Install prompt offered to volunteers. Keep.
- Materials as compact per-teacher pills that open. Keep.

### Fix (A)
**A4 · Signup form uses hard-coded hex** (`#eddfc4`, `#3a2e18`, `#1a5c5e`, `#8a6a2f`, `#fbf3e3`, `text-red-700`) — the only place in `src/app` outside emails that bypasses the tokens. `#1a5c5e` is the email teal, not the app's `--color-primary`. Map: `#3a2e18`→`text-ink`, `#8a6a2f`→`text-muted`, `#eddfc4`→`border-border`, `#fbf3e3`→`bg-card-inset`, `#1a5c5e`→`bg-primary`/`text-primary`, `text-red-700`→`text-destructive`.

**A5 · "Upcoming" pill is an inline blue** (`oklch(93% 0.045 235)` / `oklch(42% 0.095 250)`) — blue appears nowhere else in the app. Use the neutral `card-inset`/`muted` pair the "Not marked yet" pill already uses, or the teal on-track pair with the dot hollow.

### Align (B)
**B3 · Milestone tile label at 9px** (`text-[9px]`) — below the micro token. Drop the word on the tiny tiles and keep only "Certificate" on the last (the design's own fixed identity); the hours figure is enough on the others.

**B4 · Desktop header greeting at 19px serif sits opposite an 11px eyebrow** on one baseline row. Fine, but the phone header puts the greeting at `text-xs text-muted` — a name in grey 12px chrome. Phone greeting to body 13.5 ink, still in the header.

**B5 · `TitleBlock` desktop branch is dead** (the comment says desktop no longer uses it). Remove the `desktop` prop.

## 3 · Emails

### What stays
- **Tables, inline styles, computed hex from the oklch spec.** Correct and necessary.
- **Two shells with a reason**: `emailShell` (category spine, 3px, the admissions/course family) and `authEmailShell` (ink-brown header bar with the centre name in gold italic, the sign-in/invite family). Both are the design.
- **`withConnectBranding`** applied once centrally: 13px mark + 10px "Connect" above, centre eyebrow above the h1. Ramy's 25–26 Aug sizing. Keep.
- **URL repeated as text under every button.** Keep.

### Fix (A)
**A6 · `green` and `teal` are the same hex; `plain` and `muted` are the same hex.** Four names, two colours. The comment explains the history (green retired 21 Aug). Fold: `EMAIL_TONE = { teal, gold, amber, red, plain }`; call sites using `green`→`teal`, `muted`→`plain`. Five tones, five colours, no aliases.

**A7 · Two greetings on screen for the same font decision.** App serif is Newsreader; emails fall to `Georgia,'Times New Roman'`. Unavoidable in mail clients, and correct — but the eyebrow/heading/body sizes (10.5 / 20 / 14) and the auth shell's (—/19/14) don't match each other. One set for both shells: eyebrow 10.5, heading 20, body 14, meta 12, footnote 11.5.

### Align (B)
**B6 · CTA radius 6 everywhere in email, 8 in the auth shell's card.** Email card radius 6 to match.

## 4 · Demo landing

Fine as is: hero wordmark, one h1, eight role cards + the journey card on `card-interactive`. Two notes:
- **C1** · `card-interactive` is the only hover-lift class in the app outside the timetable tile (§5). It should be the shared one.
- **C2** · Role blurbs are the only place the app describes its own roles in one screen. Reuse these eight sentences as the tooltip/subtitle on the room pills and the trainer hub's role switch, rather than writing them again.

## 5 · The motion rule (app-wide, replaces every scattered mention)

What exists in `globals.css` today: `.card-interactive:hover` (lift), five per-room `*-hover` (ring) and `*-hover-fill` (wash) classes, `.owner-row-hover` (wash), `.room-pill:hover`, three ad-hoc `translateY` rules (−1, −2, −3px+scale on `.tt-tile`), four separate `prefers-reduced-motion` blocks, and one `hover:scale-[1.02]` inline on the attach menu. Six mechanisms for "this responds to hover".

**One rule, three classes, one reduced-motion block:**

- **`.lift`** — anything that opens or navigates when clicked (cards, rows that are links, tiles, figure cards that link, room pills, demo cards): `transition: transform 200ms cubic-bezier(.2,.8,.2,1), box-shadow 200ms ease; :hover { transform: translateY(-2px); box-shadow: var(--shadow-lift); }`. The timetable tile keeps its stronger `-3px scale(1.025)` as `.lift-strong`, used only there and on the Course Stream hero.
- **`.wash`** — anything that toggles or acts in place without leaving (buttons, tab items, chips, checkboxes' rows, form rows): `background-color 120ms` to `var(--area-hover-fill)`. This is what `*-hover-fill` does today; collapse the five room-named classes into one that reads the area variable (they already do).
- **`.ring`** — read-only rows that highlight for scanning but do nothing on click: `box-shadow: inset 0 0 0 1px var(--area-accent)` at 120ms. This is what `*-hover` does today; same collapse.
- **Static** — figures, static cards, text: no class, no hover.
- **Entrance** — panels rise 8px/opacity on first paint, 0/60/120/180ms stagger, once per route (the existing `translateY(8px)→0` rule at line ~1377). Never on re-render.
- **Reduced motion** — one block: `.lift, .lift-strong { transition: none; } .lift:hover { transform: none; }` plus the existing pulse/dot exceptions. Delete the other three blocks.

The area colour stays in the CSS variable, so `.lift`/`.wash`/`.ring` need no per-room variants. `trainer-hover`, `trainee-hover`, `admin-hover`, `assessor-hover`, `volunteer-hover`, `owner-row-hover`, `card-interactive`, `tt-tile` hover → mapped to the three classes by one find-and-replace; `hover:scale-[1.02]` → `.lift`.

## 6 · Order

§5 motion rule first (it is one CSS change and a rename; every other spec's C-motion item points here) · §1 A1–A3 (gates: one sheet, one button, one error) · §2 A4–A5 (volunteer hex, blue pill) · §3 A6 (email tones) · B items as touched · §4 notes whenever.

## 7 · Coverage, end of audit

Read line-by-line against `main` across 16–17 Sep: all four shells (trainer hub, trainee workspace, assessor pack, centre side incl. owner, Course Admin, Admissions, Command Center, platform), the feedback writer, the application form, all six entry gates, the volunteer page, the email shells, the demo landing, and the phone posture. Still read only by search or not at all: `dashboard/admin/settings/*`, the applicant record's 15 child panels, `centre/{assessor-history,owner/log}`, roles strip/forms, volunteer row, input-session content components (25), the PDF routes, the Notebook internals, `demo/journey/*`. None of those is a landing or a daily screen.
