/**
 * productos.js
 * Módulo de productos: listado, registro, edición y eliminación.
 */

// ---------- Datos de la página ----------
let productos = [];       // Lista de productos cargada desde Supabase
let categorias = [];      // Lista de categorías cargada desde Supabase
let idEditando = null;    // id del producto que se edita (null = producto nuevo)
let codigoSugerido = '';  // Último código que el sistema sugirió
let productoEliminando = null; // Producto que se va a eliminar (espera confirmación)
let productoFicha = null;      // Producto que se está viendo en la ficha
let puedeEditar = false;       // true si el usuario es Administrador

// Unidades de venta disponibles (lista fija)
const UNIDADES = ['Unidad', 'Caja', 'Libra', 'Metro', 'Galón', 'Bolsa'];

// Campos del formulario, en el orden en que aparecen
const CAMPOS = ['categoria', 'codigo', 'nombre', 'marca', 'unidad', 'costo', 'precio', 'stock', 'stockMinimo'];

// Formato de código: 3 letras, guion y 3 números (ejemplo: HER-001)
const FORMATO_CODIGO = /^[A-Z]{3}-\d{3}$/;

// ---------- Imagen del producto ----------
const BUCKET_IMAGENES = 'productos';                          // Carpeta de Supabase Storage
const TIPOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp'];
const TAMANO_MAXIMO = 2 * 1024 * 1024;                        // 2 MB expresados en bytes

let archivoImagen = null;   // Foto nueva que eligió el empleado (aún no subida)
let imagenActual = null;    // URL de la imagen que ya tiene el producto que se edita
let quitarImagen = false;   // true si el empleado quitó la imagen actual
let urlVistaPrevia = null;  // Dirección temporal de la vista previa en el navegador

// ---------- Referencias a elementos ----------
const tablaProductos = document.getElementById('tablaProductos');
const contador = document.getElementById('contador');
const formProducto = document.getElementById('formProducto');
const alertaFormulario = document.getElementById('alertaFormulario');
const botonGuardar = document.getElementById('botonGuardar');
const ventanaProducto = new bootstrap.Modal(document.getElementById('modalProducto'));
const ventanaEliminar = new bootstrap.Modal(document.getElementById('modalEliminar'));
const alertaEliminar = document.getElementById('alertaEliminar');
const botonConfirmarEliminar = document.getElementById('botonConfirmarEliminar');
const buscarInventario = document.getElementById('buscarInventario');
const filtroCategoria = document.getElementById('filtroCategoria');
const filtroMarca = document.getElementById('filtroMarca');
const filtroEstado = document.getElementById('filtroEstado');
const alertaStock = document.getElementById('alertaStock');
const ventanaFicha = new bootstrap.Modal(document.getElementById('modalFicha'));

/** Prepara la página: sesión, menú, permisos y carga de datos. */
async function iniciarPagina() {
    const perfil = await protegerPagina();
    if (perfil === null) {
        return;
    }

    mostrarMenu('productos', 'Productos', perfil);

    // Solo el administrador puede agregar, editar o eliminar
    puedeEditar = esAdministrador(perfil);
    if (puedeEditar) {
        document.getElementById('botonNuevo').classList.remove('d-none');
    } else {
        document.getElementById('tablaInventario').classList.add('solo-lectura');
    }

    llenarUnidades();
    await cargarCategorias();
    await cargarProductos();
}

/** Consulta los productos en Supabase y los muestra en la tabla. */
async function cargarProductos() {
    mostrarMensajeTabla('Cargando productos…');

    const { data, error } = await db
        .from('productos')
        .select('id, codigo, nombre, marca, unidad, costo, precio, stock, stock_minimo, imagen_url, categoria_id, categorias(nombre)')
        .order('codigo');

    if (error) {
        console.error('Error al cargar productos:', error);
        mostrarMensajeTabla('No se pudieron cargar los productos. Revisa tu conexión y recarga la página.');
        return;
    }

    productos = data;
    llenarMarcas();
    filtrarProductos();
    mostrarAlertaStock();
}

/**
 * Muestra un mensaje que ocupa toda la tabla (cargando, error o sin resultados).
 * @param {string} mensaje
 */
