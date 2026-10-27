import * as THREE from 'three';

function standard(color, options = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: .46, metalness: .22, ...options });
}

function luminous(color, intensity = 1.25) {
  return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: .35 });
}

function materials(paint, trim = 0x17191c, glow = 0) {
  return {
    paint: standard(paint),
    trim: standard(trim),
    dark: standard(0x121417, { roughness: .72 }),
    rubber: standard(0x090a0b, { roughness: .94, metalness: 0 }),
    metal: standard(0x9ba1a7, { metalness: .78, roughness: .28 }),
    glass: standard(0x263945, { metalness: .5, roughness: .18 }),
    white: standard(0xf1f0e9),
    red: luminous(0xd92730),
    blue: luminous(0x2368e8),
    head: luminous(0xf4f0cf, 1.6),
    glow: luminous(glow || 0x27b9c7, 1.8),
  };
}

function box(group, material, size, position, rotation = null) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  if (rotation) mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function wheel(group, mats, x, z, radius, width, steering = false) {
  const pivot = new THREE.Group();
  pivot.position.set(x, radius, z);
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 20), mats.rubber);
  tire.geometry.rotateZ(Math.PI / 2);
  tire.castShadow = true;
  pivot.add(tire);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * .45, radius * .45, width + .012, 16), mats.metal);
  hub.geometry.rotateZ(Math.PI / 2);
  pivot.add(hub);
  group.add(pivot);
  group.userData.wheels.push({ pivot, tire, hub, steering, radius });
}

function addCarWheels(group, mats, spec) {
  for (const z of spec.axles) {
    for (const side of [-1, 1]) wheel(group, mats, side * spec.track, z, spec.wheelR, spec.wheelW, z === spec.axles[0]);
  }
}

function addBikeWheels(group, mats, spec) {
  spec.axles.forEach((z, index) => wheel(group, mats, 0, z, spec.wheelR, spec.wheelW, index === 0));
}

function addVehicleLights(group, mats, spec, y) {
  const front = -spec.l / 2 - .012;
  const rear = spec.l / 2 + .012;
  for (const side of [-1, 1]) {
    box(group, mats.head, [.24, .13, .055], [side * spec.w * .31, y, front]);
    box(group, mats.red, [.22, .12, .055], [side * spec.w * .31, y, rear]);
  }
}

function buildTwoWheeler(entry) {
  const { spec } = entry;
  const group = new THREE.Group();
  group.userData.wheels = [];
  const mats = materials(entry.paint, entry.trim, entry.glow);
  addBikeWheels(group, mats, spec);
  const [front, rear] = spec.axles;
  const r = spec.wheelR;
  box(group, mats.dark, [.34, .28, .55], [0, r + .25, .12]);
  box(group, mats.paint, [.38, .26, .72], [0, r + .43, -.08]);
  box(group, mats.dark, [.38, .12, .76], [0, r + .65, .18]);
  box(group, mats.metal, [.07, .68, .07], [0, r + .48, front + .12], [-.2, 0, 0]);
  box(group, mats.dark, [.58, .06, .08], [0, r + .84, front + .08]);
  box(group, mats.head, [.25, .18, .08], [0, r + .72, front - .12]);
  box(group, mats.red, [.2, .1, .06], [0, r + .48, rear + .28]);
  if (entry.kind === 'scooter') {
    box(group, mats.paint, [.5, .62, .16], [0, r + .52, front + .34], [-.12, 0, 0]);
    box(group, mats.dark, [.48, .08, .68], [0, r + .14, .02]);
  } else {
    box(group, mats.paint, [.46, .36, .58], [0, r + .58, -.25], [-.12, 0, 0]);
    if (entry.kind === 'superbike') {
      box(group, mats.paint, [.52, .48, .5], [0, r + .53, front + .3], [-.18, 0, 0]);
      box(group, mats.glass, [.4, .28, .06], [0, r + .9, front + .18], [-.28, 0, 0]);
    }
  }
  group.userData.materials = mats;
  return group;
}

