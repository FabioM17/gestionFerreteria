/**
 * usuarios.js
 * Módulo de usuarios del sistema (solo Administrador).
 * Los usuarios se crean con la función "crear-usuario" de Supabase,
 * porque crear cuentas necesita la llave secreta y esa no puede estar en el navegador.
 */

// ---------- Datos de la página ----------
let usuarios = [];        // Perfiles cargados desde Supabase
let perfilActual = null;  // Administrador que tiene la sesión abierta

// Campos del formulario, en el orden en que aparecen
const CAMPOS_USUARIO = ['nombreEmpleado', 'correoEmpleado', 'rolEmpleado', 'claveEmpleado', 'confirmarClave'];

// Reglas de validación
const FORMATO_CORREO_USUARIO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LARGO_MINIMO_CLAVE = 8;

// ---------- Referencias a elementos ----------
const tablaUsuarios = document.getElementById('tablaUsuarios');
const contador = document.getElementById('contador');
const formUsuario = document.getElementById('formUsuario');
const alertaUsuario = document.getElementById('alertaUsuario');
const botonGuardar = document.getElementById('botonGuardarUsuario');
const ventanaUsuario = new bootstrap.Modal(document.getElementById('modalUsuario'));

/** Prepara la página: sesión, permiso de administrador y lista de usuarios. */
async function iniciarPagina() {
  const perfil = await protegerPagina();
  if (perfil === null) {
    return;
  }

  // Solo el Administrador puede ver y crear usuarios
  if (!esAdministrador(perfil)) {
    location.replace('inicio.html');
    return;
  }

  mostrarMenu('usuarios', 'Usuarios', perfil);
  perfilActual = perfil;

  await cargarUsuarios();
}

//Lista de usuarios

/** Consulta los perfiles en Supabase y los muestra en la tabla. */
async function cargarUsuarios() {
  mostrarMensajeTabla('Cargando usuarios…');

  const { data, error } = await db
    .from('perfiles')
    .select('id, nombre, correo, rol')
    .order('nombre');

  if (error) {
    console.error('Error al cargar los usuarios:', error);
    mostrarMensajeTabla('No se pudieron cargar los usuarios. Revisa tu conexión y recarga la página.');
    return;
  }

  usuarios = data;
  mostrarUsuarios();
}

/**
 * Muestra un mensaje que ocupa toda la tabla (cargando o error).
 * @param {string} mensaje
 */
function mostrarMensajeTabla(mensaje) {
  tablaUsuarios.innerHTML = `
    <tr><td colspan="3" class="text-center text-secondary py-5">${mensaje}</td></tr>`;
  contador.textContent = '';
}

/** Dibuja una fila por cada usuario. */
function mostrarUsuarios() {
  let filas = '';        // Acumulador con el HTML de las filas
  let administradores = 0;  // Contadores por rol
  let cajeros = 0;

  for (let i = 0; i < usuarios.length; i++) {
    const usuario = usuarios[i];
    const esAdmin = usuario.rol === 'Administrador';
    const esYo = usuario.id === perfilActual.id;

    if (esAdmin) {
      administradores = administradores + 1;
    } else {
      cajeros = cajeros + 1;
    }

    filas += `
      <tr>
        <td>
          <span class="fw-semibold">${escaparHTML(usuario.nombre)}</span>
          ${esYo ? '<span class="badge text-bg-light border ms-1">Tú</span>' : ''}
        </td>
        <td>${usuario.correo ? escaparHTML(usuario.correo) : '<span class="text-secondary">—</span>'}</td>
        <td>
          <span class="badge ${esAdmin ? 'text-bg-dark' : 'text-bg-secondary'}">
            <i class="bi ${esAdmin ? 'bi-shield-lock' : 'bi-cash-coin'}" aria-hidden="true"></i>
            ${escaparHTML(usuario.rol)}
          </span>
        </td>
      </tr>`;
  }

  tablaUsuarios.innerHTML = filas;
  contador.textContent = `${usuarios.length} usuarios: ${administradores} administrador(es) y ${cajeros} cajero(s)`;
}

//Formulario nuevo usuario

/** Lee los valores del formulario y los devuelve en un objeto. */
function leerFormulario() {
  return {
    nombre: document.getElementById('nombreEmpleado').value.trim(),
    correo: document.getElementById('correoEmpleado').value.trim().toLowerCase(),
    rol: document.getElementById('rolEmpleado').value,
    clave: document.getElementById('claveEmpleado').value,
    confirmar: document.getElementById('confirmarClave').value
  };
}

/**
 * Valida los datos del usuario nuevo (requerimiento 2).
 * La función de Supabase vuelve a validar todo por seguridad.
 * @param {object} datos - lo que devuelve leerFormulario().
 * @returns {object} un mensaje por cada campo con error (vacío si todo está bien).
 */
