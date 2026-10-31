import * as THREE from 'three';

const TARGET_HEIGHT = 1.45;
const RESPAWN_DELAY = 4;
const ORIGIN = { x: 0, z: 0 };
const DISTANCES = [12, 24, 38, 54, 72];
const LANES = [0, -4, 4, -8, 8];

export function createTargetSystem({ scene }) {
  const root = new THREE.Group();
  root.position.set(ORIGIN.x, 0, ORIGIN.z);
  root.visible = false;
  scene.add(root);
  const targets = [];
  const hitMeshes = [];
  const particles = [];
  const raycaster = new THREE.Raycaster();
  raycaster.far = 120;
  let active = false;
  let score = 0;
  let hits = 0;
  let destroyed = 0;
  let hitMarkerUntil = 0;

  const materials = {
    white: new THREE.MeshStandardMaterial({ color: 0xe9e5dc, roughness: .78 }),
    red: new THREE.MeshStandardMaterial({ color: 0xc93038, roughness: .68 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x202428, roughness: .62 }),
    stand: new THREE.MeshStandardMaterial({ color: 0x4b5054, roughness: .7, metalness: .35 }),
    floor: new THREE.MeshStandardMaterial({ color: 0x292d30, roughness: .94 }),
    wall: new THREE.MeshStandardMaterial({ color: 0x171a1d, roughness: .88 }),
    line: new THREE.MeshBasicMaterial({ color: 0x62676b }),
    accent: new THREE.MeshBasicMaterial({ color: 0xdf3038 }),
  };

  function box(size, position, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.position.set(...position);
    mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  }

  function addDistanceLabel(distance, z) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 96;
    const context = canvas.getContext('2d');
    context.fillStyle = '#e9e5dc';
    context.font = '600 42px Consolas, monospace';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(`${distance} M`, 128, 48);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
    sprite.position.set(-11.3, .35, z);
    sprite.scale.set(2.3, .86, 1);
    root.add(sprite);
  }

  function buildArena() {
    box([26, .16, 94], [0, -.09, -32], materials.floor);
    box([26, 6, .5], [0, 3, -76], materials.wall);
    box([.4, 4, 94], [-13, 2, -32], materials.wall);
    box([.4, 4, 94], [13, 2, -32], materials.wall);
    box([26, .35, .55], [0, 4.8, -75.7], materials.accent);
    for (const x of [-10, -6, -2, 2, 6, 10]) box([.035, .015, 88], [x, .005, -30], materials.line);
    box([25, .02, .12], [0, .012, 7.6], materials.accent);
    for (const distance of DISTANCES) {
      const z = 8 - distance;
      box([25, .015, .035], [0, .008, z], materials.line);
      addDistanceLabel(distance, z);
    }
  }

  function syncHUD() {
    document.getElementById('range-score').textContent = String(score);
    document.getElementById('range-hits').textContent = `${hits} 命中 · ${destroyed} 击毁`;
  }

  function addTarget(x, z) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    const base = new THREE.Mesh(new THREE.BoxGeometry(.8, .1, .55), materials.stand);
    base.position.y = .05;
    const post = new THREE.Mesh(new THREE.BoxGeometry(.08, 1.35, .08), materials.stand);
    post.position.set(0, .72, -.04);
    group.add(base, post);
    const discs = [];
    for (const [radius, depth, material, front] of [
      [.52, .07, materials.white, 0],
      [.34, .025, materials.red, .049],
      [.15, .02, materials.dark, .074],
    ]) {
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, depth, 32), material);
      disc.rotation.x = Math.PI / 2;
      disc.position.set(0, TARGET_HEIGHT, front);
      disc.castShadow = true;
      group.add(disc);
      discs.push(disc);
    }
    const target = { group, discs, health: 3, active: true, wobble: 0, respawnAt: 0 };
    for (const disc of discs) {
      disc.userData.target = target;
      hitMeshes.push(disc);
    }
    root.add(group);
    targets.push(target);
  }

  function clearParticles() {
    while (particles.length) {
      const points = particles.pop();
      scene.remove(points);
      points.geometry.dispose();
      points.material.dispose();
    }
  }

  function setActive(value) {
    active = value;
    root.visible = value;
    document.getElementById('hit-marker').hidden = true;
    clearParticles();
    if (!value) return;
    score = 0;
    hits = 0;
    destroyed = 0;
    hitMarkerUntil = 0;
    for (const target of targets) {
      target.health = 3;
      target.active = true;
      target.wobble = 0;
      target.respawnAt = 0;
      target.group.rotation.set(0, 0, 0);
    }
    syncHUD();
  }

  function burst(point, color) {
    const count = 12;
    const positions = new Float32Array(count * 3);
    const velocities = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = point.x;
      positions[i * 3 + 1] = point.y;
      positions[i * 3 + 2] = point.z;
      velocities.push(new THREE.Vector3((Math.random() - .5) * 3, Math.random() * 2.4 + .4, (Math.random() - .5) * 3));
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
    const material = new THREE.PointsMaterial({ color, size: .07, transparent: true, opacity: 1, depthWrite: false });
    const points = new THREE.Points(geometry, material);
    points.userData = { velocities, until: performance.now() / 1000 + .48, life: .48 };
    scene.add(points);
    particles.push(points);
  }

  function shoot(origin, direction, weaponId) {
    if (!active) return null;
    raycaster.set(origin, direction);
    const hit = raycaster.intersectObjects(hitMeshes, false).find((item) => item.object.userData.target.active);
    if (!hit) return null;
    const target = hit.object.userData.target;
    const local = target.group.worldToLocal(hit.point.clone());
    const bullseye = Math.hypot(local.x, local.y - TARGET_HEIGHT) <= .15;
    const now = performance.now() / 1000;
    hits++;
    score += bullseye ? 100 : 50;
    target.health -= weaponId === 'awp' ? 3 : 1;
    target.wobble = 1;
    const isDestroyed = target.health <= 0;
    if (isDestroyed) {
      target.active = false;
      target.respawnAt = now + RESPAWN_DELAY;
      destroyed++;
      score += 150;
    }
    hitMarkerUntil = now + .14;
    const marker = document.getElementById('hit-marker');
    marker.hidden = false;
    marker.classList.toggle('kill', isDestroyed);
    burst(hit.point, isDestroyed ? 0xdf3038 : 0xf3c873);
    syncHUD();
    return { point: hit.point.clone(), distance: hit.distance, bullseye, destroyed: isDestroyed };
  }

  function update(dt, now) {
    if (!active) return;
    if (now >= hitMarkerUntil) document.getElementById('hit-marker').hidden = true;
    for (const target of targets) {
      if (target.active) {
        target.wobble = THREE.MathUtils.damp(target.wobble, 0, 8, dt);
        target.group.rotation.z = Math.sin(now * 28) * target.wobble * .055;
      } else {
        target.group.rotation.z = 0;
        target.group.rotation.x = THREE.MathUtils.damp(target.group.rotation.x, -1.35, 7, dt);
        if (now >= target.respawnAt) {
          target.health = 3;
          target.active = true;
          target.wobble = 0;
          target.group.rotation.set(0, 0, 0);
        }
      }
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const points = particles[i];
      const remaining = points.userData.until - now;
      if (remaining <= 0) {
        scene.remove(points);
        points.geometry.dispose();
        points.material.dispose();
        particles.splice(i, 1);
        continue;
      }
      const attribute = points.geometry.getAttribute('position');
      for (let j = 0; j < attribute.count; j++) {
        const velocity = points.userData.velocities[j];
        velocity.y -= 7 * dt;
        attribute.setXYZ(j, attribute.getX(j) + velocity.x * dt, attribute.getY(j) + velocity.y * dt, attribute.getZ(j) + velocity.z * dt);
      }
      attribute.needsUpdate = true;
      points.material.opacity = remaining / points.userData.life;
    }
  }

  buildArena();
  for (const distance of DISTANCES) {
    for (const lane of LANES) addTarget(lane, 8 - distance);
  }
  syncHUD();

  return {
    spawn: new THREE.Vector3(ORIGIN.x, 1.68, ORIGIN.z + 8),
    setActive,
    shoot,
    update,
    isBlocked: (x, z) => Math.abs(x - ORIGIN.x) > 12.2 || z - ORIGIN.z > 9 || z - ORIGIN.z < -74,
    getState: () => ({
      active, score, hits, destroyed,
      activeParticles: particles.length,
      targets: targets.map((target) => ({
        health: target.health,
        active: target.active,
        position: [target.group.position.x, TARGET_HEIGHT, target.group.position.z],
      })),
    }),
  };
}
