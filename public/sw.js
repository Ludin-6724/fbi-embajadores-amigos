const CACHE_NAME = 'fbi-amigos-v4';
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

  // 1. EXCLUIR completamente: API, Supabase, y Next.js internals
  if (
    url.origin.includes('supabase.co') || 
    url.pathname.startsWith('/api/') || 
    url.pathname.includes('_next/')
  ) {
    return; // Network directo
  }

  // 2. IMPORTANTE: NO interceptar navegación (Initial Load / Refresh)
  // Dejamos que el navegador maneje la carga inicial dinámicamente. Esto evita
  // que la app se 'trabe' en el Service Worker si el servidor tarda en responder.
  if (event.request.mode === 'navigate') {
    return; // Dejar que pase a la red nativa
  }

  // 3. Solo cachear imágenes y assets estáticos (Cache First)
  if (
    url.pathname.endsWith('.jpg') || 
    url.pathname.endsWith('.png') || 
    url.pathname.endsWith('.svg') || 
    url.pathname.endsWith('.ico') ||
    url.pathname.includes('manifest')
  ) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        return cachedResponse || fetch(event.request);
      })
    );
    return;
  }

  // 4. Para scripts, estilos y otros assets: NETWORK FIRST con TIMEOUT
  // Solo interceptamos si NO es una navegación (ya filtrada arriba)
  event.respondWith(
    new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error("Network timeout"));
      }, 8000); // 8 segundos para assets secundarios
      
      fetch(event.request)
        .then((networkResponse) => {
          clearTimeout(timeoutId);
          resolve(networkResponse);
        })
        .catch((err) => {
          clearTimeout(timeoutId);
          reject(err);
        });
    }).catch(() => {
      // Fallback al cache SOLO SI EXISTE, si no, devolver undefined
      // para que el navegador falle con un error estándar en lugar de colgarse.
      return caches.match(event.request).then(cached => cached || undefined);
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
    data: { link: data.link || data.url || '/' },
    vibrate: [200, 100, 200],
    requireInteraction: false,
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Al hacer clic en la notificación del sistema
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = event.notification.data?.link || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Si hay una ventana abierta, enfocarla y mandar mensaje para navegar
      if (clientList.length > 0) {
        const client = clientList[0];
        return client.focus().then(() => {
          client.postMessage({ type: 'NAVIGATE_TO', link });
        });
      }
      // Si no hay ventana, abrir una nueva con el destino correcto
      const targetUrl = link.startsWith('#') ? '/' + link : link;
      return clients.openWindow(targetUrl);
    })
  );
});
