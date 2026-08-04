// Minimal service worker — required by browsers for PWA installability.
// No offline caching strategy yet; just a pass-through fetch handler.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("fetch", () => {});
