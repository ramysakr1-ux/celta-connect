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
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setError("Notifications are blocked -- allow them in your browser's site settings to turn this on.");
      return;
    }
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
    return supported && subscribed === false ? (
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={handleSubscribe}
          disabled={pending}
          className="self-start rounded-[6px] border border-border px-3 py-1.5 text-xs font-medium text-ink hover:border-primary disabled:opacity-60"
        >
          {pending ? "Enabling..." : "Enable notifications"}
        </button>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
    ) : null;
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
