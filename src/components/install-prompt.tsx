"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";

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
//
// Ramy, 6 Sep 2026, trainee view: "we don't need both... does it need to be
// on every page or just the landing page?" -- and: all of it. So for
// trainees the banner is the one door, shown on the landing page only
// (`landingPath`), and the inline variant is gone from their footer. The
// week-long snooze is what makes that safe: "Not now" brings it back on
// the next landing after seven days rather than for never. Volunteers keep
// the inline button -- a link in an old email is their only way in, and
// that button is how it becomes something they keep.
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

/** Which manual gesture to describe when the browser gives us no install
 *  event to fire. Coarse on purpose -- these are three genuinely different
 *  gestures, and naming the wrong menu is worse than naming none. */
function manualRoute(): "ios" | "android" | "desktop" {
  if (isIos()) return "ios";
  if (typeof navigator !== "undefined" && /android/i.test(navigator.userAgent)) return "android";
  return "desktop";
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

export function InstallPrompt({
  variant = "banner",
  landingPath,
  tone = "light",
}: {
  variant?: "banner" | "inline" | "pill";
  /** The pill on a dark header band takes the band's own light ink. */
  tone?: "light" | "dark";
  /** One path, or several -- /dashboard wraps Course Admin and Admissions. */
  landingPath?: string | string[];
}) {
  // Only the banner is ever confined to one page; the inline variant is
  // placed by hand where it belongs.
  const pathname = usePathname();
  const landings = landingPath === undefined ? null : Array.isArray(landingPath) ? landingPath : [landingPath];
  const offLanding = variant === "banner" && landings !== null && !landings.includes(pathname);
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
  const route = onClient ? manualRoute() : "desktop";
  const ios = onClient && isIos();
  // The banner used to be gated on `promptFired` -- Chrome's
  // beforeinstallprompt. That is the browser's decision, not ours: Chrome
  // withholds it behind engagement heuristics, and desktop Safari and Firefox
  // never fire it at all. The inline variant was ungated on 6 Sep 2026 for
  // exactly that reason; the banner was not, and then the inline entry was
  // removed from the trainee's footer the same day -- which left a trainee on
  // any of those browsers with NO way to install, on the one screen that was
  // supposed to offer it. Measured on production 17 Sep 2026: nothing rendered.
  //
  // So the banner is offered whenever the app is not already installed. The
  // click fires the real prompt when there is one and explains the gesture
  // when there is not, which is what the inline entry has done since the 6th.
  const installable = onClient && !standalone;
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
    // No real prompt to fire -- show the gesture for this browser, rather
    // than being a button that does nothing.
    if (!deferredEvent) {
      setShowIosSteps((v) => !v);
      return;
    }
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

  const gesture =
    route === "ios" ? (
      <>
        Tap <span className="font-semibold text-ink">Share</span>, then{" "}
        <span className="font-semibold text-ink">Add to Home Screen</span>.
      </>
    ) : route === "android" ? (
      <>
        Open your browser&apos;s menu, then <span className="font-semibold text-ink">Add to Home screen</span>.
      </>
    ) : (
      <>
        In Chrome or Edge, use the install icon at the right of the address bar, or the browser menu then{" "}
        <span className="font-semibold text-ink">Install page as app</span>. In Safari, use{" "}
        <span className="font-semibold text-ink">File &rsaquo; Add to Dock</span>.
      </>
    );

  // The pill: a small, permanent door in every shell's header (Ramy, 17 Sep
  // 2026, having looked for the banner twice and found it snoozed: "should
  // probably design something small and apparent"). Never snoozed, never
  // nags, gone only once the app is installed. Same shape as the demo-clock
  // tag it sits beside; .eyebrow takes the shell's own tracking. The click
  // fires the real prompt when the browser has one and otherwise opens a
  // small note with the gesture, under the pill so the header never jumps.
  if (variant === "pill") {
    if (!onClient || standalone) return null;
    const dark = tone === "dark";
    return (
      <div className="relative flex-none">
        <button
          type="button"
          onClick={handleInstallClick}
          aria-expanded={showIosSteps}
          aria-label="Add Connect to your home screen"
          className="eyebrow wash inline-flex h-[26px] items-center gap-1.5 rounded-full border px-2.5 text-micro whitespace-nowrap"
          style={
            dark
              ? { borderColor: "oklch(78% 0.02 80 / 0.35)", color: "oklch(78% 0.02 80)" }
              : { borderColor: "var(--color-border)", background: "var(--color-card)", color: "var(--color-ink)" }
          }
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="5" y="2" width="14" height="20" rx="2" />
            <path d="M12 7v6m0 0 2.5-2.5M12 13l-2.5-2.5" />
          </svg>
          <span className="hidden sm:inline">Add to home screen</span>
          <span className="sm:hidden">Install</span>
        </button>
        {showIosSteps ? (
          <div
            role="note"
            className="absolute top-[32px] right-0 z-30 w-[300px] rounded-[10px] border border-border bg-card p-3 text-left text-label leading-[1.5] text-muted"
            style={{ boxShadow: "var(--shadow-lift)" }}
          >
            {gesture}
          </div>
        ) : null}
      </div>
    );
  }

  // A quiet, permanent way in -- sits with the other footer actions, is
  // never snoozed, and never nags.
  //
  // Deliberately NOT gated on beforeinstallprompt. That event is the
  // browser's decision, not ours: Chrome withholds it behind its own
  // engagement heuristics and fires it at most once per page load, Firefox
  // and desktop Safari never fire it at all, and iOS has no install API
  // whatsoever. Gating on it made the offer invisible in exactly the
  // situations where somebody would go looking for it -- which is what
  // Ramy hit. So the line is always here whenever the app is not already
  // installed; the click uses the real prompt when there is one, and
  // explains the manual gesture when there is not.
  if (variant === "inline") {
    if (!onClient || standalone) return null;
    return (
      <div className="flex w-full flex-col items-center gap-1.5">
        {/* A real control, not an 11px grey footnote.
        
            Ramy looked for this twice and did not find it: "I checked the
            volunteer students' view and still no option to create the home
            screen shortcut." It WAS rendering -- but as muted 11px text at
            the bottom of a long scroll, squeezed narrow enough to wrap into
            a column. Something that is genuinely invisible is not built.
        
            For a volunteer this is not a nicety. They have no account and no
            password; a link in an old email is their entire way in, and this
            button is how that link becomes something they keep. It gets to
            look like a button. */}
        <button
          type="button"
          onClick={handleInstallClick}
          className="wash inline-flex shrink-0 items-center gap-2 rounded-[6px] border border-border px-3 py-1.5 text-label font-medium whitespace-nowrap text-ink"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="5" y="2" width="14" height="20" rx="2" />
            <path d="M12 7v6m0 0 2.5-2.5M12 13l-2.5-2.5" />
          </svg>
          Keep this on your home screen
        </button>
        {showIosSteps ? <p className="max-w-[46ch] text-center text-label leading-[1.5] text-muted">{gesture}</p> : null}
      </div>
    );
  }

  if (offLanding || !installable || bannerSnoozed) return null;

  return (
    <div className="flex items-center justify-between gap-3 border-b border-border bg-accent/40 px-4 py-2 text-body text-ink">
      {ios ? (
        <p>
          Add Connect to your home screen: tap <span className="font-semibold">Share</span>, then{" "}
          <span className="font-semibold">Add to Home Screen</span>.
        </p>
      ) : showIosSteps ? (
        // No real prompt on this browser, so the button says how instead of
        // doing nothing.
        <p>
          {route === "android" ? (
            <>
              Open your browser&apos;s menu, then <span className="font-semibold">Add to Home screen</span>.
            </>
          ) : (
            <>
              In Chrome or Edge, use the install icon at the right of the address bar, or the menu then{" "}
              <span className="font-semibold">Install page as app</span>. In Safari, use{" "}
              <span className="font-semibold">File &rsaquo; Add to Dock</span>.
            </>
          )}
        </p>
      ) : (
        <p>Add Connect to your home screen for quicker daily access.</p>
      )}
      <div className="flex shrink-0 items-center gap-2">
        {!ios ? (
          <button
            type="button"
            onClick={handleInstallClick}
            className="rounded-[6px] bg-primary px-3 py-1.5 text-label font-semibold text-primary-foreground"
          >
            {promptFired ? "Add" : showIosSteps ? "Got it" : "How"}
          </button>
        ) : null}
        <button type="button" onClick={snooze} className="text-label text-muted hover:text-ink" aria-label="Not now">
          Not now
        </button>
      </div>
    </div>
  );
}
