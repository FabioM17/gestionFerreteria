/**
 * reportes.js
 * Reporte de ventas del día (solo Administrador).
 * Requerimiento 10: total vendido y cantidad de transacciones,
 * calculados con estructuras repetitivas y acumuladores.
 */

// ---------- Datos de la página ----------
let ventasDelDia = [];   // Ventas de la fecha elegida, con su detalle

// Cuántos productos se muestran en "Productos más vendidos"
const CANTIDAD_MAS_VENDIDOS = 5;

// ---------- Referencias a elementos ----------
const campoFecha = document.getElementById('fechaReporte');
const tablaVentas = document.getElementById('tablaVentas');
const listaMasVendidos = document.getElementById('listaMasVendidos');
const ventanaDetalle = new bootstrap.Modal(document.getElementById('modalDetalleVenta'));

/** Prepara la página: sesión, permiso de administrador y reporte de hoy. */
async function iniciarPagina() {
  const perfil = await protegerPagina();
  if (perfil === null) {
    return;
  }

  // El cajero que escriba la dirección a mano vuelve al inicio.
  if (!esAdministrador(perfil)) {
    location.replace('inicio.html');
    return;
  }

  mostrarMenu('reportes', 'Reportes', perfil);

  // No tiene sentido pedir el reporte de un día que todavía no llega
  const hoy = fechaISO(new Date());
  campoFecha.max = hoy;
  campoFecha.value = hoy;

  await cargarReporte();
}

//Consulta

/**
 * Devuelve el inicio y el fin del día elegido, en hora local.
 * Ejemplo: "2026-11-02" → desde 02/11 00:00 hasta 03/11 00:00.
 * @param {string} texto - fecha "aaaa-mm-dd" del campo de fecha.
 * @returns {{inicio: Date, fin: Date}}
 */
function rangoDelDia(texto) {
  const partes = texto.split('-');
  const anio = Number(partes[0]);
  const mes = Number(partes[1]) - 1;   // En JavaScript los meses van de 0 a 11
  const dia = Number(partes[2]);

  return {
    inicio: new Date(anio, mes, dia),
    fin: new Date(anio, mes, dia + 1)
  };
}

/** Consulta las ventas de la fecha elegida y dibuja todo el reporte. */
async function cargarReporte() {
  // Si borran la fecha, se vuelve a hoy
  if (campoFecha.value === '') {
    campoFecha.value = fechaISO(new Date());
  }

  const rango = rangoDelDia(campoFecha.value);

  tablaVentas.innerHTML = `
    <tr><td colspan="7" class="text-center text-secondary py-4">Cargando ventas…</td></tr>`;

  // Una sola consulta trae la venta, su cliente, quién atendió y sus productos.
  // Las llaves foráneas garantizan que cliente, empleado y producto siempre existen.
  const { data, error } = await db
    .from('ventas')
    .select(`id, fecha, subtotal, descuento, iva, total,
             clientes(nombre, dui),
             perfiles(nombre),
             detalle_venta(producto_id, cantidad, precio_unitario, productos(nombre))`)
    .gte('fecha', rango.inicio.toISOString())
    .lt('fecha', rango.fin.toISOString())
    .order('fecha', { ascending: false });

  if (error) {
    console.error('Error al cargar las ventas:', error);
    tablaVentas.innerHTML = `
      <tr><td colspan="7" class="text-center text-danger py-4">
        No se pudieron cargar las ventas. Revisa tu conexión y recarga la página.
      </td></tr>`;
    return;
  }

  ventasDelDia = data;
  mostrarResumen();
  mostrarVentas();
  mostrarMasVendidos();
}

//Resumen

/**
 * Cuenta las unidades vendidas en una venta.
 * @param {object} venta
 * @returns {number}
 */
function contarArticulos(venta) {
  let articulos = 0; // Acumulador

  for (let i = 0; i < venta.detalle_venta.length; i++) {
    articulos = articulos + venta.detalle_venta[i].cantidad;
  }

  return articulos;
}

/** Calcula y muestra los 4 indicadores del día. */
function mostrarResumen() {
  const transacciones = ventasDelDia.length;  // Contador: una venta = una transacción
  let totalCentavos = 0;                      // Acumulador de dinero, en centavos
  let articulos = 0;                          // Acumulador de unidades

  for (let i = 0; i < ventasDelDia.length; i++) {
    const venta = ventasDelDia[i];
    totalCentavos = totalCentavos + Math.round(venta.total * 100);
    articulos = articulos + contarArticulos(venta);
  }

  // Si no hubo ventas, el promedio es 0 (no se puede dividir entre 0)
  let promedioCentavos = 0;
  if (transacciones > 0) {
    promedioCentavos = Math.round(totalCentavos / transacciones);
  }

  document.getElementById('resumenTotal').textContent = formatearDinero(totalCentavos / 100);
  document.getElementById('resumenTransacciones').textContent = transacciones;
  document.getElementById('resumenPromedio').textContent = formatearDinero(promedioCentavos / 100);
  document.getElementById('resumenArticulos').textContent = articulos;
}

//Tabla de ventas