function mostrarMensajeTabla(mensaje) {
    tablaProductos.innerHTML = `
    <tr>
      <td colspan="8" class="text-center text-secondary py-5">${mensaje}</td>
    </tr>`;
    contador.textContent = '';
}

/**
 * Dibuja las filas de la tabla con una lista de productos.
 * @param {Array} lista - productos a mostrar.
 */
function mostrarProductos(lista) {
    if (lista.length === 0) {
        mostrarMensajeTabla('No hay productos que coincidan con la búsqueda.');
        return;
    }

    let filas = ''; // Acumulador con el HTML de todas las filas

    for (let i = 0; i < lista.length; i++) {
        const producto = lista[i];
        const categoria = producto.categorias ? producto.categorias.nombre : 'Sin categoría';
        const estado = estadoStock(producto);
        const nombre = escaparHTML(producto.nombre);

        filas += `
      <tr>
        <td>${miniatura(producto, categoria)}</td>
        <td class="codigo">${escaparHTML(producto.codigo)}</td>
        <td>
                    <button type="button" class="btn btn-link p-0 fw-semibold text-start text-reset" data-accion="ver"
                  data-id="${producto.id}" aria-label="Ver ficha de ${nombre}">${nombre}</button>
          <small class="text-secondary">${escaparHTML(producto.marca)} · ${escaparHTML(producto.unidad)}</small>
        </td>
        <td>${escaparHTML(categoria)}</td>
        <td class="text-end">${formatearDinero(producto.precio)}</td>
        <td class="text-end text-nowrap">
          ${producto.stock} <small class="text-secondary">/ mín. ${producto.stock_minimo}</small>
        </td>
        <td><span class="badge ${estado.clase}">${estado.texto}</span></td>
        <td class="text-end text-nowrap acciones-admin">
          <button type="button" class="btn btn-sm btn-outline-secondary" data-accion="editar"
                  data-id="${producto.id}" aria-label="Editar ${nombre}">
            <i class="bi bi-pencil" aria-hidden="true"></i>
          </button>
          <button type="button" class="btn btn-sm btn-outline-danger" data-accion="eliminar"
                  data-id="${producto.id}" aria-label="Eliminar ${nombre}">
            <i class="bi bi-trash" aria-hidden="true"></i>
          </button>
        </td>
      </tr>`;
    }

    tablaProductos.innerHTML = filas;
    contador.textContent = `Mostrando ${lista.length} de ${productos.length} productos`;
}

/**
 * Devuelve el HTML de la miniatura: la imagen del producto o el ícono de su categoría.
 * @param {object} producto
 * @param {string} categoria
 * @returns {string}
 */
function miniatura(producto, categoria) {
    if (producto.imagen_url) {
        return `<img src="${escaparHTML(producto.imagen_url)}" alt="" class="miniatura" loading="lazy">`;
    }
    return `<span class="miniatura"><i class="bi ${iconoCategoria(categoria)}" aria-hidden="true"></i></span>`;
}

//Busqueda, Filtro y alerta de inventario

/** Muestra solo los productos que cumplen con la búsqueda y los tres filtros. */
function filtrarProductos() {
    const texto = normalizar(buscarInventario.value.trim());
    const categoriaId = Number(filtroCategoria.value);   // 0 = todas
    const marca = filtroMarca.value;                     // '' = todas
    const estadoElegido = filtroEstado.value;            // '' = todos
    const resultado = [];

    for (let i = 0; i < productos.length; i++) {
        const producto = productos[i];
        const estado = estadoStock(producto).texto;

        const coincideTexto = texto === ''
            || normalizar(producto.nombre).includes(texto)
            || normalizar(producto.codigo).includes(texto);
        const coincideCategoria = categoriaId === 0 || producto.categoria_id === categoriaId;
        const coincideMarca = marca === '' || producto.marca === marca;

        // "Por reabastecer" junta los dos estados que necesitan compra
        let coincideEstado;
        if (estadoElegido === 'reabastecer') {
            coincideEstado = estado === 'Stock bajo' || estado === 'Agotado';
        } else {
            coincideEstado = estadoElegido === '' || estado === estadoElegido;
        }

        // Operador lógico &&: el producto se muestra solo si cumple TODO
        if (coincideTexto && coincideCategoria && coincideMarca && coincideEstado) {
            resultado.push(producto);
        }
    }

    mostrarProductos(resultado);
}

