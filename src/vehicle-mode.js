import * as THREE from 'three';
import { VEHICLES, VEHICLE_BY_ID } from './vehicle-catalog.js';
import { buildGenericVehicle, loadDetailedVehicles } from './vehicle-models.js';
import { handlingFor, resetDynamics, updateDynamics } from './vehicle-dynamics.js';
import { BUILDINGS, SAT, SITE, MPP, U0, ux, uz } from './layout.js';
import { coastX } from './world.js';

const $ = (id) => document.getElementById(id);
const SPAWN = { x: ux(1000), z: uz(500), heading: 0 };
const PARTS = BUILDINGS.flatMap((building) => building.parts);

function roundedRectContains(x, y, rect) {
  const cx = (rect.x0 + rect.x1) / 2;
  const cy = (rect.y0 + rect.y1) / 2;
  const qx = Math.abs(x - cx) - ((rect.x1 - rect.x0) / 2 - rect.r);
  const qy = Math.abs(y - cy) - ((rect.y1 - rect.y0) / 2 - rect.r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rect.r <= 0;
}

function blockedByWater(x, z) {
  const sx = x / MPP + U0.x;
  const sy = z / MPP + U0.y;
  if (SITE.moatRing.bridges.some(([x0, y0, x1, y1]) => sx >= x0 && sx <= x1 && sy >= y0 && sy <= y1)) return false;
  return roundedRectContains(sx, sy, SITE.moatRing.outer) && !roundedRectContains(sx, sy, SITE.moatRing.inner);
}

function isBlocked(x, z, spec) {
  const margin = Math.max(.65, spec.w * .45);
  if (x < SAT.x0 + margin || x > SAT.x1 - margin || z < SAT.z0 + margin || z > SAT.z1 - margin) return true;
  if (x > coastX(z) - 30 || blockedByWater(x, z)) return true;
  for (const part of PARTS) {
    const angle = part.rot * Math.PI / 180;
    const dx = x - part.cx;
    const dz = z - part.cz;
    const lx = Math.cos(angle) * dx + Math.sin(angle) * dz;
    const lz = -Math.sin(angle) * dx + Math.cos(angle) * dz;
    if (Math.abs(lx) < part.w / 2 + margin && Math.abs(lz) < part.d / 2 + margin) return true;
  }
  return false;
}

function disposeObject(object) {
  const geometries = new Set();
  const materials = new Set();
  object.traverse((child) => {
    if (child.geometry) geometries.add(child.geometry);
    if (child.material) {
      for (const material of Array.isArray(child.material) ? child.material : [child.material]) materials.add(material);
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

export function createVehicleMode({ scene, camera, renderer, controls, renderFrame }) {
  const active = {
    entry: null, object: null, ownsModel: false, handling: null,
    speed: 0, heading: 0, steer: 0, vx: 0, vz: 0, yawRate: 0,
    gripK: 0, drifting: false, powerT: 0, slip: 0, wheelAngle: 0,
  };
  const keys = new Set();
  const detailCache = new Map();
  const detailPending = new Map();
  const options = new Map();
  let driving = false;
  let menuOpen = false;
  let loading = false;
  let selectedId = 'altis';
  let savedView = null;
  let previousTime = performance.now();
  let vehicleToken = 0;
  let pointerLocked = false;
  let viewYaw = 0;
  let viewPitch = .42;
  const cameraForward = new THREE.Vector3(0, 0, -1);
  const cameraTarget = new THREE.Vector3();

  function syncUI() {
    $('drive-hint').hidden = driving || menuOpen;
    $('drive-hud').hidden = !driving;
    $('drive-menu').hidden = !menuOpen;
    $('drive-loading').hidden = !loading;
    $('drive-vehicle').textContent = VEHICLE_BY_ID[selectedId].name.zh;
    $('drive-mode-help').textContent = pointerLocked
      ? 'V 退出驾驶　U 换车　鼠标转视角 / ESC 解锁'
      : '点击画面锁定鼠标转视角　U 换车';
    for (const [id, button] of options) button.classList.toggle('selected', id === selectedId);
  }

  function lockPointer() {
    if (!driving || menuOpen || document.pointerLockElement === renderer.domElement) return;
    try {
      const request = renderer.domElement.requestPointerLock();
      if (request?.catch) request.catch(() => {});
    } catch (_) {}
  }

  function unlockPointer() {
    if (document.pointerLockElement === renderer.domElement) document.exitPointerLock();
  }

  document.addEventListener('pointerlockchange', () => {
    pointerLocked = document.pointerLockElement === renderer.domElement;
    syncUI();
  });
  renderer.domElement.addEventListener('click', () => {
    if (driving && !menuOpen) lockPointer();
  });
  document.addEventListener('mousemove', (event) => {
    if (!pointerLocked || !driving || menuOpen) return;
    viewYaw += event.movementX * .0022;
    viewPitch = THREE.MathUtils.clamp(viewPitch + event.movementY * .002, .12, 1.12);
  });

  function filterOptions() {
    const query = $('drive-search').value.trim().toLowerCase();
    for (const [id, button] of options) button.hidden = !!query && !button.dataset.search.includes(query);
  }

  function closeMenu() {
    menuOpen = false;
    keys.clear();
    if (document.activeElement === $('drive-search')) $('drive-search').blur();
    syncUI();
    if (driving) lockPointer();
  }

  function openMenu() {
    keys.clear();
    menuOpen = true;
    unlockPointer();
    $('drive-search').value = '';
    filterOptions();
    syncUI();
    $('drive-search').focus({ preventScroll: true });
  }

  function destroyActive() {
    if (!active.object) return;
    scene.remove(active.object);
    if (active.ownsModel) disposeObject(active.object);
    active.object = null;
    active.entry = null;
    active.ownsModel = false;
  }

  async function instantiate(entry) {
    if (entry.model === 'generic') return { object: buildGenericVehicle(entry), owns: true };
    if (!detailCache.has(entry.id)) {
      if (!detailPending.has(entry.id)) {
        const promise = loadDetailedVehicles([entry]).then((models) => {
          const model = models.get(entry.id);
          if (!model) throw new Error(`${entry.id} 模型加载失败`);
          detailCache.set(entry.id, model);
          detailPending.delete(entry.id);
          return model;
        }).catch((error) => {
          detailPending.delete(entry.id);
          throw error;
        });
        detailPending.set(entry.id, promise);
      }
      await detailPending.get(entry.id);
    }
    return { object: detailCache.get(entry.id).clone(true), owns: false };
  }

  function resetCamera(resetAngles = false) {
    if (!active.object) return;
    if (resetAngles) {
      viewYaw = 0;
      viewPitch = .42;
    }
    cameraForward.set(Math.sin(active.heading), 0, -Math.cos(active.heading));
    cameraTarget.copy(active.object.position);
    cameraTarget.y += Math.max(1, active.entry.spec.h * .65);
    updateCamera(1, true);
  }

  async function setVehicle(id) {
    const entry = VEHICLE_BY_ID[id];
    if (!entry) return false;
    const token = ++vehicleToken;
    const motion = driving && active.object ? {
      position: active.object.position.clone(),
      heading: active.heading,
      speed: active.speed,
      vx: active.vx,
      vz: active.vz,
    } : null;
    selectedId = id;
    loading = true;
    $('drive-loading').textContent = `正在加载 ${entry.name.zh}`;
    syncUI();
    try {
      const next = await instantiate(entry);
      if (token !== vehicleToken) {
        if (next.owns) disposeObject(next.object);
        return false;
      }
      destroyActive();
      active.entry = entry;
      active.object = next.object;
      active.ownsModel = next.owns;
      active.handling = handlingFor(entry);
      if (motion) {
        active.object.position.copy(motion.position);
        active.heading = motion.heading;
        active.speed = motion.speed;
        active.vx = motion.vx;
        active.vz = motion.vz;
        active.yawRate = 0;
        active.steer = 0;
        active.gripK = entry.spec.grip;
        active.drifting = false;
        active.powerT = 0;
        active.slip = 0;
        active.wheelAngle = 0;
        active.object.rotation.set(0, -active.heading, 0);
      } else {
        resetDynamics(active, SPAWN.x, SPAWN.z, SPAWN.heading);
      }
      active.object.visible = driving;
      scene.add(active.object);
      return true;
    } catch (error) {
      console.error(error);
      $('drive-loading').textContent = error.message || String(error);
      return false;
    } finally {
      if (token === vehicleToken) {
        loading = false;
        syncUI();
      }
    }
  }

  function updateCamera(dt, snap = false) {
    if (!active.object) return;
    const forward = new THREE.Vector3(Math.sin(active.heading), 0, -Math.cos(active.heading));
    const target = active.object.position.clone();
    target.y += Math.max(1, active.entry.spec.h * .65);
    cameraForward.lerp(forward, snap ? 1 : 1 - Math.exp(-4.2 * dt)).normalize();
    cameraTarget.lerp(target, snap ? 1 : 1 - Math.exp(-6 * dt));
    const baseHeading = Math.atan2(cameraForward.x, -cameraForward.z);
    const yaw = baseHeading + viewYaw;
    const distance = Math.max(8, active.entry.spec.l * 1.7) + Math.min(4, Math.abs(active.speed) * .08);
    const horizontal = Math.cos(viewPitch) * distance;
    const desired = cameraTarget.clone().add(new THREE.Vector3(
      -Math.sin(yaw) * horizontal,
      Math.sin(viewPitch) * distance,
      Math.cos(yaw) * horizontal,
    ));
    camera.position.lerp(desired, snap ? 1 : 1 - Math.exp(-6 * dt));
    camera.lookAt(cameraTarget.clone().addScaledVector(cameraForward, 2.5));
  }

  function constrainVehicle(previous) {
    const position = active.object.position;
    if (!isBlocked(position.x, position.z, active.entry.spec)) return;
    if (!isBlocked(position.x, previous.z, active.entry.spec)) {
      position.z = previous.z;
      active.vz = 0;
    } else if (!isBlocked(previous.x, position.z, active.entry.spec)) {
      position.x = previous.x;
      active.vx = 0;
    } else {
      position.x = previous.x;
      position.z = previous.z;
      active.vx = 0;
      active.vz = 0;
    }
    active.speed *= .25;
    active.yawRate *= .3;
    active.drifting = false;
  }

  function updateHUD() {
    $('drive-speed').firstChild.nodeValue = String(Math.round(Math.abs(active.speed) * 3.6));
    const degrees = Math.round(Math.abs(active.slip) * 180 / Math.PI);
    $('drive-state').textContent = active.drifting ? `漂移 ${degrees}°`
      : keys.has('Space') ? '手刹制动' : active.speed > .15 ? '前進' : active.speed < -.15 ? '倒車' : '待命';
  }

  function frame(now) {
    if (!driving) return;
    const dt = Math.min((now - previousTime) / 1000, .05);
    previousTime = now;
    if (active.object && !menuOpen && !loading) {
      const previous = { x: active.object.position.x, z: active.object.position.z };
      const input = {
        throttle: keys.has('KeyW') || keys.has('ArrowUp'),
        brake: keys.has('KeyS') || keys.has('ArrowDown'),
        handbrake: keys.has('Space'),
        steer: Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft')),
      };
      updateDynamics(active, input, dt);
      constrainVehicle(previous);
      active.object.rotation.y = -active.heading;
      const lean = active.entry.spec.twoWheeler ? -active.steer * Math.min(1, Math.abs(active.speed) / 16) * .22 : 0;
      active.object.rotation.z = THREE.MathUtils.damp(active.object.rotation.z, lean, 7, dt);
      for (const wheel of active.object.userData.wheels || []) {
        const wheelSpeed = input.handbrake && !wheel.steering ? 0 : active.speed;
        wheel.tire.rotation.x -= wheelSpeed / wheel.radius * dt;
        wheel.hub.rotation.x -= wheelSpeed / wheel.radius * dt;
        if (wheel.steering) wheel.pivot.rotation.y = -active.wheelAngle;
      }
      updateHUD();
      updateCamera(dt);
    }
    renderFrame();
  }

  async function enterDrive() {
    if (driving) return;
    closeMenu();
    savedView = {
      position: camera.position.clone(),
      up: camera.up.clone(),
      target: controls.target.clone(),
      fov: camera.fov,
      near: camera.near,
    };
    driving = true;
    window.camOverride = null;
    controls.enabled = false;
    camera.up.set(0, 1, 0);
    camera.near = .25;
    camera.fov = 55;
    camera.updateProjectionMatrix();
    keys.clear();
    syncUI();
    lockPointer();
    if (!active.object || active.entry?.id !== selectedId) await setVehicle(selectedId);
    if (!driving) return;
    active.object.visible = true;
    resetCamera(true);
    updateHUD();
    previousTime = performance.now();
    renderer.setAnimationLoop(frame);
  }

  function exitDrive() {
    if (!driving) return;
    driving = false;
    vehicleToken++;
    loading = false;
    keys.clear();
    renderer.setAnimationLoop(null);
    unlockPointer();
    closeMenu();
    destroyActive();
    if (savedView) {
      camera.position.copy(savedView.position);
      camera.up.copy(savedView.up);
      camera.near = savedView.near;
      camera.fov = savedView.fov;
      camera.updateProjectionMatrix();
      controls.target.copy(savedView.target);
      window.camOverride = {
        pos: savedView.position.toArray(),
        tgt: savedView.target.toArray(),
        up: savedView.up.toArray(),
        fov: savedView.fov,
      };
    }
    controls.enabled = true;
    controls.update();
    renderFrame();
    syncUI();
  }

  const optionList = $('drive-list');
  for (const entry of VEHICLES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'drive-option';
    button.dataset.id = entry.id;
    button.dataset.search = `${entry.id} ${entry.kind} ${entry.name.zh} ${entry.name.en}`.toLowerCase();
    const name = document.createElement('strong');
    name.textContent = entry.name.zh;
    const kind = document.createElement('span');
    kind.className = 'drive-kind';
    kind.textContent = entry.kind;
    const id = document.createElement('span');
    id.className = 'drive-id';
    id.textContent = entry.id;
    button.append(name, kind, id);
    button.addEventListener('click', async () => {
      const resumeDriving = driving;
      closeMenu();
      const changed = await setVehicle(entry.id);
      if (changed && !resumeDriving) enterDrive();
    });
    optionList.appendChild(button);
    options.set(entry.id, button);
  }

  $('drive-search').addEventListener('input', filterOptions);
  $('drive-menu-close').addEventListener('click', closeMenu);
  $('drive-menu').addEventListener('click', (event) => {
    if (event.target === $('drive-menu')) closeMenu();
  });

  const drivingKeys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyR']);
  window.addEventListener('keydown', (event) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      if (event.code === 'Escape' || (event.code === 'KeyU' && !event.repeat)) {
        event.preventDefault();
        closeMenu();
      }
      return;
    }
    if (event.code === 'KeyV' && !event.repeat) {
      event.preventDefault();
      if (driving) exitDrive();
      else enterDrive();
      return;
    }
    if (event.code === 'KeyU' && !event.repeat) {
      event.preventDefault();
      if (menuOpen) closeMenu();
      else openMenu();
      return;
    }
    if (event.code === 'Escape' && menuOpen) {
      closeMenu();
      return;
    }
    if (event.code === 'Escape' && driving) {
      unlockPointer();
      return;
    }
    if (!driving || menuOpen || loading) return;
    if (drivingKeys.has(event.code)) event.preventDefault();
    keys.add(event.code);
    if (event.code === 'KeyR' && !event.repeat && active.object) {
      resetDynamics(active, SPAWN.x, SPAWN.z, SPAWN.heading);
      resetCamera(true);
    }
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => keys.clear());
  syncUI();

  return {
    isDriving: () => driving,
    getState: () => ({
      driving, menuOpen, loading, selectedId, pointerLocked, viewYaw, viewPitch,
      speed: active.speed,
      drifting: active.drifting,
      heading: active.heading,
      x: active.object?.position.x ?? null,
      z: active.object?.position.z ?? null,
    }),
  };
}
