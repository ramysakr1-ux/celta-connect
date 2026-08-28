"use client";

import { useEffect, useRef, useState } from "react";

// Ramy, 29 Aug 2026: "the film will pause... three pauses for sixty or
// ninety seconds to give them a chance to chat and write."
//
// The discussion breaks already worked against an uploaded file, because a
// <video> element is ours to pause. A YouTube <iframe> is not: nothing on
// the page can read its clock or stop it. This wraps YouTube's own IFrame
// Player API so the same break logic drives either player.
//
// The API script is loaded once per page and shared -- YouTube's onYouTube-
// IframeAPIReady is a single global callback, so a second loader would
// silently clobber the first.

declare global {
  interface Window {
    YT?: {
      Player: new (el: HTMLElement, opts: Record<string, unknown>) => YouTubePlayer;
      PlayerState: { PLAYING: number; PAUSED: number; ENDED: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

export interface YouTubePlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  destroy(): void;
}

let apiPromise: Promise<void> | null = null;

function loadYouTubeApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<void>((resolve) => {
    // Chain rather than overwrite: another component may already be waiting
    // on this same one-shot global.
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);
  });
  return apiPromise;
}

/**
 * Mounts a YouTube player into `containerRef` and polls its clock.
 *
 * Polling rather than an event: the API emits no timeupdate, and a break
 * has to fire within a second of its timestamp to feel deliberate rather
 * than late. 250ms is well under a frame budget for one getCurrentTime call
 * and gives a worst-case quarter-second overshoot.
 */
export function useYouTubePlayer({
  videoId,
  enabled,
  onTick,
}: {
  videoId: string | null;
  enabled: boolean;
  onTick: (currentSeconds: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const [ready, setReady] = useState(false);
  // Kept in a ref so changing the callback never tears down the player --
  // remounting it would restart the video from zero mid-lesson.
  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;

  useEffect(() => {
    if (!enabled || !videoId) return;
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    void loadYouTubeApi().then(() => {
      if (cancelled || !containerRef.current || !window.YT?.Player) return;
      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId,
        playerVars: {
          rel: 0,
          modestbranding: 1,
          // Origin-scoped so YouTube accepts commands from this page.
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            if (cancelled) return;
            setReady(true);
            interval = setInterval(() => {
              const t = playerRef.current?.getCurrentTime?.();
              if (typeof t === "number") onTickRef.current(t);
            }, 250);
          },
        },
      });
    });

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      playerRef.current?.destroy?.();
      playerRef.current = null;
      setReady(false);
    };
  }, [videoId, enabled]);

  return { containerRef, playerRef, ready };
}
