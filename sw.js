const CACHE_NAME = 'kalin-cache-v15';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Lecteur PDF (pdf.js) : mis en cache pour lire les notices hors connexion
const PDFJS = [
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(ASSETS).then(() =>
        Promise.all(PDFJS.map((u) =>
          fetch(u, { mode: 'cors' }).then((r) => { if (r.ok) return cache.put(u, r); }).catch(() => {})
        ))
      )
    )
  );
  // Pas de skipWaiting : la nouvelle version prend le relais au prochain lancement,
  // sans interrompre l'app pendant qu'elle démarre (évite la fermeture éclair sur iPad).
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
});

self.addEventListener('fetch', (event) => {
  const isPage = event.request.mode === 'navigate' || event.request.url.endsWith('index.html') || event.request.url.endsWith('/');

  if (isPage) {
    // Page HTML : toujours essayer le réseau en premier (pour avoir les mises à jour),
    // et retomber sur le cache seulement si hors-ligne.
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' })
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request).then((c) => c || caches.match('./index.html')))
    );
    return;
  }

  // Autres fichiers (icônes, manifest) : cache en premier, réseau en secours.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});
