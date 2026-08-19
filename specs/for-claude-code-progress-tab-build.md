# Add the Progress tab — paste-ready

`src/app/portfolio/[traineeId]/portfolio-tabs.tsx` still has 6 tabs (Course Stream, Pre-course task, Resource Hub, Teaching Practice, Written Assignments, CELTA 5) with no **Progress** tab. Per `specs/for-claude-code-progress-tab.md`, this was decided as its own persistent tab, not link-only and not folded into CELTA 5 or Teaching Practice.

## Change

Add to `TABS` in `portfolio-tabs.tsx`:

```ts
{ href: "/progress", label: "Progress", metaKey: "progress" },
```

Placement: after CELTA 5 (last position), matching the tab order used elsewhere in `for-claude-code-progress-tab.md` (…Resources, **Progress**). Add `progress: string` to `PortfolioSidebarMeta` and thread a meta value through wherever `PortfolioSidebarMeta` is constructed (server-side, alongside the existing `celta5` count) — leave it `""` for now rather than fabricating a count, same rule already applied to `courseStream`/`resourceHub`.

## New route: `src/app/portfolio/[traineeId]/progress/page.tsx`

Content, per spec:
1. **CELTA 5 self-assessment form + sign-off status** — pull from the existing CELTA 5 self-assessment data model (`src/app/dashboard/trainee/celta5/`), don't rebuild it; this tab is a new home/view for it, not a new form.
2. **Observation-hours log** — three tracked kinds: peer observation, filmed observation, observation of experienced teachers. Filmed hours count against a separate video-hours cap, tracked apart from live hours. Each kind shows a running total against its syllabus minimum.
3. **Stage 1/2/3 sign-off status** — sourced from the unified Standing table rollup (`for-claude-code-unified-tracking.md`), using the existing trigger logic already specced in `build-spec.md`: Stage 1 (report mandatory, tutorial optional), Stage 2 (both mandatory), Stage 3 (report mandatory only when triggered by not-to-standard at Stage 2, above-standard-but-slipping, or a failed written assignment; tutorial always optional).

No new tables — this reads from the existing CELTA 5 self-assessment tables, the observation-hours log tables (`src/app/dashboard/trainee/celta5/observation-form.tsx`'s backing data), and the unified Standing table. Purely a new tab + page assembling what already exists.

## Architecture decision: don't move code out of celta5/page.tsx

Read the live file: the self-assessment form, sign-off buttons, and observation-hours blocks are interleaved inline with the Stage 1/2/3 criteria matrix rendering (e.g. `SelfAssessmentForm` sits directly between the Stage One text and the Stage Two ratings table). Extracting them into a shared module both pages import would mean surgically pulling JSX out of a ~900-line file with no functional reason to touch it — real regression risk on the matrix, the most load-bearing part of the app, for a pure code-organization change.

Instead: `/progress/page.tsx` is a **fresh, independent implementation**. It queries the same underlying tables directly (`celta5_records`, `observations`, `observation_tasks`, `observation_task_submissions`) and renders its own self-assessment/sign-off/hours summary. `celta5/page.tsx` is left completely untouched, including its own self-assessment and observation blocks — some query logic is duplicated across the two pages, which is an acceptable tradeoff for not touching the matrix page.

## Reference

Design: `Trainee Home.dc.html` (portfolio tab styling — border-left accent, meta count pattern) for visual consistency with the other 6 tabs.