/** Avisa cuántos productos están agotados o con stock bajo (requerimiento 4). */
function mostrarAlertaStock() {
    let agotados = 0;   // Contadores
    let bajos = 0;

    for (let i = 0; i < productos.length; i++) {
        const estado = estadoStock(productos[i]).texto;
        if (estado === 'Agotado') {
            agotados = agotados + 1;
        } else if (estado === 'Stock bajo') {
            bajos = bajos + 1;
        }
    }

    const total = agotados + bajos;
    if (total === 0) {
        alertaStock.classList.add('d-none');
        return;
    }

    alertaStock.innerHTML = `
    <i class="bi bi-exclamation-triangle-fill" aria-hidden="true"></i>
    <strong>${total} ${total === 1 ? 'producto necesita' : 'productos necesitan'} reabastecerse:</strong>
    ${agotados} agotado${agotados === 1 ? '' : 's'} y ${bajos} con stock bajo.
    <button type="button" id="botonVerReabastecer" class="btn btn-sm btn-link p-0 align-baseline">Ver productos</button>`;
    alertaStock.classList.remove('d-none');
}

// FICHA DEL PRODUCTO (toda su información en una ventana)

/**
 * Llena y abre la ventana con la ficha de un producto.
 * El costo y la ganancia solo los ve el Administrador.
 * @param {object} producto
 */
function mostrarFicha(producto) {
    productoFicha = producto;
    const categoria = producto.categorias ? producto.categorias.nombre : 'Sin categoría';
    const estado = estadoStock(producto);
    const nombre = escaparHTML(producto.nombre);

    // Imagen grande, o el ícono de la categoría si no tiene
    let imagen;
    if (producto.imagen_url) {
        imagen = `<img src="${escaparHTML(producto.imagen_url)}" alt="Foto de ${nombre}">`;
    } else {
        imagen = `<i class="bi ${iconoCategoria(categoria)}" aria-hidden="true"></i>`;
    }

    // Datos que ve cualquier empleado
    let datos = `
      <dt>Código</dt>          <dd class="codigo">${escaparHTML(producto.codigo)}</dd>
      <dt>Marca</dt>           <dd>${escaparHTML(producto.marca)}</dd>
      <dt>Categoría</dt>       <dd>${escaparHTML(categoria)}</dd>
      <dt>Unidad de venta</dt> <dd>${escaparHTML(producto.unidad)}</dd>
      <dt>Precio de venta</dt> <dd class="fw-semibold">${formatearDinero(producto.precio)}</dd>
      <dt>Stock</dt>           <dd>${producto.stock} <small class="text-secondary">(mínimo ${producto.stock_minimo})</small></dd>
      <dt>Estado</dt>          <dd><span class="badge ${estado.clase}">${estado.texto}</span></dd>`;

    // Datos del negocio: solo para el Administrador
    if (puedeEditar) {
        // Operadores aritméticos: ganancia, margen y valor del inventario
        const ganancia = producto.precio - producto.costo;
        const margen = producto.precio > 0 ? (ganancia / producto.precio) * 100 : 0;
        const valorInventario = producto.stock * producto.costo;

        datos += `
      <dt>Costo</dt>               <dd>${formatearDinero(producto.costo)}</dd>
      <dt>Ganancia por unidad</dt> <dd>${formatearDinero(ganancia)} <small class="text-secondary">(${margen.toFixed(1)} % del precio)</small></dd>
      <dt>Valor en inventario</dt> <dd>${formatearDinero(valorInventario)} <small class="text-secondary">(stock × costo)</small></dd>`;
    }

    document.getElementById('fichaProducto').innerHTML = `
      <div class="row g-4">
        <div class="col-md-5">
          <div class="ficha-imagen">${imagen}</div>
        </div>
        <div class="col-md-7">
          <h3 class="h4 mb-3">${nombre}</h3>
          <dl class="ficha-datos">${datos}</dl>
        </div>
      </div>`;

    // El botón "Editar producto" solo aparece para el Administrador
    document.getElementById('botonEditarFicha').classList.toggle('d-none', !puedeEditar);
    ventanaFicha.show();
}

