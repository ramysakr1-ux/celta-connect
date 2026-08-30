# Video Library links + filmed observation playback — spec for Claude Code

## 1. Add the real video links

`tp_video_library` (migration 0189) exists but ships with zero rows — the trainer-facing
add form at `/trainer/video` (`add-video-form.tsx` → `addVideoRecord` in `actions.ts`) is
already fully built and working. No schema or code change is needed to add content:

- Go to `/trainer/video` as a trainer/admin for the relevant centre and paste in each real
  link (title + external URL — YouTube/Vimeo/Drive share link + optional description).
- These are read-only visible to trainees immediately at
  `/portfolio/[traineeId]/resources` under "Video Library" (`video-library-section.tsx`),
  and centre-wide (not course-scoped) same as the audio library.
- No duration field exists in the schema today. Not required — see §2, native player
  controls make length visible once the trainee opens the link. If a duration column is
  wanted later for at-a-glance browsing (e.g. "48 min" next to the title in the shelf),
  add `duration_seconds integer` to `tp_video_library` + a field on `add-video-form.tsx`;
  scope this only if actually requested, it's not needed for fast-forwarding to work.

**Action for the user:** add the ~5 real filmed-observation/training video links directly
through `/trainer/video` — this is a content task, not a build task.

## 2. Trainee messaging: fast-forwarding is expected, not a workaround

Some linked videos and filmed-observation recordings run well past 45 minutes. Trainees
are not expected to watch start to finish.

- **Video Library links**: external, so trainees fast-forward using the destination
  site's own player (YouTube/Vimeo's own seek bar). No in-app change needed — this is
  inherent to linking rather than hosting. Add a short note near the Video Library
  section (design reference: `Resource Hub.dc.html` §3a) telling trainees this directly,
  e.g.: *"Some of these run well over 45 minutes. Skim ahead and fast-forward to the
  parts your task asks about — you don't need to watch start to finish."*
- **Filmed observation recordings** (`watch-screen.tsx`): the `<video controls>` element
  already ships native scrubbing/seek, so fast-forwarding already works with zero code
  changes. Add matching copy near the player (or in the observation task card) so
  trainees know it's expected behavior, not something they have to discover:
  *"This recording can run past 45 minutes. Use the player's own seek bar to fast-forward
  — you're not expected to watch every second, just enough to answer the task."*

No functional build work here — copy only. Both notes are drafted and placed in
`Resource Hub.dc.html` §3a as the design reference for wording and placement.

## 3. Decision: filmed-observation playback stays independent, not synced

Considered and explicitly **rejected**: a "watch party" mode where one host's play/pause/
seek broadcasts live to every viewer's player (would ride on the existing
`filmed_observation_presence` Supabase realtime channel — presence, play/pause/seek
events, periodic re-sync pings for drift, a host role). Estimated a few days of focused
work, not a large build, but not worth building:

- Filmed observations are meant to be watchable any time, not just live — the existing
  copy already says "missed it? Watch the same recording here any time."
- Independent playback lets a late joiner start immediately instead of waiting for the
  group to catch up, and lets someone finish or rewatch at home.
- The existing live chat + presence list already give a "we're doing this together"
  feeling without forcing lockstep playback.
- Sync only pays off for a deliberately live, instructor-led session with real-time
  cold-calling — not the current use pattern.

**No change needed.** Current behavior (each trainee's own `<video>` element, own
playhead, own break triggers when THEIR playback crosses a timestamp) is correct as
built. Documenting this so it isn't second-guessed or "fixed" later without this context.

## 4. Add teacher, level, learners, main aim and sub aim before playback — new fields

Real gap: `filmed_observation_sessions` (migration 0137) today only stores `lesson_title`,
`recording_url`, `length_minutes`, `level`, `learner_count` — no teacher name and no
lesson aims. Same gap exists on the generic `observations` table used for experienced-
teacher observations (one free-text `lesson_focus` line, no separate main/sub aim). A
trainee should see this basic lesson context before they start watching, same information
they'd get walking into a real observed lesson.

**Schema** — add to `filmed_observation_sessions`:
- `teacher_id uuid references profiles(id)` (preferred — resolves to a real name/avatar
  like elsewhere in the app) or `teacher_name text` if the teacher isn't always a
  `profiles` row (e.g. a guest/external teacher on a stock recording).
- `main_aim text`
- `sub_aim text` (nullable — not every lesson has one)

**Trainer setup form** (`filmed-observation/setup-form.tsx`, saved via
`saveFilmedObservationSession` in `filmed-observation-actions.ts`) — add fields for
teacher, main aim, sub aim alongside the existing lesson title / level / learner count /
length inputs. Trainer fills these in once when scheduling the filmed observation, same
step as today's setup.

**Trainee watch screen** (`watch-screen.tsx` / its parent `page.tsx`) — surface teacher
name, level, learner count, main aim, and sub aim in a header/card above the video player,
visible before the trainee presses play. Design reference: `Resource Hub.dc.html` §3a,
Filmed Observation card — shows the exact layout and copy pattern (Teacher / Level /
Learners inline row, Main aim / Sub aim below).

Optional follow-up, not in scope here: bring the same main-aim/sub-aim fields to the
generic `observations` table so experienced-teacher observations show the same context —
ask before building, since it touches a table used across several other screens.
