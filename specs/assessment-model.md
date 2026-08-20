# The assessment model

How the timetable, the input sessions, the criteria, the sub-criteria and the grade descriptors connect as one thing. This is the model, not the data — the sub-criteria at the back of the CELTA 5 fill it in.

---

## The problem it solves

Four documents exist and none of them reference each other. The timetable says when things are taught. The schema says which criteria are assessed at which TP pair. The CELTA 5 lists criteria and sub-criteria. The descriptors say what Pass, Pass B and Pass A look like across the whole course. A tutor holds the connection in their head, and every tutor holds a slightly different one — which is why marking varies and why a suggestion generated from any one document alone reads as irrelevant.

---

## The unit of assessment is the sub-criterion

Not the criterion. **5d** — managing the learning process so the aims are achieved — is not one judgement:

- the main aim was achieved
- the personal aims were addressed
- the teacher kept an appropriate profile
- the lesson arrived where it said it would

These do not come into scope together and are not equally weighted. **4a** is the same: an aim is not "speaking". It is accurately worded, detailed, names the context, lists the target items, and says what the learners will be able to do. Each of those is separately observable, and a tutor writing feedback is really commenting on one of them.

So: every sub-criterion is a row. The criterion is a grouping, and the schema's dot grid is a *summary* of its sub-criteria rather than a fact in its own right.

---

## Four links, each in one direction

**1 · Sub-criterion → input session.** Every sub-criterion names the session that teaches it. Not the criterion — the sub-criterion, because different parts of 4a are taught in different sessions (wording aims on day 2, target-language detail after language awareness on day 6).

**2 · Input session → date.** From the timetable, which is already the source of truth. Nothing is typed twice and moving a session moves everything downstream of it.

**3 · Sub-criterion → scope.** A sub-criterion is live from the TP that follows its session. The criterion is live when its first sub-criterion is. The schema grid is then *derived* — which is the check that the model is right: if the derived grid does not match the centre's own grid, one of them is wrong and the disagreement is worth having.

**4 · Sub-criteria met → descriptor.** Not a count. The descriptors are qualitative and holistic, and the mapping is about *character*, not arithmetic:

| Descriptor phrase | What in the data corresponds to it |
|---|---|
| plans with guidance / some guidance / minimal guidance | how much tutor input the plans needed, recorded per TP |
| analyses language adequately / well / thoroughly | the 4i and 2e sub-criteria specifically |
| some awareness of learners / good / very good | the Topic 1 sub-criteria |
| generally / consistently uses reflection | 4n, 5m, 5n across the course, and whether points recur |
| all achieved, some / most well achieved | how many sub-criteria are marked above standard, and whether that is sustained |

---

## The marking rule that makes it safe

**Credit above stage, never penalise above stage.** A sub-criterion not yet taught can be marked up and cannot be marked down. A candidate is never judged on what has not been taught, and never loses the evidence when they are ahead of it.

This is what makes early strength into grade evidence rather than an unfair expectation.

---

## Where a suggestion comes from

The system does not suggest a grade. It suggests **what to look at**, and only where the data supports it:

- a sub-criterion live for three TPs and never yet met
- a sub-criterion met above standard in three consecutive TPs — Pass B evidence in the descriptor's own words
- a candidate whose plans still need substantial input in week four, when the Pass descriptor says "with guidance" and Pass B says "some guidance"
- a criterion where two tutors have marked the same candidate differently

Every suggestion cites the sub-criteria it came from. A suggestion that cannot name its evidence is not shown.

---

## Why tutors have to mark the same way

The model is worth nothing if one tutor marks at criterion level and another at sub-criterion level, or if "met" means different things to different people. That is what the marking guidance and standardisation exist for, and it is the dependency to state plainly to a centre: **the suggestions are only as good as the consistency of the marking underneath them.**

Which is an argument for the guidance being visible while marking, not filed somewhere.

---

## Status, updated 2026-08-20

- **The sub-criteria themselves** — no longer missing. The full 113-item breakdown under each of the 41 codes (not 42 — Section 3 is 3a/3b only, corrected 2026-08-20 against the actual booklet PDF), transcribed verbatim from the CELTA 5's Appendix 1, is in `CRITERIA_GUIDANCE` (`src/lib/celta-criteria.ts`), populated since 2026-08-04. Don't re-flag this as needed — re-check that file directly if it ever looks missing again.
- **Links 1-3** — built (confirmed same session as the sub-criteria).
- **Link 4, the suggestion engine** — its placement question is now resolved (`for-claude-code-suggestion-engine-placement.md`, Desktop, 2026-08-20: inline gold dot on the criterion row, expand-in-place, trainer-only, evidence-must-cite-or-not-show, against the four trigger conditions above), but the engine itself is **not yet built** — this is the one real remaining piece of this model.
