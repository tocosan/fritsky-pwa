import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
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
    doc,
    setDoc,
    getDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

// Configuración de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyAdtCPqrLrTYzyARYnScM6NLrILQzkPdXc",
    authDomain: "controlcajafritsky.firebaseapp.com",
    projectId: "controlcajafritsky",
    storageBucket: "controlcajafritsky.firebasestorage.app",
    messagingSenderId: "434045144529",
    appId: "1:434045144529:web:f24afcec61b03dcd63e4f0"
};

// Inicializar Firebase y servicios
const appFirebase = initializeApp(firebaseConfig);
const auth = getAuth(appFirebase);
const db = getFirestore(appFirebase);
console.log("Firebase (v10 modular) inicializado!");

// Variables Globales
let currentUser = null;
let menuCompletoGlobal = [];
const PUNTOS_PARA_PREMIO = 10;
let puntosActuales = 0; // Esta variable se mantendrá como cache en memoria, sincronizada con Firestore

// --- REFERENCIAS GLOBALES AL DOM ---
let contadorPuntosSpanRef = null;
let btnCanjearSalsaRef = null;
let btnMisPuntosRef = null; // Referencia al botón "Mis Puntos"

// Referencias a elementos de autenticación
let loginFormRef = null;
let loginEmailInputRef = null;
let loginPasswordInputRef = null;
let loginErrorRef = null;
let registerFormRef = null;
let registerFormContainerRef = null; // Contenedor del form de registro
let registerEmailInputRef = null;
let registerPasswordInputRef = null;
let registerBirthdayInputRef = null;
let registerErrorRef = null;
let registerSuccessMessageRef = null;
let forgotPasswordLinkRef = null;
let passwordResetModalRef = null;
let resetEmailInputRef = null;
let passwordResetFormRef = null;
let passwordResetErrorRef = null;
let passwordResetSuccessRef = null;
let modalCloseButtonRef = null;
let btnGoToAuthRef = null; // Botón de navegación a Auth
let goToRegisterLinkRef = null; // Botón para ir al registro
let goToLoginLinkRef = null;   // Botón para volver al login

// --- MANEJO DEL ESTADO DE AUTENTICACIÓN ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        console.log("Firebase Auth: Usuario conectado - UID:", user.uid, "Email:", user.email);
        actualizarUIAcceso(true, user.email);
        if (document.getElementById('pagina-auth')?.classList.contains('active')) {
            mostrarPagina('pagina-puntos');
        }
        cargarPuntosFirebase(); // Cargar puntos desde Firestore al conectarse
        generarMiQRCode(); // Asegurar que el QR se muestre al iniciar sesión
    } else {
        currentUser = null;
        console.log("Firebase Auth: Usuario desconectado.");
        actualizarUIAcceso(false, null);
        if (contadorPuntosSpanRef) contadorPuntosSpanRef.textContent = '0'; // Resetear UI de puntos si se desconecta
        puntosActuales = 0; // Resetear variable en memoria
        actualizarEstadoBotonCanjearFirebase(); // Deshabilitar botón de canje
        
        // Limpiar el QR code si el usuario se desconecta
        const qrContainer = document.getElementById('qrcode-container');
        if (qrContainer) qrContainer.innerHTML = '';
        const qrMessage = document.getElementById('qrMessage');
        if (qrMessage) qrMessage.textContent = '';
    }
});

function actualizarUIAcceso(isLoggedIn, userEmail = null) {
    console.log("[UI_DEBUG] Actualizando UI de acceso, isLoggedIn:", isLoggedIn);
    
    if (isLoggedIn) {
        if (btnGoToAuthRef) btnGoToAuthRef.style.display = 'none';
        const btnLogout = document.getElementById('btnLogout');
        if (btnLogout) btnLogout.style.display = 'inline-block';
        const userInfoSpan = document.getElementById('userInfo');
        if (userInfoSpan) userInfoSpan.textContent = userEmail || 'Conectado';
        
        const authPage = document.getElementById('pagina-auth');
        if (authPage && authPage.classList.contains('active')) {
            mostrarPagina('pagina-puntos'); 
        }
    } else {
        if (btnGoToAuthRef) btnGoToAuthRef.style.display = 'inline-block';
        const btnLogout = document.getElementById('btnLogout');
        if (btnLogout) btnLogout.style.display = 'none';
        const userInfoSpan = document.getElementById('userInfo');
        if (userInfoSpan) userInfoSpan.textContent = '';
    }

    // Actualizar el estado del botón "Mis Puntos"
    if (btnMisPuntosRef) {
        if (isLoggedIn) {
            btnMisPuntosRef.classList.remove('disabled'); // Remover clase disabled
            btnMisPuntosRef.style.pointerEvents = 'auto'; // Habilitar interacciones
            btnMisPuntosRef.style.opacity = '1';
            btnMisPuntosRef.style.cursor = 'pointer';
        } else {
            btnMisPuntosRef.classList.add('disabled'); // Añadir clase disabled
            btnMisPuntosRef.style.pointerEvents = 'none'; // Deshabilitar clics
            btnMisPuntosRef.style.opacity = '0.6';
            btnMisPuntosRef.style.cursor = 'not-allowed';
        }
    }
}

