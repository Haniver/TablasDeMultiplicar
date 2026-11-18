// Datos del jugador actual. Viven en memoria, se copian a localStorage
// (para funcionar sin conexión) y el sincronizador los sube al servidor.

import { datosVacios } from './fusionar.js';

const PREFIJO_DATOS = 'tablas:datos:';
const CLAVE_PERFILES = 'tablas:perfiles';
const CLAVE_ACTUAL = 'tablas:perfil-actual';

let token = null;
let datos = datosVacios();
const oyentes = new Set();

// ---------- localStorage que nunca truena ----------

function leerLocal(clave, defecto) {
  try {
    const texto = localStorage.getItem(clave);
    return texto ? JSON.parse(texto) : defecto;
  } catch {
    return defecto;
  }
}

function guardarLocal(clave, valor) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    /* sin almacenamiento local: queda la copia del servidor */
  }
}

// ---------- perfiles recordados en este dispositivo ----------

export function perfilesRecordados() {
  return leerLocal(CLAVE_PERFILES, []);
}

export function recordarPerfil(codigo, nombre) {
  const lista = perfilesRecordados().filter((p) => p.codigo !== codigo);
  lista.unshift({ codigo, nombre });
  guardarLocal(CLAVE_PERFILES, lista);
}

export function perfilGuardadoComoActual() {
  return leerLocal(CLAVE_ACTUAL, null);
}

export function abrirPerfil(codigo) {
  token = codigo;
  guardarLocal(CLAVE_ACTUAL, codigo);
  datos = leerLocal(PREFIJO_DATOS + codigo, null) ?? datosVacios();
}

export function codigoActual() {
  return token;
}

// ---------- datos ----------

export function datosActuales() {
  return datos;
}

// La usa el sincronizador después de fusionar con el servidor (no avisa a los oyentes).
export function reemplazarDatos(nuevos) {
  datos = nuevos;
  if (token) guardarLocal(PREFIJO_DATOS + token, datos);
}

export function alCambiarDatos(fn) {
  oyentes.add(fn);
}

function huboCambio() {
  if (token) guardarLocal(PREFIJO_DATOS + token, datos);
  for (const fn of oyentes) fn();
}

export function leer(clave, defecto) {
  const s = datos.secciones[clave];
  return s ? s.valor : defecto;
}

export function guardar(clave, valor) {
  datos.secciones[clave] = { valor, rev: Date.now() };
  huboCambio();
}

export function leerTarjeta(clave) {
  return datos.tarjetas[clave] ?? null;
}

export function guardarTarjeta(clave, tarjeta) {
  datos.tarjetas[clave] = tarjeta;
  huboCambio();
}

// ---------- fechas ----------

// Fecha local en formato AAAA-MM-DD.
export function fechaLocal(fecha = new Date()) {
  const a = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${a}-${m}-${d}`;
}

export function hoy() {
  return fechaLocal();
}

export function ayer() {
  return sumarDias(hoy(), -1);
}

export function sumarDias(fechaTexto, dias) {
  const [a, m, d] = fechaTexto.split('-').map(Number);
  return fechaLocal(new Date(a, m - 1, d + dias));
}