/** Dibuja una fila por cada venta del día. */
function mostrarVentas() {
  if (ventasDelDia.length === 0) {
    tablaVentas.innerHTML = `
      <tr><td colspan="7" class="text-center text-secondary py-4">
        No hay ventas registradas en esta fecha.
      </td></tr>`;
    return;
  }

  let filas = ''; // Acumulador con el HTML de las filas

  for (let i = 0; i < ventasDelDia.length; i++) {
    const venta = ventasDelDia[i];
    const numero = String(venta.id).padStart(6, '0');
    const hora = formatearFechaHora(new Date(venta.fecha)).split(' ')[1]; // Solo "hh:mm"

    filas += `
      <tr>
        <td><span class="codigo">${numero}</span></td>
        <td>${hora}</td>
        <td>${escaparHTML(venta.clientes.nombre)}</td>
        <td>${escaparHTML(venta.perfiles.nombre)}</td>
        <td class="text-end">${contarArticulos(venta)}</td>
        <td class="text-end fw-semibold">${formatearDinero(venta.total)}</td>
        <td class="text-end">
          <button type="button" class="btn btn-sm btn-outline-secondary" data-accion="detalle"
                  data-id="${venta.id}" aria-label="Ver detalle de la venta ${numero}">
            <i class="bi bi-eye" aria-hidden="true"></i>
          </button>
        </td>
      </tr>`;
  }

  tablaVentas.innerHTML = filas;
}

//Producto mas vendido

/** Suma las unidades vendidas de cada producto y muestra los primeros. */
function mostrarMasVendidos() {
  const conteo = []; // [{ id, nombre, cantidad }]

  // Repetitiva anidada: recorremos cada venta y, dentro, cada producto vendido
  for (let i = 0; i < ventasDelDia.length; i++) {
    const detalle = ventasDelDia[i].detalle_venta;

    for (let j = 0; j < detalle.length; j++) {
      const linea = detalle[j];
      const existente = conteo.find(function (p) { return p.id === linea.producto_id; });

      if (existente) {
        existente.cantidad = existente.cantidad + linea.cantidad;   // Acumulador por producto
      } else {
        conteo.push({
          id: linea.producto_id,
          nombre: linea.productos.nombre,
          cantidad: linea.cantidad
        });
      }
    }
  }

  if (conteo.length === 0) {
    listaMasVendidos.innerHTML = `
      <li class="list-group-item text-secondary">Todavía no hay productos vendidos en esta fecha.</li>`;
    return;
  }

  // De mayor a menor cantidad vendida
  conteo.sort(function (a, b) { return b.cantidad - a.cantidad; });

  let elementos = '';
  const limite = Math.min(conteo.length, CANTIDAD_MAS_VENDIDOS);

  for (let i = 0; i < limite; i++) {
    elementos += `
      <li class="list-group-item d-flex justify-content-between align-items-start gap-2">
        <span class="me-auto ms-1">${escaparHTML(conteo[i].nombre)}</span>
        <span class="badge text-bg-secondary rounded-pill">${conteo[i].cantidad}</span>
      </li>`;
  }

  listaMasVendidos.innerHTML = elementos;
}

//Detalle de venta

/**
 * Muestra la factura de una venta ya registrada.
 * @param {number} id
 */
function verDetalle(id) {
  const venta = ventasDelDia.find(function (v) { return v.id === id; });

  const productos = [];
  for (let i = 0; i < venta.detalle_venta.length; i++) {
    const linea = venta.detalle_venta[i];
    productos.push({
      nombre: linea.productos.nombre,
      cantidad: linea.cantidad,
      precio: linea.precio_unitario
    });
  }

  // La base de datos guarda el monto del descuento; el porcentaje se calcula
  let porcentaje = 0;
  if (venta.subtotal > 0) {
    porcentaje = Math.round(venta.descuento * 100 / venta.subtotal);
  }

  document.getElementById('detalleVenta').innerHTML = htmlFactura({
    numero: venta.id,
    fecha: new Date(venta.fecha),
    cliente: venta.clientes.nombre,
    dui: venta.clientes.dui,
    atendio: venta.perfiles.nombre,
    productos: productos,
    subtotal: venta.subtotal,
    porcentaje: porcentaje,
    descuento: venta.descuento,
    iva: venta.iva,
    total: venta.total
  });

  ventanaDetalle.show();
}

// ---------- Eventos ----------

// Al cambiar la fecha se recalcula todo el reporte
campoFecha.addEventListener('change', cargarReporte);

// Botón "Hoy"
document.getElementById('botonHoy').addEventListener('click', function () {
  campoFecha.value = fechaISO(new Date());
  cargarReporte();
});

// Botón "Imprimir": imprime el reporte (la hoja oculta botones y menú)
document.getElementById('botonImprimirReporte').addEventListener('click', function () {
  window.print();
});

// Botones "ver detalle" de la tabla. Un solo evento para todas las filas.
tablaVentas.addEventListener('click', function (evento) {
  const boton = evento.target.closest('button[data-accion="detalle"]');
  if (boton !== null) {
    verDetalle(Number(boton.dataset.id));
  }
});

iniciarPagina();