// --- NAVEGACIÓN ENTRE PÁGINAS PRINCIPALES ---
function mostrarPagina(idPaginaTarget) {
    console.log("[NAV_DEBUG] Intentando mostrar página:", idPaginaTarget);
    const todasLasPaginas = document.querySelectorAll('.pagina');
    const todosLosNavButtons = document.querySelectorAll('.nav-button');
    
    todasLasPaginas.forEach(pagina => pagina.classList.remove('active'));
    const paginaSeleccionada = document.getElementById(idPaginaTarget);
    
    // 1. Mostrar la página y aplicar la clase 'active'
    if (paginaSeleccionada) {
        paginaSeleccionada.classList.add('active');
        console.log("[NAV_DEBUG] Página", idPaginaTarget, "activada.");
    } else {
        console.error("[NAV_DEBUG] No se encontró la página con ID:", idPaginaTarget);
        // Si la página no existe, no intentamos nada más
        return; 
    }

    // 2. Si la página es 'pagina-mi-qr', generar el QR
    if (idPaginaTarget === 'pagina-mi-qr') {
        generarMiQRCode(); 
    }

    // Actualizar la clase 'active' en los botones de navegación
    todosLosNavButtons.forEach(button => button.classList.remove('active'));
    const botonActivo = document.querySelector(`.nav-button[data-target="${idPaginaTarget}"]`);
    if (botonActivo) botonActivo.classList.add('active');

    // Lógica específica para la página de autenticación
    if (idPaginaTarget === 'pagina-auth') {
        if (loginFormRef && registerFormContainerRef) {
            registerFormContainerRef.style.display = 'none'; // Ocultar registro por defecto
            loginFormRef.closest('.auth-form-container').style.display = 'block'; // Mostrar login por defecto
        }
    }

    // Lógica específica para la página del menú
    if (idPaginaTarget === 'pagina-menu' && menuCompletoGlobal.length > 0) {
        console.log("[NAV_DEBUG] Es página de menú y hay datos, renderizando categorías.");
        renderizarVistaCategoriasPrincipales(menuCompletoGlobal);
    } else if (idPaginaTarget === 'pagina-menu' && menuCompletoGlobal.length === 0) {
        const menuContainer = document.getElementById('menu-container');
        if(menuContainer) menuContainer.innerHTML = '<p>Cargando datos del menú...</p>';
        console.log("[NAV_DEBUG] Es página de menú, pero menuCompletoGlobal está vacío.");
    }
}

