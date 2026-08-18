# The auto-booked interview's cron delay — for Claude Code

Written 2026-08-18, following on from `for-claude-code-email-inventory.md` Part 1 and `twenty-decisions.md` 11a — the AI admissions triage build (migration 0151) shipped with a real gap worth recording rather than leaving as an implicit tradeoff in a code comment.

## The gap

The "clear" lane's whole point is a fast, trustworthy auto-send: a candidate whose task reads as clear on every criterion gets an interview invitation with a short, human-shaped 15-minute hold — not a wait. The first build of this piggybacked the auto-send sweep on the existing once-a-day admissions cron, because the Vercel Hobby plan this project is on caps cron jobs at 2/day and both slots were already spoken for.

That is not a steady state. A candidate whose reading clears at 9am should not sit until the next day's cron run because the *infrastructure* couldn't check back sooner — that turns "fast and trustworthy" into "eventually, maybe," which undermines the entire reason the clear lane exists rather than just queuing everything for a human. The delay is a real defect against the feature's own purpose, not an acceptable tradeoff to note and leave.

## The fix

A Supabase pg_cron job, running inside the database itself, calls a dedicated `/api/cron/admissions-auto-book` route every 5 minutes via `pg_net`. This is independent of Vercel Cron entirely, so it doesn't compete with the two existing Vercel-scheduled jobs for a slot. The 15-minute hold now means 15–20 minutes in practice, not up to a day.

Built in migration 0152. The route's `CRON_SECRET` is stored in Supabase Vault rather than in any committed file, referenced by name (`admissions_auto_book_cron_secret`) at execution time — the actual secret value is never written to the migration, this spec, or anywhere else that lands in git.
