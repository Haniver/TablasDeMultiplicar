// Sincronización con el servidor (tablas.edutlan.org). El código de progreso es
// la única «llave»: quien lo tiene puede leer y escribir ese progreso.

import { fusionar, huella } from './fusionar.js';
import { codigoActual, datosActuales, reemplazarDatos, alCambiarDatos } from './almacen.js';

const API = new URLSearchParams(location.search).get('api') || 'https://tablas.edutlan.org/api';

// 20 caracteres sin letras ni números que se confunden (100 bits de azar).
const ALFABETO = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function generarCodigo() {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return [...bytes].map((b) => ALFABETO[b % 32]).join('');
}

export function normalizarCodigo(texto) {
  const limpio = String(texto ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '');
  return /^[2-9A-HJ-NP-Z]{20}$/.test(limpio) ? limpio : null;
}

export const codigoBonito = (c) => c.match(/.{1,4}/g).join('-');

async function pedir(ruta, codigo, opciones = {}) {
  return fetch(API + ruta, {
    ...opciones,
    headers: { Authorization: `Bearer ${codigo}`, 'Content-Type': 'application/json' },
  });
}

// Devuelve los datos guardados de ese código, o null si no existe.
export async function bajar(codigo) {
  const r = await pedir('/progreso', codigo);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`El servidor respondió ${r.status}`);
  return (await r.json()).datos;
}

// Sube los datos; el servidor los fusiona con los suyos y regresa el resultado.
async function subir(codigo, datos) {
  const r = await pedir('/progreso', codigo, {
    method: 'PUT',
    body: JSON.stringify({ datos }),
  });
  if (!r.ok) throw new Error(`El servidor respondió ${r.status}`);
  return (await r.json()).datos;
}

// Sube los cambios unos segundos después de cada uno, reintenta si no hay
// conexión y avisa el estado: 'guardando' | 'guardado' | 'sin-conexion'.
export function crearSincronizador({ alEstado, alTraerCambios }) {
  let espera = null;
  let pendiente = false;
  let enCurso = false;
  let reintento = null;

  async function sincronizar() {
    const codigo = codigoActual();
    if (!codigo) return;
    if (enCurso) {
      pendiente = true;
      return;
    }
    enCurso = true;
    pendiente = false;
    let salioBien = false;
    alEstado('guardando');
    try {
      const antes = huella(datosActuales());
      const delServidor = await subir(codigo, datosActuales());
      const fusion = fusionar(datosActuales(), delServidor);
      const trajoCambios = huella(fusion) !== antes;
      reemplazarDatos(fusion);
      clearTimeout(reintento);
      salioBien = true;
      alEstado('guardado');
      if (trajoCambios) alTraerCambios?.();
    } catch {
      pendiente = true;
      alEstado('sin-conexion');
      clearTimeout(reintento);
      reintento = setTimeout(sincronizar, 60_000);
    } finally {
      enCurso = false;
      // Si hubo cambios mientras se subía, se programa otra subida (solo si no falló).
      if (salioBien && pendiente) programar();
    }
  }

  function programar() {
    pendiente = true;
    clearTimeout(espera);
    espera = setTimeout(sincronizar, 2500);
  }

  alCambiarDatos(programar);
  addEventListener('online', sincronizar);
  // Al cerrar o esconder la pestaña se sube lo pendiente con sendBeacon, que sí
  // alcanza a salir aunque la página se esté cerrando (por eso va como text/plain).
  const alSalir = () => {
    const codigo = codigoActual();
    if (!pendiente || !codigo) return;
    const cuerpo = new Blob([JSON.stringify({ codigo, datos: datosActuales() })], { type: 'text/plain' });
    if (navigator.sendBeacon?.(`${API}/progreso`, cuerpo)) pendiente = false;
  };
  addEventListener('pagehide', alSalir);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && alSalir());

  return { sincronizar };
}
