import { cargarAjustes, montarDialogoAjustes } from './ajustes.js';
import { Sesion, nivelDe } from './repaso.js';
import { activarAudio, precargar, decir, sonar, callarVoz } from './audio.js';
import { crearEstudio, leerRacha, usarClavesDePrueba } from './estudio.js';
import { lanzarSerpentinas } from './serpentinas.js';
import { dibujarPapelPicado } from './papel-picado.js';
import { crearSincronizador } from './nube.js';
import { elegirJugador, nombreJugador, montarDialogoProgreso, mostrarProgreso } from './perfil.js';

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

const FRIJOLES = 4;
const PAUSA_TRAS_CALIFICAR = 750; // ms para ver el frijol antes de la siguiente carta

const modoPrueba = new URLSearchParams(location.search).has('prueba');
const reducirMovimiento = matchMedia('(prefers-reduced-motion: reduce)');

const $ = (s) => document.querySelector(s);
const el = {
  factores: [...document.querySelectorAll('.carta-factor')],
  resultado: $('.carta-resultado'),
  producto: $('.producto'),
  frijoles: $('.frijoles'),
  nombreCuenta: $('.nombre-cuenta'),
  medallon: $('.medallon'),
  segundos: $('.segundos'),
  anillo: $('.anillo-avance'),
  leyenda: $('#leyenda'),
  boton: $('#boton-principal'),
  calificar: $('#calificar'),
  botonTodavia: $('#boton-todavia'),
  botonMeLaSe: $('#boton-me-la-se'),
  atajo: $('#atajo'),
  botonJugador: $('#boton-jugador'),
  jugadorNombre: $('#jugador-nombre'),
  puntoNube: $('#punto-nube'),
  estadoNube: $('#estado-nube'),
  pendientesInfo: $('#pendientes-info'),
  rachaInfo: $('#racha-info'),
  botonEstudio: $('#boton-estudio'),
  estudioTexto: $('#estudio-texto'),
  estudioAvance: $('#estudio-avance'),
  dialogoAjustes: $('#dialogo-ajustes'),
  dialogoVictoria: $('#dialogo-victoria'),
  victoriaTexto: $('#victoria-texto'),
  canvas: $('#serpentinas'),
};

let ajustes;
let sesion;
let estudio;

// estado: 'inicio' | 'preguntando' | 'revelada' | 'calificando' | 'fin'
let estado = 'inicio';
let carta = null;
let cuadroCuenta = null;

// ---------- cartas ----------

function voltear(elemento, bocaAbajo) {
  elemento.classList.toggle('boca-abajo', bocaAbajo);
}

function repartir(elemento) {
  elemento.classList.remove('repartida');
  void elemento.offsetWidth; // reinicia la animación
  elemento.classList.add('repartida');
}

function pintarFactor(elemento, n) {
  elemento.querySelector('.esquina').textContent = n;
  const img = elemento.querySelector('.ilustracion');
  img.src = `assets/img/${n}.webp`;
  img.alt = '';
  elemento.querySelector('.nombre').textContent = CARTAS[n];
  elemento.setAttribute('aria-label', `${n}, ${CARTAS[n]}`);
}