// --- LÓGICA PARA CARGAR Y MOSTRAR EL MENÚ INTERACTIVO ---
async function inicializarMenu() {
    console.log("[MENU_DEBUG] Entrando a inicializarMenu()");
    const menuContainerRef = document.getElementById('menu-container');
    if (!menuContainerRef) {
        console.error("[MENU_DEBUG] menuContainerRef es null en inicializarMenu. El elemento #menu-container no existe.");
        return;
    }
    try {
        console.log("[MENU_DEBUG] Intentando fetch 'menu.json'");
        const response = await fetch('menu.json');
        if (!response.ok) {
            console.error("[MENU_DEBUG] Error en respuesta de fetch:", response.status, response.statusText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        menuCompletoGlobal = await response.json();
        console.log("[MENU_DEBUG] Menú JSON cargado y parseado.");
        if (document.getElementById('pagina-menu')?.classList.contains('active')) {
            console.log("[MENU_DEBUG] Página del menú está activa, renderizando categorías principales.");
            renderizarVistaCategoriasPrincipales(menuCompletoGlobal);
        }
    } catch (error) {
        console.error("[MENU_DEBUG] Fallo CRÍTICO al cargar o parsear menu.json:", error);
        menuContainerRef.innerHTML = '<p>Error crítico al cargar el menú. Revise la consola.</p>';
    }
}

function renderizarVistaCategoriasPrincipales(menuData) {
    const menuContainerRef = document.getElementById('menu-container');
    console.log("[MENU_DEBUG] Entrando a renderizarVistaCategoriasPrincipales", menuData ? menuData.length : 'menuData es null/undefined');
    if (!menuContainerRef) { console.error("menuContainerRef no encontrado en renderizarVistaCategoriasPrincipales"); return; }
    if (!menuData || menuData.length === 0) {
        menuContainerRef.innerHTML = '<p>Menú no disponible o aún cargando...</p>';
        console.warn("menuData está vacío o no disponible en renderizarVistaCategoriasPrincipales");
        return;
    }
    menuContainerRef.innerHTML = ''; // Limpiar el contenedor antes de añadir nuevas tarjetas
    const categoriasGrid = document.createElement('div');
    categoriasGrid.classList.add('categorias-grid'); // Clase para aplicar grid layout

    menuData.forEach(categoria => {
        const categoriaCard = document.createElement('div');
        categoriaCard.classList.add('categoria-card', 'card'); // Usar clases comunes

        // Añadir imagen de cabecera si existe
        if (categoria.imagen_cabecera_categoria) {
            const imgCat = document.createElement('img');
            imgCat.src = categoria.imagen_cabecera_categoria;
            imgCat.alt = categoria.nombre_categoria;
            imgCat.classList.add('categoria-card-imagen');
            categoriaCard.appendChild(imgCat);
        }

        // Título de la categoría
        const tituloCat = document.createElement('h3');
        tituloCat.textContent = categoria.nombre_categoria;
        categoriaCard.appendChild(tituloCat);

        // Descripción corta de la categoría
        let descTexto = categoria.descripcion_categoria_corta || categoria.descripcion_categoria || "";
        if (descTexto.length > 100) descTexto = descTexto.substring(0, 100) + "..."; // Limitar descripción
        if (descTexto) {
            const descCat = document.createElement('p');
            descCat.textContent = descTexto;
            categoriaCard.appendChild(descCat);
        }

        // Añadir evento click para mostrar el detalle
        categoriaCard.addEventListener('click', () => mostrarDetalleCategoria(categoria, menuData));
        categoriasGrid.appendChild(categoriaCard);
    });
    menuContainerRef.appendChild(categoriasGrid);
}

function mostrarDetalleCategoria(categoria, menuDataCompleta) {
    const menuContainerRef = document.getElementById('menu-container');
    console.log("[MENU_DEBUG] Entrando a mostrarDetalleCategoria para:", categoria.nombre_categoria);
    if (!menuContainerRef) { console.error("menuContainerRef no encontrado en mostrarDetalleCategoria"); return; }
    menuContainerRef.innerHTML = ''; // Limpiar el contenedor

    // Botón de Volver
    const btnVolver = document.createElement('button');
    btnVolver.textContent = '‹ Volver a Categorías';
    btnVolver.classList.add('button-secondary', 'btn-volver-menu');
    btnVolver.addEventListener('click', () => renderizarVistaCategoriasPrincipales(menuDataCompleta));
    menuContainerRef.appendChild(btnVolver);
    
    // Título de la Categoría
    const tituloPaginaCategoria = document.createElement('h2');
    tituloPaginaCategoria.textContent = categoria.nombre_categoria;
    tituloPaginaCategoria.classList.add('titulo-pagina-categoria');
    menuContainerRef.appendChild(tituloPaginaCategoria);
    
    // Descripción de la Categoría (si existe)
    if (categoria.descripcion_categoria) {
        const descCategoriaEl = document.createElement('p');
        descCategoriaEl.classList.add('descripcion-pagina-categoria');
        descCategoriaEl.textContent = categoria.descripcion_categoria;
        menuContainerRef.appendChild(descCategoriaEl);
    }
    
    // Sección de Precios de Salsas Premium (si existe)
    if (categoria.informacion_precios_salsas) {
        console.log("[DEBUG_MENU_DETAIL] Categoría TIENE 'informacion_precios_salsas'");
        const preciosDiv = document.createElement('div');
        preciosDiv.classList.add('info-precios-categoria', 'card'); // Usar clase 'card' para consistencia
        const preciosTitulo = document.createElement('h4');
        preciosTitulo.textContent = categoria.informacion_precios_salsas.titulo || "Precios Adicionales";
        preciosDiv.appendChild(preciosTitulo);

        if (Array.isArray(categoria.informacion_precios_salsas.items_precio) && categoria.informacion_precios_salsas.items_precio.length > 0) {
            console.log("[DEBUG_MENU_DETAIL] Renderizando 'items_precio'");
            const listaPreciosUl = document.createElement('ul');
            listaPreciosUl.classList.add('lista-precios-salsas');
            categoria.informacion_precios_salsas.items_precio.forEach(itemPrecio => {
                const li = document.createElement('li');
                li.innerHTML = `<span>${itemPrecio.concepto || 'N/A'}:</span> <strong>${itemPrecio.precio || 'N/A'}</strong>`;
                listaPreciosUl.appendChild(li);
            });
            preciosDiv.appendChild(listaPreciosUl);
        } else {
            console.warn("[DEBUG_MENU_DETAIL] 'informacion_precios_salsas.items_precio' NO es un array o está vacío.");
        }
        menuContainerRef.appendChild(preciosDiv);
    }

    // Secciones Informativas (ej: Conos)
    if (categoria.secciones_informativas) {
        let seccionesHtmlString = '';
        let seccionTamanoConoHtmlString = ''; // Para renderizarla primero si existe

        categoria.secciones_informativas.forEach(seccion => {
            // Plantilla base para una sección informativa
            let seccionHtmlActual = `<div class="menu-seccion-info card" id="${seccion.id_seccion || 'seccion-' + Math.random().toString(36).substr(2, 9)}">
                                        <h4>${seccion.titulo_seccion}</h4>`;
            if (seccion.subtitulo_seccion) seccionHtmlActual += `<p class="subtitulo-seccion">${seccion.subtitulo_seccion}</p>`;
            
            // Renderizar items (ej: para conos, toppings)
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
            
            // Renderizar listas simples (ej: salsas gratis)
            if (seccion.lista_items && seccion.lista_items.length > 0) {
                seccionHtmlActual += `<ul class="info-lista-simple">`;
                seccion.lista_items.forEach(textoItem => { seccionHtmlActual += `<li>${textoItem}</li>`; });
                seccionHtmlActual += `</ul>`;
            }
            
            // Salsas Gratis y enlace a Premium
            if (seccion.descripcion_salsas_gratis) seccionHtmlActual += `<p class="descripcion-salsas-gratis">${seccion.descripcion_salsas_gratis}</p>`;
            if (seccion.lista_salsas_gratis && seccion.lista_salsas_gratis.length > 0) {
                seccionHtmlActual += `<ul class="info-lista-salsas-gratis">`;
                seccion.lista_salsas_gratis.forEach(nombreSalsa => { seccionHtmlActual += `<li>${nombreSalsa}</li>`; });
                seccionHtmlActual += `</ul>`;
            }

            // Enlace a Salsas Premium
            if (seccion.enlace_a_salsas_premium) {
                const btnSalsasPremium = document.createElement('button');
                btnSalsasPremium.textContent = seccion.enlace_a_salsas_premium.texto_enlace;
                btnSalsasPremium.classList.add('button-primary', 'btn-link-salsas');
                btnSalsasPremium.dataset.targetSalsaCat = seccion.enlace_a_salsas_premium.target_categoria_id;
                seccionHtmlActual += btnSalsasPremium.outerHTML; // Insertar como string HTML
            }
            seccionHtmlActual += `</div>`;
            
            // Separar la sección del tamaño del cono para renderizarla al principio
            if (seccion.id_seccion === "info_tamano_cono") {
                seccionTamanoConoHtmlString = seccionHtmlActual;
            } else {
                seccionesHtmlString += seccionHtmlActual;
            }
        });

        // Insertar la sección del cono primero si existe
        if (seccionTamanoConoHtmlString) menuContainerRef.insertAdjacentHTML('beforeend', seccionTamanoConoHtmlString);
        // Insertar las demás secciones
        if (seccionesHtmlString) {
            const contenedorInferior = document.createElement('div');
            contenedorInferior.classList.add('secciones-inferiores-flex-container');
            contenedorInferior.innerHTML = seccionesHtmlString;
            menuContainerRef.appendChild(contenedorInferior);
        }
    } 
    // Items Directos (ej: Cups Combinados, Hexagonales sin secciones informativas)
    else if (categoria.items_directos) {
        const itemsGrid = document.createElement('div');
        itemsGrid.classList.add('menu-items-directos-grid'); // Nueva clase para este tipo de grid

        categoria.items_directos.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.classList.add('menu-item', 'card'); // Usar clase 'card' para consistencia

            // Imagen del ítem
            if (item.imagen) { 
                const img = document.createElement('img'); 
                img.src = item.imagen; 
                img.alt = item.nombre; 
                img.classList.add('info-item-imagen'); // Reutilizar clase de imagen
                itemDiv.appendChild(img); 
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
            
            // Precio del ítem (si existe y no es una categoría de salsas premium especial)
            if (item.precio && categoria.id_categoria !== 'salsas-premium') {
                const precioEl = document.createElement('p');
                precioEl.classList.add('menu-item-precio');
                precioEl.textContent = item.precio;
                itemDiv.appendChild(precioEl);
            } 
            // Caso especial para conos de patatas con diferentes precios
            else if (item.precio_chico_cup && item.precio_medio_grande && categoria.id_categoria === 'conos-de-patatas') { 
                const precioEl = document.createElement('p');
                precioEl.classList.add('menu-item-precio'); 
                precioEl.textContent = `Chico/Cup: ${item.precio_chico_cup} | Mediano/Grande: ${item.precio_medio_grande}`;
                itemDiv.appendChild(precioEl);
            }
            itemsGrid.appendChild(itemDiv);
        });
        menuContainerRef.appendChild(itemsGrid);

        // Pie de categoría (si existe, ej: Salsas Premium)
        if (categoria.pie_categoria) {
            const pieDiv = document.createElement('div');
            pieDiv.classList.add('menu-seccion-info', 'card', 'pie-categoria'); // Añadir clase común y específica
            const pieTitulo = document.createElement('h4'); 
            pieTitulo.textContent = categoria.pie_categoria.titulo_seccion; 
            pieDiv.appendChild(pieTitulo);
            const pieDesc = document.createElement('p'); 
            pieDesc.textContent = categoria.pie_categoria.descripcion_salsas; 
            pieDiv.appendChild(pieDesc);
            
            // Botón para enlace a Salsas Premium
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

    // Añadir listeners a los botones de enlace a salsas después de que se hayan creado en el DOM
    menuContainerRef.querySelectorAll('.btn-link-salsas').forEach(button => {
        button.addEventListener('click', (e) => {
            const targetCatId = e.target.dataset.targetSalsaCat;
            // Buscar la categoría de destino en el menú completo
            const catSalsas = menuDataCompleta.find(c => c.id_categoria === targetCatId);
            if (catSalsas) {
                mostrarDetalleCategoria(catSalsas, menuDataCompleta); // Mostrar la categoría de salsas premium
            }
        });
    });
}

// --- EVENT LISTENERS Y CÓDIGO QUE SE EJECUTA CUANDO EL DOM ESTÁ LISTO ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("[DOM_DEBUG] DOM completamente cargado y parseado.");

    // --- Asignar referencias a elementos del DOM ---
    // Puntos y Canje
    contadorPuntosSpanRef = document.getElementById('contador-puntos');
    btnCanjearSalsaRef = document.getElementById('btnCanjearSalsa');
    btnMisPuntosRef = document.getElementById('btnMisPuntosNav'); // Referencia al botón "Mis Puntos"

    // Autenticación y Navegación
    loginFormRef = document.getElementById('loginForm');
    loginEmailInputRef = document.getElementById('loginEmail');
    loginPasswordInputRef = document.getElementById('loginPassword');
    loginErrorRef = document.getElementById('loginError');
    registerFormRef = document.getElementById('registerForm');
    registerFormContainerRef = document.getElementById('registerFormContainer'); // Contenedor del form de registro
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
    btnGoToAuthRef = document.querySelector('.nav-button[data-target="pagina-auth"]');
    goToRegisterLinkRef = document.getElementById('goToRegisterLink');
    goToLoginLinkRef = document.getElementById('goToLoginLink');

    // --- Listeners de Navegación ---
    const todosLosNavButtons = document.querySelectorAll('.nav-button');
    todosLosNavButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault(); // Prevenir el comportamiento por defecto del botón
            const targetPage = button.dataset.target;
            console.log("[NAV_DEBUG] Clic en botón NAV:", targetPage);

            // Redirección si la página objetivo no está disponible para el usuario actual
            if ((targetPage === 'pagina-puntos' || targetPage === 'pagina-mi-qr') && !currentUser) {
                console.log(`[NAV_DEBUG] Usuario no conectado, redirigiendo a auth para '${targetPage}'.`);
                mostrarPagina('pagina-auth');
                return; // Detiene la ejecución aquí si hay redirección
            }
            
            // Para todos los demás botones, o si el usuario está conectado
            mostrarPagina(targetPage);
        });
    });
    
    // --- Listeners para alternar entre Login y Registro ---
    if (goToRegisterLinkRef) {
        goToRegisterLinkRef.addEventListener('click', () => {
            if (loginFormRef && registerFormContainerRef) {
                loginFormRef.closest('.auth-form-container').style.display = 'none'; // Ocultar login
                registerFormContainerRef.style.display = 'block'; // Mostrar registro
            }
        });
    }
    if (goToLoginLinkRef) {
        goToLoginLinkRef.addEventListener('click', () => {
            if (loginFormRef && registerFormContainerRef) {
                registerFormContainerRef.style.display = 'none'; // Ocultar registro
                loginFormRef.closest('.auth-form-container').style.display = 'block'; // Mostrar login
            }
        });
    }

    // --- Listener para el enlace de Olvidé mi contraseña ---
    if (forgotPasswordLinkRef) {
        forgotPasswordLinkRef.addEventListener('click', (e) => {
            e.preventDefault();
            console.log("[AUTH_DEBUG] Mostrando modal de recuperación de contraseña.");
            if (passwordResetModalRef) {
                passwordResetModalRef.style.display = 'block';
            }
        });
    }

    // --- Listener para cerrar el modal de recuperación ---
    if (modalCloseButtonRef) {
        modalCloseButtonRef.addEventListener('click', () => {
            if (passwordResetModalRef) passwordResetModalRef.style.display = 'none';
            limpiarModalRecuperacion();
        });
    }
    // Opcional: Cerrar modal al hacer clic fuera de él
    if (passwordResetModalRef) {
        window.addEventListener('click', (event) => {
            if (event.target === passwordResetModalRef) {
                passwordResetModalRef.style.display = 'none';
                limpiarModalRecuperacion();
            }
        });
    }

    // --- Listener para enviar el correo de recuperación ---
    if (passwordResetFormRef) {
        passwordResetFormRef.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = resetEmailInputRef.value.trim();
            
            limpiarModalRecuperacion(); // Limpiar mensajes anteriores
            if (!email) {
                if(passwordResetErrorRef) passwordResetErrorRef.textContent = 'Por favor, introduce tu correo electrónico.';
                return;
            }
            
            console.log(`[AUTH_DEBUG] Intentando enviar email de recuperación a: ${email}`);

            try {
                await sendPasswordResetEmail(auth, email);
                console.log("[AUTH_DEBUG] Email de recuperación enviado con éxito.");
                if(passwordResetSuccessRef) passwordResetSuccessRef.textContent = '¡Correo enviado! Revisa tu bandeja de entrada.';
                setTimeout(() => {
                    if (passwordResetModalRef) passwordResetModalRef.style.display = 'none';
                    limpiarModalRecuperacion();
                }, 5000); 
            } catch (error) {
                console.error("[AUTH_DEBUG] Error al enviar email de recuperación:", error);
                if(passwordResetErrorRef) passwordResetErrorRef.textContent = obtenerMensajeErrorFirebase(error);
            }
        });
    }

    // --- Listener para el formulario de Registro ---
    if (registerFormRef) {
        registerFormRef.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log("[AUTH_DEBUG] Intento de Registro...");
            const email = registerEmailInputRef.value.trim();
            const password = registerPasswordInputRef.value;
            const birthday = registerBirthdayInputRef.value;

            limpiarMensajesRegistro(); // Limpiar mensajes anteriores

            // --- Validación Front-end adicional ---
            if (!email || !password || !birthday) {
                if(registerErrorRef) registerErrorRef.textContent = 'Todos los campos son obligatorios.';
                return;
            }
            if (password.length < 6) {
                if(registerErrorRef) registerErrorRef.textContent = 'La contraseña debe tener al menos 6 caracteres.';
                return;
            }
            const fechaNacimiento = new Date(birthday);
            const hoy = new Date();
            const edad = hoy.getFullYear() - fechaNacimiento.getFullYear();
            const mesDiff = hoy.getMonth() - fechaNacimiento.getMonth();
            const diaDiff = hoy.getDate() - fechaNacimiento.getDate();
            const edadValida = edad > 16 || (edad === 16 && mesDiff > 0) || (edad === 16 && mesDiff === 0 && diaDiff >= 0);

            if (!edadValida) {
                if(registerErrorRef) registerErrorRef.textContent = 'Debes ser mayor de 16 años para registrarte.';
                return;
            }

            try {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                console.log("[AUTH_DEBUG] Usuario registrado con Firebase Auth:", userCredential.user.uid);

                const userDocRef = doc(db, "usuarios", userCredential.user.uid);
                await setDoc(userDocRef, {
                    email: userCredential.user.email,
                    puntosFidelidad: 0, // Inicializar puntos en 0
                    fechaNacimiento: birthday, 
                    fechaRegistro: new Date()
                });
                console.log("[AUTH_DEBUG] Documento de usuario creado en Firestore para:", userCredential.user.uid);

                registerFormRef.reset();
                if(registerSuccessMessageRef) registerSuccessMessageRef.textContent = '¡Registro exitoso! Ahora puedes iniciar sesión.';
                setTimeout(() => {
                    limpiarMensajesRegistro();
                    if (registerFormContainerRef) registerFormContainerRef.style.display = 'none';
                    if (loginFormRef) loginFormRef.closest('.auth-form-container').style.display = 'block';
                }, 3000); 

            } catch (error) {
                console.error("[AUTH_DEBUG] Error DETALLADO de registro:", error);
                if(registerErrorRef) registerErrorRef.textContent = obtenerMensajeErrorFirebase(error);
            }
        });
    }

    // --- Listener para el formulario de Inicio de Sesión ---
    if (loginFormRef) {
        loginFormRef.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log("[AUTH_DEBUG] Intento de Inicio de Sesión...");
            const email = loginEmailInputRef.value.trim();
            const password = loginPasswordInputRef.value;

            limpiarMensajesLogin(); // Limpiar mensajes anteriores

            if (!email || !password) {
                if(loginErrorRef) loginErrorRef.textContent = 'Por favor, introduce tu correo y contraseña.';
                return;
            }

            try {
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                console.log("[AUTH_DEBUG] Usuario inició sesión con Firebase Auth:", userCredential.user.uid);
                loginFormRef.reset(); 
            } catch (error) {
                console.error("[AUTH_DEBUG] Error DETALLADO de inicio de sesión:", error);
                if(loginErrorRef) loginErrorRef.textContent = obtenerMensajeErrorFirebase(error);
            }
        });
    }

    // --- Listener para el botón de Cerrar Sesión ---
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
            console.log("[AUTH_DEBUG] Intento de Cerrar Sesión...");
            try {
                await signOut(auth);
                console.log("[AUTH_DEBUG] Usuario cerró sesión exitosamente.");
                mostrarPagina('pagina-promociones'); // Redirigir a promociones al cerrar sesión
            } catch (error) {
                console.error("[AUTH_DEBUG] Error al cerrar sesión:", error);
            }
        });
    }
    
    // --- Botón de simular punto ---
    const btnSimularPunto = document.getElementById('btnSimularPunto');
    if (btnSimularPunto) {
        btnSimularPunto.addEventListener('click', () => {
            if (currentUser) {
                console.log("[PUNTOS_DEBUG] Botón 'Simular Ganar Punto' clickeado, llamando a sumarPuntosFirebase(1)");
                sumarPuntosFirebase(1);
            } else {
                alert("Por favor, inicia sesión para acumular puntos.");
                console.warn("[PUNTOS_DEBUG] Intento de sumar puntos sin usuario (botón simular).");
            }
        });
    }
    
    // --- Listener para el botón de Canjear (AHORA USA LA FUNCIÓN DE FIREBASE) ---
    if (btnCanjearSalsaRef) {
        btnCanjearSalsaRef.addEventListener('click', canjearPremioSalsaFirebase); // Usamos la función de Firebase
    }

    // --- Inicializaciones y Estado Inicial ---
    inicializarMenu(); // Cargar el menú
    
    // Actualizar UI de autenticación (muestra/oculta botones de login/logout)
    actualizarUIAcceso(auth.currentUser ? true : false, auth.currentUser ? auth.currentUser.email : null);

    // Si no hay página activa y no hay usuario, mostrar promociones. Si hay usuario, mostrar puntos.
    const algunaPaginaActiva = document.querySelector('.pagina.active');
    if (!algunaPaginaActiva) {
        if (!currentUser) {
            mostrarPagina('pagina-promociones');
        } else {
            mostrarPagina('pagina-puntos');
        }
    }
    // Nota: La carga de puntos de Firebase se hace en onAuthStateChanged para asegurar que el usuario ya está autenticado.

    console.log("App de Fidelidad Fritsky (con Auth mejorado y Firebase) completamente iniciada desde DOMContentLoaded!");
});

