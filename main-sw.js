// main-sw.js (Service Worker Principal para caché y notificaciones)

// --- 1. IMPORTACIÓN DE SCRIPTS DE FIREBASE ---
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-messaging-compat.js');

// --- 2. INICIALIZACIÓN DE FIREBASE EN EL SERVICE WORKER ---
firebase.initializeApp({
    apiKey: "AIzaSyAdtCPqrLrTYzyARYnScM6NLrILQzkPdXc",
    authDomain: "controlcajafritsky.firebaseapp.com",
    projectId: "controlcajafritsky",
    storageBucket: "controlcajafritsky.firebasestorage.app",
    messagingSenderId: "434045144529",
    appId: "1:434045144529:web:f24afcec61b03dcd63e4f0"
});

const messaging = firebase.messaging();

// --- 3. CONFIGURACIÓN DE LA CACHÉ ---
const CACHE_NAME = 'fritsky-main-cache-v6';


// Asegúrate que todas las rutas sean correctas y que incluyas todos los assets necesarios.
const urlsToCache = [
  '/', // La raíz de la aplicación
  '/favicon.ico',
  '/index.html',
  '/style.css',
  '/app.js', // 
  '/manifest.json',
  '/menu.json', 

  // Fuentes
  '/font/CodecPro-Regular.ttf',
  '/font/Pusia-Bold.ttf',

  // Iconos PWA
  '/images/bg.jpg',
  '/images/bg_card.jpg',
  '/images/badge.png',
  '/images/logo.png',
  '/images/icon-72x72.png',
  '/images/icon-96x96.png',
  '/images/icon-144x144.png',
  '/images/icon-192x192.png',
  '/images/icon-512x512.png',


  // Iconos Social
  '/images/icons/social/instagram.png',
  '/images/icons/social/facebook.png',
  '/images/icons/social/tiktok.png',
  '/images/icons/social/web.png',
  '/images/icons/social/google.png',

  
  // Imágenes Conos, Cups , Boxs
  '/images/menu/cono_chico.png',
  '/images/menu/cono_medio.png',
  '/images/menu/cono_grande.png',
  '/images/menu/cup_fritsky.png',
  '/images/menu/cup_salchipapa.png',
  '/images/menu/cup_chistorra.png',
  '/images/menu/cup_chettos.png',
  '/images/menu/cup_kebab.png',
  '/images/menu/cup_serrano.png',
  
  '/images/menu/5-4.png',
  '/images/menu/bites.png',
  '/images/menu/nuggets.png',
  '/images/menu/salseros.png',
  '/images/menu/box.png',
  '/images/menu/box1.png',
  '/images/menu/small.png',
  '/images/menu/small1.png',

  // Imágenes Salsas
  '/images/menu/salsas/algerina.png',
  '/images/menu/salsas/andaluza.png',
  '/images/menu/salsas/barbacoa_dulce.png',
  '/images/menu/salsas/crazy_cheddar.png',
  '/images/menu/salsas/curry_ketchup.png',
  '/images/menu/salsas/curry_mango.png',
  '/images/menu/salsas/curry.png',
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
  '/images/menu/salsas/tartara.png',
];

// Imágenes Alergenos
  '/images/alergenos/altramuces.png',
  '/images/alergenos/apio.png',
  '/images/alergenos/cacahuetes.png',
  '/images/alergenos/crustaceo.png',
  '/images/alergenos/frutosdecascara.png',
  '/images/alergenos/gluten.png',
  '/images/alergenos/granosdesesamo.png',
  '/images/alergenos/huevos.png',
  '/images/alergenos/lacteos.png',
  '/images/alergenos/molusco.png',
  '/images/alergenos/mostaza.png',
  '/images/alergenos/pescado.png',
  '/images/alergenos/soja.png',
  '/images/alergenos/sulfito.png',

// --- MANEJO DE EVENTOS DEL SERVICE WORKER ---

// Evento 'install': Se dispara cuando el SW se instala por primera vez.
self.addEventListener('install', event => {
  console.log(`[MAIN_SW] Evento install iniciado. Caché: ${CACHE_NAME}`);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log(`[MAIN_SW] Abierto caché: ${CACHE_NAME}. Agregando archivos...`);
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('[MAIN_SW] Todos los archivos principales cacheados exitosamente.');
        // `skipWaiting()` permite que el nuevo SW tome el control inmediatamente.
        return self.skipWaiting(); 
      })
      .catch(error => {
        console.error('[MAIN_SW] Fallo al cachear durante la instalación:', error);
      })
  );
});

// Evento 'activate': Se dispara cuando el SW está listo y toma control.
self.addEventListener('activate', event => {
  console.log(`[MAIN_SW] Evento activate iniciado. Caché actual: ${CACHE_NAME}`);
  event.waitUntil(
    caches.keys().then(cacheNames => {
      // Elimina cachés antiguas que no coincidan con el CACHE_NAME actual.
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[MAIN_SW] Eliminando caché antigua:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[MAIN_SW] Cachés antiguas limpiadas.');
      // `clients.claim()` permite que el SW tome control de todas las páginas abiertas.
      return self.clients.claim(); 
    })
  );
});

