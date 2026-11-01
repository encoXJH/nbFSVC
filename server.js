'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { WebSocketServer, WebSocket } = require('ws');
const {
  MAP_BOUNDS,
  SPAWNS,
  DUEL_WEAPONS,
  raycastMap,
  rayAabb,
} = require('./src/duel-layout.mjs');

const ROOT = __dirname;
const MAX_DISTANCE = 120;
const MAX_SPEED = 15;
const RESPAWN_DELAY = 3000;
const ROUTES = {
  '/': 'index.html',
  '/bachang': 'bachang/index.html',
  '/duel': 'duel/index.html',
};
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.bmp': 'image/bmp',
  '.avif': 'image/avif',
  '.wasm': 'application/wasm',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.pdf': 'application/pdf',
};

function finiteVector(value, length = 3) {
  return Array.isArray(value) && value.length === length && value.every(Number.isFinite);
}

function resolveShot(shooter, target, direction, weaponId) {
  const weapon = DUEL_WEAPONS[weaponId];
  if (!weapon || !finiteVector(direction)) return null;

  const length = Math.hypot(...direction);
  if (length < 1e-8) return null;
  const normalized = direction.map((value) => value / length);
  const origin = [...shooter.position];
  const mapDistance = raycastMap(origin, normalized, MAX_DISTANCE);
  const targetDistance = rayAabb(origin, normalized, {
    x: target.position[0],
    z: target.position[2],
    w: 0.7,
    d: 0.7,
    bottom: target.position[1] - 1.58,
    h: target.position[1] + 0.12,
  }, MAX_DISTANCE);
  const hit = targetDistance !== null && (mapDistance === null || targetDistance < mapDistance);
  const distance = hit ? targetDistance : (mapDistance ?? MAX_DISTANCE);
  const end = origin.map((value, axis) => value + normalized[axis] * distance);
  const headshot = hit && end[1] > target.position[1] - 0.28;
  const damage = hit ? weapon.damage * (headshot ? 2 : 1) : 0;

  return {
    origin,
    end,
    hit,
    headshot,
    killed: hit && target.hp <= damage,
    targetId: hit ? target.id : null,
    damage,
  };
}

function publicPlayer(player) {
  return {
    id: player.id,
    slot: player.slot,
    position: [...player.position],
    yaw: player.yaw,
    pitch: player.pitch,
    hp: player.hp,
    alive: player.alive,
    kills: player.kills,
    deaths: player.deaths,
    respawnAt: player.respawnAt,
  };
}

function send(ws, message) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
}

function broadcast(room, message) {
  const data = JSON.stringify(message);
  for (const player of room.players) {
    if (player.ws.readyState === WebSocket.OPEN) player.ws.send(data);
  }
}

function resetPlayer(player) {
  if (player.respawnTimer) {
    clearTimeout(player.respawnTimer);
    player.respawnTimer = null;
  }
  const spawn = SPAWNS[player.slot];
  player.position = [...spawn.position];
  player.yaw = spawn.yaw;
  player.pitch = 0;
  player.hp = 100;
  player.alive = true;
  player.respawnAt = 0;
  player.lastFireAt = 0;
  player.lastStateAt = Date.now();
}

function createStaticHandler() {
  return async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' });
      res.end('Method Not Allowed');
      return;
    }

    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch {
      res.writeHead(400);
      res.end('Bad Request');
      return;
    }

    const relativePath = ROUTES[pathname] || `.${pathname}`;
    const filePath = path.resolve(ROOT, relativePath);
    if (filePath !== ROOT && !filePath.startsWith(`${ROOT}${path.sep}`)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    try {
      const stat = await fs.promises.stat(filePath);
      if (!stat.isFile()) {
        res.writeHead(404);
        res.end('Not Found');
        return;
      }
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
        'Content-Length': stat.size,
        'X-Content-Type-Options': 'nosniff',
      });
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      const stream = fs.createReadStream(filePath);
      stream.on('error', () => res.destroy());
      stream.pipe(res);
    } catch {
      res.writeHead(404);
      res.end('Not Found');
    }
  };
}

