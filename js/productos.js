/**
 * productos.js
 * Módulo de productos: listado, registro, edición y eliminación.
 */

// ---------- Datos de la página ----------
let productos = []; // Lista de productos cargada desde Supabase

// ---------- Referencias a elementos ----------
const tablaProductos = document.getElementById('tablaProductos');
const contador = document.getElementById('contador');

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

iniciarPagina();