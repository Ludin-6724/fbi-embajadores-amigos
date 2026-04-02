const CACHE_NAME = 'fbi-amigos-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/manifest.json',
  '/logo-fbi.jpg',
  '/logo-amigos.jpg',
];

// Instalar y Cachear
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activar
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

// Interceptar peticiones
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // EXCLUIR API Y SUPABASE DEL CACHE (Network Only)
  if (
    url.origin.includes('supabase.co') || 
    url.pathname.startsWith('/api/') || 
    url.pathname.includes('_next/data')
  ) {
    return; // Dejar que siga al network normal
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request);
    })
  );
});
