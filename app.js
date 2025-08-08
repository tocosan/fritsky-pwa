import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-messaging.js";
import {
    getAuth,
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";

import {
    getFirestore,
    collection,
    query,
    orderBy,
    limit,
    getDocs,
    doc,
    setDoc,
    getDoc,
    updateDoc,
    increment,
    onSnapshot   // <-- Importa onSnapshot aquí
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";


// --- Configuración de Firebase ---
const firebaseConfig = {
    apiKey: "AIzaSyAdtCPqrLrTYzyARYnScM6NLrILQzkPdXc", // Reemplaza con tu apiKey
    authDomain: "controlcajafritsky.firebaseapp.com",
    projectId: "controlcajafritsky",
    storageBucket: "controlcajafritsky.appspot.com",
    messagingSenderId: "434045144529",
    appId: "1:434045144529:web:f24afcec61b03dcd63e4f0"
};

// Inicializar Firebase y obtener servicios
const appFirebase = initializeApp(firebaseConfig);
const auth = getAuth(appFirebase);
const db = getFirestore(appFirebase);
console.log("Firebase (v10 modular) inicializado!");

// --- Variables Globales ---
let currentUser = null; // Almacena el usuario actualmente logueado
let menuCompletoGlobal = []; // Almacena los datos del menú cargados
const PUNTOS_PARA_PREMIO = 10; // Puntos necesarios para canjear un premio
let puntosActuales = 0; // Puntos en memoria, sincronizados con Firestore

// --- Variables Globales para Firebase Messaging (FCM) ---
let messaging = null; // Instancia del servicio de mensajería de FCM
let currentToken = null; // Token del dispositivo para notificaciones push

// --- REFERENCIAS GLOBALES AL DOM ---

let contadorPuntosElement = null; 
let btnMisPuntosNavRef = null; // Referencia al botón "Mis Puntos" en la navegación
let btnGoToAuthRef = null; // Botón de navegación para ir a la sección de Auth

// Referencias a elementos de autenticación (Login, Registro, Recuperación)
let loginFormRef = null;
let loginEmailInputRef = null;
let loginPasswordInputRef = null;
let loginErrorRef = null;
let registerFormRef = null;
let registerFormContainerRef = null; // Contenedor para alternar entre Login/Registro
let registerEmailInputRef = null;
let registerPasswordInputRef = null;
let registerBirthdayInputRef = null;
let registerErrorRef = null;
let registerSuccessMessageRef = null;
let forgotPasswordLinkRef = null; // Enlace para olvidar contraseña
let passwordResetModalRef = null; // El modal para restablecer contraseña
let resetEmailInputRef = null; // Input de email en el modal
let passwordResetFormRef = null; // Formulario del modal
let passwordResetErrorRef = null; // Mensaje de error del modal
let passwordResetSuccessRef = null; // Mensaje de éxito del modal
let modalCloseButtonRef = null; // Botón para cerrar el modal
let goToRegisterLinkRef = null;   // Botón para ir del Login al Registro
let goToLoginLinkRef = null;      // Botón para ir del Registro al Login

// --- MANEJO DEL ESTADO DE AUTENTICACIÓN ---
// Este listener se activa cada vez que cambia el estado de autenticación del usuario.
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;

        const puntos = await cargarPuntosFirebase(); 
        actualizarUIAcceso(true, user.email); 
        mostrarRankingClientes();

        if (document.getElementById('pagina-auth')?.classList.contains('active')) {
            mostrarPagina('pagina-puntos');
        }

        if (document.getElementById('pagina-mi-qr')?.classList.contains('active')) {
            generarMiQRCode();
        }

        inicializarFCM();
        escucharMensajes();

    } else {
        currentUser = null;

        // 🔹 Detener listener de mensajes si estaba activo
        if (unsubscribeMensajes) {
            unsubscribeMensajes();
            unsubscribeMensajes = null;
        }

        // 🔹 Limpiar mensajes de la interfaz
        const mensajesContainer = document.getElementById("mensajes-container");
        if (mensajesContainer) {
            mensajesContainer.innerHTML = "";
        }

        actualizarUIAcceso(false, null);

        const contadorPuntosElement = document.getElementById('contador-puntos');
        if (contadorPuntosElement) contadorPuntosElement.textContent = '0';
        puntosActuales = 0;

        const qrContainer = document.getElementById('qrcode-container');
        if (qrContainer) qrContainer.innerHTML = '';
        const qrMessage = document.getElementById('qrMessage');
        if (qrMessage) qrMessage.textContent = '';

        const activePage = document.querySelector('.pagina.active');
        if (activePage && activePage.id !== 'pagina-auth' && activePage.id !== 'pagina-promociones') {
            mostrarPagina('pagina-promociones');
        }
    }
});



let unsubscribeMensajes = null; // variable global para guardar la desuscripción

function escucharMensajes() {
    const mensajesRef = collection(db, 'mensajes');
    const mensajesQuery = query(mensajesRef, orderBy("timestamp", "desc"), limit(1));

    // Guardamos la función de desuscripción
    unsubscribeMensajes = onSnapshot(mensajesQuery, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                const mensaje = change.doc.data().texto;
                mostrarMensajeEnApp(mensaje);
            }
        });
    });
}

function mostrarMensajeEnApp(mensaje) {
    const container = document.getElementById("mensajes-container");
    if (container) {
        container.innerHTML = `<p>${mensaje}</p>`;
    }
}



async function mostrarRankingClientes() {
    const user = auth.currentUser;
    if (!user) {
        
        return; 
    }

    try {
        const usuariosRef = collection(db, "usuarios");
        const q = query(usuariosRef, orderBy("puntosTotalesAcumulados", "desc"), limit(10));
        const querySnapshot = await getDocs(q);

        const rankingContainer = document.querySelector('.ranking-container ul');
        if (!rankingContainer) {
            return;
        }
        rankingContainer.innerHTML = ''; 

        let posicion = 1;
        querySnapshot.forEach(doc => {
            const data = doc.data();
            const nombre = data.nombre || "Sin nombre";
            const puntos = data.puntosTotalesAcumulados || 0;

            let medalla = '';
            if (posicion === 1) medalla = '👑';
            else if (posicion === 2) medalla = '🥈';
            else if (posicion === 3) medalla = '🥉';
            else medalla = `#${posicion}`;

            const li = document.createElement('li');
            li.innerHTML = `${medalla} <strong>${nombre}</strong> - <span class="puntos">${puntos} pts</span>`;
            rankingContainer.appendChild(li);

            posicion++;
        });

    } catch (error) {
        console.error("Error al cargar ranking de clientes:", error);
    }
}

// --- Animación al recibir puntos ---
function animarSumaPuntos(cantidad) {
    const puntosRef = document.getElementById('contador-puntos');
    if (!puntosRef) return;

    // 1. Animación del número
    puntosRef.classList.add('puntos-animados');
    setTimeout(() => puntosRef.classList.remove('puntos-animados'), 600);

    // 2. Burbuja flotante
    const flotante = document.createElement('div');
    flotante.className = 'flotante-punto';
    flotante.innerText = `+${cantidad}`;

    const rect = puntosRef.getBoundingClientRect();
    flotante.style.left = `${rect.left + rect.width / 2}px`;
    flotante.style.top = `${rect.top - 10}px`;

    document.body.appendChild(flotante);
    setTimeout(() => flotante.remove(), 1000);

    // 3. Mensaje motivador
    const mensaje = document.createElement('div');
    mensaje.className = 'mensaje-puntos';
    mensaje.innerText = `🎉 ¡Sumaste ${cantidad} punto${cantidad > 1 ? 's' : ''}!`;

    document.body.appendChild(mensaje);
    setTimeout(() => mensaje.remove(), 2000);
}


async function mostrarYPotencialmenteAnimarPuntos() {
    const puntosPrevios = parseInt(localStorage.getItem("puntosPrevios")) || 0;
    const puntosActuales = await cargarPuntosFirebase();  // Tu función ya existente

    if (puntosActuales > puntosPrevios) {
        const diferencia = puntosActuales - puntosPrevios;
        animarSumaPuntos(diferencia);
    }

    localStorage.setItem("puntosPrevios", puntosActuales);
}

