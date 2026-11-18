// Genera el arte, los efectos y las voces de la app con Runware.
// Se corre a mano, una etapa a la vez:
//   node scripts/generar-assets.mjs --etapa=prueba
//   node scripts/generar-assets.mjs --etapa=imagenes [--solo=8,reverso] [--modelo=runware:100@1]
//   node scripts/generar-assets.mjs --etapa=sfx [--solo=revelar]
//   node scripts/generar-assets.mjs --etapa=voces --voz=Lupita
// Cada tarea pide includeCost y el gasto se acumula en generados/costos.json.
// El script se niega a seguir si el gasto total llegaría al tope.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GENERADOS = path.join(RAIZ, 'generados');
const ARCHIVO_COSTOS = path.join(GENERADOS, 'costos.json');
const TOPE_USD = 1.0;
const API = 'https://api.runware.ai/v1';

// ---------- utilidades ----------

function leerClave() {
  const texto = fs.readFileSync(path.join(RAIZ, '.env'), 'utf8');
  const linea = texto.split(/\r?\n/).find((l) => l.startsWith('RUNWARE_API_KEY='));
  if (!linea) throw new Error('No encontré RUNWARE_API_KEY en .env');
  return linea.slice('RUNWARE_API_KEY='.length).trim();
}

function args() {
  const salida = {};
  for (const a of process.argv.slice(2)) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) salida[m[1]] = m[2] ?? true;
  }
  return salida;
}

function leerCostos() {
  if (!fs.existsSync(ARCHIVO_COSTOS)) return { total: 0, registros: [] };
  return JSON.parse(fs.readFileSync(ARCHIVO_COSTOS, 'utf8'));
}

function anotarCosto(etapa, costo, detalle) {
  const c = leerCostos();
  c.total = +(c.total + costo).toFixed(6);
  c.registros.push({ fecha: new Date().toISOString(), etapa, costo, detalle });
  fs.mkdirSync(GENERADOS, { recursive: true });
  fs.writeFileSync(ARCHIVO_COSTOS, JSON.stringify(c, null, 2));
  return c.total;
}

function revisarPresupuesto(estimado, etapa) {
  const { total } = leerCostos();
  console.log(`Gastado hasta ahora: $${total.toFixed(4)} · estimado de "${etapa}": $${estimado.toFixed(4)} · tope: $${TOPE_USD}`);
  if (total + estimado > TOPE_USD) {
    throw new Error(`La etapa "${etapa}" rebasaría el tope de $${TOPE_USD}. No hago nada.`);
  }
}

const CLAVE = leerClave();

async function runware(tareas) {
  const resp = await fetch(API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${CLAVE}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(tareas),
  });
  const json = await resp.json().catch(() => ({}));
  if (json.errors?.length) {
    // Las tareas que sí salieron vienen en data aunque otras fallen.
    console.error('Errores de Runware:', JSON.stringify(json.errors, null, 2));
  }
  if (!resp.ok && !json.data) throw new Error(`HTTP ${resp.status}: ${JSON.stringify(json)}`);
  return json.data ?? [];
}

async function descargar(url, destino) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`No pude descargar ${url}: ${r.status}`);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, Buffer.from(await r.arrayBuffer()));
}

function urlDe(resultado) {
  return resultado.imageURL ?? resultado.audioURL ?? resultado.URL ?? resultado.url;
}

// Corre las tareas en lotes pequeños, descarga cada resultado y anota el costo.
// `trabajos` es una lista de { tarea, destino }.
async function correr(etapa, trabajos, tamLote = 4) {
  let gastoEtapa = 0;
  for (let i = 0; i < trabajos.length; i += tamLote) {
    const lote = trabajos.slice(i, i + tamLote);
    const porUUID = new Map();
    const tareas = lote.map((t) => {
      const taskUUID = crypto.randomUUID();
      porUUID.set(taskUUID, t);
      return { ...t.tarea, taskUUID, includeCost: true };
    });
    const datos = await runware(tareas);
    const vistos = new Map();
    for (const d of datos) {
      const t0 = porUUID.get(d.taskUUID);
      if (!t0) continue;
      // Si una tarea devuelve varios resultados, los extra se guardan con sufijo para no sobrescribir.
      const n = (vistos.get(d.taskUUID) ?? 0) + 1;
      vistos.set(d.taskUUID, n);
      const t = n === 1 ? t0 : { ...t0, destino: t0.destino.replace(/(\.[^.]+)$/, `-extra${n}$1`) };
      const costo = Number(d.cost ?? 0);
      gastoEtapa += costo;
      const total = anotarCosto(etapa, costo, path.relative(RAIZ, t.destino));
      const url = urlDe(d);
      if (!url) {
        console.error('Respuesta sin URL:', JSON.stringify(d));
        continue;
      }
      await descargar(url, t.destino);
      console.log(`✔ ${path.relative(RAIZ, t.destino)}  $${costo.toFixed(5)}  (total $${total.toFixed(4)})`);
      if (total > TOPE_USD) throw new Error('Se alcanzó el tope de gasto; me detengo.');
    }
  }
  console.log(`Gasto de la etapa "${etapa}": $${gastoEtapa.toFixed(4)}`);
}

