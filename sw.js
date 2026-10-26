const CACHE_NAME = 'kalin-cache-v20';
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
      // cache: 'reload' : on force le téléchargement de la version la plus récente
      // (et non une ancienne copie gardée par le navigateur)
      cache.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))).then(() =>
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
    // À chaque ouverture en ligne, la copie hors connexion est remplacée par la version
    // la plus récente (sous les deux adresses de l'app), et on attend que ce soit bien
    // enregistré : ainsi, hors connexion, c'est toujours la dernière version qui s'ouvre.
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' })
        .then((response) => {
          if (response && response.ok) {
            const c1 = response.clone(), c2 = response.clone();
            event.waitUntil(
              caches.open(CACHE_NAME).then((cache) => Promise.all([
                cache.put('./index.html', c1),
                cache.put('./', c2)
              ])).catch(() => {})
            );
          }
          return response;
        })
        .catch(() =>
          caches.match('./index.html', { ignoreSearch: true })
            .then((c) => c || caches.match(event.request, { ignoreSearch: true }))
            .then((c) => c || caches.match('./', { ignoreSearch: true }))
        )
    );
    return;
  }

  // Autres fichiers (icônes, manifest, lecteur PDF) : cache en premier, réseau en secours.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {}));
          }
          return response;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});