//Formulario, cargar y editar productos

/** Carga las categorías desde Supabase y llena la lista desplegable. */
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
    const lista = document.getElementById('categoria');
    for (let i = 0; i < categorias.length; i++) {
        lista.add(new Option(categorias[i].nombre, categorias[i].id));
        filtroCategoria.add(new Option(categorias[i].nombre, categorias[i].id));
    }
}

/** Llena la lista desplegable de unidades de venta. */
function llenarUnidades() {
    const lista = document.getElementById('unidad');
    for (let i = 0; i < UNIDADES.length; i++) {
        lista.add(new Option(UNIDADES[i], UNIDADES[i]));
    }
}

/** Sugiere las marcas ya registradas mientras se escribe (sin repetirlas). */
function llenarMarcas() {
    const marcas = [];
    for (let i = 0; i < productos.length; i++) {
        if (!marcas.includes(productos[i].marca)) {
            marcas.push(productos[i].marca);
        }
    }
    marcas.sort();

    const lista = document.getElementById('listaMarcas');
    lista.innerHTML = '';
    for (let i = 0; i < marcas.length; i++) {
        lista.appendChild(new Option(marcas[i]));
    }


    // También llenamos el filtro de marcas, sin perder la marca que estaba elegida
    const marcaElegida = filtroMarca.value;
    filtroMarca.innerHTML = '<option value="">Todas las marcas</option>';
    for (let i = 0; i < marcas.length; i++) {
        filtroMarca.add(new Option(marcas[i], marcas[i]));
    }
    filtroMarca.value = marcas.includes(marcaElegida) ? marcaElegida : '';
}

/**
 * Calcula el siguiente código disponible para una categoría.
 * Ejemplo: si en Herramientas el mayor es HER-008, sugiere HER-009.
 * @param {number} categoriaId
 * @returns {string}
 */
function sugerirCodigo(categoriaId) {
    let prefijo = '';
    let mayor = 0; // Acumulador: el número más alto encontrado

    for (let i = 0; i < productos.length; i++) {
        if (productos[i].categoria_id === categoriaId) {
            const partes = productos[i].codigo.split('-'); // 'HER-008' → ['HER', '008']
            const numero = parseInt(partes[1], 10);
            prefijo = partes[0];
            if (numero > mayor) {
                mayor = numero;
            }
        }
    }

    // Categoría sin productos: usamos sus 3 primeras letras, sin tildes
    if (prefijo === '') {
        const categoria = categorias.find(function (c) { return c.id === categoriaId; });
        prefijo = categoria.nombre
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .substring(0, 3)
            .toUpperCase();
    }

    // padStart completa con ceros a la izquierda: 9 → '009'
    return prefijo + '-' + String(mayor + 1).padStart(3, '0');
}

/**
 * Convierte el texto de un campo numérico en número.
 * Un campo vacío devuelve NaN (no es un número) para que la validación lo detecte.
 * @param {string} texto
 * @returns {number}
 */
function leerNumero(texto) {
    return texto.trim() === '' ? NaN : Number(texto);
}

/** Lee los valores del formulario y los devuelve en un objeto. */
function leerFormulario() {
    return {
        categoria: Number(document.getElementById('categoria').value),
        codigo: document.getElementById('codigo').value.trim().toUpperCase(),
        nombre: document.getElementById('nombre').value.trim(),
        marca: document.getElementById('marca').value.trim(),
        unidad: document.getElementById('unidad').value,
        costo: leerNumero(document.getElementById('costo').value),
        precio: leerNumero(document.getElementById('precio').value),
        stock: leerNumero(document.getElementById('stock').value),
        stockMinimo: leerNumero(document.getElementById('stockMinimo').value)
    };
}

/**
 * Valida los datos del producto (requerimiento 2).
 * @param {object} datos - lo que devuelve leerFormulario().
 * @returns {object} un mensaje por cada campo con error (vacío si todo está bien).
 */