function buildPassengerCar(entry) {
  const { spec, kind } = entry;
  const group = new THREE.Group();
  group.userData.wheels = [];
  const mats = materials(entry.paint, entry.trim, entry.glow);
  addCarWheels(group, mats, spec);
  const low = kind === 'sports' ? .28 : kind === 'suv' ? .5 : .4;
  const bodyY = spec.wheelR + low / 2;
  box(group, mats.paint, [spec.w, low, spec.l], [0, bodyY, 0]);
  const cabinBase = spec.wheelR + low;
  const cabinH = Math.max(.38, spec.h - cabinBase);
  const cabinL = spec.l * (kind === 'sports' ? .43 : .5);
  const cabinZ = kind === 'sports' ? .22 : .12;
  box(group, mats.glass, [spec.w * .82, cabinH * .82, cabinL], [0, cabinBase + cabinH * .45, cabinZ]);
  box(group, mats.paint, [spec.w * .86, .1, cabinL * .92], [0, cabinBase + cabinH * .9, cabinZ]);
  box(group, mats.paint, [spec.w * .94, .14, spec.l * .27], [0, cabinBase + .02, -spec.l * .34]);
  box(group, mats.trim, [spec.w * .92, .1, .12], [0, spec.wheelR + .12, -spec.l / 2 - .04]);
  addVehicleLights(group, mats, spec, spec.wheelR + low * .62);
  if (kind === 'taxi') {
    box(group, mats.head, [.54, .2, .28], [0, spec.h + .1, .05]);
    box(group, mats.dark, [spec.w + .012, .09, spec.l * .55], [0, spec.wheelR + .26, .1]);
  }
  if (kind === 'police') {
    for (const side of [-1, 1]) box(group, mats.white, [.025, .38, 1.15], [side * (spec.w / 2 + .012), spec.wheelR + .45, .1]);
    box(group, mats.dark, [.9, .07, .24], [0, spec.h + .06, .1]);
    box(group, mats.red, [.42, .15, .2], [-.23, spec.h + .16, .1]);
    box(group, mats.blue, [.42, .15, .2], [.23, spec.h + .16, .1]);
  }
  group.userData.materials = mats;
  return group;
}

function buildVan(entry) {
  const { spec, kind } = entry;
  const group = new THREE.Group();
  group.userData.wheels = [];
  const mats = materials(entry.paint, entry.trim, entry.glow);
  addCarWheels(group, mats, spec);
  const cargoL = spec.l * .7;
  box(group, mats.paint, [spec.w, spec.h - spec.wheelR, cargoL], [0, spec.wheelR + (spec.h - spec.wheelR) / 2, spec.l * .14]);
  box(group, mats.paint, [spec.w * .96, .72, spec.l * .3], [0, spec.wheelR + .36, -spec.l * .35]);
  box(group, mats.glass, [spec.w * .82, .48, .07], [0, spec.wheelR + .72, -spec.l * .505]);
  box(group, mats.glass, [spec.w * .84, .42, .5], [0, spec.wheelR + .78, -spec.l * .29]);
  addVehicleLights(group, mats, spec, spec.wheelR + .35);
  if (kind === 'ambulance') {
    for (const side of [-1, 1]) {
      const x = side * (spec.w / 2 + .016);
      box(group, mats.red, [.03, .58, .18], [x, 1.48, .6]);
      box(group, mats.red, [.03, .18, .58], [x, 1.48, .6]);
    }
    box(group, mats.blue, [.72, .15, .24], [0, spec.h + .09, -.7]);
  }
  group.userData.materials = mats;
  return group;
}

function buildBus(entry) {
  const { spec } = entry;
  const group = new THREE.Group();
  group.userData.wheels = [];
  const mats = materials(entry.paint, entry.trim, entry.glow);
  addCarWheels(group, mats, spec);
  box(group, mats.paint, [spec.w, spec.h - spec.wheelR, spec.l * .96], [0, spec.wheelR + (spec.h - spec.wheelR) / 2, 0]);
  box(group, mats.glass, [spec.w * .86, 1.05, .08], [0, 2.05, -spec.l * .485]);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 7; i++) {
      box(group, mats.glass, [.035, .92, 1.05], [side * (spec.w / 2 + .018), 2.03, -3.6 + i * 1.18]);
    }
  }
  box(group, mats.head, [1.35, .24, .06], [0, 2.86, -spec.l * .49]);
  box(group, mats.white, [spec.w * .96, .16, spec.l * .9], [0, spec.h - .08, 0]);
  addVehicleLights(group, mats, spec, .82);
  group.userData.materials = mats;
  return group;
}

function buildTruck(entry) {
  const { spec } = entry;
  const group = new THREE.Group();
  group.userData.wheels = [];
  const mats = materials(entry.paint, entry.trim, entry.glow);
  addCarWheels(group, mats, spec);
  box(group, mats.dark, [spec.w * .9, .22, spec.l], [0, spec.wheelR + .12, 0]);
  box(group, mats.paint, [spec.w, 1.1, 1.65], [0, spec.wheelR + .68, -1.05]);
  box(group, mats.glass, [spec.w * .82, .48, .07], [0, spec.wheelR + 1.03, -1.89]);
  box(group, mats.paint, [spec.w, .38, 2.05], [0, spec.wheelR + .3, 1.05]);
  for (const side of [-1, 1]) box(group, mats.paint, [.12, .65, 2.05], [side * (spec.w / 2 - .06), spec.wheelR + .66, 1.05]);
  box(group, mats.paint, [spec.w, .65, .12], [0, spec.wheelR + .66, 2.04]);
  addVehicleLights(group, mats, spec, spec.wheelR + .35);
  group.userData.materials = mats;
  return group;
}