// --- Funciones Auxiliares para Limpieza de Mensajes ---
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

// --- Función para obtener mensaje de error de Firebase ---
function obtenerMensajeErrorFirebase(error) {
    console.error("Código de error Firebase:", error.code, "Mensaje:", error.message); 
    switch (error.code) {
        case 'auth/email-already-in-use': 
            return 'Este correo electrónico ya está en uso. Intenta iniciar sesión o usa uno diferente.';
        case 'auth/invalid-email': 
            return 'El formato del correo electrónico no es válido.';
        case 'auth/operation-not-allowed': 
            return 'Esta operación no está permitida.';
        case 'auth/weak-password': 
            return 'La contraseña es demasiado débil. Usa una más segura.';
        case 'auth/user-not-found': 
            return 'No se encontró ningún usuario con este correo electrónico.';
        case 'auth/wrong-password': 
            return 'La contraseña ingresada es incorrecta.';
        case 'auth/invalid-credential': // Este es el que estaba dando el error genérico
            return 'Correo electrónico o contraseña incorrectos. Por favor, verifica tus datos.';
        case 'auth/too-many-requests': 
            return 'Demasiados intentos de inicio de sesión. Espera un momento o inténtalo más tarde.';
        case 'auth/network-request-failed': 
            return 'Fallo en la conexión. Revisa tu conexión a internet.';
        case 'auth/user-disabled': 
            return 'Esta cuenta de usuario ha sido deshabilitada.';
        case 'auth/popup-blocked': 
            return 'La ventana emergente se bloqueó. Permite las ventanas emergentes para este sitio.';
        case 'auth/cancelled-popup-request': 
            return 'La acción de inicio de sesión fue cancelada.';
        case 'auth/user-mismatch': 
            return 'No se pudo restablecer la contraseña. El usuario no coincide con el correo proporcionado.';
        case 'auth/session-cookie-expired': 
            return 'Tu sesión ha expirado. Por favor, inicia sesión de nuevo.';
        default: 
            // Si el error es desconocido, usamos el mensaje más específico que tengamos
            // o un mensaje genérico si el error.message no es útil.
            if (error.message && error.message.toLowerCase().includes('invalid-credential')) {
                return 'Correo electrónico o contraseña incorrectos. Por favor, verifica tus datos.';
            }
            return `Ocurrió un error desconocido: ${error.message || error.code}`;
    }
}

