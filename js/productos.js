/**
 * productos.js
 * Módulo de productos: listado, registro, edición y eliminación.
 */

// ---------- Datos de la página ----------
let productos = [];       // Lista de productos cargada desde Supabase
let categorias = [];      // Lista de categorías cargada desde Supabase
let idEditando = null;    // id del producto que se edita (null = producto nuevo)
let codigoSugerido = '';  // Último código que el sistema sugirió

// Unidades de venta disponibles (lista fija)
const UNIDADES = ['Unidad', 'Caja', 'Libra', 'Metro', 'Galón', 'Bolsa'];

// Campos del formulario, en el orden en que aparecen
const CAMPOS = ['categoria', 'codigo', 'nombre', 'marca', 'unidad', 'costo', 'precio', 'stock', 'stockMinimo'];

// Formato de código: 3 letras, guion y 3 números (ejemplo: HER-001)
const FORMATO_CODIGO = /^[A-Z]{3}-\d{3}$/;

// ---------- Referencias a elementos ----------
const tablaProductos = document.getElementById('tablaProductos');
const contador = document.getElementById('contador');
const formProducto = document.getElementById('formProducto');
const alertaFormulario = document.getElementById('alertaFormulario');
const botonGuardar = document.getElementById('botonGuardar');
const ventanaProducto = new bootstrap.Modal(document.getElementById('modalProducto'));

/** Prepara la página: sesión, menú, permisos y carga de datos. */
async function iniciarPagina() {
  const perfil = await protegerPagina();
  if (perfil === null) {
    return;
  }

  mostrarMenu('productos', 'Productos', perfil);

  // Solo el administrador puede agregar, editar o eliminar
  if (esAdministrador(perfil)) {
    document.getElementById('botonNuevo').classList.remove('d-none');
  } else {
    document.getElementById('tablaInventario').classList.add('solo-lectura');
  }

  llenarUnidades();
  await cargarCategorias();
  await cargarProductos();
}

/** Consulta los productos en Supabase y los muestra en la tabla. */
async function cargarProductos() {
  mostrarMensajeTabla('Cargando productos…');

  const { data, error } = await db
    .from('productos')
    .select('id, codigo, nombre, marca, unidad, costo, precio, stock, stock_minimo, imagen_url, categoria_id, categorias(nombre)')
    .order('codigo');

  if (error) {
    console.error('Error al cargar productos:', error);
    mostrarMensajeTabla('No se pudieron cargar los productos. Revisa tu conexión y recarga la página.');
    return;
  }

  productos = data;
  mostrarProductos(productos);
  llenarMarcas();
}

/**
 * Muestra un mensaje que ocupa toda la tabla (cargando, error o sin resultados).
 * @param {string} mensaje
 */
function mostrarMensajeTabla(mensaje) {
  tablaProductos.innerHTML = `
    <tr>
      <td colspan="8" class="text-center text-secondary py-5">${mensaje}</td>
    </tr>`;
  contador.textContent = '';
}

/**
 * Dibuja las filas de la tabla con una lista de productos.
 * @param {Array} lista - productos a mostrar.
 */