// ---------- contenido ----------

const ESTILO =
  'vintage Mexican loteria card illustration, hand-painted lithograph print look, bold flat colors ' +
  '(magenta pink, marigold orange, turquoise, grape purple, warm red), thick dark purple outlines, ' +
  'subtle paper grain, single centered subject on a plain warm cream background, charming and playful, ' +
  'no text, no letters, no numbers, no border, no frame';

const CARTAS = {
  2: 'a cheerful vintage bicycle seen from the side with exactly two big round wheels',
  3: 'a friendly traffic light with exactly three round lights: red, yellow and green, smiling face',
  4: 'a lucky four-leaf clover with exactly four heart-shaped leaves, bright green',
  5: 'a smiling starfish with exactly five arms, orange and pink with little dots',
  6: 'a cute ladybug seen from above with exactly six legs and exactly six black spots on its red shell',
  7: 'a traditional Mexican pinata shaped like a seven-pointed star (heptagram), exactly 7 cone spikes evenly spaced around a round center, tassels at the tips',
  arcoiris: 'a smiling rainbow arc with exactly seven stripes: red, orange, yellow, green, blue, indigo, violet, two fluffy white clouds at its ends',
  8: 'a happy octopus with exactly eight curly tentacles, magenta and purple',
  9: 'a long smiling caterpillar walking left to right in a gentle wave, a head followed by exactly nine round body balls of different bright colors, 9 body segments, wide composition',
  reverso:
    'decorative symmetrical back pattern of a Mexican loteria card: papel picado cutouts, marigold flowers, stars and swirls, ' +
    'magenta and turquoise ornamental tile design filling the whole image, no text',
  victoria:
    'a joyful golden trophy cup surrounded by colorful paper streamers, confetti, marigold flowers and stars, celebration',
};

// FLUX.1 schnell: en la prueba salió más limpio que Z-Image y costó $0.001 por imagen.
const MODELO_IMG = 'runware:100@1';

function tareaImagen(clave, modelo = MODELO_IMG) {
  const sujeto = CARTAS[clave];
  const prompt = clave === 'reverso' ? `${sujeto}, ${ESTILO.replace('single centered subject on a plain warm cream background, ', '')}` : `${sujeto}, ${ESTILO}`;
  return {
    taskType: 'imageInference',
    model: modelo,
    positivePrompt: prompt,
    width: 832,
    height: 832,
    steps: 4,
    numberResults: 1,
    outputType: 'URL',
    outputFormat: 'WEBP',
  };
}

const SFX = {
  revelar: {
    duracion: 2.5,
    prompt:
      'a gentle warm marimba arpeggio of three ascending notes, soft wooden mallets, pleasant and rewarding, ' +
      'clean recording, no beep, no alarm, short natural decay',
  },
  victoria: {
    duracion: 5,
    prompt:
      'a short joyful celebratory fanfare with bright trumpets and marimba, festive party mood, ' +
      'ending with a happy cymbal shimmer, cheerful and warm, not harsh',
  },
};

function tareaSfx(clave) {
  const s = SFX[clave];
  return {
    taskType: 'audioInference',
    model: 'mirelo:1@1',
    positivePrompt: s.prompt,
    duration: s.duracion,
    numberResults: 1,
    outputFormat: 'MP3',
  };
}

const UNIDADES = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
const ESPECIALES = {
  10: 'diez', 11: 'once', 12: 'doce', 13: 'trece', 14: 'catorce', 15: 'quince',
  16: 'dieciséis', 17: 'diecisiete', 18: 'dieciocho', 19: 'diecinueve',
  20: 'veinte', 21: 'veintiuno', 22: 'veintidós', 23: 'veintitrés', 24: 'veinticuatro',
  25: 'veinticinco', 26: 'veintiséis', 27: 'veintisiete', 28: 'veintiocho', 29: 'veintinueve',
};
const DECENAS = { 3: 'treinta', 4: 'cuarenta', 5: 'cincuenta', 6: 'sesenta', 7: 'setenta', 8: 'ochenta', 9: 'noventa' };

export function enPalabras(n) {
  if (n < 10) return UNIDADES[n];
  if (n < 30) return ESPECIALES[n];
  const d = Math.floor(n / 10);
  const u = n % 10;
  return u === 0 ? DECENAS[d] : `${DECENAS[d]} y ${UNIDADES[u]}`;
}

