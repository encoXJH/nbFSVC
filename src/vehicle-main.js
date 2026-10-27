import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VEHICLES, VEHICLE_BY_ID } from './vehicle-catalog.js';
import { buildGenericVehicle, loadDetailedVehicles } from './vehicle-models.js';
import { handlingFor, resetDynamics, updateDynamics } from './vehicle-dynamics.js';
const $ = (id) => document.getElementById(id);
const host = $('renderer-host');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xaeb8bf);
scene.fog = new THREE.Fog(0xaeb8bf, 150, 390);

const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, .1, 900);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
host.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = .08;
controls.minDistance = 3;
controls.maxDistance = 190;
controls.maxPolarAngle = Math.PI / 2 - .025;

scene.add(new THREE.HemisphereLight(0xe7f1f7, 0x4c4b45, 2.1));
const sun = new THREE.DirectionalLight(0xfff4df, 3.2);
sun.position.set(-55, 90, 35);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -110;
sun.shadow.camera.right = 110;
sun.shadow.camera.top = 110;
sun.shadow.camera.bottom = -110;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 260;
sun.shadow.bias = -.0003;
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(360, 360),
  new THREE.MeshStandardMaterial({ color: 0x747b7e, roughness: .96, metalness: 0 }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const grid = new THREE.GridHelper(360, 72, 0x3f464a, 0x596166);
grid.position.y = .012;
scene.add(grid);

const lane = new THREE.Mesh(
  new THREE.PlaneGeometry(24, 250),
  new THREE.MeshStandardMaterial({ color: 0x34393c, roughness: .92 }),
);
lane.rotation.x = -Math.PI / 2;
lane.position.set(30, .018, 0);
lane.receiveShadow = true;
scene.add(lane);

function roadLine(width, depth, x, z, color = 0xe9e5d8) {
  const line = new THREE.Mesh(new THREE.BoxGeometry(width, .025, depth), new THREE.MeshStandardMaterial({ color, roughness: .8 }));
  line.position.set(x, .035, z);
  line.receiveShadow = true;
  scene.add(line);
}
roadLine(.16, 250, 18, 0);
roadLine(.16, 250, 42, 0);
for (let z = -120; z <= 120; z += 10) roadLine(.16, 4.5, 30, z, 0xe5b84c);

const coneMaterial = new THREE.MeshStandardMaterial({ color: 0xe05a24, roughness: .7 });
for (let i = 0; i < 12; i++) {
  const cone = new THREE.Mesh(new THREE.ConeGeometry(.32, .85, 14), coneMaterial);
  cone.position.set(30 + (i % 2 ? 4.5 : -4.5), .43, -48 + i * 8.5);
  cone.castShadow = true;
  scene.add(cone);
}

const galleryPositions = new Map();
const galleryModels = new Map();
const buttons = new Map();
const padGeometry = new THREE.PlaneGeometry(9.5, 11.5);
const padMaterial = new THREE.MeshStandardMaterial({ color: 0x24292c, roughness: .9 });

function makeLabel(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const context = canvas.getContext('2d');
  context.fillStyle = 'rgba(12,14,16,.88)';
  context.fillRect(0, 0, 512, 96);
  context.fillStyle = '#f2f0e9';
  context.font = '600 30px Microsoft JhengHei, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, 256, 48, 478);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthWrite: false }));
  sprite.scale.set(6.2, 1.16, 1);
  return sprite;
}

VEHICLES.forEach((entry, index) => {
  const column = index % 4;
  const row = Math.floor(index / 4);
  const position = new THREE.Vector3(-72 + column * 11, .035, -58 + row * 13);
  galleryPositions.set(entry.id, position);
  const pad = new THREE.Mesh(padGeometry, padMaterial);
  pad.rotation.x = -Math.PI / 2;
  pad.position.copy(position);
  pad.receiveShadow = true;
  scene.add(pad);
  const label = makeLabel(entry.name.zh);
  label.position.set(position.x, Math.max(2.8, entry.spec.h + 1.25), position.z + 4.5);
  scene.add(label);
});

function addGalleryModel(entry, model) {
  model.position.copy(galleryPositions.get(entry.id));
  model.rotation.y = 0;
  scene.add(model);
  galleryModels.set(entry.id, model);
  const button = buttons.get(entry.id);
  if (button) {
    button.classList.remove('pending');
    button.disabled = false;
  }
}

for (const entry of VEHICLES.filter((item) => item.model === 'generic')) {
  addGalleryModel(entry, buildGenericVehicle(entry));
}

const active = {
  entry: null, object: null, speed: 0, heading: 0, steer: 0, ownsModel: false,
  vx: 0, vz: 0, yawRate: 0, gripK: 0, drifting: false, powerT: 0, slip: 0,
  wheelAngle: 0, handling: null,
};

const lastTarget = new THREE.Vector3();
const keys = new Set();

function disposeActive() {
  if (!active.object) return;
  scene.remove(active.object);
  if (active.ownsModel) {
    const geometries = new Set();
    const materials = new Set();
    active.object.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.material) {
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
      }
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
  }
  active.object = null;
}

