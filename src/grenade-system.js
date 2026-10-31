import * as THREE from 'three';
import { addHands } from './gun-models.js';

export const THROWABLE_INFO = {
  smoke: { name: '烟雾弹' },
  fire: { name: '燃烧瓶' },
  grenade: { name: '手雷' },
};
const TYPES = new Set(Object.keys(THROWABLE_INFO));

function cylinder(group, material, radius, length, position, radiusTop = radius) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radius, length, 14), material);
  mesh.position.set(...position);
  group.add(mesh);
  return mesh;
}

function box(group, material, size, position) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  group.add(mesh);
  return mesh;
}

function buildThrowable(type) {
  const group = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x25292a, roughness: .65, metalness: .35 });
  if (type === 'smoke') {
    const body = new THREE.MeshStandardMaterial({ color: 0x536053, roughness: .72, metalness: .25 });
    const band = new THREE.MeshStandardMaterial({ color: 0x3b74a0, roughness: .55, metalness: .3 });
    cylinder(group, body, .09, .24, [0, .12, 0]);
    cylinder(group, band, .092, .055, [0, .13, 0]);
    cylinder(group, dark, .075, .04, [0, .26, 0]);
    box(group, dark, [.035, .08, .025], [0, .3, 0]);
  } else if (type === 'fire') {
    const glass = new THREE.MeshStandardMaterial({ color: 0x70513a, roughness: .3, metalness: .1, transparent: true, opacity: .82 });
    const cloth = new THREE.MeshStandardMaterial({ color: 0xd6c8a9, roughness: .95 });
    cylinder(group, glass, .075, .23, [0, .115, 0], .06);
    cylinder(group, glass, .032, .1, [0, .275, 0]);
    cylinder(group, dark, .035, .025, [0, .33, 0]);
    box(group, cloth, [.045, .14, .018], [0, .38, 0]);
    const rag = new THREE.Mesh(new THREE.ConeGeometry(.04, .1, 7), new THREE.MeshBasicMaterial({ color: 0xff8a24 }));
    rag.position.set(0, .47, 0);
    group.add(rag);
  } else {
    const body = new THREE.MeshStandardMaterial({ color: 0x37483a, roughness: .7, metalness: .3 });
    const bodyMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(.12, 1), body);
    bodyMesh.position.y = .13;
    bodyMesh.scale.set(1, 1.15, 1);
    group.add(bodyMesh);
    cylinder(group, dark, .045, .05, [0, .26, 0]);
    box(group, dark, [.025, .03, .13], [.07, .27, 0]);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.055, .008, 6, 16), dark);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(.09, .24, 0);
    group.add(ring);
  }
  return group;
}

export function buildThrowableView(type) {
  if (!TYPES.has(type)) throw new Error(`未知投掷物 ${type}`);
  const root = new THREE.Group();
  root.add(buildThrowable(type));
  addHands(root, false);
  root.userData.throwableType = type;
  return root;
}

function disposeGroup(group) {
  const geometries = new Set();
  const materials = new Set();
  group.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    if (object.material) {
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

function makeSmoke(position) {
  const group = new THREE.Group();
  group.position.copy(position);
  const puffs = [];
  const geometry = new THREE.SphereGeometry(1, 10, 8);
  for (let i = 0; i < 18; i++) {
    const material = new THREE.MeshStandardMaterial({ color: i % 2 ? 0x8c9698 : 0x6f7b7e, transparent: true, opacity: .2, depthWrite: false, roughness: 1 });
    const mesh = new THREE.Mesh(geometry, material);
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * 1.4;
    mesh.position.set(Math.cos(angle) * radius, .25 + Math.random() * 1.2, Math.sin(angle) * radius);
    const scale = .35 + Math.random() * .55;
    mesh.scale.setScalar(scale);
    group.add(mesh);
    puffs.push({ mesh, base: mesh.position.clone(), scale, phase: Math.random() * 6.28 });
  }
  return { group, type: 'smoke', age: 0, duration: 8, puffs };
}

function makeFire(position) {
  const group = new THREE.Group();
  group.position.copy(position);
  const flames = [];
  const scorch = new THREE.Mesh(new THREE.CircleGeometry(2.2, 28), new THREE.MeshBasicMaterial({ color: 0x17130f, transparent: true, opacity: .55, depthWrite: false }));
  scorch.rotation.x = -Math.PI / 2;
  scorch.position.y = .018;
  group.add(scorch);
  for (let i = 0; i < 20; i++) {
    const material = new THREE.MeshBasicMaterial({ color: i % 3 ? 0xff6d1f : 0xffc238, transparent: true, opacity: .82, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.ConeGeometry(.12 + Math.random() * .09, .55 + Math.random() * .55, 7), material);
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * 1.9;
    mesh.position.set(Math.cos(angle) * radius, .3, Math.sin(angle) * radius);
    group.add(mesh);
    flames.push({ mesh, phase: Math.random() * 6.28 });
  }
  return { group, type: 'fire', age: 0, duration: 5.5, flames };
}

function makeExplosion(position) {
  const group = new THREE.Group();
  group.position.copy(position);
  const flash = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xffb32b, transparent: true, opacity: .95, depthWrite: false }));
  flash.position.y = .65;
  group.add(flash);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1, .045, 8, 36), new THREE.MeshBasicMaterial({ color: 0xffd36a, transparent: true, opacity: .8, depthWrite: false }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = .12;
  group.add(ring);
  return { group, type: 'grenade', age: 0, duration: 1.1, flash, ring };
}

