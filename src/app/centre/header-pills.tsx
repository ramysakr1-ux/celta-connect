"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PILL_ACTIVE as ACTIVE, PILL_INACTIVE as INACTIVE } from "@/app/centre/header-pill-styles";

// The pills beside the wordmark in Centre Management's header.
//
// Ramy, 31 Aug 2026: "those pills are kind of confusing."
//
// They were, and precisely backwards. They were fixed rather than
// positional, so on /centre/owner the header showed "Centre management" as
// a plain span -- not clickable, no way back -- and "Centre owner" as a
// link to /centre/owner, the page you were already standing on. The one
// that should have been a label was the link, and the one that should have
// been a link was a label. Same fault as the "Open settings" bar that
// invited you to open the page you were on.
//
// Ramy again: "pills should sort of have the same size, should be next to
// each other. When one pill is active, the other one is inactive. So that
// the green teal is sort of jumping between them, so it's not confusing."
//
// So one shape for all of them and one colour that moves: teal marks where
// you are, everything else is the same pill unfilled. Nothing changes size
// between states -- the border is there in both, so the active pill does
// not grow and shove its neighbours along when you navigate.
//
// This drops the garnet Centre owner pill, which was a deliberate choice --
// for-claude-code-centre-owner-role-customizer.md: "a deliberately
// different register... not a fifth tab that happens to look the same."
// Ramy's instruction supersedes it. The register it was protecting is still
// carried by the Centre owner screen itself, whose header band, danger zone
// and owner-only controls are unmistakably not another tab.


export function CentreHeaderPills({
  isOwner,
  mayViewCourseAdmin,
}: {
  isOwner: boolean;
  mayViewCourseAdmin: boolean;
}) {
  const pathname = usePathname() ?? "";
  const onOwner = pathname.startsWith("/centre/owner");

  return (
    <>
      <span className="h-[18px] w-px shrink-0 bg-border" aria-hidden="true" />

      {onOwner ? (
        <Link href="/centre" className={INACTIVE}>
          Centre management
        </Link>
      ) : (
        <span className={ACTIVE}>Centre management</span>
      )}

      {isOwner ? (
        onOwner ? (
          <span className={ACTIVE}>Centre owner</span>
        ) : (
          <Link href="/centre/owner" className={INACTIVE}>
            Centre owner
          </Link>
        )
      ) : null}

      {mayViewCourseAdmin ? (
        <Link href="/dashboard/admin" className={INACTIVE}>
          Course admin
        </Link>
      ) : null}
    </>
  );
}
