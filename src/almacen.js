// Lectura y escritura en localStorage que nunca truena (modo privado, almacenamiento bloqueado, etc.).

export function leer(clave, defecto) {
  try {
    const texto = localStorage.getItem(clave);
    return texto ? JSON.parse(texto) : defecto;
  } catch {
    return defecto;
  }
}

export function guardar(clave, valor) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    /* sin almacenamiento: la app sigue funcionando, solo no recuerda */
  }
}

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
  const f = new Date();
  f.setDate(f.getDate() - 1);
  return fechaLocal(f);
}