async function sumarPuntosAlUsuario(puntosGanados) {
    if (!currentUser) {
        console.error("No hay usuario autenticado");
        return 0;
    }

    try {
        const userDocRef = doc(db, "usuarios", currentUser.uid);

        // Actualiza los puntos en Firestore sumando el valor recibido
        await updateDoc(userDocRef, {
            puntosFidelidad: increment(puntosGanados)
        });

        // Obtener puntos actualizados para mostrar
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
            const puntosActualizados = docSnap.data().puntosFidelidad || 0;
            console.log(`Puntos sumados: ${puntosGanados}. Total: ${puntosActualizados}`);
            return puntosActualizados;
        } else {
            return 0;
        }

    } catch (error) {
        console.error("Error al sumar puntos:", error);
        return 0;
    }
}

async function sumarPuntosConActualizacion(cantidad) {
    try {
        const puntosActualizados = await sumarPuntosAlUsuario(cantidad);
        const contador = document.getElementById('contador-puntos');
        if (contador) {
            contador.textContent = puntosActualizados;
        }
        // Opcional: animar suma
        animarSumaPuntos(cantidad);

        // Guardar puntos previos en localStorage para futuras comparaciones
        localStorage.setItem("puntosPrevios", puntosActualizados);

    } catch (error) {
        console.error("Error actualizando puntos tras sumar:", error);
    }
}

function mostrarMensajeEspecial(mensaje) {
  const container = document.getElementById('ruleta-container');
  const mensajeDiv = document.createElement('div');
  mensajeDiv.className = 'mensaje-especial';
  mensajeDiv.innerText = mensaje;
  container.appendChild(mensajeDiv);
}

function crearRuleta() {
  const contenedor = document.getElementById('ruleta-container');
  if (!contenedor) {
    
    return;
  }

  contenedor.innerHTML = `
    <canvas id="canvas-ruleta" class="ruleta-canvas" width="250" height="250"></canvas>
    <p id="mensaje-ruleta" class="resultado-ruleta"></p>
  `;
}


// FUNCIONES CONTROL JUEGO RULETA
async function puedeJugarRuleta(uid) {
  const userDocRef = doc(db, "usuarios", uid);
  const docSnap = await getDoc(userDocRef);

  if (!docSnap.exists()) return true; // Si no existe, permitir jugar

  const data = docSnap.data();
  const ultimaFechaRuleta = data.ultimaFechaRuleta;

  if (!ultimaFechaRuleta) return true; // Nunca jugó, permitir

  const hoy = new Date();
  const fechaUltimoJuego = ultimaFechaRuleta.toDate ? ultimaFechaRuleta.toDate() : new Date(ultimaFechaRuleta);

  // Comparar solo día, mes y año
  return !(fechaUltimoJuego.getDate() === hoy.getDate() &&
           fechaUltimoJuego.getMonth() === hoy.getMonth() &&
           fechaUltimoJuego.getFullYear() === hoy.getFullYear());
}

// Función para guardar la fecha de hoy como último juego
async function registrarJuegoRuleta(uid) {
  const userDocRef = doc(db, "usuarios", uid);
  await updateDoc(userDocRef, { ultimaFechaRuleta: new Date() });
}

async function abrirRuletaControlado() {
  if (!currentUser) {
    alert("Debes iniciar sesión para jugar.");
    return;
  }

  try {
    const puedeJugar = await puedeJugarRuleta(currentUser.uid);

    if (!puedeJugar) {
        const mensaje = document.getElementById('mensaje-ruleta-no-disponible');
        mensaje.textContent = "¡Ya jugaste hoy! Vuelve mañana para girar de nuevo 🎁";
        mensaje.style.display = 'block';

        setTimeout(() => {
            mensaje.style.display = 'none';
        }, 4000);

        return;
    }

    abrirRuletaVisual();

    await registrarJuegoRuleta(currentUser.uid);
  } catch (error) {
    console.error("Error controlando acceso a la ruleta:", error);
    alert("Error al intentar jugar. Inténtalo de nuevo.");
  }
}

// FUNCIONES RULETA
// 🎯 Premios posibles
const premiosRuleta = [
  { texto: "5 puntos", valor: 5 },
  { texto: "Nada", valor: 0 },
  { texto: "10 puntos", valor: 10 },
  { texto: "Salsa gratis", valor: "salsa" },
  { texto: "Nada", valor: 0 },
  { texto: "15 puntos", valor: 15 },
  { texto: "Nada", valor: 0 },
  { texto: "Patatas gratis", valor: "patatas" }
];

// 🎰 Función para mostrar la ruleta visual
function abrirRuletaVisual() {
  const container = document.getElementById('ruleta-container');
  
  if (!container) return;

  // Ocultar el botón y mostrar la ruleta
  
  container.style.display = 'inline-block';
  container.innerHTML = ''; // Limpiar contenido previo
  
  // Crear y añadir la flecha y el canvas
  const flecha = document.createElement('div');
  flecha.id = 'flecha-ruleta';
  container.appendChild(flecha);
  
  // Crear canvas
  const canvas = document.createElement('canvas');
  canvas.className = 'ruleta-canvas';
  canvas.width = 300;
  canvas.height = 300;
  container.appendChild(canvas);

  // Crear texto resultado
  const resultadoTexto = document.createElement('div');
  resultadoTexto.className = 'resultado-ruleta';
  container.appendChild(resultadoTexto);

  
  const ctx = canvas.getContext('2d');
    const numPremios = premiosRuleta.length;
    const anguloPorSector = (2 * Math.PI) / numPremios;
    const radio = canvas.width / 2;

    function dibujarRuleta(rotacion = 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(radio, radio);
        ctx.rotate(rotacion);

        for (let i = 0; i < numPremios; i++) {
            const inicio = i * anguloPorSector;
            const fin = inicio + anguloPorSector;

            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, radio - 20, inicio, fin);
            ctx.closePath();
            
            ctx.fillStyle = i % 2 === 0 ? '#FFD633' : '#FFCC00';
            ctx.fill();
            ctx.stroke();

            // Dibujar texto
            ctx.save();
            ctx.rotate(inicio + anguloPorSector / 2);
            ctx.textAlign = 'right';
            ctx.fillStyle = '#000';
            ctx.font = 'bold 14px sans-serif';
            ctx.fillText(premiosRuleta[i].texto, radio - 30, 5);
            ctx.restore();
        }
        ctx.restore();
    }

    dibujarRuleta();

    const indiceGanador = Math.floor(Math.random() * numPremios);
    const anguloCentroGanador = (indiceGanador + 0.5) * anguloPorSector;
    const anguloPuntero = 1.5 * Math.PI; 
    const vueltas = 5 * (2 * Math.PI); 

    // La fórmula correcta: vueltas + (posición final deseada) - (posición inicial)
    const anguloFinal = vueltas + anguloPuntero - anguloCentroGanador;

    const duracion = 5000; // 5 segundos de animación
    const start = performance.now();


  function girar(timestamp) {
        const progreso = Math.min((timestamp - start) / duracion, 1);
        // Función de "easing" para una desaceleración suave
        const easeOutProgreso = 1 - Math.pow(1 - progreso, 4);
        const rotacionActual = anguloFinal * easeOutProgreso;

        dibujarRuleta(rotacionActual);

    if (progreso < 1) {
      requestAnimationFrame(girar);
    } else {
      // Aseguramos la posición final exacta
            dibujarRuleta(anguloFinal);
            
            const premio = premiosRuleta[indiceGanador];
            resultadoTexto.innerHTML = `¡Ganaste: <strong>${premio.texto}</strong>!`;

      // Sumar puntos si aplica
      if (typeof premio.valor === 'number' && premio.valor > 0) {
        sumarPuntosConActualizacion(premio.valor);
      }

      // Premios especiales
      if (premio.valor === 'salsa') {
        mostrarMensajeEspecial("¡Ganaste una salsa gratis!");
      }

      if (premio.valor === 'patatas') {
        mostrarMensajeEspecial("¡Ganaste patatas gratis!");
      }

      // Ocultar la ruleta después de unos segundos
        // Animación y ocultamiento suave de la ruleta
        setTimeout(() => {
        container.classList.add('ruleta-desaparecer');

        // Esperamos que termine la animación antes de ocultar
        setTimeout(() => {
            container.style.display = 'none';
            container.classList.remove('ruleta-desaparecer'); // Por si vuelve a mostrarse luego
        }, 500); // Duración de la animación en ms
        }, 2500); // Tiempo para mostrar el resultado antes de animar

    }
  }

  requestAnimationFrame(girar);
}

