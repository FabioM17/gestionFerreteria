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