// --- FUNCIONES DE PUNTOS Y PREMIOS (AHORA 100% FIREBASE) ---

// Esta función ahora se llama desde cargarPuntosFirebase y sumarPuntosFirebase
// para asegurar que el botón siempre refleje el estado correcto basado en Firestore.
function actualizarEstadoBotonCanjearFirebase() {
    if (!btnCanjearSalsaRef) btnCanjearSalsaRef = document.getElementById('btnCanjearSalsa');
    if (btnCanjearSalsaRef) {
        btnCanjearSalsaRef.disabled = !currentUser || puntosActuales < PUNTOS_PARA_PREMIO;
        btnCanjearSalsaRef.textContent = `Canjear (${PUNTOS_PARA_PREMIO} puntos)`;
    }
}

// Carga los puntos del usuario desde Firestore y actualiza la UI
async function cargarPuntosFirebase() {
    if (!contadorPuntosSpanRef) contadorPuntosSpanRef = document.getElementById('contador-puntos');
    if (currentUser && contadorPuntosSpanRef) {
        try {
            console.log("[PUNTOS_DEBUG] Cargando puntos para UID:", currentUser.uid);
            const userDocRef = doc(db, "usuarios", currentUser.uid);
            const docSnap = await getDoc(userDocRef);
            if (docSnap.exists()) {
                const userData = docSnap.data();
                puntosActuales = userData.puntosFidelidad || 0; // Actualiza la variable global en memoria
                contadorPuntosSpanRef.textContent = puntosActuales;
                console.log("[PUNTOS_DEBUG] Puntos cargados desde Firestore:", puntosActuales);
            } else {
                console.log("[PUNTOS_DEBUG] No se encontró documento de usuario, estableciendo puntos a 0 y creando documento.");
                contadorPuntosSpanRef.textContent = '0';
                puntosActuales = 0; // Resetear variable en memoria
                await setDoc(userDocRef, { email: currentUser.email, puntosFidelidad: 0, fechaRegistro: new Date() });
            }
        } catch (error) {
            console.error("[PUNTOS_DEBUG] Error al cargar puntos desde Firestore:", error);
            if(contadorPuntosSpanRef) contadorPuntosSpanRef.textContent = 'Error';
            puntosActuales = 0; // En caso de error, reseteamos
        }
    } else if (contadorPuntosSpanRef) {
        console.log("[PUNTOS_DEBUG] No hay usuario conectado, puntos a 0 en UI.");
        contadorPuntosSpanRef.textContent = '0';
        puntosActuales = 0;
    }
    actualizarEstadoBotonCanjearFirebase(); // Actualiza el estado del botón después de cargar/resetear puntos
}

