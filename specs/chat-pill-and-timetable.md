# Connect — Chat Pill & Timetable Spec

Source file: `Chat Pill.dc.html` (design reference, HTML prototype). Implement in your existing stack; do not copy the HTML.

---

## 0. Tokens used by both

| Token | Value | Use |
|---|---|---|
| `--surface-page` | `#F7F1E4` | app background (cream) |
| `--surface-card` | `#FFFDF7` | cards, pill, popovers |
| `--green-tint` | `#EEF4E7` | selected/soft chip fill |
| `--green-tint-2` | `#F1F6EB` | secondary button fill |
| `--green-hover` | `#E5EEDA` | hover on green fills |
| `--green-chip` | `#DCE8D5` | avatar chip fill (inactive) |
| `--green-ink` | `#41563A` | text on `--green-chip` |
| `--green-solid` | `#6E8F58` | active avatar chip |
| `--brass` | `#B3762B` | accent: reset dot, unread badge, send hover |
| `--ink` | `#1C1710` | primary text, send button |
| `--ink-82` | `rgba(28,23,16,0.82)` | message body |
| `--ink-45` | `rgba(28,23,16,0.45)` | meta text |
| `--ink-38` | `rgba(28,23,16,0.38)` | timestamps, placeholder |
| `--hairline` | `rgba(28,23,16,0.10)` | borders, dividers |
| `--hairline-soft` | `rgba(28,23,16,0.07)` | timetable card border |

Type: **Instrument Sans** (400/500/600) for UI; **IBM Plex Mono** (400/500) for meta labels, always uppercase with `letter-spacing: 0.06–0.12em`; **Instrument Serif italic** for the "Connect" wordmark only.

Shadows: pill `0 10px 30px rgba(28,23,16,0.10)`; popovers `0 18px 44px rgba(28,23,16,0.12–0.14)`.

---

## 1. Chat Pill

### Placement
Fixed, `bottom: 26px`, horizontally centered, `width: 840px`. Container is `pointer-events: none`; only the pill stack itself accepts pointer events, so the page underneath stays fully clickable. Stack is a column, `gap: 8px`, growing **upward**: picker → thread → bar.

### Auto-hide
- Idle after **3500ms** with no hover, focus, or input → `opacity: 0.4`, `transform: translateY(14px)`.
- Wakes on `mouseenter`, input focus, typing, or any click on the pill → `opacity: 1`, `translateY(0)`.
- Transition: `opacity 260ms ease, transform 260ms ease`.
- The timer never runs while the thread or picker is open.
- On `mouseleave`, restart the idle timer only if both thread and picker are closed.

### The bar
`height: 56px`, `border-radius: 28px`, `background: --surface-card`, `1px solid --hairline`, `padding: 0 10px 0 8px`, flex row, `align-items: center`, `gap: 12px`. Never grows — a long message scrolls inside the input.

Left to right:

1. **Channel chip** (`flex: none`) — `height: 40px`, `border-radius: 20px`, `padding: 0 12px 0 8px`, `background: --green-tint`, hover `--green-hover`. Contains: 24×24 avatar tile (`border-radius: 8px`, `--green-solid` ground, `#FFFDF7` text, 9px/600 initials), channel name (13px/600, `max-width: 130px`, ellipsis), and a 9px `▾` in `--ink-45`. Click toggles the picker.
2. **Divider** — 1px × 24px, `--hairline`.
3. **Input** (`flex: 1; min-width: 0`) — transparent, no border, 14px Instrument Sans. Placeholder: `Message the group — clears at midnight` in `--ink-38`. Enter sends.
4. **Reset meter** (`flex: none`) — 5px brass dot + IBM Plex Mono 10px `CLEARS IN 14H 22M`, `--ink-38`, `letter-spacing: 0.06em`. Recomputed from local time every 30s; hours/minutes remaining until 00:00 local, minutes zero-padded.
5. **Thread toggle** (`flex: none`) — `height: 34px`, `border-radius: 17px`, `padding: 0 12px`, `--green-tint-2`, hover `--green-hover`. Label `Thread` / `Hide` (12px/600) + unread badge: `min-width: 18px; height: 18px; border-radius: 9px`, brass ground, `#FFFDF7` 10px/600 count.
6. **Send** (`flex: none`) — 38px circle, `--ink` ground, `#FFFDF7` arrow, hover `--brass`. Disabled behavior: empty/whitespace draft is a no-op.

