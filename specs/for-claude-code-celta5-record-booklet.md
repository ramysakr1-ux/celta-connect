# CELTA 5 Record Booklet — build spec

Written 29 Aug 2026 from Ramy's own description of the release logic, plus
`CELTA 5 Record (standalone).html` (the design source). Review this before
building — it is a draft of what he said, not an independent design.

## Why this exists

The CELTA 5 page today shows the parts a candidate fills in — Progress
Records, criteria ratings, observations, attendance, signatures. It does
not show the **document those parts belong to**. The design renders the
whole Cambridge booklet as a screen, with the interactive records embedded
in Cambridge's own order and a contents list to move between them.

A candidate currently never sees the roles and responsibilities they signed
up to, the appeals procedure, or the assessment guide — all of which the
real booklet puts in front of them.

## Structure

Contents list at the top, "(Click to open the section)", then fourteen
sections in Cambridge's order:

1. Roles and responsibilities of candidates, centres and Cambridge — static
2. Candidate Portfolio — static
3. Cambridge English Appeals Procedure — static
4. Candidate Guide to Assessment — static
5. Record of Attendance — **pulled**
6. Record of Observations of Experienced Teachers (incl. filmed) — **pulled**
7. Record of Assessed Teaching Practice — **pulled**
8. Record of Assessment of Written Assignments — **pulled**
9. Stage One Progress Record — tutor-gated
10. Stage Two Progress Record — trainee-gated
11. Stage Three Progress Record — tutor-gated, conditional
12. To be completed on the final day — computed checklist
13. Appendix 1 — CELTA Criteria (data already in `celta-criteria.ts`)
14. Appendix 2 — CELTA Performance Descriptors (same file)

Cover page above the contents: candidate name, centre number, centre name,
course number, course dates, tutors, ULN.

Progress overview strip: attendance %, observation hours, assessed TP
hours, assignments graded. Marked as not part of the official CELTA 5 text.

## What is automated, never typed

Attendance, observation hours, TP hours and rows, written-assignment
results, and the Stage One draft all come from the shared trainee record.
Anything auto-filled carries a **`pulled`** tag so a candidate can tell what
was calculated from what was written about them.

Assignments: each of the four shows its result (Pass 1st submission, Pass
2nd submission, or "— not yet graded") as graded elsewhere in Connect. The
CELTA 5 only counts them (`n / 4 graded`) and feeds that count into the
final-day checklist. It is not a marking surface.

## Release logic

The pattern, in Ramy's words: **Stage 1 and 3 are tutor releases to the
trainee; Stage 2 is the trainee submitting to unlock the tutor.**

### Stage One — tutor-gated
Auto-drafted by joining the tagged strengths and action points from TP
feedback. The trainee sees nothing until the tutor hits **Release to
trainee**; before that they get a "not yet released" state. The tutor can
also un-release.

**Un-release rule** (settled 29 Aug — Ramy: "it could vanish, doesn't
really matter as long as they read it and sign it"):

- Before the candidate has signed, un-release freely. It disappears from
  their view, the tutor revises, re-releases. Nothing is lost because
  nothing has been attested to.
- Once the candidate HAS signed, it cannot silently vanish or change — the
  signature attests to specific text. A tutor who must still revise it
  re-releases, which clears the signature, and the candidate signs the new
  version.

This is why the gate is the signature rather than the edit: it means a
signature can never point at text that has since changed.

Needs a new column (`stage1_released_at`). Today `stage1_completed_at`
doubles as both "tutor finished it" and "trainee can see it", so there is
no way to draft without publishing.

### Stage Two — trainee-gated (the reverse)
The trainee rates every criterion in the **You** column. The tutor's
ratings and comments stay hidden until the trainee submits — that is the
whole point: **no anchoring on the tutor's marks**. Submit appears only
once at least one criterion is rated. On submit the You column locks and
the tutor column appears. Notice text switches accordingly.

Already built: `stage2_candidate_submitted_at` gates it correctly today.

### Stage Three — tutor-gated, and conditional
Required only if a trigger is met (`stage3_required` + trigger reason on
the record). If no trigger, it reads "tutorial not required, report kept on
file". The trainee sees it only after tutor release.

Partly built: the trigger and reason exist. The release gate does not.

## Final day

Five checks, all computed, each showing ✓ or a red ! with live numbers:

- TP ≥ 6 hrs
- Observations ≥ 6 hrs (filmed capped at 3)
- All four assignments graded
- Stage Two complete
- Stage Three released

## Build status at time of writing

| | |
| --- | --- |
| Stage 2 reverse-gating | built and correct |
| Stage 3 trigger + reason | built |
| Final release to trainee | built (`trainer_signoff_final_at`) |
| Stage 1 release / un-release | **not built** — no column |
| `pulled` tag | **not built** |
| Final-day five checks | **not built** as a checklist |
| Contents, cover, static sections, appendices | **not built** |

## Resolved

**Trainee / Tutor "viewing as" switch** — not in the build. Ramy, 29 Aug:
"that was just a note for me, it's not in the build." It exists in the
design so the mock-up can show both states without two logins.

Worth keeping the reason written down: shipping it would defeat Stage Two.
The whole point of that gate is that a candidate rates every criterion
before seeing the tutor's marks, and a switch to the tutor view would hand
them exactly the marks the gate exists to hide. The app resolves the viewer
by role already.