const mayuscula = (s) => s[0].toUpperCase() + s.slice(1);
const frasePregunta = (a, b) => `${mayuscula(enPalabras(a))} por ${enPalabras(b)}.`;
const fraseRespuesta = (a, b) => `${mayuscula(enPalabras(a))} por ${enPalabras(b)}, ${enPalabras(a * b)}.`;

const PRECIO_TTS_CARACTER = 0.000035;

function tareaVoz(texto, voz) {
  return {
    taskType: 'audioInference',
    model: 'inworld:tts@2',
    speech: { text: texto, voice: voz, language: 'es' },
    outputFormat: 'MP3',
  };
}

// ---------- etapas ----------

async function etapaPrueba() {
  revisarPresupuesto(0.02, 'prueba');
  const dir = path.join(GENERADOS, 'prueba');
  await correr('prueba', [
    { tarea: tareaImagen(8), destino: path.join(dir, 'pulpo-schnell.webp') },
    { tarea: { ...tareaImagen(8), model: 'runware:z-image@0', steps: undefined }, destino: path.join(dir, 'pulpo-zimage.webp') },
    { tarea: tareaSfx('revelar'), destino: path.join(dir, 'revelar.mp3') },
    { tarea: tareaVoz(fraseRespuesta(5, 8), 'Lupita'), destino: path.join(dir, 'voz-Lupita.mp3') },
    { tarea: tareaVoz(fraseRespuesta(5, 8), 'Diego'), destino: path.join(dir, 'voz-Diego.mp3') },
  ], 5);
}

async function etapaImagenes(op) {
  const claves = op.solo ? String(op.solo).split(',') : Object.keys(CARTAS);
  const variantes = Number(op.variantes ?? 3);
  const modelo = op.modelo ?? MODELO_IMG;
  const trabajos = [];
  for (const c of claves) {
    if (!CARTAS[c]) throw new Error(`No conozco la carta "${c}"`);
    for (let v = 1; v <= variantes; v++) {
      trabajos.push({ tarea: tareaImagen(c, modelo), destino: path.join(GENERADOS, 'img', `${c}-${v}.webp`) });
    }
  }
  revisarPresupuesto(trabajos.length * 0.005, 'imagenes');
  await correr('imagenes', trabajos);
}

async function etapaSfx(op) {
  const claves = op.solo ? String(op.solo).split(',') : Object.keys(SFX);
  const variantes = Number(op.variantes ?? 3);
  const trabajos = [];
  for (const c of claves) {
    for (let v = 1; v <= variantes; v++) {
      trabajos.push({ tarea: tareaSfx(c), destino: path.join(GENERADOS, 'sfx', `${c}-${v}.mp3`) });
    }
  }
  // En la prueba, Mirelo cobró $0.03 por resultado (no por segundo, como dice la documentación).
  const estimado = trabajos.length * 0.03 * 1.2;
  revisarPresupuesto(estimado, 'sfx');
  await correr('sfx', trabajos);
}

async function etapaVoces(op) {
  const voz = op.voz;
  if (!voz || voz === true) throw new Error('Falta --voz=Nombre');
  const trabajos = [];
  for (let a = 2; a <= 9; a++) {
    for (let b = 2; b <= 9; b++) {
      trabajos.push({ tarea: tareaVoz(frasePregunta(a, b), voz), destino: path.join(RAIZ, 'assets', 'voz', `p-${a}x${b}.mp3`) });
      trabajos.push({ tarea: tareaVoz(fraseRespuesta(a, b), voz), destino: path.join(RAIZ, 'assets', 'voz', `r-${a}x${b}.mp3`) });
    }
  }
  const pendientes = op.todo ? trabajos : trabajos.filter((t) => !fs.existsSync(t.destino));
  const caracteres = pendientes.reduce((s, t) => s + t.tarea.speech.text.length, 0);
  const estimado = caracteres * PRECIO_TTS_CARACTER * 1.5;
  console.log(`${pendientes.length} frases, ${caracteres} caracteres.`);
  revisarPresupuesto(estimado, 'voces');
  await correr('voces', pendientes, 8);
}

const op = args();
const etapas = { prueba: etapaPrueba, imagenes: etapaImagenes, sfx: etapaSfx, voces: etapaVoces };
const etapa = etapas[op.etapa];
if (!etapa) {
  console.log('Uso: node scripts/generar-assets.mjs --etapa=prueba|imagenes|sfx|voces [--solo=...] [--voz=...]');
  process.exit(1);
}
etapa(op).catch((e) => {
  console.error(e.message);
  process.exit(1);
});
