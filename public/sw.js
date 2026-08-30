// Deliberately minimal: this app has no offline mode and no other reason
// to run a service worker yet, so this file exists only to receive push
// events. for-claude-code-announcements.md: only three kinds of push ever
// fire during a course (cancellation, room change, something already
// late) plus the volunteer "starts in 30 minutes" reminder -- so the
// payload is always a plain { title, body, url } and a click always just
// focuses/opens that url, nothing fancier needed.

// Chrome will not treat a site as installable -- and so never fires
// beforeinstallprompt -- unless its service worker has a fetch handler.
// Without this the "Add to home screen" offer could only ever appear on
// iOS, which reaches it through Safari's own Share menu and needs no event.
// Ramy, 30 Aug 2026, after the banner still did not come back: "still don't
// see the home screen thing."
//
// Deliberately a pass-through. This app has no offline mode and caching
// live course data would be worse than useless -- a volunteer reading a
// stale room number or a cancelled class is exactly the failure this whole
// page exists to prevent. So the handler exists to satisfy the criterion
// and to be the place a real offline strategy would go later, and every
// request continues straight to the network.
self.addEventListener("fetch", () => {});

self.addEventListener("push", (event) => {
  let payload = { title: "Connect", body: "" };
  try {
    payload = event.data.json();
  } catch {
    // Ignore -- an empty or malformed push just shows the fallback above.
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon-192.png",
      data: { url: payload.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url === url && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
