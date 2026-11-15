/**
 * reportes.js
 * Reporte de ventas por día, rango de fechas, mes o año (solo Administrador).
 * Requerimiento 10: total vendido y cantidad de transacciones,
 * calculados con estructuras repetitivas y acumuladores.
 * Los gráficos se dibujan con la librería Chart.js.
 */

// ---------- Datos de la página ----------
let ventasDelPeriodo = [];     // Ventas del período elegido, con su detalle
let graficoVentas = null;      // Gráfico de barras (objeto de Chart.js)
let graficoCategorias = null;  // Gráfico circular (objeto de Chart.js)

// Cuántos productos se muestran en "Productos más vendidos"
const CANTIDAD_MAS_VENDIDOS = 5;

// Cuántos años aparecen en la lista: el actual y los anteriores
const ANIOS_EN_LISTA = 5;

// Un día en milisegundos: 24 horas × 60 minutos × 60 segundos × 1000
const MS_POR_DIA = 24 * 60 * 60 * 1000;

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// Colores de la marca para los gráficos
const COLOR_BARRAS = '#F2B705';
const COLORES_CATEGORIAS = ['#F2B705', '#22303C', '#8FA3B5', '#E07A2E', '#5B6874', '#3E7CB1', '#C9D3DC'];
const COLOR_VACIO = '#D5DBE1';

// Letra y color de los textos de todos los gráficos
Chart.defaults.font.family = 'Barlow, sans-serif';
Chart.defaults.color = '#5B6874';

// ---------- Referencias a elementos ----------
const tipoReporte = document.getElementById('tipoReporte');
const campoFecha = document.getElementById('fechaReporte');
const campoDesde = document.getElementById('fechaDesde');
const campoHasta = document.getElementById('fechaHasta');
const listaMeses = document.getElementById('mesReporte');
const listaAnios = document.getElementById('anioReporte');
const alertaFiltro = document.getElementById('alertaFiltro');
const tablaVentas = document.getElementById('tablaVentas');
const listaMasVendidos = document.getElementById('listaMasVendidos');
const ventanaDetalle = new bootstrap.Modal(document.getElementById('modalDetalleVenta'));

/** Prepara la página: sesión, permiso de administrador y reporte de hoy. */
async function iniciarPagina() {
  const perfil = await protegerPagina();
  if (perfil === null) {
    return;
  }

  // Requerimiento 11: el reporte es solo para el Administrador.
  // El cajero que escriba la dirección a mano vuelve al inicio.
  if (!esAdministrador(perfil)) {
    location.replace('inicio.html');
    return;
  }

  mostrarMenu('reportes', 'Reportes', perfil);

  // No tiene sentido pedir días que todavía no llegan
  const hoy = fechaISO(new Date());
  campoFecha.max = hoy;
  campoDesde.max = hoy;
  campoHasta.max = hoy;

  // Valores iniciales: hoy, y el rango "esta semana" ya preparado
  campoFecha.value = hoy;
  campoDesde.value = fechaISO(lunesDeEstaSemana());
  campoHasta.value = hoy;
  llenarMesesYAnios();

  mostrarControles();
  await cargarReporte();
}

// =========================================================
// ELECCIÓN DEL PERÍODO
// =========================================================

/** Llena las listas de meses y años, con el mes y el año actuales elegidos. */
function llenarMesesYAnios() {
  const hoy = new Date();

  for (let i = 0; i < MESES.length; i++) {
    listaMeses.add(new Option(MESES[i], i)); // El valor es 0 a 11, como en JavaScript
  }
  listaMeses.value = hoy.getMonth();

  for (let i = 0; i < ANIOS_EN_LISTA; i++) {
    const anio = hoy.getFullYear() - i;
    listaAnios.add(new Option(anio, anio));
  }
}

