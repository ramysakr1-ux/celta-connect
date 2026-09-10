"use client";

import { useEffect, useState } from "react";

// "Now", anchored to the SERVER's clock rather than the reader's device.
//
// Ramy, 11 Sep 2026, reasoning about it rather than seeing it: "if I change the
// time on my computer now, the centre will also change the time." He was right.
// Shifting the device clock forward 37 minutes moved the header clock from
// 00:56 to 01:33, live on production.
//
// The zone was never the problem -- that comes from the centre and always did.
// The INSTANT was: every one of these clocks took Date.now() from the browser
// and merely formatted it in the centre's zone. A laptop twenty minutes fast
// made every time on the page twenty minutes fast, and this value does not
// only draw a clock. It decides whether a session is on now, whether the Zoom
// door is open (joinableNow's ten-minute window), which block is "next", and
// what the countdown says. A wrong device clock let someone into a room early
// and closed it early.
//
// So: take the offset between the server's instant and the device's once, at
// mount, and tick from that. The interval still comes from the device -- there
// is nothing else to tick with -- but the ORIGIN is the server's, so a device
// hours out is corrected rather than believed. Accurate to about the network
// round trip, which for deciding whether a lesson has started is plenty.
//
// The first paint still uses serverNowMs exactly, because the server and the
// browser must render the same string or React refuses to hydrate.
export function useServerNow(serverNowMs: number, tickMs = 15_000): number {
  const [now, setNow] = useState(serverNowMs);

  useEffect(() => {
    const offset = serverNowMs - Date.now();
    const tick = () => setNow(Date.now() + offset);
    tick();
    const t = setInterval(tick, tickMs);
    return () => clearInterval(t);
    // serverNowMs changes on every server render, which is what re-anchors it.
  }, [serverNowMs, tickMs]);

  return now;
}
