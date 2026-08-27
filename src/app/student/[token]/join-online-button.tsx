"use client";

import { useEffect, useState } from "react";

function VideoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 10l4.5-2.5v9L15 14" />
      <rect x="3" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(Math.ceil(ms / 1000), 0);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

// Ramy, 25 Aug 2026: "when five minutes or ten minutes before, the Zoom
// link will be active... there's a timer, there's a countdown when the
// lesson will start." Only the FIRST TP of the day is gated at all
// (activationIso is null for every later-in-the-day class, per "between
// lessons... it should always be active" -- someone stepping out for a
// break shouldn't have to wait through another countdown). While gated,
// the button itself IS the countdown -- "Join in 8:32" -- rather than a
// separate timer element plus a dead button; clicking it early still
// shows the activation-time message he asked for, in case someone taps
// through the countdown out of impatience.
export function JoinOnlineButton({ zoomUrl, activationIso, className }: { zoomUrl: string; activationIso: string | null; className: string }) {
  const activationMs = activationIso ? new Date(activationIso).getTime() : null;
  // `now` starts null so the server render and the client's first render
  // (hydration) show the exact same text either way -- Date.now() only
  // ever gets called client-side, after mount, same fix as the
  // no-Math.random-on-first-render rule. Until then, a gated button shows
  // a placeholder countdown rather than the real link -- never flips to
  // "active" purely because the clock hasn't loaded yet.
  const [now, setNow] = useState<number | null>(null);
  const [showMessage, setShowMessage] = useState(false);

  const mounted = now != null;
  const active = activationMs == null || (mounted && now >= activationMs);

  useEffect(() => {
    if (activationMs == null) return;
    const tick = () => {
      const next = Date.now();
      setNow(next);
      if (next >= activationMs) clearInterval(id);
    };
    const id = setInterval(tick, 1000);
    const firstTick = setTimeout(tick, 0);
    return () => {
      clearInterval(id);
      clearTimeout(firstTick);
    };
  }, [activationMs]);

  if (active) {
    return (
      <a href={zoomUrl} target="_blank" rel="noopener noreferrer" className={`${className} volunteer-hover-fill`}>
        <VideoIcon />
        Join online
      </a>
    );
  }

  const activationLabel = activationMs
    ? new Date(activationMs).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="relative">
      <button type="button" onClick={() => setShowMessage((v) => !v)} className={`${className} opacity-60 volunteer-hover-fill`}>
        <VideoIcon />
        Join in {mounted ? formatCountdown(activationMs! - now) : "--:--"}
      </button>
      {showMessage ? (
        <div className="absolute top-full left-0 z-10 mt-1.5 w-56 rounded-[8px] border border-border bg-card p-2.5 text-xs text-ink shadow-lg">
          The link opens {activationLabel ? `at ${activationLabel}` : "shortly"} — 10 minutes before class starts.
        </div>
      ) : null}
    </div>
  );
}
