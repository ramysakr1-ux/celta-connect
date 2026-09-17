# Post-build audit — what landed, what did not (17 Sep 2026)

Read against `main` (tree `d726a38a68a2`), 17 Sep 2026, after the nine specs of 15–16 Sep were reported built. Method: grep for each spec's own markers (class names, props, constants, file paths) across `src/app`, `src/components`, `src/lib`, then read the files behind every hit. Scans were scoped per folder so nothing fell outside the search budget.

Nine specs checked: type scale · motion rule · centre side complete · assessor pack complete · trainee workspace complete · trainer hub live audit + MCT polish · feedback writer / apply / mobile · gates / volunteer / email · remainder. Plus the demo clock spec (`for-claude-code-demo-clock.md`) and the hero glass card.

---

## 1 · Landed — confirmed in code

| Spec | Evidence |
| --- | --- |
| Type scale | `@theme` block in `globals.css` declares the nine tokens (`--text-micro` … `--text-hero`) with line-heights. `text-[Npx]` is gone from `src/app/trainer`, `src/app/dashboard`, `src/components`, `src/app/assessor`, `src/app/input-sessions`. Remaining literals sit only in the four named exemptions: `celta5/booklet/*`, `trainee-notebook.tsx`, `centre/owner/*`, `getting-started/page.tsx`. |
| Motion rule | `.lift` / `.wash` / `.hover-ring` declared unlayered at the foot of `globals.css`; `.lift-strong` kept for the timetable tile and the stream hero; one `prefers-reduced-motion` block lists every moving thing; `.hover-trainee` and `.hover-assessor` set the accent pair. Assessor hover is gold (B2). `.rise-*` entrance kept. |
| Centre side A1 | `.card-side-teal` / `.card-side-garnet` deleted; `:where(.area-*) .card` is a hairline with `.card-accent` for the room's own object; `settings-card.tsx` gone; `/centre/payments/page.tsx` gone (panels remain as components); `platform/page.tsx` redirects to Command Center (A10). |
| Assessor pack | `src/components/assessor/{tokens,panel,figure,candidate-card,assessor-head}.tsx` exist; Georgia is now only a font fallback; garnet gone from `src/app/assessor`. |
| Trainee A1–A4 | `portfolio-tabs.tsx` reads `WORKSPACE_TABS` (one door list); `progress/page.tsx` is a redirect to `celta5`; `.plain-card` declared (B2); header day bar elapsed is gold (C2). |
| Trainee B4 / hero glass card | `stream-hero.tsx` is the approved mock: CATEGORY_STYLE tint, 3px accent spine, 44px clock, live garnet marker, "Next for you" side card, drops to one column when nothing is left. |
| Feedback writer A1/A2 | `tp/[tpNumber]/page.tsx` no longer renders the plan above the writer; head card folded into the band's sub-line. |
| Apply form | `application-form.tsx` is a four-step wizard below `md`; intake option uses `formatCalendarDate` (A5); dashes fixed. |
| Trainer hub phone posture | `trainer-hub-chrome.tsx` mounts `TrainerMobileNav` + `HubPhoneGate` for real staff; `LaptopOnlyGate` copy says "laptop" (A8); tab row `hideBelowMd`. Chrome is shared across `(hub)` and the candidate shell's staff branch (§10). |
| Remainder | Input sessions: hand-typed colour constants gone; eyebrows on `text-label` / `text-micro`. |
| Gates | `.sheet-entry` / `.sheet-entry-gold` / `.sheet-entry-plain` declared; `.sheet-gold` kept as a deprecated alias. |

---

## 2 · Not landed

### A1 · Demo clock (`for-claude-code-demo-clock.md`) — blocks the Course Story
No `?day=N` handling anywhere. `src/lib/course-day.ts`, `src/lib/demo-course.ts`, `src/lib/trainee-day.ts`, `src/lib/assessor-day.ts` all call `new Date()` directly; no cookie is read in `src/app/demo/*` routes; no `demo-clock` helper exists in `src/lib`. Every course card in `Course Story.dc.html` still lands on the frozen mid-week-2 seed. The spec is unchanged and still the next thing to build; nothing here supersedes it.

### A2 · Trainee A5 — decorative garnet still in the candidate shell
The centre-side pass removed it from the four rooms and left a note in `globals.css`: "Still carried by the trainer hub and the candidate's shell until their own passes (trainee A5, hub ticket)." Neither pass happened. Live sites, all index- or position-derived, none carrying meaning:

