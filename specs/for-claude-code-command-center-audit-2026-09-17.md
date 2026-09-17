# Command Center — live audit (17 Sep 2026)

For Claude Code. Read against `main`, 17 Sep 2026. Scope: `src/app/platform/command-center/**` and `src/app/platform/accounts/page.tsx`, checked against the centre-side spec (A1, the room rule), the motion rule, the type scale, and the shell's own design notes in `layout.tsx` and `section-pills.tsx`.

The 2 Sep redesign landed well and is intact: three rules with the four section pills between the second and third, no dark bar, no sidebar, the greeting as the page's own heading, the credit in the footer. `.platform-room` is in the `:where(…)` edge-suppression list in `globals.css:277`, so a `.card` in here correctly carries no coloured edge. What follows is what the redesign left behind and what has drifted since.

---

## 1 · Fix

### A1 · `sidebar-nav.tsx` is dead and contradicts the live shell
`src/app/platform/command-center/sidebar-nav.tsx` still exists and exports `SidebarNav`. Nothing imports it — the sidebar was removed on 2 Sep when the pills took its four links ("if I have Overview, People, Money, Access on top, why do I need the side panel with the same stuff?"). It is now the only place in the shell that:

- still calls the fourth section **"Access"**, which was renamed to **"Demo links"** on 3 Sep ("that's all it does. Demo links.")
- hardcodes `INK_DARK`, `GOLD`, `INACTIVE_TEXT`, `INACTIVE_DOT` as its own literals

Delete the file. Anyone reading the folder to learn the shell currently finds two navigations with different labels.

### A2 · `.card-red` on "Needs your attention" breaks the shell's own colour rule
`command-center/page.tsx:289` — `<div className="card card-red …>`.

`layout.tsx:58` states the rule for this shell in its own words: *"platform-room: a card in here carries no edge — Command Center has its own three rules and no room colour."* `.card-red` is exactly such an edge, and it introduces a fifth colour into a shell whose organising idea is four section colours (gold / blue / green / magenta). Overview's colour is gold; a red-edged card on the gold section reads as a status the section does not have.

The severity information is not lost by removing it: every row inside is an `AttentionRow`, which already tints itself red, gold or muted per item (`page.tsx:398`). That is where severity belongs — per item, not on the container, since the container holds all three severities at once.

Make it a plain `.card`. Same call for `platform/accounts/page.tsx:182`, which does the same thing conditionally (`outstanding.length ? " card-red"`) inside the same `.platform-room`.

### A3 · Three sand values for one background
| Where | Value |
| --- | --- |
| `globals.css:36` — `--color-background` | `oklch(92.5% 0.012 85)` |
| `layout.tsx:32` — `SAND` | `oklch(0.935 0.012 82)` |
| `section-pills.tsx:36` — `SAND` | `oklch(93.5% 0.012 82)` |

The two local ones are the same colour written two ways (decimal vs percent), and both differ from the platform ground by 1% lightness and 3° of hue — enough that the header and the pill band do not quite sit on the app's own sand. Delete both constants; use `var(--color-background)` in all three places (`layout.tsx:61`, `:62`, `section-pills.tsx:59`).

### A4 · `GOLD` hand-typed five times, in a notation the app doesn't use
`layout.tsx:30` and `sidebar-nav.tsx:7` declare `GOLD = "oklch(0.62 0.14 68)"`; `section-pills.tsx:24` repeats it as `oklch(62% 0.14 68)` for Overview. That colour is **not** `--color-gold` (`oklch(63% 0.096 72)`) — it is the base of `--color-rule-gold` (`globals.css:76`). So the shell is consistent with itself but silently uses a second gold, and does it in `oklch(0.62 …)` decimal notation while the rest of the app writes `oklch(62% …)`.

Not necessarily wrong — the rule gold is the right colour for rules. But declare it once as a token (`--color-rule-gold` already exists; add `--color-rule-gold-base` if a solid version is needed) and reference it, so a future retint of the gold rules doesn't leave the Command Center logo tile and the Overview pill behind. While there: `RED`, `GREEN`, `BORDER`, `INK`, `MUTED` in `layout.tsx` are all hand-typed decimals with token equivalents (`--color-destructive`, `--color-border`, `--color-ink`, `--color-muted`).

