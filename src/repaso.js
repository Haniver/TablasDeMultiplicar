// Repetición espaciada al estilo Anki, simplificada a dos respuestas:
// «¡Me la sé!» alarga el intervalo; «Todavía no» la regresa a aprendizaje y
// la vuelve a sacar en la misma sesión, unas cartas después.

import { hoy, sumarDias, leerTarjeta, guardarTarjeta, datosActuales } from './almacen.js';

const FACILIDAD_INICIAL = 2.5;
const FACILIDAD_MINIMA = 1.3;
const INTERVALO_MAXIMO = 45; // días
const VUELVE_DESPUES_DE = 3; // cartas
const EXTRA_AL_PRACTICAR_MAS = 5;

export const claveDe = (a, b) => `${a}x${b}`;
const desdeClave = (k) => k.split('x').map(Number);

// Todas las cuentas de 2–9 × 2–9 donde aparece alguna de las tablas elegidas.
export function cuentasDe(tablas) {
  const claves = [];
  for (let a = 2; a <= 9; a++) {
    for (let b = 2; b <= 9; b++) {
      if (tablas.includes(a) || tablas.includes(b)) claves.push(claveDe(a, b));
    }
  }
  return claves;
}

function barajar(lista) {
  const l = [...lista];
  for (let i = l.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [l[i], l[j]] = [l[j], l[i]];
  }
  return l;
}

// Calcula el estado nuevo de una tarjeta después de contestarla.
export function calificar(tarjeta, sabia) {
  const t = tarjeta
    ? { ...tarjeta }
    : { intervalo: 0, facilidad: FACILIDAD_INICIAL, aciertos: 0, fallos: 0, primera: hoy() };
  if (sabia) {
    t.aciertos += 1;
    t.intervalo = t.intervalo === 0 ? 1 : Math.min(INTERVALO_MAXIMO, Math.round(t.intervalo * t.facilidad));
  } else {
    t.fallos += 1;
    t.facilidad = Math.max(FACILIDAD_MINIMA, +(t.facilidad - 0.2).toFixed(2));
    t.intervalo = 0;
  }
  t.vence = sumarDias(hoy(), t.intervalo);
  t.ultima = hoy();
  t.rev = Date.now();
  return t;
}

// Nivel para dibujar (frijoles en la carta y colores del tablero):
// 0 nueva o aprendiendo · 1 intervalo de 1 día · 2 de 2–6 · 3 de 7–19 · 4 de 20 o más.
export function nivelDe(tarjeta) {
  const i = tarjeta?.intervalo ?? 0;
  if (i >= 20) return 4;
  if (i >= 7) return 3;
  if (i >= 2) return 2;
  if (i >= 1) return 1;
  return 0;
}

export function estadoDe(tarjeta) {
  if (!tarjeta) return 'nueva';
  if (tarjeta.intervalo === 0) return 'aprendiendo';
  if (tarjeta.intervalo >= 7) return 'dominada';
  return 'en-camino';
}

// Sesión del día: primero lo que ya toca repasar, intercalado con unas cuantas nuevas.
export class Sesion {
  constructor({ tablas, nuevasPorDia }) {
    this.tablas = tablas;
    this.nuevasPorDia = nuevasPorDia;
    this.ultima = null;
    this.armar();
  }

  armar() {
    const fecha = hoy();
    const claves = cuentasDe(this.tablas);
    const tarjetas = datosActuales().tarjetas;
    const vencidas = barajar(claves.filter((k) => tarjetas[k] && tarjetas[k].vence <= fecha));
    // Las que se fallaron hoy van primero: son las más frescas.
    vencidas.sort((x, y) => (tarjetas[x].intervalo === 0 ? 0 : 1) - (tarjetas[y].intervalo === 0 ? 0 : 1));
    const nuevasHoy = Object.values(tarjetas).filter((t) => t.primera === fecha).length;
    const cupo = Math.max(0, this.nuevasPorDia - nuevasHoy);
    const nuevas = barajar(claves.filter((k) => !tarjetas[k])).slice(0, cupo);
    this.cola = intercalar(vencidas, nuevas);
    this.fecha = fecha;
  }

  get pendientes() {
    return this.cola.length;
  }

  // Si cambió el día con la app abierta, se arma la sesión del día nuevo.
  revisarCambioDeDia() {
    if (this.fecha !== hoy()) this.armar();
  }

  siguiente() {
    this.revisarCambioDeDia();
    if (!this.cola.length) return null;
    // Evita repetir la misma cuenta dos veces seguidas si hay otra opción.
    let i = 0;
    if (this.cola.length > 1 && this.cola[0] === this.ultima) i = 1;
    const [clave] = this.cola.splice(i, 1);
    this.ultima = clave;
    const [a, b] = desdeClave(clave);
    return { clave, a, b, tarjeta: leerTarjeta(clave) };
  }

  responder(clave, sabia) {
    const tarjeta = calificar(leerTarjeta(clave), sabia);
    guardarTarjeta(clave, tarjeta);
    if (!sabia) this.cola.splice(Math.min(VUELVE_DESPUES_DE, this.cola.length), 0, clave);
    return tarjeta;
  }

  // Cuando ya no queda nada para hoy: más nuevas si hay; si no, las que vencen pronto.
  practicarMas() {
    const tarjetas = datosActuales().tarjetas;
    const claves = cuentasDe(this.tablas);
    const nuevas = barajar(claves.filter((k) => !tarjetas[k]));
    const extra = nuevas.length
      ? nuevas.slice(0, EXTRA_AL_PRACTICAR_MAS)
      : claves
          .filter((k) => tarjetas[k])
          .sort((x, y) => (tarjetas[x].vence < tarjetas[y].vence ? -1 : 1))
          .slice(0, EXTRA_AL_PRACTICAR_MAS);
    this.cola.push(...extra);
    return extra.length;
  }

  // Cuántas nuevas quedan en todo el mazo (para decir qué hará «Practicar más»).
  nuevasRestantes() {
    const tarjetas = datosActuales().tarjetas;
    return cuentasDe(this.tablas).filter((k) => !tarjetas[k]).length;
  }
}

// Reparte las nuevas entre las vencidas para que no salgan todas juntas.
function intercalar(vencidas, nuevas) {
  if (!vencidas.length) return nuevas;
  if (!nuevas.length) return vencidas;
  const r = [];
  const paso = Math.max(1, Math.floor(vencidas.length / nuevas.length));
  let n = 0;
  vencidas.forEach((v, i) => {
    r.push(v);
    if ((i + 1) % paso === 0 && n < nuevas.length) r.push(nuevas[n++]);
  });
  while (n < nuevas.length) r.push(nuevas[n++]);
  return r;
}
