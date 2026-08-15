"use client";

import { useEffect, useState } from "react";

// specs/build-spec.md §7: "Offer 'Add to Home Screen' for trainees only
// (daily use for five weeks)." Rendered only from the real trainee nav
// branch (portfolio/[traineeId]/layout.tsx's showTraineeNav) -- staff,
// staff-previewing-as-trainee, and assessors never see this.
//
// Android/Chrome/Edge fire a real `beforeinstallprompt` event we can hook a
// custom button to. iOS Safari never fires it -- there is no programmatic
// install API there at all -- so iOS gets a manual instruction banner
// instead ("Share -> Add to Home Screen"). Dismissal is remembered in
// localStorage so it doesn't nag on every visit; there's no server-side
// signal for "already installed" so this is the only practical guard
// besides the standalone-mode check below.
const DISMISS_KEY = "connect-a2hs-dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function InstallPrompt() {
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(true); // default hidden until the effect below decides otherwise -- avoids a flash on every non-eligible render

  useEffect(() => {
    if (isStandalone() || localStorage.getItem(DISMISS_KEY) === "1") return;

    if (isIos()) {
      setShowIosHint(true);
      setDismissed(false);
      return;
    }

    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredEvent(e as BeforeInstallPromptEvent);
      setDismissed(false);
    }
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  async function handleInstallClick() {
    if (!deferredEvent) return;
    await deferredEvent.prompt();
    const { outcome } = await deferredEvent.userChoice;
    if (outcome === "accepted") {
      localStorage.setItem(DISMISS_KEY, "1");
    }
    setDeferredEvent(null);
    setDismissed(true);
  }

  if (dismissed || (!deferredEvent && !showIosHint)) return null;

  return (
    <div className="flex items-center justify-between gap-3 border-b border-border bg-accent/40 px-4 py-2 text-sm text-ink">
      {showIosHint ? (
        <p>
          Add Connect to your home screen: tap <span className="font-semibold">Share</span>, then{" "}
          <span className="font-semibold">Add to Home Screen</span>.
        </p>
      ) : (
        <p>Add Connect to your home screen for quicker daily access.</p>
      )}
      <div className="flex shrink-0 items-center gap-2">
        {!showIosHint ? (
          <button
            type="button"
            onClick={handleInstallClick}
            className="rounded-[6px] bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
          >
            Add
          </button>
        ) : null}
        <button type="button" onClick={dismiss} className="text-xs text-muted hover:text-ink" aria-label="Dismiss">
          Not now
        </button>
      </div>
    </div>
  );
}