// Suma puntos al usuario en Firestore y actualiza la UI
async function sumarPuntosFirebase(cantidadASumar) {
    if (!currentUser) {
        console.warn("[PUNTOS_DEBUG] Intento de sumar puntos sin usuario conectado.");
        alert("Debes iniciar sesión para sumar puntos.");
        return;
    }

    console.log(`[PUNTOS_DEBUG] Intentando sumar ${cantidadASumar} puntos para UID: ${currentUser.uid}`);
    const userDocRef = doc(db, "usuarios", currentUser.uid);

    try {
        const docSnap = await getDoc(userDocRef);
        let puntosActualesEnDb = 0;

        if (docSnap.exists()) {
            puntosActualesEnDb = docSnap.data().puntosFidelidad || 0;
        } else {
            console.warn("[PUNTOS_DEBUG] Documento de usuario no encontrado al intentar sumar puntos. Creando uno nuevo.");
            await setDoc(userDocRef, { email: currentUser.email, puntosFidelidad: 0, fechaRegistro: new Date() });
        }

        const nuevosPuntos = puntosActualesEnDb + cantidadASumar;

        await updateDoc(userDocRef, {
            puntosFidelidad: nuevosPuntos
        });

        console.log(`[PUNTOS_DEBUG] Puntos actualizados en Firestore a: ${nuevosPuntos}`);
        
        puntosActuales = nuevosPuntos; // Actualiza la variable global en memoria
        
        // Actualizar UI y botón
        if (contadorPuntosSpanRef) contadorPuntosSpanRef.textContent = puntosActuales;
        actualizarEstadoBotonCanjearFirebase();

    } catch (error) {
        console.error("[PUNTOS_DEBUG] Error al sumar puntos en Firestore:", error);
        alert("Hubo un error al actualizar tus puntos. Inténtalo de nuevo.");
    }
}

