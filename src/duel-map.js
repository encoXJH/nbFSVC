import * as THREE from 'three';
import { COVERS, LADDERS, MAP_BOUNDS, PLATFORM } from './duel-layout.mjs';

export function buildDuelMap(scene) {
  const root = new THREE.Group();
  const materials = {
    floor: new THREE.MeshStandardMaterial({ color: 0x30353a, roughness: .94 }),
    wall: new THREE.MeshStandardMaterial({ color: 0x1b1f23, roughness: .88 }),
    cover: new THREE.MeshStandardMaterial({ color: 0x62686c, roughness: .82 }),
    coverDark: new THREE.MeshStandardMaterial({ color: 0x444a4f, roughness: .86 }),
    platform: new THREE.MeshStandardMaterial({ color: 0x4c5257, roughness: .8 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x92999e, roughness: .42, metalness: .65 }),
    red: new THREE.MeshBasicMaterial({ color: 0xdf3038 }),
    blue: new THREE.MeshBasicMaterial({ color: 0x3686c9 }),
    line: new THREE.MeshBasicMaterial({ color: 0x777d81 }),
  };

  function box(size, position, material, parent = root) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  box([40, .2, 24], [0, -.11, 0], materials.floor);
  box([40, 4, .3], [0, 2, MAP_BOUNDS.minZ], materials.wall);
  box([40, 4, .3], [0, 2, MAP_BOUNDS.maxZ], materials.wall);
  box([.3, 4, 24], [MAP_BOUNDS.minX, 2, 0], materials.wall);
  box([.3, 4, 24], [MAP_BOUNDS.maxX, 2, 0], materials.wall);
  box([4, .025, 6], [-17, .015, 0], materials.blue);
  box([4, .025, 6], [17, .015, 0], materials.red);

  for (const z of [-8, 0, 8]) {
    for (let x = -16; x <= 16; x += 4) box([1.8, .015, .055], [x, .012, z], materials.line);
  }
  for (const [index, cover] of COVERS.entries()) {
    box([cover.w, cover.h, cover.d], [cover.x, cover.h / 2, cover.z], index % 2 ? materials.coverDark : materials.cover);
    box([cover.w + .04, .05, cover.d + .04], [cover.x, cover.h + .025, cover.z], materials.metal);
  }

  box([PLATFORM.w, PLATFORM.h, PLATFORM.d], [PLATFORM.x, PLATFORM.h / 2, PLATFORM.z], materials.platform);
  box([PLATFORM.w, .06, PLATFORM.d], [0, PLATFORM.h + .03, 0], materials.coverDark);
  box([PLATFORM.w, .08, .12], [0, PLATFORM.h + .08, -PLATFORM.d / 2], materials.red);
  box([PLATFORM.w, .08, .12], [0, PLATFORM.h + .08, PLATFORM.d / 2], materials.blue);

  for (const ladder of LADDERS) {
    for (const z of [-.38, .38]) box([.09, ladder.top, .09], [ladder.x, ladder.top / 2, z], materials.metal);
    for (let y = .22; y < ladder.top; y += .26) box([.1, .055, .82], [ladder.x, y, 0], materials.metal);
    box([.7, .025, 1.5], [ladder.x, .014, 0], materials.red);
  }

  scene.add(root);
  return root;
}
