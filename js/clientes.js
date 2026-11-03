/**
 * clientes.js
 * Módulo de clientes: listado, búsqueda, registro, edición y eliminación.
 * Requerimientos: 1 (registro), 2 (validación de DUI, edad y teléfono), 3 (búsqueda).
 */

// ---------- Datos de la página ----------
let clientes = [];             // Lista de clientes cargada desde Supabase
let idEditando = null;         // id del cliente que se edita (null = cliente nuevo)
let clienteEliminando = null;  // Cliente que se va a eliminar (espera confirmación)
let esAdmin = false;           // true si el usuario conectado es administrador

// Campos del formulario, en el orden en que aparecen
const CAMPOS = ['nombreCliente', 'dui', 'fechaNacimiento', 'telefono', 'correo', 'direccion'];

// Formatos válidos
const FORMATO_DUI = /^\d{8}-\d$/;                          // 00000000-0
const FORMATO_TELEFONO = /^[267]\d{3}-\d{4}$/;            // 2xxx, 6xxx o 7xxx en El Salvador
const FORMATO_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Límites de edad para registrar un cliente
const EDAD_MINIMA = 18;
const EDAD_MAXIMA = 120;

// ---------- Referencias a elementos ----------
const tablaClientes = document.getElementById('tablaClientes');
const contador = document.getElementById('contador');
const buscarCliente = document.getElementById('buscarCliente');
const formCliente = document.getElementById('formCliente');
const alertaCliente = document.getElementById('alertaCliente');
const botonGuardar = document.getElementById('botonGuardarCliente');
const campoDui = document.getElementById('dui');
const campoTelefono = document.getElementById('telefono');
const campoFecha = document.getElementById('fechaNacimiento');
const edadCalculada = document.getElementById('edadCalculada');
const ventanaCliente = new bootstrap.Modal(document.getElementById('modalCliente'));
const ventanaEliminar = new bootstrap.Modal(document.getElementById('modalEliminarCliente'));
const alertaEliminar = document.getElementById('alertaEliminarCliente');
const botonConfirmarEliminar = document.getElementById('botonConfirmarEliminarCliente');

/** Prepara la página: sesión, menú, permisos y carga de datos. */
async function iniciarPagina() {
  const perfil = await protegerPagina();
  if (perfil === null) {
    return;
  }

  mostrarMenu('clientes', 'Clientes', perfil);
  esAdmin = esAdministrador(perfil);

  // No se puede registrar a alguien con fecha de nacimiento en el futuro
  campoFecha.max = fechaISO(new Date());

  await cargarClientes();
}

//Listado y Busqueda

/** Consulta los clientes en Supabase y los muestra en la tabla. */
async function cargarClientes() {
  mostrarMensajeTabla('Cargando clientes…');

  const { data, error } = await db
    .from('clientes')
    .select('id, nombre, dui, fecha_nacimiento, telefono, correo, direccion')
    .order('nombre');

  if (error) {
    console.error('Error al cargar clientes:', error);
    mostrarMensajeTabla('No se pudieron cargar los clientes. Revisa tu conexión y recarga la página.');
    return;
  }

  clientes = data;
  filtrarClientes();
}

/**
 * Muestra un mensaje que ocupa toda la tabla (cargando, error o sin resultados).
 * @param {string} mensaje
 */
function mostrarMensajeTabla(mensaje) {
  tablaClientes.innerHTML = `
    <tr>
      <td colspan="6" class="text-center text-secondary py-5">${mensaje}</td>
    </tr>`;
  contador.textContent = '';
}

/**
 * Indica si un cliente es el registro genérico "Consumidor final".
 * Es el único cliente sin DUI.
 * @param {object} cliente
 * @returns {boolean}
 */
function esConsumidorFinal(cliente) {
  return cliente.dui === null;
}

