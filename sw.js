const CACHE_NAME = 'fritsky-fidelidad-cache-v2'; // ¡INCREMENTA LA VERSIÓN!
// Definimos la ruta base de tu repositorio en GitHub Pages
const BASE_PATH = '/fritsky-pwa/'; 

const urlsToCache = [
  BASE_PATH, // Corresponde a /fritsky-pwa/
  BASE_PATH + 'index.html',
  BASE_PATH + 'style.css',
  // app.js se carga dinámicamente, así que no es estrictamente necesario cachearlo aquí para el SW inicial, 
  // pero si quieres que funcione offline SIN el Service Worker inicial, deberías añadirlo.
  // BASE_PATH + 'app.js', 
  BASE_PATH + 'manifest.json',
  BASE_PATH + 'menu.json',

  // Fuentes
  BASE_PATH + 'font/CodecPro-Regular.ttf',
  BASE_PATH + 'font/Pusia-Bold.ttf',

  // Iconos PWA
  BASE_PATH + 'images/logo.png', // Tu logo del header
  BASE_PATH + 'images/icon-72x72.png',
  BASE_PATH + 'images/icon-96x96.png',
  BASE_PATH + 'images/icon-144x144.png',
  BASE_PATH + 'images/icon-192x192.png',
  BASE_PATH + 'images/icon-512x512.png',

  // Firebase SDKs (estas URLs *no* deben tener el prefijo /fritsky-pwa/ porque son externas)
  'https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js',

  // Archivos del menú y sus imágenes
  BASE_PATH + 'images/menu/cono_chico.png',
  BASE_PATH + 'images/menu/cono_medio.png',
  BASE_PATH + 'images/menu/cono_grande.png',
  BASE_PATH + 'images/menu/cup_fritsky.png',
  // ... Todas las Salsas ...
  BASE_PATH + 'images/menu/salsas/barbacoa_dulce.png',
  BASE_PATH + 'images/menu/salsas/curry.png',
  BASE_PATH + 'images/menu/salsas/algerina.png',
  BASE_PATH + 'images/menu/salsas/barbacoa_hot.png',
  BASE_PATH + 'images/menu/salsas/crazy_cheddar.png',
  BASE_PATH + 'images/menu/salsas/curry_ketchup.png',
  BASE_PATH + 'images/menu/salsas/curry_mango.png',
  BASE_PATH + 'images/menu/salsas/fritsauce.png',
  BASE_PATH + 'images/menu/salsas/honey_mustard.png',
  BASE_PATH + 'images/menu/salsas/hot_shot.png',
  BASE_PATH + 'images/menu/salsas/joppie.png',
  BASE_PATH + 'images/menu/salsas/marroquina.png',
  BASE_PATH + 'images/menu/salsas/mayo_trufada.png',
  BASE_PATH + 'images/menu/salsas/pita.png',
  BASE_PATH + 'images/menu/salsas/remolaude.png',
  BASE_PATH + 'images/menu/salsas/samurai.png',
  BASE_PATH + 'images/menu/salsas/satay.png',
  BASE_PATH + 'images/menu/salsas/tartara.png'
];

// Evento 'install': se dispara cuando el Service Worker se instala por primera vez.
self.addEventListener('install', event => {
  console.log(`[Service Worker] Evento install para caché: ${CACHE_NAME}`);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log(`[Service Worker] Cacheando archivos principales en: ${CACHE_NAME}`);
        // Usamos `addAll` para cachear la lista de archivos.
        // Si alguno falla, el `addAll` completo fallará.
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('[Service Worker] Todos los recursos principales han sido cacheados.');
        // Permite que el nuevo SW tome el control inmediatamente
        return self.skipWaiting(); 
      })
      .catch(error => {
        console.error('[Service Worker] Fallo al cachear durante la instalación:', error);
        // Puedes decidir qué hacer si el cacheo falla, quizás no registrar el SW.
        // Por ahora, solo se loguea el error.
      })
  );
});

// Evento 'activate': se dispara después de que el SW se instala y toma control.
self.addEventListener('activate', event => {
  console.log(`[Service Worker] Evento activate. Caché actual: ${CACHE_NAME}`);
  event.waitUntil(
    caches.keys().then(cacheNames => {
      // Elimina cachés antiguas que no coincidan con la CACHE_NAME actual
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
      // Permite que el SW tome control de las páginas abiertas inmediatamente
      return self.clients.claim(); 
    })
  );
});

// Evento 'fetch': intercepta las peticiones de red.
self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);

  // Estrategia: Network falling back to cache para el HTML principal (navegación)
  // Esto es importante para que cuando el usuario navega a una nueva página, 
  // intente obtenerla de la red primero.
  if (event.request.mode === 'navigate' || (requestUrl.origin === location.origin && requestUrl.pathname === '/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Si la respuesta de red es válida y exitosa (código 200), la usamos
          if (response && response.ok) {
            // Opcional: podrías cachear esta respuesta también si quieres que esté disponible offline
            // pero para el HTML principal, a menudo es mejor obtener la más fresca si hay conexión.
            return response;
          }
          // Si la red falla o la respuesta no es ok, intentamos obtenerla desde la caché
          return caches.match(event.request);
        })
        .catch(error => {
          // Si la red falla completamente (no hay conexión), intentamos desde caché
          console.warn('[Service Worker] Fallo en fetch de navegación, intentando caché:', event.request.url, error);
          return caches.match(event.request)
            .then(cachedResponse => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // Si tampoco está en caché, podrías devolver una página offline personalizada.
              // Por ahora, devolvemos null o manejamos el error.
              console.error('[Service Worker] No se encontró en caché y la red falló:', event.request.url);
              // return caches.match('/offline.html'); // Ejemplo si tuvieras una página offline
            });
        })
    );
    return; // Importante salir aquí para no ejecutar la siguiente lógica
  }

  // Estrategia: Cache falling back to network para otros assets (CSS, JS, Imágenes, Fuentes, JSON)
  // Primero intenta obtener el recurso de la caché. Si no está, va a la red.
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          // Si se encuentra en caché, la servimos
          // console.log('[Service Worker] Sirviendo desde caché:', event.request.url);
          return cachedResponse;
        }
        // Si no está en caché, vamos a la red
        // console.log('[Service Worker] No en caché, yendo a la red:', event.request.url);
        return fetch(event.request).then(networkResponse => {
          // Opcional: si quieres cachear dinámicamente nuevos assets que no estaban en urlsToCache
          // Es buena idea hacerlo si tus archivos JSON (como menu.json) se actualizan a menudo
          // o si hay imágenes que se cargan de forma dinámica.
          // Pero debes tener cuidado con el tamaño del caché.
          
          // Si la respuesta es válida, la cacheamos (esta parte es opcional para assets que no cambian)
          if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
             // Clonamos la respuesta porque la respuesta original se consume al leerla
            const responseToCache = networkResponse.clone(); 
            caches.open(CACHE_NAME) 
              .then(cache => {
                console.log('[Service Worker] Cacheando nuevo asset:', event.request.url);
                // `put` añade la petición y su respuesta a la caché
                cache.put(event.request, responseToCache);
              });
          }
          return networkResponse; // Devolvemos la respuesta de la red
        }).catch(error => {
          // Si la red falla y no estaba en caché
          console.error('[Service Worker] Error en red y no estaba en caché:', event.request.url, error);
          // return caches.match('/offline.html'); // Ejemplo de página offline
        });
      })
  );
});