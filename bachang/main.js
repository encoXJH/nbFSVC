import * as THREE from 'three';
import { createGunMode } from '../src/gun-mode.js';

const $ = (id) => document.getElementById(id);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d0f12);
scene.fog = new THREE.Fog(0x0d0f12, 95, 155);
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, .08, 250);
const controls = { enabled: false, target: new THREE.Vector3() };

scene.add(new THREE.HemisphereLight(0xdce8f2, 0x302d29, 2.1));
const sun = new THREE.DirectionalLight(0xffffff, 2.8);
sun.position.set(14, 26, 18);
sun.target.position.set(0, 0, -30);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 45, bottom: -45, near: 1, far: 110 });
scene.add(sun, sun.target);

let gameReady = false;
let gunMode = null;

function renderFrame() {
  renderer.render(scene, camera);
  gunMode?.renderViewModel();
}

function updateLoading(loaded, total) {
  const percent = Math.round(loaded / total * 100);
  $('loader-bar').style.width = `${percent}%`;
  $('loader-progress').textContent = `${percent}%`;
  $('loader-status').textContent = `加载枪械与投掷物音效 ${loaded}/${total}`;
}

try {
  gunMode = createGunMode({
    scene, camera, renderer, controls, renderFrame,
    rangeOnly: true,
    canInteract: () => gameReady,
    onLoadProgress: updateLoading,
  });
  window.gunMode = gunMode;
  window.sceneReady = () => gameReady;
  await gunMode.ready;
  $('loader-bar').style.width = '100%';
  $('loader-progress').textContent = '100%';
  $('loader-status').textContent = '靶场准备完成';
  gameReady = true;
  $('game-loader').classList.add('done');
} catch (error) {
  console.error(error);
  window.initError = String(error.stack || error);
  $('game-loader').classList.add('failed');
  $('loader-title').textContent = '资源加载失败';
  $('loader-status').textContent = error.message || String(error);
}

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