---

## 2 · Decide

### B1 · The greeting and the pulse strip head every section, not just Overview
`layout.tsx` renders "Welcome back, {firstName}", the date eyebrow, and `<PulseStrip>` **above `{children}`** — and this layout wraps People, Money, Demo links, Centres → new, and the two enter screens (its own comment at `:76` confirms the scope).

So the Demo links page opens with a personal greeting and four platform-wide counters that have nothing to do with demo links, and the same four tiles repeat on every section. On Overview they are the page's summary; everywhere else they are a header the section didn't ask for.

Three options, your call:
1. **Move both into `command-center/page.tsx`** (Overview only). The other three sections then start with their own heading. Cleanest, matches what the greeting was for ("the page's own heading").
2. **Keep the greeting in the layout, move the pulse strip to Overview.** The greeting is cheap and reads as part of the shell; four numbers are not.
3. **Leave as is** if you want the counters always in view.

My recommendation is 2 — the greeting is shell furniture, the pulse strip is Overview's content.

### B2 · `--trainee-plum`-style question: does Overview need "Your courses" at all
Unrelated to the redesign, but still flagged in `page.tsx:28` from the original build: "Your courses" is not in `command-center-full-spec.md`'s Overview layout and was kept deliberately, pending your word. It is still there and still first. No action unless you want it moved or cut.

---

## 3 · Drift

**C1 · `tracking-wide` on the Centres table head.** `page.tsx:230` — Tailwind's default `0.025em`. It is the only place in the app using the utility rather than an explicit value, and every other table head in this shell (People `:148`, Money, the pulse strip) uses `0.08em`. Make it `tracking-[0.08em]`.

**C2 · Tracking inconsistent within the one shell.** Per the type-scale correction (audit B4), the platform/centre/assessor family's eyebrow convention is **0.08em**. In this shell: pulse strip, product switcher, Money and People all use 0.08em; `layout.tsx:73` ("Command center") uses 0.12em; `section-pills.tsx:71` uses 0.1em. The two outliers are the two most visible pieces of text in the shell. Snap both to 0.08em.

**C3 · Motion rule.** `page.tsx:368` — `lift` on the Activity rows, which are plain `<div>`s that open nothing. Static things carry no motion class (same bug as `pipeline-funnel.tsx:94` in the main audit, B3). Remove it. `page.tsx:220` — `+ Add a centre` uses `hover:bg-primary/90`; a button carries `.wash` and nothing else (audit B1).

**C4 · `PulseStrip`'s comment describes code that no longer exists.** `pulse-strip.tsx:5-10` explains a "decorative teal/garnet alternation" and `.card-side-*`; the centre-side A1 pass deleted those classes and the component now renders a plain `.card`. The comment is the only remaining description of a pattern that was removed on purpose — rewrite or drop it. Also `:23` still has an empty template literal (`className={\`card flex …\`}`) left from when the accent was interpolated; make it a plain string.

**C5 · The pulse strip can't reflow.** `grid-cols-4`, fixed. At the widths the shell actually gets (40px page padding, no max-width) four tiles holding a serif `--text-h1` number plus a two-line sub-label crush before they wrap. `sm:grid-cols-2 lg:grid-cols-4` costs nothing.

**C6 · `product-switcher.tsx` local literals.** `CARD`, `INK`, `MUTED`, `HOVER`, `DARK_ITEM` hand-typed; and `boxShadow: "0 4px 20px -4px rgba(0,0,0,0.35)"` is the only `rgba()` shadow in the shell (everything else is oklch). Point at the tokens; convert the shadow.

---

## 4 · Order

A1 and A3 are deletions, do them first. A2 is one class in two files. A4 is a token declaration plus find-and-replace. B1 needs your answer before anything moves. C1–C6 are one pass over four files.

## 5 · Not found

No decorative garnet, no inline 3px stripes, no off-scale `text-[Npx]`, no duplicate panels in this shell — the type scale and the centre-side edge rule both landed here cleanly.
