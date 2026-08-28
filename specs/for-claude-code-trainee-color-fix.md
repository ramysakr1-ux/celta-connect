# Trainee view — header color correction

`Trainee Walkthrough.dc.html`'s header accent was flagged as reading too pink. Fixed to a muted mauve: `oklch(42% 0.045 340)` (lower chroma, shifted hue), used on the header's left border and as the default panel-edge color throughout. Same rounded-card system (small panels get a left accent line, large panels get a top accent line) stays as already speced in `for-claude-code-trainee-assessor-card-system.md` — this is a color-only fix, not a structural change.

## Reference file

`Trainee Walkthrough.dc.html` — updated, build from this directly.
