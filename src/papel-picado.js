// Tira de papel picado en SVG. Cada banderita usa la misma máscara de recortes,
// escalada a su tamaño, y se redibuja cuando cambia el ancho de la ventana.

const COLORES = ['#E4007C', '#FFA400', '#7A3FB0', '#FFE14D', '#E8412C', '#2DBE60', '#FF7AC0'];

// Recortes en coordenadas 0–1 de la banderita (negro = hueco).
function recortes() {
  const partes = [];
  // Flor central
  const cx = 0.5, cy = 0.46;
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    partes.push(`<ellipse cx="${cx + Math.cos(ang) * 0.15}" cy="${cy + Math.sin(ang) * 0.12}" rx="0.07" ry="0.055" fill="black"/>`);
  }
  partes.push(`<circle cx="${cx}" cy="${cy}" r="0.06" fill="black"/>`);
  // Rombos arriba
  for (const x of [0.2, 0.4, 0.6, 0.8]) {
    partes.push(`<polygon points="${x},0.1 ${x + 0.05},0.16 ${x},0.22 ${x - 0.05},0.16" fill="black"/>`);
  }
  // Puntitos abajo
  for (const x of [0.22, 0.5, 0.78]) partes.push(`<circle cx="${x}" cy="0.76" r="0.035" fill="black"/>`);
  for (const x of [0.36, 0.64]) partes.push(`<circle cx="${x}" cy="0.8" r="0.025" fill="black"/>`);
  // Picos en la orilla de abajo
  const n = 7;
  let picos = '0,1.01';
  for (let i = 0; i < n; i++) picos += ` ${(i + 0.5) / n},0.92 ${(i + 1) / n},1.01`;
  partes.push(`<polygon points="${picos}" fill="black"/>`);
  return partes.join('');
}

export function dibujarPapelPicado(svg) {
  const pintar = () => {
    const ancho = svg.clientWidth || innerWidth;
    const alto = svg.clientHeight || 90;
    const cantidad = Math.max(5, Math.round(ancho / 82));
    const paso = ancho / cantidad;
    const bandera = paso * 0.9;
    const top = 7;

    let banderas = '';
    for (let i = 0; i < cantidad; i++) {
      const x = i * paso + (paso - bandera) / 2;
      const giro = (i % 2 ? 1.6 : -1.6).toFixed(1);
      banderas +=
        `<g transform="rotate(${giro} ${x + bandera / 2} ${top})">` +
        `<rect x="${x}" y="${top}" width="${bandera}" height="${alto - top - 2}" fill="${COLORES[i % COLORES.length]}" mask="url(#papel-recortes)"/>` +
        `</g>`;
    }

    svg.setAttribute('viewBox', `0 0 ${ancho} ${alto}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.innerHTML =
      `<defs><mask id="papel-recortes" maskContentUnits="objectBoundingBox">` +
      `<rect width="1" height="1" fill="white"/>${recortes()}</mask></defs>` +
      `<path d="M0 ${top} Q ${ancho / 2} ${top + 3} ${ancho} ${top}" stroke="#3D1A5B" stroke-width="3" fill="none"/>` +
      banderas;
  };

  pintar();
  let espera;
  addEventListener('resize', () => {
    clearTimeout(espera);
    espera = setTimeout(pintar, 120);
  });

}
