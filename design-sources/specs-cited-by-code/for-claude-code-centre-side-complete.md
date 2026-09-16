# Centre side — complete spec for Claude Code (16 Sep 2026)

The whole administrative building: Centre Management, Centre owner, Course Admin, Admissions, Volunteer pool, Centre settings, Payment providers, Concerns, the New-course wizard, the Centre course record, and Command Center. Read against `ramysakr1-ux/celta-connect@main` (tree ebf2dac134fe).

Read in full: `centre/layout.tsx`, `centre/page.tsx`, `centre-tabs.tsx`, `header-meta.tsx`, `header-pill-styles.ts`, `branch-filter.tsx`, `owner-branch-row.tsx`, `settings-card.tsx`, `centre/owner/page.tsx` + `capability-pill.tsx` + `branch-visibility-card.tsx` + `unowned-courses-card.tsx`, `centre/roles/page.tsx`, `centre/settings/page.tsx` + `settings-tabs.tsx`, `centre/volunteers/page.tsx`, `centre/concerns/page.tsx`, `centre/payments/page.tsx`, `centre/courses/[id]/page.tsx`, `centre/courses/new/page.tsx`, `dashboard/layout.tsx`, `dashboard/admin/page.tsx`, `dashboard/admissions/page.tsx` + `admissions-tabs.tsx` + `layout.tsx`, `components/room-pills.tsx`, `components/area-theme.tsx`, `platform/command-center/layout.tsx` + `section-pills.tsx`. Read by search: every `<h1>` under `dashboard/admin`, every `card-garnet` use across `src/app`, Command Center sub-pages.

Second pass (16 Sep, later): `dashboard/admin/courses/[id]/page.tsx`, `dashboard/admissions/[id]/page.tsx`, `platform/accounts/page.tsx`, `platform/page.tsx` read in full — findings in Part 2b/3b. Still not read: `dashboard/admin/settings/*`, the applicant record's 15 child panels (read via the page that mounts them), `centre/assessor-history`, `centre/owner/log`, the roles strip/forms, the volunteer row, the 23 helper files under the course record (the page says which are mounted; nine of them — subgroups, close-out, certificate check, chat retention, delivery mode, material pool, group tutor, invitations, restarts — are no longer imported by it).

Severity: **A** wrong or a rule broken · **B** inconsistency a user will notice · **C** polish.

---

## Part 1 · What stays

- **The four-room model.** Four rooms, four colours, no role encoded (Ramy, 1 Sep). Pills sit on the page, left-aligned; the three you are not in on top, the one you are in dropped beneath and attached to the surface with `-mb-px`. `activeRoomKey` is the single answer for both pills and tabs. Correct, and the best piece of navigation in the app.
- **`AreaTheme` / `--area-accent`.** One colour per room, carried into every hover by CSS variable, not by editing components. Owner screen excluded from the rooms and given its own `area-owner`. Keep.
- **Header: the clock only, no day bar** on every centre-level header (Ramy, 10 Sep). A centre runs several courses; there is no "the day". Correct on `/centre`, `/dashboard`, Command Center.
- **Connect is the way home**, no "Centre owner" pill in the header; the owner reaches their screen via the role label beside their name. Keep.
- **Branch filter is a filter, not a switcher** (build-spec §13), hidden for single-branch centres, shown only on pages that read `?branch` (the 15 Sep allowlist). On the owner screen it becomes the proud serif row on its own line. Keep both registers.
- **Centre owner screen** as a different register: ink band, garnet rule, parchment field, owner's name in the garnet pill instead of the role word, danger zone naming the real target centre, unowned-courses backstop that hides when empty. Keep.
- **Centre Management tabs: Roles · Concerns · Settings, New course on the far right.** Nothing is a verb; Overview is the pill. Keep.
- **Admissions tab row** in its own layout so no page is a dead end. Keep.
- **Command Center**: three coloured rules, pills between the second and third, sidebar gone, credit at the foot (Ramy, 2 Sep). Keep exactly.
- **Concerns** head: eyebrow + 34px "Sent past the tutors" + one paragraph that states the count. This is the best room head in the building and the model for B1 below.
- **Course Admin landing**: eyebrow = centre + number, h1 = "Course administration" (deliberately not "Courses" so it stops rhyming with Centre Management). Keep.
- **New-course wizard** lives under `/centre`, eyebrow "Connect · centre management", the verbatim H1 and paragraph. Keep.