function resetCamera() {
  if (!active.object) return;
  const position = active.object.position;
  const forward = new THREE.Vector3(Math.sin(active.heading), 0, -Math.cos(active.heading));
  const distance = Math.max(8, active.entry.spec.l * 1.65);
  camera.position.copy(position).addScaledVector(forward, -distance);
  camera.position.y += Math.max(4.5, active.entry.spec.h + 3.2);
  lastTarget.copy(position);
  lastTarget.y += Math.max(.8, active.entry.spec.h * .55);
  controls.target.copy(lastTarget);
  controls.update();
}

function resetActive(resetCameraToo = true) {
  if (!active.object) return;
  resetDynamics(active, 30, 54, 0);
  if (resetCameraToo) resetCamera();
}

function groupName(group) {
  return { base: '基础车型', detail: '高精度模型', custom: '改装车款', player: '玩家配置' }[group] || group;
}

function updateVehiclePanel(entry) {
  $('vehicle-name').textContent = entry.name.zh;
  $('vehicle-id').textContent = entry.id;
  const spec = entry.spec;
  const rows = [
    ['类型', groupName(entry.group)],
    ['极速', `${spec.maxKmh} km/h`],
    ['加速度', `${spec.accel.toFixed(1)} m/s²`],
    ['制动', `${spec.brake.toFixed(1)} m/s²`],
    ['尺寸', `${spec.l.toFixed(2)} × ${spec.w.toFixed(2)} m`],
    ['质量', `${spec.mass} kg`],
  ];
  $('vehicle-specs').replaceChildren();
  for (const [label, value] of rows) {
    const dt = document.createElement('span');
    dt.textContent = label;
    const dd = document.createElement('b');
    dd.textContent = value;
    $('vehicle-specs').append(dt, dd);
  }
}

function selectVehicle(id) {
  const entry = VEHICLE_BY_ID[id];
  const gallery = galleryModels.get(id);
  if (!entry || !gallery) return;
  disposeActive();
  active.entry = entry;
  active.handling = handlingFor(entry);
  active.object = entry.model === 'detail' ? gallery.clone(true) : buildGenericVehicle(entry);
  active.ownsModel = entry.model !== 'detail';
  scene.add(active.object);
  resetActive();
  for (const [vehicleId, button] of buttons) button.classList.toggle('selected', vehicleId === id);
  updateVehiclePanel(entry);
  if (innerWidth < 620) $('fleet-panel').classList.add('closed');
}

function createFleetButtons() {
  const list = $('fleet-list');
  for (const entry of VEHICLES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `vehicle-item${entry.model === 'detail' ? ' pending' : ''}`;
    button.disabled = entry.model === 'detail';
    button.dataset.id = entry.id;
    button.dataset.group = entry.group;
    button.dataset.search = `${entry.id} ${entry.kind} ${entry.name.zh} ${entry.name.en}`.toLowerCase();
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = entry.name.zh;
    const kind = document.createElement('span');
    kind.className = 'kind';
    kind.textContent = entry.kind;
    const id = document.createElement('span');
    id.className = 'id';
    id.textContent = entry.id;
    button.append(name, kind, id);
    button.addEventListener('click', () => selectVehicle(entry.id));
    list.appendChild(button);
    buttons.set(entry.id, button);
  }
  $('fleet-count').textContent = String(VEHICLES.length);
}

let activeFilter = 'all';
function filterFleet() {
  const query = $('fleet-search').value.trim().toLowerCase();
  let visible = 0;
  for (const entry of VEHICLES) {
    const button = buttons.get(entry.id);
    const show = (activeFilter === 'all' || entry.group === activeFilter) && (!query || button.dataset.search.includes(query));
    button.hidden = !show;
    if (show) visible++;
  }
  $('visible-count').textContent = `${visible} / ${VEHICLES.length}`;
}