// Evento 'fetch': Intercepta todas las peticiones de red.
self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);

  // --- ESTRATEGIA AVANZADA: Stale-While-Revalidate para menu.json ---
  // Esta estrategia devuelve el menú desde la caché inmediatamente para que la app sea rápida,
  // y al mismo tiempo, busca una versión actualizada en la red para la próxima visita.
  if (requestUrl.pathname.endsWith('/menu.json')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache => {
        return cache.match(event.request).then(cachedResponse => {
          // Hacemos la petición a la red en segundo plano.
          const fetchPromise = fetch(event.request).then(networkResponse => {
            // Si la petición de red es exitosa, la clonamos y la guardamos en caché.
            if (networkResponse.ok) {
              console.log('[SW_CACHE] Actualizando menu.json en caché con la versión de la red.');
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          });

          // Devolvemos la respuesta cacheada inmediatamente si existe, o esperamos la de la red si no hay nada en caché.
          return cachedResponse || fetchPromise;
        });
      })
    );
    return; // Salimos aquí para no aplicar las otras estrategias a menu.json.
  }

  // --- Estrategia de Cacheo para Navegación (HTML principal) ---
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.ok) {
            return response;
          }
          return caches.match(event.request);
        })
        .catch(error => {
          console.warn('[SW_CACHE] Fallo en fetch de navegación (red no disponible o error). Intentando desde caché:', event.request.url, error);
          return caches.match(event.request);
        })
    );
    return; 
  }

  // --- Estrategia de Cacheo para Otros Assets (imágenes, JS, CSS, etc.) ---
  event.respondWith(
    caches.match(event.request) 
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.ok && event.request.method === 'GET') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                console.log('[SW_CACHE] Cacheando nuevo asset:', event.request.url);
                cache.put(event.request, responseToCache);
              });
          }
          return networkResponse;
        }).catch(error => {
        console.error('[SW_CACHE] Error en red y no estaba en caché:', event.request.url, error);

        // ✅ Solución: Devolver un Response vacío con 404 para evitar error fatal
        return new Response('Recurso no disponible', {
          status: 404,
          statusText: 'No encontrado por el SW'
        });
      });

    })
  );
});
 

// ==============================================================================
// === SECCIÓN CORREGIDA: MANEJO DE NOTIFICACIONES PUSH EN SEGUNDO PLANO ===
// ==============================================================================
messaging.onBackgroundMessage(function(payload) {
  console.log('[SW] Mensaje push recibido en segundo plano (método oficial):', payload);

  // Verificamos que el payload tenga la estructura `notification` esperada
  if (!payload || !payload.notification) {
    console.error('[SW] El payload de la notificación es inválido.');
    return;
  }
  
  // Extraemos el título y las opciones del payload
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/images/icon-512x512.png',
    image: payload.notification.image || '/images/logo.png', // Usamos la imagen del payload si existe
    badge: '/images/badge.png',
    requireInteraction: true,
    vibrate: [200, 100, 200],
    
    // Guardamos los datos para usarlos al hacer clic
    data: {
      url: (payload.data && payload.data.url) ? payload.data.url : 'https://www.fritsky.es'
    },
    
    // Mantenemos tus acciones personalizadas
    actions: [
      {
        action: 'ver-promo',
        title: 'Ver Promoción',
        icon: 'https://cdn-icons-png.flaticon.com/512/709/709612.png'
      },
      {
        action: 'ignorar',
        title: 'Ignorar',
        icon: 'https://cdn-icons-png.flaticon.com/512/1828/1828665.png'
      }
    ]
  };

  // Le decimos al navegador que muestre la notificación
  self.registration.showNotification(notificationTitle, notificationOptions);
});


// --- MANEJO DE CLIC EN LA NOTIFICACIÓN ---
// (Esta sección se mantiene exactamente como la tenías)
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  const targetUrl = event.notification.data?.url || '/';

  // Si el usuario hizo clic en una acción específica
  if (event.action === 'ver-promo') {
    console.log('[SW] Clic en la acción: ver-promo');
    // Podrías dirigirlo a una página específica de promociones
    clients.openWindow('/promociones.html'); // O la URL que corresponda
    return;
  }
  if (event.action === 'ignorar') {
    console.log('[SW] Clic en la acción: ignorar');
    // No hacemos nada, la notificación ya se cerró.
    return;
  }
  
  // Si el usuario hizo clic en el cuerpo de la notificación
  console.log('[SW] Clic en el cuerpo de la notificación. Abriendo:', targetUrl);
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (let client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

console.log(`[SW_READY] Service Worker unificado (Caché y FCM) iniciado. Caché: ${CACHE_NAME}`);