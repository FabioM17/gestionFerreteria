/**
 * ventas.js
 * Módulo de ventas (punto de venta).
 * Requerimientos: 5 (venta), 6 (descuentos), 7 (IVA), 8 (factura), 9 (varias ventas seguidas).
 */

// ---------- Datos de la página ----------
let productos = [];        // Productos cargados desde Supabase
let categorias = [];       // Categorías para los botones de filtro
let categoriaActiva = 0;   // id de la categoría elegida (0 = todas)

// ---------- Referencias a elementos ----------
const catalogo = document.getElementById('catalogo');
const buscarProducto = document.getElementById('buscarProducto');
const filtroCategorias = document.getElementById('filtroCategorias');
const resultadosCatalogo = document.getElementById('resultadosCatalogo');

/** Prepara la página: sesión, menú y carga de datos. */
async function iniciarPagina() {
  const perfil = await protegerPagina();
  if (perfil === null) {
    return;
  }

  mostrarMenu('ventas', 'Ventas', perfil);

  await cargarCategorias();
  await cargarProductos();
}

//Catalogo

/** Carga las categorías y dibuja los botones de filtro. */
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
  dibujarFiltros();
}

/** Dibuja un botón por categoría, más el botón "Todas". */
function dibujarFiltros() {
  let botones = `<button type="button" class="btn-filtro activo" data-categoria="0" aria-pressed="true">Todas</button>`;

  for (let i = 0; i < categorias.length; i++) {
    const categoria = categorias[i];
    botones += `
      <button type="button" class="btn-filtro" data-categoria="${categoria.id}" aria-pressed="false">
        <i class="bi ${iconoCategoria(categoria.nombre)}" aria-hidden="true"></i>
        ${escaparHTML(categoria.nombre)}
      </button>`;
  }

  filtroCategorias.innerHTML = botones;
}

/** Consulta los productos en Supabase y los muestra en el catálogo. */
async function cargarProductos() {
  resultadosCatalogo.textContent = 'Cargando productos…';

  const { data, error } = await db
    .from('productos')
    .select('id, codigo, nombre, marca, unidad, precio, stock, stock_minimo, imagen_url, categoria_id, categorias(nombre)')
    .order('nombre');

  if (error) {
    console.error('Error al cargar productos:', error);
    resultadosCatalogo.textContent = 'No se pudieron cargar los productos. Revisa tu conexión y recarga la página.';
    return;
  }

  productos = data;
  filtrarCatalogo();
}

/** Aplica la búsqueda y el filtro de categoría (requerimiento 3). */
function filtrarCatalogo() {
  const texto = normalizar(buscarProducto.value.trim());
  const resultado = [];

  for (let i = 0; i < productos.length; i++) {
    const producto = productos[i];

    // Filtro 1: la categoría (0 = todas)
    const coincideCategoria = categoriaActiva === 0 || producto.categoria_id === categoriaActiva;

    // Filtro 2: el texto en el nombre, el código o la marca
    const coincideTexto = texto === ''
      || normalizar(producto.nombre).includes(texto)
      || normalizar(producto.codigo).includes(texto)
      || normalizar(producto.marca).includes(texto);

    if (coincideCategoria && coincideTexto) {
      resultado.push(producto);
    }
  }

  mostrarCatalogo(resultado);
}

/**
 * Dibuja las tarjetas de los productos.
 * @param {Array} lista
 */
function mostrarCatalogo(lista) {
  if (lista.length === 0) {
    catalogo.innerHTML = '';
    resultadosCatalogo.textContent = 'No hay productos que coincidan con la búsqueda.';
    return;
  }

  let tarjetas = ''; // Acumulador con el HTML de todas las tarjetas

  for (let i = 0; i < lista.length; i++) {
    const producto = lista[i];
    const categoria = producto.categorias ? producto.categorias.nombre : '';
    const nombre = escaparHTML(producto.nombre);
    const agotado = producto.stock === 0;

    // Texto y color del stock según el estado del inventario
    const estado = estadoStock(producto);
    const textoStock = agotado ? 'Agotado' : 'Disponibles: ' + producto.stock;

    tarjetas += `
      <div class="col-6 col-md-4 col-xl-3">
        <article class="tarjeta-producto ${agotado ? 'agotado' : ''}">
          <div class="tarjeta-imagen">${imagenProducto(producto, categoria)}</div>
          <div class="tarjeta-cuerpo">
            <small class="codigo">${escaparHTML(producto.codigo)}</small>
            <h2 class="tarjeta-nombre">${nombre}</h2>
            <small class="text-secondary">${escaparHTML(producto.marca)}</small>
            <div class="tarjeta-precio">
              ${formatearDinero(producto.precio)}
              <small>/ ${escaparHTML(producto.unidad)}</small>
            </div>
            <span class="badge ${estado.clase} align-self-start">${textoStock}</span>
            <button type="button" class="btn btn-ferre btn-sm mt-3" data-accion="agregar"
                    data-id="${producto.id}" aria-label="Agregar ${nombre} a la venta" ${agotado ? 'disabled' : ''}>
              <i class="bi bi-cart-plus" aria-hidden="true"></i> Agregar
            </button>
          </div>
        </article>
      </div>`;
  }

  catalogo.innerHTML = tarjetas;
  resultadosCatalogo.textContent = `Mostrando ${lista.length} de ${productos.length} productos`;
}

/**
 * Devuelve el HTML de la imagen del producto, o el ícono de su categoría si no tiene.
 * @param {object} producto
 * @param {string} categoria
 * @returns {string}
 */
function imagenProducto(producto, categoria) {
  if (producto.imagen_url) {
    return `<img src="${escaparHTML(producto.imagen_url)}" alt="" loading="lazy">`;
  }
  return `<i class="bi ${iconoCategoria(categoria)}" aria-hidden="true"></i>`;
}

// ---------- Eventos ----------

// Búsqueda: se filtra con cada letra
buscarProducto.addEventListener('input', filtrarCatalogo);

// Botones de categoría. Un solo evento para todos.
filtroCategorias.addEventListener('click', function (evento) {
  const boton = evento.target.closest('button[data-categoria]');
  if (boton === null) {
    return;
  }

  categoriaActiva = Number(boton.dataset.categoria);

  // Marcamos solo el botón elegido como activo
  const todos = filtroCategorias.querySelectorAll('button');
  for (let i = 0; i < todos.length; i++) {
    const esElegido = todos[i] === boton;
    todos[i].classList.toggle('activo', esElegido);
    todos[i].setAttribute('aria-pressed', esElegido ? 'true' : 'false');
  }

  filtrarCatalogo();
});

iniciarPagina();