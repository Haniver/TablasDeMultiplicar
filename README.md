# Lotería de las tablas

Web app para repasar las tablas de multiplicar del 2 al 9 con cartas de lotería.

- **Sacar cuenta** (o la barra espaciadora) muestra dos cartas; una voz lee la cuenta y corre una cuenta regresiva.
  Al terminar, la tercera carta se voltea con el resultado y la voz lo dice.
- Las cuentas salen de una baraja sin repetir hasta acabarse; en **Ajustes** eliges qué tablas repasar,
  los segundos para contestar, los minutos de estudio al día y si quieres voz y sonidos.
- El botón de abajo a la derecha cuenta el tiempo de estudio del día. Al cumplir la meta salen serpentinas
  y sube la racha de días seguidos.

## Correrla

Es HTML, CSS y JS sin build. Cualquier servidor estático sirve:

```bash
python -m http.server 5173
```

Abre <http://localhost:5173>. Con `?prueba` el cronómetro de estudio cuenta segundos en vez de minutos
(y guarda aparte), para probar la celebración rápido.

## Arte, sonidos y voces

Todo lo de `assets/` se generó una sola vez con Runware; la app no llama a ninguna API.
`scripts/generar-assets.mjs` lee `RUNWARE_API_KEY` de `.env` (que no se sube) y corre por etapas:

```bash
node scripts/generar-assets.mjs --etapa=imagenes --solo=8 --variantes=4
```

Etapas: `prueba`, `imagenes` (FLUX schnell), `sfx` (Mirelo), `musica` (ACE-Step), `voces` (Inworld TTS, voz Lupita).
Cada llamada pide `includeCost`, el gasto se acumula en `generados/costos.json` y el script se detiene antes de pasar de 1 USD.
Las variantes que no se usaron se quedan en `generados/` (ignorado por git).
