const CACHE_NAME = 'fritsky-fidelidad-cache-v1';
const urlsToCache = [
  '/', // Esto cacheará la ruta raíz, que usualmente es index.html
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  // Lista de iconos que vamos a crear (¡asegúrate de que los nombres coincidan!)
  '/images/icon-72x72.png',
  '/images/icon-96x96.png',
  '/images/icon-128x128.png',
  '/images/icon-144x144.png',
  '/images/icon-152x152.png',
  '/images/icon-192x192.png',
  '/images/icon-384x384.png',
  '/images/icon-512x512.png'
  // Si tienes otras imágenes o fuentes importantes, añádelas aquí
];

// Evento 'install': se dispara cuando el Service Worker se instala por primera vez.
// Aquí es donde pre-cacheamos los recursos principales de la app.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache abierto:', CACHE_NAME);
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('Todos los recursos han sido cacheados.');
        // Forzar la activación del nuevo Service Worker inmediatamente
        // sin esperar a que todas las pestañas se cierren.
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('Fallo al cachear durante la instalación:', error);
      })
  );
});

// Evento 'activate': se dispara después de que el SW se instala y
// cuando una nueva versión del SW reemplaza a una antigua.
// Aquí es un buen lugar para limpiar cachés antiguas.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Eliminando caché antigua:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker activado y caché antigua limpiada.');
      // Tomar control inmediato de las páginas abiertas sin necesidad de recargar.
      return self.clients.claim();
    })
  );
});

// Evento 'fetch': se dispara cada vez que la página (o el SW mismo)
// intenta obtener un recurso (HTML, CSS, JS, imágenes, etc.).
// Aquí implementamos una estrategia "Cache First, then Network".
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Si el recurso está en caché, lo devolvemos desde caché.
        if (response) {
          // console.log('Sirviendo desde caché:', event.request.url);
          return response;
        }
        // Si no está en caché, vamos a la red a buscarlo.
        // console.log('Sirviendo desde red:', event.request.url);
        return fetch(event.request).then(
          networkResponse => {
            // Opcional: Si quieres cachear dinámicamente nuevos recursos
            // que no estaban en urlsToCache, puedes hacerlo aquí.
            // Ten cuidado con qué cacheas para no llenar el espacio del usuario.
            // if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
            //   const responseToCache = networkResponse.clone();
            //   caches.open(CACHE_NAME_DINAMICO_O_EL_MISMO)
            //     .then(cache => {
            //       cache.put(event.request, responseToCache);
            //     });
            // }
            return networkResponse;
          }
        ).catch(error => {
          console.error('Error en fetch (probablemente offline y no en caché):', error, event.request.url);
          // Opcional: Podrías devolver una página de "estás offline" aquí
          // if (event.request.mode === 'navigate') { // Solo para peticiones de navegación de página
          //   return caches.match('/offline.html'); // Necesitarías crear offline.html y cachearlo
          // }
        });
      })
  );
});