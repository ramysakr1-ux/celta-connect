"use client";

import { usePathname } from "next/navigation";
import { BackLink } from "@/components/back-link";

// The room concept, applied to the whole trainee workspace.
//
// Ramy, 30 Aug 2026: "can we just apply the room concept to everything since
// we have a pill that would take us back? So that side panel will only
// appear when it's the course stream. Otherwise, you go inside the room and
// you stay inside the room. And then when you come out, you click on that
// pill... and it takes you back to the entrance that you came from."
//
// So the rail belongs to Course Stream alone. Everything else is a room: no
// rail, and one pill back to the door you came through.
//
// The pill is rendered HERE rather than on each page. Only Resource Hub had
// one; Teaching Practice, Written Assignments, CELTA 5 and Progress had
// none, because the rail was their way out. Turning them into rooms without
// this would have made four dead ends -- CELTA 5 was already one on desktop,
// with no rail, no pill, and its mobile nav hidden above md.
//
// Two rooms still take the full width, because their content genuinely needs
// the pixels rather than because they are rooms: the filmed-observation
// watch screen (a video) and the timetable (a nine-band grid with a 1280px
// minimum in the design). Everything else is a room at reading width --
// Ramy, earlier the same evening: "I don't want it to be a full screen."

/** Rooms whose content needs the pixels, not just the focus. */
const FULL_BLEED = [/\/filmed-observation\/[^/]+$/, /\/timetable$/];

/** Course Stream itself, plus the things that are part of it rather than
 *  rooms of their own -- a tutorial invite opens in the stream's context. */
const STREAM_ROUTES = [/\/individual-tutorial\//, /\/stage2-tutorial\//];

/** Which door a room is, so the pill can name it on the way out. Matches
 *  TraineeSidebarNav's own hrefs, so a tab added there works here. */
const DOORS = ["/resources", "/tp", "/assignments", "/celta5", "/progress"];

export function PortfolioFocusRow({
  sidebar,
  traineeId,
  children,
}: {
  sidebar: React.ReactNode;
  traineeId: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const base = `/portfolio/${traineeId}`;

  const isStream = pathname === base || STREAM_ROUTES.some((r) => r.test(pathname));
  const fullBleed = FULL_BLEED.some((r) => r.test(pathname));
  const door = DOORS.find((d) => pathname.startsWith(`${base}${d}`)) ?? null;

  if (isStream) {
    return (
      <div className="container flex flex-1 gap-6 py-6">
        {sidebar}
        <div className="min-w-0 flex-1 p-6">{children}</div>
      </div>
    );
  }

  // Inside a room. The pill is the way out, and it carries the door so the
  // rail can still be standing on it when you arrive back.
  const back = (
    <BackLink href={door ? `${base}?from=${door}` : base} label="Course stream" />
  );

  if (fullBleed) {
    return (
      <div className="flex flex-1 flex-col gap-4 px-4 py-6 xl:px-8">
        <div>{back}</div>
        {children}
      </div>
    );
  }

  return (
    <div className="container flex flex-1 py-6">
      <div className="flex min-w-0 flex-1 flex-col gap-4 p-6">
        <div>{back}</div>
        {children}
      </div>
    </div>
  );
}
