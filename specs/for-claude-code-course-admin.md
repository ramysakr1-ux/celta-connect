# Course Admin — complete spec, verified against live code

Verified directly against `preview/centre-admin-import` (commit `ac33a855eaa6`) on 2026-08-19. This replaces every prior Course Admin spec (`for-claude-code-course-admin.md`, `for-claude-code-course-admin-v2.md`) — those were both stale against what's actually built; this file matches the real implementation, not a design intent that drifted.

## Role clarification
Course Admin and Centre Admin are two separate roles. Centre Admin lives at `/centre` (own spec: `Centre-Admin-Complete-Spec.md`). Course Admin reuses `/dashboard/admin` — this was always the Course Admin screen, even before the role split existed (`dashboard/page.tsx`'s own comment: "the old flat `admin` sent everyone to `/dashboard/admin`, which is the Course Admin screen"). Routing (`getCentreRoleContext` / `landingFor`) now sends centre-role holders to `/centre` and Course Admin holders to `/dashboard/admin`, so the two no longer collide.

## No persistent tab bar
Corrected in code 2026-08-20: an earlier build added an `AdminTabs` nav (Admin/Admissions/TP Points Library/Settings) that didn't match the actual design. Removed. The real header is just the Connect wordmark + a "Course admin" badge — no tab bar. Entry points to Admissions, TP Points Library, and Settings live in the **Centre material** sidebar panel instead (see below).

## Home screen (`/dashboard/admin`)
- **Eyebrow**: centre name + "Centre {number}" (not the person's name — that told them nothing they didn't know and omitted the two facts that print on every report).
- **H1**: "Courses" — this screen's actual content, not a greeting.
- **"New course"** button, top right — opens the wizard below.
- **Centre-number banner**: red/destructive if the number is still a `PENDING-` placeholder (links to Settings to fix it before any report is released), otherwise a confirmation banner stating it's set.
- **Courses list**, grouped Running → Upcoming → Closed (never flat-sorted by date), each row: name, dates, people count, progress text, state pill.
- **Sidebar** (laptop-only — phone gets status + the one or two decisions only an admin can make, not browsing panels): "Centre material" — TP points library / assignment briefs / resource hub / feedback style examples / coursebooks, each a real link with a live count; a "Settings →" link beside it; a "What changed" recent-activity panel.
- **Footer**: designer credit (`<DesignerCredit />`, a shared component — reused wherever this credit appears, not hand-copied per screen).

## New-course wizard — one form, six steps (not separate routes)
All fields stay mounted across steps (nothing is lost moving back and forth); the whole course is created in a single submit at step 6.

1. **Course details** — Cambridge centre number (locked, prefilled from centre profile — changed in Centre Admin only), course code, internal course name (candidates never see it), start/end dates, max cohort size. Only name and dates are required.
2. **Delivery mode** — face-to-face / fully online / mixed, via the shared `DeliveryModePicker`. Defined by where TP happens, not input.
3. **Dates and timetable pattern** — weekday input start time, TP block start time, a days-off toggle row. Gold callout: confirming here auto-generates timetable tiles; tiles can be moved individually afterward without touching the underlying pattern.
4. **Capacity and pricing** — fee, deposit, currency, deposit-due window (days after offer). Payment provider is not chosen here — it reads "uses the centre's connected provider," set once in Centre Admin.
5. **Assign your first tutor** — email + tutor-role dropdown (same roles as the roster: Main/Assistant Course Tutor, Teaching Practice Tutor, Input Session Tutor, External Assessor). "Skip — I'll assign a tutor later" escape hatch; nothing here is required.
6. **Review and launch** — a locked summary table built from what was entered, then "Launch course" (submits everything) or "Back to edit."

## Course workspace — invitations and roster
- **Named invitation** (new): email + full name + role (candidate or tutor) + tutor sub-role if applicable. Re-inviting the same email address updates the existing invitation rather than duplicating it (unique on course + email). Revoking is a soft field (`revoked_at`), never a delete — who was invited and never came is still worth seeing.
- **Only one Main Course Tutor at a time**, enforced at the database level; inviting a second gets a clear error naming who currently holds it, telling the inviter to change that person's role first.
- **Reassigning the MCT** (`changeTutorRole`): promoting a new MCT automatically demotes the outgoing one to Assistant Course Tutor rather than leaving them with no role — losing the MCT silently would re-open course-wide announcements to every tutor (that check fails open with no MCT set).
- Tutor invitation emails send through the existing `tutor_added` template. Candidate invitations route through the admissions flow instead, deliberately — a bare join link here would bypass admissions' own gating.
- Shared join links (candidate link / tutor link, Copy / Email it / Regenerate) still exist alongside named invitations, for bulk/self-serve joining.

## Settings
Unchanged from the original design: left-rail nav (Centre profile, Google Drive, Assignment briefs, Feedback style, Tutors), centre profile fields (name + Cambridge number, both print on every cover sheet/report), Google Drive connection status + template/export-folder config, feedback style examples (calibrates AI tone-cleanup on tutor feedback), tutors panel (role, trainer-in-training status, online-experience evidence on online/mixed courses).

## Design tokens
Ink `oklch(23.5% 0.017 65)`, muted `oklch(51% 0.017 70)`, teal (default accent, tutors) `oklch(38% 0.072 195)`, bronze `oklch(50% 0.09 62)`, gold (system rule / mixed-mode warnings) `oklch(60% 0.11 70)`, red (hard rule) `oklch(45% 0.16 27)`, border `oklch(88% 0.016 82)`, card `oklch(99.2% 0.005 90)`, cream shell `oklch(96.4% 0.014 85)`. Fonts: Karla (UI), Newsreader (headings), Instrument Serif italic (wordmark, gold).

## Branding
Top: small mark + "Connect" wordmark. Bottom, centered: small mark icon only (no "Connect" word) + "Designed and built by Ramy" — via the shared `<DesignerCredit />` component, same position on every landing/home screen of the app.

## Not covered here — Centre Admin's own spec
Payments/fees/deposits, admissions pipeline oversight, volunteer-student management, the centre-owner role, the Roles tab, the Import tab. See `Centre-Admin-Complete-Spec.md`.
