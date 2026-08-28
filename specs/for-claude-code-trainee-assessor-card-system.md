# Trainee & Assessor views — card system + Assessor header

Applies the same visual system already sent for MCT/ACT (see `for-claude-code-trainer-role-color-system-final.md`) to the trainee and assessor views.

## Trainee — accent color + card edges

- Trainee accent: plum `oklch(52% 0.1 322)` — used for hover rings/shadows on buttons and clickable rows, consistently across Today, Assignments, Feedback Form, Lesson Plan, and every other trainee screen (not just the walkthrough).
- Header banner: light plum-tinted wash (`color-mix(in oklab, oklch(93% 0.019 190)`-style tint using the plum hue) with a soft plum border — calmer than a solid fill, matching the trainee's generally lighter tone versus MCT/ACT's solid ink/garnet headers.
- **Card edges**: every card gets ~9px corner rounding. Small cards (3-column grid layouts) get a **3px colored left border** in the section's own accent color. Large/wide cards (1–2 column layouts) get a **3px colored top border** instead. Default accent when a section has none of its own: plum.

## Assessor — header + card edges

- Header band: ink/garnet-brown `oklch(30% 0.042 58)` background, 3px **gold** (`oklch(60% 0.11 70)`) bottom border (opposite-pairing, same logic as MCT/ACT headers).
- Connect logo mark: translucent light tint of the header's own text color behind the CC-square (`color-mix(in oklab, oklch(97% 0.008 88) 22%, transparent)`), not a fixed dark fill — keeps the mark visible against this darker header.
- "Assessor · read-only" pill and "Download whole pack" button both restyled to translucent light outlines matching the dark header (previously designed for a light header, now corrected for the dark one).
- **Card edges**: same rounding (9px). Candidate portfolio cards (2-column grid) get a **3px colored left border**. Full-width sidebar panels (Cohort documents, On the day, Centre documents, Not-in-this-pack) get a **3px colored top border**. Colors follow each panel's existing accent (teal for documents lists, gold for On-the-day, muted grey for the "not in this pack" exclusion list).

## Reference files

`Trainee Walkthrough.dc.html` and `Assessor Visit.dc.html` — both already updated with this treatment; build from them directly.