function validarProducto(datos) {
    const errores = {};

    if (datos.categoria === 0) {
        errores.categoria = 'Elige una categoría.';
    }

    if (datos.codigo === '') {
        errores.codigo = 'Escribe el código del producto.';
    } else if (!FORMATO_CODIGO.test(datos.codigo)) {
        errores.codigo = 'Usa el formato de 3 letras, guion y 3 números. Ejemplo: HER-009.';
    } else {
        // El código no puede repetirse (excepto el del mismo producto que se edita)
        for (let i = 0; i < productos.length; i++) {
            if (productos[i].codigo === datos.codigo && productos[i].id !== idEditando) {
                errores.codigo = 'Ya existe un producto con este código.';
                break;
            }
        }
    }

    if (datos.nombre === '') {
        errores.nombre = 'Escribe el nombre del producto.';
    }

    if (datos.marca === '') {
        errores.marca = 'Escribe la marca.';
    }

    if (datos.unidad === '') {
        errores.unidad = 'Elige la unidad de venta.';
    }

    // Operadores relacionales: ningún valor puede ser negativo
    if (isNaN(datos.costo) || datos.costo < 0) {
        errores.costo = 'Escribe un costo de 0 o más.';
    }

    if (isNaN(datos.precio) || datos.precio <= 0) {
        errores.precio = 'Escribe un precio mayor que 0.';
    } else if (datos.costo >= 0 && datos.precio < datos.costo) {
        errores.precio = 'El precio de venta no puede ser menor que el costo.';
    }

    if (!Number.isInteger(datos.stock) || datos.stock < 0) {
        errores.stock = 'Escribe un número entero de 0 o más.';
    }

    if (!Number.isInteger(datos.stockMinimo) || datos.stockMinimo < 0) {
        errores.stockMinimo = 'Escribe un número entero de 0 o más.';
    }

    return errores;
}

/**
 * Marca en rojo los campos con error y muestra su mensaje.
 * @param {object} errores - lo que devuelve validarProducto().
 */
function mostrarErrores(errores) {
    let primerError = null;

    for (let i = 0; i < CAMPOS.length; i++) {
        const campo = CAMPOS[i];
        const mensaje = errores[campo];
        const elemento = document.getElementById(campo);

        if (mensaje) {
            elemento.classList.add('is-invalid');
            document.getElementById('error-' + campo).textContent = mensaje;
            if (primerError === null) {
                primerError = elemento;
            }
        } else {
            elemento.classList.remove('is-invalid');
        }
    }

    // Llevamos el cursor al primer campo con error
    if (primerError !== null) {
        primerError.focus();
    }
}

/**
 * Abre la ventana del formulario.
 * @param {object|null} producto - el producto a editar, o null para uno nuevo.
 */
function abrirFormulario(producto) {
    formProducto.reset();
    mostrarErrores({});
    alertaFormulario.classList.add('d-none');
    codigoSugerido = '';

    if (producto === null) {
        idEditando = null;
        document.getElementById('tituloModal').textContent = 'Nuevo producto';
        botonGuardar.textContent = 'Guardar producto';
    } else {
        idEditando = producto.id;
        document.getElementById('tituloModal').textContent = 'Editar producto';
        botonGuardar.textContent = 'Guardar cambios';

        document.getElementById('categoria').value = producto.categoria_id;
        document.getElementById('codigo').value = producto.codigo;
        document.getElementById('nombre').value = producto.nombre;
        document.getElementById('marca').value = producto.marca;
        document.getElementById('unidad').value = producto.unidad;
        document.getElementById('costo').value = producto.costo;
        document.getElementById('precio').value = producto.precio;
        document.getElementById('stock').value = producto.stock;
        document.getElementById('stockMinimo').value = producto.stock_minimo;
    }

    // Estado inicial de la imagen
    archivoImagen = null;
    quitarImagen = false;
    imagenActual = producto === null ? null : producto.imagen_url;
    liberarVistaPrevia();
    mostrarErrorImagen('');
    mostrarVistaPrevia(imagenActual);

    ventanaProducto.show();
}

//Imagen del Producto
/**
 * Muestra una imagen en el cuadro de vista previa, o un ícono si no hay.
 * @param {string|null} url
 */
