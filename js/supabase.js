/**
 * supabase.js
 * Conexión con la base de datos en Supabase.
 *
 * La URL y la llave publishable pueden ir en el navegador: lo que protege
 * los datos son las reglas RLS de cada tabla.
 * NUNCA pongas aquí la "secret key" (o service_role).
 */
const SUPABASE_URL = 'https://tjymuuwfnbzxfgolzouy.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ocHWtwFrrPga0DLJ2KGjjA_b8dPZ8xj';

// "supabase" es el objeto que crea la librería cargada desde el CDN.
// Guardamos la sesión en sessionStorage: se cierra al cerrar la pestaña.
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { storage: window.sessionStorage }
});