/** Muestra solo los campos que necesita el tipo de reporte elegido. */
function mostrarControles() {
  const tipo = tipoReporte.value;

  document.getElementById('controlesDia').classList.toggle('d-none', tipo !== 'dia');
  document.getElementById('controlesRango').classList.toggle('d-none', tipo !== 'rango');
  document.getElementById('controlesMes').classList.toggle('d-none', tipo !== 'mes');
  // El año se usa tanto en "Un mes" como en "Un año"
  document.getElementById('controlesAnio').classList.toggle('d-none', tipo !== 'mes' && tipo !== 'anio');
}

/**
 * Convierte el texto de un campo de fecha en una fecha a las 00:00, hora local.
 * Ejemplo: "2026-11-16" → 16/11/2026 00:00.
 * @param {string} texto
 * @returns {Date}
 */
function textoAFecha(texto) {
  const partes = texto.split('-');
  return new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2])); // Meses de 0 a 11
}

/**
 * Fecha sin hora: "16/11/2026".
 * @param {Date} fecha
 * @returns {string}
 */
function fechaCorta(fecha) {
  return formatearFechaHora(fecha).split(' ')[0];
}

/** Devuelve el lunes de la semana actual, a las 00:00. */
function lunesDeEstaSemana() {
  const hoy = new Date();
  // getDay(): domingo = 0, lunes = 1 … sábado = 6. Cuántos días pasaron desde el lunes:
  const diasDesdeLunes = (hoy.getDay() + 6) % 7;
  return new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - diasDesdeLunes);
}

/**
 * Calcula el período del reporte según lo que eligió el usuario.
 * "fin" es el primer instante que YA NO entra (por eso la consulta usa "menor que").
 * @returns {{inicio: Date, fin: Date, texto: string, agrupar: string, error: string}}
 *   agrupar = cómo se arman las barras del gráfico: 'hora', 'dia' o 'mes'.
 */
function obtenerPeriodo() {
  const anio = Number(listaAnios.value);
  const mes = Number(listaMeses.value);
  let inicio;
  let fin;
  let texto;
  let agrupar;

  switch (tipoReporte.value) {
    case 'dia':
      if (campoFecha.value === '') {
        campoFecha.value = fechaISO(new Date()); // Si borran la fecha, se vuelve a hoy
      }
      inicio = textoAFecha(campoFecha.value);
      fin = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + 1);
      texto = 'del ' + fechaCorta(inicio);
      agrupar = 'hora';
      break;

    case 'rango': {
      if (campoDesde.value === '' || campoHasta.value === '') {
        return { error: 'Elige las dos fechas del rango.' };
      }
      inicio = textoAFecha(campoDesde.value);
      const ultimoDia = textoAFecha(campoHasta.value);
      if (inicio > ultimoDia) {
        return { error: 'La fecha "Desde" no puede ser posterior a la fecha "Hasta".' };
      }
      fin = new Date(ultimoDia.getFullYear(), ultimoDia.getMonth(), ultimoDia.getDate() + 1);
      texto = 'del ' + fechaCorta(inicio) + ' al ' + fechaCorta(ultimoDia);
      // Hasta 2 meses, una barra por día; más largo, una barra por mes
      const dias = Math.round((fin - inicio) / MS_POR_DIA);
      agrupar = dias > 62 ? 'mes' : 'dia';
      break;
    }

    case 'mes':
      inicio = new Date(anio, mes, 1);
      fin = new Date(anio, mes + 1, 1); // Día 1 del mes siguiente (diciembre + 1 = enero del otro año)
      texto = 'de ' + MESES[mes].toLowerCase() + ' de ' + anio;
      agrupar = 'dia';
      break;

    case 'anio':
      inicio = new Date(anio, 0, 1);
      fin = new Date(anio + 1, 0, 1);
      texto = 'del año ' + anio;
      agrupar = 'mes';
      break;
  }

  return { inicio: inicio, fin: fin, texto: texto, agrupar: agrupar, error: '' };
}

/**
 * Muestra u oculta el aviso del filtro.
 * @param {string} mensaje - '' para ocultarlo.
 */