createFleetButtons();
filterFleet();
$('fleet-search').addEventListener('input', filterFleet);
$('fleet-filters').addEventListener('click', (event) => {
  const button = event.target.closest('[data-filter]');
  if (!button) return;
  activeFilter = button.dataset.filter;
  for (const item of $('fleet-filters').querySelectorAll('[data-filter]')) item.classList.toggle('active', item === button);
  filterFleet();
});
$('fleet-toggle').addEventListener('click', () => $('fleet-panel').classList.toggle('closed'));
$('reset-button').addEventListener('click', () => resetActive());
$('camera-button').addEventListener('click', resetCamera);

const drivingKeys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyR']);
window.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
  if (drivingKeys.has(event.code)) event.preventDefault();
  keys.add(event.code);
  if (event.code === 'KeyR' && !event.repeat) resetActive();
});
window.addEventListener('keyup', (event) => keys.delete(event.code));
window.addEventListener('blur', () => keys.clear());

function pressed(...codes) {
  return codes.some((code) => keys.has(code));
}

function updateDrive(dt) {
  if (!active.object) return;
  const spec = active.entry.spec;
  const input = {
    throttle: pressed('KeyW', 'ArrowUp'),
    brake: pressed('KeyS', 'ArrowDown'),
    handbrake: pressed('Space'),
  };
  input.steer = Number(pressed('KeyD', 'ArrowRight')) - Number(pressed('KeyA', 'ArrowLeft'));
  updateDynamics(active, input, dt);

  const oldX = active.object.position.x;
  const oldZ = active.object.position.z;
  active.object.position.x = THREE.MathUtils.clamp(oldX, -172, 172);
  active.object.position.z = THREE.MathUtils.clamp(oldZ, -172, 172);
  if (oldX !== active.object.position.x || oldZ !== active.object.position.z) {
    active.speed = 0;
    active.vx = 0;
    active.vz = 0;
    active.drifting = false;
  }
  active.object.rotation.y = -active.heading;
  const lean = spec.twoWheeler ? -active.steer * Math.min(1, Math.abs(active.speed) / 16) * .22 : 0;
  active.object.rotation.z = THREE.MathUtils.damp(active.object.rotation.z, lean, 7, dt);

  for (const wheel of active.object.userData.wheels || []) {
    const wheelSpeed = input.handbrake && !wheel.steering ? 0 : active.speed;
    wheel.tire.rotation.x -= wheelSpeed / wheel.radius * dt;
    wheel.hub.rotation.x -= wheelSpeed / wheel.radius * dt;
    if (wheel.steering) wheel.pivot.rotation.y = -active.wheelAngle;
  }
  $('speed-value').textContent = String(Math.round(Math.abs(active.speed) * 3.6));
  const driftDegrees = Math.round(Math.abs(active.slip) * 180 / Math.PI);
  $('drive-state').textContent = active.drifting ? `漂移 ${driftDegrees}°`
    : input.handbrake ? '手刹制动' : active.speed > .15 ? '前進' : active.speed < -.15 ? '倒車' : '待命';

  const target = active.object.position.clone();
  target.y += Math.max(.8, spec.h * .55);
  const delta = target.clone().sub(lastTarget);
  camera.position.add(delta);
  controls.target.copy(target);
  lastTarget.copy(target);
}

function showError(error) {
  console.error(error);
  $('error-box').textContent = error.message || String(error);
  $('error-box').style.display = 'block';
}

async function init() {
  $('loading-bar').style.width = '12%';
  $('loading-text').textContent = '基础车辆已就位，正在提取 19 个高精度模型';
  const detailEntries = VEHICLES.filter((entry) => entry.model === 'detail');
  try {
    const detailed = await loadDetailedVehicles(detailEntries, (done, total, id) => {
      $('loading-text').textContent = `高精度模型 ${done} / ${total} · ${id}`;
      $('loading-bar').style.width = `${12 + done / total * 86}%`;
    });
    for (const entry of detailEntries) {
      const model = detailed.get(entry.id);
      if (model) addGalleryModel(entry, model);
    }
  } catch (error) {
    showError(error);
  }
  $('loading-bar').style.width = '100%';
  selectVehicle(galleryModels.has('altis') ? 'altis' : 'sedan');
  $('loading').classList.add('done');
  renderer.setAnimationLoop(animate);
}

const clock = new THREE.Clock();
function animate() {
  const dt = Math.min(clock.getDelta(), .05);
  updateDrive(dt);
  controls.update();
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

init().catch((error) => {
  showError(error);
  $('loading-text').textContent = '测试场初始化失败';
});
