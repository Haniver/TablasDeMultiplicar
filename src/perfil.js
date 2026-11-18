// Jugadores: elegir o crear uno, abrir un progreso con su código y mostrar el tablero de progreso.

import {
  perfilesRecordados,
  recordarPerfil,
  perfilGuardadoComoActual,
  abrirPerfil,
  codigoActual,
  leer,
  guardar,
  datosActuales,
  reemplazarDatos,
} from './almacen.js';
import { generarCodigo, normalizarCodigo, codigoBonito, bajar } from './nube.js';
import { fusionar } from './fusionar.js';
import { estadoDe, claveDe } from './repaso.js';

const $ = (s) => document.querySelector(s);

export function nombreJugador() {
  return leer('perfil', {}).nombre || 'Jugador';
}

export function enlaceDelCodigo(codigo) {
  // El código va después de «#» para que no viaje al servidor de la página.
  return `${location.origin}${location.pathname}#codigo=${codigo}`;
}

function codigoDelEnlace() {
  const m = location.hash.match(/codigo=([0-9A-Za-z-]+)/);
  if (!m) return null;
  history.replaceState(null, '', location.pathname + location.search);
  return normalizarCodigo(m[1]);
}

// Abre un progreso existente. Lanza un Error con un mensaje para mostrar si no se puede.
async function abrirConCodigo(codigo) {
  let remoto;
  try {
    remoto = await bajar(codigo);
  } catch {
    // Sin conexión: si este dispositivo ya conocía ese código, se abre la copia local.
    if (perfilesRecordados().some((p) => p.codigo === codigo)) {
      abrirPerfil(codigo);
      return { codigo, nuevo: false };
    }
    throw new Error('No me pude conectar al servidor. Revisa tu conexión e inténtalo otra vez.');
  }
  if (!remoto) throw new Error('No encontré ese código. Revisa que esté bien escrito.');
  abrirPerfil(codigo);
  reemplazarDatos(fusionar(datosActuales(), remoto));
  recordarPerfil(codigo, nombreJugador());
  return { codigo, nuevo: false };
}

// Decide con qué jugador arrancar: el del enlace, el último usado o el que se elija en el diálogo.
export async function elegirJugador() {
  const delEnlace = codigoDelEnlace();
  if (delEnlace) {
    try {
      return await abrirConCodigo(delEnlace);
    } catch {
      /* si falla, se sigue con lo de abajo */
    }
  }
  const actual = perfilGuardadoComoActual();
  if (actual) {
    abrirPerfil(actual);
    return { codigo: actual, nuevo: false };
  }
  return mostrarDialogoJugador({ obligatorio: true });
}

// Diálogo «¿Quién va a jugar?». Con `obligatorio` no se puede cerrar sin elegir.
export function mostrarDialogoJugador({ obligatorio = false } = {}) {
  const dialogo = $('#dialogo-perfil');
  const lista = $('#perfil-lista');
  const error = $('#error-perfil');
  const formNuevo = $('#form-nuevo');
  const formCodigo = $('#form-codigo');
  error.hidden = true;
  formNuevo.reset();
  formCodigo.reset();

  const recordados = perfilesRecordados();
  lista.innerHTML = '';
  for (const p of recordados) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'perfil-opcion';
    b.dataset.codigo = p.codigo;
    b.innerHTML = `<span class="perfil-nombre"></span><span class="perfil-codigo"></span>`;
    b.querySelector('.perfil-nombre').textContent = p.nombre;
    b.querySelector('.perfil-codigo').textContent = `…${p.codigo.slice(-4)}`;
    if (p.codigo === codigoActual()) b.setAttribute('aria-current', 'true');
    lista.append(b);
  }
  lista.hidden = !recordados.length;

  return new Promise((resolver) => {
    const terminar = (resultado) => {
      limpiar();
      dialogo.close();
      // Al cambiar de jugador con la app ya andando, se recarga para empezar limpio.
      if (!obligatorio) location.reload();
      else resolver(resultado);
    };
    const alElegir = (e) => {
      const b = e.target.closest('.perfil-opcion');
      if (!b) return;
      abrirPerfil(b.dataset.codigo);
      terminar({ codigo: b.dataset.codigo, nuevo: false });
    };
    const alNuevo = (e) => {
      e.preventDefault();
      const nombre = formNuevo.nombre.value.trim();
      if (!nombre) return;
      const codigo = generarCodigo();
      abrirPerfil(codigo);
      guardar('perfil', { nombre });
      recordarPerfil(codigo, nombre);
      terminar({ codigo, nuevo: true });
    };
    const alCodigo = async (e) => {
      e.preventDefault();
      const codigo = normalizarCodigo(formCodigo.codigo.value);
      if (!codigo) {
        error.textContent = 'El código tiene 20 letras y números, por ejemplo 8F3K-Q2MZ-7HJN-4PRT-WX9C.';
        error.hidden = false;
        return;
      }
      try {
        terminar(await abrirConCodigo(codigo));
      } catch (err) {
        error.textContent = err.message;
        error.hidden = false;
      }
    };
    const alCancelar = (e) => obligatorio && e.preventDefault();
    const limpiar = () => {
      lista.removeEventListener('click', alElegir);
      formNuevo.removeEventListener('submit', alNuevo);
      formCodigo.removeEventListener('submit', alCodigo);
      dialogo.removeEventListener('cancel', alCancelar);
    };
    lista.addEventListener('click', alElegir);
    formNuevo.addEventListener('submit', alNuevo);
    formCodigo.addEventListener('submit', alCodigo);
    dialogo.addEventListener('cancel', alCancelar);
    dialogo.showModal();
  });
}

