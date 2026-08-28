# Progress tab — screen spec

Written 17 Aug 2026, for Claude Code. Screen `1g` in `Trainee Walkthrough.dc.html`. Supersedes nothing — this is the visual build for the decision already recorded in `for-claude-code-progress-tab.md`; read that first for the "why."

## Nav
6th tab, after Resources: **Today, Timetable, My teaching, Assignments, Resources, Progress**. Same header/nav chrome as every other trainee screen.

## Layout
Same screen shell as the rest of the trainee walkthrough: eyebrow + heading row, then a 3-column grid (`1fr 1fr 1fr`), gap 18px. Heading summarizes the two things most likely to need action, e.g. "Stage 2 tutorial booked · CELTA 5 not started" — not a static label.

## Panel 1 — Stage 1 / 2 / 3
Three rows, one per stage, each a pill + sub-line:
- **Stage 1 report** — Filed/Not filed. Sub-line notes it's filed by the trainer and the tutorial itself is optional, not held up on this pill.
- **Stage 2 tutorial** — Booked (with position and time) / Not booked. Pulled from the Stage 2 booking sheet (see `for-claude-code-trainer-remaining-screens.md`).
- **Stage 3 report** — N/A by default; only becomes relevant if triggered (not-to-standard at Stage 2, slipping from above-standard, or a failed written assignment). Sub-line states the trigger conditions so a candidate understands why it may or may not apply to them.

Footer note: sourced from the same Standing table the trainer sees — this is the candidate's own row, not a parallel record.

## Panel 2 — CELTA 5 self-assessment
Status pill (Not started / Candidate signed / Both signed) + sub-line suggesting timing (after TP2, once there's feedback to reflect on). Second row states both signatures are required — candidate signs, tutor countersigns, neither alone finishes it. Footer: explicitly no grade lives here — reflection against the five CELTA components, not an assessment.

## Panel 3 — Observation hours
One row per observation type (experienced teachers, peer, filmed), each showing hours logged vs. syllabus minimum, with filmed hours explicitly called out as capped separately and not counting toward the peer minimum. Footer: each row is a drill-down — clicking shows the specific sessions logged and when.

## Data sources
- Stage 1/2/3 status: unified Standing table (`for-claude-code-unified-tracking.md`), same per-candidate trigger logic already specced for Stage 3.
- CELTA 5: existing self-assessment/sign-off record.
- Observation hours: existing observation-logging data, split by type (experienced-teacher / peer / filmed), filmed hours tracked against its own cap.

## What NOT to build
- No grade or provisional-grade display anywhere on this tab — matches the no-grades rule for every trainee-facing screen.
- No separate nav destination for any of these three panels — they live here, not as their own tabs or links.
