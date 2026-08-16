# Getting-started guide — single-page combined doc, spec for Claude Code

Written 16 Aug 2026, for Claude Code. Linked from the **staff invitation email** (see `for-claude-code-email-inventory.md`, section A #... staff invitations, resolved 16 Aug). Source content: `Admin Task Guides.dc.html`'s seven guides, repackaged.

## What this is
A single standalone page (not an in-app walkthrough) containing all seven task guides from `Admin Task Guides.dc.html`, one after another, for a new Centre admin or Course admin to read once before they ever open Connect. Sent as a link in the staff invitation email — the recipient has no account yet when they see it, so it must stand alone with no app around it.

## Content — built and refined, see `Getting Started Letter.dc.html`
The letter is built (not just specced) — read that file directly for final copy. It is **not** a verbatim reuse of `Admin Task Guides.dc.html`'s steps; several were rewritten during review because the original text undersold the platform's automation and one line was stale against the close-out spec:

- **"Taking an application through to enrolment"** and **"Importing existing records"** steps were rewritten to name what's actually automatic (AI triage into three lanes, auto-booking after the 15-min hold, auto-invitation the instant a provider confirms deposit, auto column-mapping, auto-dedup on re-import) versus what's genuinely a human decision (choosing to make the offer, choosing a role to invite). The original `Admin Task Guides.dc.html` phrasing reads too manual and should probably be corrected there too, not just in this letter — flagging, not yet done.
- **"Closing a course"** archive step was rewritten: `Admin Task Guides.dc.html` says archiving is "reversible for 30 days," which contradicts `build-spec.md`'s actual close-out rule (7-day grace, then permanent erasure, no undelete except a platform-owner pre-expiry extension). The letter now states the correct 7-day/permanent-erasure rule, framed explicitly as a trust guarantee — Connect keeps no second copy, can't be asked for a closed course's records after that. **`Admin Task Guides.dc.html` itself still has the stale "30 days" line and needs the same fix.**
- Timing wording corrected: assessor-visit prep is "once the visit date is confirmed — how much notice you get varies" (not a fixed 2–3 weeks, which isn't always true); close-out is "the final week, and the week after" (matches the actual 7-day grace, not the original's "fortnight").

## Addressing
The built letter is addressed to a **Centre administrator** as the representative example, with a closing line noting Course administrators and Centre owners receive the same seven guides reworded to their role's scope — those other two versions are not yet built, only noted as needed.

## Layout
One flowing page, not the in-app card-plus-progress-bar UI:
1. **Header** — Connect wordmark/logo tile (per `rename-to-connect.md`'s tile lockup, static — no spin on a document), at the sign-in/certificate size (78–92px tile).
2. Title + one-line intro (reuse the existing "Anyone can find the field..." framing from `Admin Task Guides.dc.html`).
3. Seven sections in sequence, each: guide title (serif heading) + intro line + its steps as a numbered list (title + description per step, warnings called out distinctly where the source has one).
4. No interactivity — no click-to-open cards, no progress bar, no "Done" buttons. This is a read, not a tool.
5. **Sign-off footer** — signed personally: "Ramy" in `--color-ink`, rest in `--color-muted`, matching the designer-credit treatment in `rename-to-connect.md`. Below it, a support line: "Need anything? support@celtaconnect.com" — this is the one document where Connect and Ramy appear directly by name, since it's platform documentation rather than an email (the "every email is from the centre" rule governs emails, not this linked doc). Then the login link to Connect.

## Format
Build as a `doc_page` (flowing document, not fixed pagination) — printable/PDF-able for anyone who wants a paper copy, and reads cleanly as a plain web page for anyone who just clicks the emailed link. No login required to view it.

## Design tokens
Match `Admin Task Guides.dc.html`: ink `oklch(23.5% 0.017 65)`, muted `oklch(51% 0.017 70)`, teal `oklch(38% 0.072 195)`, gold `oklch(60% 0.11 70)`, green `oklch(48% 0.09 150)`, card `oklch(99.2% 0.005 90)`, border `oklch(88% 0.016 82)`, page bg `oklch(92.5% 0.012 85)`. Fonts: Karla (UI), Newsreader (headings).

## Not in scope here
No FAQ exists yet — this doc is guides only. Whether to add a Q&A section is a separate decision, not assumed.