- `portfolio/[traineeId]/resources/coursebooks-section.tsx` — `garnet={i % 2 === 1}` prop on `CoursebookCard`
- `resources/material-pool-section.tsx` — same pattern on `ItemCard`
- `resources/assignment-briefs-section.tsx` — `BriefCard … garnet={i % 2 === 1}`
- `celta5/page.tsx:318` — `nextSheetGarnet()` counter; and the shared alternation at `:1288`
- `filmed-observation/[sessionId]/task/page.tsx:56` — `nextSheetGarnet()` counter
- `filmed-observation/[sessionId]/task-panel.tsx:80` and `watch-screen.tsx:308` — `card card-garnet`
- `tp/[tpNumber]/page.tsx:167, :458` — alternation against the header sheet / down the stack
- `tp/page.tsx:359`, `page.tsx:261, :342`, `stage2-tutorial/[blockId]/page.tsx:61`, `assignments/[assignmentId]/fol-panel.tsx:49` — alternation by index

Garnet on the candidate side means, on the same screens: overdue (`today-tab.tsx:749`), the live marker (`course-stream-day.tsx`, `stream-hero.tsx`), an urgent door (`trainee-sidebar-nav.tsx:75`). The rule from the trainee spec stands: **a card in the candidate's shell is a plain card or a glass tile; colour on it means something.** Delete every `garnet` prop and counter above; the wrappers become `.plain-card` (static) or keep their glass (timetable events).

### A3 · Hub ticket — decorative garnet still in the trainer hub
- `trainer/(hub)/grades-report/page.tsx:253` — `sheet sheet-garnet` on the head; `:343` — `traineeIndex % 2 === 1 ? "sheet-garnet"` down the candidate list
- `trainer/(hub)/timetable/page.tsx:694` — `<details className="sheet sheet-garnet">`
- `trainer/(hub)/assignments/[assignmentId]/page.tsx:229–263` — four `sheet sheet-garnet` panels + a `garnet` prop passed down
- `dashboard/trainer/trainees/[id]/assignments/[assignmentId]/second-marking-panel.tsx:50` — `garnet` prop → `sheet-garnet`

In the hub, `.hub-v4 .sheet-garnet` already flattens the top rule to a 1px hairline, so on an MCT screen these render identically to a plain `.sheet` — the class is dead weight there. In an ACT's hub `--hub-decorative-accent` is gold, and gold is also the ACT's role colour, so the same class silently *does* something on the other role's screen. Remove the class from all six sites, drop the `garnet` prop from `SecondMarkingPanel`, and then delete from `globals.css`: `.card-garnet`, `.sheet-garnet`, `.hub-v4 .sheet-garnet`, `.hub-v4 .card-garnet`, and the `--hub-decorative-accent` var in `trainer-hub-chrome.tsx:180`. After A2 + A3 nothing reads them.

### A4 · Three garnet panel heads on the MCT's Assessor tab (Ramy, 17 Sep: "still see 3 red headers")
v4's hub rule: one shadowed card (Needs you), everything else flat, "drop the 3px top stripes." `.hub-v4 .sheet, .card, .card-garnet, .sheet-garnet { border-top: 1px }` enforces it — for classes. These panels set the stripe inline, so the rule never reaches them, and on an MCT screen each renders a solid garnet band across its top:

- `trainer/(hub)/assessor/prep-list.tsx:94` — `style={{ borderTop: "3px solid var(--hub-accent)" }}`
- `trainer/(hub)/assessor/recommendation-panel.tsx:112` — the "What Connect suggests" section, same inline stripe; `:46` adds `boxShadow: inset 0 3px 0 var(--hub-accent)` on every recommended-candidate card inside it (a stripe within a stripe)
- `trainer/(hub)/assessor/tint-block.tsx:70` and `:155` — "Also on this visit · trainer-in-training", both states
- `trainer/(hub)/assessor-card.tsx:57` — the Assessor card on Today, same stripe
- `trainer/(hub)/feedback-assist-card.tsx:57` — `border-t-[3px] border-t-gold`, the same idiom in gold (which is the ACT's role colour on an ACT screen)

Fix: delete the inline `borderTop` / `boxShadow` stripes and the `border-t-[3px] border-t-gold` utilities; the panels are `rounded-[12px] border border-border bg-card` like every other hub panel, and the eyebrow in `--hub-accent-deep` already says whose panel it is. The candidate cards inside the recommendation panel become plain `border border-border` cards. Also: `tint-block.tsx` puts `.hover-ring` on a disclosure block that is not a row — it does nothing on click and is not scanned as a list, so it carries no motion class (motion rule: static things carry none). The solid `--hub-accent` "Handbook" / § pills stay — they are the role accent doing a labelling job, at pill scale, which v4 allows.

### A5 · The candidate's glass has nothing to sit on (Ramy, 17 Sep: "trainee landing hero cards are just plain white")
Not a hero bug. The hero is built exactly to Part 5 — the fault is the surface underneath it.

`portfolio/[traineeId]/layout.tsx:468` wraps the whole candidate workspace in one full-bleed `background: var(--color-frame)`. `--color-frame` is `oklch(97.8% 0.008 85)` — level 2, and the **brightest value in the palette**, near-white.

Every glass tile on that side is tinted with **alpha**, from `CATEGORY_STYLE` (`lib/timetable-category-style.ts`):

| Tile | Tint | Over `--color-frame` (97.8%) |
| --- | --- | --- |
| `rm` — the candidate's own TP, i.e. the hero | `oklch(100% 0 0 / 0.92)` → `/ 0.55` | white on near-white — **invisible** |
| `iw` — every non-teaching hero state | `oklch(96% 0.008 85 / 0.6)` → `/ 0.25` | ~97.3% — a 0.5% step, invisible |
| `lu` — lunch | `/ 0.35` → `/ 0.15` | invisible |
| `wg` / `admin` | tinted 195 / 80 hues | survive, because they carry hue, not just lightness |

So exactly the two tints that are *meant* to read as clear glass disappear, and the two coloured ones don't — which is why the page looks like the hero failed to load while the timetable below it still has colour.

The approved mock (`Trainee Hero Glass Card.dc.html:29`) sits on `oklch(92.5% 0.012 85)` — which is `--color-background`, level 1, the page ground. That 5.3% difference is the whole effect.

**Fix:** the candidate's content surface is `--color-background`, not `--color-frame`. Change `layout.tsx:468` to `background: "var(--color-background)"`. This also restores the layering rule the palette comments state: a card sits on the level *below* it, and a glass tile is a card — it cannot sit on the palette's brightest surface and still read as glass.

Check after the change: the name banner and day bar in that same wrapper were drawn against the bright frame, so confirm their borders still read; if the banner needs to stay level 2, give it its own `--color-frame` background and let only the content area below it take `--color-background`.

Everything downstream is fixed by the same one line — Course Stream's hero, Your day, Next for you, the read-only board, filmed observation and consultation tiles all read from `glassTile()`.

---

## 3 · Drift — small, worth one pass

**B1 · Two hover mechanisms on one element (hub).** The motion rule says a button carries `.wash` and nothing else. These carry `wash` *and* `hover:border-primary`: `grades-report/certificate-check-card.tsx:47`, `close-out-card.tsx:111, :238`, `resource-hub/material-pool-toggle-card.tsx:31`, `rotation/group-tutor-form.tsx:120, :135`. Bare `hover:border-primary` with no motion class: `assignment-briefs/page.tsx:45`, `settings/page.tsx:69`, `marking-guidance/tabs.tsx:120`, `tp/[tpNumber]/page.tsx` (Download PDF link). Drop `hover:border-primary`; add `wash` where missing.

**B2 · Row hovers not on the rule.** `hover:bg-accent/40` on scannable rows: `grades-report/cohort-sheet.tsx:174, :237`, `pre-course-task/page.tsx:137`, `grade-query-reply/[traineeId]/page.tsx:66`; `hover:bg-accent` in `course-switcher.tsx:59`; `hover:bg-accent/40` on `rotation-tabs.tsx:55`. Rows that open → `.lift`; rows that only highlight → `.hover-ring`; menu/tab items → `.wash`. Option buttons in `malpractice/case-forms.tsx:73, :91, :103` and `raise-concern-form.tsx:81` use `hover:border-primary/50` — `.wash`.

**B3 · A static element wearing a hover class.** `dashboard/admissions/pipeline/pipeline-funnel.tsx:94` — `<p className="sheet-interactive …">Nothing needs attention right now.</p>`. Plain card. `.sheet-interactive` then has no callers and can go.

**B4 · Tracking — the rule was wrong, not the code.** The type-scale doc says caps eyebrows are 0.1em at label and 0.12em at micro. An app-wide grep (not the four files the audit first looked at — ~175 sites across every shell) says the platform never adopted that and instead settled on **two** conventions, split almost perfectly by shell:

- **0.08em** — centre rooms, assessor pack, admissions, login, platform command center, and the shared components (`components/assessor/panel.tsx`, built by one of these specs; `import-wizard`, `trainer-notes`, `viewing-as-tutor`). ~90 sites.
- **0.12em** — trainer hub, candidate shell, input sessions. Includes every table `<th>` in the hub (grades report, pre-course task, resource hub), the timetable's `<summary>` rows, and the workspace nav headings. ~70 sites.

Nobody sees both shells side by side, both are internally consistent, and each reads correctly at its own size. So: **adopt both.** Amend the type-scale doc to say the eyebrow tracking is 0.08em in the centre/assessor/admissions shells and 0.12em in the hub/candidate/input-session shells, and do not touch those ~160 sites.

Then declare the two as classes in `globals.css` so the next screen doesn't hand-type a third value — `.eyebrow { font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em }` and `:where(.hub-v4, .trainee-shell, .input-session) .eyebrow { letter-spacing: 0.12em }` — and use them on new work only. Retrofitting existing sites to the class is optional and not worth a pass of its own.

What *is* worth fixing is the genuine outliers, one-off values that match neither convention and no pattern:

| Value | Sites |
| --- | --- |
| 0.02em | `trainer/(hub)/needs-you.tsx:93` (initials avatar), `roster/roster-row.tsx:427` (grade pill), `assessor/appian-reference.tsx:80` |
| 0.03em | `components/input-sessions/agenda-strip.tsx:19`, `portfolio/[traineeId]/celta5/booklet/cover.tsx:118` (booklet — exempt, leave) |
| 0.04em | `grades-report/page.tsx:635`, `grades-report/report-cards.tsx:31`, `celta5/stage-ratings-form.tsx:146`, `input-sessions/sessions/listening.tsx` ×2, `sounds.tsx` |
| 0.05em | `admissions/emails/page.tsx:155`, `admissions/pipeline/page.tsx:240`, `admissions/page.tsx:243`, `rotation/aim-coverage.tsx:43`, `trainer-in-training/sections.tsx:434`, `resources/page.tsx:556`, `components/assessor/figure.tsx:24` |
| 0.07em | `assessor/recommendation-panel.tsx` ×3, `assessor/tint-block.tsx` ×7 — the hub's assessor pills, one file pair, all the same idiom |
| 0.09em | `trainer-hub-chrome.tsx` (role pill), `roster/delivery-mode-card.tsx:58`, `components/delivery-mode-picker.tsx:58`, `grades-report/page.tsx:476`, `assessor-landing.tsx:178`, the six `portfolio/resources/*-section.tsx` headings, `tp-audio/audio-list.tsx:104`, `tp-library/coursebook-list.tsx:46` |
| 0.11em | `trainer/(hub)/page.tsx:1110`, `assessor/page.tsx:416` |
| 0.14em | `course-stream-day.tsx:55, :140` |
| 0.16em | `portfolio/[traineeId]/gtky/page.tsx:61` |
| 0.06em | ~35 sites, all on table/grid column heads and small meta labels. Judgement call: it is close enough to 0.08em to read as the same intent and is the second most common value in the app. Either fold into 0.08em or leave. Not worth a pass on its own; fix when touched. |

Snap each outlier to its shell's value (0.08em or 0.12em). Two exceptions to keep as-is: the booklet (already exempt from the type scale) and the two `0.02em` pills, where the tracking is doing optical work on a two-character label inside a circle, not acting as an eyebrow — those should lose the property entirely rather than gain a value.

**B5 · Redeclared constant.** `assessor/appian-reference.tsx:21` — `const GOLD = "oklch(60% 0.11 70)"` alongside the new `components/assessor/tokens.ts`. Import it.

**B6 · Side-panel widths (high-traffic B8).** Still four values: `centre/page.tsx:315` 360, `dashboard/admin/page.tsx:249` 320, `review-form.tsx:79` 360, `plan-review.tsx:206` 360, `stream-hero.tsx` 320. Pick one (360 is the majority) or leave as is — this is the least important item here.

**B7 · Deprecated alias still declared.** `.sheet-gold` in `globals.css` ("prefer .sheet-entry"). If no caller remains, delete it.

**B8 · `--trainee-plum` (trainee A6).** Still declared; used by `.hover-trainee` (the ring accent, which the motion rule explicitly keeps — "the plum accent is for rows only") and `.trainee-header`'s left rule. A6 asked for the Materials card and the assignments fallback to lose it; those did. Decision for Ramy: keep plum as the candidate's ring colour (current state, consistent with the motion rule) or retire the token and let the ring fall back to teal. No action until he says.

---

## 4 · Order

A1 (demo clock — unblocks the Course Story) · A5 (one line, and the most visible thing on the list) · A4 (five files) · A2 + A3 together (one grep for `garnet` across `src/app/portfolio` and `src/app/trainer`, then the `globals.css` deletions) · B1 + B2 + B3 (one hover pass over the hub) · B4 (amend the type-scale doc, declare the two classes, then ~45 outlier sites — not the ~160 that already agree with their shell) + B5 · B6/B7 as touched · B8 waits on a decision.

## 5 · Coverage

Every route under `src/app` was searched by folder; the four type-scale exemptions were read and left alone; `src/lib` was searched for any clock offset. The nine specs' A-items are all confirmed either landed (§1) or listed (§2). Nothing else from those specs was found outstanding.
