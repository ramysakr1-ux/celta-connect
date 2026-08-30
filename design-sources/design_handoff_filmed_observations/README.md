# Handoff — Filmed Observations

Scope: filmed observations only — the Resource Hub panel (§3a), the watch screens, the
observation task, and filming consent. Pre-course Task and everything else in
`Resource Hub.dc.html` are out of scope for this package.

## Fidelity

Exact values, not approximations. Every number and colour below is copied from the design source
(`Resource Hub.dc.html`, section `#3a`). `filmed-observations.html` in this folder is that section
lifted verbatim — open it in a browser and measure against it.

## Tokens

| Role | Value |
| --- | --- |
| Page background | `oklch(92.5% 0.012 85)` |
| Panel / surface | `oklch(96.4% 0.014 85)` |
| Card | `oklch(99.2% 0.005 90)` |
| Border | `oklch(88% 0.016 82)` |
| Ink (primary text) | `oklch(23.5% 0.017 65)` |
| Muted text | `oklch(51% 0.017 70)` |
| Teal / primary | `oklch(38% 0.072 195)` |
| Gold / accent | `oklch(60% 0.11 70)` |
| Button (dark) | `oklch(30% 0.042 58)` |
| Chip background | `oklch(93.5% 0.016 85)` |
| UI font | Karla 400/500/600/700 |
| Display font | Newsreader 500/600/700 |

Every accent tint is a `color-mix`, never a new hex: e.g. gold border is
`color-mix(in oklab, oklch(60% 0.11 70) 34%, transparent)`, gold badge fill is
`color-mix(in oklab, oklch(60% 0.11 70) 16%, oklch(99.2% 0.005 90))`.

## 3a — Video Library vs Filmed Observation

Two things that both say "video" and must not be conflated. Side by side, `grid-template-columns: 1fr 1fr`, gap 20px.
Each panel: background `oklch(96.4% 0.014 85)`, 1px border, radius 8px, padding 20px, flex column, gap 14px.
Heading Newsreader 17px/600 ink; badge top-right 10px/700, letter-spacing 0.05em, padding 2px 8px, radius 999px.

### Left — Video Library (badge "External links", chip fill `oklch(93.5% 0.016 85)`, muted ink)

A plain browsable shelf of trainer-pasted links. Nothing hosted, no task, no consent, no timetable tie.
Included here only because the two are adjacent in the hub and must read as different things.

- **Empty state** (current real state): card background, 1px **dashed** border, radius 6px, padding 16px, centered.
  "No videos added yet" 12.5px muted, sub-line 11px muted.
- **Populated row:** card background, 1px solid border, radius 6px, padding 13px, flex, gap 10px.
  Icon square 26×26, radius 6px, fill `oklch(93.5% 0.016 85)`, glyph teal 14px (circle + play triangle).
  Title 13px/600 teal, underlined. Sub-line 11px muted. Opens in a new tab.
- Divider before the example: 1px, `color-mix(in srgb, border 60%, transparent)`.
  Section label above it: 10px/700, uppercase, letter-spacing 0.07em, muted.

### Right — Filmed Observation (badge "Task-linked", fill `color-mix(in oklab, gold 14%, card)`, gold ink)

The cohort's own filmed lesson: tied to a timetable event, watched in-app, consent on record, trainer-authored task.

- **Player card:** card background, 1px border, radius 6px, `overflow: hidden`.
  Thumbnail `aspect-ratio: 16/7`, fill `oklch(23.5% 0.017 65)`, centred 30px play glyph in `oklch(99.2% 0.005 90)`.
- **Body:** padding 13px, flex column, gap 8px.
  - Title 13px/600 ink.
  - Meta row: flex wrap, gap 10px 16px, 11px muted; labels (Teacher / Level / Learners) 600 in ink, values muted.
  - Aims block: 11px / 1.5; "Main aim" and "Sub aim" 600 in ink, on their own lines.
  - Chips: 1px border `oklch(88% 0.016 82)`, radius 999px, padding 1px 7px, 10px/600.
    "Observation task attached" muted · "Consent recorded" teal.
  - Closing line 11px muted about scripted pause points dropping in notes as the video plays.

### Note box (both panels, identical)

Background `color-mix(in oklab, gold 8%, card)`, 1px border `color-mix(in oklab, gold 30%, transparent)`,
radius 6px, padding 11px 13px. Label "Note to trainees" 11px/700 gold. Body 11.5px / 1.5 muted.
Both say the same thing in their own context: recordings run past 45 minutes, use the player's own seek bar,
you are not expected to watch every second.

## Screens

| Screen | File | What it is |
| --- | --- | --- |
| Hub panel (3a) | `filmed-observations.html` | The measurable reference for the panel pair |
| Watch — upload | `Filmed Observation Watch - Upload.dc.html` | Trainer-uploaded recording hosted in-app |
| Watch — link | `Filmed Observation Watch - Link.dc.html` | Recording behind an external link |
| Watch — custom player | `Filmed Observation Watch - Custom Player.dc.html` | In-app player with scripted pause points |
| Watch — group | `Filmed Observation Watch - Group.dc.html` | Cohort viewing variant |
| Observation task | `Filmed Observation Task.dc.html` | Trainer-authored task, trainee response, mark done |
| Filming consent | `Filming Consent.dc.html` | Consent capture before a session is filmed |

Playback is **independent per trainee, not synced** — a host-controlled "watch party" was considered
and rejected. Rationale is in `connect-video-library-and-filmed-observation-spec-2026-08-21.md` §3.

## Interactions

| Element | Behaviour |
| --- | --- |
| Video Library row | `target="_blank"` to the pasted external URL |
| Filmed Observation card | Link → `/portfolio/{traineeId}/filmed-observation/{sessionId}` |
| Hover (all cards) | Border → `color-mix(in oklab, teal 40%, transparent)`, background → `color-mix(in oklab, oklch(92% 0.028 190) 40%, card)` |
| Watch state | Per session: watched / not watched, task done / not done |

## Data

- Video Library: `tp_video_library` — plain external links, no storage.
- Filmed Observation: `filmed_observation_sessions` joined to `course_timetable_events`
  and `filmed_observation_tasks`. **Not** `resources.category='filmed_observations'` — that is a
  different, unrelated shelf and wiring it here was the bug fixed on 28 Aug 2026.
- New fields needed before playback (teacher, level, learners, main aim, sub aim) are specified in
  `connect-video-library-and-filmed-observation-spec-2026-08-21.md` §4.

## Assets

None. Icons are inline SVG (Lucide-style, `stroke-width: 2`, `stroke-linecap: round`): a circle-with-play
triangle for video. No images.

## Files

| File | What it is |
| --- | --- |
| `README.md` | This spec |
| `filmed-observations.html` | Section 3a lifted verbatim from the design source — the measurable reference |
| `Filmed Observation *.dc.html` | The watch, task and consent screens |
| `Filming Consent.dc.html` | Consent capture screen |
| `connect-video-library-and-filmed-observation-spec-2026-08-21.md` | Build spec: real links, fast-forward messaging, no-sync decision, new session fields |
| `for-claude-code-filmed-observation-watch.md` | Build spec for the watch screens |
| `for-claude-code-self-recording.md` | Build spec for self-recording |
