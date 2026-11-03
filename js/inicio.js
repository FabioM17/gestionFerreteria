/**
 * inicio.js
 * Lógica del panel principal: indicadores y accesos a los módulos.
 */

/** Prepara la página: verifica la sesión, dibuja el menú y ajusta según el rol. */
async function iniciarPagina() {
  const perfil = await protegerPagina();
  if (perfil === null) {
    return; // Sin sesión: protegerPagina ya nos está enviando al login
  }

  mostrarMenu('inicio', 'Panel principal', perfil);

  if (esAdministrador(perfil)) {
    // Los indicadores de dinero solo los ve el Administrador
    const tarjetasAdmin = document.querySelectorAll('.solo-admin');
    for (let i = 0; i < tarjetasAdmin.length; i++) {
      tarjetasAdmin[i].classList.remove('d-none');
    }
    await cargarVentasDeHoy();
  } else {
    // El cajero no tiene acceso a Reportes: ocultamos su tarjeta
    document.getElementById('tarjetaReportes').classList.add('d-none');
  }

  await cargarReabastecer();
  await cargarClientes();
}

/** Total vendido y número de ventas de hoy (solo Administrador). */
async function cargarVentasDeHoy() {
  // Desde hoy a las 00:00 hasta mañana a las 00:00, en hora local
  const ahora = new Date();
  const inicio = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  const fin = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 1);

  const { data, error } = await db
    .from('ventas')
    .select('total')
    .gte('fecha', inicio.toISOString())
    .lt('fecha', fin.toISOString());

  if (error) {
    console.error('Error al cargar las ventas de hoy:', error);
    return; // Los indicadores se quedan con "—"
  }

  let totalCentavos = 0; // Acumulador, en centavos
  for (let i = 0; i < data.length; i++) {
    totalCentavos = totalCentavos + Math.round(data[i].total * 100);
  }

  document.getElementById('indicadorVendido').textContent = formatearDinero(totalCentavos / 100);
  document.getElementById('indicadorVentas').textContent = data.length;
}

/** Cuántos productos están agotados o con stock bajo (requerimiento 4). */
async function cargarReabastecer() {
  const { data, error } = await db
    .from('productos')
    .select('stock, stock_minimo');

  if (error) {
    console.error('Error al cargar los productos:', error);
    return;
  }

  let porReabastecer = 0; // Contador
  for (let i = 0; i < data.length; i++) {
    if (estadoStock(data[i]).texto !== 'Disponible') {
      porReabastecer = porReabastecer + 1;
    }
  }

  document.getElementById('indicadorReabastecer').textContent = porReabastecer;
}

/** Cuántos clientes hay registrados (sin contar "Consumidor final", que no tiene DUI). */
async function cargarClientes() {
  // count: 'exact' + head: true → Supabase solo devuelve la cantidad, no las filas
  const { count, error } = await db
    .from('clientes')
    .select('id', { count: 'exact', head: true })
    .not('dui', 'is', null);

  if (error) {
    console.error('Error al contar los clientes:', error);
    return;
  }

  document.getElementById('indicadorClientes').textContent = count;
}

iniciarPagina();