function mostrarVistaPrevia(url) {
    const cuadro = document.getElementById('vistaPrevia');

    if (url) {
        cuadro.innerHTML = '';
        const imagen = document.createElement('img');
        imagen.src = url;
        imagen.alt = 'Vista previa de la imagen del producto';
        cuadro.appendChild(imagen);
    } else {
        cuadro.innerHTML = '<i class="bi bi-image" aria-hidden="true"></i>';
    }

    // El botón "Quitar imagen" solo se ve si hay una imagen
    document.getElementById('botonQuitarImagen').classList.toggle('d-none', !url);
}

/** Libera la memoria de la vista previa temporal anterior. */
function liberarVistaPrevia() {
    if (urlVistaPrevia !== null) {
        URL.revokeObjectURL(urlVistaPrevia);
        urlVistaPrevia = null;
    }
}

/**
 * Muestra u oculta el error del campo de imagen.
 * @param {string} mensaje - texto del error, o '' para quitarlo.
 */
function mostrarErrorImagen(mensaje) {
    document.getElementById('imagen').classList.toggle('is-invalid', mensaje !== '');
    document.getElementById('error-imagen').textContent = mensaje;
}

/**
 * Sube una foto a Supabase Storage.
 * @param {File} archivo
 * @param {string} codigo - código del producto, para nombrar el archivo.
 * @returns {Promise<{url: string|null, ruta: string|null, error: object|null}>}
 */
async function subirImagen(archivo, codigo) {
    // Nombre único: código + fecha en milisegundos. Ejemplo: HER-001-1730592000000.jpeg
    const extension = archivo.type.split('/')[1]; // 'image/jpeg' → 'jpeg'
    const ruta = codigo + '-' + Date.now() + '.' + extension;

    const { error } = await db.storage
        .from(BUCKET_IMAGENES)
        .upload(ruta, archivo, { contentType: archivo.type });

    if (error) {
        return { url: null, ruta: null, error: error };
    }

    const { data } = db.storage.from(BUCKET_IMAGENES).getPublicUrl(ruta);
    return { url: data.publicUrl, ruta: ruta, error: null };
}

/**
 * Obtiene el nombre del archivo dentro del bucket a partir de su URL pública.
 * @param {string} url
 * @returns {string|null}
 */
function rutaDesdeUrl(url) {
    const marca = '/object/public/' + BUCKET_IMAGENES + '/';
    const posicion = url.indexOf(marca);
    if (posicion === -1) {
        return null;
    }
    return decodeURIComponent(url.substring(posicion + marca.length));
}

/**
 * Borra una imagen del bucket. Si falla, solo lo anota en la consola:
 * una imagen que sobra no afecta el funcionamiento del sistema.
 * @param {string|null} ruta
 */
async function borrarImagen(ruta) {
    if (!ruta) {
        return;
    }
    const { error } = await db.storage.from(BUCKET_IMAGENES).remove([ruta]);
    if (error) {
        console.error('No se pudo borrar la imagen:', error);
    }
}

/**
 * Guarda el producto en Supabase (nuevo o editado), incluyendo su imagen.
 * @param {object} datos - datos ya validados.
 * @returns {Promise<object|null>} el error, o null si se guardó.
 */
async function guardarProducto(datos) {
    // Los nombres de las columnas de la tabla en Supabase
    const registro = {
        codigo: datos.codigo,
        nombre: datos.nombre,
        marca: datos.marca,
        categoria_id: datos.categoria,
        unidad: datos.unidad,
        costo: datos.costo,
        precio: datos.precio,
        stock: datos.stock,
        stock_minimo: datos.stockMinimo
    };

    let rutaNueva = null;

    // 1. Si hay una foto nueva, se sube primero para obtener su URL
    if (archivoImagen !== null) {
        const subida = await subirImagen(archivoImagen, datos.codigo);
        if (subida.error) {
            console.error('Error al subir la imagen:', subida.error);
            return { code: 'imagen' };
        }
        registro.imagen_url = subida.url;
        rutaNueva = subida.ruta;
    } else if (quitarImagen) {
        registro.imagen_url = null;
    }

    // 2. Se guarda el producto en la tabla
    let resultado;
    if (idEditando === null) {
        resultado = await db.from('productos').insert(registro);
    } else {
        resultado = await db.from('productos').update(registro).eq('id', idEditando);
    }

    if (resultado.error) {
        await borrarImagen(rutaNueva); // La foto recién subida ya no tiene producto
        return resultado.error;
    }

    // 3. Si la imagen anterior se reemplazó o se quitó, se borra del bucket
    if (imagenActual !== null && (rutaNueva !== null || quitarImagen)) {
        await borrarImagen(rutaDesdeUrl(imagenActual));
    }

    return null;
}

