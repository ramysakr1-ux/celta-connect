# Green — what is gone, what stays

Written 7 Aug 2026. This settles an ambiguity in the earlier line "green is gone from the interface", which was too broad. Read this instead.

## The short version

**Green is gone as a semantic colour.** It is no longer how the interface says "success", "passed", "approved", "to standard", "complete" or "attended.

**Green stays as a surface tint.** `--color-accent` — the pale teal-green wash already in `globals.css` — remains the hover and selected-surface colour throughout the app. It carries no meaning; it is the colour of touching something.

## Keep exactly as they are

| Token | Value | Used for |
|---|---|---|
| `--color-accent` | `oklch(93% 0.019 190)` | Hover washes, selected rows, the chat pill's channel chip, `.sheet-interactive:hover`, `.sheet-accent` entry cards |
| `--color-accent-foreground` | `oklch(32% 0.05 195)` | Text on those washes |
| `--color-primary` | `oklch(37.5% 0.058 195)` | Teal. Actions, links, active tabs, progress bars, focus rings |
| `--color-ring` | `oklch(37.5% 0.058 195)` | Focus rings |

Note that `--color-accent` is a *teal-green* — it reads green next to cream, and that is fine. It is a surface, not a signal. The chat pill's chip, the roster's row hover, and the entry cards on sign-in all use it and all keep it.

## Stop using as a meaning

| Token | Value | Where it was used | Replace with |
|---|---|---|---|
| `--color-status-on-track-bg` | `oklch(93% 0.045 155)` | "Pass", "Approved", "To standard", "Attended", "On track" pills | `--color-status-neutral-bg` `oklch(93.5% 0.008 85)` |
| `--color-status-on-track-text` | `oklch(38% 0.085 155)` | Same | `--color-ink` `oklch(23.5% 0.017 65)` |

So `.pill-success` and `.status-pill-on-track` become ink-on-neutral: **a filled ink dot and ink text on the neutral tint**. The pill keeps its `::before` dot, so a passed state still reads as a definite marked state — it just is not celebrated with colour.

Do **not** delete the two `--color-status-on-track-*` tokens from `globals.css`; leave them defined and unused, so nothing breaks mid-migration and the decision is reversible.

## Why

Four accents were competing in content — teal for action, gold for a system rule in force, green for success, amber for attention. On a roster of thirty rows the eye could not tell which colour was the important one. Removing the one that only ever said "this is fine" leaves three, each of which means something a reader has to act on.

The remaining palette in content:
- **Teal** — you can do something here
- **Gold** — a system rule is in force (chat reset, locked timetable, released grade, expiring link, Pass A)
- **Amber** — needs attention (due today, resubmit, below threshold)
- **Red** — a real problem (fail risk, attendance breach)
- **Ink** — everything settled, including success

## Checks

- No status pill in the app renders `oklch(0.38 0.085 155)` or `oklch(0.93 0.045 155)`.
- `--color-accent` still appears on hover states, the chat pill chip, and `.sheet-accent` entry cards.
- A passed assignment, an attended class and a to-standard TP all read as ink with a filled dot, and are still visually distinct from an unmarked state.