function mostrarAlertaFiltro(mensaje) {
  alertaFiltro.textContent = mensaje;
  alertaFiltro.classList.toggle('d-none', mensaje === '');
}

// =========================================================
// CONSULTA
// =========================================================

/** Consulta las ventas del período elegido y dibuja todo el reporte. */
async function cargarReporte() {
  const periodo = obtenerPeriodo();
  mostrarAlertaFiltro(periodo.error);
  if (periodo.error !== '') {
    return;
  }

  // Texto que sale en el encabezado impreso: "del 10/11/2026 al 16/11/2026"
  document.getElementById('periodoImpresion').textContent = periodo.texto;

  tablaVentas.innerHTML = `
    <tr><td colspan="7" class="text-center text-secondary py-4">Cargando ventas…</td></tr>`;

  // Una sola consulta trae la venta, su cliente, quién atendió y sus productos con su categoría.
  // Las llaves foráneas garantizan que cliente, empleado y producto siempre existen.
  const { data, error } = await db
    .from('ventas')
    .select(`id, fecha, subtotal, descuento, iva, total,
             clientes(nombre, dui),
             perfiles(nombre),
             detalle_venta(producto_id, cantidad, precio_unitario, productos(nombre, categorias(nombre)))`)
    .gte('fecha', periodo.inicio.toISOString())
    .lt('fecha', periodo.fin.toISOString())
    .order('fecha', { ascending: false });

  if (error) {
    console.error('Error al cargar las ventas:', error);
    tablaVentas.innerHTML = `
      <tr><td colspan="7" class="text-center text-danger py-4">
        No se pudieron cargar las ventas. Revisa tu conexión y recarga la página.
      </td></tr>`;
    return;
  }

  ventasDelPeriodo = data;
  mostrarResumen();
  mostrarGraficoVentas(periodo);
  mostrarGraficoCategorias();
  mostrarVentas();
  mostrarMasVendidos();
}

// =========================================================
// RESUMEN (requerimiento 10: repetitivas + acumuladores)
// =========================================================

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