// ---------- diálogo de progreso ----------

const TEXTO_ESTADO = {
  nueva: 'sin ver',
  aprendiendo: 'aprendiendo',
  'en-camino': 'en camino',
  dominada: 'dominada',
};

export function montarDialogoProgreso({ boton }) {
  const dialogo = $('#dialogo-progreso');

  $('#copiar-enlace').addEventListener('click', async (e) => {
    const b = e.currentTarget;
    try {
      await navigator.clipboard.writeText(enlaceDelCodigo(codigoActual()));
      b.textContent = 'Enlace copiado';
    } catch {
      b.textContent = 'No se pudo copiar';
    }
    setTimeout(() => (b.textContent = 'Copiar enlace'), 2000);
  });
  $('#cambiar-jugador').addEventListener('click', () => {
    dialogo.close();
    mostrarDialogoJugador();
  });
  boton.addEventListener('click', () => mostrarProgreso());

  return { mostrarProgreso };
}

export function mostrarProgreso({ aviso = false } = {}) {
  const dialogo = $('#dialogo-progreso');
  const tarjetas = datosActuales().tarjetas;
  $('#progreso-titulo').textContent = `Progreso de ${nombreJugador()}`;
  $('#aviso-codigo').hidden = !aviso;
  $('#progreso-codigo').textContent = codigoBonito(codigoActual());

  const cuentas = { nueva: 0, aprendiendo: 0, 'en-camino': 0, dominada: 0 };
  let html = '<span class="celda encabezado-tabla" aria-hidden="true">×</span>';
  for (let b = 2; b <= 9; b++) html += `<span class="celda encabezado-tabla" aria-hidden="true">${b}</span>`;
  for (let a = 2; a <= 9; a++) {
    html += `<span class="celda encabezado-tabla" aria-hidden="true">${a}</span>`;
    for (let b = 2; b <= 9; b++) {
      const estado = estadoDe(tarjetas[claveDe(a, b)]);
      cuentas[estado]++;
      html += `<span class="celda" data-estado="${estado}" title="${a} × ${b}: ${TEXTO_ESTADO[estado]}">${a * b}</span>`;
    }
  }
  $('#tablero-progreso').innerHTML = html;
  $('#tablero-progreso').setAttribute(
    'aria-label',
    `Dominadas ${cuentas.dominada}, en camino ${cuentas['en-camino']}, aprendiendo ${cuentas.aprendiendo}, sin ver ${cuentas.nueva}.`,
  );
  $('#progreso-resumen').textContent =
    cuentas.dominada === 64
      ? '¡Dominaste las 64 cuentas!'
      : `Dominadas: ${cuentas.dominada} de 64. En camino: ${cuentas['en-camino']}. Aprendiendo: ${cuentas.aprendiendo}.`;
  if (!dialogo.open) dialogo.showModal();
}
