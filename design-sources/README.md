# Design sources

Ramy's own design files, kept here because they are the authority for the
screens built from them and because losing access to them has cost real
time twice: macOS blocks this environment from reading `~/Desktop`, so a
file that lives only there cannot be re-read when a detail needs checking.

| File | Authority for |
|---|---|
| `celta5-record-booklet.html` | The CELTA 5 booklet — trainee and assessor views (`src/app/portfolio/[traineeId]/celta5/`). 15 pages; the copy with page numbers stamped on each. |
| `timetable-view.html` | The read-only timetable board (`src/app/portfolio/[traineeId]/timetable/read-only-board.tsx`). Day rows, nine time bands, glass cards, Everything/Mine lens. |

Both are `.dc.html` bundles: the page itself is a JSON-encoded string inside
a `<script>` tag, with closing tags escaped as `/`. To read one:

```js
const page = JSON.parse(
  [...html.matchAll(/<script[^>]*>(.*?)<\/script>/gs)]
    .map((m) => m[1])
    .find((s) => s.trim().startsWith('"<!DOCTYPE'))
);
```

**Where these do not win.** Ramy, 29 Aug 2026, on Section 12: "It's also
wrong in the design that I gave you." Where a design file and the real
Cambridge CELTA 5 disagree, Cambridge wins — the master document is at
`src/lib/celta5-replica-pdf/assets/celta5-master-july-2023.pdf`.
