"use client";

import { useState } from "react";

// for-claude-code-input-sessions-batch-4.md: "existing video embeds
// converted from always-visible players to a small 'Click for video'
// button that reveals the player on click" -- applies to every video in
// this library going forward, not just the two the note calls out.
export function VideoReveal({ embedUrl, label = "Click for video" }: { embedUrl: string; label?: string }) {
  const [playing, setPlaying] = useState(false);

  if (!playing) {
    return (
      <button
        type="button"
        onClick={() => setPlaying(true)}
        className="self-start flex h-[34px] items-center gap-1.5 rounded-full border border-destructive/40 bg-destructive/5 px-4 text-xs font-semibold text-destructive"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
        {label}
      </button>
    );
  }

  return (
    <div className="relative w-full max-w-[480px] overflow-hidden rounded-[8px] bg-ink" style={{ paddingTop: "42%" }}>
      <iframe
        src={embedUrl}
        title="Session video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
        className="absolute inset-0 size-full border-0"
      />
    </div>
  );
}
