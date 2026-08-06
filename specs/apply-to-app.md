# Implementation spec — apply the designs to celta-connect

Repo: `ramysakr1-ux/celta-connect` @ `main` (read 2026-08-06). Two changes, independent of each other. Both stay inside the existing token set, fonts, and data model — no new dependencies, no new migrations, no new fonts.

## Global translation rules

The HTML explorations in this project used a green accent, brass gold, Instrument Sans/Serif, and IBM Plex Mono. None of that ships. Map as follows:

| Design used | Ship as |
|---|---|
| light green `#EEF4E7` / `#F1F6EB` wash | `bg-accent/40` (pale teal) |
| green hover `#E5EEDA` | `bg-accent/60` |
| green solid `#6E8F58` | `bg-primary text-primary-foreground` |
| green ink `#41563A` | `text-accent-foreground` |
| brass `#B3762B` | `text-gold` / `bg-gold` — reset dot, unread badge, live indicators only |
| ink `#1C1710` | `text-ink` |
| cream panel `#FFFDF7` | `bg-card` |
| hairlines | `border-border-faint` (structure) / `border-border` (interactive edges) |
| IBM Plex Mono labels | Karla (`font-sans`) at `text-[10px] font-semibold uppercase tracking-[0.12em] text-muted` |
| Instrument Serif italic | nothing — reserved to `Wordmark` |
| headings | `font-serif` (Newsreader), as today |

Keep the existing "no box-shadows" rule everywhere except the chat pill, which is a floating overlay and needs `shadow-lg` to separate from page content (the current drawer already does this).

---

# 1. Chat pill — replaces the StaffChatDrawer chrome

File: `src/app/dashboard/staff-chat/staff-chat-drawer.tsx`. Rewrite the presentation only. **Do not change**: the component's props, `MessageThread` and its `MessageThreadHandle.send`, the `get_or_create_dm_channel` RPC, the unread realtime subscription, `readOnly`/`staticMessages` preview behaviour, or `deleteStaleStaffMessages`. Callers in `dashboard/layout.tsx`, `trainer/(hub)/layout.tsx`, and `portfolio/[traineeId]/preview-chrome.tsx` must keep working untouched.

## 1.1 Positioning — the main behavioural change

Today the pill is invisible until the cursor enters a 44px strip. Replace that with **always present, dimmed at rest**:

- Container: `fixed bottom-6 left-0 right-0 z-30 flex justify-center pointer-events-none`.
- Inner stack: `pointer-events-auto w-full max-w-[840px] flex flex-col gap-2` — grows upward (picker → thread → bar).
- Rest state after **3500ms** of no hover / focus / typing: `opacity-40 translate-y-3.5`.
- Awake: `opacity-100 translate-y-0`. Transition `opacity 260ms ease, transform 260ms ease`.
- Wake triggers: `mouseenter` on the stack, textarea `focus`, any keystroke, any click inside.
- Never start the idle timer while the thread panel or picker is open.
- On `mouseleave`, restart the timer only if both are closed.
- Keyboard focus must force awake — the dim must never hide a focused control. Keep a visible `focus-visible` ring using `--color-ring`.

Rationale for the change: the current version is undiscoverable and unreachable by keyboard. 40% opacity keeps it out of the way while watching a lesson without hiding it outright. Drop the `left-36 right-36` sizing in favour of the centered 840px max width.

## 1.2 The bar

`h-14 rounded-[28px] bg-card border border-border shadow-lg flex items-center gap-3 pl-2 pr-2.5`. Fixed height — it must never grow. Contents left to right:

1. **Channel chip** — `button`, `h-10 rounded-[20px] bg-accent/40 hover:bg-accent/60 pl-2 pr-3 flex items-center gap-2 shrink-0`, `aria-expanded` bound to picker state.
   - Avatar: `size-6 rounded-[8px] bg-primary text-primary-foreground text-[9px] font-semibold flex items-center justify-center` — initials from the channel name (group channels: first two letters of the name, uppercase; DMs: initials of `full_name`).
   - Name: `text-[13px] font-semibold max-w-[130px] truncate`.
   - Caret: `text-[9px] text-muted`.
   - Empty state (no channels): label "Pick who to message", avatar shows `+`.
