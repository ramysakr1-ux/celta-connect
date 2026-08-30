"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

// specs/build-spec.md §7: "Offer 'Add to Home Screen' for trainees only
// (daily use for five weeks)." Also rendered on the volunteer page, where
// the token link is the only way back in at all.
//
// Android/Chrome/Edge fire a real `beforeinstallprompt` event we can hook a
// custom button to. iOS Safari never fires it -- there is no programmatic
// install API there -- so iOS gets the manual instruction instead
// ("Share -> Add to Home Screen").
//
// Ramy, 30 Aug 2026: "I said not now, and then it disappeared. Just
// completely disappears."
//
// It did, permanently: "Not now" wrote a flag that was never cleared, so
// the banner never came back on that device and there was no other way to
// install. "Not now" has to mean not now. It snoozes for a week, and the
// inline variant below gives a quiet, always-present way in that ignores
// the snooze entirely -- so choosing "not now" once can never strand
// somebody who changes their mind an hour later.
const DISMISS_KEY = "connect-a2hs-dismissed";
const SNOOZE_DAYS = 7;

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

/** Is the snooze still running? "1" is the old permanent flag -- treated as
 *  a snooze starting now, so devices carrying it get the offer back rather
 *  than staying silenced forever. */
function snoozed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    if (raw === "1") {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
      return true;
    }
    const at = Number(raw);
    if (!Number.isFinite(at)) return false;
    return Date.now() - at < SNOOZE_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

const subscribeNothing = () => () => {};

export function InstallPrompt({ variant = "banner" }: { variant?: "banner" | "inline" }) {
  // Everything this component decides on -- user agent, display mode,
  // localStorage -- exists only in the browser, so the server render and
  // the hydration render must both be "nothing". useSyncExternalStore is
  // the hydration-safe way to say that: it returns the server snapshot
  // while hydrating and the client one immediately after, without a
  // setState in an effect and without a mismatch.
  const onClient = useSyncExternalStore(subscribeNothing, () => true, () => false);

  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [promptFired, setPromptFired] = useState(false);
  const [showIosSteps, setShowIosSteps] = useState(false);
  const [snoozedNow, setSnoozedNow] = useState(false);

  useEffect(() => {
    // iOS never fires this, and needs no listener -- there is nothing to
    // defer, only an instruction to show.
    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredEvent(e as BeforeInstallPromptEvent);
      setPromptFired(true);
    }
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  const standalone = onClient && isStandalone();
  const ios = onClient && isIos();
  const installable = onClient && !standalone && (ios || promptFired);
  // The inline entry is never snoozed -- that is the whole point of it.
  const bannerSnoozed = variant === "banner" && (snoozedNow || (onClient && snoozed()));

  function snooze() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // A browser refusing storage is not a reason to keep the banner up.
    }
    setSnoozedNow(true);
  }

  async function handleInstallClick() {
    if (ios) {
      setShowIosSteps((v) => !v);
      return;
    }
    if (!deferredEvent) return;
    await deferredEvent.prompt();
    const { outcome } = await deferredEvent.userChoice;
    if (outcome === "accepted") {
      try {
        localStorage.setItem(DISMISS_KEY, String(Date.now()));
      } catch {}
      setPromptFired(false);
    }
    setDeferredEvent(null);
    setSnoozedNow(true);
  }

  if (!installable) return null;

  // A quiet, permanent way in -- sits with the other footer actions, is not
  // snoozed, and never nags.
  if (variant === "inline") {
    return (
      <div className="flex flex-col items-center gap-1">
        <button type="button" onClick={handleInstallClick} className="text-[11px] text-muted hover:underline">
          Keep Connect on your home screen
        </button>
        {ios && showIosSteps ? (
          <p className="max-w-[38ch] text-center text-[11px] leading-[1.5] text-muted">
            Tap <span className="font-semibold text-ink">Share</span>, then{" "}
            <span className="font-semibold text-ink">Add to Home Screen</span>.
          </p>
        ) : null}
      </div>
    );
  }

  if (bannerSnoozed) return null;

  return (
    <div className="flex items-center justify-between gap-3 border-b border-border bg-accent/40 px-4 py-2 text-sm text-ink">
      {ios ? (
        <p>
          Add Connect to your home screen: tap <span className="font-semibold">Share</span>, then{" "}
          <span className="font-semibold">Add to Home Screen</span>.
        </p>
      ) : (
        <p>Add Connect to your home screen for quicker daily access.</p>
      )}
      <div className="flex shrink-0 items-center gap-2">
        {!ios ? (
          <button
            type="button"
            onClick={handleInstallClick}
            className="rounded-[6px] bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
          >
            Add
          </button>
        ) : null}
        <button type="button" onClick={snooze} className="text-xs text-muted hover:text-ink" aria-label="Not now">
          Not now
        </button>
      </div>
    </div>
  );
}
