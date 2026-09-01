"use client";

import { usePathname } from "next/navigation";
import { BranchFilter, type Branch } from "@/app/centre/branch-filter";

/**
 * The owner's branches, on a line of their own.
 *
 * Ramy, 1 Sep 2026: "it's kind of a sign of wealth and pride... there are a
 * lot of branches, more than two. What would it look like?" -- which is the
 * right question to ask of a control that was living at the end of a
 * right-aligned header line next to Sign out. Two branches fitted; nine
 * would have wrapped into that line or pushed Sign out off the edge.
 *
 * On its own full-width row, left-aligned with the page and free to wrap,
 * the same list reads as an estate rather than as a filter that outgrew its
 * corner. Renders only here; every other screen keeps the quiet control.
 */
export function OwnerBranchRow({ branches }: { branches: Branch[] }) {
  const pathname = usePathname() ?? "";
  if (!(pathname === "/centre/owner" || pathname.startsWith("/centre/owner/"))) return null;
  if (branches.length < 2) return null;

  return (
    <div className="container pt-4">
      <BranchFilter branches={branches} />
    </div>
  );
}