// Eliminar producto

/**
 * Abre la ventana de confirmación antes de eliminar.
 * @param {object} producto
 */
function confirmarEliminacion(producto) {
    productoEliminando = producto;
    document.getElementById('nombreEliminar').textContent = producto.nombre;
    alertaEliminar.classList.add('d-none');
    botonConfirmarEliminar.disabled = false;
    ventanaEliminar.show();
}

/**
 * Elimina el producto en Supabase y luego su imagen.
 * @param {object} producto
 * @returns {Promise<object|null>} el error, o null si se eliminó.
 */
async function eliminarProducto(producto) {
    // .select('id') hace que Supabase devuelva las filas que realmente borró
    const { data, error } = await db
        .from('productos')
        .delete()
        .eq('id', producto.id)
        .select('id');

    if (error) {
        return error;
    }

    // Sin error pero sin filas borradas: las reglas RLS no lo permitieron
    if (data.length === 0) {
        return { code: 'sin-permiso' };
    }

    // El producto ya no existe: ahora sí borramos su imagen
    if (producto.imagen_url) {
        await borrarImagen(rutaDesdeUrl(producto.imagen_url));
    }

    return null;
}

// ---------- Eventos ----------


// Búsqueda (con cada letra) y filtros (al elegir una opción)
buscarInventario.addEventListener('input', filtrarProductos);
filtroCategoria.addEventListener('change', filtrarProductos);
filtroMarca.addEventListener('change', filtrarProductos);
filtroEstado.addEventListener('change', filtrarProductos);

// "Ver productos" de la alerta: muestra solo los que hay que reabastecer
alertaStock.addEventListener('click', function (evento) {
    if (evento.target.id === 'botonVerReabastecer') {
        buscarInventario.value = '';
        filtroCategoria.value = '0';
        filtroMarca.value = '';
        filtroEstado.value = 'reabastecer';
        filtrarProductos();
    }
});

// Botón "Nuevo producto"
document.getElementById('botonNuevo').addEventListener('click', function () {
    abrirFormulario(null);
});

// Al elegir una categoría en un producto nuevo, sugerimos el código
document.getElementById('categoria').addEventListener('change', function () {
    const campoCodigo = document.getElementById('codigo');
    const categoriaId = Number(this.value);

    // Solo si es nuevo, y si el empleado no escribió un código propio
    const codigoSinCambios = campoCodigo.value === '' || campoCodigo.value === codigoSugerido;
    if (idEditando === null && categoriaId !== 0 && codigoSinCambios) {
        codigoSugerido = sugerirCodigo(categoriaId);
        campoCodigo.value = codigoSugerido;
    }
});

// Al elegir una foto: validar tipo y tamaño, y mostrar la vista previa
document.getElementById('imagen').addEventListener('change', function () {
    const archivo = this.files[0];
    mostrarErrorImagen('');

    if (!archivo) {
        return; // El empleado canceló la selección
    }

    if (!TIPOS_IMAGEN.includes(archivo.type)) {
        mostrarErrorImagen('Elige una imagen JPG, PNG o WebP.');
        this.value = '';
        return;
    }

    if (archivo.size > TAMANO_MAXIMO) {
        mostrarErrorImagen('La imagen pesa más de 2 MB. Elige una más liviana.');
        this.value = '';
        return;
    }

    archivoImagen = archivo;
    quitarImagen = false;
    liberarVistaPrevia();
    urlVistaPrevia = URL.createObjectURL(archivo);
    mostrarVistaPrevia(urlVistaPrevia);
});

// Botón "Quitar imagen"
document.getElementById('botonQuitarImagen').addEventListener('click', function () {
    archivoImagen = null;
    quitarImagen = imagenActual !== null; // Solo hay algo que borrar si ya tenía imagen
    document.getElementById('imagen').value = '';
    liberarVistaPrevia();
    mostrarVistaPrevia(null);
});

