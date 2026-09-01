"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BranchFilter, type Branch } from "@/app/centre/branch-filter";

/**
 * The right-hand header line: branch filter, who you are, and the owner's
 * way back to their own screen.
 *
 * All of it disappears on the centre owner's screen. Ramy, 1 Sep 2026: "it's
 * All branches, and then the names of the branches, and then the name of the
 * owner and Centre owner and Sign out, and it's like one long line, and it's
 * just going to feel a bit boring on top."
 *
 * Two of those four were saying something the page already said louder. The
 * "Centre owner" link pointed at the page it was rendered on -- its own
 * comment claimed it hid when you were already there, which was never true,
 * there was no path check -- and the name now sits in the garnet pill in the
 * band. So the owner's header keeps the branches and Sign out, and the two
 * duplicates go.
 */
export function CentreHeaderMeta({
  branches,
  fullName,
  isOwner,
}: {
  branches: Branch[];
  fullName: string;
  isOwner: boolean;
}) {
  const pathname = usePathname() ?? "";
  const onOwnerScreen = pathname === "/centre/owner" || pathname.startsWith("/centre/owner/");

  // The owner's branches move out of this cramped right-aligned line and
  // onto a row of their own (OwnerBranchRow), so that a centre group with
  // nine branches reads as nine branches rather than as an overflowing
  // control squeezed against Sign out.
  return (
    <>
      {onOwnerScreen ? null : <BranchFilter branches={branches} />}
      {onOwnerScreen ? null : (
        <>
          <span>{fullName}</span>
          {isOwner ? (
            <Link href="/centre/owner" className="text-muted underline-offset-2 hover:text-ink hover:underline">
              Centre owner
            </Link>
          ) : null}
        </>
      )}
    </>
  );
}