function mostrarProductos(lista) {
  if (lista.length === 0) {
    mostrarMensajeTabla('No hay productos para mostrar.');
    return;
  }

  let filas = ''; // Acumulador con el HTML de todas las filas

  for (let i = 0; i < lista.length; i++) {
    const producto = lista[i];
    const categoria = producto.categorias ? producto.categorias.nombre : 'Sin categoría';
    const estado = estadoStock(producto);
    const nombre = escaparHTML(producto.nombre);

    filas += `
      <tr>
        <td>${miniatura(producto, categoria)}</td>
        <td class="codigo">${escaparHTML(producto.codigo)}</td>
        <td>
          <div class="fw-semibold">${nombre}</div>
          <small class="text-secondary">${escaparHTML(producto.marca)} · ${escaparHTML(producto.unidad)}</small>
        </td>
        <td>${escaparHTML(categoria)}</td>
        <td class="text-end">${formatearDinero(producto.precio)}</td>
        <td class="text-end text-nowrap">
          ${producto.stock} <small class="text-secondary">/ mín. ${producto.stock_minimo}</small>
        </td>
        <td><span class="badge ${estado.clase}">${estado.texto}</span></td>
        <td class="text-end text-nowrap acciones-admin">
          <button type="button" class="btn btn-sm btn-outline-secondary" data-accion="editar"
                  data-id="${producto.id}" aria-label="Editar ${nombre}">
            <i class="bi bi-pencil" aria-hidden="true"></i>
          </button>
          <button type="button" class="btn btn-sm btn-outline-danger" data-accion="eliminar"
                  data-id="${producto.id}" aria-label="Eliminar ${nombre}">
            <i class="bi bi-trash" aria-hidden="true"></i>
          </button>
        </td>
      </tr>`;
  }

  tablaProductos.innerHTML = filas;
  contador.textContent = `Mostrando ${lista.length} de ${productos.length} productos`;
}

/**
 * Devuelve el HTML de la miniatura: la imagen del producto o el ícono de su categoría.
 * @param {object} producto
 * @param {string} categoria
 * @returns {string}
 */
function miniatura(producto, categoria) {
  if (producto.imagen_url) {
    return `<img src="${escaparHTML(producto.imagen_url)}" alt="" class="miniatura" loading="lazy">`;
  }
  return `<span class="miniatura"><i class="bi ${iconoCategoria(categoria)}" aria-hidden="true"></i></span>`;
}

// =========================================================
// FORMULARIO: agregar y editar productos
// =========================================================

/** Carga las categorías desde Supabase y llena la lista desplegable. */
async function cargarCategorias() {
  const { data, error } = await db
    .from('categorias')
    .select('id, nombre')
    .order('nombre');

  if (error) {
    console.error('Error al cargar categorías:', error);
    return;
  }

  categorias = data;
  const lista = document.getElementById('categoria');
  for (let i = 0; i < categorias.length; i++) {
    lista.add(new Option(categorias[i].nombre, categorias[i].id));
  }
}

/** Llena la lista desplegable de unidades de venta. */
function llenarUnidades() {
  const lista = document.getElementById('unidad');
  for (let i = 0; i < UNIDADES.length; i++) {
    lista.add(new Option(UNIDADES[i], UNIDADES[i]));
  }
}

/** Sugiere las marcas ya registradas mientras se escribe (sin repetirlas). */
function llenarMarcas() {
  const marcas = [];
  for (let i = 0; i < productos.length; i++) {
    if (!marcas.includes(productos[i].marca)) {
      marcas.push(productos[i].marca);
    }
  }
  marcas.sort();

  const lista = document.getElementById('listaMarcas');
  lista.innerHTML = '';
  for (let i = 0; i < marcas.length; i++) {
    lista.appendChild(new Option(marcas[i]));
  }
}

/**
 * Calcula el siguiente código disponible para una categoría.
 * Ejemplo: si en Herramientas el mayor es HER-008, sugiere HER-009.
 * @param {number} categoriaId
 * @returns {string}
 */
function sugerirCodigo(categoriaId) {
  let prefijo = '';
  let mayor = 0; // Acumulador: el número más alto encontrado

  for (let i = 0; i < productos.length; i++) {
    if (productos[i].categoria_id === categoriaId) {
      const partes = productos[i].codigo.split('-'); // 'HER-008' → ['HER', '008']
      const numero = parseInt(partes[1], 10);
      prefijo = partes[0];
      if (numero > mayor) {
        mayor = numero;
      }
    }
  }

  // Categoría sin productos: usamos sus 3 primeras letras, sin tildes
  if (prefijo === '') {
    const categoria = categorias.find(function (c) { return c.id === categoriaId; });
    prefijo = categoria.nombre
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .substring(0, 3)
      .toUpperCase();
  }

  // padStart completa con ceros a la izquierda: 9 → '009'
  return prefijo + '-' + String(mayor + 1).padStart(3, '0');
}

