import { leer, guardar } from './almacen.js';

const CLAVE = 'tablas:ajustes';
export const TODAS_LAS_TABLAS = [2, 3, 4, 5, 6, 7, 8, 9];

const DEFECTO = {
  segundos: 5,
  minutos: 15,
  tablas: TODAS_LAS_TABLAS,
  voz: true,
  sonido: true,
};

const entero = (v, min, max, defecto) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : defecto;
};

function normalizar(a) {
  const tablas = Array.isArray(a.tablas)
    ? [...new Set(a.tablas.map(Number))].filter((t) => TODAS_LAS_TABLAS.includes(t)).sort((x, y) => x - y)
    : DEFECTO.tablas;
  return {
    segundos: entero(a.segundos, 2, 30, DEFECTO.segundos),
    minutos: entero(a.minutos, 1, 120, DEFECTO.minutos),
    tablas: tablas.length ? tablas : DEFECTO.tablas,
    voz: a.voz !== false,
    sonido: a.sonido !== false,
  };
}

export function cargarAjustes() {
  return normalizar({ ...DEFECTO, ...leer(CLAVE, {}) });
}

export function guardarAjustes(ajustes) {
  const limpios = normalizar(ajustes);
  guardar(CLAVE, limpios);
  return limpios;
}

// Conecta el <dialog> de ajustes. `alGuardar` recibe los ajustes nuevos ya validados.
export function montarDialogoAjustes({ dialogo, boton, obtener, alGuardar }) {
  const form = dialogo.querySelector('form');
  const opciones = dialogo.querySelector('#tablas-opciones');
  const error = dialogo.querySelector('#error-tablas');

  opciones.innerHTML = TODAS_LAS_TABLAS.map(
    (t) => `<label><input type="checkbox" name="tabla" value="${t}" aria-label="Tabla del ${t}"><span>${t}</span></label>`,
  ).join('');

  boton.addEventListener('click', () => {
    const a = obtener();
    form.segundos.value = a.segundos;
    form.minutos.value = a.minutos;
    for (const caja of form.querySelectorAll('input[name="tabla"]')) {
      caja.checked = a.tablas.includes(Number(caja.value));
    }
    form.voz.checked = a.voz;
    form.sonido.checked = a.sonido;
    error.hidden = true;
    dialogo.showModal();
  });

  dialogo.querySelector('#ajustes-cancelar').addEventListener('click', () => dialogo.close());

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const tablas = [...form.querySelectorAll('input[name="tabla"]:checked')].map((c) => Number(c.value));
    if (!tablas.length) {
      error.hidden = false;
      form.querySelector('input[name="tabla"]').focus();
      return;
    }
    if (!form.reportValidity()) return;
    const nuevos = guardarAjustes({
      segundos: form.segundos.value,
      minutos: form.minutos.value,
      tablas,
      voz: form.voz.checked,
      sonido: form.sonido.checked,
    });
    dialogo.close();
    alGuardar(nuevos);
  });
}
