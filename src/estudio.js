import { leer, guardar, hoy, ayer } from './almacen.js';

let CLAVE_ESTUDIO = 'tablas:estudio';
let CLAVE_RACHA = 'tablas:racha';

// Con ?prueba se usan otras claves, para que las pruebas no ensucien el estudio real.
export function usarClavesDePrueba() {
  CLAVE_ESTUDIO += ':prueba';
  CLAVE_RACHA += ':prueba';
}

// Racha de días seguidos en los que se cumplió la meta.
export function leerRacha() {
  const r = leer(CLAVE_RACHA, { ultima: null, dias: 0 });
  const vigente = r.ultima === hoy() || r.ultima === ayer();
  return vigente ? r.dias : 0;
}

function sumarDiaARacha() {
  const r = leer(CLAVE_RACHA, { ultima: null, dias: 0 });
  if (r.ultima === hoy()) return r.dias;
  const dias = r.ultima === ayer() ? r.dias + 1 : 1;
  guardar(CLAVE_RACHA, { ultima: hoy(), dias });
  return dias;
}

// Cronómetro de estudio del día. Cuenta hacia arriba, se puede pausar y
// guarda lo acumulado por fecha para que recargar la página no lo borre.
// `unidadMs` es 60 000 (minutos) normalmente, o 1 000 con ?prueba.
export function crearEstudio({ metaUnidades, unidadMs, alCambiar, alCompletar }) {
  let meta = metaUnidades;
  let estado = cargar();
  let inicio = null; // performance.now() cuando arrancó el tramo actual
  let intervalo = null;
  let ultimoGuardado = 0;

  function cargar() {
    const e = leer(CLAVE_ESTUDIO, null);
    if (e?.fecha === hoy()) return { fecha: e.fecha, ms: Number(e.ms) || 0, completado: !!e.completado };
    return { fecha: hoy(), ms: 0, completado: false };
  }

  function persistir() {
    guardar(CLAVE_ESTUDIO, { ...estado, ms: msActual() });
    ultimoGuardado = performance.now();
  }

  function msActual() {
    return estado.ms + (inicio === null ? 0 : performance.now() - inicio);
  }

  function info() {
    return {
      corriendo: inicio !== null,
      completado: estado.completado,
      unidades: Math.floor(msActual() / unidadMs),
      meta,
      fraccion: estado.completado ? 1 : Math.min(1, msActual() / (meta * unidadMs)),
    };
  }

  function revisarCambioDeDia() {
    if (estado.fecha === hoy()) return;
    const corriendo = inicio !== null;
    estado = { fecha: hoy(), ms: 0, completado: false };
    inicio = corriendo ? performance.now() : null;
    persistir();
  }

  function tic() {
    revisarCambioDeDia();
    if (inicio !== null && msActual() >= meta * unidadMs) {
      completar();
      return;
    }
    // Cada 30 s basta: cada guardado también se sube al servidor.
    if (performance.now() - ultimoGuardado > 30000) persistir();
    alCambiar(info());
  }

  function iniciar() {
    if (inicio !== null || estado.completado) return;
    inicio = performance.now();
    intervalo = setInterval(tic, 500);
    persistir();
    alCambiar(info());
  }

  function pausar() {
    if (inicio === null) return;
    estado.ms = msActual();
    inicio = null;
    clearInterval(intervalo);
    intervalo = null;
    persistir();
    alCambiar(info());
  }

  function completar() {
    estado.ms = Math.max(msActual(), meta * unidadMs);
    inicio = null;
    clearInterval(intervalo);
    intervalo = null;
    estado.completado = true;
    persistir();
    const racha = sumarDiaARacha();
    alCambiar(info());
    alCompletar({ unidades: meta, racha });
  }

  // Al cerrar o esconder la pestaña se guarda lo acumulado.
  addEventListener('pagehide', () => inicio !== null && persistir());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && inicio !== null) persistir();
  });

  return {
    alternar() {
      revisarCambioDeDia();
      if (estado.completado) return;
      if (inicio === null) iniciar();
      else pausar();
    },
    // Si suben la meta después de cumplirla, se puede seguir estudiando.
    cambiarMeta(nueva) {
      meta = nueva;
      if (estado.completado && estado.ms < meta * unidadMs) {
        estado.completado = false;
        persistir();
      }
      tic();
      alCambiar(info());
    },
    info,
  };
}
