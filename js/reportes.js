
  /**
 * reportes.js
 * Módulo de reportes.
 * Por ahora solo protege la página y dibuja el menú.
 */

/** Prepara la página: verifica la sesión y dibuja el menú. */
async function iniciarPagina() {
  const perfil = await protegerPagina();
  if (perfil === null) {
    return;
  }

    mostrarMenu('reportes', 'Reportes', perfil);
}

iniciarPagina();