// Canjea un premio restando puntos en Firestore y actualizando la UI
async function canjearPremioSalsaFirebase() {
    if (!currentUser) {
        alert('Debes iniciar sesión para canjear premios.');
        return;
    }

    if (puntosActuales < PUNTOS_PARA_PREMIO) {
        alert(`No tienes suficientes puntos. Necesitas ${PUNTOS_PARA_PREMIO} puntos y tienes ${puntosActuales}.`);
        return;
    }

    const userDocRef = doc(db, "usuarios", currentUser.uid);

    try {
        const nuevosPuntos = puntosActuales - PUNTOS_PARA_PREMIO;

        await updateDoc(userDocRef, {
            puntosFidelidad: nuevosPuntos
        });

        console.log(`[PREMIO_DEBUG] Canjeado premio. Puntos actualizados en Firestore a: ${nuevosPuntos}`);

        puntosActuales = nuevosPuntos; // Actualiza la variable global en memoria
        
        // Actualizar UI y botón
        if (contadorPuntosSpanRef) contadorPuntosSpanRef.textContent = puntosActuales;
        actualizarEstadoBotonCanjearFirebase();

        alert('¡Felicidades! Has canjeado tu Salsa Especial Gratis.');

    } catch (error) {
        console.error("[PREMIO_DEBUG] Error al canjear premio en Firestore:", error);
        alert("Hubo un error al canjear tu premio. Por favor, inténtalo de nuevo.");
    }
}

