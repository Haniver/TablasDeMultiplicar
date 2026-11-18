import { leer, guardar } from './almacen.js';

const CLAVE = 'tablas:baraja';

// Todas las cuentas de 2–9 × 2–9 donde aparece alguna de las tablas elegidas.
function cuentasDe(tablas) {
  const cuentas = [];
  for (let a = 2; a <= 9; a++) {
    for (let b = 2; b <= 9; b++) {
      if (tablas.includes(a) || tablas.includes(b)) cuentas.push([a, b]);
    }
  }
  return cuentas;
}

function barajar(lista) {
  const l = [...lista];
  for (let i = l.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [l[i], l[j]] = [l[j], l[i]];
  }
  return l;
}

const iguales = (x, y) => x && y && x[0] === y[0] && x[1] === y[1];

// Saca cuentas sin repetir hasta acabar la baraja; luego vuelve a barajar.
// El estado se guarda para que recargar la página no reinicie la baraja.
export class Baraja {
  constructor(tablas) {
    this.configurar(tablas);
  }

  configurar(tablas) {
    const firma = tablas.join(',');
    const guardada = leer(CLAVE, null);
    this.firma = firma;
    this.tablas = tablas;
    this.total = cuentasDe(tablas).length;
    if (guardada?.firma === firma && Array.isArray(guardada.restantes)) {
      this.restantes = guardada.restantes;
      this.ultima = guardada.ultima ?? null;
    } else {
      this.restantes = barajar(cuentasDe(tablas));
      this.ultima = null;
      this.guardar();
    }
  }

  get sacadas() {
    return this.total - this.restantes.length;
  }

  siguiente() {
    if (!this.restantes.length) {
      this.restantes = barajar(cuentasDe(this.tablas));
      // Que la primera de la baraja nueva no sea la misma que la última que salió.
      const tope = this.restantes.length - 1;
      if (tope > 0 && iguales(this.restantes[tope], this.ultima)) {
        [this.restantes[0], this.restantes[tope]] = [this.restantes[tope], this.restantes[0]];
      }
    }
    const cuenta = this.restantes.pop();
    this.ultima = cuenta;
    this.guardar();
    return cuenta;
  }

  guardar() {
    guardar(CLAVE, { firma: this.firma, restantes: this.restantes, ultima: this.ultima });
  }
}
