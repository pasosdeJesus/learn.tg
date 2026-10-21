// Service worker "kill switch".
//
// Copied to public/sw.js by `make pwa-kill-switch` to retire a service worker
// that is already deployed and registered in browsers. Deleting public/sw.js is
// not enough: a 404 (or a 500, which is what `next start` answers for a missing
// /sw.js) fails the update check and the old worker stays active.
//
// The next time a browser revalidates /sw.js (workers are checked on navigation,
// at most once per 24 h), this file replaces the old worker, clears every cache
// of the origin, unregisters itself and reloads the open tabs. After one or two
// weeks with no /sw.js requests in the access log, run `make pwa-clean` and leave
// an empty public/sw.js (or answer 404 for that path in nginx).
//
// See doc/pwa-developer-guide.md ("Generated files and how to retire the worker").

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.map((key) => caches.delete(key)))
    await self.registration.unregister()
    const clients = await self.clients.matchAll({ type: 'window' })
    for (const client of clients) client.navigate(client.url)
  })())
})
