# Connect type scale — one scale for the whole app (16 Sep 2026)

Read against `ramysakr1-ux/celta-connect@main` (tree f8af5d6e7c99). A search for `text-[Npx]` returns 830+ matches in the first 400 files under `src/app` alone, using these arbitrary values: 9, 9.5, 10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14, 15, 17, 19, 21, 23, 24, 26, 28, 33, 34, 44. Plus Tailwind's `text-xs/sm/base/lg/xl/2xl` (12/14/16/18/20/24) and inline `fontSize:` numbers in the sheet components. Roughly 30 distinct sizes for a product that needs 9.

Nobody chose these. Each page picked what looked right in isolation. The result is two identical labels on adjacent screens half a pixel apart, and an app that reads as slightly uneven without anyone being able to say why.

---

## 1 · The scale

Nine steps. Two families (Karla sans for UI, Newsreader serif for titles and figures). Every text node in the app lands on one of these.

| Token | px | Family | Line | Use |
|---|---|---|---|---|
| `--text-micro` | 10.5 | sans 700 | 1.2 | Criteria codes, tag chips, table column heads, the smallest caps eyebrow (0.12em) |
| `--text-label` | 11.5 | sans 600–700 | 1.3 | Eyebrows (0.1em caps), pill text, meta labels, form field labels-above |
| `--text-meta` | 12.5 | sans 400–600 | 1.45 | Sub-lines, timestamps, helper text, guide text, table cells |
| `--text-body` | 13.5 | sans 400–600 | 1.55 | Body copy, row titles, inputs, buttons, list items |
| `--text-lede` | 16 | sans 400 | 1.6 | Opening paragraph under a room head; long-form reading (session content) |
| `--text-h3` | 17 | serif 600 | 1.3 | Card and panel headings |
| `--text-h2` | 21 | serif 600 | 1.25 | Section heads inside a sheet; column heads (Planning / Teaching) |
| `--text-h1` | 28 | serif 600 | 1.15 | Room head title; hero title; KPI figures (tabular) |
| `--text-display` | 34 | serif 600 | 1.08 | Sentence titles (Concerns, New course, Assessor history); dark-band titles (owner, assessor pack); hero time is 44 = display × 1.3, the one exception |

Weights: sans 400/600/700 only (no 500). Serif 600 only, italic 500 for quoted candidate text. Tracking: caps eyebrows only, and the value follows the shell -- 0.08em in the centre rooms, the assessor pack, admissions, login and Command Center; 0.12em in the trainer hub, the candidate's shell and the input sessions (post-build audit B4, 17 Sep 2026: the platform settled on these two, and the rule follows the code). `.eyebrow` in globals.css carries both; use it on new work. Nothing else tracked.

## 2 · The mapping (mechanical)

| Found | → Token |
|---|---|
| 9, 9.5, 10, 10.5 | micro 10.5 |
| 11, 11.5, `text-xs` (12) | label 11.5 |
| 12, 12.5, 13 | meta 12.5 (13 → body if it is a row title or input; otherwise meta) |
| 13.5, 14, `text-sm` | body 13.5 |
| 15, 15.5, `text-base` (16) | lede 16 if it is a paragraph; h3 17 if it is a serif heading |
| 17, 18, `text-lg`, 19 | h3 17 |
| 20, `text-xl`, 21, 22, 23 | h2 21 |
| 24, `text-2xl`, 26, 28 | h1 28 |
| 30, 32, 33, 34, 36 | display 34 |
| 40, 44 (hero time only) | keep 44 |

Serif vs sans decides between lede/h3 and between h1/display only; the px mapping is otherwise unconditional.

Exceptions that keep their size: the CELTA 5 booklet (`c5-*`, a Cambridge document), the Notebook (own paper register), the PDF routes, email templates. Everything else in `src/app` and `src/components` maps.

## 3 · How to apply

1. Add the nine tokens to `globals.css` `@theme` as `--text-*` with their line-heights, so `text-body` etc. become Tailwind utilities.
2. One codemod pass over `src/app/**` and `src/components/**`: regex `text-\[(\d+(\.\d+)?)px\]` and inline `fontSize: N` → token per the table. Serif/sans decision by presence of `font-serif` / `owner-serif` / `fontFamily: …serif` on the same element. 
3. Replace `text-xs/sm/base/lg/xl/2xl` with the mapped token (they are the same problem in Tailwind's clothing).
4. Visual pass on: Course Stream, trainer Today, Centre overview, assessor pack, feedback writer, timetable. Anything that broke is a layout that depended on a half-pixel; fix the layout, not the size.
5. Lint rule: forbid `text-[…px]` and inline `fontSize` in `src/app` and `src/components` outside the four exceptions.

## 4 · Where the specs already said this

- Trainee spec B8 (sizes list) → superseded by this table.
- Feedback writer spec B2 (ten sizes in one component) → superseded.
- Centre spec B5 (card `<h2>` 16/18/19 → 17) → this is h3.
- Assessor spec A1 (Georgia → Newsreader) is a family fix, orthogonal; do it first.

## 5 · Order

Do this **after** the shell specs' A items and **before** their B items. The A items delete markup (garnet alternation, duplicate plan panels, dead files); no point retyping text that is about to go. The B items (RoomHead, card surfaces) then land on the scale rather than on the old sizes.
