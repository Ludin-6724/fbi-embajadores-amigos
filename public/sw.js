const CACHE_NAME = 'fbi-amigos-v3';
const ASSETS_TO_CACHE = [
  '/manifest.json',
  '/logo-fbi.jpg',
  '/logo-amigos.jpg',
];

// Instalar y Cachear solo assets estáticos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  // Forzar activación inmediata — no esperar a que el usuario cierre tabs
  self.skipWaiting();
});

// Activar y BORRAR todos los caches anteriores
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[SW] Borrando cache viejo:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => {
      // Tomar control de TODAS las páginas abiertas inmediatamente
      return self.clients.claim();
    })
  );
});

// Interceptar peticiones — NETWORK FIRST para páginas, CACHE FIRST solo para assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // EXCLUIR completamente: API, Supabase, y Next.js internals
  if (
    url.origin.includes('supabase.co') || 
    url.pathname.startsWith('/api/') || 
    url.pathname.includes('_next/')
  ) {
    return; // Network directo
  }

  // Solo cachear imágenes y assets estáticos
  if (
    url.pathname.endsWith('.jpg') || 
    url.pathname.endsWith('.png') || 
    url.pathname.endsWith('.svg') || 
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.json') ||
    url.pathname.includes('manifest')
  ) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        return cachedResponse || fetch(event.request);
      })
    );
    return;
  }

  // Para TODO lo demás (páginas HTML, JS, CSS): NETWORK FIRST
  // Esto garantiza que siempre se ve la versión más reciente
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        return networkResponse;
      })
      .catch(() => {
        // Solo si no hay red, intentar cache como fallback
        return caches.match(event.request);
      })
  );
});

// Manejar notificaciones Push
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : { title: 'FBI Amigos', body: 'Nueva notificación' };
  
  const options = {
    body: data.body,
    icon: '/logo-fbi.jpg',
    badge: '/logo-fbi.jpg',
    data: data.url || '/',
    vibrate: [100, 50, 100],
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Al hacer clic en la notificación
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data || '/');
      }
    })
  );
});
