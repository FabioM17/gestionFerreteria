/**
 * menu.js
 * Dibuja el menú lateral y la barra superior en todas las páginas internas.
 * Así el menú se escribe una sola vez y no se repite en cada archivo HTML.
 */

// Opciones del menú. "soloAdmin" indica si el cajero NO debe verla.
const OPCIONES_MENU = [
  { id: 'inicio', texto: 'Inicio', icono: 'bi-house', url: 'inicio.html', soloAdmin: false },
  { id: 'productos', texto: 'Productos', icono: 'bi-box-seam', url: 'productos.html', soloAdmin: false },
  { id: 'clientes', texto: 'Clientes', icono: 'bi-people', url: 'clientes.html', soloAdmin: false },
  { id: 'ventas', texto: 'Ventas', icono: 'bi-cart3', url: 'ventas.html', soloAdmin: false },
  { id: 'reportes', texto: 'Reportes', icono: 'bi-bar-chart', url: 'reportes.html', soloAdmin: true },
  { id: 'usuarios', texto: 'Usuarios', icono: 'bi-person-gear', url: 'usuarios.html', soloAdmin: true }
];


/**
 * Dibuja el menú lateral y la barra superior, y muestra la página.
 * @param {string} paginaActual - id de la página abierta (para resaltarla).
 * @param {string} titulo - título que aparece en la barra superior.
 * @param {object} perfil - usuario conectado (nombre y rol).
 */
function mostrarMenu(paginaActual, titulo, perfil) {
  const admin = esAdministrador(perfil);
  let enlaces = ''; // Acumulador: aquí juntamos el HTML de cada opción

  // Estructura repetitiva: recorremos todas las opciones
  for (let i = 0; i < OPCIONES_MENU.length; i++) {
    const opcion = OPCIONES_MENU[i];

    // Si la opción es solo para administradores y el usuario no lo es, la saltamos
    if (opcion.soloAdmin && !admin) {
      continue;
    }

    const esActual = opcion.id === paginaActual;
    enlaces += `
      <li>
        <a href="${opcion.url}" class="${esActual ? 'activo' : ''}" ${esActual ? 'aria-current="page"' : ''}>
          <i class="bi ${opcion.icono}" aria-hidden="true"></i>${opcion.texto}
        </a>
      </li>`;
  }

  // ---------- Menú lateral ----------
  document.getElementById('menuLateral').innerHTML = `
    <div class="sidebar-cuerpo">
      <div class="d-flex align-items-start justify-content-between">
        <a class="marca" href="inicio.html">
          <span class="marca-icono"><i class="bi bi-tools" aria-hidden="true"></i></span>
          <span>
            <span class="marca-nombre">El Tornillo</span>
            <span class="marca-sub">Gestión de ferretería</span>
          </span>
        </a>
        <button type="button" class="btn-close btn-close-white d-lg-none m-3"
                data-bs-dismiss="offcanvas" aria-label="Cerrar menú" data-bs-target="#menuLateral"></button>
      </div>
      <div class="franja franja-delgada"></div>
      <nav aria-label="Menú principal">
        <ul class="menu">${enlaces}</ul>
      </nav>
    </div>`;

  // ---------- Barra superior ----------
  document.getElementById('barraSuperior').innerHTML = `
    <button class="btn btn-outline-secondary d-lg-none me-2" type="button"
            data-bs-toggle="offcanvas" data-bs-target="#menuLateral"
            aria-controls="menuLateral" aria-label="Abrir menú">
      <i class="bi bi-list" aria-hidden="true"></i>
    </button>
    <h1 class="titulo-pagina mb-0">${titulo}</h1>
    <div class="ms-auto d-flex align-items-center gap-3">
      <div class="text-end d-none d-sm-block lh-sm">
        <div id="nombreUsuario" class="fw-semibold"></div>
        <small id="rolUsuario" class="text-secondary"></small>
      </div>
      <button id="botonSalir" class="btn btn-outline-secondary btn-sm" type="button" aria-label="Cerrar sesión">
        <i class="bi bi-box-arrow-right" aria-hidden="true"></i>
        <span class="d-none d-md-inline ms-1">Cerrar sesión</span>
      </button>
    </div>`;

  // Los datos del usuario vienen de la base de datos: se insertan como texto, no como HTML
  document.getElementById('nombreUsuario').textContent = perfil.nombre;
  document.getElementById('rolUsuario').textContent = perfil.rol;

  document.getElementById('botonSalir').addEventListener('click', cerrarSesion);

  // Ya confirmamos la sesión: mostramos la página
  document.body.classList.remove('verificando');
}