# Walk — every role, 23 September 2026

Ramy: "we should do like a big walk of connect, the mothership ... all the old
roads ... and command center as well."

Walked on production as each role, reading the screens rather than the code
first. Twelve commits, all built, pushed and verified live.

## What was walked

Trainer (Today, Roster, Timetable, Assessor, Assignments, Grade form), trainee,
assessor, volunteer, course admin, centre owner, centre manager, centre
observer, centre settings — and, last, the Command Center (Overview, People,
Money, Demo links, Accounts, Create a centre) in Ramy's own browser, because it
is gated to the real platform owner and no demo route reaches it.

## Baselines

Both automated suites were clean before the walk started and after it finished:
`npm run smoke:prod` (221 pages, 9 roles) and `npm run check:browser` (81 pages,
6 roles). They were never going to find what follows — every item below needed
an eye on a screen, or a document open beside it.

## Found and fixed

| | |
|---|---|
| `dfa1c6f1` | The trainee rail said "You teach 10:45" beside a page saying "Not teaching today — all your TPs are taught". `teachesToday` asked whether the candidate's HALF had a TP that day, never whether they had one. The hero has always also required an untaught plan; both use that test now. |
| `d639613a` | React #418 on `/centre/settings`, and the same latent fault on the public `/apply` form. `TIMEZONE_OPTIONS` was module scope over `Intl.supportedValuesOf` + `new Date()`, so the server's zone list and the browser's need not match. Built on the server and passed down. The symptom is intermittent — absence on one load proves nothing. |
| `0b2a8196` `f7ad728f` | `/trainer` scrolled sideways at 375px and 768px, `/portfolio/:id` at 375px. Both shells keep header pills in a `shrink-0` cluster sized before the demo tag and install pill joined it. The first fix used `sm` (640px) and still overflowed at 768 — the cluster needs 528px beside a ~297px wordmark and tab row, so it stays wrappable until `lg`. |
| `4440d3a1` | Three labels claiming more than the code behind them: the roster's At-risk caption offered "attendance, hours or criteria" while `at-risk.ts` read neither of the first two; the grade form's "Settled · 10" counted a candidate its own list called "Not yet graded"; and a scheme-less `SITE_URL` threw `ERR_INVALID_URL` above every catch, so each `/demo/<role>` answered 500. |
| `9082d4e9` `52525a4f` | Attendance now makes a candidate at risk (Ramy's ruling). **Cambridge sets no percentage**: CELTA 5 p9 (identical in the May and July 2023 editions) says "100% attendance is expected", and Administration Handbook June 2025 §7.5 says candidates "are expected to attend the whole course" and that absence "may jeopardise their chances of successfully meeting the assessment criteria". Neither names a figure, and CELTA 5 p3 puts "the attendance policy" in the centre's own candidate agreement. The centre's line is **90%** — 10% allowed, and flagged past that even with a doctor's note, because documentation changes what the centre does about the absence, not whether anyone is told. **80% is the volunteers' line** (160 of 200 hours for their certificate), never the candidates'. The flag is advisory: `atRiskReasons` is sorted, counted and displayed, never a gate. |
| `48e925fc` | The assessor pack header printed the token's own `expires_at`, so the demo read "Link expires 18 Sept 2027" — contradicting the rule the same page cites. The demo's far-future token is deliberate (a closed demo course's end date is already past), so the header changed, not the token. It states the rule, event first, as the invitation email already did. Note the rule itself: **`ASSESSOR_LINK_BACKSTOP_DAYS` is 90 and it is a backstop** — close-out is the real end. The "14 days per §15" often quoted is the *report* deadline, not the link's life. |
| `918c72ca` `7a1d0b39` | Nobody could sign out. `signOut` was rendered in exactly two layouts, centre and dashboard, and the three shells people actually land in — command centre, trainer hub, candidate workspace — all bounce off both. On a shared centre machine the only way to end a session was to clear the cookie. All three have the door now. |
| `df2c329d` `d49fa780` | The Command Center's Centres table named the running course of a centre its own row marked "No access", under a footer promising "no silent viewing", while the People tab's tile of the same name read 0. See below. |

## The Command Center, and the rule it now follows

The contradiction was real and the product had not settled it: the Overview
counted platform-wide, People counted only accessible centres, and Accounts
declared itself platform-wide on purpose.

Ramy's ruling: platform-wide visibility **is** intended — the invite is the
maintenance route. So the rule is now:

> You always see how **much** is happening at any centre on Connect. You see
> **what** it is only in centres that have let you in.

Built from an approved mock-up: Centres splits into **Yours** (running course
named, finished courses as a count) above **Everywhere else on Connect**
(counts only). The split makes the rule structural — the second group's row has
nowhere to render a name. The count on the pulse strip stays platform-wide; the
course *name* appears only for a centre we are in.

**"Ask to be let in"** (migration `0310`, `platform_access_requests`) is the
other direction of `0208`'s invite, which only a centre could ever start. It
grants nothing: the centre answers on their own Connect access settings, and
saying yes writes the same standing invite they could always have written, so
every visit stays logged on their page. One open request per centre, enforced by
a partial unique index (verified: a second insert returns `23505`). Answering
checks the capability against the centre **on the request row**, not wherever
the person happens to be acting — the fault found in `revokePlatformOwnerInvite`
on 15 Sep, not repeated.

## Open

- **The ask → answer → access round trip is untested.** Asking is the platform
  owner's account; answering is a centre-roles holder at the target centre. The
  only centres he is not in are the two demo ones, where the write-block refuses
  by design. It proves out the first time a real second centre exists. The
  centre-side rendering *was* verified, by planting a row and deleting it.
- **`GOOGLE_REDIRECT_URI` in `.env.local` has no scheme** — same fault as
  `SITE_URL` had. Left alone: the registered callback is not ours to guess.
- **Three inbound feeds are declared and unbuilt** — Connect Lite, Affina,
  Feedback & support — plus "Activity, platform-wide", which is the cheap one:
  its data is already in this database and needs a query, not an integration.
  Also, "not connected" and "connected but quiet" currently render identically.

## Two method notes, both learned the hard way here

- **"Success. No rows returned" is what any DDL returns**, run or not. End every
  pasteable migration with `notify pgrst, 'reload schema';` then
  `select to_regclass('public.<table>');`. This was already written down after
  the criteria-glossary build and was not applied.
- **A stale DOM is not a stale deploy.** Twice, "not deployed yet" was reported
  from reading a browser tab after navigating to the same URL, where Next served
  its client-side cache. Verify with `fetch(url + '?x=' + Date.now(),
  {cache:'reload'})` and test for a string only the new build has. Asset-hash
  probes mislead too: a CSS-only change moves no JS chunk.

## Checked and NOT bugs — do not re-raise

- Roster tutor role `<select>`s reading "Role not set": that is the placeholder
  option; the real values are set.
- Chat retention "day": it does pluralise, the demo simply has 1.
- 11 vs 12 candidates: 12 total, 1 withdrawn. The grade form shows 12 on purpose
  — Cambridge needs an entry for a withdrawn candidate too.
- "Day 18 of 20" on 23 Sep: correct (31 Aug start, weekdays only).
- `(invited)` beside a tutor's name: the space is an `ml-1.5` margin.
