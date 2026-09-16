# Focus on the Learner — pooled evidence model (replaces the individual-learner version)

Written 14 Aug 2026, for Claude Code. Repo: `ramysakr1-ux/celta-connect` @ `main`.

## Why this replaces the current build

`src/lib/assignment-info.ts` currently describes Focus on the Learner as "Profile one learner or a small group... a diagnosis of language difficulties," and `specs/build-spec.md` (§ assignment deadlines) has it opening after TP4, based on "difficulties noticed across TP1–4" from the candidate's own teaching. That's the old model. It's been redesigned this session to a **pooled observation model** — every candidate contributes to one shared log, then claims problems from it, rather than each candidate working solely from their own TP group. This spec describes the new model end to end; treat it as replacing the FOL sections of `build-spec.md` and `assignment-info.ts`, not extending them.

## Why the change

Individual TP groups vary in size — a candidate whose group has fewer learners than teaching partners has fewer mistakes to draw from than a candidate in a bigger group. Pooling observation across all six candidates removes that inequity, and gives every candidate access to far more raw evidence than they could gather alone in four TP rounds.

## Timing

- **Assigned Day 1, due Day 12** (not "opens after TP4" — the brief is given immediately so candidates start watching from day one; the pooled log they draw from builds up progressively across Days 2–9).
- Trainer introduces the brief live on Day 1, section by section (see "Trainer UX" below) — this is the one assignment candidates never get to pre-read cold.

## Data model (new)

**`class_error_log`** — one row per logged observation.
- `id`, `center_id`, `course_id`
- `logged_by_candidate_id` — who observed and logged it
- `learner_id` — the specific learner from that TP class's register (not free text)
- `tp_class` (e.g. `ABC` / `DEF`), `tp_number`, `lesson_stage` (pulled from the open lesson plan at logging time), `logged_at`
- `problem_type`: `grammar` | `pronunciation`
- `note` — free text of what the learner said/wrote
- Visible to the whole cohort of 6 (RLS scoped to `course_id`, not to the logging candidate alone) — this is the "pool."

**`fol_claims`** — one row per candidate's claimed problem.
- `id`, `center_id`, `course_id`, `candidate_id`
- `problem_type`: `grammar` | `pronunciation`
- `problem_description` — candidate's own typed description of the specific structure/sound
- `source`: `pooled_log` | `signup_recording`
- `claimed_at`
- Unique constraint: no two `fol_claims` rows in the same course with the same normalized `problem_description` + `problem_type` (see validation below — this is the "exclusive on problems, not learners" rule). Learner can repeat across claims; problem cannot.

**Sign-up profile fields already exist** (six written answers, audio recording) from admissions — this spec adds one thing: an **auto-generated transcript** of the recording, and a **visibility gate**: the recording + transcript are only queryable by candidates once the current date matches the course's timetabled divergence-session date (Day 10). Before that date, candidates should get nothing back if they try — not an error revealing it exists, just absence. This is a scheduled unlock keyed to the timetable, not a manual toggle or role permission.

## Claim validation (system-adjudicated, not trainer-reviewed)

When a candidate submits a `problem_description` for a claim, validate server-side before inserting:

1. **Duplicate** — normalize and compare against every other `fol_claims.problem_description` in the same course (case-insensitive, trimmed, maybe light stemming). Reject with a message naming that it's already claimed; do not say by whom.
2. **Category mismatch** — a lightweight check that the claimed problem_type matches what it plausibly is (e.g. a claim entered in the pronunciation slot that names a verb tense should flag). A simple keyword/heuristic check is fine for v1; doesn't need full NLP.
3. **Zero evidence** — no `class_error_log` row (or, once unlocked, transcript segment) in this course actually contains/matches the claimed problem. Reject if nothing backs it.
4. **Too vague** — reject a description with no named structure or sound (e.g. bare "grammar mistakes"/"pronunciation problems", nothing else). A simple length + keyword-presence heuristic is enough; this doesn't need to be sophisticated, it just needs to stop the emptiest submissions.

All four are **soft warnings that let the candidate retry immediately** — never a hard fail, never something that blocks the assignment. Only genuinely thin evidence (1–2 logged instances backing an otherwise-valid claim) should surface as a *heads-up*, not a rejection — that's the candidate's cue to gather more before Day 12, not a system-imposed word.

## Trainer UX

- **Day 1**: trainer walks the brief live, section by section (TP-group description; grammar problem + table; pronunciation problem + table; two activities). Explicitly do not explain the Day 10 divergence session yet.
- **Days 2–9**: candidates log to `class_error_log` by tapping a learner from the register mid-observation. No dedicated trainer action needed; a spot-check view showing per-class log counts (flagging classes with ~0 entries) is useful but not required for v1.
- **Day 10 (divergence session)**: candidate-led, not trainer-led. Candidates use the app to submit claims against the validation above. The sign-up recordings/transcripts unlock automatically that day (see visibility gate) — candidates discover this themselves; nothing in the UI should announce it in advance.
- **Day 12 (marking)**: the review/marking view should let the tutor cross-check a submission's cited example against `class_error_log` / the transcript, surfacing a flag if the citation doesn't trace back to a real logged/transcribed instance.

## What NOT to build

- No trainer approval step for claims — the system adjudicates, per above.
- No visible "who else claimed what" — candidates see whether *their own* attempted claim is taken, not a leaderboard of everyone else's claims.
- No early access to sign-up recordings before the divergence-session date, for any role except centre admin/tutor (who always had access to admissions data).