function buildGarbage(entry) {
  const { spec } = entry;
  const group = new THREE.Group();
  group.userData.wheels = [];
  const mats = materials(entry.paint, entry.trim, entry.glow);
  addCarWheels(group, mats, spec);
  box(group, mats.paint, [spec.w, 1.65, 2.1], [0, spec.wheelR + .83, -2.35]);
  box(group, mats.glass, [spec.w * .82, .62, .08], [0, spec.wheelR + 1.18, -3.42]);
  box(group, mats.paint, [spec.w * 1.02, 2.15, 4.15], [0, spec.wheelR + 1.15, 1.15], [-.04, 0, 0]);
  box(group, mats.dark, [spec.w * .8, 1.35, .18], [0, spec.wheelR + .9, 3.3]);
  for (const side of [-1, 1]) box(group, mats.metal, [.1, .16, 4.4], [side * spec.w * .43, spec.wheelR + .25, .4]);
  addVehicleLights(group, mats, spec, spec.wheelR + .42);
  group.userData.materials = mats;
  return group;
}

function applyKit(group, entry, mats) {
  const { spec } = entry;
  const kit = new Set(entry.kit || []);
  const rear = spec.l / 2;
  const front = -spec.l / 2;
  if (kit.has('splitter')) box(group, mats.trim, [spec.w + .12, .09, .36], [0, .16, front - .12]);
  if (kit.has('sideSkirts')) for (const side of [-1, 1]) box(group, mats.trim, [.1, .12, spec.l * .68], [side * (spec.w / 2 + .035), .2, 0]);
  if (kit.has('ducktail')) box(group, mats.trim, [spec.w * .82, .12, .32], [0, spec.h - .05, rear - .18], [.15, 0, 0]);
  if (kit.has('gtWing')) {
    for (const side of [-1, 1]) box(group, mats.trim, [.08, .48, .1], [side * spec.w * .3, spec.h + .15, rear - .28]);
    box(group, mats.trim, [spec.w * .95, .09, .42], [0, spec.h + .4, rear - .3]);
  }
  if (kit.has('bullBar')) {
    for (const side of [-1, 1]) box(group, mats.metal, [.09, .82, .09], [side * spec.w * .33, .72, front - .22]);
    box(group, mats.metal, [spec.w * .82, .1, .1], [0, .82, front - .22]);
  }
  if (kit.has('snorkel')) {
    box(group, mats.dark, [.13, 1.05, .13], [spec.w * .43, 1.35, front + .75]);
    box(group, mats.dark, [.13, .13, .48], [spec.w * .43, 1.86, front + .55]);
  }
  if (kit.has('roofRack')) {
    for (const side of [-1, 1]) box(group, mats.dark, [.07, .14, 1.65], [side * spec.w * .36, spec.h + .12, .1]);
    for (const z of [-.55, .1, .75]) box(group, mats.dark, [spec.w * .78, .08, .07], [0, spec.h + .18, z]);
  }
  if (kit.has('lightBar')) {
    box(group, mats.dark, [1.25, .09, .18], [0, spec.h + .27, -.55]);
    for (const x of [-.42, 0, .42]) box(group, mats.head, [.26, .18, .12], [x, spec.h + .36, -.62]);
  }
  if (kit.has('ledArch')) {
    for (const side of [-1, 1]) box(group, mats.glow, [.12, 1.55, .12], [side * spec.w * .46, 1.65, .85]);
    box(group, mats.glow, [spec.w, .14, .14], [0, 2.42, .85]);
  }
  if (kit.has('speakers')) for (const x of [-.45, 0, .45]) box(group, mats.dark, [.38, .65, .32], [x, 1.15, 1.45]);
  if (kit.has('hoodStripes')) for (const x of [-.18, .18]) box(group, mats.trim, [.16, .025, 1.35], [x, spec.wheelR + .51, -1.25]);
  if (kit.has('neonStrip') || entry.glow) {
    for (const side of [-1, 1]) box(group, mats.glow, [.045, .045, spec.l * .7], [side * spec.w * .48, .13, 0]);
    const light = new THREE.PointLight(entry.glow || 0x27b9c7, 2.2, 5, 2);
    light.position.set(0, .25, 0);
    group.add(light);
  }
}

