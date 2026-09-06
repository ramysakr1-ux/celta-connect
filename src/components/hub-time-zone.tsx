"use client";

import { createContext, useContext } from "react";
import { DEFAULT_TIMEZONE } from "@/lib/timetable-grid";

// The centre's own zone, put in reach of the hub's client components.
//
// Every date shown in the hub belongs to the centre, not to whoever is
// looking: a TP taught at 09:00 in New York was taught at 09:00 whether the
// MCT reads about it from Istanbul or from a plane. Both alternatives to
// this context are worse -- the browser's zone is the viewer's, and the
// runtime's zone is UTC.
//
// A context rather than props because the components that need it are
// scattered (a deadline banner, a prep list, a drag board, an access panel)
// and prop-drilling the same string down eight unrelated trees invites the
// one that quietly gets missed. Server components should NOT use this: they
// have the centre in hand already and should pass the zone to the lib
// helpers directly.
const HubTimeZoneContext = createContext<string>(DEFAULT_TIMEZONE);

export function HubTimeZoneProvider({ timeZone, children }: { timeZone: string | null | undefined; children: React.ReactNode }) {
  return <HubTimeZoneContext.Provider value={timeZone || DEFAULT_TIMEZONE}>{children}</HubTimeZoneContext.Provider>;
}

export function useHubTimeZone(): string {
  return useContext(HubTimeZoneContext);
}