/**
 * Convierte el texto de un campo numérico en número.
 * Un campo vacío devuelve NaN (no es un número) para que la validación lo detecte.
 * @param {string} texto
 * @returns {number}
 */
function leerNumero(texto) {
  return texto.trim() === '' ? NaN : Number(texto);
}

/** Lee los valores del formulario y los devuelve en un objeto. */
function leerFormulario() {
  return {
    categoria: Number(document.getElementById('categoria').value),
    codigo: document.getElementById('codigo').value.trim().toUpperCase(),
    nombre: document.getElementById('nombre').value.trim(),
    marca: document.getElementById('marca').value.trim(),
    unidad: document.getElementById('unidad').value,
    costo: leerNumero(document.getElementById('costo').value),
    precio: leerNumero(document.getElementById('precio').value),
    stock: leerNumero(document.getElementById('stock').value),
    stockMinimo: leerNumero(document.getElementById('stockMinimo').value)
  };
}

/**
 * Valida los datos del producto (requerimiento 2).
 * @param {object} datos - lo que devuelve leerFormulario().
 * @returns {object} un mensaje por cada campo con error (vacío si todo está bien).
 */
function validarProducto(datos) {
  const errores = {};

  if (datos.categoria === 0) {
    errores.categoria = 'Elige una categoría.';
  }

  if (datos.codigo === '') {
    errores.codigo = 'Escribe el código del producto.';
  } else if (!FORMATO_CODIGO.test(datos.codigo)) {
    errores.codigo = 'Usa el formato de 3 letras, guion y 3 números. Ejemplo: HER-009.';
  } else {
    // El código no puede repetirse (excepto el del mismo producto que se edita)
    for (let i = 0; i < productos.length; i++) {
      if (productos[i].codigo === datos.codigo && productos[i].id !== idEditando) {
        errores.codigo = 'Ya existe un producto con este código.';
        break;
      }
    }
  }

  if (datos.nombre === '') {
    errores.nombre = 'Escribe el nombre del producto.';
  }

  if (datos.marca === '') {
    errores.marca = 'Escribe la marca.';
  }

  if (datos.unidad === '') {
    errores.unidad = 'Elige la unidad de venta.';
  }

  // Operadores relacionales: ningún valor puede ser negativo
  if (isNaN(datos.costo) || datos.costo < 0) {
    errores.costo = 'Escribe un costo de 0 o más.';
  }

  if (isNaN(datos.precio) || datos.precio <= 0) {
    errores.precio = 'Escribe un precio mayor que 0.';
  } else if (datos.costo >= 0 && datos.precio < datos.costo) {
    errores.precio = 'El precio de venta no puede ser menor que el costo.';
  }

  if (!Number.isInteger(datos.stock) || datos.stock < 0) {
    errores.stock = 'Escribe un número entero de 0 o más.';
  }

  if (!Number.isInteger(datos.stockMinimo) || datos.stockMinimo < 0) {
    errores.stockMinimo = 'Escribe un número entero de 0 o más.';
  }

  return errores;
}

/**
 * Marca en rojo los campos con error y muestra su mensaje.
 * @param {object} errores - lo que devuelve validarProducto().
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

  // Llevamos el cursor al primer campo con error
  if (primerError !== null) {
    primerError.focus();
  }
}

/**
 * Abre la ventana del formulario.
 * @param {object|null} producto - el producto a editar, o null para uno nuevo.
 */
function abrirFormulario(producto) {
  formProducto.reset();
  mostrarErrores({});
  alertaFormulario.classList.add('d-none');
  codigoSugerido = '';

  if (producto === null) {
    idEditando = null;
    document.getElementById('tituloModal').textContent = 'Nuevo producto';
    botonGuardar.textContent = 'Guardar producto';
  } else {
    idEditando = producto.id;
    document.getElementById('tituloModal').textContent = 'Editar producto';
    botonGuardar.textContent = 'Guardar cambios';

    document.getElementById('categoria').value = producto.categoria_id;
    document.getElementById('codigo').value = producto.codigo;
    document.getElementById('nombre').value = producto.nombre;
    document.getElementById('marca').value = producto.marca;
    document.getElementById('unidad').value = producto.unidad;
    document.getElementById('costo').value = producto.costo;
    document.getElementById('precio').value = producto.precio;
    document.getElementById('stock').value = producto.stock;
    document.getElementById('stockMinimo').value = producto.stock_minimo;
  }

  ventanaProducto.show();
}

