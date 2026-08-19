# Bug fixes — build spec §23, paste-ready

All nine bugs from `build-spec.md` §23. Fix in place; no design change accompanies any of these except where noted.

1. **`message-thread.tsx` scroll hijack.** Uses `scrollIntoView`, which can scroll the whole page, not just the panel. Replace with `panelRef.current.scrollTop = panelRef.current.scrollHeight` on the message list container. Same effect, can't escape the panel. (Also flagged in `specs/apply-to-app.md` §1.)
2. **`StaffChatDrawer` invisible until hovered.** Undiscoverable, unreachable by keyboard. Replace with the dimmed-at-rest pill from `specs/apply-to-app.md` §1: present at ~40% opacity at rest, full opacity on hover or focus, keyboard-focusable.
3. **Roster rows falsely clickable.** `cursor-pointer` on the whole `tr`, but only the name cell is a link. Fix: `position: relative` on the row, an absolutely positioned `a` with `inset: 0` in the first cell so the whole row is a real link target; every other cell keeps its own selectable text. (Simpler alternative if an overlay anchor is unwanted: just drop `cursor-pointer` from the row.)
4. **Course Stream emoji.** Uses 🎥 and 📎 where the rest of the app uses lucide icons. Swap for lucide `Video` and `Paperclip`.
5. **Solid-gold "Pinned" badge.** `bg-gold` solid fill is the only one in the app — gold is reserved for the wordmark and Pass A. Use `.pill-gold` (tinted background, gold text/dot) instead.
6. **Broadcast title sizing.** Currently larger than the section heading above them. Set to 20px/600.
7. **Course Stream spacer hack.** Sidebar alignment currently uses an invisible `<h2>Spacer</h2>`. Replace with a shared grid header row so both columns align without a fake element.
8. **`TraineeEyebrowLabel` inside the wordmark link.** The label renders inside the wordmark `<Link>`, so clicking the label text also triggers the wordmark's navigation. Move the label outside the `<Link>` boundary.
9. **Broadcast composer buried in a candidate's portfolio.** Lives at `src/app/portfolio/[traineeId]/broadcast-composer.tsx`, so posting to the whole cohort requires opening one specific candidate's page first. Move it to `/trainer` (Today) or its own route. `postBroadcast` and the `course_broadcasts` table are unchanged — this is a route/mount change only.

No screens need redesigning for any of these; they're implementation corrections, not new UI.