/** Busca clientes por nombre, DUI o teléfono (requerimiento 3). */
function filtrarClientes() {
  const texto = normalizar(buscarCliente.value.trim());
  const resultado = [];

  // Estructura repetitiva: revisamos cliente por cliente
  for (let i = 0; i < clientes.length; i++) {
    const cliente = clientes[i];

    // Sin texto de búsqueda, se muestran todos
    if (texto === '') {
      resultado.push(cliente);
      continue;
    }

    // Comparaciones: ¿el texto aparece en el nombre, el DUI o el teléfono?
    const coincideNombre = normalizar(cliente.nombre).includes(texto);
    const coincideDui = cliente.dui !== null && cliente.dui.includes(texto);
    const coincideTelefono = cliente.telefono !== null && cliente.telefono.includes(texto);

    if (coincideNombre || coincideDui || coincideTelefono) {
      resultado.push(cliente);
    }
  }

  mostrarClientes(resultado);
}

/**
 * Dibuja las filas de la tabla con una lista de clientes.
 * @param {Array} lista
 */
function mostrarClientes(lista) {
  if (lista.length === 0) {
    const mensaje = buscarCliente.value.trim() === ''
      ? 'No hay clientes registrados.'
      : 'No se encontraron clientes con esa búsqueda.';
    mostrarMensajeTabla(mensaje);
    return;
  }

  let filas = ''; // Acumulador con el HTML de todas las filas

  for (let i = 0; i < lista.length; i++) {
    const cliente = lista[i];
    const nombre = escaparHTML(cliente.nombre);

    // El "Consumidor final" no se edita ni se elimina
    let acciones = '';
    if (esConsumidorFinal(cliente)) {
      acciones = '<span class="badge text-bg-light">Cliente general</span>';
    } else {
      acciones = `
        <button type="button" class="btn btn-sm btn-outline-secondary" data-accion="editar"
                data-id="${cliente.id}" aria-label="Editar a ${nombre}">
          <i class="bi bi-pencil" aria-hidden="true"></i>
        </button>`;
      if (esAdmin) {
        acciones += `
        <button type="button" class="btn btn-sm btn-outline-danger" data-accion="eliminar"
                data-id="${cliente.id}" aria-label="Eliminar a ${nombre}">
          <i class="bi bi-trash" aria-hidden="true"></i>
        </button>`;
      }
    }

    const edad = cliente.fecha_nacimiento ? calcularEdad(cliente.fecha_nacimiento) + ' años' : '—';
    const direccion = cliente.direccion
      ? `<small class="text-secondary d-block">${escaparHTML(cliente.direccion)}</small>`
      : '';

    filas += `
      <tr>
        <td>
          <div class="fw-semibold">${nombre}</div>
          ${direccion}
        </td>
        <td class="codigo">${cliente.dui ? escaparHTML(cliente.dui) : '—'}</td>
        <td class="text-end text-nowrap">${edad}</td>
        <td class="text-nowrap">${cliente.telefono ? escaparHTML(cliente.telefono) : '—'}</td>
        <td>${cliente.correo ? escaparHTML(cliente.correo) : '—'}</td>
        <td class="text-end text-nowrap">${acciones}</td>
      </tr>`;
  }

  tablaClientes.innerHTML = filas;
  contador.textContent = `Mostrando ${lista.length} de ${clientes.length} clientes`;
}

//Calculos y Formatos

/**
 * Calcula la edad en años a partir de la fecha de nacimiento.
 * @param {string} fechaTexto - en formato AAAA-MM-DD.
 * @returns {number}
 */
function calcularEdad(fechaTexto) {
  const partes = fechaTexto.split('-');           // '1990-05-14' → ['1990', '05', '14']
  const anio = Number(partes[0]);
  const mes = Number(partes[1]);
  const dia = Number(partes[2]);
  const hoy = new Date();

  let edad = hoy.getFullYear() - anio;

  // Si este año todavía no llega su cumpleaños, se le resta un año
  const mesActual = hoy.getMonth() + 1;            // getMonth() cuenta desde 0
  if (mesActual < mes || (mesActual === mes && hoy.getDate() < dia)) {
    edad = edad - 1;
  }

  return edad;
}