// --- FUNCIONES DE FIREBASE MESSAGING (FCM) ---
async function saveDeviceTokenToFirestore(token) {
    if (!currentUser || !token) {
        console.error("[FCM_DEBUG] Usuario o token inválido. No se puede guardar.");
        return;
    }
    const userDocRef = doc(db, "usuarios", currentUser.uid);
    console.log(`[FCM_DEBUG] Guardando token FCM para usuario ${currentUser.uid}: ${token}`);
    try {
        await updateDoc(userDocRef, { fcmToken: token });
        
    } catch (error) {
        console.error("[FCM_DEBUG] Error al guardar el token FCM en Firestore:", error);
    }
}

// Función auxiliar para esperar a que el Service Worker tenga un controlador activo.
function waitForSWController() {
    return new Promise((resolve) => {
        if (navigator.serviceWorker.controller) {
            return resolve(); // Si ya hay un controlador, resuelve inmediatamente.
        }
        // Si no, espera al evento 'controllerchange' que se dispara cuando un SW toma el control.
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            resolve();
        });
    });
}

// Obtiene el token de dispositivo de FCM.
async function getDeviceToken() {
    if (!messaging) {
        console.error("[FCM_DEBUG] El servicio de mensajería no está inicializado. No se puede obtener el token.");
        return;
    }
    if (!currentUser) {
        console.warn("[FCM_DEBUG] Usuario no conectado. No se puede obtener el token.");
        return;
    }

    console.log("[FCM_DEBUG] Intentando obtener el token de dispositivo...");

    try {
        const swReady = await isServiceWorkerReadyForPush();
        if (!swReady) {
            console.error("[FCM_DEBUG] El Service Worker no está listo para push. No se puede obtener token.");
            return;
        }
        await waitForSWController();
        console.log("[FCM_DEBUG] Service Worker tiene un controlador activo. Procediendo a obtener token.");

        const registration = await navigator.serviceWorker.ready;

        const token = await getToken(messaging, { 
            vapidKey: 'BM3DpiRcq0nwXnO5gFPuZbBZ1_rMNIJX8ZuyR5wW1i0v2M0UVICK4BCLEk4aZ6O5qh9nh8TllLzjoYQikBZEGCk',
            serviceWorkerRegistration: registration
        });

        if (token) {
            console.log('[FCM_DEBUG] Token de dispositivo FCM obtenido:', token);
            await saveDeviceTokenToFirestore(token);
            currentToken = token;
        } else {
            console.warn('[FCM_DEBUG] No se pudo obtener el token. Asegúrate de que los permisos de notificación están concedidos.');
        }
    } catch (error) {
        if (error.code === 'messaging/notifications-blocked') {
            console.warn('[FCM_DEBUG] Las notificaciones están bloqueadas por el usuario.');
        } else if (error.code === 'messaging/sw-registration-expected') {
            console.error('[FCM_DEBUG] No se encontró un registro de Service Worker válido.');
        } else {
            console.error('[FCM_DEBUG] Error inesperado al obtener el token:', error);
        }
    }
}

async function isServiceWorkerReadyForPush() {
    if (!navigator.serviceWorker) {
        console.error("[FCM_DEBUG] Service Workers no están soportados por este navegador.");
        return false;
    }

    // Obtiene el SW que controla la página actual (sin usar window.BASE_PATH)
    const registration = await navigator.serviceWorker.getRegistration();

    if (!registration || !registration.active) {
        console.warn("[FCM_DEBUG] Service Worker no encontrado o no está activo en el scope actual.");
        return false;
    }

    // Verificamos si el SW tiene un controlador (indica que está gestionando la página)
    if (!navigator.serviceWorker.controller) {
        console.warn("[FCM_DEBUG] Service Worker no tiene controlador activo aún.");
        return false;
    }

    console.log("[FCM_DEBUG] Service Worker listo para Push con scope:", registration.scope);
    return true;
}

// Solicita permiso al usuario para enviar notificaciones push.

async function requestNotificationPermission() {
    console.log("[FCM_DEBUG] Solicitando permiso de notificación...");
    try {
        const permissionState = await Notification.requestPermission();
        console.log("[FCM_DEBUG] Permiso de notificación concedido:", permissionState);
        
        if (permissionState === 'granted') { 
            console.log('[FCM_DEBUG] Permiso de notificación concedido.');
            // Ahora, explícitamente esperamos a que el SW esté listo para las operaciones push.
            const swReady = await isServiceWorkerReadyForPush(); // Usamos la nueva función para verificar
            return swReady; // Retornamos si el SW estaba listo o no.
        } else {
            console.warn('[FCM_DEBUG] Permiso de notificación denegado o no concedido.');
            return false;
        }
    } catch (error) {
        console.error("[FCM_DEBUG] Error al solicitar permiso de notificación:", error);
        return false;
    }
}

// Función para inicializar Firebase Messaging.
function inicializarFCM() {
    if (!currentUser) {
        console.log("[FCM_DEBUG] Usuario no conectado, omitiendo inicialización de FCM.");
        return;
    }

    try {
        if (!messaging) {
            console.log("[FCM_DEBUG] Inicializando servicio de mensajería de Firebase...");
            messaging = getMessaging(appFirebase);
            console.log("[FCM_DEBUG] Servicio de mensajería inicializado.");
        }

        // Siempre pedimos el permiso y el token al iniciar sesión,
        // incluso si ya estaba inicializado para otro usuario
        requestNotificationPermission().then(swReady => {
            if (swReady) {
                console.log("[FCM_DEBUG] SW confirmado como listo para push. Procediendo a obtener token.");
                getDeviceToken(); 
            } else {
                console.error("[FCM_DEBUG] El Service Worker no estaba listo o el permiso fue denegado.");
            }
        });

        setupForegroundMessageListener();

    } catch (error) {
        console.error("[FCM_DEBUG] Error al inicializar FCM:", error);
    }
}


// Configura el listener para recibir mensajes en primer plano.
function setupForegroundMessageListener() {
    if (!messaging) {
        console.error("[FCM_DEBUG] El servicio de mensajería no está inicializado. No se puede configurar el listener.");
        return;
    }
    console.log("[FCM_DEBUG] Configurando listener para mensajes en primer plano...");
    
    onMessage(messaging, (payload) => {
        console.log('[FCM_DEBUG] Mensaje recibido en primer plano:', payload);
        if (payload.notification) {
            const title = payload.notification.title;
            const options = {
                body: payload.notification.body,
                icon: payload.notification.image || '/images/icon-192x192.png'
            };
            mostrarToastNotification(title, options);
        } else {
            console.log('[FCM_DEBUG] Payload recibido sin datos de notificación:', payload);
        }
    });
    console.log("[FCM_DEBUG] Listener de mensajes en primer plano configurado.");
}

// Muestra notificaciones tipo toast en la UI.
function mostrarToastNotification(title, options) {
    console.log(`[TOAST] Título: ${title}, Cuerpo: ${options.body}`);
    const toastContainer = document.getElementById('toastContainer') || createToastContainer();
    const toast = document.createElement('div');
    toast.classList.add('toast');
    toast.innerHTML = `<strong>${title}</strong><p>${options.body}</p>`;
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
        if (toastContainer.children.length === 0) toastContainer.remove();
    }, 5000);
}

// Crea el contenedor principal de toasts.
function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toastContainer';
    container.style.position = 'fixed';
    container.style.bottom = '20px';
    container.style.right = '20px';
    container.style.zIndex = '1000';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '10px';
    document.body.appendChild(container);
    return container;
}
// --- Funciones para la navegación y actualización de la UI ---

// Actualiza la interfaz de usuario para reflejar si el usuario está logueado o no.
function actualizarUIAcceso(isLoggedIn, userEmail = null) {
    console.log("[UI_DEBUG] Actualizando UI de acceso. Estado de login:", isLoggedIn);
    
    if (isLoggedIn) { // Si el usuario está conectado
        if (btnGoToAuthRef) btnGoToAuthRef.style.display = 'none'; // Oculta el botón "Acceder/Registro"
        const btnLogout = document.getElementById('btnLogout');
        if (btnLogout) btnLogout.style.display = 'inline-block'; // Muestra el botón "Cerrar Sesión"
        const userInfoSpan = document.getElementById('userInfo');
        if (userInfoSpan) userInfoSpan.textContent = userEmail || 'Conectado'; // Muestra el email del usuario o un texto genérico
        
        // Si el usuario accede desde la página de autenticación, redirigirlo a la de puntos.
        const authPage = document.getElementById('pagina-auth');
        if (authPage && authPage.classList.contains('active')) {
            mostrarPagina('pagina-puntos'); 
        }
    } else { // Si el usuario no está conectado
        if (btnGoToAuthRef) btnGoToAuthRef.style.display = 'inline-block'; // Muestra el botón "Acceder/Registro"
        const btnLogout = document.getElementById('btnLogout');
        if (btnLogout) btnLogout.style.display = 'none'; // Oculta el botón "Cerrar Sesión"
        const userInfoSpan = document.getElementById('userInfo');
        if (userInfoSpan) userInfoSpan.textContent = ''; // Limpia el texto del usuario
    }

    
    if (btnMisPuntosNavRef) {
        if (isLoggedIn) { // Si está logueado, habilita el botón
            btnMisPuntosNavRef.classList.remove('disabled'); 
            btnMisPuntosNavRef.style.pointerEvents = 'auto';
            btnMisPuntosNavRef.style.opacity = '1';
            btnMisPuntosNavRef.style.cursor = 'pointer';
        } else { // Si no está logueado, deshabilita el botón (aunque se puede mostrar igualmente)
            btnMisPuntosNavRef.classList.add('disabled'); 
            btnMisPuntosNavRef.style.pointerEvents = 'none'; 
            btnMisPuntosNavRef.style.opacity = '0.6';
            btnMisPuntosNavRef.style.cursor = 'not-allowed';
        }
    }
}