// Al cerrar la ventana, liberamos la vista previa temporal
document.getElementById('modalProducto').addEventListener('hidden.bs.modal', function () {
    liberarVistaPrevia();
});

// Al abrir la ventana, el cursor va al primer campo
document.getElementById('modalProducto').addEventListener('shown.bs.modal', function () {
    document.getElementById('categoria').focus();
});

// Botones de cada fila (editar). Un solo evento para toda la tabla.
tablaProductos.addEventListener('click', function (evento) {
    const boton = evento.target.closest('button[data-accion]');
    if (boton === null) {
        return; // El clic no fue en un botón
    }

    const id = Number(boton.dataset.id);
    const producto = productos.find(function (p) { return p.id === id; });

    switch (boton.dataset.accion) {
        case 'ver':
            mostrarFicha(producto);
            break;
        case 'editar':
            abrirFormulario(producto);
            break;
        case 'eliminar':
            confirmarEliminacion(producto);
            break;
    }
});

// Botón "Editar producto" de la ficha: primero se cierra la ficha y, cuando
// terminó de cerrarse, se abre el formulario (abrir dos ventanas a la vez las traba)
document.getElementById('botonEditarFicha').addEventListener('click', function () {
    document.getElementById('modalFicha').addEventListener('hidden.bs.modal', function () {
        abrirFormulario(productoFicha);
    }, { once: true });
    ventanaFicha.hide();
});

// Envío del formulario
formProducto.addEventListener('submit', async function (evento) {
    evento.preventDefault();
    alertaFormulario.classList.add('d-none');

    const datos = leerFormulario();
    const errores = validarProducto(datos);
    mostrarErrores(errores);

    // Si hay al menos un error, no guardamos
    if (Object.keys(errores).length > 0) {
        return;
    }

    const esNuevo = idEditando === null;
    botonGuardar.disabled = true;
    botonGuardar.textContent = 'Guardando…';

    const error = await guardarProducto(datos);

    botonGuardar.disabled = false;
    botonGuardar.textContent = esNuevo ? 'Guardar producto' : 'Guardar cambios';

    if (error) {
        console.error('Error al guardar el producto:', error);
        // 23505 = valor repetido en una columna "unique"
        if (error.code === '23505') {
            mostrarErrores({ codigo: 'Ya existe un producto con este código.' });
        } else if (error.code === 'imagen') {
            alertaFormulario.textContent = 'No se pudo subir la imagen. Revisa tu conexión e intenta de nuevo.';
            alertaFormulario.classList.remove('d-none');
        } else {
            alertaFormulario.textContent = 'No se pudo guardar el producto. Revisa tu conexión e intenta de nuevo.';
            alertaFormulario.classList.remove('d-none');
        }
        return;
    }

    ventanaProducto.hide();
    mostrarAviso(esNuevo ? 'Producto guardado.' : 'Cambios guardados.');
    await cargarProductos();
});

// Botón "Eliminar producto" de la ventana de confirmación
botonConfirmarEliminar.addEventListener('click', async function () {
    alertaEliminar.classList.add('d-none');
    botonConfirmarEliminar.disabled = true;
    botonConfirmarEliminar.textContent = 'Eliminando…';

    const error = await eliminarProducto(productoEliminando);

    botonConfirmarEliminar.textContent = 'Eliminar producto';

    if (error) {
        console.error('Error al eliminar el producto:', error);
        let mensaje;

        switch (error.code) {
            case '23503': // El producto aparece en ventas (llave foránea)
                mensaje = 'No se puede eliminar porque ya tiene ventas registradas. Si ya no lo vendes, deja su stock en 0.';
                break;
            case 'sin-permiso':
                mensaje = 'Tu usuario no tiene permiso para eliminar productos.';
                break;
            default:
                mensaje = 'No se pudo eliminar el producto. Revisa tu conexión e intenta de nuevo.';
                botonConfirmarEliminar.disabled = false; // Solo en este caso tiene sentido reintentar
        }

        alertaEliminar.textContent = mensaje;
        alertaEliminar.classList.remove('d-none');
        return;
    }

    ventanaEliminar.hide();
    mostrarAviso('Producto eliminado.');
    await cargarProductos();
});

iniciarPagina();