/**
 * Revisa el dígito verificador del DUI (el número después del guion).
 * Cada uno de los 8 primeros dígitos se multiplica por un peso (9, 8, 7... 2),
 * se suman los resultados y el verificador debe ser: (10 - suma % 10) % 10.
 * @param {string} dui - con formato 00000000-0.
 * @returns {boolean}
 */
function duiEsValido(dui) {
  let suma = 0; // Acumulador

  for (let i = 0; i < 8; i++) {
    const digito = Number(dui[i]);
    const peso = 9 - i;
    suma = suma + digito * peso;
  }

  // Jerarquía de operaciones: primero el residuo (%), luego la resta, luego el residuo final
  const verificadorEsperado = (10 - (suma % 10)) % 10;
  const verificadorEscrito = Number(dui[9]);

  return verificadorEscrito === verificadorEsperado;
}

/**
 * Deja solo los números de un texto y coloca el guion en la posición indicada.
 * Ejemplo: ('045123453', 8, 9) → '04512345-3'
 * @param {string} texto
 * @param {number} posicionGuion - cuántos dígitos van antes del guion.
 * @param {number} totalDigitos - cuántos dígitos se aceptan en total.
 * @returns {string}
 */
function formatearConGuion(texto, posicionGuion, totalDigitos) {
  const digitos = texto.replace(/\D/g, '').substring(0, totalDigitos); // \D = todo lo que no es dígito
  if (digitos.length <= posicionGuion) {
    return digitos;
  }
  return digitos.substring(0, posicionGuion) + '-' + digitos.substring(posicionGuion);
}

//Agregar y editar cliente
/** Lee los valores del formulario y los devuelve en un objeto. */
function leerFormulario() {
  return {
    nombreCliente: document.getElementById('nombreCliente').value.trim(),
    dui: campoDui.value.trim(),
    fechaNacimiento: campoFecha.value,
    telefono: campoTelefono.value.trim(),
    correo: document.getElementById('correo').value.trim(),
    direccion: document.getElementById('direccion').value.trim()
  };
}

/**
 * Valida los datos del cliente (requerimiento 2).
 * @param {object} datos - lo que devuelve leerFormulario().
 * @returns {object} un mensaje por cada campo con error (vacío si todo está bien).
 */
function validarCliente(datos) {
  const errores = {};

  // Nombre: obligatorio y de al menos 3 letras
  if (datos.nombreCliente.length < 3) {
    errores.nombreCliente = 'Escribe el nombre completo del cliente.';
  }

  // DUI: formato, dígito verificador y que no esté repetido
  if (datos.dui === '') {
    errores.dui = 'Escribe el DUI del cliente.';
  } else if (!FORMATO_DUI.test(datos.dui)) {
    errores.dui = 'El DUI debe tener 8 números, guion y 1 número. Ejemplo: 04512345-3.';
  } else if (!duiEsValido(datos.dui)) {
    errores.dui = 'Este DUI no es válido. Revisa que los números estén bien escritos.';
  } else {
    for (let i = 0; i < clientes.length; i++) {
      if (clientes[i].dui === datos.dui && clientes[i].id !== idEditando) {
        errores.dui = 'Ya existe un cliente con este DUI.';
        break;
      }
    }
  }

  // Fecha de nacimiento: obligatoria, no futura y con edad entre 18 y 120 años
  if (datos.fechaNacimiento === '') {
    errores.fechaNacimiento = 'Elige la fecha de nacimiento.';
  } else if (datos.fechaNacimiento > fechaISO(new Date())) {
    errores.fechaNacimiento = 'La fecha no puede ser posterior a hoy.';
  } else {
    const edad = calcularEdad(datos.fechaNacimiento);
    if (edad < EDAD_MINIMA) {
      errores.fechaNacimiento = 'El cliente debe ser mayor de edad (18 años o más).';
    } else if (edad > EDAD_MAXIMA) {
      errores.fechaNacimiento = 'Revisa el año: la edad calculada es mayor de 120 años.';
    }
  }

  // Teléfono: obligatorio, 8 dígitos y empieza con 2, 6 o 7
  if (datos.telefono === '') {
    errores.telefono = 'Escribe el teléfono del cliente.';
  } else if (!FORMATO_TELEFONO.test(datos.telefono)) {
    errores.telefono = 'Escribe 8 números que empiecen con 2, 6 o 7. Ejemplo: 7123-4567.';
  }

  // Correo: opcional, pero si se escribe debe tener formato válido
  if (datos.correo !== '' && !FORMATO_CORREO.test(datos.correo)) {
    errores.correo = 'Escribe un correo válido, por ejemplo: nombre@correo.com.';
  }

  return errores;
}

