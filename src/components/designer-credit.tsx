import { Wordmark } from "@/components/wordmark";

// Corrected 2026-08-20 per Centre-Admin-Complete-Spec.md's explicit
// "Branding" section: "[mark icon only] designed and built by Ramy (no
// 'Connect' word at the bottom)" -- supersedes specs/rename-to-connect.md's
// older "Connect · designed and built by Ramy" wording, which is what this
// used to render. Not gold -- gold would make the credit the brightest
// thing on the page.
//
// History worth knowing before moving this again: on 2026-08-15 it was moved
// off the Centre Admin and sign-in footers onto the public landing page only
// (cf0bbba), and 32 minutes later the landing page itself was deleted when
// root started redirecting straight to sign-in (965286a) -- so the credit
// vanished as collateral, not by decision.
//
// Ramy, 2026-08-16: it belongs on every role's LANDING screen -- "when they
// land, they should know who built the damn thing." One per home screen:
// Centre Admin, Course Admin, trainer Today, trainee Course Stream, assessor,
// and the volunteer student view. Deliberately still NOT on internal working
// screens beyond those, and never on an exported or Cambridge-facing
// document.
//
// Ramy, 23 Aug 2026 (first pass): moved from centered-in-flow to fixed
// bottom-right, since the centered chat pill (StaffChatDrawer/AdminChatBar,
// both `fixed bottom-6 ... flex justify-center`) sat directly on top of it.
// Ramy, 23 Aug 2026 (second pass): still didn't like bottom-right -- "kind
// of squashed in the middle, and squashed at the bottom." Moved to a small
// fixed badge in the top-right instead -- clear of both the header content
// (which lives in each area's own layout, not this component, so there's
// no single shared place to sit "under Connect" without restructuring six
// different headers) and the chat pill's whole bottom band, so neither
// collision can happen again regardless of viewport width.
// Ramy, 23 Aug 2026 (third pass): top-3 sat right on top of the header's
// own name/sign-out text on Course Admin (h-14, 56px tall). Dropped to
// top-16 (64px) so it clears every header in the app instead of layering
// over it -- still the top-right corner, just under the header band.
// Ramy, 23 Aug 2026 (fourth pass, reverted): tried the mark outside the
// pill with a solid gold fill -- "ugly," reverted back to the translucent
// pill with the mark inside.
// Ramy, 23 Aug 2026 (fifth pass): wants this aligned with the logo row
// specifically, with name/sign-out dropped to their own second row below
// it rather than fighting this badge for the same line. Layouts that show
// this (dashboard/layout.tsx, centre/layout.tsx) now reserve that second
// row themselves, so top-3 (aligned with the ~56px logo row) is correct
// again -- back from top-16, which was only ever a workaround for name/
// sign-out still sharing row 1.
export function DesignerCredit({ className = "" }: { className?: string }) {
  return (
    <div className={`pointer-events-none fixed top-3 right-3 z-20 ${className}`}>
      <span className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/85 px-2 py-1 text-[11px] text-muted backdrop-blur-sm">
        <Wordmark size="icon" iconSizePx={16} />
        <span>
          designed and built by <span className="text-ink">Ramy</span>
        </span>
      </span>
    </div>
  );
}
