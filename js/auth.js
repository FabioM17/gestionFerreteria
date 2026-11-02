/**
 * auth.js
 * Manejo de la sesión del usuario con Supabase Auth.
 * Todas las funciones son asíncronas (async) porque consultan
 * la base de datos por internet y hay que esperar la respuesta.
 */

/**
 * Inicia sesión con correo y contraseña.
 * @param {string} correo
 * @param {string} clave
 * @returns {Promise<string|null>} null si todo salió bien, o el mensaje de error.
 */

async function iniciarSesion(correo, clave) {
    const { error } = await db.auth.signInWithPassword({ email: correo, password: clave });

    if (error) {
        //Datos incorrectos supabase responde con el codigo 'invalid credentials'
        if (error.code === 'invalid_credentials' || error.status === 400) {
            return 'Correo o contraseña incorrectos. Revisa los datos e inventa de nuevo.';
        }
        //Cualquier otro error
        return 'No se pudo conectar con el servidor. Revisa tu conexión a internet e intenta de nuevo.';
    }


    //El usuario existe, pero ademas debe tener nombre y rol en "perfiles"

    const perfil = await obtenerPerfil();
    if (perfil === null) {
        await db.auth.signOut();
        return 'Tu usuario no tiene un perfil asignado. Contacta al administrador del sistema.';
    }

    return null; //Todo salió bien
}

/**
 * Devuelve los datos del usuario conectado (nombre y rol)
 *  @returns {Promise<object|null>} el perfil, o null si no hay sesion.
 */

async function obtenerPerfil() {
    const { data } = await db.auth.getSession();
    const sesion = data.session;

    if (sesion === null) {
        return null; //No hay sesion
    }

    //Buscamos el nombre y el rol en la tabla de perfiles
    const { data: perfil, error } = await db
        .from('perfiles')
        .select('nombre, rol')
        .eq('id', sesion.user.id)
        .maybeSingle();

    if (error || perfil === null) {
        return null; //No hay perfil
    }

    return {
        id: sesion.user.id,
        correo: sesion.user.email,
        nombre: perfil.nombre,
        rol: perfil.rol
    };
}

/**
 * Indica si un perfil es de administrador
 * @param {object} perfil
 * @returns {boolean}
 */

function esAdministrador(perfil) {
    return perfil !== null && perfil.rol === 'Administrador';
}

/**
 * Protege una pagina interna: si nadie inicio sesion, regresa al login.
 * Se llama al inicio de cada pagina del sistema (todas menos el login).
 * @returns {Promise<object|null<} el perfil del usuario, o null si no hay sesion.
 */

async function protegerPagina() {
    const perfil = await obtenerPerfil();
    if (perfil === null) {
        location.replace('index.html'); //Redirige al login
    }

    return perfil; //Devuelve el perfil del usuario conectado
}

/** Cierra la sesion y regresa al login */

async function cerrarSesion() {
    await db.auth.signOut();
    location.replace('index.html'); //Redirige al login
}