// Maneja la navegación entre las diferentes secciones/páginas de la aplicación.
function mostrarPagina(idPaginaTarget) {
    const todasLasPaginas = document.querySelectorAll('.pagina');
    const todosLosNavButtons = document.querySelectorAll('.nav-button');

    // Oculta todas las páginas
    todasLasPaginas.forEach(pagina => pagina.classList.remove('active'));

    // Muestra la página solicitada
    const paginaSeleccionada = document.getElementById(idPaginaTarget);
    if (!paginaSeleccionada) return;
    paginaSeleccionada.classList.add('active');

    // Actualiza botones de navegación
    todosLosNavButtons.forEach(button => button.classList.remove('active'));
    const botonActivo = document.querySelector(`.nav-button[data-target="${idPaginaTarget}"]`);
    if (botonActivo) botonActivo.classList.add('active');

    // Páginas con lógica específica
    switch (idPaginaTarget) {
        case 'pagina-auth':
            if (loginFormRef && registerFormContainerRef) {
                registerFormContainerRef.style.display = 'none';
                loginFormRef.closest('.auth-form-container').style.display = 'block';
            }
            break;

        case 'pagina-mi-qr':
            generarMiQRCode();
            break;

        case 'pagina-menu':
            const menuContainer = document.getElementById('menu-container');
            if (menuCompletoGlobal.length === 0) {
                if (menuContainer) menuContainer.innerHTML = '<p>Cargando datos del menú...</p>';
                inicializarMenu();
            } else {
                renderizarVistaCategoriasPrincipales(menuCompletoGlobal);
            }
            break;

        case 'pagina-puntos':
            mostrarYPotencialmenteAnimarPuntos();

            setTimeout(() => {
                crearRuleta();

                const botonRuleta = document.getElementById('btn-jugar-ruleta');
                if (botonRuleta) {
                    botonRuleta.addEventListener('click', abrirRuletaControlado);
                }
            }, 100);

            break;

        case 'pagina-promociones':
            mostrarRankingClientes();

    }
}



