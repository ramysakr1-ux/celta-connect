"use client";

import { usePathname } from "next/navigation";

/**
 * Puts an area's colour identity onto everything inside it.
 *
 * Ramy, 1 Sep 2026: one colour per room, "and everything inside that [area],
 * all the hovering will carry the same colour."
 *
 * A client component only because it needs the path. /dashboard's layout is
 * shared by Course Admin, Admissions, staff chat, the trainee dashboard and
 * the trainer dashboard, so the server layout alone cannot tell which room
 * you are standing in -- and colouring by role instead was the mistake we
 * nearly made: two people in the same room would have seen different colours,
 * which stops the colour being something you can say out loud.
 *
 * Setting the variables here rather than editing components is what makes
 * this cheap. Every .admin-hover-fill and .admin-hover inside picks the area
 * up automatically, because those classes read --area-accent and
 * --area-hover-fill with their old literals as fallbacks. An area with no
 * entry below simply looks the way it always did.
 */
// Staff chat is deliberately absent. It has no page of its own -- it is a
// drawer that floats over whichever room you are already in -- so giving it a
// colour would put two room identities on screen at once, which is the exact
// confusion this system exists to remove. Confirmed by /dashboard/staff-chat
// returning a 404: the folder holds a drawer component, not a route.
const AREA_BY_PREFIX: { prefix: string; className: string }[] = [
  // The owner's screen is not one of the four rooms -- it is where the four
  // are handed out -- and it has had its own register since it was built:
  // ink ground, garnet rule. It was still picking up Centre Management's
  // green below, so every hover on a garnet screen came back green. Ramy,
  // 1 Sep 2026: "can we make sure the hovering is relevant to the colour?
  // That sort of darker hover colour that matches the header."
  { prefix: "/centre/owner", className: "area-owner" },
  { prefix: "/centre/volunteers", className: "area-volunteers" },
  { prefix: "/dashboard/admissions", className: "area-admissions" },
  { prefix: "/dashboard/admin", className: "area-course-admin" },
  // /centre LAST: it is a prefix of /centre/volunteers, and the list is
  // matched in order, so a shorter prefix placed earlier would swallow the
  // rooms beneath it.
  { prefix: "/centre", className: "area-centre" },
];

export function areaClassFor(pathname: string): string | null {
  return AREA_BY_PREFIX.find((a) => pathname.startsWith(a.prefix))?.className ?? null;
}

export function AreaTheme({ children, className }: { children: React.ReactNode; className?: string }) {
  const pathname = usePathname() ?? "";
  const areaClass = areaClassFor(pathname);
  return <div className={[className, areaClass].filter(Boolean).join(" ") || undefined}>{children}</div>;
}

/**
 * The 3px rule under the header, in the area's own colour.
 *
 * Rendered inside the header rather than as a border on it, because the
 * header is a server component in a shared layout and only this client
 * component knows which area is showing. Renders nothing at all in an area
 * without an identity, leaving the plain hairline the header already has.
 */
export function AreaHeaderRule() {
  const pathname = usePathname() ?? "";
  const areaClass = areaClassFor(pathname);
  if (!areaClass) return null;
  return (
    <div className={areaClass} aria-hidden="true">
      <div className="h-[3px] w-full" style={{ background: "var(--area-rule)" }} />
    </div>
  );
}
