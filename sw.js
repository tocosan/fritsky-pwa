const CACHE_NAME = 'fritsky-fidelidad-cache-v20'; // ¡INCREMENTA LA VERSIÓN!
const urlsToCache = [
  '/', // O '/index.html' si es tu página principal explícita
  '/index.html',
  '/style.css',
  '/app.js', // Ahora es un módulo, pero igual se cachea
  '/manifest.json',
  '/menu.json',

  // Fuentes
  '/font/CodecPro-Regular.ttf',
  '/font/Pusia-Bold.ttf',

  // Iconos PWA (asegúrate que estos existan y que los nombres coincidan)
  '/images/logo.png', // Tu logo del header
  '/images/icon-72x72.png',
  '/images/icon-96x96.png',
  // '/images/icon-128x128.png', // Añade los que realmente tengas
  '/images/icon-144x144.png',
  // '/images/icon-152x152.png',
  '/images/icon-192x192.png',
  '/images/icon-512x512.png',

  // Firebase SDKs (usa la misma versión que en tus imports de app.js)
  'https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js',

  '/images/menu/cono_chico.png',
  '/images/menu/cono_medio.png',
  '/images/menu/cono_grande.png',
  '/images/menu/cup_fritsky.png',
  // ... Todas las Salsas ...
  '/images/menu/salsas/barbacoa_dulce.png',
  '/images/menu/salsas/curry.png',
  '/images/menu/salsas/algerina.png',
  '/images/menu/salsas/barbacoa_hot.png',
  '/images/menu/salsas/crazy_cheddar.png',
  '/images/menu/salsas/curry_ketchup.png',
  '/images/menu/salsas/curry_mango.png',
  '/images/menu/salsas/fritsauce.png',
  '/images/menu/salsas/honey_mustard.png',
  '/images/menu/salsas/hot_shot.png',
  '/images/menu/salsas/joppie.png',
  '/images/menu/salsas/marroquina.png',
  '/images/menu/salsas/mayo_trufada.png',
  '/images/menu/salsas/pita.png',
  '/images/menu/salsas/remolaude.png',
  '/images/menu/salsas/samurai.png',
  '/images/menu/salsas/satay.png',
  '/images/menu/salsas/tartara.png'



];

// Evento 'install': se dispara cuando el Service Worker se instala por primera vez.
self.addEventListener('install', event => {
  console.log(`[Service Worker] Evento install para caché: ${CACHE_NAME}`);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log(`[Service Worker] Cacheando archivos principales en: ${CACHE_NAME}`);
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('[Service Worker] Todos los recursos principales han sido cacheados.');
        return self.skipWaiting(); // Activa el nuevo SW inmediatamente
      })
      .catch(error => {
        console.error('[Service Worker] Fallo al cachear durante la instalación:', error);
      })
  );
});

// Evento 'activate': se dispara después de que el SW se instala y toma control.
self.addEventListener('activate', event => {
  console.log(`[Service Worker] Evento activate. Caché actual: ${CACHE_NAME}`);
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Eliminando caché antigua:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[Service Worker] Cachés antiguas limpiadas.');
      return self.clients.claim(); // Toma control de las páginas abiertas
    })
  );
});

// Evento 'fetch': intercepta las peticiones de red.
self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);

  // Estrategia: Network falling back to cache para el HTML principal (navegación)
  if (event.request.mode === 'navigate' || (requestUrl.origin === location.origin && requestUrl.pathname === '/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Si la respuesta de red es válida, la usamos
          if (response && response.ok) {
            // Opcional: podríamos cachear esta respuesta si queremos, pero para HTML principal
            // a menudo es mejor obtener la más fresca si hay conexión.
            return response;
          }
          // Si la red falla o la respuesta no es ok, intentamos desde caché
          return caches.match(event.request);
        })
        .catch(error => {
          // Si la red falla completamente, intentamos desde caché
          console.warn('[Service Worker] Fallo en fetch de navegación, intentando caché:', event.request.url, error);
          return caches.match(event.request)
            .then(cachedResponse => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // Podrías devolver una página offline.html personalizada si el index.html tampoco está en caché
              // return caches.match('/offline.html');
              console.error('[Service Worker] No se encontró en caché y la red falló:', event.request.url);
            });
        })
    );
    return;
  }

  // Estrategia: Cache falling back to network para otros assets (CSS, JS, Imágenes, Fuentes, JSON)
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          // console.log('[Service Worker] Sirviendo desde caché:', event.request.url);
          return cachedResponse;
        }
        // console.log('[Service Worker] No en caché, yendo a la red:', event.request.url);
        return fetch(event.request).then(networkResponse => {
          // Opcional: si quieres cachear dinámicamente nuevos assets que no estaban en urlsToCache
          // if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET' && !urlsToCache.includes(requestUrl.pathname)) {
          //   const responseToCache = networkResponse.clone();
          //   caches.open(CACHE_NAME) // O un caché dinámico separado
          //     .then(cache => {
          //       console.log('[Service Worker] Cacheando nuevo asset:', event.request.url);
          //       cache.put(event.request, responseToCache);
          //     });
          // }
          return networkResponse;
        });
      })
  );
});