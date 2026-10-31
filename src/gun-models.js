import * as THREE from 'three';

const M = {
  black: new THREE.MeshStandardMaterial({ color: 0x34393d, roughness: .55, metalness: .25 }),
  gunmetal: new THREE.MeshStandardMaterial({ color: 0x596168, roughness: .42, metalness: .45 }),
  silver: new THREE.MeshStandardMaterial({ color: 0xbdc2c5, roughness: .35, metalness: .5 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x79452c, roughness: .72, metalness: .05 }),
  woodLight: new THREE.MeshStandardMaterial({ color: 0x9b6240, roughness: .68, metalness: .04 }),
  olive: new THREE.MeshStandardMaterial({ color: 0x59604a, roughness: .7, metalness: .12 }),
  polymer: new THREE.MeshStandardMaterial({ color: 0x3d4246, roughness: .75, metalness: .08 }),
  magazine: new THREE.MeshStandardMaterial({ color: 0x62666a, roughness: .5, metalness: .65 }),
  skin: new THREE.MeshStandardMaterial({ color: 0xb98262, roughness: .9, metalness: 0 }),
  sleeve: new THREE.MeshStandardMaterial({ color: 0x202b36, roughness: .92, metalness: 0 }),
  lens: new THREE.MeshStandardMaterial({ color: 0x152e3c, emissive: 0x07141d, roughness: .08, metalness: .65 }),
  flash: new THREE.MeshBasicMaterial({ color: 0xffc33b, transparent: true, opacity: .92, depthWrite: false }),
};

function box(group, material, size, position, rotation = null) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  if (rotation) mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  group.add(mesh);
  return mesh;
}

function cylinder(group, material, radius, length, position, axis = 'z', radiusTop = radius) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radius, length, 14), material);
  if (axis === 'z') mesh.rotation.x = Math.PI / 2;
  if (axis === 'x') mesh.rotation.z = Math.PI / 2;
  mesh.position.set(...position);
  mesh.castShadow = true;
  group.add(mesh);
  return mesh;
}

function sphere(group, material, radius, position, scale = null) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 8), material);
  mesh.position.set(...position);
  if (scale) mesh.scale.set(...scale);
  group.add(mesh);
  return mesh;
}

function torus(group, material, radius, tube, position, scale = null) {
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 8, 20), material);
  mesh.rotation.y = Math.PI / 2;
  mesh.position.set(...position);
  if (scale) mesh.scale.set(...scale);
  group.add(mesh);
  return mesh;
}

function limb(group, material, start, end, radius) {
  const a = new THREE.Vector3(...start);
  const b = new THREE.Vector3(...end);
  const direction = b.clone().sub(a);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius * .82, radius, direction.length(), 10), material);
  mesh.position.copy(a).add(b).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  group.add(mesh);
  return mesh;
}

function triggerGuard(group, position, radius = .037) {
  torus(group, M.black, radius, .007, position, [1, .8, 1]);
  box(group, M.gunmetal, [.012, .045, .012], [position[0], position[1] + .014, position[2] - .008], [.25, 0, 0]);
}

function curvedMagazine(group, material, count, startY, startZ, width, step = .044) {
  for (let i = 0; i < count; i++) {
    box(group, material, [width, step * 1.2, .067], [0, startY - i * step, startZ + i * .019], [-i * .09, 0, 0]);
  }
}

function rail(group, startZ, count, y) {
  box(group, M.black, [.09, .018, count * .025], [0, y, startZ]);
  for (let i = 0; i < count; i++) box(group, M.gunmetal, [.096, .014, .009], [0, y + .012, startZ - count * .012 + i * .025]);
}

function addMuzzle(group, z, y = .025) {
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, y, z);
  group.add(muzzle);
  const flash = new THREE.Mesh(new THREE.ConeGeometry(.055, .18, 8), M.flash);
  flash.rotation.x = -Math.PI / 2;
  flash.position.set(0, y, z - .08);
  flash.visible = false;
  group.add(flash);
  group.userData.muzzle = muzzle;
  group.userData.flash = flash;
}

function buildAK47() {
  const group = new THREE.Group();
  box(group, M.gunmetal, [.1, .12, .34], [0, 0, 0]);
  box(group, M.gunmetal, [.095, .035, .3], [0, .076, -.015]);
  box(group, M.wood, [.09, .13, .28], [0, -.015, .31]);
  box(group, M.woodLight, [.105, .15, .055], [0, -.018, .47]);
  box(group, M.wood, [.075, .18, .085], [0, -.13, .12], [-.24, 0, 0]);
  box(group, M.woodLight, [.115, .115, .25], [0, .005, -.28]);
  cylinder(group, M.gunmetal, .017, .4, [0, .025, -.5]);
  cylinder(group, M.black, .019, .34, [0, .078, -.36]);
  cylinder(group, M.gunmetal, .021, .055, [0, .025, -.715]);
  box(group, M.black, [.025, .11, .022], [0, .105, -.69]);
  box(group, M.black, [.06, .018, .025], [0, .153, -.69]);
  box(group, M.black, [.045, .055, .024], [0, .112, -.04]);
  curvedMagazine(group, M.gunmetal, 6, -.075, .015, .078);
  triggerGuard(group, [0, -.085, .055]);
  addMuzzle(group, -.75);
  return group;
}