## Part 2 · Fix (A)

**A1 · Decorative garnet, building-wide.** `card-garnet` / `card-side-garnet` alternates by index or by position on: Centre overview figures (`i % 2`), Admissions pipeline card, Course Admin group cards (`groupIndex % 2`), the Admissions landing (three of five cards), Admissions pipeline / settings / emails / referral requests (`i % 2`), every panel on the applicant record (`[id]/page.tsx`, 14 cards each with its own `xGarnet` boolean), assignment briefs, Course Admin settings, the Course Admin course record, Command Center pulse strip and People figures, platform accounts. The code's own comment on `--color-garnet` says it is "purely decorative, not a semantic status colour" and that reusing the error colour "would risk a garnet card silently reading as 'something's wrong'". That risk is now real: garnet **is** the Course Admin room colour (`ROOMS[1].colour`, `oklch(42% 0.13 27)`, identical value), so inside Centre Management a garnet-edged card reads as a Course Admin object, and inside Course Admin every second card is the room colour for no reason. Same finding as the trainee side (A5 there).
Rule: **a card's top edge carries the room's colour or nothing.** Delete the alternation (the `i % 2` / `groupIndex % 2` / `xGarnet` branches), delete `card-garnet`, `card-side-garnet`, `card-side-teal` as decoration, and let `.card` inside an area take `--area-accent` for its edge only where the card is that room's primary object (the course list, the pipeline table, the volunteer list). Everything else: plain hairline. The trainer hub's `--hub-decorative-accent` alternation goes the same way, but that is a separate ticket.

**A2 · Amber on the Centre overview means two things.** Figures: `card-side-amber` when `m.alert` (outstanding balance > 0, refunds pending > 0). Payments panel: `card-amber` when any instalment is missed, otherwise `card-gold`. Course row: "£x due" in `text-destructive`. So money-owed is amber on the figure, red on the row, and amber-or-gold on the panel. One vocabulary for money: **red = missed/overdue** (a promise broken), **amber = owed but not yet late**, nothing for "fully paid". Apply to figure edge, row text, panel edge alike.

**A3 · Course-state pill: three different implementations for one fact.** Centre overview: Upcoming gold-wash, Running teal-wash, Closed grey (`courseState()` inline). Course Admin landing: `GROUP_PILL_CLASS` gives Interviewing and Launching both `bg-primary/10 text-primary`, Running grey (and the whole card `opacity-80`). Centre course record: one grey pill "Running · W3". Export one `CourseStatePill` from `lib/course-progress` with the overview's three tints (gold/teal/grey) and let Course Admin's two upcoming sub-states share gold. Drop the `opacity-80` on the running group: dimming a card because it "needs nothing from you" makes it look disabled, and the row already says "Nothing needed from you".

**A4 · `settings-card.tsx` is dead.** The "Centre settings" bar was retired on 1 Sep when Settings became a tab; the file still exists with its `pathname.startsWith("/centre/settings")` guard and is imported nowhere in the layout. Delete it.

**A5 · Centre settings sub-page header carries a second room label.** `settings/page.tsx` renders a BackLink "Centre management" **and** a teal "CENTRE SETTINGS" pill in the head. The dropped room pill above already says Centre management; the tab row already says Settings. Two labels for where you are, both redundant with the chrome. Remove the pill and the BackLink; the head becomes the room head (B1).

**A6 · `/centre/payments` is an orphan.** It is reached from the "Refund history" link inside the Settings > Payment providers tab and nowhere else, has its own BackLink to `/centre`, and duplicates `ProviderList` that the Settings tab already renders. Either fold refunds/notifications/transactions into the Settings > Payment providers tab (preferred: one place for money settings) or give the page a Centre tab. Do not leave both.

## Part 2b · Fix, from the second pass (A)

**A7 · The applicant record's garnet is computed from render position.** `admissions/[id]/page.tsx` keeps a `cardIndex` counter and derives 19 `xGarnet` booleans so that alternation "still alternates correctly however many of the conditional cards render". Ten child components take a `garnet` prop for it (`AiReadingPanel`, `MarkingForm`, `PaymentsPanel`, `EmailHistoryPanel`, `WaiverForm`, `OfferForm`, `WaitingListForm`, `RejectForm`, `ReferForm`, `RequestReferralForm`). This is A1 at its most expensive: a prop on ten components whose only job is decoration. Remove the counter, the 19 booleans and the `garnet` prop from all ten. The page has real states that deserve an edge and get none: **Rejected** card (should be the destructive edge), **under-18** line (already red text, fine), **entry-form overdue** on the course record (already `card-red`, fine).

