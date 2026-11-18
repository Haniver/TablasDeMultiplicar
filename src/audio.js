// Sonidos con Web Audio: precarga, se activa con el primer gesto del usuario
// y permite cortar la voz anterior cuando sale una cuenta nueva.

let ctx = null;
const cache = new Map();
let vozActual = null;

export function activarAudio() {
  if (!ctx) {
    const Contexto = window.AudioContext || window.webkitAudioContext;
    if (!Contexto) return null;
    ctx = new Contexto();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function cargar(url) {
  if (!cache.has(url)) {
    const promesa = fetch(url)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((datos) => activarAudio()?.decodeAudioData(datos))
      .catch(() => {
        cache.delete(url); // si falta el archivo, se reintenta la próxima vez
        return null;
      });
    cache.set(url, promesa);
  }
  return cache.get(url);
}

export function precargar(...urls) {
  if (!ctx) return; // sin contexto todavía no se puede decodificar
  for (const u of urls) cargar(u);
}

async function tocar(url, { retraso = 0, volumen = 1 } = {}, sigueVigente = () => true) {
  const c = activarAudio();
  if (!c) return null;
  const buffer = await cargar(url);
  if (!buffer || !sigueVigente()) return null;
  const fuente = c.createBufferSource();
  const ganancia = c.createGain();
  ganancia.gain.value = volumen;
  fuente.buffer = buffer;
  fuente.connect(ganancia).connect(c.destination);
  fuente.start(c.currentTime + retraso);
  return fuente;
}

// Cada frase nueva invalida a la anterior, aunque esta todavía se esté descargando.
let turnoVoz = 0;

export function callarVoz() {
  turnoVoz++;
  try {
    vozActual?.stop();
  } catch {
    /* ya había terminado */
  }
  vozActual = null;
}

export async function decir(url, opciones) {
  callarVoz();
  const turno = turnoVoz;
  const fuente = await tocar(url, opciones, () => turno === turnoVoz);
  if (fuente) vozActual = fuente;
  return fuente;
}

export function sonar(url, opciones) {
  return tocar(url, opciones);
}