// --- LÓGICA PARA CARGAR Y MOSTRAR EL MENÚ INTERACTIVO ---
async function inicializarMenu() {
    
    const menuContainerRef = document.getElementById('menu-container');
    if (!menuContainerRef) { 
        console.error("[MENU_DEBUG] ERROR: La referencia al contenedor del menú (#menu-container) no se encontró.");
        return; 
    }
    try {
        
        // Usa `window.BASE_PATH` para asegurar que se carga desde la ruta correcta.
        const response = await fetch(window.BASE_PATH + 'menu.json'); 
        if (!response.ok) { // Si la respuesta de la red no es exitosa
            
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        menuCompletoGlobal = await response.json(); // Guarda los datos del menú en la variable global
        
        
        // Si la página del menú está activa en este momento, renderiza las categorías.
        if (document.getElementById('pagina-menu')?.classList.contains('active')) {
            
            renderizarVistaCategoriasPrincipales(menuCompletoGlobal);
        }
    } catch (error) {
        console.error("[MENU_DEBUG] FALLO CRÍTICO al cargar o parsear menu.json:", error);
        menuContainerRef.innerHTML = '<p>Error crítico al cargar el menú. Por favor, revise la consola para más detalles.</p>';
    }
}

// Renderiza la vista principal de las categorías del menú en el DOM.
function renderizarVistaCategoriasPrincipales(menuData) {
    const menuContainerRef = document.getElementById('menu-container');
    if (!menuContainerRef) return;
    if (!menuData || menuData.length === 0) {
        menuContainerRef.innerHTML = '<p>Menú no disponible o aún cargando...</p>';
        return;
    }

    menuContainerRef.innerHTML = '';

    const categoriasGrid = document.createElement('div');
    categoriasGrid.classList.add('categorias-grid');

    menuData.forEach(categoria => {
        const categoriaCard = document.createElement('div');
        categoriaCard.classList.add('categoria-card', 'card1', 'clickable');

        // Imagen de cabecera
        if (categoria.imagen_cabecera_categoria) {
            const img = document.createElement('img');
            img.src = categoria.imagen_cabecera_categoria;
            img.alt = categoria.nombre_categoria;
            img.classList.add('categoria-card-imagen');
            categoriaCard.appendChild(img);
        }

        // Contenedor del contenido textual
        const contenido = document.createElement('div');
        contenido.classList.add('categoria-card-contenido');

        const titulo = document.createElement('h3');
        titulo.textContent = categoria.nombre_categoria;
        titulo.classList.add('categoria-card-titulo');
        contenido.appendChild(titulo);

        let descripcion = categoria.descripcion_categoria_corta || categoria.descripcion_categoria || "";
        if (descripcion.length > 100) descripcion = descripcion.substring(0, 100) + "...";
        if (descripcion) {
            const p = document.createElement('p');
            p.textContent = descripcion;
            p.classList.add('categoria-card-descripcion');
            contenido.appendChild(p);
        }

        // Botón "ver más"
        const boton = document.createElement('span');
        boton.textContent = 'Ver productos ➔';
        boton.classList.add('categoria-card-vermas');
        contenido.appendChild(boton);

        categoriaCard.appendChild(contenido);

        categoriaCard.addEventListener('click', () => mostrarDetalleCategoria(categoria, menuData));
        categoriasGrid.appendChild(categoriaCard);
    });

    menuContainerRef.appendChild(categoriasGrid);
}


// Muestra el detalle de una categoría seleccionada, incluyendo sus ítems o secciones.
function mostrarDetalleCategoria(categoria, menuDataCompleta) {
    if (categoria.id_categoria === "Box") {
        renderizarVistaBox(categoria, menuDataCompleta);
        return;
    }

    if (categoria.id_categoria === "Small-Box") {
        renderizarVistaBox(categoria, menuDataCompleta);
        return;
    }
    
    const menuContainerRef = document.getElementById('menu-container');
    
    if (!menuContainerRef) { console.error("ERROR: Referencia al contenedor del menú no encontrada en mostrarDetalleCategoria."); return; }
    menuContainerRef.innerHTML = ''; // Limpia el contenido actual para mostrar el detalle

    // Botón para volver a la vista de categorías principales
    const btnVolver = document.createElement('button');
    btnVolver.textContent = '‹ Volver a Categorías';
    btnVolver.classList.add('button-secondary', 'btn-volver-menu');
    btnVolver.addEventListener('click', () => renderizarVistaCategoriasPrincipales(menuDataCompleta)); // Al hacer clic, vuelve a la vista principal
    menuContainerRef.appendChild(btnVolver);
    
    // Título de la página de detalle de la categoría
    const tituloPaginaCategoria = document.createElement('h2');
    tituloPaginaCategoria.textContent = categoria.nombre_categoria;
    tituloPaginaCategoria.classList.add('titulo-pagina-categoria');
    menuContainerRef.appendChild(tituloPaginaCategoria);
    
    // Descripción completa de la categoría, si existe
    if (categoria.descripcion_categoria) {
        const descCategoriaEl = document.createElement('p');
        descCategoriaEl.classList.add('descripcion-pagina-categoria');
        descCategoriaEl.textContent = categoria.descripcion_categoria;
        menuContainerRef.appendChild(descCategoriaEl);
    }
    
    // Sección de Precios de Salsas Premium o información adicional similar
    if (categoria.informacion_precios_salsas) {
        const preciosDiv = document.createElement('div');
        preciosDiv.classList.add('info-precios-categoria', 'card'); 
        const preciosTitulo = document.createElement('h4');
        preciosTitulo.textContent = categoria.informacion_precios_salsas.titulo || "Precios Adicionales";
        preciosDiv.appendChild(preciosTitulo);

        // Renderiza la lista de ítems con sus precios si existe
        if (Array.isArray(categoria.informacion_precios_salsas.items_precio) && categoria.informacion_precios_salsas.items_precio.length > 0) {
            console.log("[DEBUG_MENU_DETAIL] Renderizando lista de precios.");
            const listaPreciosUl = document.createElement('ul');
            listaPreciosUl.classList.add('lista-precios-salsas');
            categoria.informacion_precios_salsas.items_precio.forEach(itemPrecio => {
                const li = document.createElement('li');
                li.innerHTML = `<span>${itemPrecio.concepto || 'N/A'}:</span> <strong>${itemPrecio.precio || 'N/A'}</strong>`;
                listaPreciosUl.appendChild(li);
            });
            preciosDiv.appendChild(listaPreciosUl);
        } else {
            console.warn("[DEBUG_MENU_DETAIL] No se encontraron 'items_precio' en la sección de información adicional.");
        }
        menuContainerRef.appendChild(preciosDiv);
    }

    // Maneja las secciones informativas del menú (ej. tipos de conos, salsas gratis)
    if (categoria.secciones_informativas) {
        let seccionesHtmlString = ''; // Para acumular el HTML de las secciones
        let seccionTamanoConoHtmlString = ''; // Para la sección de conos, que se renderiza primero

        categoria.secciones_informativas.forEach(seccion => {
            // Estructura base para cada sección informativa
            let seccionHtmlActual = `<div class="menu-seccion-info card" id="${seccion.id_seccion || 'seccion-' + Math.random().toString(36).substr(2, 9)}">
                                        <h4>${seccion.titulo_seccion}</h4>`;
            if (seccion.subtitulo_seccion) seccionHtmlActual += `<p class="subtitulo-seccion">${seccion.subtitulo_seccion}</p>`;
            
            // Renderiza los ítems dentro de una sección (ej. para conos, toppings)
            if (seccion.items && seccion.items.length > 0) {
                seccionHtmlActual += `<div class="info-items-container">`;
                seccion.items.forEach(item => {
                    seccionHtmlActual += `<div class="info-item-card">
                        ${item.imagen ? `<img src="${item.imagen}" alt="${item.nombre}" class="info-item-imagen">` : ''}
                        <p class="info-item-nombre">${item.nombre}</p>
                        ${item.detalle ? `<p class="info-item-detalle">${item.detalle}</p>` : ''}
                        ${item.precio ? `<p class="info-item-precio">${item.precio}</p>` : ''}
                    </div>`;
                });
                seccionHtmlActual += `</div>`;
            }
            
            // Renderiza listas simples (ej. de salsas gratis)
            if (seccion.lista_items && seccion.lista_items.length > 0) {
                seccionHtmlActual += `<ul class="info-lista-simple">`;
                seccion.lista_items.forEach(textoItem => { seccionHtmlActual += `<li>${textoItem}</li>`; });
                seccionHtmlActual += `</ul>`;
            }
            
            // Sección específica para Salsas Gratis y enlace a Salsas Premium
            if (seccion.descripcion_salsas_gratis) seccionHtmlActual += `<p class="descripcion-salsas-gratis">${seccion.descripcion_salsas_gratis}</p>`;
            if (seccion.lista_salsas_gratis && seccion.lista_salsas_gratis.length > 0) {
                seccionHtmlActual += `<ul class="info-lista-salsas-gratis">`;
                seccion.lista_salsas_gratis.forEach(nombreSalsa => { seccionHtmlActual += `<li>${nombreSalsa}</li>`; });
                seccionHtmlActual += `</ul>`;
            }

            // Añade el botón para enlazar a la categoría de Salsas Premium
            if (seccion.enlace_a_salsas_premium) {
                const btnSalsasPremium = document.createElement('button');
                btnSalsasPremium.textContent = seccion.enlace_a_salsas_premium.texto_enlace;
                btnSalsasPremium.classList.add('button-primary', 'btn-link-salsas');
                // Almacena el ID de la categoría de destino en un atributo data-*
                btnSalsasPremium.dataset.targetSalsaCat = seccion.enlace_a_salsas_premium.target_categoria_id;
                seccionHtmlActual += btnSalsasPremium.outerHTML; // Inserta el botón como HTML string
            }
            seccionHtmlActual += `</div>`; // Cierra el div de la sección
            
            // Si la sección es la de tamaño de conos, la guardamos por separado para renderizarla al principio.
            if (seccion.id_seccion === "info_tamano_cono") {
                seccionTamanoConoHtmlString = seccionHtmlActual;
            } else {
                seccionesHtmlString += seccionHtmlActual; // Acumula el resto de secciones
            }
        });

        // Inserta la sección de tamaño de conos primero si existe
        if (seccionTamanoConoHtmlString) menuContainerRef.insertAdjacentHTML('beforeend', seccionTamanoConoHtmlString);
        // Inserta las demás secciones informativas
        if (seccionesHtmlString) {
            const contenedorInferior = document.createElement('div');
            contenedorInferior.classList.add('secciones-inferiores-flex-container'); // Clase para grid
            contenedorInferior.innerHTML = seccionesHtmlString;
            menuContainerRef.appendChild(contenedorInferior);
        }
    } 
    // Maneja ítems que se muestran directamente sin secciones informativas (ej. Cups combinados)
    else if (categoria.items_directos) {
        const itemsGrid = document.createElement('div');
        itemsGrid.classList.add('menu-items-directos-grid'); // Clase CSS específica

        categoria.items_directos.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.classList.add('menu-item', 'card'); // Clases comunes para estilo

            // Imagen del ítem
            if (item.imagen) {
                // Crea el contenedor circular
                const contenedorImagen = document.createElement('div');
                contenedorImagen.classList.add('imagen-circular-envuelta');

                // Crea la imagen en sí
                const img = document.createElement('img');
                img.src = item.imagen;
                img.alt = item.nombre;
                img.classList.add('info-item-imagen');

                // Mete la imagen dentro del contenedor
                contenedorImagen.appendChild(img);

                // Añade el contenedor completo a la tarjeta
                itemDiv.appendChild(contenedorImagen);
            }
            
            // Nombre del ítem
            const nombre = document.createElement('p'); 
            nombre.classList.add('menu-item-nombre'); 
            nombre.textContent = item.nombre; 
            itemDiv.appendChild(nombre);

            // Descripción del ítem
            if (item.descripcion) { 
                const descripcion = document.createElement('p'); 
                descripcion.classList.add('menu-item-descripcion'); 
                descripcion.textContent = item.descripcion; 
                itemDiv.appendChild(descripcion); 
            }
            
            // Precio del ítem (con lógica para conos de patatas)
            if (item.precio && categoria.id_categoria !== 'salsas-premium') {
                const precioEl = document.createElement('p');
                precioEl.classList.add('menu-item-precio');
                precioEl.textContent = item.precio;
                itemDiv.appendChild(precioEl);
            }
            
            // Renderizado de alérgenos (si existen en el JSON)
            if (item.alergenos && Array.isArray(item.alergenos) && item.alergenos.length > 0) {
                const alergenosDiv = document.createElement('div');
                alergenosDiv.classList.add('menu-item-alergenos');

                item.alergenos.forEach(alergeno => {
                    const img = document.createElement('img');
                    img.src = alergeno.icono;
                    img.alt = alergeno.nombre;
                    img.title = alergeno.nombre;
                    img.classList.add('icono-alergeno');
                    alergenosDiv.appendChild(img);
                });

                itemDiv.appendChild(alergenosDiv);
            }


            // Caso especial para conos de patatas con precios diferenciados
            else if (item.precio_chico_cup && item.precio_medio_grande && categoria.id_categoria === 'conos-de-patatas') { 
                const precioEl = document.createElement('p');
                precioEl.classList.add('menu-item-precio'); 
                precioEl.textContent = `Chico/Cup: ${item.precio_chico_cup} | Mediano/Grande: ${item.precio_medio_grande}`;
                itemDiv.appendChild(precioEl);
            }
            itemsGrid.appendChild(itemDiv); // Añade el ítem al grid
        });
        menuContainerRef.appendChild(itemsGrid); // Añade el grid de ítems directos al contenedor

        const alergenosUnicos = obtenerAlergenosUnicos(categoria.items_directos);
        mostrarSeccionAlergenos(menuContainerRef, alergenosUnicos);

        // Pie de categoría (si existe, ej: Salsas Premium)
        if (categoria.pie_categoria) {
            const pieDiv = document.createElement('div');
            pieDiv.classList.add('menu-seccion-info', 'card', 'pie-categoria'); 
            const pieTitulo = document.createElement('h4'); 
            pieTitulo.textContent = categoria.pie_categoria.titulo_seccion; 
            pieDiv.appendChild(pieTitulo);
            const pieDesc = document.createElement('p'); 
            pieDesc.textContent = categoria.pie_categoria.descripcion_salsas; 
            pieDiv.appendChild(pieDesc);
            
            // Botón de enlace a Salsas Premium si existe
            if (categoria.pie_categoria.enlace_a_salsas_premium) {
                const btnSalsasPremiumPie = document.createElement('button');
                btnSalsasPremiumPie.textContent = categoria.pie_categoria.enlace_a_salsas_premium.texto_enlace;
                btnSalsasPremiumPie.classList.add('button-primary', 'btn-link-salsas');
                btnSalsasPremiumPie.dataset.targetSalsaCat = categoria.pie_categoria.enlace_a_salsas_premium.target_categoria_id;
                pieDiv.appendChild(btnSalsasPremiumPie);
            }
            menuContainerRef.appendChild(pieDiv);
        }
    }

    // Añade listeners a los botones de enlace a salsas (que se crearon dinámicamente)
    menuContainerRef.querySelectorAll('.btn-link-salsas').forEach(button => {
        button.addEventListener('click', (e) => {
            const targetCatId = e.target.dataset.targetSalsaCat; // Obtiene el ID de la categoría de destino
            // Busca la categoría correspondiente en el menú completo
            const catSalsas = menuDataCompleta.find(c => c.id_categoria === targetCatId);
            if (catSalsas) {
                mostrarDetalleCategoria(catSalsas, menuDataCompleta); // Muestra la categoría de salsas premium
            }
        });
    });
}