2. **Divider** — `w-px h-6 bg-border`.
3. **Composer** — keep the existing auto-resizing `textarea` (rows=1, max 96px, Enter sends, Shift+Enter newline) but strip its border and background: `flex-1 min-w-0 resize-none bg-transparent border-0 outline-none text-sm text-ink placeholder:text-muted/70`. Placeholder: `Message ${selected.name} — clears at midnight`.
4. **Reset meter** — `shrink-0 flex items-center gap-1.5`: a `size-[5px] rounded-full bg-gold` dot + `text-[10px] font-semibold uppercase tracking-[0.06em] text-muted` reading `Clears in 14h 22m`. Compute client-side from local midnight; recompute on a 30s interval. This replaces the current `Messages reset nightly — nothing here is saved.` line, so the promise stays visible on the bar itself (Ramy's original requirement) without spending a whole row on it.
5. **Thread toggle** — `h-[34px] rounded-[17px] px-3 bg-accent/40 hover:bg-accent/60 text-xs font-semibold shrink-0 flex items-center gap-1.5`, label `Thread` / `Hide`, `aria-expanded`. Unread count badge: `min-w-[18px] h-[18px] rounded-full bg-gold text-gold-foreground text-[10px] font-semibold px-1.5 flex items-center justify-center`. Wire the count to the existing unread realtime watcher (currently only used for `flash`): increment per inbound message in one of my channels, clear when the thread panel is opened. Keep the `flash` ring behaviour on the Send button as a secondary cue, or retire it now that there's a real badge — your call, but don't keep both fighting.
6. **Send** — `size-9 rounded-full bg-ink text-card hover:bg-gold disabled:opacity-60 shrink-0`, arrow glyph (lucide `ArrowUp`, `size-4`) instead of the word "Send". Disabled when the draft is empty or no channel is selected.

## 1.3 Thread panel

Replace `latestOnly` in the expanded state with the full history. Panel: `rounded-[20px] bg-card border border-border shadow-lg p-4 max-h-[260px] overflow-y-auto`. Render `MessageThread` with `hideComposer` and **without** `latestOnly`, so the existing message list, dedupe, realtime subscription, and `startOfToday` filter all apply unchanged.

Message rows — switch from left/right bubbles to a single left-aligned column, which reads better in a short panel:

- Row: `flex gap-2.5 items-start`.
- Avatar: `size-6 rounded-[8px] text-[9px] font-semibold flex items-center justify-center shrink-0` — mine `bg-gold text-gold-foreground`, others `bg-accent text-accent-foreground`.
- Header line: name `text-xs font-semibold` + time `text-[10px] text-muted` (keep the existing `toLocaleTimeString` format).
- Body: `text-[13px] leading-[1.45] text-ink/85 text-pretty`.
- Newest at the bottom. Keep the existing bottom-anchor scroll, but **do not use `scrollIntoView`** — set `el.scrollTop = el.scrollHeight` on the panel instead. (`scrollIntoView` in `message-thread.tsx` can scroll the whole page; it's a real bug in the current build.)

Collapsed state shows no thread at all — the `latestOnly` preview row goes away. If you want to keep a one-line peek, put it inside the bar, not above it.

## 1.4 Picker

Anchored above the stack, `w-[300px] rounded-[16px] bg-card border border-border shadow-lg p-2`, still a later DOM sibling of the bar so it isn't clipped. Header: `Choose a channel` in the mono-substitute label style, `px-3 pt-2.5 pb-2`. Rows: `w-full text-left px-3 py-2.5 rounded-[11px] flex items-center gap-2.5 hover:bg-accent/40`, selected row `bg-accent/25` with a `bg-primary` avatar. Row content: avatar (as above, `size-[26px]`) + name `text-[13px] font-medium flex-1` + meta `text-[10px] text-muted`.

Meta text per channel type, from data you already have: `center_trainers`/`all_staff` → member count if cheap, else "group"; `tp_group` → "TP group"; `dm` → "trainer". Keep the current flat ordering (group first, then coworkers) and the same click behaviour, including `startingDm` disabling.

Escape closes the picker, then the thread.

## 1.5 Read-only preview

Unchanged in behaviour. Render the bar with the composer, meter, and Send **disabled** (`opacity-60`, `cursor-default`) and the channel chip non-interactive, plus a `text-xs text-muted` line in place of the composer: `Previewing "${name}" — read-only`. Don't hide the pill in preview; a visible disabled bar is what makes the preview accurate.

---

# 2. Timetable — sleeker treatment, same orientation

Files: `src/app/trainer/(hub)/timetable/timetable-grid.tsx`, `event-cell.tsx`, `mobile-day-view.tsx`. **Keep**: the transposed orientation (days as rows, time bands as columns, "Admin & deadlines" as the leading column), `table-fixed` with the concrete-px `colgroup`, equal `COLUMN_WIDTH_PX` for admin and every band, equal `ROW_HEIGHT_PX` per day row, internal cell scrolling, per-course `time_bands`, `categorize`, `overridesband`, `isLive`, and the lock flow. Nothing in `src/lib/timetable-grid.ts` changes.

What changes is the finish: today the grid reads as coloured boxes inside boxes inside a `.sheet`. Strip it to hairlines and typography.

## 2.1 Table chrome

- Drop `border-separate border-spacing-1`. Use `border-collapse` with hairline dividers so the grid reads as one continuous surface: each `<td>` gets `border-b border-border-faint` and `border-r border-border-faint`; last column no right border, last row no bottom border. Cells then sit flush with no rounded islands.
- Cell padding `p-2.5` (was `p-1` around an inner padded box — two nested paddings for one cell).
- Remove `rounded-[6px]` from cells and header cells. Radius belongs to the enclosing `.sheet`, not to every cell.
- Remove the alternating `bg-surface-muted/50` row tint. With real dividers the rows are already legible, and the tint is what makes the grid feel heavy. If day separation still reads weakly at 5+ weeks, make the **day boundary** divider `border-border` while the in-day dividers stay `border-border-faint` — a hierarchy of hairlines, not a fill.

## 2.2 Band header row

- Remove `bg-accent` from the `<th>`s. Header cells become `sticky top-0 z-10 bg-background px-2.5 pb-2.5 text-left align-bottom border-b border-border`.
- Band label style: `text-[10px] font-semibold uppercase tracking-[0.12em] text-muted`. Print the band's start and end on two lines (`10:00` / `12:30`) rather than one `10:00–12:30` string — it fits the 147px column without wrapping mid-range.
- "Admin & deadlines" label: same style, `text-gold` instead of `text-muted`, so the one non-time column is distinguishable without a fill.

## 2.3 Day gutter (leftmost column)

Currently `w-16` with `"Mon 10"` in bold 12px. Replace with a two-part label, still 64px:

- Day of month: `font-serif text-[20px] leading-none text-ink`.
- Weekday: `text-[10px] font-semibold uppercase tracking-[0.12em] text-muted`, on the line below.
- Today: day number in `text-primary`, and keep a `border-l-[3px] border-primary` on the gutter cell. Drop nothing else — one marker is enough.
- Week label rows keep `font-serif`, but set `text-muted` and add `pt-6 pb-2` so each week reads as a real break in the sheet.

## 2.4 Event cells

In `event-cell.tsx`, replace `CATEGORY_CLASS` fills with a left rule + dot. The shared-box-per-cell structure stays exactly as is (one box, events as internal divider rows) — that decision was correct.

```
CATEGORY_ACCENT = {
  admin: "var(--color-gold)",
  wg:    "var(--color-primary)",
  rm:    "var(--color-ink)",
  iw:    "var(--color-muted)",
  lu:    "transparent",
}
```

- Cell box: `bg-transparent text-xs leading-snug pl-2.5 border-l-[3px]` with `borderLeftColor` from the map above. No background fill, no border on the other three sides. `lu` (lunch) gets no left rule and `text-muted` — it should recede.
- Event title: `text-[12px] font-medium text-ink` (was inheriting the category's text colour).
- Time override, tag, and attendance summary: `text-[10px] text-muted`.
- Row divider between stacked events in one cell: `border-t border-border-faint pt-1.5 mt-1.5` (currently `border-current/15`, which shifted colour per category).
- Delete `×`: hide at rest, show on cell hover/focus (`opacity-0 group-hover:opacity-100 focus-visible:opacity-100`), `text-muted hover:text-destructive`. The destructive glyph on every card at rest is the single noisiest element in the grid.

## 2.5 Join chip

Keep `isLive` exactly. Two states, both quieter:

- **Live**: `inline-flex items-center gap-1 rounded-full bg-primary text-primary-foreground px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]` + the existing `CameraIcon`, label `Join`. Add a `size-[5px] rounded-full bg-gold` leading dot so live sessions catch the eye at a glance across the grid.
- **Not live**: icon only, no pill, no border, no label — `text-muted/70`, `title="Zoom link — opens 10 minutes before the session"`, `aria-disabled`. Currently every Zoom event carries a full bordered "JOIN" chip whether or not it's clickable, which is most of the visual weight in a busy column.

## 2.6 Attendance

Keep the `<details>`, but style the summary as the label style (`text-[10px] uppercase tracking-[0.12em] text-muted`) reading `Attendance 3/5`, and the open panel as `.sheet` with `p-2.5 text-xs`. No other change.

## 2.7 Page shell

In `timetable/page.tsx`: keep every section, but the header `.sheet` should carry the week range as a `font-serif text-2xl` line under the existing `h1`, since the grid itself no longer prints a strong week header. The lock button keeps its current two states; when locked, add a `size-[5px] rounded-full bg-gold` dot before the label to match the pill's language of "one small gold dot means a system rule is in force".

## 2.8 Mobile

`mobile-day-view.tsx` inherits the same finish: hairline dividers instead of coloured cards, left rule for category, icon-only Zoom when not live. Don't port the desktop table to mobile.

---

## Checks before you call it done

1. The pill is visible (dimmed) on first paint, reachable by Tab, and never covers the last row of the timetable — the grid's scroll container needs `pb-24`.
2. The reset countdown matches `deleteStaleStaffMessages`'s local-midnight boundary, not a UTC one.
3. Every timetable column is still exactly `COLUMN_WIDTH_PX` and every day row exactly `ROW_HEIGHT_PX` — the equal-dimensions rule is not up for renegotiation.
4. No new box-shadows outside the chat pill and its two popovers.
5. Nothing anywhere loads Instrument Serif/Sans except `Wordmark`.
