// Serpentinas rizadas y confeti de papel picado en un <canvas>, sin librerías.

const COLORES = ['#E4007C', '#FFA400', '#00C2B8', '#7A3FB0', '#E8412C', '#FFE14D', '#2DBE60'];

const azar = (min, max) => min + Math.random() * (max - min);
const elegir = (lista) => lista[Math.floor(Math.random() * lista.length)];

function crearSerpentina(ancho, alto) {
  // Salen disparadas desde abajo, suben, frenan y caen haciendo rizos.
  const desdeIzquierda = Math.random() < 0.5;
  return {
    x: desdeIzquierda ? azar(-20, ancho * 0.25) : azar(ancho * 0.75, ancho + 20),
    y: alto + azar(10, 60),
    vx: (desdeIzquierda ? 1 : -1) * azar(90, 260),
    vy: -azar(alto * 0.95, alto * 1.35),
    angulo: azar(0, Math.PI * 2),
    giro: azar(4, 7) * (Math.random() < 0.5 ? -1 : 1),
    radio: azar(16, 28),
    grosor: azar(4, 7),
    color: elegir(COLORES),
    rastro: [],
    largo: Math.floor(azar(28, 46)),
  };
}

function crearConfeti(ancho) {
  return {
    x: azar(0, ancho),
    y: azar(-ancho * 0.5, -10),
    vx: azar(-40, 40),
    vy: azar(80, 200),
    ancho: azar(8, 14),
    alto: azar(10, 18),
    rot: azar(0, Math.PI * 2),
    vrot: azar(-5, 5),
    volteo: azar(0, Math.PI * 2),
    vvolteo: azar(4, 9),
    color: elegir(COLORES),
  };
}

export function lanzarSerpentinas(canvas, { reducido = false, duracion = 6500 } = {}) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const ancho = window.innerWidth;
  const alto = window.innerHeight;
  canvas.width = ancho * dpr;
  canvas.height = alto * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const serpentinas = Array.from({ length: reducido ? 6 : 26 }, () => crearSerpentina(ancho, alto));
  const confeti = Array.from({ length: reducido ? 30 : 150 }, () => crearConfeti(ancho));
  const gravedad = alto * 1.1;

  let previo = performance.now();
  const comienzo = previo;

  return new Promise((resolver) => {
    function cuadro(ahora) {
      const dt = Math.min(0.05, (ahora - previo) / 1000);
      previo = ahora;
      const t = ahora - comienzo;
      ctx.clearRect(0, 0, ancho, alto);
      // Desvanece todo en el último segundo.
      ctx.globalAlpha = Math.max(0, Math.min(1, (duracion - t) / 1000));

      for (const s of serpentinas) {
        s.vy += gravedad * dt * 0.55;
        s.vx *= 1 - 0.9 * dt;
        s.vy = Math.min(s.vy, 160); // caen despacio, como papel
        s.angulo += s.giro * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        // El rizo: la punta gira alrededor de su trayectoria.
        const px = s.x + Math.cos(s.angulo) * s.radio;
        const py = s.y + Math.sin(s.angulo) * s.radio * 0.7;
        s.rastro.push([px, py]);
        if (s.rastro.length > s.largo) s.rastro.shift();

        ctx.strokeStyle = s.color;
        ctx.lineWidth = s.grosor;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        s.rastro.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
      }

      for (const c of confeti) {
        c.vy = Math.min(c.vy + gravedad * 0.25 * dt, 260);
        c.x += (c.vx + Math.sin(c.volteo) * 30) * dt;
        c.y += c.vy * dt;
        c.rot += c.vrot * dt;
        c.volteo += c.vvolteo * dt;
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.rot);
        ctx.scale(Math.cos(c.volteo), 1); // se voltea como un papelito
        ctx.fillStyle = c.color;
        ctx.fillRect(-c.ancho / 2, -c.alto / 2, c.ancho, c.alto);
        ctx.restore();
      }

      if (t < duracion) {
        requestAnimationFrame(cuadro);
      } else {
        ctx.clearRect(0, 0, ancho, alto);
        ctx.globalAlpha = 1;
        resolver();
      }
    }
    requestAnimationFrame(cuadro);
  });
}
