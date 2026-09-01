"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The four rooms, and which one you are standing in.
 *
 * Ramy settled the model on 1 Sep 2026: four rooms, four colours, and nothing
 * about who works in them. "We don't know. Maybe the same dude would be centre
 * manager and would do admissions. Maybe the same chick would be course admin
 * and take care of the volunteer pool. We're just giving the options." So the
 * pills are places, never people -- no role is encoded here.
 *
 * The three you are not in sit on top, closed up and left-aligned. The one you
 * are in drops to a row beneath and KEEPS its own colour, sitting on the front
 * of the page. An earlier version left the active pill's slot empty above,
 * which he rejected: "I don't want Course admin to drop down and then there's
 * a blank underneath... they should align."
 *
 * The distinction is positional, not stylistic. Three things you can click,
 * one thing you are standing on, told apart by where they are rather than by
 * reading a shade -- which is what the old pills asked of you, and why it was
 * possible to be in Course Admin believing you were in Centre Management.
 */
export interface Room {
  key: string;
  label: string;
  href: string;
  /** Matched as a prefix; the longest match wins, so /centre never swallows /centre/volunteers. */
  match: string;
  /** The room's colour, as a CSS colour value. */
  colour: string;
}

export const ROOMS: Room[] = [
  { key: "centre", label: "Centre management", href: "/centre", match: "/centre", colour: "oklch(45% 0.10 160)" },
  { key: "course-admin", label: "Course admin", href: "/dashboard/admin", match: "/dashboard/admin", colour: "oklch(42% 0.13 27)" },
  { key: "admissions", label: "Admissions", href: "/dashboard/admissions", match: "/dashboard/admissions", colour: "oklch(42% 0.10 320)" },
  { key: "volunteers", label: "Volunteer pool", href: "/centre/volunteers", match: "/centre/volunteers", colour: "oklch(45% 0.10 260)" },
];

/**
 * Paths that sit inside a room's prefix but are not that room.
 *
 * The centre owner's screen lives at /centre/owner, so the longest-prefix
 * match below read it as Centre Management: the Centre management pill
 * dropped beneath the other three, and the surface took Centre Management's
 * colour, on a screen that is not one of the four rooms. Ramy, 1 Sep 2026:
 * "I think all four tabs should be next to each other in order. I don't know
 * why centre management is sitting below."
 *
 * The owner screen stands above the rooms rather than beside them -- it is
 * where the four are handed out -- which is why its own design is a
 * different register entirely (ink and garnet, a dark band). With no active
 * room, all four pills stay in the top row, which is the honest answer to
 * "which room am I in": none of them.
 */
const NOT_A_ROOM = ["/centre/owner"];

export function activeRoomKey(pathname: string): string | null {
  if (NOT_A_ROOM.some((p) => pathname === p || pathname.startsWith(p + "/"))) return null;
  // Longest match wins: /centre/volunteers is inside /centre, and the room you
  // are in is the more specific one.
  const hit = ROOMS.filter((r) => pathname.startsWith(r.match)).sort((a, b) => b.match.length - a.match.length)[0];
  return hit?.key ?? null;
}

export function RoomPills({ visible }: { visible: string[] }) {
  const pathname = usePathname() ?? "";
  const activeKey = activeRoomKey(pathname);
  const rooms = ROOMS.filter((r) => visible.includes(r.key));
  const others = rooms.filter((r) => r.key !== activeKey);
  const here = rooms.find((r) => r.key === activeKey) ?? null;

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center gap-1.5">
        {others.map((r) => (
          <Link key={r.key} href={r.href} className="room-pill" style={{ "--pill-c": r.colour } as React.CSSProperties}>
            {r.label}
          </Link>
        ))}
      </div>
      {/* -mb-px so the pill's bottom edge and the surface's top edge are the
          same line, which is what makes it read as attached rather than
          stacked above it. Placed here rather than inside the ternary: a JSX
          comment beside an element is two adjacent expressions, which is the
          second time today I have made that exact mistake. */}
      {here ? (
        <div className="-mb-px mt-2 flex">
          {/* Clickable unless you are already standing on the room's own
              landing page, in which case it is just a label.

              Ramy, 1 Sep 2026: "once you click on one of the courses, there's
              no way to go back to Course admin because you can't click on
              Course admin." The dropped pill was a span, so a room's deeper
              pages had exactly one way out -- the Connect mark, which leaves
              the room entirely. Now it is both "you are here" and "back to the
              top of here", which is how a tab normally behaves.

              Not a separate back pill: that would be a fifth thing in a row
              whose whole point is that there are four. */}
          {pathname === here.href ? (
            <span className="room-pill-here" style={{ "--pill-c": here.colour } as React.CSSProperties}>
              {here.label}
            </span>
          ) : (
            <Link
              href={here.href}
              className="room-pill-here hover:brightness-110"
              style={{ "--pill-c": here.colour } as React.CSSProperties}
            >
              {here.label}
            </Link>
          )}
        </div>
      ) : null}
    </div>
  );
}