// Frijoles en la carta del resultado: cuántos tiene es qué tan bien se la sabe.
// En la lotería se marcan las cartas con frijoles; aquí se ganan contestando bien.
function pintarFrijoles(nivel, animacion = null) {
  el.frijoles.innerHTML = '';
  for (let i = 0; i < FRIJOLES; i++) {
    const f = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    f.setAttribute('viewBox', '0 0 24 16');
    f.classList.add('frijol');
    if (i < nivel) f.classList.add('lleno');
    if (animacion === 'gana' && i === nivel - 1) f.classList.add('nuevo');
    f.innerHTML =
      '<path d="M3.2 9.6C1.6 5.6 4.9 1.6 9.6 2.1c2.6.3 3.6 2 5.6 1.9 3.1-.2 5.9 1.9 5.6 5.1-.4 3.9-4.6 5.9-9.3 5.3-4-.5-6.9-2-8.3-4.8Z"/>' +
      '<path class="brillo" d="M7 5.2c1.4-.9 3.2-.8 4.2-.2"/>';
    el.frijoles.append(f);
  }
  el.frijoles.classList.remove('pierde');
  if (animacion === 'pierde') {
    void el.frijoles.offsetWidth;
    el.frijoles.classList.add('pierde');
  }
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

function mostrarBotonPrincipal(texto) {
  el.boton.hidden = false;
  el.calificar.hidden = true;
  el.boton.textContent = texto;
}

function sacarCuenta() {
  activarAudio();
  callarVoz();
  carta = sesion.siguiente();
  if (!carta) {
    mostrarFin();
    return;
  }
  const { a, b } = carta;
  estado = 'preguntando';

  el.factores.forEach((elemento, i) => {
    pintarFactor(elemento, i === 0 ? a : b);
    voltear(elemento, false);
    if (!reducirMovimiento.matches) repartir(elemento);
  });

  voltear(el.resultado, true);
  el.leyenda.textContent = `¿Cuánto es ${a} × ${b}?`;
  mostrarBotonPrincipal('Ver resultado');
  el.boton.classList.add('esperando');
  el.atajo.textContent = 'También puedes usar la barra espaciadora.';
  actualizarPendientes();

  iniciarCuentaRegresiva(ajustes.segundos);
  if (ajustes.voz) decir(vozPregunta(a, b));
  precargar(vozRespuesta(a, b));
}

function revelar() {
  if (estado !== 'preguntando') return;
  detenerCuentaRegresiva();
  estado = 'revelada';
  const { a, b, tarjeta } = carta;

  el.producto.textContent = a * b;
  el.nombreCuenta.textContent = `${a} × ${b}`;
  pintarFrijoles(nivelDe(tarjeta));
  el.resultado.setAttribute('aria-label', `${a} por ${b} es ${a * b}`);
  voltear(el.resultado, false);
  // El medallón se esconde cuando la carta ya dio media vuelta.
  setTimeout(() => (el.medallon.hidden = estado !== 'preguntando'), reducirMovimiento.matches ? 0 : 300);

  el.leyenda.textContent = `${a} × ${b} = ${a * b}. ¿Te la sabías?`;
  el.boton.hidden = true;
  el.boton.classList.remove('esperando');
  el.calificar.hidden = false;
  el.atajo.textContent = 'Flecha izquierda: todavía no. Flecha derecha: me la sé.';
  // Si el foco estaba en el botón principal, que no se pierda al esconderlo.
  if (document.activeElement === el.boton || document.activeElement === document.body) el.botonMeLaSe.focus({ preventScroll: true });

  if (ajustes.sonido) sonar(SFX_REVELAR, { volumen: 0.9 });
  if (ajustes.voz) decir(vozRespuesta(a, b), { retraso: ajustes.sonido ? 0.45 : 0 });
}

function calificar(sabia) {
  if (estado !== 'revelada') return;
  estado = 'calificando';
  const tarjeta = sesion.responder(carta.clave, sabia);
  pintarFrijoles(nivelDe(tarjeta), sabia ? 'gana' : 'pierde');
  el.calificar.hidden = true;
  el.leyenda.textContent = sabia ? '¡Bien! Ganaste un frijol.' : 'Va de nuevo en un ratito.';
  actualizarPendientes();
  setTimeout(sacarCuenta, PAUSA_TRAS_CALIFICAR);
}

function mostrarFin() {
  estado = 'fin';
  detenerCuentaRegresiva();
  el.factores.forEach((elemento) => voltear(elemento, true));
  voltear(el.resultado, true);
  el.medallon.hidden = true;
  el.leyenda.textContent = '¡Terminaste el repaso de hoy! Mañana te tocan otras.';
  mostrarBotonPrincipal(sesion.nuevasRestantes() ? 'Practicar 5 nuevas' : 'Repasar 5 más');
  el.boton.classList.remove('esperando');
  el.atajo.textContent = 'También puedes usar la barra espaciadora.';
  actualizarPendientes();
}

function accionPrincipal() {
  if (estado === 'preguntando') revelar();
  else if (estado === 'fin') {
    sesion.practicarMas();
    sacarCuenta();
  } else if (estado === 'inicio') sacarCuenta();
}

function actualizarPendientes() {
  const n = sesion.pendientes + (estado === 'preguntando' || estado === 'revelada' ? 1 : 0);
  el.pendientesInfo.textContent = n ? `Faltan hoy: ${n}` : 'Repaso de hoy: listo';
}

function pantallaInicial() {
  estado = 'inicio';
  el.factores.forEach((c) => voltear(c, true));
  voltear(el.resultado, true);
  const n = sesion.pendientes;
  if (!n) {
    mostrarFin();
    return;
  }
  el.leyenda.textContent = `Hola, ${nombreJugador()}. Hoy te tocan ${n} ${n === 1 ? 'carta' : 'cartas'}.`;
  mostrarBotonPrincipal('Sacar cuenta');
  actualizarPendientes();
}

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

// ---------- estado de la nube ----------

const TEXTO_NUBE = {
  guardando: 'Guardando en línea…',
  guardado: 'Progreso guardado en línea.',
  'sin-conexion': 'Sin conexión. El progreso se guarda en este dispositivo y se subirá cuando vuelva la conexión.',
};

function pintarNube(estadoNube) {
  el.puntoNube.dataset.estado = estadoNube;
  el.estadoNube.textContent = TEXTO_NUBE[estadoNube];
  el.botonJugador.title = TEXTO_NUBE[estadoNube];
}

// ---------- teclado ----------

document.addEventListener('keydown', (e) => {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  if (document.querySelector('dialog[open]')) return;
  const t = e.target;
  const enControl = t instanceof HTMLElement && t.closest('input, select, textarea');
  if (enControl) return;

  if (estado === 'revelada' && (e.key === 'ArrowLeft' || e.key === '1')) {
    e.preventDefault();
    calificar(false);
  } else if (estado === 'revelada' && (e.key === 'ArrowRight' || e.key === '2')) {
    e.preventDefault();
    calificar(true);
  } else if (e.code === 'Space' && !(t instanceof HTMLElement && t.closest('button, a'))) {
    // La barra espaciadora hace lo mismo que el botón principal.
    e.preventDefault();
    accionPrincipal();
  }
});

// ---------- arranque ----------

async function iniciar() {
  dibujarPapelPicado($('.papel-picado'));
  el.factores.forEach((c) => voltear(c, true));
  voltear(el.resultado, true);
  // Precarga las ilustraciones para que las cartas no aparezcan vacías.
  for (const n of Object.keys(CARTAS)) new Image().src = `assets/img/${n}.webp`;

  const jugador = await elegirJugador();

  ajustes = cargarAjustes();
  sesion = new Sesion({ tablas: ajustes.tablas, nuevasPorDia: ajustes.nuevas });
  el.jugadorNombre.textContent = nombreJugador();

  const sincronizador = crearSincronizador({
    alEstado: pintarNube,
    // Si otro dispositivo avanzó, se rehace la sesión mientras no haya una carta en juego.
    alTraerCambios() {
      pintarRacha();
      if (estado === 'inicio' || estado === 'fin') {
        sesion.armar();
        pantallaInicial();
      }
    },
  });
  sincronizador.sincronizar();

  estudio = crearEstudio({
    metaUnidades: ajustes.minutos,
    unidadMs,
    alCambiar: pintarEstudio,
    alCompletar: celebrar,
  });

  el.boton.addEventListener('click', accionPrincipal);
  el.botonTodavia.addEventListener('click', () => calificar(false));
  el.botonMeLaSe.addEventListener('click', () => calificar(true));
  el.botonEstudio.addEventListener('click', () => {
    activarAudio();
    precargar(SFX_VICTORIA, SFX_REVELAR);
    estudio.alternar();
  });

  montarDialogoAjustes({
    dialogo: el.dialogoAjustes,
    boton: $('#boton-ajustes'),
    obtener: () => ajustes,
    alGuardar(nuevos) {
      const cambioLaSesion = nuevos.tablas.join() !== ajustes.tablas.join() || nuevos.nuevas !== ajustes.nuevas;
      ajustes = nuevos;
      if (cambioLaSesion) {
        sesion = new Sesion({ tablas: ajustes.tablas, nuevasPorDia: ajustes.nuevas });
        if (estado !== 'preguntando' && estado !== 'revelada') pantallaInicial();
        else actualizarPendientes();
      }
      estudio.cambiarMeta(ajustes.minutos);
      if (!ajustes.voz) callarVoz();
    },
  });
  montarDialogoProgreso({ boton: el.botonJugador });

  pintarEstudio(estudio.info());
  pintarRacha();
  pantallaInicial();
  if (jugador.nuevo) mostrarProgreso({ aviso: true });

  // El audio se decodifica hasta el primer gesto (los navegadores lo exigen).
  addEventListener('pointerdown', () => { activarAudio(); precargar(SFX_REVELAR, SFX_VICTORIA); }, { once: true });
}

iniciar();
