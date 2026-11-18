import { cargarAjustes, montarDialogoAjustes } from './ajustes.js';
import { Baraja } from './baraja.js';
import { activarAudio, precargar, decir, sonar, callarVoz } from './audio.js';
import { crearEstudio, leerRacha, usarClavesDePrueba } from './estudio.js';
import { lanzarSerpentinas } from './serpentinas.js';
import { dibujarPapelPicado } from './papel-picado.js';

const CARTAS = {
  2: 'La Bicicleta',
  3: 'El Semáforo',
  4: 'El Trébol',
  5: 'La Estrella de Mar',
  6: 'La Catarina',
  7: 'El Arcoíris',
  8: 'El Pulpo',
  9: 'La Oruga',
};

const SFX_REVELAR = 'assets/sfx/revelar.mp3';
const SFX_VICTORIA = 'assets/sfx/victoria.mp3';
const vozPregunta = (a, b) => `assets/voz/p-${a}x${b}.mp3`;
const vozRespuesta = (a, b) => `assets/voz/r-${a}x${b}.mp3`;

const modoPrueba = new URLSearchParams(location.search).has('prueba');
const reducirMovimiento = matchMedia('(prefers-reduced-motion: reduce)');

const $ = (s) => document.querySelector(s);
const el = {
  factores: [...document.querySelectorAll('.carta-factor')],
  resultado: $('.carta-resultado'),
  producto: $('.producto'),
  nombreCuenta: $('.nombre-cuenta'),
  medallon: $('.medallon'),
  segundos: $('.segundos'),
  anillo: $('.anillo-avance'),
  leyenda: $('#leyenda'),
  boton: $('#boton-principal'),
  barajaInfo: $('#baraja-info'),
  rachaInfo: $('#racha-info'),
  botonEstudio: $('#boton-estudio'),
  estudioTexto: $('#estudio-texto'),
  estudioAvance: $('#estudio-avance'),
  dialogoAjustes: $('#dialogo-ajustes'),
  dialogoVictoria: $('#dialogo-victoria'),
  victoriaTexto: $('#victoria-texto'),
  canvas: $('#serpentinas'),
};

let ajustes = cargarAjustes();
const baraja = new Baraja(ajustes.tablas);

// estado: 'inicio' | 'preguntando' | 'revelada'
let estado = 'inicio';
let cuenta = null;
let cuadroCuenta = null;

// ---------- cartas ----------

function voltear(carta, bocaAbajo) {
  carta.classList.toggle('boca-abajo', bocaAbajo);
}

function repartir(carta) {
  carta.classList.remove('repartida');
  void carta.offsetWidth; // reinicia la animación
  carta.classList.add('repartida');
}

function pintarFactor(carta, n) {
  carta.querySelector('.esquina').textContent = n;
  const img = carta.querySelector('.ilustracion');
  img.src = `assets/img/${n}.webp`;
  img.alt = '';
  carta.querySelector('.nombre').textContent = CARTAS[n];
  carta.setAttribute('aria-label', `${n}, ${CARTAS[n]}`);
}

// ---------- cuenta regresiva ----------

function detenerCuentaRegresiva() {
  if (cuadroCuenta) cancelAnimationFrame(cuadroCuenta);
  cuadroCuenta = null;
}

function iniciarCuentaRegresiva(segundos) {
  detenerCuentaRegresiva();
  const total = segundos * 1000;
  const fin = performance.now() + total;
  el.medallon.hidden = false;

  const cuadro = (ahora) => {
    const restante = Math.max(0, fin - ahora);
    el.segundos.textContent = Math.ceil(restante / 1000);
    el.anillo.style.strokeDashoffset = String(1 - restante / total);
    if (restante <= 0) {
      cuadroCuenta = null;
      revelar();
      return;
    }
    cuadroCuenta = requestAnimationFrame(cuadro);
  };
  cuadroCuenta = requestAnimationFrame(cuadro);
}

// ---------- flujo principal ----------

function sacarCuenta() {
  activarAudio();
  callarVoz();
  const [a, b] = baraja.siguiente();
  cuenta = { a, b };
  estado = 'preguntando';

  el.factores.forEach((carta, i) => {
    pintarFactor(carta, i === 0 ? a : b);
    voltear(carta, false);
    if (!reducirMovimiento.matches) repartir(carta);
  });

  voltear(el.resultado, true);
  el.leyenda.textContent = `¿Cuánto es ${a} × ${b}?`;
  el.boton.textContent = 'Ver resultado';
  el.boton.classList.add('esperando');
  actualizarBaraja();

  iniciarCuentaRegresiva(ajustes.segundos);
  if (ajustes.voz) decir(vozPregunta(a, b));
  precargar(vozRespuesta(a, b));
}

