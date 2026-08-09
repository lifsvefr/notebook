/* Söguþræðir service worker — mirrors the Lífsteinn strategy:
   network-first for HTML (deploys apply immediately, 3s fallback to cache),
   cache-first for icons/manifest, stale-while-revalidate for Google Fonts. */
const CACHE = 'soguthraedir-v3';
const ICONS = ['icon-192.png','icon-512.png','icon-512-maskable.png','apple-touch-icon.png','favicon-32.png','favicon-16.png'];

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (e.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
    e.respondWith(networkFirst(e.request)); return;
  }
  if (ICONS.some(i => url.pathname.endsWith(i)) || url.pathname.endsWith('manifest.webmanifest') || url.pathname.indexOf('/glyphs/') !== -1) {
    e.respondWith(cacheFirst(e.request)); return;
  }
  if (url.hostname.indexOf('fonts.g') !== -1) {
    e.respondWith(staleWhileRevalidate(e.request)); return;
  }
});

async function networkFirst(req){
  const c = await caches.open(CACHE);
  try{
    const r = await Promise.race([
      fetch(req),
      new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), 3000))
    ]);
    if (r && r.ok) c.put(req, r.clone());   // never cache failures
    return r;
  }catch(err){
    const m = await c.match(req, {ignoreSearch: true});
    if (m) return m;
    throw err;
  }
}
async function cacheFirst(req){
  const c = await caches.open(CACHE);
  const m = await c.match(req);
  if (m) return m;
  const r = await fetch(req);
  if (r && r.ok) c.put(req, r.clone());     // never cache failures
  return r;
}
async function staleWhileRevalidate(req){
  const c = await caches.open(CACHE);
  const m = await c.match(req);
  const f = fetch(req).then(r => { if (r && r.ok) c.put(req, r.clone()); return r; }).catch(() => m);
  return m || f;
}
