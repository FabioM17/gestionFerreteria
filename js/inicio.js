/**
 * inicio.js
 * Logica del panel principal
 */

/** Preparar la pagina: verifica la sesion, dibuja el men y ajusta segun el rol */

async function iniciarPagina() {
    const perfil = await protegerPagina();
    if (perfil === null) {
        return; //Sin sesion: protegerPagina() ya redirige a login.html 
    }

    mostrarMenu('inicio', 'Panel Principal', perfil);

    //El cajero no tiene acceso a Reportes: ocultamos tarjeta
    if (!esAdministrador(perfil)) {
        document.getElementById('tarjetaReportes').classList.add('d-none');
    }
}

iniciarPagina();