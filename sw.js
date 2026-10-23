// Service worker: ryhmächatin push-ilmoitukset. Ei välimuistia: sovellus haetaan aina
// palvelimelta, joten julkaistut muutokset näkyvät heti seuraavalla avauksella.
self.addEventListener("push", event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data && event.data.text() }; }
  event.waitUntil(self.registration.showNotification(data.title || "OPT-86", {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: data.tag,
    renotify: !!data.tag,
    data: { url: data.url || "/dashboard.html" }
  }));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const url = new URL(event.notification.data && event.notification.data.url || "/dashboard.html", self.location.origin).href;
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    // Avoin sovellus: tuodaan esiin ja pyydetään avaamaan ryhmän chat (chat.js kuuntelee)
    const open = all.find(c => new URL(c.url).pathname.endsWith("/dashboard.html") && "focus" in c);
    if (open) {
      open.postMessage({ type: "open-chat", url });
      return open.focus();
    }
    return self.clients.openWindow(url);
  })());
});