/**
 * Marca en rojo los campos con error y muestra su mensaje.
 * @param {object} errores
 */
function mostrarErrores(errores) {
  let primerError = null;

  for (let i = 0; i < CAMPOS.length; i++) {
    const campo = CAMPOS[i];
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

/** Muestra la edad debajo de la fecha de nacimiento, como ayuda para el empleado. */
function mostrarEdadCalculada() {
  if (campoFecha.value === '') {
    edadCalculada.textContent = '';
    return;
  }
  edadCalculada.textContent = 'Edad: ' + calcularEdad(campoFecha.value) + ' años';
}

/**
 * Abre la ventana del formulario.
 * @param {object|null} cliente - el cliente a editar, o null para uno nuevo.
 */
function abrirFormulario(cliente) {
  formCliente.reset();
  mostrarErrores({});
  alertaCliente.classList.add('d-none');

  if (cliente === null) {
    idEditando = null;
    document.getElementById('tituloModalCliente').textContent = 'Nuevo cliente';
    botonGuardar.textContent = 'Guardar cliente';
  } else {
    idEditando = cliente.id;
    document.getElementById('tituloModalCliente').textContent = 'Editar cliente';
    botonGuardar.textContent = 'Guardar cambios';

    // || '' : si el dato está vacío en la base de datos (null), el campo queda vacío
    document.getElementById('nombreCliente').value = cliente.nombre;
    campoDui.value = cliente.dui || '';
    campoFecha.value = cliente.fecha_nacimiento || '';
    campoTelefono.value = cliente.telefono || '';
    document.getElementById('correo').value = cliente.correo || '';
    document.getElementById('direccion').value = cliente.direccion || '';
  }

  mostrarEdadCalculada();
  ventanaCliente.show();
}

/**
 * Guarda el cliente en Supabase (nuevo o editado).
 * @param {object} datos - datos ya validados.
 * @returns {Promise<object|null>} el error, o null si se guardó.
 */
async function guardarCliente(datos) {
  // Los nombres de las columnas de la tabla en Supabase.
  // Los campos opcionales vacíos se guardan como null (sin dato).
  const registro = {
    nombre: datos.nombreCliente,
    dui: datos.dui,
    fecha_nacimiento: datos.fechaNacimiento,
    telefono: datos.telefono,
    correo: datos.correo === '' ? null : datos.correo,
    direccion: datos.direccion === '' ? null : datos.direccion
  };

  let resultado;
  if (idEditando === null) {
    resultado = await db.from('clientes').insert(registro);
  } else {
    resultado = await db.from('clientes').update(registro).eq('id', idEditando);
  }

  return resultado.error;
}

//Eliminar cliente

/**
 * Abre la ventana de confirmación antes de eliminar.
 * @param {object} cliente
 */
function confirmarEliminacion(cliente) {
  clienteEliminando = cliente;
  document.getElementById('nombreEliminarCliente').textContent = cliente.nombre;
  alertaEliminar.classList.add('d-none');
  botonConfirmarEliminar.disabled = false;
  ventanaEliminar.show();
}

/**
 * Elimina el cliente en Supabase.
 * @param {object} cliente
 * @returns {Promise<object|null>} el error, o null si se eliminó.
 */
async function eliminarCliente(cliente) {
  // .select('id') devuelve las filas realmente borradas (RLS no da error, solo no borra)
  const { data, error } = await db
    .from('clientes')
    .delete()
    .eq('id', cliente.id)
    .select('id');

  if (error) {
    return error;
  }
  if (data.length === 0) {
    return { code: 'sin-permiso' };
  }
  return null;
}

// ---------- Eventos ----------

// Botón "Nuevo cliente"
document.getElementById('botonNuevoCliente').addEventListener('click', function () {
  abrirFormulario(null);
});

// Búsqueda: se filtra con cada letra que se escribe
buscarCliente.addEventListener('input', filtrarClientes);

// DUI y teléfono: el guion se coloca solo mientras se escribe
campoDui.addEventListener('input', function () {
  this.value = formatearConGuion(this.value, 8, 9);
});

campoTelefono.addEventListener('input', function () {
  this.value = formatearConGuion(this.value, 4, 8);
});

// Al elegir la fecha, se muestra la edad
campoFecha.addEventListener('change', mostrarEdadCalculada);

// Al abrir la ventana, el cursor va al primer campo
document.getElementById('modalCliente').addEventListener('shown.bs.modal', function () {
  document.getElementById('nombreCliente').focus();
});

// Botones de cada fila (editar y eliminar). Un solo evento para toda la tabla.
tablaClientes.addEventListener('click', function (evento) {
  const boton = evento.target.closest('button[data-accion]');
  if (boton === null) {
    return;
  }

  const id = Number(boton.dataset.id);
  const cliente = clientes.find(function (c) { return c.id === id; });

  switch (boton.dataset.accion) {
    case 'editar':
      abrirFormulario(cliente);
      break;
    case 'eliminar':
      confirmarEliminacion(cliente);
      break;
  }
});

// Envío del formulario
formCliente.addEventListener('submit', async function (evento) {
  evento.preventDefault();
  alertaCliente.classList.add('d-none');

  const datos = leerFormulario();
  const errores = validarCliente(datos);
  mostrarErrores(errores);

  if (Object.keys(errores).length > 0) {
    return;
  }

  const esNuevo = idEditando === null;
  botonGuardar.disabled = true;
  botonGuardar.textContent = 'Guardando…';

  const error = await guardarCliente(datos);

  botonGuardar.disabled = false;
  botonGuardar.textContent = esNuevo ? 'Guardar cliente' : 'Guardar cambios';

  if (error) {
    console.error('Error al guardar el cliente:', error);
    if (error.code === '23505') {
      mostrarErrores({ dui: 'Ya existe un cliente con este DUI.' });
    } else {
      alertaCliente.textContent = 'No se pudo guardar el cliente. Revisa tu conexión e intenta de nuevo.';
      alertaCliente.classList.remove('d-none');
    }
    return;
  }

  ventanaCliente.hide();
  mostrarAviso(esNuevo ? 'Cliente registrado.' : 'Cambios guardados.');
  await cargarClientes();
});

// Botón "Eliminar cliente" de la ventana de confirmación
botonConfirmarEliminar.addEventListener('click', async function () {
  alertaEliminar.classList.add('d-none');
  botonConfirmarEliminar.disabled = true;
  botonConfirmarEliminar.textContent = 'Eliminando…';

  const error = await eliminarCliente(clienteEliminando);

  botonConfirmarEliminar.textContent = 'Eliminar cliente';

  if (error) {
    console.error('Error al eliminar el cliente:', error);
    let mensaje;

    switch (error.code) {
      case '23503': // El cliente aparece en ventas (llave foránea)
        mensaje = 'No se puede eliminar porque tiene compras registradas.';
        break;
      case 'sin-permiso':
        mensaje = 'Tu usuario no tiene permiso para eliminar clientes.';
        break;
      default:
        mensaje = 'No se pudo eliminar el cliente. Revisa tu conexión e intenta de nuevo.';
        botonConfirmarEliminar.disabled = false;
    }

    alertaEliminar.textContent = mensaje;
    alertaEliminar.classList.remove('d-none');
    return;
  }

  ventanaEliminar.hide();
  mostrarAviso('Cliente eliminado.');
  await cargarClientes();
});

iniciarPagina();