function buildM4(suppressed) {
  const group = new THREE.Group();
  box(group, M.gunmetal, [.09, .115, .32], [0, 0, 0]);
  cylinder(group, M.black, .026, .23, [0, .005, .25]);
  box(group, M.polymer, [.1, .14, suppressed ? .24 : .19], [0, -.012, .39]);
  box(group, M.polymer, [.105, .145, .045], [0, -.015, .505]);
  box(group, M.polymer, [.075, .18, .08], [0, -.135, .12], [-.22, 0, 0]);
  box(group, M.polymer, [.115, .12, .29], [0, .005, -.3]);
  for (let i = 0; i < 6; i++) box(group, M.black, [.12, .125, .012], [0, .005, -.18 - i * .047]);
  cylinder(group, M.gunmetal, .014, .35, [0, .025, -.535]);
  if (suppressed) {
    cylinder(group, M.black, .032, .31, [0, .025, -.72]);
    cylinder(group, M.gunmetal, .034, .025, [0, .025, -.885]);
  } else {
    cylinder(group, M.black, .02, .065, [0, .025, -.735]);
  }
  box(group, M.magazine, [.078, .2, .08], [0, -.145, .025], [-.12, 0, 0]);
  triggerGuard(group, [0, -.08, .06]);
  rail(group, -.09, 8, .083);
  if (suppressed) {
    box(group, M.gunmetal, [.018, .09, .18], [-.042, .14, .05]);
    box(group, M.gunmetal, [.018, .09, .18], [.042, .14, .05]);
    box(group, M.gunmetal, [.1, .018, .18], [0, .19, .05]);
  } else {
    box(group, M.black, [.055, .085, .025], [0, .14, .04]);
    box(group, M.gunmetal, [.02, .12, .025], [0, .12, -.62]);
    box(group, M.gunmetal, [.06, .018, .025], [0, .175, -.62]);
  }
  addMuzzle(group, suppressed ? -.905 : -.78);
  return group;
}

function buildGalil() {
  const group = new THREE.Group();
  box(group, M.gunmetal, [.105, .13, .36], [0, 0, 0]);
  box(group, M.polymer, [.085, .055, .28], [0, .035, .31]);
  box(group, M.polymer, [.025, .12, .2], [-.035, -.035, .37]);
  box(group, M.polymer, [.025, .12, .2], [.035, -.035, .37]);
  box(group, M.polymer, [.115, .16, .055], [0, -.02, .49]);
  box(group, M.polymer, [.075, .19, .085], [0, -.14, .13], [-.24, 0, 0]);
  box(group, M.black, [.12, .13, .3], [0, .005, -.31]);
  for (let i = 0; i < 5; i++) box(group, M.gunmetal, [.125, .135, .014], [0, .005, -.2 - i * .055]);
  cylinder(group, M.gunmetal, .016, .38, [0, .025, -.56]);
  cylinder(group, M.black, .022, .065, [0, .025, -.775]);
  box(group, M.black, [.024, .13, .025], [0, .12, -.69]);
  box(group, M.black, [.065, .02, .025], [0, .18, -.69]);
  box(group, M.black, [.05, .09, .025], [0, .13, -.025]);
  curvedMagazine(group, M.magazine, 7, -.08, .035, .08, .047);
  triggerGuard(group, [0, -.085, .065], .04);
  rail(group, -.04, 6, .09);
  addMuzzle(group, -.81);
  return group;
}