export function createGrenadeSystem({ scene, camera, audio }) {
  const projectiles = [];
  const effects = [];
  const thrown = [];
  const lastThrow = new Map();
  let lastEffect = '';

  function trigger(type, position) {
    const effect = type === 'smoke' ? makeSmoke(position) : type === 'fire' ? makeFire(position) : makeExplosion(position);
    scene.add(effect.group);
    effects.push(effect);
    lastEffect = type;
    audio.playEffect(type);
  }

  return {
    throwGrenade(type) {
      if (!TYPES.has(type)) return false;
      const now = performance.now() / 1000;
      if (now - (lastThrow.get(type) || 0) < .65) return false;
      lastThrow.set(type, now);
      const direction = camera.getWorldDirection(new THREE.Vector3());
      const right = new THREE.Vector3().crossVectors(direction, camera.up).normalize();
      const object = buildThrowable(type);
      object.position.copy(camera.position).addScaledVector(direction, .55).addScaledVector(right, .18);
      object.position.y -= .18;
      scene.add(object);
      const velocity = direction.multiplyScalar(13).add(new THREE.Vector3(0, 4.8, 0)).addScaledVector(right, .7);
      projectiles.push({ object, type, velocity, age: 0, grounded: false });
      thrown.push({ type, at: now });
      return true;
    },
    update(dt) {
      for (let i = projectiles.length - 1; i >= 0; i--) {
        const projectile = projectiles[i];
        projectile.age += dt;
        if (!projectile.grounded) {
          projectile.velocity.y -= 12 * dt;
          projectile.object.position.addScaledVector(projectile.velocity, dt);
          projectile.object.rotation.x += dt * 6;
          projectile.object.rotation.z += dt * 4;
          if (projectile.object.position.y <= .12 && projectile.velocity.y < 0) {
            projectile.object.position.y = .12;
            if (projectile.type === 'fire') {
              scene.remove(projectile.object);
              disposeGroup(projectile.object);
              projectiles.splice(i, 1);
              trigger('fire', projectile.object.position.clone());
              continue;
            }
            projectile.grounded = true;
            projectile.velocity.y *= -.3;
            projectile.velocity.x *= .5;
            projectile.velocity.z *= .5;
          }
        }
        const done = projectile.type === 'smoke' ? projectile.age >= 1.25 : projectile.type === 'grenade' && projectile.age >= 1.55;
        if (done) {
          scene.remove(projectile.object);
          const position = projectile.object.position.clone();
          position.y = Math.max(.05, position.y);
          disposeGroup(projectile.object);
          projectiles.splice(i, 1);
          trigger(projectile.type, position);
        }
      }
      for (let i = effects.length - 1; i >= 0; i--) {
        const effect = effects[i];
        effect.age += dt;
        const progress = effect.age / effect.duration;
        if (effect.type === 'smoke') {
          for (const puff of effect.puffs) {
            puff.mesh.position.y = puff.base.y + effect.age * .16;
            puff.mesh.position.x = puff.base.x + Math.sin(effect.age + puff.phase) * .15;
            puff.mesh.scale.setScalar(puff.scale * (1 + effect.age * .28));
            puff.mesh.material.opacity = Math.max(0, .22 * (1 - progress));
          }
        } else if (effect.type === 'fire') {
          for (const flame of effect.flames) {
            flame.mesh.scale.y = .65 + Math.abs(Math.sin(effect.age * 7 + flame.phase)) * .9;
            flame.mesh.material.opacity = Math.max(0, .85 * (1 - Math.max(0, progress - .7) / .3));
          }
        } else {
          effect.flash.scale.setScalar(.3 + effect.age * 8);
          effect.flash.material.opacity = Math.max(0, 1 - progress);
          effect.ring.scale.setScalar(.3 + effect.age * 9);
          effect.ring.material.opacity = Math.max(0, .8 * (1 - progress));
        }
        if (effect.age >= effect.duration) {
          scene.remove(effect.group);
          disposeGroup(effect.group);
          effects.splice(i, 1);
        }
      }
    },
    getState: () => ({ projectiles: projectiles.length, projectileAges: projectiles.map((projectile) => projectile.age), effects: effects.length, thrown: [...thrown], lastEffect }),
  };
}
