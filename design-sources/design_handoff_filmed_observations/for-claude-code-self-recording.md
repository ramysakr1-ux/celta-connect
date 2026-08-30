# Applicant/candidate self-recording — resolved

Written 17 Aug 2026. Resolves the open item from `review-notes.md` (Interview Booking section): "whether applicants also record themselves (currently only volunteer learners do)."

## Decision
Two separate things, both settled:

1. **Volunteer learners** already sign consent to being recorded as part of sign-up — unchanged, existing feature (the sign-up profile's audio recording used for FOL evidence).
2. **Self-recording during teaching** (e.g. a candidate recording their own Zoom-taught lesson) stays entirely local. If a candidate wants to record themselves teaching, it saves to **their own device/desktop**, never uploaded to Connect's cloud storage. Connect has no server-side recording pipeline for this and never receives a copy.

No new screen or setting needed — this is a "we don't build cloud storage for it" decision, not a feature to design.