/** Calcula y muestra los 4 indicadores del período. */
function mostrarResumen() {
  const transacciones = ventasDelPeriodo.length;  // Contador: una venta = una transacción
  let totalCentavos = 0;                          // Acumulador de dinero, en centavos
  let articulos = 0;                              // Acumulador de unidades

  for (let i = 0; i < ventasDelPeriodo.length; i++) {
    const venta = ventasDelPeriodo[i];
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

// =========================================================
// GRÁFICOS (Chart.js)
// =========================================================

/**
 * Reparte el total vendido en grupos para el gráfico de barras:
 * por hora (un día), por día (rango corto o un mes) o por mes (un año o rango largo).
 * @param {object} periodo - lo que devuelve obtenerPeriodo().
 * @returns {{etiquetas: string[], valores: number[]}}
 */
function agruparVentas(periodo) {
  const etiquetas = [];
  const centavos = [];  // Un acumulador por grupo
  const inicio = periodo.inicio;

  // Hora de la primera y la última venta (para no dibujar 24 barras vacías)
  let primeraHora = 23;
  let ultimaHora = 0;

  // 1. Se crean los grupos vacíos
  if (periodo.agrupar === 'hora') {
    for (let i = 0; i < ventasDelPeriodo.length; i++) {
      const hora = new Date(ventasDelPeriodo[i].fecha).getHours();
      primeraHora = Math.min(primeraHora, hora);
      ultimaHora = Math.max(ultimaHora, hora);
    }
    if (ventasDelPeriodo.length === 0) {
      primeraHora = 7;   // Sin ventas: horario típico de la tienda
      ultimaHora = 18;
    }
    for (let hora = primeraHora; hora <= ultimaHora; hora++) {
      etiquetas.push(String(hora).padStart(2, '0') + ':00');
      centavos.push(0);
    }
  } else if (periodo.agrupar === 'dia') {
    const dias = Math.round((periodo.fin - inicio) / MS_POR_DIA);
    for (let i = 0; i < dias; i++) {
      const dia = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i);
      etiquetas.push(fechaCorta(dia).substring(0, 5)); // "16/11"
      centavos.push(0);
    }
  } else {
    const meses = (periodo.fin.getFullYear() - inicio.getFullYear()) * 12
      + periodo.fin.getMonth() - inicio.getMonth();
    for (let i = 0; i < meses; i++) {
      const mes = new Date(inicio.getFullYear(), inicio.getMonth() + i, 1);
      // Si el período pasa de un año, se agrega el año para no confundir los meses
      const etiqueta = meses > 12
        ? MESES_CORTOS[mes.getMonth()] + ' ' + mes.getFullYear()
        : MESES_CORTOS[mes.getMonth()];
      etiquetas.push(etiqueta);
      centavos.push(0);
    }
  }

  // 2. Cada venta suma su total en el grupo que le toca
  for (let i = 0; i < ventasDelPeriodo.length; i++) {
    const venta = ventasDelPeriodo[i];
    const fecha = new Date(venta.fecha);
    let posicion;

    if (periodo.agrupar === 'hora') {
      posicion = fecha.getHours() - primeraHora;
    } else if (periodo.agrupar === 'dia') {
      posicion = Math.floor((fecha - inicio) / MS_POR_DIA);
    } else {
      posicion = (fecha.getFullYear() - inicio.getFullYear()) * 12 + fecha.getMonth() - inicio.getMonth();
    }

    centavos[posicion] = centavos[posicion] + Math.round(venta.total * 100);
  }

  // 3. De centavos a dólares
  const valores = [];
  for (let i = 0; i < centavos.length; i++) {
    valores.push(centavos[i] / 100);
  }

  return { etiquetas: etiquetas, valores: valores };
}

/**
 * Dibuja el gráfico de barras con el total vendido del período.
 * @param {object} periodo
 */
function mostrarGraficoVentas(periodo) {
  const datos = agruparVentas(periodo);

  let titulo;
  switch (periodo.agrupar) {
    case 'hora': titulo = 'Ventas por hora'; break;
    case 'dia': titulo = 'Ventas por día'; break;
    default: titulo = 'Ventas por mes';
  }
  document.getElementById('tituloGraficoVentas').textContent = titulo;

  // Chart.js no deja dibujar dos gráficos en el mismo canvas: se borra el anterior
  if (graficoVentas !== null) {
    graficoVentas.destroy();
  }

  graficoVentas = new Chart(document.getElementById('graficoVentas'), {
    type: 'bar',
    data: {
      labels: datos.etiquetas,
      datasets: [{
        label: 'Total vendido',
        data: datos.valores,
        backgroundColor: COLOR_BARRAS,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,   // Usa el alto que le da el CSS (.grafico)
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function (contexto) { return formatearDinero(contexto.parsed.y); }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: function (valor) { return formatearDinero(valor); } }
        },
        x: { grid: { display: false } }
      }
    }
  });
}

