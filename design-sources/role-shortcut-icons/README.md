# Role shortcut icons — masters

The SVG masters from `design_handoff_role_shortcuts` (17 Sep 2026): six roles
× three drawings (512 with the badge letter, 32 without it, 16 as a single
arc). `karla-700.ttf` is Karla Bold from Google Fonts (SIL OFL) — the badge
letter is live `<text>` in the masters and has to become a path before
rasterising, or the renderer substitutes whatever font it has.

    node scripts/export-role-icons.mjs

writes `public/icons/connect-<slug>-{16,32,48,192,512}.png`. Re-run after any
change here; never hand-edit the PNGs.
