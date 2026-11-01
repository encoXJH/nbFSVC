import * as THREE from 'three';
import { createGunMode } from '../src/gun-mode.js';
import { buildDuelMap } from '../src/duel-map.js';
import { createDuelNetwork } from '../src/duel-network.js';
import { getLadder, groundHeight, isBlocked, SPAWNS } from '../src/duel-layout.mjs';

const $ = (id) => document.getElementById(id);
const room = new URLSearchParams(location.search).get('room') || 'public';
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x11151a);
scene.fog = new THREE.Fog(0x11151a, 55, 105);
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, .08, 180);
const controls = { enabled: false, target: new THREE.Vector3() };
scene.add(new THREE.HemisphereLight(0xdce8f2, 0x292622, 2.2));
const sun = new THREE.DirectionalLight(0xffffff, 3);
sun.position.set(-12, 28, 14);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -28, right: 28, top: 28, bottom: -28, near: 1, far: 90 });
scene.add(sun);
buildDuelMap(scene);

let gameReady = false;
let localAlive = true;
let online = false;
let gunMode = null;
let network = null;
let previousTime = performance.now();
let hitTimer = null;

function renderFrame() {
  const now = performance.now();
  const dt = Math.min((now - previousTime) / 1000, .05);
  previousTime = now;
  network?.sendState(now);
  network?.update(dt);
  renderer.render(scene, camera);
  gunMode?.renderViewModel();
}

function updateMatch({ local, players }) {
  if (!local) return;
  $('player-hp').firstChild.nodeValue = String(Math.max(0, Math.ceil(local.hp)));
  $('duel-score').firstChild.nodeValue = `${local.kills} : ${local.deaths}`;
  if (localAlive && !local.alive) gunMode.clearInput();
  localAlive = local.alive;
  if (players.length < 2) $('duel-message').textContent = '等待对手加入 · 分享当前房间链接';
  else if (!local.alive) $('duel-message').textContent = `已阵亡 · ${Math.max(0, Math.ceil((local.respawnAt - Date.now()) / 1000))} 秒后重生`;
  else $('duel-message').textContent = '';
}

function handleEvent(message) {
  if (message.type === 'welcome') {
    online = true;
    $('room-label').textContent = `房间 ${room} · ${message.slot === 0 ? '蓝方' : '红方'}`;
  } else if (message.type === 'disconnect') {
    online = false;
    gunMode.clearInput();
    $('duel-message').textContent = '与对战服务器断开连接';
  } else if (message.type === 'shot') {
    const localId = network?.getState().localId;
    if (message.shooterId === localId && message.hit) {
      const marker = $('hit-marker');
      marker.hidden = false;
      marker.classList.toggle('kill', message.killed);
      clearTimeout(hitTimer);
      hitTimer = setTimeout(() => { marker.hidden = true; }, 140);
    }
    if (message.targetId === localId && message.hit) {
      $('damage-flash').style.opacity = '1';
      setTimeout(() => { $('damage-flash').style.opacity = '0'; }, 90);
    }
  }
}

async function start() {
  try {
    gunMode = createGunMode({
      scene, camera, renderer, controls, renderFrame,
      world: {
        spawn: SPAWNS[0],
        isBlocked,
        groundHeight,
        getLadder,
      },
      canInteract: () => gameReady && localAlive && online,
      onFire: (payload) => network?.shoot(payload) || null,
      onLoadProgress: (loaded, total) => {
        const percent = Math.round(loaded / total * 80);
        $('loader-bar').style.width = `${percent}%`;
        $('loader-progress').textContent = `${percent}%`;
        $('loader-status').textContent = `加载枪械音效 ${loaded}/${total}`;
      },
    });
    window.gunMode = gunMode;
    await gunMode.ready;
    $('loader-bar').style.width = '90%';
    $('loader-progress').textContent = '90%';
    $('loader-status').textContent = '连接对战服务器';
    network = createDuelNetwork({ scene, gunMode, room, onState: updateMatch, onEvent: handleEvent });
    window.duelNetwork = network;
    await network.ready;
    $('loader-bar').style.width = '100%';
    $('loader-progress').textContent = '100%';
    $('loader-status').textContent = '战场准备完成';
    gameReady = true;
    window.sceneReady = () => gameReady;
    $('game-loader').classList.add('done');
  } catch (error) {
    console.error(error);
    window.initError = String(error.stack || error);
    $('game-loader').classList.add('failed');
    $('loader-title').textContent = '无法进入对决';
    $('loader-status').textContent = error.message || String(error);
  }
}

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
start();
