# Chat pill must be identical everywhere — Centre Admin / Course Admin don't match in-course

Written 23 Aug 2026, for Claude Code. `specs/apply-to-app.md` already defines the chat
pill/thread/picker as one component, applied app-wide — it isn't written as an in-course-only
feature. If Centre Admin and Course Admin currently show an older or different chat
treatment than the one inside a running course, that spec hasn't propagated there.

## Ask
Confirm the exact same chat pill component from `apply-to-app.md` (§1: positioning,
auto-hide/wake behavior, bar layout — picker/composer/reset-meter/thread-toggle/send,
thread panel, channel picker, midnight reset) is mounted on Centre Admin and Course Admin
screens too, not a separate/older chat UI. Same configuration, same behavior, same visual
treatment as inside the course — no area-specific variant.

## Additional bugs to fix as part of this
- **Height should be auto, not fixed.** The bar/pill's height should size to its content
  (composer row height + padding), not a fixed pixel height — confirmed the current
  behavior on some screens locks to a fixed height that doesn't match the pill's actual
  content.
- **Auto-hide isn't firing.** Per `apply-to-app.md` §1.1, the pill should dim to
  `opacity-40 translate-y-3.5` after 3500ms of no hover/focus/typing, and wake on
  interaction. Confirm this idle-dim behavior is actually wired up wherever the pill
  appears — it's currently not hiding/dimming as spec'd.

