// Deliberately minimal: this app has no offline mode and no other reason
// to run a service worker yet, so this file exists only to receive push
// events. for-claude-code-announcements.md: only three kinds of push ever
// fire during a course (cancellation, room change, something already
// late) plus the volunteer "starts in 30 minutes" reminder -- so the
// payload is always a plain { title, body, url } and a click always just
// focuses/opens that url, nothing fancier needed.

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