function obtenerAlergenosUnicos(items) {
    const mapAlergenos = new Map();

    items.forEach(item => {
        if (item.alergenos && Array.isArray(item.alergenos)) {
            item.alergenos.forEach(alergeno => {
                if (!mapAlergenos.has(alergeno.nombre)) {
                    mapAlergenos.set(alergeno.nombre, alergeno.icono);
                }
            });
        }
    });

    return Array.from(mapAlergenos, ([nombre, icono]) => ({ nombre, icono }));
}

function mostrarSeccionAlergenos(contenedor, alergenos) {
    if (!alergenos || alergenos.length === 0) return;

    // Crea una tarjeta general para todos los alérgenos
    const tarjeta = document.createElement('div');
    tarjeta.classList.add('tarjeta-alergenos-general');

    // Título
    const titulo = document.createElement('h3');
    titulo.textContent = 'ALERGENOS';
    titulo.classList.add('titulo-alergenos');
    tarjeta.appendChild(titulo);

    // Contenedor en grid de dos columnas
    const grid = document.createElement('div');
    grid.classList.add('grid-alergenos-dos-columnas');

    alergenos.forEach(alergeno => {
        // Contenedor fila de un alergeno con imagen y nombre
        const fila = document.createElement('div');
        fila.classList.add('fila-alergeno');

        const img = document.createElement('img');
        img.src = alergeno.icono;
        img.alt = alergeno.nombre;
        img.classList.add('icono-alergeno');
        fila.appendChild(img);

        const nombre = document.createElement('span');
        nombre.textContent = alergeno.nombre;
        fila.appendChild(nombre);

        grid.appendChild(fila);
    });

    tarjeta.appendChild(grid);
    contenedor.appendChild(tarjeta);
}

function renderizarVistaBox(categoria, menuDataCompleta) {
  const menuContainer = document.getElementById('menu-container');
  menuContainer.innerHTML = ''; // limpia antes de renderizar

  const btnVolver = document.createElement('button');
  btnVolver.textContent = '‹ Volver a Categorías';
  btnVolver.classList.add('button-secondary', 'btn-volver-menu');
  btnVolver.addEventListener('click', () => renderizarVistaCategoriasPrincipales(menuDataCompleta));
  menuContainer.appendChild(btnVolver);

  let imagenTop = '';
  let imagenBottom = '';

  if (categoria.id_categoria === "Box") {
    imagenTop = "images/menu/box.png";
    imagenBottom = "images/menu/box1.png";
  } else if (categoria.id_categoria === "Small-Box") {
    imagenTop = "images/menu/small.png";
    imagenBottom = "images/menu/small1.png";
  } else {
    imagenTop = "images/menu/default-top.png";
    imagenBottom = "images/menu/default-bottom.png";
  }

  const html = `
    <div class="box-section">
      <img src="${imagenTop}" class="box-image top" alt="Decoración superior">
      <h2 class="box-title">${categoria.nombre_categoria}</h2>
      <p class="box-subtitle">Elige tu variedad</p>

      <div class="box-items">
        ${categoria.items_directos.map(item => `
          <div class="box-item">
            <span class="check-icon">✔</span>
            <div class="item-text">
              <span class="item-nombre">${item.nombre}</span>
              ${item.descripcion ? `<small class="item-descripcion">${item.descripcion}</small>` : ""}
            </div>
            <span class="item-precio">${item.precio} </span>
          </div>
        `).join('')}
      </div>

      <img src="${imagenBottom}" class="box-image bottom" alt="Decoración inferior">
    </div>
  `;

  menuContainer.insertAdjacentHTML('beforeend', html);
}


