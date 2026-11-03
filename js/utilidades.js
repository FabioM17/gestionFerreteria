/**
 * utilidades.js
 * Funciones de apoyo que usan varias paginas del sistema
 */

// Formato de dólares: 1234.5 → "$1,234.50"
// Usamos 'en-US' porque da el mismo resultado en todos los navegadores,
// y coincide con el formato que se usa en El Salvador
const FORMATO_DINERO = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/**
 * Convierte un numero en texto con formato de dinero
 * @param {number} valor
 * @param {string}
 */

function formatearDinero(valor) {
    return FORMATO_DINERO.format(valor);
}

// Caracteres que tienen significado especial en HTML y su versión segura
const REEMPLAZOS_HTML = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/**
 * Hace seguro un texto para insertarlo dentro de innerHTML.
 * Evita que datos de la base de datos se interpreten como código (ataque XSS).
 * @param {string} texto
 * @returns {string}
 */
function escaparHTML(texto) {
    return String(texto).replace(/[&<>"']/g, function (caracter) {
        return REEMPLAZOS_HTML[caracter];
    });
}


/**
 * Determina el estado del inventario de un producto (requerimento 4)
 * @param {object} producto - debe tener stock y stock_minimo.
 * @returns {{texto: string, clase: string}}
 */
function estadoStock(producto) {
    if (producto.stock === 0) {
        return { texto: 'Agotado', clase: 'estado-agotado' };
    } else if (producto.stock <= producto.stock_minimo) {
        return { texto: 'Stock bajo', clase: 'estado-bajo' };
    } else {
        return { texto: 'Disponible', clase: 'estado-ok' };
    }
}

/**
 * Devuelve el icono de Bootstrap Icons que representa una categoria.
 * Se usa cuando un producto no tiene Imagen
 * @param {string} categoria - nombre de la categoria
 * @param {string} clase del icono.
*/
function iconoCategoria(categoria) {
    switch (categoria) {
        case 'Herramientas':
            return 'bi-hammer';
        case 'Tornillería':
            return 'bi-nut';
        case 'Electricidad':
            return 'bi-lightning-charge';
        case 'Plomería':
            return 'bi-droplet';
        case 'Pinturas':
            return 'bi-paint-bucket';
        case 'Construcción':
            return 'bi-bricks';
        default:
            return 'bi-box-seam';
    }
}

/**
 * Muestra un aviso breve en la esquina inferior derecha (toast de Bootstrap).
 * @param {string} mensaje
 */
function mostrarAviso(mensaje) {
    let contenedor = document.getElementById('contenedorAvisos');

    // La primera vez creamos el contenedor de avisos
    if (contenedor === null) {
        contenedor = document.createElement('div');
        contenedor.id = 'contenedorAvisos';
        contenedor.className = 'toast-container position-fixed bottom-0 end-0 p-3';
        document.body.appendChild(contenedor);
    }

    const aviso = document.createElement('div');
    aviso.className = 'toast align-items-center';
    aviso.setAttribute('role', 'status');
    aviso.setAttribute('aria-live', 'polite');
    aviso.innerHTML = `
    <div class="d-flex">
      <div class="toast-body"></div>
      <button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast" aria-label="Cerrar"></button>
    </div>`;
    aviso.querySelector('.toast-body').textContent = mensaje;
    contenedor.appendChild(aviso);

    const toast = new bootstrap.Toast(aviso, { delay: 3000 });
    toast.show();

    // Cuando el aviso se oculta, lo quitamos de la página
    aviso.addEventListener('hidden.bs.toast', function () {
        aviso.remove();
    });
}

/**
 * Prepara un texto para comparar en búsquedas: minúsculas y sin tildes.
 * Así "Jose" encuentra a "José" y "MARIA" encuentra a "María".
 * @param {string} texto
 * @returns {string}
 */
