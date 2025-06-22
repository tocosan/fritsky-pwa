document.addEventListener('DOMContentLoaded', () => {
    // --- REFERENCIAS A ELEMENTOS DEL DOM ---
    const contadorPuntosSpan = document.getElementById('contador-puntos');
    const promocionesSection = document.getElementById('promociones'); // Para futuras promos dinámicas
    const premiosSection = document.getElementById('premios');

    // --- VARIABLES DE ESTADO ---
    let puntosActuales = 0;
    const PUNTOS_PARA_PREMIO = 10; // Puntos necesarios para el premio de salsa

    // --- FUNCIONES ---

    // Función para actualizar la visualización de puntos en el HTML
    function actualizarVistaPuntos() {
        if (contadorPuntosSpan) {
            contadorPuntosSpan.textContent = puntosActuales;
        }
        actualizarEstadoBotonPremio();
    }

    // Función para guardar los puntos en localStorage
    function guardarPuntos() {
        localStorage.setItem('fritskyPuntos', puntosActuales.toString());
    }

    // Función para cargar los puntos desde localStorage al iniciar la app
    function cargarPuntos() {
        const puntosGuardados = localStorage.getItem('fritskyPuntos');
        if (puntosGuardados !== null) {
            puntosActuales = parseInt(puntosGuardados, 10);
        }
        actualizarVistaPuntos();
    }

    // Función para añadir un punto (o los que sean)
    function sumarPuntos(cantidad) {
        puntosActuales += cantidad;
        console.log(`Puntos añadidos: ${cantidad}. Total actual: ${puntosActuales}`);
        guardarPuntos();
        actualizarVistaPuntos();
        // Podrías añadir una pequeña animación o feedback visual aquí
    }

    // Función para actualizar el estado del botón de canjear premio
    function actualizarEstadoBotonPremio() {
        const botonCanjearSalsa = premiosSection.querySelector('button'); // Asumimos que es el primer botón
        if (botonCanjearSalsa) {
            if (puntosActuales >= PUNTOS_PARA_PREMIO) {
                botonCanjearSalsa.disabled = false;
                botonCanjearSalsa.textContent = `Canjear (${PUNTOS_PARA_PREMIO} puntos)`;
            } else {
                botonCanjearSalsa.disabled = true;
                botonCanjearSalsa.textContent = `Canjear (${PUNTOS_PARA_PREMIO} puntos)`;
            }
        }
    }

    // Función para canjear el premio de la salsa
    function canjearPremioSalsa() {
        if (puntosActuales >= PUNTOS_PARA_PREMIO) {
            puntosActuales -= PUNTOS_PARA_PREMIO;
            guardarPuntos();
            actualizarVistaPuntos();
            alert('¡Felicidades! Has canjeado tu Salsa Especial Gratis. Muestra este mensaje al personal.');
            // Aquí podrías añadir lógica para registrar el canje si tuvieras un backend
        } else {
            alert('No tienes suficientes puntos para canjear este premio.');
        }
    }

    // --- INICIALIZACIÓN Y EVENT LISTENERS ---

    // Cargar los puntos guardados cuando la página esté lista
    cargarPuntos();

    // Crear y añadir un botón para "Simular Ganar Punto" (solo para desarrollo/demo)
    // Esto lo podrías quitar o adaptar en una versión de producción
    const botonSimularGanarPunto = document.createElement('button');
    botonSimularGanarPunto.textContent = "Simular Ganar 1 Fritsky-Punto";
    botonSimularGanarPunto.id = "btnSimularPunto";
    botonSimularGanarPunto.style.marginTop = "10px"; // Un poco de espacio
    
    // Intentar añadir el botón dentro de la sección de puntos
    const seccionPuntos = document.getElementById('puntos');
    if (seccionPuntos) {
        seccionPuntos.appendChild(botonSimularGanarPunto);
        botonSimularGanarPunto.addEventListener('click', () => {
            sumarPuntos(1); // Suma 1 punto al hacer clic
        });
    } else {
        console.error("No se encontró la sección #puntos para añadir el botón de simulación.");
    }


    // Añadir Event Listener al botón de canjear premio (si existe)
    const botonCanjearSalsa = premiosSection.querySelector('button');
    if (botonCanjearSalsa) {
        botonCanjearSalsa.addEventListener('click', canjearPremioSalsa);
    }

    // (Opcional) Ejemplo de cómo podrías cargar promociones dinámicamente en el futuro
    function cargarPromocionesDinamicas() {
        const promos = [
            // { titulo: "Nueva promo desde JS!", descripcion: "Descripción de la promo." }
        ];
        const contenedorPromos = promocionesSection.querySelector('.promo-item')?.parentNode || promocionesSection; // Para añadir al final de las promos o de la sección

        promos.forEach(promo => {
            const divPromo = document.createElement('div');
            divPromo.classList.add('promo-item');
            divPromo.innerHTML = `<h3>${promo.titulo}</h3><p>${promo.descripcion}</p>`;
            contenedorPromos.appendChild(divPromo);
        });
    }
    // cargarPromocionesDinamicas(); // Descomenta para probar si añades promos en el array


    console.log("App de Fidelidad Fritsky iniciada!");
});