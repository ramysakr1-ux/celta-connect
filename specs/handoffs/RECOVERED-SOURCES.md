# specs/handoffs — recovered design sources

> **READ THIS BEFORE USING ANY FILE IN THIS LIST.**
>
> These are **recovered historical sources**, not a statement of how the app
> should look today. Ramy, 31 Aug 2026, on handing them over: *"they are, like,
> true because we changed the design a little bit. So this could be a bigger
> cluster fuck."*
>
> The screens they describe were built and then **changed afterwards**, in
> conversation, without the design file being updated. So where one of these
> disagrees with what is in `src/`, the **built code and its comment win** —
> not this file — unless Ramy says otherwise for that specific screen.
>
> They are here as provenance: the reasoning, palettes, copy and Cambridge
> clause numbers behind decisions, and the last record of screens whose spec
> was the only surviving copy. They are not a to-do list, and nothing here
> should be treated as a bug report against the code.
>
> This qualifies the standing "open the design file every time" rule, which
> was written when the design files were current. It still holds for the
> handoffs that were never lost; it does **not** hold for the files below.


Six design sources that had no copy in a handoff folder. Originals live at the project root; these are the archived copies that pair with the cited specs in `specs/`.

| Design source | Paired spec(s) in `specs/` | What only the spec holds |
| --- | --- | --- |
| `Chat Pill.dc.html` | `chat-pill-and-timetable.md`, `for-claude-code-chat-pill-consistency.md` | Pill placement rules across roles |
| `Volunteer View.dc.html` | `volunteer-view-full-spec.md`, `for-claude-code-volunteer-view.md`, `for-claude-code-volunteer-rsvp.md`, `for-claude-code-volunteer-messaging-complete.md` | Input session agendas, RSVP + messaging states |
| `Compliance Audit.dc.html` | `for-claude-code-compliance-audit.md`, `for-claude-code-assignment-compliance-audit.md` (v2–v4), `concern-handbook-compliance.md`, `remaining-compliance.md` | Handbook clause numbers, Cambridge's verbatim AI disclaimer wording |
| `Withdrawal.dc.html` | `connect-withdrawal-precourse-scope-spec-2026-08-21.md` (root) | Deferral six-vs-twelve-month rules |
| `Course Staffing.dc.html` | `Centre-Admin-Complete-Spec.md`, `for-claude-code-four-roles-job-descriptions.md` | Role definitions and staffing constraints |
| `Course Close-Out.dc.html` | `Course Close-Out and Appeals.md`, `admissions-and-close-out.md` | Appeals timelines and close-out sequence |

## Cited design sources (second batch)

| File | Citations | What it's holding up |
| --- | --- | --- |
| `Malpractice.dc.html` | 6 | Malpractice outcomes and actions — Cambridge-facing |
| `Criteria by Stage.dc.html` | 1 | Sits behind `celta-criteria.ts` — the 41 criteria codes |
| `Marking Guidance.dc.html` | 1 | The assessor's marking guidance screen |
| `Appeals.dc.html` | 2 | Appeals in the assessor pack and close-out export |
| `Observation Tasks.dc.html` | 2 | CELTA 5 + level definitions |

Related root files not copied here (variants, not the cited source): `Withdrawal Form.dc.html`, `Withdrawal and Handover.dc.html`, `Volunteer View - standalone.html`.

`support.js` is included so the `.dc.html` files open directly in a browser from this folder.