// --- EVENT LISTENERS Y CÓDIGO QUE SE EJECUTA CUANDO EL DOM ESTÁ COMPLETAMENTE CARGADO ---
document.addEventListener('DOMContentLoaded', () => {
    contadorPuntosElement = document.getElementById('contador-puntos');
    // Los botones btnSimularPunto y btnCanjearSalsa ya no existen en el HTML modificado.
    // btnCanjearSalsaRef se elimina porque el botón ya no está presente.
    btnMisPuntosNavRef = document.getElementById('btnMisPuntosNav'); // Botón "Mis Puntos" en navegación
    btnGoToAuthRef = document.querySelector('.nav-button[data-target="pagina-auth"]'); // Botón de navegación para ir a la sección de Auth
    
    // Referencias de autenticación (Login, Registro, Recuperación)
    loginFormRef = document.getElementById('loginForm');
    loginEmailInputRef = document.getElementById('loginEmail');
    loginPasswordInputRef = document.getElementById('loginPassword');
    loginErrorRef = document.getElementById('loginError');
    registerFormRef = document.getElementById('registerForm');
    registerFormContainerRef = document.getElementById('registerFormContainer'); 
    registerEmailInputRef = document.getElementById('registerEmail');
    registerPasswordInputRef = document.getElementById('registerPassword');
    registerBirthdayInputRef = document.getElementById('registerBirthday');
    registerErrorRef = document.getElementById('registerError');
    registerSuccessMessageRef = document.getElementById('registerSuccessMessage');
    forgotPasswordLinkRef = document.getElementById('forgotPasswordLink');
    passwordResetModalRef = document.getElementById('passwordResetModal');
    resetEmailInputRef = document.getElementById('resetEmail');
    passwordResetFormRef = document.getElementById('passwordResetForm');
    passwordResetErrorRef = document.getElementById('passwordResetError');
    passwordResetSuccessRef = document.getElementById('passwordResetSuccess');
    modalCloseButtonRef = passwordResetModalRef?.querySelector('.close-button');
    goToRegisterLinkRef = document.getElementById('goToRegisterLink');
    goToLoginLinkRef = document.getElementById('goToLoginLink');

    const registerNameInputRef = document.getElementById('registerName');

    // --- Listeners de Navegación ---
    const todosLosNavButtons = document.querySelectorAll('.nav-button');
    todosLosNavButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault(); // Previene la acción por defecto del botón (ej. recargar página)
            const targetPage = button.dataset.target; // Obtiene la página de destino del atributo data-target
            
            // Lógica de redirección si el usuario intenta acceder a páginas protegidas sin estar logueado.
            if ((targetPage === 'pagina-puntos' || targetPage === 'pagina-mi-qr') && !currentUser) {
                
                mostrarPagina('pagina-auth'); // Muestra la página de autenticación
                return; // Detiene la ejecución de este manejador para no mostrar la página protegida
            }
            // Si el usuario está conectado o la página no está protegida, muestra la página solicitada.
            mostrarPagina(targetPage);
        });
    });
    
    // --- Listeners para alternar entre los formularios de Login y Registro ---
    if (goToRegisterLinkRef) { // Botón "Regístrate Aquí"
        goToRegisterLinkRef.addEventListener('click', () => {
            if (loginFormRef && registerFormContainerRef) {
                loginFormRef.closest('.auth-form-container').style.display = 'none'; // Oculta el formulario de login
                registerFormContainerRef.style.display = 'block'; // Muestra el formulario de registro
            }
        });
    }
    if (goToLoginLinkRef) { // Botón "Inicia Sesión" (desde el registro)
        goToLoginLinkRef.addEventListener('click', () => {
            if (loginFormRef && registerFormContainerRef) {
                registerFormContainerRef.style.display = 'none'; // Oculta el formulario de registro
                loginFormRef.closest('.auth-form-container').style.display = 'block'; // Muestra el formulario de login
            }
        });
    }

    // --- Listener para el enlace "Olvidé mi contraseña" ---
    if (forgotPasswordLinkRef) {
        forgotPasswordLinkRef.addEventListener('click', (e) => {
            e.preventDefault(); // Previene la acción por defecto del enlace
            
            if (passwordResetModalRef) {
                passwordResetModalRef.style.display = 'block'; // Muestra el modal
            }
        });
    }

    // --- Listener para el botón de cerrar el modal de recuperación ---
    if (modalCloseButtonRef) {
        modalCloseButtonRef.addEventListener('click', () => {
            if (passwordResetModalRef) passwordResetModalRef.style.display = 'none'; // Oculta el modal
            limpiarModalRecuperacion(); // Limpia los mensajes del modal
        });
    }
    // Opcional: Cerrar el modal si el usuario hace clic fuera de él
    if (passwordResetModalRef) {
        window.addEventListener('click', (event) => {
            if (event.target === passwordResetModalRef) { // Si el clic fue directamente sobre el modal
                passwordResetModalRef.style.display = 'none'; // Oculta el modal
                limpiarModalRecuperacion(); // Limpia los mensajes
            }
        });
    }

    // --- Listener para el formulario de Recuperación de Contraseña ---
    if (passwordResetFormRef) {
        passwordResetFormRef.addEventListener('submit', async (e) => {
            e.preventDefault(); // Previene el envío por defecto del formulario
            const email = resetEmailInputRef.value.trim(); // Obtiene el email
            limpiarModalRecuperacion(); // Limpia mensajes de error/éxito anteriores

            if (!email) { // Validación básica: el email es obligatorio
                if(passwordResetErrorRef) passwordResetErrorRef.textContent = 'Por favor, introduce tu correo electrónico.';
                return;
            }
            
            
            try {
                await sendPasswordResetEmail(auth, email); // Envía la solicitud de restablecimiento de contraseña
                
                if(passwordResetSuccessRef) passwordResetSuccessRef.textContent = '¡Correo enviado! Revisa tu bandeja de entrada.'; // Mensaje de éxito
                // Cierra el modal y limpia los campos después de unos segundos
                setTimeout(() => {
                    if (passwordResetModalRef) passwordResetModalRef.style.display = 'none';
                    limpiarModalRecuperacion();
                }, 5000); 
            } catch (error) {
                
                if(passwordResetErrorRef) passwordResetErrorRef.textContent = obtenerMensajeErrorFirebase(error); // Muestra el error de Firebase
            }
        });
    }

    
    // --- Listener para el formulario de Registro ---
    if (registerFormRef) {
        registerFormRef.addEventListener('submit', async (e) => {
            e.preventDefault(); // Previene el envío por defecto
            // Obtiene los valores de los campos del formulario
            const email = registerEmailInputRef.value.trim();
            const name = registerNameInputRef.value.trim();
            const password = registerPasswordInputRef.value;
            const birthday = registerBirthdayInputRef.value;

            limpiarMensajesRegistro(); // Limpia mensajes de error/éxito anteriores

            // Validaciones que ya tienes: email, password, birthday
            if (!email || !password || !birthday) {
                if(registerErrorRef) registerErrorRef.textContent = 'Todos los campos son obligatorios.';
                return;
            }

            // --- Validación Front-end de los campos ---
            if (!email || !password || !birthday) { // Campos obligatorios
                if(registerErrorRef) registerErrorRef.textContent = 'Todos los campos son obligatorios.';
                return;
            }
            if (password.length < 6) { // Validación de contraseña mínima
                if(registerErrorRef) registerErrorRef.textContent = 'La contraseña debe tener al menos 6 caracteres.';
                return;
            }
            // Validación de edad (mayor de 16 años)
            const fechaNacimiento = new Date(birthday);
            const hoy = new Date();
            const edad = hoy.getFullYear() - fechaNacimiento.getFullYear();
            const mesDiff = hoy.getMonth() - fechaNacimiento.getMonth();
            const diaDiff = hoy.getDate() - fechaNacimiento.getDate();
            const edadValida = edad > 16 || (edad === 16 && mesDiff > 0) || (edad === 16 && mesDiff === 0 && diaDiff >= 0);

            if (!edadValida) { // Si la edad es menor a 16
                if(registerErrorRef) registerErrorRef.textContent = 'Debes ser mayor de 16 años para registrarte.';
                return;
            }

            try {
                // 1. Crea el usuario en Firebase Authentication
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                

                // 2. Crea el documento del nuevo usuario en Firestore con puntos iniciales
                const userDocRef = doc(db, "usuarios", userCredential.user.uid);
                await setDoc(userDocRef, {
                    email: userCredential.user.email,
                    nombre: name,
                    puntosTotalesAcumulados: 0, // Suma histórica de puntos
                    puntosFidelidad: 0,        // Puntos que puede usar
                    fechaNacimiento: birthday, 
                    fechaRegistro: new Date() // Registra la fecha de creación
                });
                

                // 3. Resetea el formulario, muestra mensaje de éxito y redirige al login
                registerFormRef.reset();
                if(registerSuccessMessageRef) registerSuccessMessageRef.textContent = '¡Registro exitoso! Ahora puedes iniciar sesión.';
                setTimeout(() => { 
                    limpiarMensajesRegistro();
                    if (registerFormContainerRef) registerFormContainerRef.style.display = 'none';
                    if (loginFormRef) loginFormRef.closest('.auth-form-container').style.display = 'block';
                }, 3000); 

            } catch (error) {
                
                if(registerErrorRef) registerErrorRef.textContent = obtenerMensajeErrorFirebase(error); // Muestra el error de Firebase
            }
        });
    }

    // --- Listener para el formulario de Inicio de Sesión ---
    if (loginFormRef) {
        loginFormRef.addEventListener('submit', async (e) => {
            e.preventDefault(); // Previene el envío por defecto
            // Obtiene el email y la contraseña
            const email = loginEmailInputRef.value.trim();
            const password = loginPasswordInputRef.value;

            limpiarMensajesLogin(); // Limpia mensajes de error anteriores

            // Validación básica
            if (!email || !password) {
                if(loginErrorRef) loginErrorRef.textContent = 'Por favor, introduce tu correo y contraseña.';
                return;
            }

            try {
                // Inicia sesión con Firebase Authentication
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                
                loginFormRef.reset(); // Limpia el formulario de login después de iniciar sesión
            } catch (error) {
                
                if(loginErrorRef) loginErrorRef.textContent = obtenerMensajeErrorFirebase(error); // Muestra el error de Firebase
            }
        });
    }

    // --- Listener para el botón de Cerrar Sesión ---
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
            
            try {
                await signOut(auth); // Cierra la sesión del usuario en Firebase
                
                mostrarPagina('pagina-promociones'); // Redirige a la página de promociones al cerrar sesión
            } catch (error) {
                console.error("[AUTH_DEBUG] ERROR al cerrar sesión:", error);
            }
        });
    }
    
    // --- Inicializaciones y Estado Inicial de la Aplicación ---
    inicializarMenu(); // Carga el menú al inicio de la app

    // Actualiza la UI de autenticación basándose en el estado del usuario al cargar la página
    actualizarUIAcceso(auth.currentUser ? true : false, auth.currentUser ? auth.currentUser.email : null);

    // Determina qué página mostrar al inicio si ninguna está marcada como 'active'.
    const algunaPaginaActiva = document.querySelector('.pagina.active');
    if (!algunaPaginaActiva) { // Si no hay ninguna página activa
        if (!currentUser) { // Y no hay usuario conectado
            mostrarPagina('pagina-promociones'); // Muestra la página de promociones
        } else { // Y si hay usuario conectado
            mostrarPagina('pagina-puntos'); // Muestra la página de puntos
        }
    }
    
});

