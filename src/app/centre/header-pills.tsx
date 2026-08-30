"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PILL_ACTIVE, PILL_INACTIVE } from "@/app/centre/header-pill-styles";

// The two same-family pills beside the wordmark: Centre Management and
// Course Admin. Same size, next to each other, teal on whichever view you
// are in.
//
// Ramy, 31 Aug 2026: "pills should sort of have the same size, should be
// next to each other. When one pill is active, the other one is inactive.
// So that the green teal is sort of jumping between them."
//
// Centre owner is NOT in this group -- see CentreOwnerPill below.
//
// What this fixes, beyond the styling: the pills used to be fixed rather
// than positional, so on /centre/owner "Centre management" was a plain span
// with no way back, and "Centre owner" was a link to the page you were
// already standing on.
export function CentreHeaderPills({ mayViewCourseAdmin }: { mayViewCourseAdmin: boolean }) {
  const pathname = usePathname() ?? "";
  const onOwner = pathname.startsWith("/centre/owner");

  return (
    <>
      <span className="h-[18px] w-px shrink-0 bg-border" aria-hidden="true" />
      {onOwner ? (
        <Link href="/centre" className={PILL_INACTIVE}>
          Centre management
        </Link>
      ) : (
        <span className={PILL_ACTIVE}>Centre management</span>
      )}
      {mayViewCourseAdmin ? (
        <Link href="/dashboard/admin" className={PILL_INACTIVE}>
          Course admin
        </Link>
      ) : null}
    </>
  );
}

// Centre owner, unchanged: garnet, its own register.
//
// I had folded this into the teal group. Ramy did not ask for that and said
// so plainly: "Centre owner should stay red... you keep it exactly as it
// was. Just put it in a different spot." He is right on the substance too,
// and it is what the spec already said --
// for-claude-code-centre-owner-role-customizer.md: "a deliberately
// different register... not a fifth tab that happens to look the same."
//
// It sits apart from the other two now rather than beside them, because it
// is not a peer of theirs: "the centre owner is the only one that can see
// it." Only the colour's position on the page changed; the pill itself is
// exactly as it was.
//
// The single change to its behaviour: on /centre/owner it renders as a
// span rather than a link, so it no longer links to the page you are
// standing on -- which is the dead click that started this.
export function CentreOwnerPill() {
  const pathname = usePathname() ?? "";
  const onOwner = pathname.startsWith("/centre/owner");

  const className = "shrink-0 rounded-[5px] px-2.5 py-1 text-[11px] font-bold tracking-[0.1em] text-white uppercase";
  const style = { background: "oklch(42% 0.15 27)" };

  if (onOwner) {
    return (
      <span className={className} style={style}>
        Centre owner
      </span>
    );
  }
  return (
    <Link href="/centre/owner" className={`${className} hover:opacity-90`} style={style}>
      Centre owner
    </Link>
  );
}
