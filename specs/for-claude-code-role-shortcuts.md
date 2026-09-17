# Role shortcuts — installable app icons, one per role (17 Sep 2026)

For Claude Code. Companion to `Role Shortcut Icons.dc.html`, which draws the set at every size it has to survive.

## What this is for

Somebody saves Connect to their desktop or dock and it opens their own room — a candidate lands on Course Stream, a tutor on Today, a volunteer on their group. Six shortcuts, one mark, the colour and badge letter saying whose it is.

## The blocker

`src/app/manifest.ts` is a single manifest with a single `start_url`, so all six would install as the same app with the same icon. A per-role shortcut needs a per-role manifest.

## 1 · The roles

| Role | Slug | Badge | Room | `start_url` | Ground | Badge |
| --- | --- | --- | --- | --- | --- | --- |
| Candidate | `candidate` | `C` | Course Stream | `/portfolio` | `oklch(30% 0.042 58)` | `oklch(63% 0.096 72)` on `oklch(23.5% 0.017 65)` |
| Trainer · MCT | `trainer-mct` | `M` | Today, the hub | `/trainer` | `oklch(42% 0.13 27)` | `oklch(99% 0.004 85)` on `oklch(42% 0.13 27)` |
| Trainer · ACT | `trainer-act` | `A` | Today, the hub | `/trainer` | `oklch(50% 0.09 62)` | `oklch(99% 0.004 85)` on `oklch(44% 0.095 68)` |
| Volunteer | `volunteer` | `V` | Your group | `/volunteer` | `oklch(40% 0.08 150)` | `oklch(80% 0.11 140)` on `oklch(28% 0.06 150)` |
| Student | `student` | `S` | Your lessons | `/student` | `oklch(37.5% 0.058 195)` | `oklch(63% 0.096 72)` on `oklch(23.5% 0.017 65)` |
| Centre | `centre` | `B` | Centre Admin | `/centre` | `oklch(23.5% 0.017 65)` | `oklch(63% 0.096 72)` on `oklch(23.5% 0.017 65)` |

`start_url` values above are the front doors as they exist today; use `adminHomePath()`'s result where a role's home is role-dependent rather than hardcoding a path that only works for one permission set. A shortcut that lands on a redirect is fine — it will resolve to the right room — but it must not land on `/login` for a signed-in user.

## 2 · Route per role

`src/app/manifest.ts` stays as the generic Connect manifest (the one a plain visitor gets). Add:

```
src/app/shortcuts/[role]/manifest.webmanifest/route.ts
```

returning, per role: `name: "Connect — <Label>"`, `short_name: "<Label>"`, `start_url`, `display: "standalone"`, `background_color`, `theme_color: <the role's ground>`, and `icons` pointing at that role's PNGs. Validate `[role]` against the slug list above and 404 anything else — an unvalidated segment here is an open redirect surface via `start_url`.

Each role's landing then declares its own manifest in metadata, so "install this app" from a candidate's Course Stream installs the candidate shortcut.

## 3 · The icons

`icons/` in this handoff has SVG masters for all six, at three drawings:

- `connect-<slug>-512.svg` — full mark, badge. The master. Export PNG at 512 and 192.
- `connect-<slug>-32.svg` — full mark, **no badge**. At 32px a badge letter is ~7px and reads as dirt.
- `connect-<slug>-16.svg` — **one arc**, no badge. At 16px the second arc closes into a blob and the two-arc mark becomes a smudge.

Export to PNG at 16, 32, 48, 192, 512 (`sharp`, or any rasteriser) into `public/icons/`. Declare 192 and 512 as `purpose: "any maskable"`; the 112/512 corner radius on the master already sits inside the maskable safe zone, and the mark occupies the middle 60%, so a circular mask on Android does not clip it.

Colours in the SVGs are already sRGB hex, converted from the oklch tokens through Oklab (not eyeballed) — rasterisers do not read oklch, which is why the masters do not carry the token values directly:

| Role | Ground | Token |
| --- | --- | --- |
| Candidate | `#3e2818` | `oklch(30% 0.042 58)` |
| Trainer · MCT | `#862723` | `oklch(42% 0.13 27)` |
| Trainer · ACT | `#885627` | `oklch(50% 0.09 62)` |
| Volunteer | `#235430` | `oklch(40% 0.08 150)` |
| Student | `#0f4a4b` | `oklch(37.5% 0.058 195)` |
| Centre | `#241d16` | `oklch(23.5% 0.017 65)` |

Arcs and badges: gold `#ad7f43` (`oklch(63% 0.096 72)`), near-white `#fdfcf9` (`oklch(99% 0.004 85)`), ink `#241d16`. If a token is ever retinted, regenerate rather than hand-editing these.

The badge letter is live `<text>` in Karla. Convert it to a path before export, or the rasteriser will substitute whatever it has and the letterform will not match the app.

## 4 · Two corrections found on the way

**`manifest.ts`'s `background_color` is stale.** It is `"#faf7f2"`, and its own comment says that is `--color-background` at `oklch(97.8% 0.008 85)`. The page ground moved to `oklch(92.5% 0.012 85)` on 16 Aug 2026 (`globals.css:36`), so every splash screen opens a shade lighter than the app it is opening. Correct value: `#eae6dd`. Fix the comment too — it names a value the app has not used for a month.

**`theme_color` per role is the point, not decoration.** On Android the status bar takes it; a candidate's shortcut showing the trainer's garnet would be the only place in the app where role colour lies.

## 5 · Order

The manifest route and the `background_color` fix are small and independent — do them first. The PNG export is mechanical once the SVGs are in. Nothing here touches an existing screen except each landing's metadata.