/** Dibuja el gráfico circular con lo vendido por categoría (precio × cantidad). */
function mostrarGraficoCategorias() {
  const nombres = [];   // Categorías encontradas
  const centavos = [];  // Un acumulador por categoría

  // Repetitiva anidada: cada venta y, dentro, cada producto vendido
  for (let i = 0; i < ventasDelPeriodo.length; i++) {
    const detalle = ventasDelPeriodo[i].detalle_venta;

    for (let j = 0; j < detalle.length; j++) {
      const linea = detalle[j];
      const categoria = linea.productos.categorias ? linea.productos.categorias.nombre : 'Sin categoría';
      let posicion = nombres.indexOf(categoria);

      if (posicion === -1) {
        nombres.push(categoria);
        centavos.push(0);
        posicion = nombres.length - 1;
      }

      centavos[posicion] = centavos[posicion] + Math.round(linea.precio_unitario * 100) * linea.cantidad;
    }
  }

  const valores = [];
  for (let i = 0; i < centavos.length; i++) {
    valores.push(centavos[i] / 100);
  }

  // Sin ventas se dibuja un aro gris con un solo texto
  const hayDatos = nombres.length > 0;

  if (graficoCategorias !== null) {
    graficoCategorias.destroy();
  }

  graficoCategorias = new Chart(document.getElementById('graficoCategorias'), {
    type: 'doughnut',
    data: {
      labels: hayDatos ? nombres : ['Sin ventas en el período'],
      datasets: [{
        data: hayDatos ? valores : [1],
        backgroundColor: hayDatos ? COLORES_CATEGORIAS : [COLOR_VACIO],
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          enabled: hayDatos,
          callbacks: {
            label: function (contexto) { return contexto.label + ': ' + formatearDinero(contexto.parsed); }
          }
        }
      }
    }
  });
}

// =========================================================
// TABLA DE VENTAS
// =========================================================

/** Dibuja una fila por cada venta del período. */
function mostrarVentas() {
  if (ventasDelPeriodo.length === 0) {
    tablaVentas.innerHTML = `
      <tr><td colspan="7" class="text-center text-secondary py-4">
        No hay ventas registradas en este período.
      </td></tr>`;
    return;
  }

  let filas = ''; // Acumulador con el HTML de las filas

  for (let i = 0; i < ventasDelPeriodo.length; i++) {
    const venta = ventasDelPeriodo[i];
    const numero = String(venta.id).padStart(6, '0');

    filas += `
      <tr>
        <td><span class="codigo">${numero}</span></td>
        <td class="text-nowrap">${formatearFechaHora(new Date(venta.fecha))}</td>
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

// =========================================================
// PRODUCTOS MÁS VENDIDOS
// =========================================================

/** Suma las unidades vendidas de cada producto y muestra los primeros. */
function mostrarMasVendidos() {
  const conteo = []; // [{ id, nombre, cantidad }]

  // Repetitiva anidada: recorremos cada venta y, dentro, cada producto vendido
  for (let i = 0; i < ventasDelPeriodo.length; i++) {
    const detalle = ventasDelPeriodo[i].detalle_venta;

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
      <li class="list-group-item text-secondary">Todavía no hay productos vendidos en este período.</li>`;
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

// =========================================================
// DETALLE DE UNA VENTA (reutiliza la factura de Ventas)
// =========================================================

/**
 * Muestra la factura de una venta ya registrada.
 * @param {number} id
 */
function verDetalle(id) {
  const venta = ventasDelPeriodo.find(function (v) { return v.id === id; });

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

// Al cambiar el tipo de reporte se muestran sus campos y se recalcula
tipoReporte.addEventListener('change', function () {
  mostrarControles();
  cargarReporte();
});

// Al cambiar cualquier fecha, mes o año se recalcula todo el reporte
campoFecha.addEventListener('change', cargarReporte);
campoDesde.addEventListener('change', cargarReporte);
campoHasta.addEventListener('change', cargarReporte);
listaMeses.addEventListener('change', cargarReporte);
listaAnios.addEventListener('change', cargarReporte);

// Botón "Hoy"
document.getElementById('botonHoy').addEventListener('click', function () {
  tipoReporte.value = 'dia';
  campoFecha.value = fechaISO(new Date());
  mostrarControles();
  cargarReporte();
});

// Botón "Esta semana": de lunes a hoy
document.getElementById('botonSemana').addEventListener('click', function () {
  tipoReporte.value = 'rango';
  campoDesde.value = fechaISO(lunesDeEstaSemana());
  campoHasta.value = fechaISO(new Date());
  mostrarControles();
  cargarReporte();
});

// Botón "Imprimir": imprime el reporte (la hoja oculta menú, barra y botones)
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