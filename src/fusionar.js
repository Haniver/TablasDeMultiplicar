// Fusión de progreso entre dispositivos. La usan la app y el servidor.
// Los datos tienen dos partes:
//   secciones: { clave: { valor, rev } }   (ajustes, racha, estudio del día, perfil)
//   tarjetas:  { "5x8": { ..., rev } }      (estado de repetición espaciada de cada cuenta)
// En cada entrada gana la que tenga el `rev` (marca de tiempo) más reciente.

export function datosVacios() {
  return { secciones: {}, tarjetas: {} };
}

function fusionarMapa(a = {}, b = {}) {
  const r = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (!v || typeof v !== 'object') continue;
    if (!r[k] || (Number(v.rev) || 0) > (Number(r[k].rev) || 0)) r[k] = v;
  }
  return r;
}

export function fusionar(a, b) {
  return {
    secciones: fusionarMapa(a?.secciones, b?.secciones),
    tarjetas: fusionarMapa(a?.tarjetas, b?.tarjetas),
  };
}

// Huella para saber si dos versiones tienen exactamente las mismas revisiones.
export function huella(d) {
  const partes = [];
  for (const parte of ['secciones', 'tarjetas']) {
    const mapa = d?.[parte] ?? {};
    for (const k of Object.keys(mapa).sort()) partes.push(`${parte}.${k}:${mapa[k]?.rev ?? 0}`);
  }
  return partes.join('|');
}

export function sonDatosValidos(d) {
  const esMapa = (x) => x && typeof x === 'object' && !Array.isArray(x);
  return esMapa(d) && esMapa(d.secciones) && esMapa(d.tarjetas);
}
