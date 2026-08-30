# Assessor pack — resolving 3 open questions from Code

Answers to the questions Code flagged inline in `src/app/assessor/page.tsx` rather than guessing.

## 1. Candidate selection: centre-selected subset by default, full cohort always reachable

The assessor's landing page should default to showing the candidates the **centre has selected** for that visit (the ones actually being observed/assessed) — not the full cohort by default. This keeps the landing page focused on who the assessor is there to see.

But this is not a restriction — the assessor can freely browse into the complete cohort, full course assignments, and any other course data at any time. Nothing is walled off; the selected subset is just the default/featured view, not an access limit. Add a clear "View full cohort" or similar link from the landing page so this is discoverable, not hidden.

Centres need a way to mark which candidates are "selected for this visit" — likely a simple toggle/checkbox in the Course Admin or MCT's candidate list, defaulting to include everyone unless explicitly narrowed.

## 2. Live join links for online TPs

Where a TP is happening online during the assessor's visit window, show a real, clickable join link (the same Zoom link students/tutors use), not just a static "Observable" label. An assessor who can't click into the session isn't meaningfully observing it.

## 3. Centre documents list: keep current defaults, make it centre-editable

Keep marking guidance + uploads as the default document set, but don't hardcode the list — let the centre (Course Admin or MCT) add/remove supplementary documents for a given assessor pack, since different centres may have different materials to include. Avoid requiring a code change every time a centre wants to add a document.
