import * as THREE from 'three';
import { WEAPONS, WEAPON_BY_ID, DEFAULT_FOV } from './gun-catalog.js';
import { buildWeaponView } from './gun-models.js';
import { GunAudio } from './gun-audio.js';
import { createGrenadeSystem, buildThrowableView, THROWABLE_INFO } from './grenade-system.js';
import { createTargetSystem } from './target-system.js';
import { BUILDINGS, SAT, SITE, MPP, U0, ux, uz } from './layout.js';
import { coastX } from './world.js';

const $ = (id) => document.getElementById(id);
const SPAWN = { x: ux(1000), z: uz(500) };
const RELOAD_TIME_SCALE = 2 / 3;
const THROWABLES = Object.keys(THROWABLE_INFO);
const PARTS = BUILDINGS.flatMap((building) => building.parts);
const STAND_EYE_HEIGHT = 1.68;
const CROUCH_EYE_HEIGHT = 1.08;
const JUMP_SPEED = 6.4;
const GRAVITY = 18;

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

function isBlocked(x, z) {
  const margin = .38;
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

export function createGunMode({ scene, camera, renderer, controls, renderFrame, onLoadProgress, canInteract = () => true, rangeOnly = false }) {
  const audio = new GunAudio();
  const grenades = createGrenadeSystem({ scene, camera, audio });
  const targetRange = rangeOnly ? createTargetSystem({ scene }) : null;
  if (rangeOnly) targetRange.setActive(true);
  const viewScene = new THREE.Scene();
  const viewCamera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, .01, 12);
  viewScene.add(new THREE.HemisphereLight(0xe8eff5, 0x3d3028, 2.2));
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.8);
  keyLight.position.set(-2, 4, 3);
  viewScene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xdde8ff, 1.5);
  fillLight.position.set(2, 1, 4);
  viewScene.add(fillLight);

  const previewCanvas = $('gun-preview');
  const previewRenderer = new THREE.WebGLRenderer({ canvas: previewCanvas, alpha: true, antialias: true });
  previewRenderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  previewRenderer.setClearColor(0x000000, 0);
  const previewScene = new THREE.Scene();
  const previewCamera = new THREE.PerspectiveCamera(35, 1, .01, 20);
  previewCamera.position.set(0, 0, 2.8);
  previewScene.add(new THREE.HemisphereLight(0xf2f5f8, 0x44372d, 2.4));
  const previewKey = new THREE.DirectionalLight(0xffffff, 3);
  previewKey.position.set(-3, 4, 5);
  previewScene.add(previewKey);
  const previewRim = new THREE.DirectionalLight(0xc9dcff, 1.8);
  previewRim.position.set(3, 1, -4);
  previewScene.add(previewRim);
  const previewModels = new Map();
  let previewModel = null;
  let previewId = null;

  const keys = new Set();
  const ammo = new Map(WEAPONS.map((weapon) => [weapon.id, weapon.magazine]));
  const reserve = new Map(WEAPONS.map((weapon) => [weapon.id, weapon.reserve]));
  const tracers = [];
  let currentId = 'm4a4';
  let equipped = 'gun';
  let throwableIndex = -1;
  let throwStart = 0;
  let viewModel = null;
  let pointerLocked = false;
  let menuOpen = false;
  let vehicleActive = false;
  let firing = false;
  let yaw = 0;
  let pitch = 0;
  let zoomStage = 0;
  let nextShotAt = 0;
  let reloading = false;
  let reloadEnd = 0;
  let reloadStart = 0;
  let recoil = 0;
  let flashUntil = 0;
  let shots = 0;
  let bobTime = 0;
  let previousTime = performance.now();
  let loadError = '';
  let eyeHeight = STAND_EYE_HEIGHT;
  let jumpOffset = 0;
  let verticalVelocity = 0;
  let grounded = true;
  let crouching = false;
  const velocity = new THREE.Vector3();

  if (rangeOnly) camera.position.copy(targetRange.spawn);
  else camera.position.set(SPAWN.x, STAND_EYE_HEIGHT, SPAWN.z);
  camera.rotation.set(0, 0, 0, 'YXZ');
  camera.fov = DEFAULT_FOV;
  camera.near = .08;
  camera.updateProjectionMatrix();
  window.camOverride = null;
  controls.enabled = false;

  function previewWeapon(id) {
    const weapon = WEAPON_BY_ID[id];
    if (!weapon) return;
    previewId = id;
    if (previewModel) previewScene.remove(previewModel);
    if (!previewModels.has(id)) {
      const model = buildWeaponView(id, false);
      model.rotation.set(.08, -Math.PI / 2, .03);
      model.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(model);
      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      model.position.sub(center);
      model.scale.setScalar(2.65 / Math.max(size.x, size.y, size.z));
      previewModels.set(id, model);
    }
    previewModel = previewModels.get(id);
    previewScene.add(previewModel);
    $('gun-preview-name').textContent = weapon.name;
    const mode = weapon.mode === 'auto' ? '全自动' : weapon.mode === 'bolt' ? '栓动' : '半自动';
    $('gun-preview-meta').textContent = `${mode} · 弹匣 ${weapon.magazine} 发`;
  }

  function renderPreview() {
    if (!menuOpen || !previewModel) return;
    const width = previewCanvas.clientWidth;
    const height = previewCanvas.clientHeight;
    if (!width || !height) return;
    const ratio = previewRenderer.getPixelRatio();
    if (previewCanvas.width !== Math.floor(width * ratio) || previewCanvas.height !== Math.floor(height * ratio)) {
      previewRenderer.setSize(width, height, false);
      previewCamera.aspect = width / height;
      previewCamera.updateProjectionMatrix();
    }
    previewRenderer.render(previewScene, previewCamera);
  }

  function syncHUD() {
    const weapon = WEAPON_BY_ID[currentId];
    if (equipped === 'throwable') {
      const type = THROWABLES[throwableIndex];
      $('weapon-name').textContent = THROWABLE_INFO[type].name;
      $('ammo-count').textContent = '∞';
      $('weapon-state').textContent = '左键投掷 · B 打开选枪';
    } else {
      $('weapon-name').textContent = weapon.name;
      $('ammo-count').textContent = `${ammo.get(currentId)} / ${reserve.get(currentId)}`;
      $('weapon-state').textContent = reloading ? '换弹中' : zoomStage ? `AWP ${zoomStage} 段瞄准` : weapon.mode === 'auto' ? '全自动' : weapon.mode === 'bolt' ? '栓动' : '半自动';
    }
    $('gun-hud').hidden = vehicleActive;
    if (rangeOnly) $('range-hud').hidden = vehicleActive;
    $('gun-menu').hidden = vehicleActive || !menuOpen;
    $('gun-hint').hidden = vehicleActive || pointerLocked || menuOpen;
    $('crosshair').hidden = vehicleActive || zoomStage > 0 || menuOpen;
    $('awp-scope').hidden = vehicleActive || zoomStage === 0 || menuOpen;
    for (const button of document.querySelectorAll('.weapon-option')) button.classList.toggle('selected', button.dataset.id === currentId);
  }

  function resetScope() {
    zoomStage = 0;
    camera.fov = DEFAULT_FOV;
    camera.updateProjectionMatrix();
    if (viewModel) viewModel.visible = true;
  }

  function selectWeapon(id) {
    if (!WEAPON_BY_ID[id]) return;
    currentId = id;
    equipped = 'gun';
    firing = false;
    reloading = false;
    resetScope();
    if (viewModel) viewScene.remove(viewModel);
    viewModel = buildWeaponView(id);
    const pistol = id === 'usp' || id === 'deserteagle';
    viewModel.scale.setScalar(id === 'awp' ? .82 : 1);
    viewModel.position.set(pistol ? .3 : .24, pistol ? -.22 : -.26, pistol ? -.62 : -.78);
    viewModel.rotation.set(-.03, -.08, .02);
    viewScene.add(viewModel);
    nextShotAt = performance.now() / 1000 + .12;
    recoil = 0;
    if (menuOpen) previewWeapon(id);
    syncHUD();
  }

  function cycleThrowable() {
    throwableIndex = (throwableIndex + 1) % THROWABLES.length;
    const type = THROWABLES[throwableIndex];
    equipped = 'throwable';
    firing = false;
    reloading = false;
    resetScope();
    if (viewModel) viewScene.remove(viewModel);
    viewModel = buildThrowableView(type);
    viewModel.scale.setScalar(.88);
    viewModel.position.set(.3, -.28, -.64);
    viewModel.rotation.set(-.08, -.12, .08);
    viewScene.add(viewModel);
    throwStart = 0;
    recoil = 0;
    syncHUD();
  }

  function throwEquipped() {
    if (equipped !== 'throwable') return false;
    const thrown = grenades.throwGrenade(THROWABLES[throwableIndex]);
    if (thrown) throwStart = performance.now() / 1000;
    return thrown;
  }

  function openMenu() {
    menuOpen = true;
    firing = false;
    keys.clear();
    previewWeapon(currentId);
    if (document.pointerLockElement === renderer.domElement) document.exitPointerLock();
    syncHUD();
  }

  function closeMenu() {
    menuOpen = false;
    keys.clear();
    syncHUD();
    lockPointer();
  }

  function setVehicleActive(active) {
    if (vehicleActive === active) return;
    vehicleActive = active;
    firing = false;
    keys.clear();
    if (active) {
      menuOpen = false;
    } else {
      controls.enabled = false;
      previousTime = performance.now();
      renderer.setAnimationLoop(frame);
    }
    syncHUD();
  }

  function lockPointer() {
    if (!canInteract()) return;
    audio.resume();
    if (vehicleActive || menuOpen || document.pointerLockElement === renderer.domElement) return;
    try {
      const request = renderer.domElement.requestPointerLock();
      if (request?.catch) request.catch(() => {});
    } catch (_) {}
  }

  function makeTracer(now) {
    const origin = camera.getWorldPosition(new THREE.Vector3());
    const direction = camera.getWorldDirection(new THREE.Vector3());
    const hit = targetRange?.shoot(origin, direction, currentId);
    const start = origin.clone().addScaledVector(direction, .7);
    const end = hit ? hit.point : origin.clone().addScaledVector(direction, 120);
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    const material = new THREE.LineBasicMaterial({ color: 0xffd47a, transparent: true, opacity: .72 });
    const line = new THREE.Line(geometry, material);
    line.userData.until = now + .055;
    scene.add(line);
    tracers.push(line);
  }

  function tryFire(now = performance.now() / 1000) {
    const weapon = WEAPON_BY_ID[currentId];
    if (equipped !== 'gun' || reloading || now < nextShotAt) return false;
    if (ammo.get(currentId) <= 0) {
      nextShotAt = now + .25;
      if (reserve.get(currentId) > 0) startReload();
      else $('weapon-state').textContent = '无备用弹药';
      return false;
    }
    ammo.set(currentId, ammo.get(currentId) - 1);
    shots++;
    nextShotAt = now + weapon.interval;
    recoil = Math.min(3, recoil + weapon.recoil);
    pitch = THREE.MathUtils.clamp(pitch + weapon.recoil * .002, -1.45, 1.45);
    flashUntil = now + .05;
    if (viewModel?.userData.flash) viewModel.userData.flash.visible = true;
    audio.play(currentId);
    makeTracer(now);
    if (ammo.get(currentId) === 0 && reserve.get(currentId) > 0) startReload();
    else syncHUD();
    return true;
  }

  function startReload() {
    const weapon = WEAPON_BY_ID[currentId];
    if (equipped !== 'gun' || reloading || ammo.get(currentId) >= weapon.magazine || reserve.get(currentId) <= 0) return;
    firing = false;
    resetScope();
    reloading = true;
    reloadStart = performance.now() / 1000;
    reloadEnd = reloadStart + weapon.reloadTime * RELOAD_TIME_SCALE;
    syncHUD();
  }

  function finishReload(now) {
    if (!reloading || now < reloadEnd) return;
    const weapon = WEAPON_BY_ID[currentId];
    const needed = weapon.magazine - ammo.get(currentId);
    const taken = Math.min(needed, reserve.get(currentId));
    ammo.set(currentId, ammo.get(currentId) + taken);
    reserve.set(currentId, reserve.get(currentId) - taken);
    reloading = false;
    nextShotAt = now + .15;
    syncHUD();
  }

  function cycleZoom() {
    if (equipped !== 'gun' || currentId !== 'awp' || reloading) return;
    zoomStage = (zoomStage + 1) % 3;
    const weapon = WEAPON_BY_ID.awp;
    camera.fov = zoomStage === 0 ? DEFAULT_FOV : weapon.zoomFov[zoomStage - 1];
    camera.updateProjectionMatrix();
    if (viewModel) viewModel.visible = zoomStage === 0;
    syncHUD();
  }

  function movePlayer(dt) {
    crouching = keys.has('ControlLeft') || keys.has('ControlRight') || keys.has('KeyC');
    const forwardInput = Number(keys.has('KeyW')) - Number(keys.has('KeyS'));
    const rightInput = Number(keys.has('KeyD')) - Number(keys.has('KeyA'));
    const length = Math.hypot(forwardInput, rightInput) || 1;
    const sprinting = keys.has('ShiftLeft') || keys.has('ShiftRight');
    const speed = crouching ? 2.8 : sprinting ? 8 : 5.2;
    const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const desired = forward.multiplyScalar(forwardInput / length).add(right.multiplyScalar(rightInput / length)).multiplyScalar(speed);
    velocity.x = THREE.MathUtils.damp(velocity.x, desired.x, 12, dt);
    velocity.z = THREE.MathUtils.damp(velocity.z, desired.z, 12, dt);
    const oldX = camera.position.x;
    const oldZ = camera.position.z;
    const nextX = oldX + velocity.x * dt;
    const nextZ = oldZ + velocity.z * dt;
    const blocked = rangeOnly ? targetRange.isBlocked : isBlocked;
    if (!blocked(nextX, oldZ)) camera.position.x = nextX;
    else velocity.x = 0;
    if (!blocked(camera.position.x, nextZ)) camera.position.z = nextZ;
    else velocity.z = 0;
    if (!grounded) {
      verticalVelocity -= GRAVITY * dt;
      jumpOffset += verticalVelocity * dt;
      if (jumpOffset <= 0) {
        jumpOffset = 0;
        verticalVelocity = 0;
        grounded = true;
      }
    }
    eyeHeight = THREE.MathUtils.damp(eyeHeight, crouching ? CROUCH_EYE_HEIGHT : STAND_EYE_HEIGHT, 14, dt);
    camera.position.y = eyeHeight + jumpOffset;
    bobTime += Math.hypot(velocity.x, velocity.z) * dt * 1.4;
  }

  function jump() {
    if (menuOpen || !grounded) return;
    grounded = false;
    verticalVelocity = JUMP_SPEED;
  }

  function updateViewModel(dt, now) {
    if (!viewModel) return;
    recoil = THREE.MathUtils.damp(recoil, 0, 11, dt);
    const speedRatio = Math.min(1, Math.hypot(velocity.x, velocity.z) / 5.2);
    const bobX = Math.sin(bobTime) * .008 * speedRatio;
    const bobY = Math.abs(Math.cos(bobTime)) * .007 * speedRatio;
    if (equipped === 'throwable') {
      const throwProgress = throwStart ? THREE.MathUtils.clamp((now - throwStart) / .32, 0, 1) : 0;
      const throwPose = Math.sin(throwProgress * Math.PI);
      viewModel.position.set(.3 + bobX, -.28 - bobY - throwPose * .05, -.64 + throwPose * .12);
      viewModel.rotation.set(-.08 - throwPose * .55, -.12, .08 + throwPose * .18);
      return;
    }
    const pistol = currentId === 'usp' || currentId === 'deserteagle';
    const baseZ = pistol ? -.62 : -.78;
    const reloadProgress = reloading ? THREE.MathUtils.clamp((now - reloadStart) / (reloadEnd - reloadStart), 0, 1) : 0;
    const reloadPose = Math.sin(reloadProgress * Math.PI);
    viewModel.position.set(
      (pistol ? .3 : .24) + bobX,
      (pistol ? -.22 : -.26) - bobY - recoil * .012 - reloadPose * .06,
      baseZ + recoil * .04,
    );
    viewModel.rotation.set(-.03 - recoil * .026 + reloadPose * .85, -.08, .02 + bobX * .5 + reloadPose * .18);
    if (viewModel.userData.flash) viewModel.userData.flash.visible = now < flashUntil;
  }

  function updateTracers(now) {
    for (let i = tracers.length - 1; i >= 0; i--) {
      if (now < tracers[i].userData.until) continue;
      scene.remove(tracers[i]);
      tracers[i].geometry.dispose();
      tracers[i].material.dispose();
      tracers.splice(i, 1);
    }
  }

  function frame(nowMs) {
    const now = nowMs / 1000;
    const dt = Math.min((nowMs - previousTime) / 1000, .05);
    previousTime = nowMs;
    if (vehicleActive) {
      renderFrame();
      return;
    }
    if (!menuOpen) movePlayer(dt);
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;
    camera.rotation.z = 0;
    if (equipped === 'gun' && firing && WEAPON_BY_ID[currentId].mode === 'auto') tryFire(now);
    finishReload(now);
    updateViewModel(dt, now);
    updateTracers(now);
    grenades.update(dt);
    targetRange?.update(dt, now);
    renderFrame();
    renderPreview();
  }

  document.addEventListener('pointerlockchange', () => {
    pointerLocked = document.pointerLockElement === renderer.domElement;
    syncHUD();
  });
  document.addEventListener('mousemove', (event) => {
    if (!canInteract() || vehicleActive || !pointerLocked || menuOpen) return;
    yaw -= event.movementX * .0021;
    pitch = THREE.MathUtils.clamp(pitch - event.movementY * .0021, -1.45, 1.45);
  });
  renderer.domElement.addEventListener('click', lockPointer);
  renderer.domElement.addEventListener('contextmenu', (event) => event.preventDefault());
  document.addEventListener('mousedown', (event) => {
    if (!canInteract() || vehicleActive || !pointerLocked || menuOpen || event.target !== renderer.domElement) return;
    audio.resume();
    if (event.button === 0) {
      if (equipped === 'gun') {
        firing = true;
        tryFire();
      } else {
        throwEquipped();
      }
    } else if (event.button === 2) {
      cycleZoom();
    }
  });
  document.addEventListener('mouseup', (event) => {
    if (event.button === 0) firing = false;
  });
  window.addEventListener('keydown', (event) => {
    if (!canInteract()) return;
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    if (vehicleActive) return;
    if (event.code === 'KeyB') {
      event.preventDefault();
      if (!event.repeat) {
        if (menuOpen) closeMenu();
        else openMenu();
      }
      return;
    }
    if (event.code === 'Escape' && menuOpen) {
      event.preventDefault();
      closeMenu();
      return;
    }
    if (menuOpen) return;
    if (event.code === 'Digit4') {
      event.preventDefault();
      if (!event.repeat) cycleThrowable();
      return;
    }
    if (event.code === 'KeyR' && !event.repeat) {
      event.preventDefault();
      startReload();
      return;
    }
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'KeyC', 'Space'].includes(event.code)) {
      event.preventDefault();
      keys.add(event.code);
      if (event.code === 'Space' && !event.repeat) jump();
    }
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => {
    keys.clear();
    firing = false;
  });
  window.addEventListener('resize', () => {
    viewCamera.aspect = innerWidth / innerHeight;
    viewCamera.updateProjectionMatrix();
  });

  for (const weapon of WEAPONS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'drive-option weapon-option';
    button.dataset.id = weapon.id;
    const name = document.createElement('strong');
    name.textContent = weapon.name;
    const kind = document.createElement('span');
    kind.className = 'drive-kind';
    kind.textContent = weapon.mode === 'auto' ? '全自动' : weapon.mode === 'bolt' ? '栓动' : '半自动';
    const id = document.createElement('span');
    id.className = 'drive-id';
    id.textContent = weapon.short;
    button.append(name, kind, id);
    button.addEventListener('pointerenter', () => previewWeapon(weapon.id));
    button.addEventListener('focus', () => previewWeapon(weapon.id));
    button.addEventListener('click', () => {
      selectWeapon(weapon.id);
      closeMenu();
    });
    $('gun-list').appendChild(button);
  }
  $('gun-list').addEventListener('pointerleave', () => previewWeapon(currentId));
  $('gun-menu-close').addEventListener('click', closeMenu);
  $('gun-menu').addEventListener('click', (event) => {
    if (event.target === $('gun-menu')) closeMenu();
  });

  const audioReady = audio.preload(onLoadProgress).catch((error) => {
    loadError = error.message || String(error);
    console.error(error);
    throw error;
  });
  selectWeapon(currentId);
  previousTime = performance.now();
  renderer.setAnimationLoop(frame);

  return {
    ready: audioReady,
    isActive: () => true,
    isRangeActive: () => rangeOnly,
    setVehicleActive,
    selectWeapon,
    cycleThrowable,
    throwEquipped,
    fire: tryFire,
    reload: startReload,
    getState: () => ({
      active: true,
      pointerLocked, menuOpen, vehicleActive, rangeActive: rangeOnly, grounded, crouching, jumpOffset, eyeHeight, previewWeapon: previewId,
      position: camera.position.toArray(),
      yaw, pitch, fov: camera.fov,
      equipped,
      currentWeapon: currentId,
      currentThrowable: throwableIndex >= 0 ? THROWABLES[throwableIndex] : null,
      modelId: viewModel?.userData.weaponId || viewModel?.userData.throwableType || null,
      ammo: ammo.get(currentId),
      reserve: reserve.get(currentId),
      reloading, shots, zoomStage,
      interval: WEAPON_BY_ID[currentId].interval,
      sourceFrames: WEAPON_BY_ID[currentId].sourceFrames,
      reloadDuration: reloading ? reloadEnd - reloadStart : 0,
      viewModelRotation: viewModel ? viewModel.rotation.toArray().slice(0, 3) : null,
      modelMeshes: viewModel ? (() => { let count = 0; viewModel.traverse((object) => { if (object.isMesh) count++; }); return count; })() : 0,
      throwables: grenades.getState(),
      targets: targetRange?.getState() || null,
      audio: audio.getState(),
      loadError,
    }),
    renderViewModel: () => {
      if (vehicleActive) return;
      const autoClear = renderer.autoClear;
      renderer.autoClear = false;
      renderer.setRenderTarget(null);
      renderer.clearDepth();
      renderer.render(viewScene, viewCamera);
      renderer.autoClear = autoClear;
    },
  };
}
