const CACHE = 'elbow-rehab-v1.2.1';
const ASSETS = [
  './',
  'index.html',
  'styles.css',
  'app.js',
  'exercises.js',
  'photos/finger-extension-band-1.jpg',
  'photos/finger-extension-band-2.jpg',
  'photos/pronation-supination-hammer-1.jpg',
  'photos/pronation-supination-hammer-2.jpg',
  'photos/towel-roll-squeeze-1.jpg',
  'photos/towel-roll-squeeze-2.jpg',
  'photos/wrist-extension-dumbbell-1.jpg',
  'photos/wrist-extension-dumbbell-2.jpg',
  'photos/wrist-extension-stretch-1.jpg',
  'photos/wrist-extension-stretch-2.jpg',
  'photos/wrist-flexion-dumbbell-1.jpg',
  'photos/wrist-flexion-dumbbell-2.jpg',
  'photos/wrist-flexion-stretch-1.jpg',
  'photos/wrist-flexion-stretch-2.jpg',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache-first for app files, falling back to the network.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).catch(() => caches.match('index.html')))
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((list) => {
      if (list.length) return list[0].focus();
      return self.clients.openWindow('./');
    })
  );
});
