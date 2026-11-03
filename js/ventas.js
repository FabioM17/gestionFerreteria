/**
 * ventas.js
 * Módulo de ventas (punto de venta).
 */

// ---------- Datos de la página ----------
let productos = [];        // Productos cargados desde Supabase
let categorias = [];       // Categorías para los botones de filtro
let categoriaActiva = 0;   // id de la categoría elegida (0 = todas)
let clientes = [];         // Clientes para la lista desplegable
let carrito = [];          // Productos de la venta actual: [{ productoId, cantidad }]

// Impuesto al valor agregado de El Salvador, en porcentaje
const PORCENTAJE_IVA = 13;

// ---------- Referencias a elementos ----------
const catalogo = document.getElementById('catalogo');
const buscarProducto = document.getElementById('buscarProducto');
const filtroCategorias = document.getElementById('filtroCategorias');
const resultadosCatalogo = document.getElementById('resultadosCatalogo');
const listaCarrito = document.getElementById('carrito');
const selectCliente = document.getElementById('clienteVenta');
const botonRegistrar = document.getElementById('botonRegistrarVenta');
const botonVaciar = document.getElementById('botonVaciar');

/** Prepara la página: sesión, menú y carga de datos. */
async function iniciarPagina() {
  const perfil = await protegerPagina();
  if (perfil === null) {
    return;
  }

  mostrarMenu('ventas', 'Ventas', perfil);

  await cargarCategorias();
  await cargarProductos();
  await cargarClientes();
  mostrarCarrito();
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

//Cliente de la venta

/** Carga los clientes y llena la lista desplegable. */
async function cargarClientes() {
  const { data, error } = await db
    .from('clientes')
    .select('id, nombre, dui')
    .order('nombre');

  if (error) {
    console.error('Error al cargar clientes:', error);
    return;
  }

  clientes = data;
  llenarClientes();
}

/** Llena la lista de clientes, con "Consumidor final" primero y elegido por defecto. */
function llenarClientes() {
  selectCliente.innerHTML = '';

  // Primero el "Consumidor final" (el único sin DUI)
  for (let i = 0; i < clientes.length; i++) {
    if (clientes[i].dui === null) {
      selectCliente.add(new Option(clientes[i].nombre, clientes[i].id));
    }
  }

  // Luego los demás, con su DUI para distinguir nombres parecidos
  for (let i = 0; i < clientes.length; i++) {
    if (clientes[i].dui !== null) {
      selectCliente.add(new Option(clientes[i].nombre + ' — ' + clientes[i].dui, clientes[i].id));
    }
  }

  selectCliente.selectedIndex = 0;
}

//Carrito

/**
 * Busca un producto por su id.
 * @param {number} id
 * @returns {object|undefined}
 */
function buscarProductoPorId(id) {
  return productos.find(function (p) { return p.id === id; });
}

/**
 * Agrega un producto a la venta, o suma 1 si ya estaba (requerimiento 5).
 * @param {number} productoId
 */
function agregarAlCarrito(productoId) {
  const producto = buscarProductoPorId(productoId);
  const item = carrito.find(function (i) { return i.productoId === productoId; });
  const cantidadActual = item ? item.cantidad : 0;

  // No se puede vender más de lo que hay en stock
  if (cantidadActual >= producto.stock) {
    mostrarAviso(`Solo hay ${producto.stock} en stock de ${producto.nombre}.`);
    return;
  }

  if (item) {
    item.cantidad = item.cantidad + 1;
  } else {
    carrito.push({ productoId: productoId, cantidad: 1 });
  }

  mostrarCarrito();
}

/**
 * Cambia la cantidad de un producto de la venta.
 * Si la cantidad llega a 0, el producto se quita.
 * @param {number} productoId
 * @param {number} nuevaCantidad
 */
function cambiarCantidad(productoId, nuevaCantidad) {
  const producto = buscarProductoPorId(productoId);
  const item = carrito.find(function (i) { return i.productoId === productoId; });

  if (nuevaCantidad <= 0) {
    quitarDelCarrito(productoId);
    return;
  }

  if (nuevaCantidad > producto.stock) {
    mostrarAviso(`Solo hay ${producto.stock} en stock de ${producto.nombre}.`);
    nuevaCantidad = producto.stock;
  }

  item.cantidad = nuevaCantidad;
  mostrarCarrito();
}

/**
 * Quita un producto de la venta.
 * @param {number} productoId
 */
function quitarDelCarrito(productoId) {
  carrito = carrito.filter(function (i) { return i.productoId !== productoId; });
  mostrarCarrito();
}

/** Dibuja los productos de la venta y actualiza los totales. */
function mostrarCarrito() {
  if (carrito.length === 0) {
    listaCarrito.innerHTML = `
      <li class="carrito-vacio">
        <i class="bi bi-cart3" aria-hidden="true"></i>
        Agrega productos desde el catálogo para empezar la venta.
      </li>`;
  } else {
    let filas = ''; // Acumulador con el HTML de los productos

    for (let i = 0; i < carrito.length; i++) {
      const item = carrito[i];
      const producto = buscarProductoPorId(item.productoId);
      const nombre = escaparHTML(producto.nombre);

      filas += `
        <li class="item-carrito">
          <div class="d-flex justify-content-between gap-2">
            <div>
              <div class="fw-semibold">${nombre}</div>
              <small class="text-secondary">${formatearDinero(producto.precio)} c/u</small>
            </div>
            <button type="button" class="btn btn-sm btn-link text-danger p-0" data-accion="quitar"
                    data-id="${producto.id}" aria-label="Quitar ${nombre} de la venta">
              <i class="bi bi-x-lg" aria-hidden="true"></i>
            </button>
          </div>
          <div class="d-flex justify-content-between align-items-center mt-2">
            <div class="input-group input-group-sm cantidad">
              <button type="button" class="btn btn-outline-secondary" data-accion="menos"
                      data-id="${producto.id}" aria-label="Una unidad menos de ${nombre}">
                <i class="bi bi-dash" aria-hidden="true"></i>
              </button>
              <input type="number" class="form-control text-center" value="${item.cantidad}"
                     min="1" max="${producto.stock}" data-id="${producto.id}" aria-label="Cantidad de ${nombre}">
              <button type="button" class="btn btn-outline-secondary" data-accion="mas"
                      data-id="${producto.id}" aria-label="Una unidad más de ${nombre}">
                <i class="bi bi-plus" aria-hidden="true"></i>
              </button>
            </div>
            <span class="fw-semibold">${formatearDinero(producto.precio * item.cantidad)}</span>
          </div>
        </li>`;
    }

    listaCarrito.innerHTML = filas;
  }

  mostrarTotales();
}

//Totales descuento mas iva

/**
 * Porcentaje de descuento según el monto de la compra (requerimiento 6).
 *   Menos de $100      → sin descuento
 *   De $100 a $249.99  → 5 %
 *   $250 o más         → 10 %
 * @param {number} subtotal - en dólares.
 * @returns {number} porcentaje entero (5 = 5 %)
 */
function porcentajeDescuento(subtotal) {
  if (subtotal >= 250) {
    return 10;
  } else if (subtotal >= 100) {
    return 5;
  } else {
    return 0;
  }
}

/**
 * Calcula los totales de la venta actual.
 * Los cálculos se hacen en CENTAVOS (números enteros) para evitar errores de
 * redondeo con decimales. Al final se convierten a dólares dividiendo entre 100.
 * @returns {{articulos: number, subtotal: number, porcentaje: number, descuento: number, iva: number, total: number}}
 */
function calcularTotales() {
  let articulos = 0;         // Acumulador de unidades
  let subtotalCentavos = 0;  // Acumulador de dinero, en centavos

  // Estructura repetitiva + acumuladores: recorremos los productos de la venta
  for (let i = 0; i < carrito.length; i++) {
    const item = carrito[i];
    const producto = buscarProductoPorId(item.productoId);
    const precioCentavos = Math.round(producto.precio * 100); // $8.50 → 850

    articulos = articulos + item.cantidad;
    subtotalCentavos = subtotalCentavos + precioCentavos * item.cantidad;
  }

  const porcentaje = porcentajeDescuento(subtotalCentavos / 100);
  const descuentoCentavos = Math.round(subtotalCentavos * porcentaje / 100);

  // Jerarquía de operaciones: primero se resta el descuento (paréntesis),
  // luego se multiplica por el IVA y por último se divide entre 100
  const ivaCentavos = Math.round((subtotalCentavos - descuentoCentavos) * PORCENTAJE_IVA / 100);
  const totalCentavos = subtotalCentavos - descuentoCentavos + ivaCentavos;

  return {
    articulos: articulos,
    subtotal: subtotalCentavos / 100,
    porcentaje: porcentaje,
    descuento: descuentoCentavos / 100,
    iva: ivaCentavos / 100,
    total: totalCentavos / 100
  };
}

/** Muestra los totales y activa o desactiva los botones. */
function mostrarTotales() {
  const totales = calcularTotales();

  document.getElementById('conteoArticulos').textContent =
    totales.articulos + (totales.articulos === 1 ? ' artículo' : ' artículos');
  document.getElementById('totalSubtotal').textContent = formatearDinero(totales.subtotal);
  document.getElementById('totalDescuento').textContent = '-' + formatearDinero(totales.descuento);
  document.getElementById('totalIva').textContent = formatearDinero(totales.iva);
  document.getElementById('totalPagar').textContent = formatearDinero(totales.total);
  document.getElementById('detalleDescuento').textContent =
    totales.porcentaje > 0 ? '(' + totales.porcentaje + ' %)' : '';

  // Sin productos no se puede registrar ni vaciar
  const vacio = carrito.length === 0;
  botonRegistrar.disabled = vacio;
  botonVaciar.disabled = vacio;
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

// Botón "Agregar" de las tarjetas del catálogo
catalogo.addEventListener('click', function (evento) {
  const boton = evento.target.closest('button[data-accion="agregar"]');
  if (boton !== null) {
    agregarAlCarrito(Number(boton.dataset.id));
  }
});

// Botones del carrito: +, − y quitar
listaCarrito.addEventListener('click', function (evento) {
  const boton = evento.target.closest('button[data-accion]');
  if (boton === null) {
    return;
  }

  const id = Number(boton.dataset.id);
  const item = carrito.find(function (i) { return i.productoId === id; });

  switch (boton.dataset.accion) {
    case 'mas':
      cambiarCantidad(id, item.cantidad + 1);
      break;
    case 'menos':
      cambiarCantidad(id, item.cantidad - 1);
      break;
    case 'quitar':
      quitarDelCarrito(id);
      break;
  }
});

// Cantidad escrita a mano (por ejemplo, 50 bloques)
listaCarrito.addEventListener('change', function (evento) {
  const campo = evento.target;
  if (campo.type !== 'number') {
    return;
  }

  const id = Number(campo.dataset.id);
  const cantidad = Number(campo.value);

  // Solo números enteros: si escriben 2.5 o letras, se deja como estaba
  if (!Number.isInteger(cantidad)) {
    mostrarAviso('Escribe una cantidad entera.');
    mostrarCarrito();
    return;
  }

  cambiarCantidad(id, cantidad);
});

// Botón "Vaciar venta"
botonVaciar.addEventListener('click', function () {
  carrito = [];
  mostrarCarrito();
});

iniciarPagina();