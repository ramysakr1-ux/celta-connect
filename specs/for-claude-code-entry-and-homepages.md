# Entry pages + role homepages — full specs

## Shared tokens (every screen below)
- Fonts: Karla (400–700, UI/body), Newsreader (500/600, headlines), Instrument Serif italic (wordmark word), Instrument Sans 600 (wordmark descriptor, uppercase)
- Page background: `oklch(92.5% 0.012 85)`
- Card/surface background: `oklch(99.2–99.5% 0.004–0.005 90)`
- Card border: `oklch(88–89.5% 0.012–0.016 82)`
- Ink: `oklch(23.5% 0.017 65)` · Muted: `oklch(51% 0.017 70)` · Warm headline ink: `oklch(30% 0.042 58)`
- Teal (primary action / links): `oklch(37.5–38% 0.058–0.072 195)`
- Gold (wordmark word, waiting/warm accents): `oklch(60–70% 0.11–0.12 70–72)`
- Red (errors/destructive): `oklch(45% 0.15–0.16 27)`
- Link default `oklch(38% 0.072 195)`, hover `oklch(23.5–30% ...)` (darker ink)
- Wordmark: ink-tile (`oklch(23.5–30% 0.017–0.042 58–65)`, 8–12px radius) containing a two-arc "C" mark (gold arc `oklch(70% 0.12 72)` + cream arc `oklch(97% 0.008 88)`), "Connect" in Instrument Serif italic gold beside it, uppercase descriptor below at 0.26em tracking. Spins on `.mark-spin`/`mark-stage` (rotateY, 54s linear loop, disabled under reduced-motion) on richer screens; static mark on compact headers.

---

## Entry.dc.html — sign in, join, reset (1560px canvas, 3 sections)

**1a. Sign in** — 380px card, centered, ink-tile wordmark + descriptor, "Sign in to your centre." subhead. Email field (40px, bordered input) → Password field with "Forgot?" link inline with its label (teal, top-right of field) → filled Sign-in button (warm-ink bg) → divider "or" → outlined "Email me a sign-in link" button → 11px footnote clarifying assessors/volunteers don't sign in here.
- After magic-link request: red-tinted card ("check your email" state), envelope icon in teal circle, confirms address, "expires in 15 minutes, works once," resend link.
- Three error states (each its own card): invalid/expired invite, session expired before password set, invalid/expired assessor link — every error names next step and, where no account exists, gives centre contact.

**1b. Join by link** — tab switcher (Trainee/Trainee vs Trainer, teal pill on selected), then one gold-tinted card: wordmark, personalized greeting line, Full name / Email (pre-filled, read-only-looking) / Choose a password fields, then role-specific checkbox agreement (candidate agreement vs staff terms, checked state = teal fill), filled "Create my account and accept" button, footnote on where the acceptance is recorded.

**1c. Reset + dead-link gates** — three 340px gold-tinted cards side by side: "Reset your password" (email field + Send reset link), "This link has expired" (no field, Email-the-centre CTA), "The course has closed" (same CTA, names the course and close date). Plus a red-tinted "check your email" confirmation card matching 1a's pattern.

Every gate keeps the wordmark — never a bare error page.

---

## Trainer Homepage.dc.html (1440px, day-view dashboard)
**Header** (56px, white card bg, bottom border): logo mark (32px ink tile) + "Connect" wordmark (static, 20px Instrument Serif italic) → nav tabs (7 items, active tab underlined teal 2px) → right cluster: course-code pill (teal fill, "C2/2024"), trainer name (muted), Connect Hub icon (bordered square, hover-clickable).

**Body** (32px padding): eyebrow "centre · course · date range · week N of N" → Newsreader 32px date headline (warm ink) → two action buttons top-right (outlined "Post announcement", filled teal "Write TP feedback").

**3-column dashboard grid** (1.15fr / 1fr / 1.05fr, 20px gap): each card white, bordered, 3px colored top-spine (teal for schedule), 8px radius. First card = "Today's schedule" — timetable rows with a 4px left color rule, time column (tabular nums, muted), title + optional subtitle, optional status pill (dot + label).

---

## Centre Admin.dc.html (1620px, tabbed admin console)
**Header**: spinning ink-tile mark + italic "Connect" wordmark (18px) + vertical divider + teal "Centre admin" role pill (outlined, tinted bg) — left side; admin's name — right side, no other chrome.

**Tab row**: underlined tabs (2px bottom rule in teal when active), sits on a full-width hairline border.

**Overview tab**: eyebrow "centre name · Cambridge centre code" → Newsreader 24px "Centre overview" title, with "Export financials" (outlined) + "Invite people" (filled teal) buttons top-right → 4-up stat-card grid (label/value/note, value in Newsreader 24px) → 2-column below: "All courses" list card (name/dates+mode/stat columns, hairline row dividers) + a secondary panel.

---

## Course Admin.dc.html (1560px, step-by-step setup wizard)
**Page header**: eyebrow "Connect · course admin" → Newsreader 34px title → muted intro paragraph explaining scope vs Centre Admin.

**Each step section** (labelled 2a, 2b… with a dark numbered badge): 2-column layout — left = white bordered card (24×26px padding, 8px radius) with eyebrow "New course · code · step N of 6", Newsreader 22px question, radio-style option list (16px circle radio, filled teal dot when selected, label + description per option), an "impact" callout box below (tinted bg, bordered, labelled rows showing what the choice changes downstream), filled teal "Continue" button + footnote; right column = stacked note cards (title + body) explaining rationale.

---

## Notes
- Course-code pill and "Connect Hub" icon in the trainer header are gated by `hub_access` per the header rework spec — see `for-claude-code-header.md` (once written) for the retirement of the old "Command Centre" pill.
- All screens share the identical ink-tile/wordmark component — build it once, reuse everywhere; only size and static-vs-spinning vary.
