"use client";

import { usePathname } from "next/navigation";
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
// Ramy, 23 Aug 2026 (sixth pass): "doesn't need to travel with me when I
// scroll down" -- `fixed` pins it to the viewport, so it stayed visible
// the whole time you scrolled instead of scrolling away with the header
// like everything else up there. `pinned={false}` renders it as a normal
// in-flow element instead (used by the two-row headers above, which have
// a real slot for it now); `pinned` (the default) keeps the old fixed
// behavior for the pages that only ever call this with no wrapping slot
// to sit in.
//
// Ramy, 23 Aug 2026 (seventh pass, volunteer/student landing only): the
// original move to bottom-right (first pass, above) was reverted everywhere
// because StaffChatDrawer/AdminChatBar's centered chat pill sits on that
// same band -- but the volunteer/student view has no chat at all (token-based
// viewers, no real account, no StaffChat/AdminChat mount), so that collision
// never applies here. `corner="bottom-right"` opts back into the original
// placement just for this one page; every other `pinned` caller keeps the
// top-right default.
export function DesignerCredit({
  className = "",
  pinned = true,
  corner = "top-right",
}: {
  className?: string;
  pinned?: boolean;
  corner?: "top-right" | "bottom-right";
}) {
  const pill = (
    <span className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/85 px-2 py-1 text-[11px] text-muted backdrop-blur-sm">
      <Wordmark size="icon" iconSizePx={16} />
      <span>
        designed and built by <span className="text-ink">Ramy</span>
      </span>
    </span>
  );

  if (!pinned) return <div className={className}>{pill}</div>;

  const cornerClass = corner === "bottom-right" ? "bottom-3 right-3" : "top-3 right-3";
  return <div className={`pointer-events-none fixed z-20 ${cornerClass} ${className}`}>{pill}</div>;
}

// For a layout's own header row (centre/layout.tsx, dashboard/layout.tsx):
// the layout wraps every sub-route (Roles/Import/Settings under Centre
// Admin; every /dashboard/* page under Course Admin's shared layout), but
// the credit is landing-page-only. A layout has no page-level prop to key
// off, so this checks the live pathname client-side instead -- renders
// nothing at all on any route except the one landing path given.
export function HeaderDesignerCredit({ landingPath }: { landingPath: string }) {
  const pathname = usePathname();
  if (pathname !== landingPath) return null;
  return <DesignerCredit pinned={false} />;
}
