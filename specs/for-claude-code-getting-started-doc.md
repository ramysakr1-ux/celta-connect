# Getting-started guide — single-page combined doc, spec for Claude Code

Written 16 Aug 2026, for Claude Code. Linked from the **staff invitation email** (see `for-claude-code-email-inventory.md`, section A #... staff invitations, resolved 16 Aug). Source content: `Admin Task Guides.dc.html`'s seven guides, repackaged.

## What this is
A single standalone page (not an in-app walkthrough) containing all seven task guides from `Admin Task Guides.dc.html`, one after another, for a new Centre admin or Course admin to read once before they ever open Connect. Sent as a link in the staff invitation email — the recipient has no account yet when they see it, so it must stand alone with no app around it.

## Content — reuse verbatim, don't rewrite
Pull all seven guides' existing step text directly from `Admin Task Guides.dc.html`'s `GUIDES` array: Setting up a new course, Taking an application through to enrolment, Inviting people to Connect, Importing existing records, Publishing and changing a timetable, Preparing for the assessor visit, Closing a course. Keep the copy exactly as written — it's real operational guidance, not placeholder.

## Layout
One flowing page, not the in-app card-plus-progress-bar UI:
1. Title + one-line intro (reuse the existing "Anyone can find the field..." framing from `Admin Task Guides.dc.html`).
2. Seven sections in sequence, each: guide title (serif heading) + intro line + its steps as a numbered list (title + description per step, warnings called out distinctly where the source has one).
3. No interactivity — no click-to-open cards, no progress bar, no "Done" buttons. This is a read, not a tool.
4. Footer: a line inviting them to log into Connect once they've read it, with the login link.

## Format
Build as a `doc_page` (flowing document, not fixed pagination) — printable/PDF-able for anyone who wants a paper copy, and reads cleanly as a plain web page for anyone who just clicks the emailed link. No login required to view it.

## Design tokens
Match `Admin Task Guides.dc.html`: ink `oklch(23.5% 0.017 65)`, muted `oklch(51% 0.017 70)`, teal `oklch(38% 0.072 195)`, gold `oklch(60% 0.11 70)`, green `oklch(48% 0.09 150)`, card `oklch(99.2% 0.005 90)`, border `oklch(88% 0.016 82)`, page bg `oklch(92.5% 0.012 85)`. Fonts: Karla (UI), Newsreader (headings).

## Not in scope here
No FAQ exists yet — this doc is guides only. Whether to add a Q&A section is a separate decision, not assumed.
