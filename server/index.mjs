// API de la Lotería de las tablas: guarda el progreso de cada jugador en Postgres.
// El código de progreso (20 caracteres al azar) es la única llave; no hay contraseñas.
//
//   GET  /api/salud                 → { ok: true }
//   GET  /api/progreso              (Authorization: Bearer CODIGO) → { datos } o 404
//   PUT  /api/progreso { datos }    (Authorization: Bearer CODIGO) → { datos fusionados }
//   POST /api/progreso { codigo, datos }  (text/plain, para navigator.sendBeacon al cerrar)

import http from 'node:http';
import pg from 'pg';
import { fusionar, sonDatosValidos } from '../src/fusionar.js';

const PUERTO = Number(process.env.PUERTO || 8010);
const ORIGENES = (process.env.ORIGENES || 'https://haniver.github.io,http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((o) => o.trim());
const LIMITE_CUERPO = 256 * 1024;
const CODIGO = /^[2-9A-HJ-NP-Z]{20}$/;
const NUEVOS_POR_HORA_POR_IP = 10;

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 });

await pool.query(`
  create table if not exists progreso (
    codigo      text primary key,
    datos       jsonb not null,
    creado      timestamptz not null default now(),
    actualizado timestamptz not null default now()
  )`);

// Límite sencillo en memoria para que nadie llene la base creando códigos sin parar.
const altasPorIp = new Map();
function puedeCrear(ip) {
  const ahora = Date.now();
  const recientes = (altasPorIp.get(ip) ?? []).filter((t) => ahora - t < 3_600_000);
  if (recientes.length >= NUEVOS_POR_HORA_POR_IP) return false;
  recientes.push(ahora);
  altasPorIp.set(ip, recientes);
  return true;
}

function responder(res, estado, cuerpo) {
  res.writeHead(estado, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(cuerpo === undefined ? '' : JSON.stringify(cuerpo));
}

function leerCuerpo(req) {
  return new Promise((resolver, rechazar) => {
    let tam = 0;
    const partes = [];
    req.on('data', (p) => {
      tam += p.length;
      if (tam > LIMITE_CUERPO) {
        rechazar(Object.assign(new Error('Demasiado grande'), { estado: 413 }));
        req.destroy();
        return;
      }
      partes.push(p);
    });
    req.on('end', () => resolver(Buffer.concat(partes).toString('utf8')));
    req.on('error', rechazar);
  });
}

async function leerJson(req) {
  try {
    return JSON.parse(await leerCuerpo(req));
  } catch (e) {
    throw e.estado ? e : Object.assign(new Error('JSON inválido'), { estado: 400 });
  }
}

async function guardar(codigo, entrante, ip) {
  const cliente = await pool.connect();
  try {
    await cliente.query('begin');
    const { rows } = await cliente.query('select datos from progreso where codigo = $1 for update', [codigo]);
    let datos;
    if (rows.length) {
      datos = fusionar(rows[0].datos, entrante);
      await cliente.query('update progreso set datos = $2, actualizado = now() where codigo = $1', [codigo, datos]);
    } else {
      if (!puedeCrear(ip)) {
        await cliente.query('rollback');
        return { estado: 429, cuerpo: { error: 'Demasiados jugadores nuevos desde esta conexión. Intenta más tarde.' } };
      }
      datos = fusionar({}, entrante);
      await cliente.query('insert into progreso (codigo, datos) values ($1, $2)', [codigo, datos]);
    }
    await cliente.query('commit');
    return { estado: 200, cuerpo: { datos } };
  } catch (e) {
    await cliente.query('rollback').catch(() => {});
    throw e;
  } finally {
    cliente.release();
  }
}

const servidor = http.createServer(async (req, res) => {
  const origen = req.headers.origin;
  if (origen && ORIGENES.includes(origen)) {
    res.setHeader('Access-Control-Allow-Origin', origen);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
  if (req.method === 'OPTIONS') return responder(res, 204);

  const ruta = new URL(req.url, 'http://x').pathname;
  const ip = req.headers['x-real-ip'] || req.socket.remoteAddress;

  try {
    if (ruta === '/api/salud' && req.method === 'GET') {
      await pool.query('select 1');
      return responder(res, 200, { ok: true });
    }

    if (ruta === '/api/progreso') {
      if (req.method === 'POST') {
        const { codigo, datos } = await leerJson(req);
        if (!CODIGO.test(codigo ?? '') || !sonDatosValidos(datos)) return responder(res, 400, { error: 'Datos inválidos' });
        const r = await guardar(codigo, datos, ip);
        return responder(res, r.estado, r.cuerpo);
      }

      const codigo = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
      if (!CODIGO.test(codigo)) return responder(res, 401, { error: 'Falta el código de progreso' });

      if (req.method === 'GET') {
        const { rows } = await pool.query('select datos from progreso where codigo = $1', [codigo]);
        return rows.length ? responder(res, 200, { datos: rows[0].datos }) : responder(res, 404, { error: 'No existe' });
      }
      if (req.method === 'PUT') {
        const { datos } = await leerJson(req);
        if (!sonDatosValidos(datos)) return responder(res, 400, { error: 'Datos inválidos' });
        const r = await guardar(codigo, datos, ip);
        return responder(res, r.estado, r.cuerpo);
      }
      return responder(res, 405, { error: 'Método no permitido' });
    }

    return responder(res, 404, { error: 'No existe' });
  } catch (e) {
    if (e.estado) return responder(res, e.estado, { error: e.message });
    console.error(e);
    return responder(res, 500, { error: 'Error del servidor' });
  }
});

servidor.listen(PUERTO, '127.0.0.1', () => console.log(`API de tablas escuchando en 127.0.0.1:${PUERTO}`));
