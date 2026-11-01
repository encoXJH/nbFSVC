import * as THREE from 'three';
import { raycastMap } from './duel-layout.mjs';

export function createDuelNetwork({ scene, gunMode, room, onState, onEvent }) {
  const avatars = new Map();
  const tracers = [];
  const players = new Map();
  let ws = null;
  let localId = null;
  let localSlot = null;
  let lastSent = 0;
  let lastRespawnAt = 0;
  let connected = false;
  let readyResolve;
  let readyReject;
  let settled = false;
  const ready = new Promise((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
  const readyTimeout = setTimeout(() => {
    if (settled) return;
    settled = true;
    readyReject(new Error('连接对战服务器超时'));
  }, 10000);

  function makeAvatar(slot) {
    const group = new THREE.Group();
    const color = slot === 0 ? 0x3686c9 : 0xdf3038;
    const team = new THREE.MeshStandardMaterial({ color, roughness: .65 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x262b30, roughness: .78 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(.29, .35, 1.05, 12), team);
    body.position.y = .9;
    const head = new THREE.Mesh(new THREE.SphereGeometry(.22, 16, 12), dark);
    head.position.y = 1.58;
    const legs = new THREE.Mesh(new THREE.BoxGeometry(.42, .55, .25), dark);
    legs.position.y = .28;
    const gun = new THREE.Mesh(new THREE.BoxGeometry(.1, .1, .75), dark);
    gun.position.set(.28, 1.08, -.36);
    group.add(body, head, legs, gun);
    group.traverse((object) => { if (object.isMesh) object.castShadow = true; });
    scene.add(group);
    return { group, target: new THREE.Vector3(), targetYaw: 0, alive: true };
  }

  function applyPlayers(list, forceSpawn = false) {
    const seen = new Set();
    for (const state of list) {
      players.set(state.id, state);
      seen.add(state.id);
      if (state.id === localId) continue;
      if (!avatars.has(state.id)) avatars.set(state.id, makeAvatar(state.slot));
      const avatar = avatars.get(state.id);
      avatar.target.set(state.position[0], state.position[1] - 1.68, state.position[2]);
      avatar.targetYaw = state.yaw;
      avatar.alive = state.alive;
      avatar.group.visible = state.alive;
    }
    for (const [id, avatar] of avatars) {
      if (seen.has(id)) continue;
      scene.remove(avatar.group);
      avatars.delete(id);
      players.delete(id);
    }
    const local = players.get(localId);
    if (local && (forceSpawn || (local.alive && local.respawnAt !== lastRespawnAt))) {
      gunMode.teleport({ position: local.position, yaw: local.yaw });
    }
    lastRespawnAt = local?.respawnAt || 0;
    onState?.({ local, players: list, localId, localSlot });
  }

  function addTracer(message) {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(...message.origin),
      new THREE.Vector3(...message.end),
    ]);
    const material = new THREE.LineBasicMaterial({ color: message.shooterId === localId ? 0xf3c873 : 0xff8b6b, transparent: true, opacity: .8 });
    const line = new THREE.Line(geometry, material);
    line.userData.life = .09;
    scene.add(line);
    tracers.push(line);
    onEvent?.(message);
  }

  function connect() {
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${protocol}://${location.host}/ws?room=${encodeURIComponent(room)}`);
    ws.addEventListener('open', () => { connected = true; });
    ws.addEventListener('close', () => {
      connected = false;
      onEvent?.({ type: 'disconnect' });
    });
    ws.addEventListener('error', () => {
      if (settled) return;
      settled = true;
      clearTimeout(readyTimeout);
      readyReject(new Error('无法连接对战服务器'));
    });
    ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'welcome') {
        localId = message.id;
        localSlot = message.slot;
        gunMode.teleport(message.spawn);
        if (!settled) {
          settled = true;
          clearTimeout(readyTimeout);
          readyResolve(message);
        }
        onEvent?.({ type: 'welcome', ...message });
      } else if (message.type === 'roundStart') {
        applyPlayers(message.players, true);
      } else if (message.type === 'state') {
        applyPlayers(message.players);
      } else if (message.type === 'shot') {
        addTracer(message);
      } else if (message.type === 'roomFull') {
        if (!settled) {
          settled = true;
          clearTimeout(readyTimeout);
          readyReject(new Error('该房间已有两名玩家'));
        }
      }
    });
  }

  connect();

  return {
    ready,
    shoot: ({ origin, direction, weaponId }) => {
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'fire', direction, weaponId }));
      const distance = raycastMap(origin, direction);
      if (distance === null) return null;
      return { point: origin.map((value, axis) => value + direction[axis] * distance) };
    },
    sendState: (now) => {
      if (!connected || !localId || ws?.readyState !== WebSocket.OPEN || now - lastSent < 50) return;
      lastSent = now;
      const state = gunMode.getState();
      ws.send(JSON.stringify({ type: 'state', position: state.position, yaw: state.yaw, pitch: state.pitch }));
    },
    update: (dt) => {
      for (const avatar of avatars.values()) {
        avatar.group.position.lerp(avatar.target, 1 - Math.exp(-12 * dt));
        avatar.group.rotation.y = THREE.MathUtils.damp(avatar.group.rotation.y, avatar.targetYaw, 12, dt);
      }
      for (let i = tracers.length - 1; i >= 0; i--) {
        const line = tracers[i];
        line.userData.life -= dt;
        if (line.userData.life > 0) continue;
        scene.remove(line);
        line.geometry.dispose();
        line.material.dispose();
        tracers.splice(i, 1);
      }
    },
    getState: () => ({ connected, localId, localSlot, players: [...players.values()], remoteCount: avatars.size }),
  };
}