function buildAWP() {
  const group = new THREE.Group();
  box(group, M.olive, [.105, .12, .34], [0, 0, -.015]);
  box(group, M.olive, [.1, .065, .3], [0, .045, .31]);
  box(group, M.olive, [.095, .055, .25], [0, -.145, .3]);
  box(group, M.olive, [.105, .21, .055], [0, -.035, .475]);
  box(group, M.black, [.11, .22, .025], [0, -.035, .51]);
  torus(group, M.olive, .065, .018, [0, -.045, .285], [1, 1.25, 1]);
  box(group, M.olive, [.09, .09, .12], [0, -.095, -.015]);
  cylinder(group, M.gunmetal, .017, .7, [0, .025, -.625]);
  cylinder(group, M.black, .027, .07, [0, .025, -.995]);
  box(group, M.magazine, [.095, .105, .12], [0, -.1, -.015]);
  triggerGuard(group, [0, -.085, .075], .041);
  cylinder(group, M.black, .038, .36, [0, .18, -.08]);
  cylinder(group, M.black, .053, .09, [0, .18, -.28]);
  cylinder(group, M.lens, .045, .008, [0, .18, -.329]);
  cylinder(group, M.gunmetal, .044, .04, [0, .18, .115]);
  for (const z of [-.19, .035]) {
    cylinder(group, M.gunmetal, .043, .025, [0, .18, z]);
    box(group, M.gunmetal, [.025, .075, .025], [0, .115, z]);
  }
  cylinder(group, M.gunmetal, .012, .09, [.075, .045, .06], 'x');
  sphere(group, M.black, .022, [.12, .045, .06]);
  limb(group, M.gunmetal, [-.025, -.045, -.49], [-.17, -.34, -.43], .009);
  limb(group, M.gunmetal, [.025, -.045, -.49], [.17, -.34, -.43], .009);
  addMuzzle(group, -1.035);
  return group;
}

function buildDesertEagle() {
  const group = new THREE.Group();
  box(group, M.silver, [.105, .135, .36], [0, .045, -.055]);
  box(group, M.gunmetal, [.09, .065, .28], [0, .1, -.13]);
  box(group, M.gunmetal, [.085, .09, .19], [0, -.045, .025]);
  box(group, M.polymer, [.095, .25, .12], [0, -.205, .13], [-.18, 0, 0]);
  box(group, M.black, [.105, .035, .13], [0, -.335, .155]);
  triggerGuard(group, [0, -.095, .005], .047);
  for (let i = 0; i < 7; i++) box(group, M.black, [.108, .085, .008], [0, .055, .025 + i * .018], [0, 0, -.12]);
  for (let i = 0; i < 5; i++) box(group, M.black, [.075, .018, .014], [0, -.035, -.24 + i * .027]);
  box(group, M.black, [.03, .045, .025], [0, .145, .11]);
  box(group, M.black, [.025, .04, .02], [0, .145, -.285]);
  cylinder(group, M.black, .019, .05, [0, .065, -.255]);
  addMuzzle(group, -.285, .065);
  return group;
}

function buildUSP() {
  const group = new THREE.Group();
  box(group, M.gunmetal, [.09, .105, .235], [0, .04, -.035]);
  box(group, M.black, [.082, .08, .18], [0, -.035, .015]);
  box(group, M.polymer, [.085, .2, .105], [0, -.17, .105], [-.18, 0, 0]);
  box(group, M.black, [.095, .025, .115], [0, -.275, .125]);
  triggerGuard(group, [0, -.085, .005], .041);
  cylinder(group, M.black, .033, .3, [0, .055, -.285]);
  cylinder(group, M.gunmetal, .035, .025, [0, .055, -.445]);
  for (let i = 0; i < 5; i++) box(group, M.black, [.094, .065, .008], [0, .045, .015 + i * .018]);
  box(group, M.black, [.025, .035, .02], [0, .115, .065]);
  box(group, M.black, [.022, .03, .018], [0, .11, -.14]);
  addMuzzle(group, -.46, .055);
  return group;
}

export function addHands(group, rifle) {
  sphere(group, M.skin, .065, [.055, -.09, .02], [.8, .65, 1.15]);
  limb(group, M.skin, [.24, -.43, .32], [.065, -.12, .04], .055);
  limb(group, M.sleeve, [.36, -.62, .48], [.24, -.43, .32], .072);
  for (let i = 0; i < 3; i++) box(group, M.skin, [.025, .025, .075], [.015 + i * .018, -.075, .025]);
  if (rifle) {
    sphere(group, M.skin, .06, [-.045, -.09, -.3], [.85, .65, 1.1]);
    limb(group, M.skin, [-.25, -.42, -.12], [-.055, -.12, -.28], .052);
    limb(group, M.sleeve, [-.37, -.58, .02], [-.25, -.42, -.12], .068);
  }
}

const BUILDERS = {
  ak47: buildAK47,
  m4a4: () => buildM4(false),
  m4a1s: () => buildM4(true),
  galiar: buildGalil,
  awp: buildAWP,
  deserteagle: buildDesertEagle,
  usp: buildUSP,
};

export function buildWeaponView(id, includeHands = true) {
  const builder = BUILDERS[id];
  if (!builder) throw new Error(`未知枪械 ${id}`);
  const root = new THREE.Group();
  const weapon = builder();
  root.add(weapon);
  if (includeHands) addHands(root, !['usp', 'deserteagle'].includes(id));
  root.userData.muzzle = weapon.userData.muzzle;
  root.userData.flash = weapon.userData.flash;
  root.userData.weaponId = id;
  return root;
}