function normalizar(texto) {
  return String(texto)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Convierte una fecha en texto con formato AAAA-MM-DD, usando la hora local.
 * Es el formato que usan los campos <input type="date">.
 * @param {Date} fecha
 * @returns {string}
 */
function fechaISO(fecha) {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return anio + '-' + mes + '-' + dia;
}

/**
 * Convierte una fecha en texto "dd/mm/aaaa hh:mm" (hora local, formato de 24 horas).
 * @param {Date} fecha
 * @returns {string}
 */
function formatearFechaHora(fecha) {
  const dia = String(fecha.getDate()).padStart(2, '0');
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const hora = String(fecha.getHours()).padStart(2, '0');
  const minutos = String(fecha.getMinutes()).padStart(2, '0');
  return dia + '/' + mes + '/' + fecha.getFullYear() + ' ' + hora + ':' + minutos;
}

/**
 * Arma el HTML de una factura (requerimiento 8).
 * La usan Ventas (al registrar) y Reportes (al ver el detalle de una venta).
 * @param {object} venta - { numero, fecha, cliente, dui, atendio, productos, subtotal,
 *                           porcentaje, descuento, iva, total }
 *                         productos: [{ nombre, cantidad, precio }]
 * @returns {string}
 */
function htmlFactura(venta) {
  let filas = ''; // Acumulador con las filas de productos

  for (let i = 0; i < venta.productos.length; i++) {
    const p = venta.productos[i];
    filas += `
      <tr>
        <td class="text-end">${p.cantidad}</td>
        <td>${escaparHTML(p.nombre)}</td>
        <td class="text-end">${formatearDinero(p.precio)}</td>
        <td class="text-end">${formatearDinero(p.precio * p.cantidad)}</td>
      </tr>`;
  }

  const textoDescuento = venta.porcentaje > 0 ? 'Descuento (' + venta.porcentaje + ' %)' : 'Descuento';

  return `
    <div class="factura-encabezado">
      <div>
        <div class="factura-negocio">Ferretería El Tornillo</div>
        <small class="text-secondary">Gestión de ferretería</small>
      </div>
      <div class="text-end">
        <div class="fw-semibold">Factura N.º ${String(venta.numero).padStart(6, '0')}</div>
        <small class="text-secondary">${formatearFechaHora(venta.fecha)}</small>
      </div>
    </div>

    <div class="factura-datos">
      <div><span class="text-secondary">Cliente:</span> ${escaparHTML(venta.cliente)}</div>
      ${venta.dui ? `<div><span class="text-secondary">DUI:</span> ${escaparHTML(venta.dui)}</div>` : ''}
      <div><span class="text-secondary">Atendió:</span> ${escaparHTML(venta.atendio)}</div>
    </div>

    <table class="table table-sm align-middle factura-tabla">
      <thead>
        <tr>
          <th scope="col" class="text-end">Cant.</th>
          <th scope="col">Producto</th>
          <th scope="col" class="text-end">Precio</th>
          <th scope="col" class="text-end">Importe</th>
        </tr>
      </thead>
      <tbody>${filas}</tbody>
    </table>

    <div class="factura-totales">
      <div><span>Subtotal</span><span>${formatearDinero(venta.subtotal)}</span></div>
      <div><span>${textoDescuento}</span><span>-${formatearDinero(venta.descuento)}</span></div>
      <div><span>IVA (13 %)</span><span>${formatearDinero(venta.iva)}</span></div>
      <div class="factura-total"><span>Total</span><span>${formatearDinero(venta.total)}</span></div>
    </div>

    <p class="factura-gracias">¡Gracias por su compra!</p>`;
}

/**
 * Imprime solo la factura (o el contenido marcado con la clase "factura"),
 * no toda la página.
 */
function imprimirFactura() {
  document.body.classList.add('imprimiendo-factura');
  window.print();
}

// Al terminar de imprimir (o cancelar), la página vuelve a la normalidad
window.addEventListener('afterprint', function () {
  document.body.classList.remove('imprimiendo-factura');
});