### Thread panel
Appears directly above the bar when open. `border-radius: 20px`, `--surface-card`, `1px solid --hairline`, `padding: 16px 18px`, `max-height: 260px`, `overflow: auto`, column `gap: 12px`. Rows: 24px avatar tile (`border-radius: 8px`, `--green-chip` / `--green-ink`; own messages use brass ground + cream text) + column with `name (12px/600) · time (Plex Mono 10px, --ink-38)` and body (13px, `line-height: 1.45`, `--ink-82`, `text-wrap: pretty`). Newest at the bottom; scroll to bottom on send.

### Channel picker
Opens above the stack, `align-self: flex-start`, `width: 300px`, `border-radius: 16px`, `--surface-card`, `1px solid --hairline`, `padding: 8px`. Header: Plex Mono 10px `CHOOSE A CHANNEL`, `--ink-45`, padding `10px 12px 8px`. Rows: `padding: 9px 12px`, `border-radius: 11px`, hover `--green-tint`, selected row `--green-tint-2` with `--green-solid` avatar. Row = 26px avatar tile + name (13px/500, flex 1) + meta (Plex Mono 10px, `--ink-45`, e.g. "42 online", "18 people", "trainer"). Selecting a channel closes the picker and opens the thread.

Channel model: `{ id, name, initials, meta, kind: 'all' | 'group' | 'dm' }`. Seed set: Everyone (all), Cohort 24B (group), two DMs, Cairo Centre (group).

### Midnight reset
All messages are ephemeral. At local midnight the store empties for every channel; the countdown resets to `23H 59M`. Two places state this: the input placeholder and the reset meter. If the tab is open through midnight, clear in place and show the empty thread rather than reloading.

### State
`{ activeChannelId, threadOpen, pickerOpen, draft, awake, messagesByChannel, now }`. `now` ticks every 30s only to drive the countdown.

### Accessibility
Channel chip and thread toggle are buttons with `aria-expanded`. Thread panel is `role="log"`, `aria-live="polite"`. Escape closes picker then thread. Pill is reachable by keyboard even while dimmed — focus forces `awake`. The 0.4 dim applies to the pill only, never to focused state.

---

## 2. Timetable (trainer view)

Note: in the prototype this is a **shell** — real cell content is not designed yet. Structure and chrome are final; cell interior is placeholder.

- Page padding `40px 56px`, column `gap: 26px`, background `--surface-page`.
- **Header row**: left = logo lockup (Instrument Serif italic "Connect" 24px brass + "CELTA" 11px/600, `letter-spacing: 0.12em`, ink, `gap: 8px`, baseline-aligned). Right = Plex Mono 11px `TRAINER / TIMETABLE`, `--ink-45`, `letter-spacing: 0.08em`.
- **Grid**: `display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px`. First row is day labels (11px/600, `letter-spacing: 0.12em`, `--ink` at 50%), then session cells.
- **Session card**: `height: 74px`, `border-radius: 10px`, `--surface-card`, `1px solid --hairline-soft`, `padding: 10px`, column `gap: 6px`. Placeholder interior is two rounded bars (7px tall, 46% and 72% width) — replace with session title (13px/600) and room/cohort meta (11px, `--ink-45`).
- Empty slot: same box with no border and no fill, or a dashed `--hairline` outline for bookable slots.
- The whole grid sits at `opacity: 0.5` in the prototype only, to demonstrate pill legibility. Ship at full opacity.
- Reserve **96px** of bottom padding on any scroll container so the pill never covers the last row.

---

## Open items
- Session card content model (title, time, room, cohort, status) not yet designed.
- Week navigation, today marker, and time-of-day axis not yet designed.
- Mobile layout for both components not yet designed.
