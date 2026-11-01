export const MAP_BOUNDS = { minX: -20, maxX: 20, minZ: -12, maxZ: 12 };
export const PLATFORM = { x: 0, z: 0, w: 8, d: 4, h: 2.6 };
export const SPAWNS = [
  { position: [-17, 1.68, 0], yaw: -Math.PI / 2 },
  { position: [17, 1.68, 0], yaw: Math.PI / 2 },
];
export const COVERS = [
  { x: -11, z: -5, w: 1.8, h: 2, d: 2.2 },
  { x: 11, z: 5, w: 1.8, h: 2, d: 2.2 },
  { x: -8, z: 5, w: 2.4, h: 1.1, d: 1.4 },
  { x: 8, z: -5, w: 2.4, h: 1.1, d: 1.4 },
  { x: -4, z: -9, w: 2, h: 1.8, d: 1.2 },
  { x: 4, z: 9, w: 2, h: 1.8, d: 1.2 },
  { x: 0, z: -6, w: 3, h: 1.1, d: 1.2 },
  { x: 0, z: 6, w: 3, h: 1.1, d: 1.2 },
];
export const LADDERS = [
  { id: 'west', x: -4.65, z: 0, bottom: 0, top: PLATFORM.h, exit: [-3.35, PLATFORM.h, 0] },
  { id: 'east', x: 4.65, z: 0, bottom: 0, top: PLATFORM.h, exit: [3.35, PLATFORM.h, 0] },
];
export const DUEL_WEAPONS = {
  usp: { interval: 7 / 30, damage: 28 },
  deserteagle: { interval: 6 / 30, damage: 45 },
  m4a1s: { interval: 3 / 30, damage: 30 },
  m4a4: { interval: 3 / 30, damage: 32 },
  ak47: { interval: 3 / 30, damage: 36 },
  galiar: { interval: 3 / 30, damage: 30 },
  awp: { interval: 1.45, damage: 110 },
};

function inside(x, z, box, margin = 0) {
  return Math.abs(x - box.x) < box.w / 2 + margin && Math.abs(z - box.z) < box.d / 2 + margin;
}

export function groundHeight(x, z, feetY = 0) {
  let height = 0;
  if (inside(x, z, PLATFORM) && feetY >= PLATFORM.h - .35) height = PLATFORM.h;
  for (const cover of COVERS) {
    if (inside(x, z, cover) && feetY >= cover.h - .35) height = Math.max(height, cover.h);
  }
  return height;
}

export function isBlocked(x, z, feetY = 0) {
  const margin = .32;
  if (x < MAP_BOUNDS.minX + margin || x > MAP_BOUNDS.maxX - margin || z < MAP_BOUNDS.minZ + margin || z > MAP_BOUNDS.maxZ - margin) return true;
  if (inside(x, z, PLATFORM, margin) && feetY < PLATFORM.h - .35) return true;
  for (const cover of COVERS) {
    if (inside(x, z, cover, margin) && feetY < cover.h - .35) return true;
  }
  return false;
}

export function getLadder(x, y, z) {
  return LADDERS.find((ladder) => Math.abs(x - ladder.x) < .82 && Math.abs(z - ladder.z) < .82 && y >= ladder.bottom - .25 && y <= ladder.top + .45) || null;
}

export function rayAabb(origin, direction, box, maxDistance = 120) {
  const min = [box.x - box.w / 2, box.bottom || 0, box.z - box.d / 2];
  const max = [box.x + box.w / 2, box.h, box.z + box.d / 2];
  let near = 0;
  let far = maxDistance;
  for (let axis = 0; axis < 3; axis++) {
    if (Math.abs(direction[axis]) < 1e-8) {
      if (origin[axis] < min[axis] || origin[axis] > max[axis]) return null;
      continue;
    }
    const inv = 1 / direction[axis];
    let a = (min[axis] - origin[axis]) * inv;
    let b = (max[axis] - origin[axis]) * inv;
    if (a > b) [a, b] = [b, a];
    near = Math.max(near, a);
    far = Math.min(far, b);
    if (near > far) return null;
  }
  return near >= 0 && near <= maxDistance ? near : null;
}

export function raycastMap(origin, direction, maxDistance = 120) {
  const walls = [
    { x: 0, z: MAP_BOUNDS.minZ, w: 40, h: 4, d: .3 },
    { x: 0, z: MAP_BOUNDS.maxZ, w: 40, h: 4, d: .3 },
    { x: MAP_BOUNDS.minX, z: 0, w: .3, h: 4, d: 24 },
    { x: MAP_BOUNDS.maxX, z: 0, w: .3, h: 4, d: 24 },
  ];
  let nearest = null;
  for (const box of [...COVERS, PLATFORM, ...walls]) {
    const distance = rayAabb(origin, direction, box, maxDistance);
    if (distance !== null && (nearest === null || distance < nearest)) nearest = distance;
  }
  return nearest;
}