function createServer() {
  const rooms = new Map();
  let nextPlayerId = 1;
  const server = http.createServer(createStaticHandler());
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024 });

  function startRound(room) {
    for (const player of room.players) resetPlayer(player);
    broadcast(room, { type: 'roundStart', players: room.players.map(publicPlayer) });
  }

  function respawn(room, player) {
    if (!room.players.includes(player)) return;
    resetPlayer(player);
  }

  function handleState(player, message) {
    if (!finiteVector(message.position) || !Number.isFinite(message.yaw) || !Number.isFinite(message.pitch)) return;
    const [x, y, z] = message.position;
    if (x < MAP_BOUNDS.minX || x > MAP_BOUNDS.maxX || z < MAP_BOUNDS.minZ || z > MAP_BOUNDS.maxZ) return;

    const now = Date.now();
    const elapsed = (now - player.lastStateAt) / 1000;
    const distance = Math.hypot(x - player.position[0], y - player.position[1], z - player.position[2]);
    if (elapsed < 0 || distance > MAX_SPEED * elapsed + 1e-6) return;

    player.position = [x, y, z];
    player.yaw = message.yaw;
    player.pitch = message.pitch;
    player.lastStateAt = now;
  }

  function handleFire(room, shooter, message) {
    if (room.players.length !== 2 || !room.players.every((player) => player.alive)) return;
    if (!Object.hasOwn(DUEL_WEAPONS, message.weaponId) || !finiteVector(message.direction)) return;

    const now = Date.now();
    const weapon = DUEL_WEAPONS[message.weaponId];
    if (now - shooter.lastFireAt < weapon.interval * 1000) return;
    const target = room.players.find((player) => player !== shooter);
    const result = resolveShot(shooter, target, message.direction, message.weaponId);
    if (!result) return;
    shooter.lastFireAt = now;

    if (result.hit) {
      target.hp = Math.max(0, target.hp - result.damage);
      if (result.killed) {
        target.alive = false;
        target.respawnAt = now + RESPAWN_DELAY;
        shooter.kills += 1;
        target.deaths += 1;
        target.respawnTimer = setTimeout(() => respawn(room, target), RESPAWN_DELAY);
      }
    }

    broadcast(room, {
      type: 'shot',
      shooterId: shooter.id,
      origin: result.origin,
      end: result.end,
      hit: result.hit,
      headshot: result.headshot,
      killed: result.killed,
      targetId: result.targetId,
    });
  }

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, 'http://localhost');
    const roomName = url.searchParams.get('room') || 'default';
    let room = rooms.get(roomName);
    if (!room) {
      room = { players: [] };
      rooms.set(roomName, room);
    }

    if (room.players.length >= 2) {
      send(ws, { type: 'roomFull' });
      ws.close(1008, 'roomFull');
      return;
    }

    const slot = [0, 1].find((value) => !room.players.some((player) => player.slot === value));
    const player = {
      ws,
      id: nextPlayerId++,
      slot,
      kills: 0,
      deaths: 0,
      respawnTimer: null,
    };
    resetPlayer(player);
    room.players.push(player);
    room.players.sort((a, b) => a.slot - b.slot);

    send(ws, {
      type: 'welcome',
      id: player.id,
      slot: player.slot,
      spawn: { position: [...SPAWNS[slot].position], yaw: SPAWNS[slot].yaw },
    });
    if (room.players.length === 2) startRound(room);

    ws.on('message', (data) => {
      let message;
      try {
        message = JSON.parse(data.toString());
      } catch {
        return;
      }
      if (!message || typeof message !== 'object') return;
      if (message.type === 'state') handleState(player, message);
      else if (message.type === 'fire') handleFire(room, player, message);
    });

    ws.on('close', () => {
      if (player.respawnTimer) clearTimeout(player.respawnTimer);
      const index = room.players.indexOf(player);
      if (index !== -1) room.players.splice(index, 1);
      if (room.players.length === 0) {
        rooms.delete(roomName);
      } else {
        broadcast(room, { type: 'playerLeft', id: player.id });
      }
    });
    ws.on('error', () => {});
  });

  const stateInterval = setInterval(() => {
    for (const room of rooms.values()) {
      broadcast(room, { type: 'state', players: room.players.map(publicPlayer) });
    }
  }, 50);
  stateInterval.unref();

  server.on('close', () => {
    clearInterval(stateInterval);
    for (const room of rooms.values()) {
      for (const player of room.players) {
        if (player.respawnTimer) clearTimeout(player.respawnTimer);
      }
    }
  });

  server.wss = wss;
  server.rooms = rooms;
  return server;
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 8000;
  createServer().listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
  });
}

module.exports = { resolveShot, createServer };