// --- Funciones Auxiliares para Limpieza de Mensajes de Error/Éxito ---
function limpiarMensajesLogin() { if(loginErrorRef) loginErrorRef.textContent = ''; }
function limpiarMensajesRegistro() {
    if(registerErrorRef) registerErrorRef.textContent = '';
    if(registerSuccessMessageRef) registerSuccessMessageRef.textContent = '';
}
function limpiarModalRecuperacion() {
    if(resetEmailInputRef) resetEmailInputRef.value = '';
    if(passwordResetErrorRef) passwordResetErrorRef.textContent = '';
    if(passwordResetSuccessRef) passwordResetSuccessRef.textContent = '';
}

// --- Función para mapear códigos de error de Firebase a mensajes amigables para el usuario ---
function obtenerMensajeErrorFirebase(error) {
    console.error("Código de error Firebase:", error.code, "Mensaje:", error.message); 
    switch (error.code) {
        case 'auth/email-already-in-use': return 'Este correo electrónico ya está en uso. Intenta iniciar sesión o usa uno diferente.';
        case 'auth/invalid-email': return 'El formato del correo electrónico no es válido.';
        case 'auth/operation-not-allowed': return 'Esta operación no está permitida.';
        case 'auth/weak-password': return 'La contraseña es demasiado débil. Usa una más segura.';
        case 'auth/user-not-found': return 'No se encontró ningún usuario con este correo electrónico.';
        case 'auth/wrong-password': return 'La contraseña ingresada es incorrecta.';
        case 'auth/invalid-credential': return 'Correo electrónico o contraseña incorrectos. Por favor, verifica tus datos.';
        case 'auth/too-many-requests': return 'Demasiados intentos de inicio de sesión. Espera un momento o inténtalo más tarde.';
        case 'auth/network-request-failed': return 'Fallo en la conexión. Revisa tu conexión a internet.';
        case 'auth/user-disabled': return 'Esta cuenta de usuario ha sido deshabilitada.';
        case 'auth/popup-blocked': return 'La ventana emergente se bloqueó. Permite las ventanas emergentes para este sitio.';
        case 'auth/cancelled-popup-request': return 'La acción de inicio de sesión fue cancelada.';
        case 'auth/user-mismatch': return 'No se pudo restablecer la contraseña. El usuario no coincide con el correo proporcionado.';
        case 'auth/session-cookie-expired': return 'Tu sesión ha expirado. Por favor, inicia sesión de nuevo.';
        default: 
            // Si el error es desconocido pero contiene "invalid-credential", mostramos ese mensaje.
            if (error.message && error.message.toLowerCase().includes('invalid-credential')) {
                return 'Correo electrónico o contraseña incorrectos. Por favor, verifica tus datos.';
            }
            // Si no, mostramos un mensaje genérico con el código o mensaje del error.
            return `Ocurrió un error desconocido: ${error.message || error.code}`;
    }
}


// Carga los puntos del usuario desde Firestore y actualiza el contador en la UI.
async function cargarPuntosFirebase() {
    const contadorPuntosElement = document.getElementById('contador-puntos');
    
    if (currentUser && contadorPuntosElement) {
        try {
            const userDocRef = doc(db, "usuarios", currentUser.uid);
            const docSnap = await getDoc(userDocRef);

            if (docSnap.exists()) {
                const userData = docSnap.data();
                puntosActuales = userData.puntosFidelidad || 0;
                contadorPuntosElement.textContent = puntosActuales;
                return puntosActuales;
            } else {
                console.log("[PUNTOS_DEBUG] Documento no encontrado. Creando...");
                puntosActuales = 0;
                contadorPuntosElement.textContent = '0';
                await setDoc(userDocRef, {
                    email: currentUser.email,
                    puntosFidelidad: 0,
                    fechaRegistro: new Date()
                });
                return 0;
            }
        } catch (error) {
            contadorPuntosElement.textContent = 'Error';
            puntosActuales = 0;
            return 0;
        }
    } else if (contadorPuntosElement) {
        puntosActuales = 0;
        contadorPuntosElement.textContent = '0';
        return 0;
    }
}

// --- FUNCIÓN PARA GENERAR EL QR CODE DEL CLIENTE ---
function generarMiQRCode() {
    
    const qrcodeContainer = document.getElementById('qrcode-container'); // Contenedor donde se dibujará el QR
    const qrMessage = document.getElementById('qrMessage'); // Mensaje informativo bajo el QR

    if (!qrcodeContainer) { // Verificación de que el contenedor existe
        
        return;
    }

    console.log("[QR_DEBUG] Estado actual de currentUser:", currentUser);
    if (!currentUser) { // Si no hay usuario logueado, muestra mensaje y limpia el contenedor
        if (qrMessage) qrMessage.textContent = "Por favor, inicia sesión para ver tu código QR.";
        qrcodeContainer.innerHTML = ''; 
        
        return;
    }

    // Los datos que se codificarán en el QR: identificador único del usuario de Fritsky
    const qrData = `fritsky_user:${currentUser.uid}`; 
    qrcodeContainer.innerHTML = ''; // Limpia cualquier QR previo antes de generar uno nuevo

    // Función para cargar la librería `QRCode.js` dinámicamente si aún no está cargada.
    const loadQRCodeLibAndGenerate = () => {
        // 1. Verifica si la librería `QRCode` ya existe en el scope global.
        if (typeof QRCode !== 'undefined') {
            console.log("[QR_LOAD] La librería qrcode.js ya está disponible.");
            generateQRCodeNow(); // Si ya está, genera el QR inmediatamente.
            return;
        }

        // 2. Si la librería no está, crea un elemento `<script>` para cargarla.
        
        const script = document.createElement('script');
        // ¡¡¡IMPORTANTE!!! Verifica que esta ruta sea la correcta para tu archivo `qrcode.min.js`.
        // Basado en tu estructura de archivos, `/js/qrcode.min.js` es lo más probable.
        script.src = window.BASE_PATH + 'js/qrcode.min.js'; // Usa la variable global BASE_PATH
        
        script.onload = () => { // Evento que se dispara cuando el script se carga correctamente.
            
            generateQRCodeNow(); // Ahora que la librería está cargada, genera el QR.
        };
        
        script.onerror = (err) => { // Evento que se dispara si hay un error al cargar el script.
            
            if (qrMessage) qrMessage.textContent = "Error al cargar la librería QR. Por favor, inténtalo de nuevo.";
        };
        
        document.head.appendChild(script); // Añade el script al <head> del documento para que se cargue.
    };

    // Función que realmente crea la instancia de QRCode y dibuja el código QR.
    const generateQRCodeNow = () => {
        if (typeof QRCode !== 'undefined') { // Verifica que la librería esté disponible
            try {
                
                // Crea una nueva instancia de QRCode en el elemento contenedor.
                new QRCode(qrcodeContainer, {
                    text: qrData, // El texto a codificar (ID del usuario Fritsky)
                    width: 200,  // Ancho del código QR
                    height: 200, // Alto del código QR
                    colorDark : "#000000", // Color de los módulos del QR (negro)
                    colorLight : "#ffffff", // Color del fondo (blanco)
                    correctLevel : QRCode.CorrectLevel.H // Nivel de corrección de errores (H = Alto, soporta hasta 30% de daño)
                });
    
                if (qrMessage) qrMessage.textContent = "Escanea este código a nuestro personal para sumar puntos."; // Mensaje informativo
                console.log(`[QR_DEBUG] QR Code generado correctamente para el usuario ${currentUser.uid} con los datos: ${qrData}`);
    
            } catch (error) { // Captura errores durante la generación del QR
                console.error("[QR_DEBUG] ERROR al generar el QR Code:", error);
                if (qrMessage) qrMessage.textContent = "No se pudo generar el código QR. Inténtalo de nuevo.";
            }
        } else {
            // Si QRCode aún no está definido después de intentar cargarlo, es un error crítico.
            console.error("[QR_LOAD_ERROR] ERROR: La librería QRCode todavía no está definida después de intentar cargarlo.");
            if (qrMessage) qrMessage.textContent = "Error crítico: No se pudo cargar la librería QR necesaria.";
        }
    };

    // Inicia el proceso: primero carga la librería (si es necesario) y luego genera el QR.
    loadQRCodeLibAndGenerate();
}