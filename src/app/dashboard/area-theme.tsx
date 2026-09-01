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
const AREA_BY_PREFIX: { prefix: string; className: string }[] = [
  { prefix: "/dashboard/admin", className: "area-course-admin" },
  // Admissions and staff chat deliberately have no colour yet. Until 1 Sep
  // they inherited Course Admin's teal by accident -- the rule was applied on
  // `role === "admin"`, which is true across this whole layout -- so three
  // rooms shared one identity. Neutral is the honest state until each is
  // given its own.
];

export function areaClassFor(pathname: string): string | null {
  return AREA_BY_PREFIX.find((a) => pathname.startsWith(a.prefix))?.className ?? null;
}

export function AreaTheme({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const areaClass = areaClassFor(pathname);
  return <div className={areaClass ?? undefined}>{children}</div>;
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