function revelar() {
  if (estado !== 'preguntando') return;
  detenerCuentaRegresiva();
  estado = 'revelada';
  const { a, b } = cuenta;

  el.producto.textContent = a * b;
  el.nombreCuenta.textContent = `${a} × ${b}`;
  el.resultado.setAttribute('aria-label', `${a} por ${b} es ${a * b}`);
  voltear(el.resultado, false);
  // El medallón se esconde cuando la carta ya dio media vuelta.
  setTimeout(() => (el.medallon.hidden = estado === 'revelada'), reducirMovimiento.matches ? 0 : 300);

  el.leyenda.textContent = `${a} × ${b} = ${a * b}`;
  el.boton.textContent = 'Otra cuenta';
  el.boton.classList.remove('esperando');

  if (ajustes.sonido) sonar(SFX_REVELAR, { volumen: 0.9 });
  if (ajustes.voz) decir(vozRespuesta(a, b), { retraso: ajustes.sonido ? 0.45 : 0 });
}

function accionPrincipal() {
  if (estado === 'preguntando') revelar();
  else sacarCuenta();
}

function actualizarBaraja() {
  el.barajaInfo.textContent = baraja.sacadas ? `Carta ${baraja.sacadas} de ${baraja.total}` : '';
}

el.boton.addEventListener('click', accionPrincipal);

// La barra espaciadora hace lo mismo que el botón principal,
// salvo cuando el foco está en otro control o hay un diálogo abierto.
document.addEventListener('keydown', (e) => {
  if (e.code !== 'Space' || e.repeat) return;
  if (document.querySelector('dialog[open]')) return;
  const t = e.target;
  if (t instanceof HTMLElement && t.closest('button, input, select, textarea, a')) return;
  e.preventDefault();
  accionPrincipal();
});

// ---------- estudio del día ----------

if (modoPrueba) usarClavesDePrueba();
const unidadMs = modoPrueba ? 1000 : 60000;
const unidad = modoPrueba ? 's' : 'min';

function pintarEstudio(info) {
  el.botonEstudio.setAttribute('aria-pressed', String(info.corriendo));
  el.botonEstudio.classList.toggle('terminado', info.completado);
  el.estudioAvance.style.width = `${info.fraccion * 100}%`;
  let texto;
  if (info.completado) texto = `Listo por hoy: ${info.meta} ${unidad}`;
  else if (info.corriendo) texto = `${info.unidades} de ${info.meta} ${unidad}`;
  else if (info.unidades > 0 || info.fraccion > 0) texto = `En pausa: ${info.unidades} de ${info.meta} ${unidad}`;
  else texto = 'Empezar estudio';
  el.estudioTexto.textContent = texto;
  el.botonEstudio.title = info.completado
    ? 'Ya cumpliste el tiempo de estudio de hoy'
    : info.corriendo
      ? 'Pausar el tiempo de estudio'
      : 'Contar el tiempo de estudio de hoy';
}

function pintarRacha() {
  const dias = leerRacha();
  el.rachaInfo.textContent = dias > 0 ? `Racha: ${dias} ${dias === 1 ? 'día' : 'días'}` : '';
}

async function celebrar({ unidades, racha }) {
  pintarRacha();
  activarAudio();
  if (ajustes.sonido) sonar(SFX_VICTORIA);
  el.victoriaTexto.textContent =
    `Estudiaste ${unidades} ${unidad === 'min' ? 'minutos' : 'segundos'} hoy.` +
    (racha > 1 ? ` Llevas ${racha} días seguidos.` : '');
  el.dialogoVictoria.showModal();
  await lanzarSerpentinas(el.canvas, { reducido: reducirMovimiento.matches });
}

const estudio = crearEstudio({
  metaUnidades: ajustes.minutos,
  unidadMs,
  alCambiar: pintarEstudio,
  alCompletar: celebrar,
});

el.botonEstudio.addEventListener('click', () => {
  activarAudio();
  precargar(SFX_VICTORIA, SFX_REVELAR);
  estudio.alternar();
});

// ---------- ajustes ----------

montarDialogoAjustes({
  dialogo: el.dialogoAjustes,
  boton: $('#boton-ajustes'),
  obtener: () => ajustes,
  alGuardar(nuevos) {
    const cambiaronTablas = nuevos.tablas.join() !== ajustes.tablas.join();
    ajustes = nuevos;
    if (cambiaronTablas) {
      baraja.configurar(ajustes.tablas);
      actualizarBaraja();
    }
    estudio.cambiarMeta(ajustes.minutos);
    if (!ajustes.voz) callarVoz();
  },
});

// ---------- arranque ----------

el.factores.forEach((c) => voltear(c, true));
voltear(el.resultado, true);
pintarEstudio(estudio.info());
pintarRacha();
actualizarBaraja();
dibujarPapelPicado($('.papel-picado'));

// Precarga las ilustraciones para que las cartas no aparezcan vacías.
for (const n of Object.keys(CARTAS)) new Image().src = `assets/img/${n}.webp`;
// El audio se decodifica hasta el primer gesto (los navegadores lo exigen).
addEventListener('pointerdown', () => { activarAudio(); precargar(SFX_REVELAR, SFX_VICTORIA); }, { once: true });
