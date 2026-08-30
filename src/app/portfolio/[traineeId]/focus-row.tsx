"use client";

import { usePathname } from "next/navigation";

// Ramy, 29 Aug 2026: "why is the toolbar on the side showing? Why does it
// show the workspace?" -- on the filmed-observation watch screen, where he
// had already pointed out the video was only a quarter of the screen.
//
// The nav rail costs ~180px on the one page that most needs width, and a
// candidate on that screen is doing one focused thing for 45 minutes with
// a "← Course stream" link already at the top. So the watch screen drops
// the rail and the 1280px container both, and everything else keeps them.
//
// This replaced a negative-margin full-bleed hack on the page itself,
// which was subtly wrong: margin-inline: calc(50% - 50vw) only centres
// when the element is already centred in the viewport, and this content is
// offset right by the rail -- so it stretched asymmetrically and ran under
// the nav. Removing the rail is both the correct fix and the one he asked
// for.
const FOCUS_ROUTES = [
  // The watch screen itself, not its /task child -- that page is ordinary
  // reading-width content.
  /\/filmed-observation\/[^/]+$/,

  // The timetable's grid is nine time bands wide -- the design file sets a
  // 1280px minimum, so inside the rail and the container it starts scrolling
  // sideways before it has shown a full day. Ramy, 29 Aug 2026, asked for
  // full width here explicitly: "I'll go with full width as well, agreed."
  /\/timetable$/,
  // The CELTA 5 is a document, not a page of the app -- an assessor opens it
  // on the visit and reads it as Cambridge's form. Ramy, 29 Aug 2026: "why
  // am I seeing the workspace? It should be the full page."
  /\/celta5$/,
];

// Dropping the rail and going edge-to-edge were one decision, and they
// should not have been. Resource Hub wants the first and not the second:
// Ramy, 29 Aug -- "once you click, you're jumping inside a different room"
// -- then 30 Aug, having seen it do both: "I don't want the side panel to
// be there all the time... I don't want it to be a full screen. Remember,
// it's like the room concept."
//
// So a room is its own page without the rail, still at reading width. Only
// the three routes that genuinely need the pixels go full-bleed: the watch
// screen, the timetable's nine-band grid, and the CELTA 5 document.
const ROOM_ROUTES = [/\/resources$/];

export function PortfolioFocusRow({ sidebar, children }: { sidebar: React.ReactNode; children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const focused = FOCUS_ROUTES.some((r) => r.test(pathname));
  const room = ROOM_ROUTES.some((r) => r.test(pathname));

  if (focused) {
    return <div className="flex-1 px-4 py-6 xl:px-8">{children}</div>;
  }

  if (room) {
    return (
      <div className="container flex flex-1 py-6">
        <div className="min-w-0 flex-1 p-6">{children}</div>
      </div>
    );
  }

  return (
    <div className="container flex flex-1 gap-6 py-6">
      {sidebar}
      <div className="min-w-0 flex-1 p-6">{children}</div>
    </div>
  );
}
