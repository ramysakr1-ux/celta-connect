"use client";

import { useEffect, useState, useTransition } from "react";

interface PushActionResult {
  error: string | null;
  subscribed: boolean;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

// Shared by the staff (Today tab) and volunteer (/student/[token]) entry
// points -- the browser-side subscribe/unsubscribe dance is identical
// either way, only which server action gets called differs, so the caller
// passes those in already bound to the right identity (session vs token).
export function PushSubscribeButton({
  subscribe,
  unsubscribe,
}: {
  subscribe: (input: { endpoint: string; p256dh: string; authKey: string }) => Promise<PushActionResult>;
  unsubscribe: (endpoint: string) => Promise<PushActionResult>;
}) {
  // Computed once, lazily, rather than set from inside the effect below --
  // avoids a synchronous setState-in-effect for the (very common) case of
  // a browser that doesn't support this at all.
  const [supported] = useState(
    () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window
  );
  const [subscribed, setSubscribed] = useState<boolean | null>(null); // null = still checking
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Ramy, 30 Aug 2026: "when I click I don't want notifications and then I
  // want to return to enable, it says notifications are blocked -- allow
  // them in your browser site settings. Is this how it's [meant to be]?"
  //
  // Half yes. Once you answer the BROWSER's own prompt with no, permission
  // is "denied" and requestPermission() resolves denied without showing
  // anything: no site can re-ask itself, anywhere. That part is a browser
  // rule and not ours to change.
  //
  // The two things that were ours, and were wrong:
  //
  //  - Dismissing the prompt (clicking away, Esc) leaves permission at
  //    "default", not "denied" -- clicking again would have worked fine.
  //    We showed the same "blocked, go to site settings" wall for both,
  //    sending people digging through browser settings to fix something
  //    that was not broken.
  //  - After a real denial the button still read "Enable notifications"
  //    and invited a click that could never succeed. The state was only
  //    ever discovered by pressing it.
  //
  // Worth being clear that the in-app "turn off" is a different thing
  // entirely: it drops the push subscription and leaves permission
  // granted, so turning them back on is one click with no prompt at all.
  // Read lazily rather than set from inside the effect below, same reason
  // `supported` is: it is a synchronous property, and assigning it in an
  // effect costs a second render for a value already known at mount.
  const [permission, setPermission] = useState<NotificationPermission | null>(
    () => (typeof window !== "undefined" && "Notification" in window ? Notification.permission : null)
  );
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!supported) return;
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub))
      .catch(() => setSubscribed(false));
  }, [supported]);

  async function handleSubscribe() {
    setError(null);
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) {
      setError("Notifications aren't set up yet.");
      return;
    }
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result !== "granted") {
      // "default" means the prompt was dismissed rather than refused, and
      // asking again is allowed -- so say that, instead of sending someone
      // into browser settings they do not need to open.
      setDismissed(result === "default");
      return;
    }
    setDismissed(false);
    const registration = await navigator.serviceWorker.ready;
    const pushSubscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });
    const json = pushSubscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      setError("Something went wrong. Try again.");
      return;
    }
    startTransition(async () => {
      const result = await subscribe({ endpoint: json.endpoint!, p256dh: json.keys!.p256dh!, authKey: json.keys!.auth! });
      setError(result.error);
      setSubscribed(result.subscribed);
    });
  }

  function handleUnsubscribe() {
    startTransition(async () => {
      const registration = await navigator.serviceWorker.ready;
      const pushSubscription = await registration.pushManager.getSubscription();
      if (!pushSubscription) {
        setSubscribed(false);
        return;
      }
      const endpoint = pushSubscription.endpoint;
      await pushSubscription.unsubscribe();
      const result = await unsubscribe(endpoint);
      setError(result.error);
      setSubscribed(result.subscribed);
    });
  }

  if (!supported || subscribed === null || subscribed === false) {
    // Unsupported entirely, still checking, or checked-and-not-subscribed
    // -- the first two show nothing yet; the last shows the opt-in.
    if (!supported || subscribed !== false) return null;

    if (permission === "denied") {
      return (
        <p className="max-w-[42ch] text-[11px] leading-[1.55] text-muted">
          Notifications are turned off for this site in your browser. Only your browser can turn them back
          on &mdash; use the icon at the left of the address bar, set Notifications to Allow, then reload
          this page.
        </p>
      );
    }

    return (
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={handleSubscribe}
          disabled={pending}
          className="self-start rounded-[6px] border border-border px-3 py-1.5 text-xs font-medium text-ink hover:border-primary disabled:opacity-60"
        >
          {pending ? "Enabling..." : "Enable notifications"}
        </button>
        {dismissed ? (
          <p className="text-[11px] text-muted">You closed your browser&apos;s prompt. Click again if you&apos;d like these on.</p>
        ) : null}
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleUnsubscribe}
        disabled={pending}
        className="self-start rounded-[6px] border border-border px-3 py-1.5 text-xs font-medium text-muted hover:border-destructive hover:text-destructive disabled:opacity-60"
      >
        {pending ? "Turning off..." : "Notifications on -- turn off"}
      </button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