**A8 · Nine helper files under the course record are orphaned.** `subgroups-form`, `close-out-card`, `certificate-check-card`, `chat-retention-form`, `delivery-mode-card`, `material-pool-toggle-card`, `group-tutor-form`, `invitations-panel`, `assign-tutor-panel` and their action files sit in `dashboard/admin/courses/[id]/` but the page's own comment says the kitchen-sink is "gone from here — all MCT-owned". If they are mounted from the trainer side, move them there; if not, delete. Dead UI beside a live page is how the wrong card gets re-imported.

**A9 · Course record head is inside a garnet card.** `card card-garnet p-6` wraps eyebrow + 20px h1 — the room's own colour used as the decorative slot on the room's own page. B1 takes it out of the card; A1 removes the edge.

**A10 · `/platform` landing and `/platform/accounts` are two greetings for one person.** `/platform/page.tsx` greets ("Good morning, Ramy" + recap) and offers Create centre / Change role / Every centre; Command Center's layout greets again ("Welcome back, Ramy") and offers Create via its menu. The 22 Aug note put the greeting on `/platform` because it was the post-login landing; the 2 Sep redesign made Command Center the home (the Connect mark links there for `platform_owner`). Fold `/platform`'s three cards into Command Center (Create centre → the Create menu, which already exists; Change role → People; Every centre → Overview's centre list) and redirect `/platform` → `/platform/command-center`. Accounts stays as a Command Center section (it is reached only from Money today) — add it to `CC_SECTIONS` or link it from Money's head so it stops needing its own BackLink and `frame`.

## Part 3 · Align (B)

**B1 · One room head.** Today: Centre overview eyebrow 11/600/0.1em + 26px serif; Roles a 26px serif *sentence* ("The manager wants to see the money…") + 13px sub; Settings inside a `.card p-6` with BackLink + pill + 20px h1; Volunteer pool eyebrow + 24px inside `p-8`; Concerns 11.5/700 eyebrow + **34px** serif + paragraph; Payment providers BackLink + 26px; Course record inside a `.card p-6` with 20px h1; Course Admin landing 11/700 eyebrow + 24/600; Admissions landing inside a `.card p-6`, 20px h1, no eyebrow; New course 34px; every Course Admin sub-page 20px (`text-xl`) inside a card; Command Center 23px greeting.
One `RoomHead`: eyebrow 11/700/0.1em muted (room · page, or centre · number) · Newsreader **28/600** ink title · optional one paragraph 13.5 muted `max-w-[68ch]` · actions right (h-38, radius 6). **Never inside a card.** Concerns and New course keep their sentence titles at 28 rather than 34; Roles keeps its sentence. Settings, Admissions, Course record, all Course Admin sub-pages come out of their `.card p-6` wrappers.

**B2 · Card padding.** `p-6`, `p-5`, `px-5 py-4`, `px-5 py-3.5`, `px-[22px] py-5`, `px-7 py-6` (owner), `p-4`, `p-8` (volunteer page wrapper) all live in the same building. Two paddings: **20px** for a card that holds a heading and body, **16px 20px** for a list card's header and rows. Owner screen keeps its own (28/24) as a deliberate register.

**B3 · Card radius.** `.card` 10px, Concerns sections `rounded-[12px]`, Volunteer card `rounded-[9px]`, Owner cards 10px, Owner stat cards 10px with a *left* garnet edge (the only left edge in the building after A1), Command Center cards 10px. All 10px; the owner stat cards move their garnet from left edge to the top rule like every other owner card.

**B4 · Tab rows.** `CentreTabs`, `AdmissionsTabs`, `SettingsTabs` (client-state) are three copies of the same 14px/medium/`border-b-2` nav with slightly different hover classes (`hover:border-primary/40 hover:text-primary` vs `admin-hover-fill hover:text-ink`). One `RoomTabs` component, one hover.

**B5 · Section-heading scale inside cards.** `font-serif text-base` (16px) on Centre overview, `text-lg` (18px) on Admissions, `text-[19px]` on the owner screen, `text-base` on Course Admin. Pick **17px/600** for every card `<h2>` outside the owner screen; owner stays 19.

**B6 · Room pill and Command Center pill are two shapes.** Room pill: 11/700/0.1em, radius 5, 1px border, `--pill-c`. Command Center section pill: 11.5/700/0.05em, radius 5, `color-mix` 9% fill when inactive. Same idea (where am I), two tracking values and two inactive treatments. Bring Command Center's pill to the room pill's spec (0.1em, border-only inactive) and keep its three-rule frame.

**B7 · Branch name on a row.** Centre overview: `rounded-full bg-surface-muted px-2 py-0.5 text-[10px]` chip. Course Admin: `text-[11px] text-muted` inline. Admissions: `text-[11px] text-muted` inline. Owner "Who holds what": third column. One `BranchChip` (the overview's) everywhere a row names its branch.

**B7b · Accounts figures use `text-2xl font-bold` sans for numbers**, the only figures in the building not in the serif. Every other KPI (Centre overview 28px serif, owner 28px serif, Command Center pulse strip) is Newsreader. Same `Figure` as the rest.

**B7c · Illustrative cards at `opacity-60`** on Accounts (Connect Hub, Affina) plus the Running group at `opacity-80` on Course Admin (A3). Opacity as a state is used three times with two values and no shared meaning. Illustrative cards: dashed border + "Illustrative" eyebrow, full opacity. Nothing in the building dims.

**B8 · Empty states.** "No courses yet." · "Nobody in the pipeline yet." · "Nothing missed." · "Nobody registered yet." · "No applicants awaiting a decision." · "Nobody has taken this route. That is the ordinary state…" · "No tutors have joined yet." Fine individually; Concerns is the model (states the fact, then says whether that is normal). Give the two that can alarm — "Nobody in the pipeline yet", "Nobody registered yet" — the same second clause.

## Part 4 · Polish (C)

- C1 · Centre Management header is two container rows on the page ground with a 3px bronze rule *promised in the comment* ("Centre Management's own 3px rule, in bronze") but the rule element is not rendered — the comment sits above `OwnerBranchRow`. Either render `AreaHeaderRule` there (the component exists in `area-theme.tsx` and is used nowhere) or delete the comment.
- C2 · `dashboard/layout.tsx` has an empty `{profile?.role === "admin" ? (<></>) : null}` fragment left over from the removed badge. Delete.
- C3 · `owner/page.tsx` has an unused `formatMoney` and a trailing comment about the credit ("This one had none at all") with no credit rendered. Owner screen is a landing; add `HeaderCredit onDark` to the band, or drop the comment.
- C4 · `HeaderCredit` on every screen in `/centre` and `/dashboard`. Same rule as the other three shells: landing (the room's overview) only.
- C5 · Motion. No hover lift anywhere in the building; `admin-hover-fill` is a background wash. Openable rows (course rows, pipeline rows, volunteer rows, figure cards that link) get the shared 2px/200ms lift; static cards do not. Same rule as the other shells, `prefers-reduced-motion` honoured.
- C6 · `card-red` on the bounce panel also sets `border-destructive/25 bg-destructive/5` inline, so the class and the utilities both paint the same edge. One or the other.
- C7 · Volunteer pool wraps content in `p-8` inside a `frame p-6`: 56px of inset where every other room has 24. Drop the inner `p-8`.

## Part 5 · Design reference

No new mock. The live rooms are ahead of every design file in this project (`Centre Admin.dc.html`, `Course Admin.dc.html`, `Centre Owner Landing.dc.html`, `Volunteer Pool.dc.html`, `Payments.dc.html`), all of which predate the four-room model and the header/pill decisions of 1 Sep. Those files are reference for card anatomy only; `main` is the truth. `Timetable View.dc.html` is included as the tile/motion reference for C5.

## Part 6 · Order

A1+A7+A9 (garnet, including the applicant record's prop and the course record head) with B3 (edges/radius) · A2+A3 (money vocabulary, course-state pill) · B1 (RoomHead, cards out of card-wrappers) with A5 · B4 (one tab row) · A4+A6+A8 (dead file, orphan page, orphaned helpers) · A10 (one platform-owner home) · B2/B5/B7 as touched · C whenever. A1 is the biggest single change in the building and touches ~60 call sites; do it with one find-and-replace and a visual pass, not by hand.