// --- FUNCIÓN PARA GENERAR EL QR CODE DEL CLIENTE ---
// --- FUNCIÓN PARA GENERAR EL QR CODE DEL CLIENTE (con carga dinámica) ---
function generarMiQRCode() {
    console.log("[QR_DEBUG] Entrando en generarMiQRCode()");
    const qrcodeContainer = document.getElementById('qrcode-container');
    const qrMessage = document.getElementById('qrMessage');

    if (!qrcodeContainer) {
        console.error("[QR_DEBUG] Error: qrcode-container no encontrado.");
        return;
    }

    console.log("[QR_DEBUG] Estado de currentUser:", currentUser);
    if (!currentUser) {
        if (qrMessage) qrMessage.textContent = "Por favor, inicia sesión para ver tu código QR.";
        qrcodeContainer.innerHTML = ''; // Limpiar si el usuario se desconecta
        console.log("[QR_DEBUG] currentUser es null, no se genera QR.");
        return;
    }

    const qrData = `fritsky_user:${currentUser.uid}`; 
    qrcodeContainer.innerHTML = ''; // Limpiar contenedor anterior

    // Función para cargar dinámicamente la librería qrcode.js
    const loadQRCodeLib = (callback) => {
        // Si ya está definida, la usamos inmediatamente
        if (typeof QRCode !== 'undefined') {
            console.log("[QR_LOAD] qrcode.js ya cargado.");
            callback();
            return;
        }

        console.log("[QR_LOAD] Cargando qrcode.js dinámicamente...");
        const script = document.createElement('script');
        script.src = '/js/qrcode.min.js'; // ¡ASEGÚRATE DE QUE ESTA RUTA SEA CORRECTA!
        script.onload = () => {
            console.log("[QR_LOAD] qrcode.js cargado exitosamente.");
            callback();
        };
        script.onerror = (err) => {
            console.error("[QR_LOAD] Error al cargar qrcode.js:", err);
            if (qrMessage) qrMessage.textContent = "Error al cargar la librería QR. Inténtalo de nuevo.";
        };
        document.head.appendChild(script);
    };

    // Función que intenta generar el QR una vez que la librería está lista
    const attemptQRCodeGeneration = () => {
        if (typeof QRCode !== 'undefined') {
            try {
                console.log("[QR_DEBUG] QRCode definido. Generando para:", qrData);
                const qrCode = new QRCode(qrcodeContainer, {
                    text: qrData,
                    width: 200,
                    height: 200,
                    colorDark : "#000000", // Color negro para el QR
                    colorLight : "#ffffff", // Fondo blanco
                    correctLevel : QRCode.CorrectLevel.H // Nivel de corrección de errores (H es el más alto)
                });
    
                if (qrMessage) qrMessage.textContent = "Escanea este código en el punto de venta.";
                console.log(`[QR_DEBUG] QR Code generado para el usuario ${currentUser.uid} con datos: ${qrData}`);
    
            } catch (error) {
                console.error("[QR_DEBUG] Error al generar el QR Code:", error);
                if (qrMessage) qrMessage.textContent = "No se pudo generar el código QR. Inténtalo de nuevo.";
            }
        } else {
            // SiQRCode aún no está definido, volvemos a intentar después de 100ms
            console.warn("[QR_GENERATION_WAIT] QRCode no definido, reintentando en 100ms...");
            setTimeout(attemptQRCodeGeneration, 100); 
        }
    };

    // Primero cargamos la librería y luego intentamos generar el QR
    loadQRCodeLib(attemptQRCodeGeneration);
}