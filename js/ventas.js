
 /**
 * Ventas.js
 * Módulo de ventas.
 * Por ahora solo protege la página y dibuja el menú.
 */

/** Prepara la página: verifica la sesión y dibuja el menú. */
async function iniciarPagina() {
  const perfil = await protegerPagina();
  if (perfil === null) {
    return;
  }

      mostrarMenu('ventas', 'Ventas', perfil);

}

iniciarPagina();