/**
 * Guarda el producto en Supabase (nuevo o editado).
 * @param {object} datos - datos ya validados.
 * @returns {Promise<object|null>} el error de Supabase, o null si se guardó.
 */
async function guardarProducto(datos) {
  // Los nombres de las columnas de la tabla en Supabase
  const registro = {
    codigo: datos.codigo,
    nombre: datos.nombre,
    marca: datos.marca,
    categoria_id: datos.categoria,
    unidad: datos.unidad,
    costo: datos.costo,
    precio: datos.precio,
    stock: datos.stock,
    stock_minimo: datos.stockMinimo
  };

  if (idEditando === null) {
    const { error } = await db.from('productos').insert(registro);
    return error;
  } else {
    const { error } = await db.from('productos').update(registro).eq('id', idEditando);
    return error;
  }
}

// ---------- Eventos ----------

// Botón "Nuevo producto"
document.getElementById('botonNuevo').addEventListener('click', function () {
  abrirFormulario(null);
});

// Al elegir una categoría en un producto nuevo, sugerimos el código
document.getElementById('categoria').addEventListener('change', function () {
  const campoCodigo = document.getElementById('codigo');
  const categoriaId = Number(this.value);

  // Solo si es nuevo, y si el empleado no escribió un código propio
  const codigoSinCambios = campoCodigo.value === '' || campoCodigo.value === codigoSugerido;
  if (idEditando === null && categoriaId !== 0 && codigoSinCambios) {
    codigoSugerido = sugerirCodigo(categoriaId);
    campoCodigo.value = codigoSugerido;
  }
});

// Al abrir la ventana, el cursor va al primer campo
document.getElementById('modalProducto').addEventListener('shown.bs.modal', function () {
  document.getElementById('categoria').focus();
});

// Botones de cada fila (editar). Un solo evento para toda la tabla.
tablaProductos.addEventListener('click', function (evento) {
  const boton = evento.target.closest('button[data-accion]');
  if (boton === null) {
    return; // El clic no fue en un botón
  }

  const id = Number(boton.dataset.id);
  const producto = productos.find(function (p) { return p.id === id; });

  switch (boton.dataset.accion) {
    case 'editar':
      abrirFormulario(producto);
      break;
  }
});

// Envío del formulario
formProducto.addEventListener('submit', async function (evento) {
  evento.preventDefault();
  alertaFormulario.classList.add('d-none');

  const datos = leerFormulario();
  const errores = validarProducto(datos);
  mostrarErrores(errores);

  // Si hay al menos un error, no guardamos
  if (Object.keys(errores).length > 0) {
    return;
  }

  const esNuevo = idEditando === null;
  botonGuardar.disabled = true;
  botonGuardar.textContent = 'Guardando…';

  const error = await guardarProducto(datos);

  botonGuardar.disabled = false;
  botonGuardar.textContent = esNuevo ? 'Guardar producto' : 'Guardar cambios';

  if (error) {
    console.error('Error al guardar el producto:', error);
    // 23505 = valor repetido en una columna "unique"
    if (error.code === '23505') {
      mostrarErrores({ codigo: 'Ya existe un producto con este código.' });
    } else {
      alertaFormulario.textContent = 'No se pudo guardar el producto. Revisa tu conexión e intenta de nuevo.';
      alertaFormulario.classList.remove('d-none');
    }
    return;
  }

  ventanaProducto.hide();
  mostrarAviso(esNuevo ? 'Producto guardado.' : 'Cambios guardados.');
  await cargarProductos();
});

iniciarPagina();