# Self-hosted web fonts

These four faces used to come from `next/font/google`, which fetches them from
Google at BUILD time. That made every production build depend on a network
call: three builds failed on 23 Sep 2026 with "next/font/google queries have
exactly one entry" — two on Vercel and one locally — while immediate retries
passed. A deploy that can fail for reasons unrelated to the commit is worse
than a slightly larger repo.

Downloaded as the **latin** subset only, matching the `subsets: ["latin"]` the
Google loader was already asking for, and as the variable font where one
exists, so one file covers every weight the app uses.

| File | Family | Declared by Google as | Used for |
|---|---|---|---|
| `newsreader.woff2` | Newsreader | normal, weight `200 800` (variable) | `--font-newsreader`, the app's serif (500, 600) |
| `karla.woff2` | Karla | normal, weight `200 800` (variable) | `--font-karla`, the app's sans |
| `instrument-sans.woff2` | Instrument Sans | normal, weight `400 700`, stretch `75% 100%` (variable) | `--font-instrument-sans`, wordmark only (500, 600) |
| `instrument-serif-italic.woff2` | Instrument Serif | **italic**, weight `400` (static) | `--font-instrument-serif`, wordmark only |

The weight ranges and the `font-stretch` above are Google's own `@font-face`
descriptors, read from the css2 API rather than guessed — keep them in step
with `src/app/layout.tsx`, which restates them for `next/font/local`.

## Replacing one

Fetch the css2 URL with a modern browser User-Agent (an old one gets you TTF,
not woff2), take the `/* latin */` block's `src: url(...)`, and download that.
Then copy its `font-weight` / `font-style` / `font-stretch` into `layout.tsx`.

## Licence

All four are under the SIL Open Font License 1.1 — `OFL.txt` here — which is
why they can be served from this repo at all.

- Newsreader — Copyright 2020 The Newsreader Project Authors (http://github.com/productiontype/Newsreader)
- Karla — Copyright 2019 The Karla Project Authors (https://github.com/googlefonts/karla)
- Instrument Sans — Copyright 2022 The Instrument Sans Project Authors (https://github.com/Instrument/instrument-sans)
- Instrument Serif — Copyright 2022 The Instrument Serif Project Authors (https://github.com/Instrument/instrument-serif)