function validarUsuario(datos) {
  const errores = {};

  if (datos.nombre.length < 3) {
    errores.nombreEmpleado = 'Escribe el nombre del empleado (mínimo 3 letras).';
  }

  if (datos.correo === '') {
    errores.correoEmpleado = 'Escribe el correo del empleado.';
  } else if (!FORMATO_CORREO_USUARIO.test(datos.correo)) {
    errores.correoEmpleado = 'Escribe un correo válido. Ejemplo: caja2@eltornillo.com';
  } else {
    // El correo no puede repetirse
    for (let i = 0; i < usuarios.length; i++) {
      if (usuarios[i].correo === datos.correo) {
        errores.correoEmpleado = 'Ya existe un usuario con este correo.';
        break;
      }
    }
  }

  if (datos.rol !== 'Administrador' && datos.rol !== 'Cajero') {
    errores.rolEmpleado = 'Elige un rol.';
  }

  // La contraseña debe tener el largo mínimo y al menos una letra y un número
  const tieneLetra = /[a-zA-Z]/.test(datos.clave);
  const tieneNumero = /\d/.test(datos.clave);
  if (datos.clave.length < LARGO_MINIMO_CLAVE || !tieneLetra || !tieneNumero) {
    errores.claveEmpleado = `Usa al menos ${LARGO_MINIMO_CLAVE} caracteres, con letras y números.`;
  }

  if (datos.confirmar !== datos.clave) {
    errores.confirmarClave = 'Las contraseñas no coinciden.';
  }

  return errores;
}

/**
 * Marca en rojo los campos con error y muestra su mensaje.
 * @param {object} errores - lo que devuelve validarUsuario().
 */
function mostrarErrores(errores) {
  let primerError = null;

  for (let i = 0; i < CAMPOS_USUARIO.length; i++) {
    const campo = CAMPOS_USUARIO[i];
    const mensaje = errores[campo];
    const elemento = document.getElementById(campo);

    if (mensaje) {
      elemento.classList.add('is-invalid');
      document.getElementById('error-' + campo).textContent = mensaje;
      if (primerError === null) {
        primerError = elemento;
      }
    } else {
      elemento.classList.remove('is-invalid');
    }
  }

  if (primerError !== null) {
    primerError.focus();
  }
}

/**
 * Muestra un error general arriba del formulario.
 * @param {string} mensaje - '' para ocultarlo.
 */
function mostrarAlerta(mensaje) {
  alertaUsuario.textContent = mensaje;
  alertaUsuario.classList.toggle('d-none', mensaje === '');
}

/** Abre la ventana con el formulario vacío. */
function abrirFormulario() {
  formUsuario.reset();       // El rol vuelve a "Cajero", el más común
  mostrarErrores({});
  mostrarAlerta('');
  ventanaUsuario.show();
}

/**
 * Llama a la función "crear-usuario" de Supabase.
 * @param {object} datos - datos ya validados.
 * @returns {Promise<string|null>} el mensaje de error, o null si se creó.
 */
async function crearUsuario(datos) {
  // functions.invoke envía también la sesión del administrador,
  // así la función puede comprobar quién la está llamando
  const { error } = await db.functions.invoke('crear-usuario', {
    body: { nombre: datos.nombre, correo: datos.correo, rol: datos.rol, clave: datos.clave }
  });

  if (error === null) {
    return null;
  }

  console.error('Error al crear el usuario:', error);

  // Si la función respondió con un error, su mensaje viene en la respuesta
  if (error.context && typeof error.context.json === 'function') {
    try {
      const respuesta = await error.context.json();
      if (respuesta.error) {
        return respuesta.error;
      }
    } catch (e) {
      // La respuesta no era JSON: usamos el mensaje general de abajo
    }
  }

  return 'No se pudo crear el usuario. Revisa tu conexión e intenta de nuevo.';
}

// ---------- Eventos ----------

// Botón "Nuevo usuario"
document.getElementById('botonNuevoUsuario').addEventListener('click', abrirFormulario);

// Al abrir la ventana, el cursor va al primer campo
document.getElementById('modalUsuario').addEventListener('shown.bs.modal', function () {
  document.getElementById('nombreEmpleado').focus();
});

// Envío del formulario
formUsuario.addEventListener('submit', async function (evento) {
  evento.preventDefault();
  mostrarAlerta('');

  const datos = leerFormulario();
  const errores = validarUsuario(datos);
  mostrarErrores(errores);

  if (Object.keys(errores).length > 0) {
    return;
  }

  botonGuardar.disabled = true;
  botonGuardar.textContent = 'Creando…';

  const mensajeError = await crearUsuario(datos);

  botonGuardar.disabled = false;
  botonGuardar.textContent = 'Crear usuario';

  if (mensajeError !== null) {
    // Si el problema es el correo, se marca en su campo; si no, arriba del formulario
    if (mensajeError.includes('correo')) {
      mostrarErrores({ correoEmpleado: mensajeError });
    } else {
      mostrarAlerta(mensajeError);
    }
    return;
  }

  ventanaUsuario.hide();
  mostrarAviso(`Usuario creado. ${datos.nombre} ya puede iniciar sesión con ${datos.correo}.`);
  await cargarUsuarios();
});

iniciarPagina();