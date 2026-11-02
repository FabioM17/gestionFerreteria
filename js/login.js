/**
 * login.js
 * Logica de la pantalla de inicio de sesion.
 */

//Referencia a los elementos de la pagina
const formLogin = document.getElementById('formLogin');
const campoCorreo = document.getElementById('correo');
const campoClave = document.getElementById('clave');
const alertaLogin = document.getElementById('alertaLogin');
const botonVerClave = document.getElementById('verClave');
const botonEntrar = document.getElementById('botonEntrar');

//Formato basico de correo: texto@texto.text (sin espacios)
const FORMATO_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Muestra mensaje de eerror arriba del formulario
 * @param {string} mensaje
 */

function mostrarError(mensaje) { 
    alertaLogin.textContent = mensaje;
    alertaLogin.classList.remove('d-none');
}

/**
 * Bloquea o desbloquea el boton mientras se espera a Supabase
 * @param {boolean} esperando
 */

function indicarEspera(esperando) { 
    botonEntrar.disabled = esperando;
    botonEntrar.textContent = esperando ? 'Verificando...' : 'Iniciar sesión';
}

/** Si hay una sesión activa, pasa directo al panel principal */
async function revisarSesionAbierta() {
    const perfil = await obtenerPerfil();
    if (perfil !== null) {
        location.replace('inicio.html'); 
    }
}

//Evento: cuando se envia el formulario
formLogin.addEventListener('submit', async function (evento) {
    evento.preventDefault(); //Evita que se recargue la pagina

    const correo = campoCorreo.value.trim();
    const clave = campoClave.value;

    //Validacion 1: Campos vacios (Operador Logico ||)
    if (correo === '' || clave === '') {
        mostrarError('Por favor, completa todos los campos.');
        return;
    }

    if (!FORMATO_CORREO.test(correo)) {
        mostrarError('Por favor, ingresa un correo electrónico válido.');
        campoCorreo.focus();
        return;
    }

    indicarEspera(true); //Bloquea el boton
    const error = await iniciarSesion(correo, clave); //Llamada a Supabase

    if (error === null) {
        location.replace('inicio.html'); //Redirige al panel principal
        return;
    }

    indicarEspera(false); //Desbloquea el boton
    mostrarError(error);
    campoClave.value = ''; //Limpia el campo de clave
    campoClave.focus(); //Pone el foco en el campo de clave
});

//Evento: mostrar u ocultar la cotnraseña con el boton de ojo
botonVerClave.addEventListener('click', function () {
    const estaOculta = campoClave.type === 'password';

    campoClave.type = estaOculta ? 'text' : 'password';
    botonVerClave.setAttribute('aria-label', estaOculta ? 'Ocultar contraseña' : 'Mostrar contraseña');
    botonVerClave.innerHTML = estaOculta ? '<i class="bi bi-eye-slash" aria-hidden="true"></i>' : '<i class="bi bi-eye" aria-hidden="true"></i>';
});

//Al abrir la pagina
revisarSesionAbierta();

