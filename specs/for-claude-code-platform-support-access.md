# Platform support access — paste-ready

Extends the existing rule in `for-claude-code-centre-admin-full.md`: "nobody at Connect holds a key to any centre's data... platform support only gets in when a centre explicitly invites them, for a stated period, logged." This spec is the actual grant flow, not designed until now.

## Model

`support@celtaconnect.com` is Connect's one platform-support account. It has **no standing access to anything**. Access exists only as time-boxed grants, one per (centre, scope) pair.

## Who can grant, and what

The granter is whoever actually holds the data being shared — not one fixed "owner" role, since the Centre owner is often not on the course itself.

- **Course scope** (grades, marking, that course's timetable — course chat excluded by default): granted by that **course's main tutor**. Same authority already used for trainer-to-trainer grants into feedback/tutorials/CELTA 5 records (`for-claude-code-centre-admin-full.md`, cross-cutting rules) — this is that same mechanism, extended to the platform account.
- **Billing/admin scope** (fees, deposits, course setup, no course content): granted by a **Centre administrator** or the **Centre owner**.
- **Course chat**: closed to every admin role including the owner, no exception. Excluded from every support grant unless a request for it is separately and explicitly approved by the main tutor — expect this to be rare and default to declined.

## Grant fields (required)

1. **Scope** — one course, or billing-only. No "everything" option.
2. **Reason** — free text, required, goes on the permanent log. Not optional, not a dropdown of canned reasons.
3. **Duration** — 6 hours / 24 hours / 3 days. No indefinite option; a longer need means a fresh grant, not an extension.

## What happens on grant

- support@ gets a scoped view limited to exactly what was granted (e.g. Assignment 3 submissions + marking queue for one course — not the whole course, not other candidates' unrelated work beyond what's needed to reproduce the issue).
- A countdown to expiry is visible to support@ at all times.
- The centre can revoke early at any point; expiry is otherwise automatic, no renewal prompt.
- Every page support@ opens during the window is itself logged (page, timestamp) and appended to the centre's access log once the grant ends.

## Access log (centre-side)

Per centre, a running list of every grant: what was granted, who granted it, the stated reason, duration, and current status — **Active** (grant window still open), **Expired** (ran out naturally), **Declined** (support requested a scope, e.g. course chat, and the granter said no). Declined requests stay on the log too — a refusal is itself a record.

## Reference

Design: `Platform Support Access.dc.html` — 1a is the granter's screen (scope picker, reason, duration, access log), 1b is support@'s scoped view once granted.