export function buildGenericVehicle(entry) {
  if (entry.spec.twoWheeler) return buildTwoWheeler(entry);
  let group;
  if (entry.kind === 'bus') group = buildBus(entry);
  else if (entry.kind === 'truck') group = buildTruck(entry);
  else if (entry.kind === 'garbage') group = buildGarbage(entry);
  else if (entry.kind === 'van' || entry.kind === 'ambulance') group = buildVan(entry);
  else group = buildPassengerCar(entry);
  applyKit(group, entry, group.userData.materials);
  group.userData.kind = entry.kind;
  return group;
}

function detailMaterial() {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .42, metalness: .35 });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float vehicleLight; varying float vVehicleLight;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvVehicleLight = vehicleLight;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vVehicleLight;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\nif (vVehicleLight > 0.5) totalEmissiveRadiance += vColor * 1.5;');
  };
  material.customProgramCacheKey = () => 'taipei-vehicle-light-v1';
  return material;
}

function detailGeometry(full, paint) {
  const attrs = { position: 3, normal: 3, color: 3, uv: 2 };
  const kept = [];
  for (let i = 0; i < full.position.length / 3; i += 3) {
    const a = full.vvar[i];
    const b = full.vvar[i + 1];
    const c = full.vvar[i + 2];
    if ((a === 0 || a >= 9) && (b === 0 || b >= 9) && (c === 0 || c >= 9)) kept.push(i, i + 1, i + 2);
  }
  const geometry = new THREE.BufferGeometry();
  for (const [name, size] of Object.entries(attrs)) {
    const source = full[name];
    const target = new Float32Array(kept.length * size);
    for (let i = 0; i < kept.length; i++) {
      const sourceIndex = kept[i];
      for (let k = 0; k < size; k++) target[i * size + k] = source[sourceIndex * size + k];
    }
    geometry.setAttribute(name, new THREE.BufferAttribute(target, size));
  }
  const colors = geometry.getAttribute('color');
  const lights = new Float32Array(kept.length);
  const paintColor = new THREE.Color(paint);
  for (let i = 0; i < kept.length; i++) {
    const sourceIndex = kept[i];
    const paintMode = full.vdata[sourceIndex * 4];
    if (paintMode === 1 || paintMode === 4) {
      const brightness = paintMode === 4 ? .5 : 1;
      colors.setXYZ(i, paintColor.r * brightness, paintColor.g * brightness, paintColor.b * brightness);
    }
    lights[i] = full.vdata[sourceIndex * 4 + 1];
  }
  geometry.setAttribute('vehicleLight', new THREE.BufferAttribute(lights, 1));
  geometry.computeBoundingBox();
  const box3 = geometry.boundingBox;
  const center = box3.getCenter(new THREE.Vector3());
  geometry.translate(-center.x, -box3.min.y, -center.z);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function detailedGroup(body, paint) {
  if (!body?.full?.position?.length) throw new Error(`车辆 ${body?.id || 'unknown'} 没有几何数据`);
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(detailGeometry(body.full, paint), detailMaterial());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  group.userData.kind = body.kind;
  group.userData.detail = true;
  group.userData.wheels = [];
  return group;
}

export function loadDetailedVehicles(entries, onProgress = () => {}) {
  return new Promise((resolve, reject) => {
    const results = new Map();
    const byId = new Map(entries.map((entry) => [entry.id, entry]));
    const worker = new Worker(new URL('./vehicle-worker.js', import.meta.url));
    let processed = 0;
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      worker.terminate();
      callback(value);
    };
    const timeout = setTimeout(() => finish(reject, new Error('高精度车辆模型加载超时')), 60000);
    worker.onerror = (event) => finish(reject, new Error(event.message || '车辆 Worker 加载失败'));
    worker.onmessage = (event) => {
      const data = event.data;
      if (data.id && data.error) {
        finish(reject, new Error(`${data.id}: ${data.error}`));
        return;
      }
      if (data.body) {
        try {
          const entry = byId.get(data.body.id);
          if (!entry) throw new Error(`未知车辆 ${data.body.id}`);
          results.set(entry.id, detailedGroup(data.body, entry.paint));
          processed++;
          onProgress(processed, entries.length, entry.id);
        } catch (error) {
          finish(reject, error);
          return;
        }
      }
      if (data.done || processed === entries.length) finish(resolve, results);
    };
    worker.postMessage({ ids: entries.map((entry) => entry.id) });
  });
}
