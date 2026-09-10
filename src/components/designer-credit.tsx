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
// Ramy, 24 Aug 2026 (eighth pass): still "too much" as a bordered pill in
// the top-right, crowding the trainer hub's own busy header. Bottom-right,
// no border/background -- just the small mark and faint text, low enough
// contrast to read as a watermark rather than UI chrome. corner now
// defaults to "bottom-right"; every existing top-right caller was the
// thing causing the crowding, not a deliberate choice worth preserving.
export function DesignerCredit({
  className = "",
  pinned = true,
  corner = "bottom-right",
  tone = "muted",
}: {
  className?: string;
  pinned?: boolean;
  corner?: "top-right" | "bottom-right";
  // Ramy, 10 Sep 2026: "there is room in the header for my credit if it's done
  // in a different colour, obviously." In the trainee header it shares a row
  // with "Day N of 20" and the avatar, both of which are muted -- three muted
  // things in a row read as one crowded thing. Bronze is the existing third
  // accent, already used where teal and gold are both spoken for.
  tone?: "muted" | "bronze";
}) {
  const toneClass = tone === "bronze" ? "text-bronze/75" : "text-muted/70";
  const nameClass = tone === "bronze" ? "text-bronze" : "text-muted";
  const mark = (
    <span className={`pointer-events-auto inline-flex items-center gap-1.5 text-[10.5px] ${toneClass}`}>
      <Wordmark size="icon" iconSizePx={13} />
      <span>
        designed and built by <span className={`font-semibold ${nameClass}`}>Ramy</span>
      </span>
    </span>
  );

  if (!pinned) return <div className={className}>{mark}</div>;

  // Ramy, 10 Sep 2026: "bottom right of the screen, all the screens... make
  // sure you measure it well so it's not blocking a view, and it's not being
  // blocked, and it could all be seen by everybody."
  //
  // Measured, rather than guessed, because bottom-right is the busiest corner
  // in this app and the old bottom-3 was landing on things:
  //
  //   /centre at 1024px  -- the admin chat bar's visible pill spans 92-932 and
  //                         its top is 64px off the bottom. A credit at
  //                         bottom-3 sat at 859-1012, straight through it.
  //   trainee, desktop   -- the staff chat pill is bottom-6 with py-3, so its
  //                         top measures 92px off the bottom.
  //   trainee, 375x812   -- TraineeMobileNav owns 755-812 and the chat pill
  //                         664-720: one 35px gap, and the credit is 24px tall.
  //
  // So: 100px on desktop clears the highest of the two chat pills by 8px, and
  // 62px on mobile centres it in the only gap there is -- 5px above the nav,
  // 6px below the pill. One position, every screen, blocking nothing and
  // blocked by nothing.
  const cornerClass =
    corner === "bottom-right" ? "right-3 bottom-[62px] md:bottom-[100px]" : "top-3 right-3";
  return <div className={`pointer-events-none fixed z-20 ${cornerClass} ${className}`}>{mark}</div>;
}

// For a layout that wraps several routes but where only ONE of them is the
// landing (Centre Admin's Roles/Import/Settings; every /dashboard/* page under
// Course Admin). A layout has no page-level prop to key off, so this checks the
// live pathname client-side and renders nothing anywhere else.
//
// Renamed from HeaderDesignerCredit on 10 Sep 2026, when it stopped being a
// header thing: both layouts used to drop an unpinned credit into their header
// row, which put it in a different place from the six landings that pin it
// bottom-right. Ramy: "keep it all the same spot... if there's more than one,
// remove the other one and keep only the bottom right."
export function LandingDesignerCredit({ landingPath }: { landingPath: string }) {
  const pathname = usePathname();
  if (pathname !== landingPath) return null;
  return <DesignerCredit />;
}
