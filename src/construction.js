import * as THREE from 'three';
import { BUILDINGS, SITE, ux, uz } from './layout.js';
import { facadeTextures, roofTexture, skeletonTexture, netTexture, latticeTexture, bannerTexture, acTexture, shipTextures, rand, canvas, tex } from './textures.js';

const ss = THREE.MathUtils.smoothstep;
const lerp = THREE.MathUtils.lerp;
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const lin = (x, a, b) => clamp01((x - a) / (b - a));

// Material whose fragments are clipped to a world-space Y range (min,max)
function clipMat(params, clip, extra = {}) {
  const m = new THREE.MeshStandardMaterial(params);
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uClip = clip;
    if (extra.night) sh.uniforms.uNight = extra.night;
    if (extra.lit) sh.uniforms.uLit = extra.lit;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp=(modelMatrix*vec4(transformed,1.)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vWp; uniform vec2 uClip; ${extra.night ? 'uniform float uNight;' : ''} ${extra.lit ? 'uniform float uLit;' : ''}`)
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif(vWp.y<uClip.x||vWp.y>uClip.y) discard;');
    if (extra.night) sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>\ntotalEmissiveRadiance*=uNight*${extra.lit ? 'uLit' : '1.'}*0.85;`);
  };
  m.customProgramCacheKey = () => 'clip' + (extra.night ? 'n' : '') + (extra.lit ? 'l' : '');
  return m;
}

// Box with facade-mapped sides (u in metres / uLen) and a roof cap. Groups: 0 sides, 1 top, 2 bottom
function facadeBox(w, d, h, uLen) {
  const pos = [], uv = [], nor = [], idx = [];
  const groups = [];
  const quad = (a, b, c, dd, n, uvs) => {
    const o = pos.length / 3;
    pos.push(...a, ...b, ...c, ...dd); nor.push(...n, ...n, ...n, ...n); uv.push(...uvs);
    idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
  };
  const x = w / 2, z = d / 2;
  let s0 = idx.length;
  quad([-x, 0, z], [x, 0, z], [x, h, z], [-x, h, z], [0, 0, 1], [0, 0, w / uLen, 0, w / uLen, 1, 0, 1]);
  quad([x, 0, -z], [-x, 0, -z], [-x, h, -z], [x, h, -z], [0, 0, -1], [0, 0, w / uLen, 0, w / uLen, 1, 0, 1]);
  quad([x, 0, z], [x, 0, -z], [x, h, -z], [x, h, z], [1, 0, 0], [0, 0, d / uLen, 0, d / uLen, 1, 0, 1]);
  quad([-x, 0, -z], [-x, 0, z], [-x, h, z], [-x, h, -z], [-1, 0, 0], [0, 0, d / uLen, 0, d / uLen, 1, 0, 1]);
  groups.push([s0, idx.length - s0, 0]); s0 = idx.length;
  quad([-x, h, z], [x, h, z], [x, h, -z], [-x, h, -z], [0, 1, 0], [0, 0, w / 20, 0, w / 20, d / 20, 0, d / 20]);
  groups.push([s0, idx.length - s0, 1]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  for (const [s, c, m] of groups) g.addGroup(s, c, m);
  return g;
}

const HIDDEN = new THREE.MeshBasicMaterial({ visible: false });
const BAY = { dormC: 14, podium: 22, castle: 30, gate: 30, atrium: 26, dorm: 15, arcade: 26, modern: 30, colorful: 28, gym: 34, stand: 20, ship: 20 };

const shared = {};
function sharedMats() {
  if (shared.ok) return shared;
  shared.ok = true;
  shared.concrete = new THREE.MeshStandardMaterial({ color: 0xb9b5ac, roughness: 0.95 });
  shared.dirt = new THREE.MeshStandardMaterial({ color: 0x7a5a3f, roughness: 1 });
  shared.dirtDark = new THREE.MeshStandardMaterial({ color: 0x5e4430, roughness: 1 });
  shared.yellow = new THREE.MeshStandardMaterial({ color: 0xf0b323, roughness: 0.6, metalness: 0.2 });
  shared.dark = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.7 });
  shared.white = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.6 });
  shared.blue = new THREE.MeshStandardMaterial({ color: 0x2c63b8, roughness: 0.6 });
  shared.red = new THREE.MeshStandardMaterial({ color: 0xc8352b, roughness: 0.6 });
  shared.rebar = new THREE.MeshStandardMaterial({ color: 0x8a5a3a, roughness: 0.6, metalness: 0.4 });
  shared.lamp = new THREE.MeshBasicMaterial({ color: 0xfff1cf, toneMapped: false });
  const lat = latticeTexture();
  shared.mast = new THREE.MeshStandardMaterial({ map: lat, alphaTest: 0.5, side: THREE.DoubleSide, color: 0xffffff, roughness: 0.6 });
  return shared;
}

// ---------------------------------------------------------------- tower crane
function makeCrane(height) {
  const S = sharedMats();
  const g = new THREE.Group();
  const mastGeo = new THREE.BoxGeometry(2, 1, 2); mastGeo.translate(0, 0.5, 0);
  const mast = new THREE.Mesh(mastGeo, S.mast.clone());
  mast.material.map = S.mast.map.clone(); mast.material.map.repeat.set(1, height / 2); mast.material.map.needsUpdate = true;
  mast.scale.y = height; mast.castShadow = true;
  g.add(mast);
  const head = new THREE.Group(); head.position.y = height; g.add(head);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 2.4), S.white); cab.position.set(1.8, 1, 0); head.add(cab);
  const jibL = 50, cjL = 15;
  const jibGeo = new THREE.BoxGeometry(jibL, 1.6, 1.6); jibGeo.translate(jibL / 2, 0, 0);
  const jibMat = S.mast.clone(); jibMat.map = S.mast.map.clone(); jibMat.map.repeat.set(jibL / 1.6, 1); jibMat.map.needsUpdate = true;
  const jib = new THREE.Mesh(jibGeo, jibMat); jib.position.y = 2.6; jib.castShadow = true; head.add(jib);
  const cj = new THREE.Mesh(new THREE.BoxGeometry(cjL, 1.2, 1.4), S.yellow); cj.position.set(-cjL / 2, 2.6, 0); head.add(cj);
  const cw = new THREE.Mesh(new THREE.BoxGeometry(3, 2.4, 2), S.concrete); cw.position.set(-cjL + 1.5, 1.4, 0); head.add(cw);
  const peak = new THREE.Mesh(new THREE.ConeGeometry(1.1, 7, 4), S.yellow); peak.position.y = 6.5; head.add(peak);
  const tie = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 4), S.dark);
  const tieLen = Math.hypot(jibL * 0.6, 6.5); tie.scale.y = tieLen; tie.position.set(jibL * 0.3, 6.6, 0); tie.rotation.z = Math.atan2(jibL * 0.6, 6.5); head.add(tie);
  const trolley = new THREE.Group(); trolley.position.set(30, 2, 0); head.add(trolley);
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 4), S.dark); cable.position.y = -0.5; trolley.add(cable);
  const load = new THREE.Mesh(new THREE.BoxGeometry(5, 0.6, 1.2), S.rebar); trolley.add(load);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), S.lamp); lamp.position.set(0, 0, 0); head.add(lamp);
  const lamp2 = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2a1a, toneMapped: false }));
  lamp2.position.set(jibL, 3.4, 0); head.add(lamp2);
  g.userData = { mast, head, trolley, cable, load, lamps: [lamp, lamp2], height };
  return g;
}

// ---------------------------------------------------------------- excavator
function makeExcavator() {
  const S = sharedMats();
  const g = new THREE.Group();
  const tr = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1, 3.4), S.dark); tr.position.y = 0.5; g.add(tr);
  const body = new THREE.Group(); body.position.y = 1; g.add(body);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2, 2.8), S.yellow); cab.position.set(-0.4, 1, 0); body.add(cab);
  const arm = new THREE.Group(); arm.position.set(1.2, 1.6, 0); body.add(arm);
  const boom = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.5, 0.5), S.yellow); boom.position.x = 2.2; arm.add(boom);
  const stick = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3, 0.4), S.yellow); stick.position.set(4.4, -1.4, 0); arm.add(stick);
  g.castShadow = true;
  g.traverse((o) => { o.castShadow = true; });
  g.userData = { body, arm };
  return g;
}
function makeTruck(color) {
  const S = sharedMats();
  const g = new THREE.Group();
  const bed = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.6, 2.4), new THREE.MeshStandardMaterial({ color, roughness: 0.6 })); bed.position.set(-1, 1.6, 0); g.add(bed);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2, 2.2, 2.4), S.white); cab.position.set(2.6, 1.6, 0); g.add(cab);
  const ch = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.6, 2.2), S.dark); ch.position.set(0.3, 0.6, 0); g.add(ch);
  const hl = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 2), new THREE.MeshBasicMaterial({ color: 0xfff5d0, toneMapped: false })); hl.position.set(3.65, 1.1, 0); g.add(hl);
  g.traverse((o) => { o.castShadow = true; });
  g.userData.hl = hl;
  return g;
}

// ---------------------------------------------------------------- building
function makeShip(p, u) {
  const A = shipTextures();
  const details = new THREE.Group();
  const L = p.w / 2, W = p.d / 2;
  const woodMat = clipMat({ map: A.wood, normalMap: A.woodNormal, normalScale: new THREE.Vector2(1.25, 1.25), roughness: 0.9, metalness: 0.01 }, u.faClip);
  const ribMat = clipMat({ color: 0x513929, roughness: 0.9 }, u.faClip);
  const railMat = clipMat({ color: 0x65472f, roughness: 0.86 }, u.roofClip);
  const mastMat = clipMat({ color: 0x4f3d2d, roughness: 0.82 }, u.roofClip);
  const ropeMat = clipMat({ color: 0x40382d, roughness: 1 }, u.roofClip);
  const sailMat = clipMat({ map: A.sail, side: THREE.DoubleSide, roughness: 0.96, emissive: 0x7d6747, emissiveIntensity: 0.45 }, u.roofClip);
  const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 6);
  const up = new THREE.Vector3(0, 1, 0);
  const beam = (a, b, r, mat, parent = details) => {
    const dir = new THREE.Vector3().subVectors(b, a), len = dir.length();
    const m = new THREE.Mesh(beamGeo, mat);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(up, dir.normalize());
    m.scale.set(r, len, r); parent.add(m);
    return m;
  };

  // A bluff, raked Chinese-junk bow and a rounded stern replace the old pointed boat silhouette.
  const outline = [
    [-1, -0.7], [-0.65, -0.9], [-0.2, -1], [0.35, -0.98], [0.72, -0.9], [0.9, -0.82], [1, -0.75],
    [1, 0.75], [0.9, 0.82], [0.72, 0.9], [0.35, 0.98], [-0.2, 1], [-0.65, 0.9], [-1, 0.7],
  ].map(([x, z]) => {
    const bow = Math.max(0, x), stern = Math.max(0, -x);
    return { x: x * L, z: z * W, top: 7.8 + 2.6 * bow ** 3 + 0.8 * stern ** 2 };
  });
  const levels = [
    { f: 0, w: 0.55, bow: -1.7, stern: 0.84 },
    { f: 0.16, w: 0.78, bow: -1.1, stern: 0.92 },
    { f: 0.45, w: 0.94, bow: -0.55, stern: 0.98 },
    { f: 0.76, w: 1, bow: -0.1, stern: 1 },
    { f: 1, w: 1.015, bow: 0.15, stern: 1.015 },
  ];
  const rings = levels.map((lv) => outline.map((o) => {
    const bow = Math.max(0, o.x / L), stern = o.x < 0 ? lv.stern : 1;
    return new THREE.Vector3(o.x * stern + lv.bow * bow * bow, 0.12 + (o.top - 0.12) * lv.f, o.z * lv.w);
  }));
  const pos = [], uv = [], idx = [], cum = [0];
  for (let i = 1; i < outline.length; i++) cum[i] = cum[i - 1] + Math.hypot(outline[i].x - outline[i - 1].x, outline[i].z - outline[i - 1].z);
  for (let k = 0; k < rings.length - 1; k++) for (let i = 0; i < outline.length; i++) {
    const j = (i + 1) % outline.length;
    const a = rings[k][i], b = rings[k][j], c = rings[k + 1][j], d = rings[k + 1][i];
    const u0 = cum[i] / 14, u1 = (cum[i] + Math.hypot(outline[j].x - outline[i].x, outline[j].z - outline[i].z)) / 14;
    const o = pos.length / 3;
    pos.push(a.x, a.y, a.z, d.x, d.y, d.z, c.x, c.y, c.z, b.x, b.y, b.z);
    uv.push(u0, a.y / 10.4, u0, d.y / 10.4, u1, c.y / 10.4, u1, b.y / 10.4);
    idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
  }
  const hullGeo = new THREE.BufferGeometry();
  hullGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  hullGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  hullGeo.setIndex(idx); hullGeo.computeVertexNormals();
  const hull = new THREE.Mesh(hullGeo, woodMat);

  // Exposed oak ribs follow the changing hull section.
  for (let i = 0; i < outline.length; i++) beam(rings[1][i], rings[4][i], 0.105, ribMat);

  const deckShape = new THREE.Shape();
  outline.forEach((o, i) => (i ? deckShape.lineTo(o.x, o.z) : deckShape.moveTo(o.x, o.z)));
  deckShape.closePath();
  const deckGeo = new THREE.ShapeGeometry(deckShape); deckGeo.rotateX(-Math.PI / 2);
  const deck = new THREE.Mesh(deckGeo, clipMat({ map: A.deck, roughness: 0.9 }, u.roofClip));
  deck.position.y = 7.72; details.add(deck);

  // Continuous timber bulwark rails, with closely spaced upright balusters.
  const posts = [];
  for (let i = 0; i < outline.length; i++) {
    const j = (i + 1) % outline.length, a = rings[4][i], b = rings[4][j];
    const len = a.distanceTo(b), n = Math.max(1, Math.ceil(len / 1.15));
    for (let k = 0; k < n; k++) posts.push({ p: new THREE.Vector3().lerpVectors(a, b, k / n), h: i === 6 ? 1.35 : 1.15 });
    beam(a.clone().add(new THREE.Vector3(0, 1.08, 0)), b.clone().add(new THREE.Vector3(0, 1.08, 0)), 0.085, railMat);
    beam(a.clone().add(new THREE.Vector3(0, 0.47, 0)), b.clone().add(new THREE.Vector3(0, 0.47, 0)), 0.052, railMat);
  }
  const postMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 1, 0.16), railMat, posts.length);
  posts.forEach((o, i) => postMesh.setMatrixAt(i, new THREE.Matrix4().compose(
    o.p.clone().add(new THREE.Vector3(0, o.h / 2, 0)), new THREE.Quaternion(), new THREE.Vector3(1, o.h, 1))));
  details.add(postMesh);

  // Dark recessed entrance and its raked timber jambs on the bow.
  const bowStops = rings.map((r) => ({ x: r[6].x, y: r[6].y }));
  const bowX = (y) => {
    for (let i = 0; i < bowStops.length - 1; i++) {
      const a = bowStops[i], b = bowStops[i + 1];
      if (y <= b.y) return lerp(a.x, b.x, clamp01((y - a.y) / (b.y - a.y)));
    }
    return bowStops[bowStops.length - 1].x;
  };
  const bowQuad = (z0, z1, y0, y1, mat, offset = 0.05) => {
    const ys = [y0, ...bowStops.map((s) => s.y).filter((y) => y > y0 && y < y1), y1];
    const pp = [], uu = [], ii = [];
    for (let k = 0; k < ys.length - 1; k++) {
      const a = ys[k], b = ys[k + 1], o = pp.length / 3;
      pp.push(bowX(a) + offset, a, z0, bowX(b) + offset, b, z0, bowX(b) + offset, b, z1, bowX(a) + offset, a, z1);
      uu.push(0, (a - y0) / (y1 - y0), 0, (b - y0) / (y1 - y0), 1, (b - y0) / (y1 - y0), 1, (a - y0) / (y1 - y0));
      ii.push(o, o + 1, o + 2, o, o + 2, o + 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uu, 2));
    geo.setIndex(ii); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat); details.add(m); return m;
  };
  const portalMat = clipMat({ color: 0x1c2422, side: THREE.DoubleSide, roughness: 1 }, u.faClip);
  bowQuad(-1.75, 1.75, 0.3, 4.15, portalMat, 0.035);
  for (const s of [-1, 1]) beam(
    new THREE.Vector3(bowX(0.3) + 0.16, 0.3, s * 1.85),
    new THREE.Vector3(bowX(4.2) + 0.16, 4.2, s * 1.28), 0.18, ribMat);
  beam(new THREE.Vector3(bowX(4.2) + 0.16, 4.2, -1.35), new THREE.Vector3(bowX(4.2) + 0.16, 4.2, 1.35), 0.16, ribMat);
  const dragonMat = clipMat({ map: A.dragon, emissiveMap: A.dragon, emissive: 0xffffff, emissiveIntensity: 0.28, transparent: true, alphaTest: 0.04, side: THREE.DoubleSide, roughness: 0.88, polygonOffset: true, polygonOffsetFactor: -4 }, u.faClip);
  bowQuad(-2.25, 2.25, 5.15, 9.45, dragonMat, 0.065);

  // Small pale-rimmed portholes visible on the real hull beside the bow.
  const rimMat = clipMat({ color: 0xd2c5a7, roughness: 0.62, metalness: 0.18 }, u.faClip);
  const glassMat = clipMat({ color: 0x213336, roughness: 0.3, metalness: 0.25, side: THREE.DoubleSide }, u.faClip);
  for (const s of [-1, 1]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.075, 8, 24), rimMat);
    rim.position.set(L * 0.5, 5.55, s * (W * 0.93 + 0.08)); details.add(rim);
    const glass = new THREE.Mesh(new THREE.CircleGeometry(0.3, 24), glassMat);
    glass.position.copy(rim.position); glass.position.z += s * 0.015;
    if (s < 0) glass.rotation.y = Math.PI; details.add(glass);
  }

  // Deck hatch and a compact capstan reward the closer aerial views.
  const hatch = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.22, 1.9), railMat);
  hatch.position.set(-L * 0.3, 7.84, 0); details.add(hatch);
  for (let k = 0; k < 9; k++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 0.11), mastMat);
    slat.position.set(-L * 0.3, 8, -0.78 + k * 0.195); details.add(slat);
  }
  const capstan = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.48, 1.05, 10), railMat);
  capstan.position.set(-L * 0.72, 8.25, 0); details.add(capstan);
  beam(new THREE.Vector3(-L * 0.72 - 0.85, 8.72, 0), new THREE.Vector3(-L * 0.72 + 0.85, 8.72, 0), 0.065, mastMat);
  beam(new THREE.Vector3(-L * 0.72, 8.72, -0.85), new THREE.Vector3(-L * 0.72, 8.72, 0.85), 0.065, mastMat);

  // Three lug sails: stitched cloth, curved belly, full-width bamboo battens and working rigging.
  const sailPoint = (cx, base, width, height, belly, u0, v) => {
    const taper = 0.9 + 0.1 * v;
    return new THREE.Vector3(
      cx + belly * Math.sin(Math.PI * u0) * Math.sin(Math.PI * v),
      base + v * height + 0.16 * Math.sin(Math.PI * u0) * Math.sin(Math.PI * v),
      (u0 - 0.5) * width * taper);
  };
  const addSail = (cx, base, width, height, belly, battens) => {
    const pos2 = [], uv2 = [], idx2 = [], NU = 12, NV = 14;
    for (let v = 0; v <= NV; v++) for (let i = 0; i <= NU; i++) {
      const pt = sailPoint(cx, base, width, height, belly, i / NU, v / NV);
      pos2.push(pt.x, pt.y, pt.z); uv2.push(i / NU, v / NV);
    }
    for (let v = 0; v < NV; v++) for (let i = 0; i < NU; i++) {
      const a = v * (NU + 1) + i, b = a + 1, d = a + NU + 1, c = d + 1;
      idx2.push(a, b, c, a, c, d);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos2, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv2, 2));
    geo.setIndex(idx2); geo.computeVertexNormals();
    details.add(new THREE.Mesh(geo, sailMat));
    for (let k = 0; k < battens; k++) {
      const v = k / (battens - 1), pts = [];
      for (let i = 0; i <= 8; i++) pts.push(sailPoint(cx + 0.025, base, width, height, belly, i / 8, v));
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, k === 0 || k === battens - 1 ? 0.085 : 0.045, 5, false), mastMat);
      details.add(tube);
    }
    for (const u0 of [0, 1]) {
      const pts = [];
      for (let i = 0; i <= 10; i++) pts.push(sailPoint(cx + 0.02, base, width, height, belly, u0, i / 10));
      details.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.028, 5, false), ropeMat));
    }
  };
  const mastDefs = [
    { x: -L * 0.43, top: 23.4, base: 10.9, width: 7.7, height: 8.8, belly: 0.48, battens: 7 },
    { x: -L * 0.08, top: 30, base: 11.5, width: 11.2, height: 13.4, belly: 0.78, battens: 9 },
    { x: L * 0.39, top: 25.7, base: 10.9, width: 8.8, height: 10.3, belly: 0.58, battens: 8 },
  ];
  for (const m of mastDefs) {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.25, m.top - 7.65, 9), mastMat);
    mast.position.set(m.x - 0.12, (m.top + 7.65) / 2, 0); details.add(mast);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.46, 0.42, 8), mastMat);
    cap.position.set(m.x - 0.12, m.top - 0.35, 0); details.add(cap);
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 0.3, 8), railMat);
    collar.position.set(m.x - 0.12, 7.87, 0); details.add(collar);
    addSail(m.x, m.base, m.width, m.height, m.belly, m.battens);
    const mastTop = new THREE.Vector3(m.x - 0.12, m.top - 0.45, 0);
    for (const side of [-1, 1]) {
      beam(mastTop, sailPoint(m.x, m.base, m.width, m.height, m.belly, side < 0 ? 0 : 1, 1), 0.025, ropeMat);
      beam(mastTop, new THREE.Vector3(L * 0.84, 8.75, side * W * 0.56), 0.026, ropeMat);
      beam(mastTop, new THREE.Vector3(-L * 0.88, 8.55, side * W * 0.5), 0.024, ropeMat);
    }
  }

  details.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { hull, details };
}

function buildPart(b, p, U, root) {
  const S = sharedMats();
  const H = b.height;
  const grp = new THREE.Group();
  grp.position.set(p.cx, 0, p.cz);
  grp.rotation.y = (-p.rot * Math.PI) / 180;
  root.add(grp);
  const u = b.U;
  const tex = facadeTextures(b.style, b.floors, b.gf / H, !!b.glass && p === b.parts[0], b.tint);
  const fMat = clipMat({ map: tex.map, emissiveMap: tex.emissive, emissive: 0xffffff, roughness: 0.82, metalness: 0.02, normalMap: tex.normal, normalScale: new THREE.Vector2(1, 1) }, u.faClip, { night: U.night, lit: u.lit });
  const rMat = clipMat({ map: roofTexture(b.style === 'gym' ? 'gym' : b.style === 'podium' ? 'deck' : 'flat'), roughness: 0.9 }, u.roofClip);
  let shell;
  if (b.style === 'ship') {
    const ship = makeShip(p, u);
    shell = ship.hull;
    grp.add(ship.details);
  } else if (b.style === 'stand') {
    const sh = new THREE.Shape(); sh.moveTo(-p.w / 2, 0); sh.lineTo(p.w / 2, 0); sh.lineTo(p.w / 2, 2); sh.lineTo(-p.w / 2, H); sh.closePath();
    const geo = new THREE.ExtrudeGeometry(sh, { depth: p.d, bevelEnabled: false }); geo.translate(0, 0, -p.d / 2);
    shell = new THREE.Mesh(geo, clipMat({ color: 0xbfc4c8, roughness: 0.8 }, u.faClip));
    const roof = new THREE.Mesh(new THREE.BoxGeometry(p.w * 0.9, 0.4, p.d), clipMat({ color: 0xf3f3f3, roughness: 0.5 }, u.roofClip));
    roof.position.set(-p.w * 0.1, H + 4, 0); roof.rotation.z = -0.12; grp.add(roof);
    if (b.id === 'stand_e') grp.rotation.y += Math.PI;
  } else if (b.id === 'corridor') {
    // 风雨长廊仅二楼连通：一楼采用真实拱洞，保留贯穿视线与地面通道。
    shell = new THREE.Group();
    const upperGeo = facadeBox(p.w, p.d, b.fh, BAY.arcade);
    const uv = upperGeo.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setY(i, 0.5 + uv.getY(i) * 0.5);
    upperGeo.translate(0, b.gf, 0);
    const upper = new THREE.Mesh(upperGeo, [fMat, rMat]);
    shell.add(upper);

    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(p.w + 0.4, 0.35, p.d + 0.4),
      clipMat({ color: 0xd8bd94, roughness: 0.85 }, u.faClip)
    );
    slab.position.y = b.gf;
    shell.add(slab);

    const arcadeShape = new THREE.Shape();
    arcadeShape.moveTo(-p.w / 2, 0);
    arcadeShape.lineTo(p.w / 2, 0);
    arcadeShape.lineTo(p.w / 2, b.gf);
    arcadeShape.lineTo(-p.w / 2, b.gf);
    arcadeShape.closePath();
    const openings = [
      { x: 0, r: 4.25, spring: 0.2 },
      ...[-1, 1].flatMap((side) => [8.7, 19.0, 29.3].map((x) => ({ x: x * side, r: 2.85, spring: 1.15 })))
    ];
    grp.userData.arcadeOpenings = openings;
    for (const { x, r, spring } of openings) {
      const opening = new THREE.Path();
      opening.moveTo(x - r, 0);
      opening.lineTo(x - r, spring);
      opening.absarc(x, spring, r, Math.PI, 0, true);
      opening.lineTo(x + r, 0);
      opening.closePath();
      arcadeShape.holes.push(opening);
    }
    const stone = clipMat({ color: 0xb99a8d, roughness: 0.88 }, u.faClip);
    for (const side of [-1, 1]) {
      const wallGeo = new THREE.ExtrudeGeometry(arcadeShape, { depth: 0.75, bevelEnabled: false, curveSegments: 16 });
      wallGeo.translate(0, 0, -0.375);
      const wall = new THREE.Mesh(wallGeo, stone);
      wall.position.z = side * (p.d / 2 - 0.375);
      shell.add(wall);
    }
    shell.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  } else {
    shell = new THREE.Mesh(facadeBox(p.w, p.d, H, BAY[b.style] || 30), [fMat, rMat]);
  }
  shell.castShadow = true; shell.receiveShadow = true;
  grp.add(shell);

  if (b.id === 'canteen') {
    // 食堂入口与立面细部：石材基座、壁柱、门廊、牌匾和分层檐口。
    const trim = clipMat({ color: 0xead6ae, roughness: 0.82 }, u.faClip);
    const pink = clipMat({ color: 0xa98a80, roughness: 0.86 }, u.faClip);
    const glass = clipMat({ color: 0x294553, roughness: 0.22, metalness: 0.35 }, u.faClip);
    const addBox = (w, h, d, x, y, z, mat = trim) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; grp.add(mesh);
      return mesh;
    };
    addBox(p.w + 0.7, 0.8, p.d + 0.7, 0, 0.4, 0, pink);
    addBox(p.w + 0.8, 0.45, p.d + 0.8, 0, b.gf - 0.15, 0);
    addBox(p.w + 1.1, 0.7, p.d + 1.1, 0, H - 0.35, 0);
    const bay = p.w / 8;
    for (let i = 0; i <= 8; i++) for (const side of [-1, 1]) {
      addBox(0.55, H - b.gf - 0.6, 0.35, -p.w / 2 + i * bay, b.gf + (H - b.gf) / 2, side * (p.d / 2 + 0.16));
    }
    const front = p.d / 2;
    addBox(8.2, 3.7, 0.22, 0, 2.05, front + 0.16, glass);
    addBox(12.2, 0.45, 4.1, 0, 4.35, front + 1.85);
    addBox(12.8, 0.22, 4.5, 0, 4.67, front + 1.85);
    for (const x of [-4.6, -1.55, 1.55, 4.6]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.36, 4.0, 12), trim);
      col.position.set(x, 2.0, front + 3.25); col.castShadow = true; grp.add(col);
      addBox(0.85, 0.28, 0.85, x, 0.14, front + 3.25, pink);
    }
    for (let i = 0; i < 3; i++) addBox(13.2 - i * 0.7, 0.14, 1.0, 0, 0.07 + i * 0.14, front + 4.2 - i * 0.65, pink);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(5.8, 0.9),
      clipMat({ map: bannerTexture('学生食堂', '#584634', '#f1ddb3'), roughness: 0.65 }, u.faClip)
    );
    sign.position.set(0, 5.12, front + 0.25); grp.add(sign);
  }

  if (b.id === 'corridor') {
    // 按实景细化中央主拱、连续拱窗、突出门楼和三角山花。
    const trim = clipMat({ color: 0xd8b79f, roughness: 0.82 }, u.faClip);
    const cream = clipMat({ color: 0xead6ae, roughness: 0.84 }, u.faClip);
    const inset = clipMat({ color: 0xd8c39c, roughness: 0.86, side: THREE.DoubleSide }, u.faClip);
    const glass = clipMat({ color: 0x263e49, roughness: 0.24, metalness: 0.25, side: THREE.DoubleSide }, u.faClip);
    const bronze = clipMat({ color: 0x8d7351, roughness: 0.5, metalness: 0.35 }, u.faClip);
    const bay = p.w / 8, openings = grp.userData.arcadeOpenings;
    const addArchWindow = (x, y, z, r, rectH, frame = cream) => {
      const shape = new THREE.Shape();
      shape.moveTo(-r, 0); shape.lineTo(r, 0); shape.lineTo(r, rectH);
      shape.absarc(0, rectH, r, 0, Math.PI, false); shape.closePath();
      const pane = new THREE.Mesh(new THREE.ShapeGeometry(shape, 24), glass);
      pane.position.set(x, y, z); grp.add(pane);
      const face = Math.sign(z) || 1;
      const arch = new THREE.Mesh(new THREE.TorusGeometry(r + 0.1, 0.13, 7, 28, Math.PI), frame);
      arch.position.set(x, y + rectH, z + face * 0.025); grp.add(arch);
      for (const sx of [-1, 1]) {
        const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.22, rectH, 0.18), frame);
        jamb.position.set(x + sx * (r + 0.1), y + rectH / 2, z + face * 0.025); grp.add(jamb);
      }
    };
    for (const side of [-1, 1]) {
      const z = side * (p.d / 2 + 0.12);
      for (const [y, h, w] of [[b.gf + 0.02, 0.34, 0.5], [H - 0.18, 0.4, 0.58]]) {
        const band = new THREE.Mesh(new THREE.BoxGeometry(p.w + w, h, w), cream);
        band.position.set(0, y, z); grp.add(band);
      }
      for (let i = 0; i < 8; i++) {
        const x = -p.w / 2 + (i + 0.5) * bay;
        const panel = new THREE.Mesh(new THREE.BoxGeometry(bay - 0.12, b.fh - 0.3, 0.16), cream);
        panel.position.set(x, b.gf + b.fh / 2, side * (p.d / 2 + 0.1)); grp.add(panel);
        addArchWindow(x, b.gf + 0.72, side * (p.d / 2 + 0.21), 1.02, 0.72);
      }
      for (let i = 0; i <= 8; i++) {
        const pilaster = new THREE.Mesh(new THREE.BoxGeometry(0.32, b.fh - 0.25, 0.26), cream);
        pilaster.position.set(-p.w / 2 + i * bay, b.gf + b.fh / 2, z); grp.add(pilaster);
      }
      for (const { x, r, spring } of openings) {
        const arch = new THREE.Mesh(new THREE.TorusGeometry(r + 0.12, r > 4 ? 0.24 : 0.17, 8, 32, Math.PI), trim);
        arch.position.set(x, spring, side * (p.d / 2 + 0.05)); grp.add(arch);
        for (const sx of [-1, 1]) {
          const jamb = new THREE.Mesh(new THREE.BoxGeometry(r > 4 ? 0.46 : 0.3, spring, 0.34), trim);
          jamb.position.set(x + sx * (r + 0.12), spring / 2, side * (p.d / 2 + 0.05)); grp.add(jamb);
        }
      }
      for (let x = -p.w / 2 + 0.7; x < p.w / 2; x += 1.55) {
        const dentil = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, 0.42), trim);
        dentil.position.set(x, b.gf - 0.3, side * (p.d / 2 + 0.16)); grp.add(dentil);
      }
      const portal = new THREE.Mesh(new THREE.BoxGeometry(13.6, b.fh + 1.1, 0.82), cream);
      portal.position.set(0, b.gf + (b.fh + 1.1) / 2, side * (p.d / 2 + 0.5)); grp.add(portal);
      addArchWindow(0, b.gf + 0.38, side * (p.d / 2 + 0.94), 1.75, 0.72);
      for (const x of [-0.6, 0.6]) {
        const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.09, 2.05, 0.1), bronze);
        mullion.position.set(x, b.gf + 1.35, side * (p.d / 2 + 1.0)); grp.add(mullion);
      }
      const transom = new THREE.Mesh(new THREE.BoxGeometry(3.35, 0.09, 0.1), bronze);
      transom.position.set(0, b.gf + 1.05, side * (p.d / 2 + 1.0)); grp.add(transom);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(10.2, 0.18, 0.3), cream);
      rail.position.set(0, b.gf + 0.45, side * (p.d / 2 + 1.02)); grp.add(rail);
      for (let x = -4.8; x <= 4.8; x += 0.8) {
        const baluster = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.72, 0.2), cream);
        baluster.position.set(x, b.gf + 0.08, side * (p.d / 2 + 1.02)); grp.add(baluster);
      }
      const pedimentShape = new THREE.Shape();
      pedimentShape.moveTo(-7.1, 0); pedimentShape.lineTo(7.1, 0); pedimentShape.lineTo(0, 2.35); pedimentShape.closePath();
      const pediment = new THREE.Mesh(new THREE.ExtrudeGeometry(pedimentShape, { depth: 0.82, bevelEnabled: false }), cream);
      pediment.position.set(0, H + 1.0, side * (p.d / 2 + 0.5) - 0.41); grp.add(pediment);
      const innerShape = new THREE.Shape();
      innerShape.moveTo(-5.85, 0); innerShape.lineTo(5.85, 0); innerShape.lineTo(0, 1.78); innerShape.closePath();
      const inner = new THREE.Mesh(new THREE.ShapeGeometry(innerShape), inset);
      inner.position.set(0, H + 1.27, side * (p.d / 2 + 0.96)); grp.add(inner);
    }
    grp.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  }

  // architectural relief for the castle complex: belt course, cornice, projecting pilasters, parapet merlons
  if (['castle', 'gate', 'atrium'].includes(b.style)) {
    const dm = clipMat({ color: 0xe9d5ab, roughness: 0.85 }, u.faClip);
    const pinkM = clipMat({ color: 0xa98a80, roughness: 0.8 }, u.faClip);
    if (b.style !== 'gate') {
      const belt = new THREE.Mesh(new THREE.BoxGeometry(p.w + 0.9, 0.7, p.d + 0.9), dm); belt.position.y = b.gf - 0.1; belt.castShadow = true; grp.add(belt);
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(p.w + 0.5, 0.9, p.d + 0.5), pinkM); plinth.position.y = 0.45; grp.add(plinth);
    }
    const corn = new THREE.Mesh(new THREE.BoxGeometry(p.w + 1.3, 0.8, p.d + 1.3), dm); corn.position.y = H - 0.5; corn.castShadow = true; grp.add(corn);
    const corn2 = new THREE.Mesh(new THREE.BoxGeometry(p.w + 0.8, 0.35, p.d + 0.8), dm); corn2.position.y = H - 1.2; grp.add(corn2);
    const bay = (BAY[b.style] || 30) / 4, ph2 = H - b.gf - 0.3;
    const pg = new THREE.BoxGeometry(1.0, ph2, 0.45); pg.translate(0, b.gf + ph2 / 2, 0);
    const pil = [];
    for (let x = -p.w / 2; x <= p.w / 2 + 0.01; x += bay) {
      const inPortal = b.style === 'gate' && Math.abs(x) < p.w * 0.36 + 1;
      if (!inPortal) pil.push([x, p.d / 2 + 0.2, 0]);
      pil.push([x, -p.d / 2 - 0.2, 0]);
    }
    for (let z = -p.d / 2; z <= p.d / 2 + 0.01; z += bay) pil.push([p.w / 2 + 0.2, z, Math.PI / 2], [-p.w / 2 - 0.2, z, Math.PI / 2]);
    const pim = new THREE.InstancedMesh(pg, dm, pil.length);
    const q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
    pil.forEach(([x, z, r], i) => pim.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r), one)));
    pim.castShadow = true; grp.add(pim);
  }

  // projecting stone window sills and lintels give the flat facade real depth up close
  if (['castle', 'gate', 'atrium'].includes(b.style) && !b.glass) {
    const bay = (BAY[b.style] || 30) / 4;
    const winW = Math.min(2.4, bay * 0.21 + 0.55);
    const sm = [], lm = [];
    const push = (arr, x, y, z, sx, sz) => arr.push(new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(sx, 1, sz)));
    const faces = [[p.w, 'z', 1], [p.w, 'z', -1], [p.d, 'x', 1], [p.d, 'x', -1]];
    for (const [len, axis, sign] of faces) {
      const n = Math.ceil(len / bay);
      for (let i = 1; i < b.floors; i++) {
        const ys = b.gf + (i - 0.8) * b.fh - 0.09;
        const yt = b.gf + (i - 0.2) * b.fh + 0.07;
        for (let j = 0; j < n; j++) for (const f of [0.315, 0.655]) {
          const t = -len / 2 + (j + f) * bay;
          if (Math.abs(t) > len / 2 - 0.8) continue;
          if (axis === 'z') {
            push(sm, t, ys, sign * (p.d / 2 + 0.17), winW, 0.36);
            push(lm, t, yt, sign * (p.d / 2 + 0.15), winW + 0.35, 0.3);
          } else {
            push(sm, sign * (p.w / 2 + 0.17), ys, t, 0.36, winW);
            push(lm, sign * (p.w / 2 + 0.15), yt, t, 0.3, winW + 0.35);
          }
        }
      }
    }
    const sillMat = clipMat({ color: 0xe3cda2, roughness: 0.82 }, u.faClip);
    const sillGeo = new THREE.BoxGeometry(1, 0.15, 1);
    for (const list of [sm, lm]) {
      const im = new THREE.InstancedMesh(sillGeo, sillMat, list.length);
      list.forEach((m, i) => im.setMatrixAt(i, m));
      im.castShadow = true; grp.add(im);
    }
  }

  // dormitory facade relief: protruding charcoal piers, stone sills, AC boxes and corner downpipes
  if (b.style === 'dormC') {
    const bay = (BAY.dormC || 14) / 4;
    const q = new THREE.Quaternion();
    const mat4 = (x, y, z, sx, sy, sz) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz));
    const sills = [], acs = [];
    const addWin = (len, axis, sign) => {
      const n = Math.ceil(len / bay);
      for (let i = 1; i < b.floors; i++) {
        const ys = b.gf + (i - 0.77) * b.fh - 0.06;
        for (let j = 0; j < n; j++) {
          const c0 = -len / 2 + (j + 0.5) * bay;
          for (const off of [-0.57, 0.57]) {
            const t = c0 + off;
            if (Math.abs(t) > len / 2 - 0.5) continue;
            if (axis === 'z') sills.push(mat4(t, ys, sign * (p.d / 2 + 0.18), 1.22, 0.1, 0.24));
            else sills.push(mat4(sign * (p.w / 2 + 0.18), ys, t, 0.24, 0.1, 1.22));
          }
          if (i >= 2 && i <= 5 && j % 2 === 0) {
            const t = c0 + 0.57;
            if (Math.abs(t) < len / 2 - 0.7) {
              const ya = ys - 0.5;
              if (axis === 'z') acs.push(mat4(t, ya, sign * (p.d / 2 + 0.48), 0.72, 0.5, 0.42));
              else acs.push(mat4(sign * (p.w / 2 + 0.48), ya, t, 0.42, 0.5, 0.72));
            }
          }
        }
      }
    };
    addWin(p.w, 'z', 1); addWin(p.w, 'z', -1); addWin(p.d, 'x', 1); addWin(p.d, 'x', -1);
    const sillMat = clipMat({ color: 0xb9c3bf, roughness: 0.85 }, u.faClip);
    const sill = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), sillMat, sills.length);
    sills.forEach((m, i) => sill.setMatrixAt(i, m));
    sill.castShadow = true; grp.add(sill);
    const acMat = clipMat({ map: acTexture(), roughness: 0.8 }, u.faClip);
    const ac = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), acMat, acs.length);
    acs.forEach((m, i) => ac.setMatrixAt(i, m));
    ac.castShadow = true; grp.add(ac);
    const dpGeo = new THREE.CylinderGeometry(0.1, 0.12, 1, 6); dpGeo.translate(0, 0.5, 0);
    const dpMat = clipMat({ color: 0x4f5658, roughness: 0.7 }, u.faClip);
    const dpm = new THREE.InstancedMesh(dpGeo, dpMat, 4);
    let di = 0;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) dpm.setMatrixAt(di++, mat4(sx * (p.w / 2 - 0.3), 0.1, sz * (p.d / 2 + 0.16), 1, H - 0.4, 1));
    dpm.castShadow = true; grp.add(dpm);
  }

  // one entrance porch and a rooftop solar water heater per dorm block
  if (b.style === 'dormC' && p === b.parts[0]) {
    const sgn = b.doorFace || 1;
    const faceZ = (off) => sgn * (p.d / 2 + off);
    const glassM = clipMat({ color: 0x263840, roughness: 0.2, metalness: 0.4, emissive: 0x2a1a0a, emissiveIntensity: 0.55 }, u.faClip);
    const lightM = clipMat({ color: 0xdfe3df, roughness: 0.7 }, u.faClip);
    const door = new THREE.Mesh(new THREE.BoxGeometry(2.9, 3.2, 0.12), glassM);
    door.position.set(0, 1.75, faceZ(0.07)); grp.add(door);
    for (const sx of [-1, 1]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.4, 0.12), lightM);
      bar.position.set(sx * 1.6, 1.8, faceZ(0.14)); grp.add(bar);
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.14, 3.85, 0.14), lightM);
      col.position.set(sx * 2.2, 1.93, faceZ(1.55)); grp.add(col);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), S.lamp);
      lamp.position.set(sx * 1.85, 2.95, faceZ(0.18)); grp.add(lamp);
    }
    const topBar = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.12, 0.12), lightM);
    topBar.position.set(0, 3.46, faceZ(0.14)); grp.add(topBar);
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.22, 1.9), lightM);
    canopy.position.set(0, 3.95, faceZ(0.85)); canopy.castShadow = true; grp.add(canopy);
    for (const [w, h, z] of [[6.0, 0.16, 1.35], [5.4, 0.32, 0.65]]) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.9), lightM);
      step.position.set(0, h / 2, faceZ(z)); step.receiveShadow = true; grp.add(step);
    }
    const num = (b.id.match(/\d+/) || ['1'])[0];
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 0.34), clipMat({ map: bannerTexture(`${num}号楼`, '#3f4648', '#f0e0bc'), roughness: 0.6 }, u.faClip));
    plaque.position.set(0, 4.55, faceZ(0.08));
    if (sgn < 0) plaque.rotation.y = Math.PI;
    grp.add(plaque);

    const solar = new THREE.Group(); grp.add(solar);
    const panelM = clipMat({ color: 0x2d4358, roughness: 0.34, metalness: 0.5 }, u.roofClip);
    const tankM = clipMat({ color: 0x9aa19f, roughness: 0.65 }, u.roofClip);
    for (const sx of [-1, 1]) {
      const pan = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 1.35), panelM);
      pan.position.set(sx * 1.35, H + 1.55, -0.35); pan.rotation.x = -0.36; solar.add(pan);
    }
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 2.6, 12), tankM);
    tank.rotation.z = Math.PI / 2; tank.position.set(0, H + 1.85, -1.35); solar.add(tank);
  }

  // slender mullions and transoms over the glass curtain wall
  if (b.glass) {
    const mm = clipMat({ color: 0xdde8ef, roughness: 0.25, metalness: 0.55 }, u.faClip);
    const list = [];
    const push = (x, y, z, sx, sy, sz) => list.push(new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz)));
    for (const sign of [1, -1]) {
      for (let t = -p.w / 2 + 1.2; t <= p.w / 2 - 1.2; t += 2.4) push(t, H / 2, sign * (p.d / 2 + 0.12), 0.13, H - 0.3, 0.2);
      for (let t = -p.d / 2 + 1.2; t <= p.d / 2 - 1.2; t += 2.4) push(sign * (p.w / 2 + 0.12), H / 2, t, 0.2, H - 0.3, 0.13);
      for (let i = 0; i < b.floors; i++) {
        const y = b.gf + i * b.fh;
        push(0, y, sign * (p.d / 2 + 0.13), p.w, 0.13, 0.22);
        push(sign * (p.w / 2 + 0.13), y, 0, 0.22, 0.13, p.d);
      }
    }
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mm, list.length);
    list.forEach((m, i) => im.setMatrixAt(i, m));
    grp.add(im);
  }

  // dark metal frame around each glazed dorm link
  if (b.link) {
    const fm = clipMat({ color: 0x3f4648, roughness: 0.5, metalness: 0.3 }, u.faClip);
    const top = new THREE.Mesh(new THREE.BoxGeometry(p.w + 0.5, 0.35, p.d + 0.5), fm);
    top.position.y = H - 0.18; top.castShadow = true; grp.add(top);
    const bot = new THREE.Mesh(new THREE.BoxGeometry(p.w + 0.4, 0.4, p.d + 0.4), fm);
    bot.position.y = 0.2; grp.add(bot);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.32, H, 0.32), fm);
      col.position.set(sx * (p.w / 2), H / 2, sz * (p.d / 2)); grp.add(col);
    }
  }

  // parapet / crenellations
  if (!['ship', 'stand', 'gym'].includes(b.style)) {
    const cr = new THREE.Group(); cr.position.y = H; grp.add(cr);
    const pm = clipMat({ color: (b.style === 'dormC' || b.link) ? 0x4a5052 : 0xe6d3ad, roughness: 0.9 }, u.roofClip);
    const ph = b.crenel ? 1.2 : 1.1;
    const band = new THREE.Mesh(new THREE.BoxGeometry(p.w + 0.6, ph, p.d + 0.6), pm);
    band.position.y = ph / 2;
    cr.add(band);
    if (b.style === 'dormC') {
      // light roof railing posts seen on the real C-shaped dorm
      const postGeo = new THREE.BoxGeometry(0.55, 0.62, 0.55);
      const postMat = clipMat({ color: 0xd2d8d4, roughness: 0.85 }, u.roofClip);
      const pts = [];
      for (let x = -p.w / 2 + 0.8; x <= p.w / 2 - 0.8; x += 2.7) pts.push([x, -p.d / 2, 0], [x, p.d / 2, 0]);
      for (let z = -p.d / 2 + 0.8; z <= p.d / 2 - 0.8; z += 2.7) pts.push([-p.w / 2, z, 1], [p.w / 2, z, 1]);
      const im = new THREE.InstancedMesh(postGeo, postMat, pts.length);
      const q = new THREE.Quaternion();
      pts.forEach(([x, z, r], i) => im.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(x, ph + 0.3, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r * Math.PI / 2), new THREE.Vector3(1, 1, 1))));
      im.castShadow = true; cr.add(im);
    }
    if (!b.crenel && ['castle', 'gate'].includes(b.style)) {
      const mg = new THREE.BoxGeometry(1.1, 1.2, 0.7);
      const per = [];
      for (let x = -p.w / 2 + 1; x <= p.w / 2 - 1; x += 2.4) per.push([x, -p.d / 2, 0], [x, p.d / 2, 0]);
      for (let z = -p.d / 2 + 1; z <= p.d / 2 - 1; z += 2.4) per.push([-p.w / 2, z, 1], [p.w / 2, z, 1]);
      const im = new THREE.InstancedMesh(mg, pm, per.length);
      const q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
      per.forEach(([x, z, r], i) => im.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(x, ph + 0.6, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r * Math.PI / 2), one)));
      im.castShadow = true; cr.add(im);
    }
    if (b.crenel) {
      const mg = new THREE.BoxGeometry(1.3, 1.6, 1.3);
      const per = [];
      const nx = Math.max(2, Math.round(p.w / 2.6)), nz = Math.max(2, Math.round(p.d / 2.6));
      for (let i = 0; i <= nx; i++) { const x = -p.w / 2 + (i / nx) * p.w; per.push([x, -p.d / 2], [x, p.d / 2]); }
      for (let i = 1; i < nz; i++) { const z = -p.d / 2 + (i / nz) * p.d; per.push([-p.w / 2, z], [p.w / 2, z]); }
      const im = new THREE.InstancedMesh(mg, pm, per.length);
      per.forEach(([x, z], i) => im.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, ph + 0.8, z)));
      im.castShadow = true; cr.add(im);
      // small roof turret with a copper dome and a gilded finial
      const tur = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.7, 3.4, 12), pm); tur.position.set(0, ph + 1.7, 0); cr.add(tur);
      const domeMat = clipMat({ color: 0x8d5f52, roughness: 0.55, metalness: 0.25 }, u.roofClip);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(1.9, 14, 9, 0, Math.PI * 2, 0, Math.PI / 2), domeMat);
      dome.position.set(0, ph + 3.4, 0); dome.scale.y = 1.15; dome.castShadow = true; cr.add(dome);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.12, 6, 20), domeMat); rim.rotation.x = Math.PI / 2; rim.position.y = ph + 3.4; cr.add(rim);
      const gold = clipMat({ color: 0xd6ab52, roughness: 0.3, metalness: 0.85 }, u.roofClip);
      const fin = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 1.5, 6), gold); fin.position.set(0, ph + 6.2, 0); cr.add(fin);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), gold); ball.position.set(0, ph + 6.98, 0); cr.add(ball);
    } else if (['castle', 'dorm', 'dormC', 'arcade', 'atrium'].includes(b.style)) {
      // rooftop equipment boxes
      const n = Math.floor((p.w * p.d) / 900);
      for (let i = 0; i < Math.min(n, 4); i++) {
        const bx = new THREE.Mesh(new THREE.BoxGeometry(3 + rand() * 4, 2 + rand() * 1.5, 3 + rand() * 3), pm);
        bx.position.set((rand() - 0.5) * (p.w - 8), ph + 1, (rand() - 0.5) * (p.d - 8)); bx.castShadow = true; cr.add(bx);
      }
    }
  }
  if (b.id === 'corridor') {
    // 食堂二楼标高 4.5 m，教学楼二楼标高 5.6 m，长廊以缓坡对齐两端。
    const rise = BUILDINGS.find((item) => item.id === 'tb_w').gf - b.gf;
    grp.traverse((o) => {
      if (!o.isMesh) return;
      const pos = o.geometry.getAttribute('position');
      for (let i = 0; i < pos.count; i++) {
        const t = THREE.MathUtils.clamp((pos.getX(i) + o.position.x + p.w / 2) / p.w, 0, 1);
        pos.setY(i, pos.getY(i) + t * rise);
      }
      pos.needsUpdate = true;
      o.geometry.computeVertexNormals();
      o.geometry.computeBoundingSphere();
    });
  }
  if (b.style === 'atrium') {
    const dome = new THREE.Mesh(new THREE.BoxGeometry(p.w * 0.7, 2.2, p.d * 0.85), clipMat({ color: 0xe9d7b0, roughness: 0.85, metalness: 0.02 }, u.roofClip));
    dome.position.y = H + 2.2; grp.add(dome);
    const ridge = new THREE.Mesh(new THREE.CylinderGeometry(p.w * 0.35, p.w * 0.35, p.d * 0.85, 16, 1, false, -Math.PI / 2, Math.PI), clipMat({ color: 0xe9d7b0, roughness: 0.85, metalness: 0.02 }, u.roofClip));
    ridge.rotation.x = Math.PI / 2; ridge.scale.set(1, 1, 0.35); ridge.position.y = H + 3.3; grp.add(ridge);
  }
  if (b.style === 'gate') {
    // grand three-bay entrance: arched glass portal, granite archivolt, paired columns and steps
    const r = p.w * 0.36, rectH = 7.0, topH = rectH + r;
    const glassMat = clipMat({ color: 0x24414c, roughness: 0.18, metalness: 0.5, emissive: 0x3b2410, emissiveIntensity: 1.0 }, u.faClip);
    const granite = clipMat({ color: 0xb4958a, roughness: 0.78 }, u.faClip);
    const cream = clipMat({ color: 0xf0e0bc, roughness: 0.78 }, u.faClip);
    const bronze = clipMat({ color: 0x7a5a35, roughness: 0.35, metalness: 0.7 }, u.faClip);
    const sh = new THREE.Shape();
    sh.moveTo(-r, 0); sh.lineTo(r, 0); sh.lineTo(r, rectH); sh.absarc(0, rectH, r, 0, Math.PI, false); sh.lineTo(-r, 0);
    const portal = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.35, bevelEnabled: false }), glassMat);
    portal.position.set(0, 0.25, p.d / 2 - 0.2); grp.add(portal);
    // glazing bars and bronze door leaves
    for (let k = -1; k <= 1; k++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.16, topH - 0.4, 0.18), bronze);
      bar.position.set((k * r) / 1.6, (topH - 0.4) / 2 + 0.25, p.d / 2 + 0.18); grp.add(bar);
    }
    for (const y of [2.6, 5.2, 7.4]) {
      const tr = new THREE.Mesh(new THREE.BoxGeometry(r * 1.75, 0.14, 0.18), bronze); tr.position.set(0, y, p.d / 2 + 0.18); grp.add(tr);
    }
    const door = new THREE.Mesh(new THREE.BoxGeometry(r * 0.9, 3.4, 0.16), bronze); door.position.set(0, 1.95, p.d / 2 + 0.22); grp.add(door);
    const split = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3.4, 0.2), glassMat); split.position.set(0, 1.95, p.d / 2 + 0.24); grp.add(split);
    // granite archivolt and jambs
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r + 0.55, 0.55, 8, 30, Math.PI), granite);
    ring.position.set(0, rectH + 0.25, p.d / 2 + 0.35); grp.add(ring);
    for (const sx of [-1, 1]) {
      const jamb = new THREE.Mesh(new THREE.BoxGeometry(1.1, rectH, 1.1), granite);
      jamb.position.set(sx * (r + 0.55), rectH / 2 + 0.25, p.d / 2 + 0.35); grp.add(jamb);
      // paired columns on pedestals
      const ped = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 1.5), cream); ped.position.set(sx * (r + 2.15), 0.25, p.d / 2 + 2.1); grp.add(ped);
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.58, 11.2, 14), cream); col.position.set(sx * (r + 2.15), 6.1, p.d / 2 + 2.1); col.castShadow = true; grp.add(col);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.55, 1.35), cream); cap.position.set(sx * (r + 2.15), 11.95, p.d / 2 + 2.1); grp.add(cap);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), S.lamp); lamp.position.set(sx * (r + 1.35), 6.9, p.d / 2 + 0.8); grp.add(lamp);
    }
    const key = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.9, 1.2), cream); key.position.set(0, topH + 0.35, p.d / 2 + 0.35); grp.add(key);
    const ent = new THREE.Mesh(new THREE.BoxGeometry(r * 2 + 5.6, 1.05, 3.3), cream); ent.position.set(0, topH + 1.8, p.d / 2 + 1.1); ent.castShadow = true; grp.add(ent);
    const ent2 = new THREE.Mesh(new THREE.BoxGeometry(r * 2 + 4.9, 0.35, 2.9), granite); ent2.position.set(0, topH + 1.2, p.d / 2 + 1.1); grp.add(ent2);
    for (let k = 0; k < 4; k++) {
      const sw = r * 2 + 7.2 - k * 1.1, shh = 0.22 * (4 - k);
      const stp = new THREE.Mesh(new THREE.BoxGeometry(sw, shh, 1.0), cream);
      stp.position.set(0, shh / 2, p.d / 2 + 3.4 + k * 0.9); stp.receiveShadow = true; grp.add(stp);
    }
    // building name on the entrance entablature
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(12.5, 1.25), clipMat({ map: bannerTexture('福州软件职业技术学院', '#a98a80', '#f5e4b8'), roughness: 0.4, metalness: 0.3 }, u.faClip));
    plate.position.set(0, topH + 1.8, p.d / 2 + 2.96); grp.add(plate);
    const plate2 = new THREE.Mesh(new THREE.PlaneGeometry(12.5, 1.6), clipMat({ map: bannerTexture('福州软件职业技术学院', '#b3893c', '#fffaf0'), roughness: 0.4, metalness: 0.3 }, u.roofClip));
    plate2.position.set(0, H - 3, p.d / 2 + 0.7); grp.add(plate2);
  }

  // skeleton (concrete frame), slabs and scaffold net
  const sk = skeletonTexture().clone(); sk.needsUpdate = true;
  sk.repeat.set(1, 1);
  const skMat = clipMat({ map: sk, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.95, color: 0xdedad0 }, u.skClip);
  const skBox = new THREE.Mesh(boxUV(p.w - 0.4, p.d - 0.4, H, 7, b.fh, b.gf), [skMat, skMat, HIDDEN, HIDDEN, skMat, skMat]);
  skBox.castShadow = true;
  if (b.style !== 'ship' && b.style !== 'stand') grp.add(skBox);
  const slabGeo = new THREE.BoxGeometry(p.w, 0.35, p.d);
  const slabs = [];
  for (let i = 1; i <= b.floors; i++) {
    const y = b.gf + (i - 1) * b.fh;
    const s = new THREE.Mesh(slabGeo, S.concrete); s.position.y = Math.min(y, H) - 0.17; s.castShadow = true; s.receiveShadow = true; grp.add(s);
    slabs.push(s);
  }
  const netMat = clipMat({ map: netTexture(), transparent: true, opacity: 0.93, side: THREE.DoubleSide,   roughness: 1, depthWrite: true }, u.netClip);
    const net = new THREE.Mesh(boxUV(p.w + 2.4, p.d + 2.4, H + 2.5, 4, 1.6, 1.6, true), [netMat, netMat, HIDDEN, HIDDEN, netMat, netMat]);
    if (!['ship', 'stand', 'gym'].includes(b.style)) grp.add(net);

  // pit
  const pitDepth = H > 20 ? 7 : 4.5;
  const pit = new THREE.Group(); grp.add(pit);
  const pw = p.w + 6, pd = p.d + 6;
  const pitWalls = new THREE.Mesh(new THREE.BoxGeometry(pw, 1, pd), [S.dirtDark, S.dirtDark, S.dirt, S.dirt, S.dirtDark, S.dirtDark]);
  pitWalls.material = pitWalls.material.map((m) => { const c = m.clone(); c.side = THREE.BackSide; return c; });
  pitWalls.geometry.translate(0, -0.5, 0);
  pitWalls.receiveShadow = true;
  pit.add(pitWalls);
  const found = new THREE.Mesh(new THREE.BoxGeometry(p.w + 2, 1, p.d + 2), S.concrete); found.geometry.translate(0, -0.5, 0); found.receiveShadow = true; pit.add(found);
  const mound = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 7), S.dirt); mound.position.set(pw / 2 + 8, 0, 0); mound.castShadow = true; grp.add(mound);
  const exc = makeExcavator(); grp.add(exc);

  return { grp, skBox, slabs, net, pit, pitWalls, found, pitDepth, mound, exc, pw, pd, part: p };
}

// box geometry with UVs scaled so one texture repeat == one bay x one floor (skeleton/net)
function boxUV(w, d, h, bayW, fh, gf, unitH = false) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(0, h / 2, 0);
  const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), nx = nor.getX(i), ny = nor.getY(i);
    if (Math.abs(ny) > 0.5) { uv.setXY(i, x / bayW, z / bayW); continue; }
    const horiz = Math.abs(nx) > 0.5 ? z : x;
    const v = unitH ? y / fh : (y < gf ? (y / gf) : 1 + (y - gf) / fh);
    uv.setXY(i, horiz / bayW, v);
  }
  return g;
}

// ---------------------------------------------------------------- site extras
function makeFence(U) {
  const S = sharedMats();
  const g = new THREE.Group();
  const pts = SITE.campus.map(([x, y]) => new THREE.Vector2(ux(x), uz(y)));
  const fenceMat = new THREE.MeshStandardMaterial({ color: 0x2f62b0, roughness: 0.7 });
  const stripe = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });
  const slogans = ['安全第一 质量为本', '精心施工 筑梦福软', '厚德笃行 励学强技', '百年大计 质量第一', '文明施工 和谐共建'];
  let si = 0;
  const segs = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], L = a.distanceTo(b);
    if (L < 1) continue;
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    const m = new THREE.Mesh(new THREE.BoxGeometry(L, 2.6, 0.2), fenceMat); m.geometry.translate(L / 2, 1.3, 0);
    m.position.set(a.x, 0, a.y); m.rotation.y = -ang; g.add(m);
    const st = new THREE.Mesh(new THREE.BoxGeometry(L, 0.3, 0.22), stripe); st.geometry.translate(L / 2, 2.2, 0); st.position.copy(m.position); st.rotation.y = -ang; g.add(st);
    segs.push(m, st);
    for (let t = 30; t < L - 30; t += 120) {
      const ban = new THREE.Mesh(new THREE.PlaneGeometry(16, 1.5), new THREE.MeshStandardMaterial({ map: bannerTexture(slogans[si++ % slogans.length]), side: THREE.DoubleSide, roughness: 0.8 }));
      ban.position.set(a.x + Math.cos(ang) * t, 1.25, a.y + Math.sin(ang) * t); ban.rotation.y = -ang;
      ban.translateZ(0.2); g.add(ban); segs.push(ban);
    }
  }
  void S;
  return { g, segs };
}

function makeCamp() {
  const S = sharedMats();
  const g = new THREE.Group();
  const roofBlue = new THREE.MeshStandardMaterial({ color: 0x2b5fa8, roughness: 0.6 });
  const wall = new THREE.MeshStandardMaterial({ color: 0xeeeeea, roughness: 0.8 });
  const add = (x, z, rows, cols, rot = 0) => {
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) for (let lv = 0; lv < 2; lv++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(6, 2.8, 3), wall); m.position.set(x + c * 6.4, 1.4 + lv * 2.9, z + r * 7); m.rotation.y = rot; m.castShadow = true; g.add(m);
      const rf = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.25, 3.2), roofBlue); rf.position.set(x + c * 6.4, 2.95 + lv * 2.9, z + r * 7); g.add(rf);
    }
  };
  add(ux(560), uz(760), 3, 6);
  add(ux(1240), uz(470), 2, 5);
  add(ux(170), uz(250), 2, 4);
  // project sign board
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(30, 4), new THREE.MeshStandardMaterial({ map: bannerTexture('福州软件职业技术学院 · 新校区建设项目部', '#1d4f9a'), roughness: 0.7 }));
  sign.position.set(ux(600), 9, uz(758) - 0.3); sign.rotation.y = 0; g.add(sign);
  // material yard on the sports field: rebar bundles & formwork stacks
  const yard = new THREE.Group();
  for (let i = 0; i < 70; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(9 + rand() * 4, 0.6 + rand() * 1.2, 2 + rand() * 2), rand() < 0.5 ? S.rebar : new THREE.MeshStandardMaterial({ color: 0xc89a5a, roughness: 0.9 }));
    m.position.set(ux(1060 + rand() * 120), 0.5, uz(400 + rand() * 280)); m.rotation.y = rand() < 0.5 ? 0 : Math.PI / 2; m.castShadow = true; yard.add(m);
  }
  g.add(yard);
  return { g, yard };
}

// ---------------------------------------------------------------- landmarks: flag platform, fountain, school gate
function flagTexture() {
  const [c, g] = canvas(600, 400);
  g.fillStyle = '#de2910'; g.fillRect(0, 0, 600, 400);
  const u = 20;
  const star = (cx, cy, r, rot) => {
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = rot - Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.382 : r;
      g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    g.closePath(); g.fillStyle = '#ffde00'; g.fill();
  };
  star(5 * u, 5 * u, 3 * u, 0);
  for (const [x, y] of [[10, 2], [12, 4], [12, 7], [10, 9]]) {
    const rot = Math.atan2(5 - y, 5 - x) + Math.PI / 2;
    star(x * u, y * u, u, rot);
  }
  const t = tex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

function makeLandmarks(U) {
  const S = sharedMats();
  const g = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: 0xd8cdbd, roughness: 0.85 });
  const pink = new THREE.MeshStandardMaterial({ color: 0xa98a80, roughness: 0.8 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xe8ecef, roughness: 0.25, metalness: 0.8 });

  // flag platform beside the field
  const fl = new THREE.Group(); fl.position.set(ux(SITE.flag.x), 0, uz(SITE.flag.y)); g.add(fl);
  [[13, 0.45], [10, 0.45], [7, 0.45]].forEach(([s, h], i) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(s, h, s), i === 0 ? pink : stone); m.position.y = h / 2 + i * h; m.castShadow = m.receiveShadow = true; fl.add(m);
  });
  const rail = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.9, 7.2), new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.4, wireframe: false, transparent: true, opacity: 0.35 }));
  rail.position.y = 1.35 + 0.45; fl.add(rail);
  const poleH = 19;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.16, poleH, 10), metal); pole.position.y = 1.35 + poleH / 2; pole.castShadow = true; fl.add(pole);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshStandardMaterial({ color: 0xd4a640, metalness: 0.9, roughness: 0.3 })); knob.position.y = 1.35 + poleH + 0.15; fl.add(knob);
  const fw = 4.8, fh = 3.2;
  const flagGeo = new THREE.PlaneGeometry(fw, fh, 24, 12); flagGeo.translate(fw / 2, 0, 0);
  const flagMat = new THREE.MeshStandardMaterial({ map: flagTexture(), side: THREE.DoubleSide, roughness: 0.7 });
  flagMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.time;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float k = position.x / ${fw.toFixed(1)};
        transformed.z += k * (0.38 * sin(position.x * 1.7 - uTime * 6.0) + 0.12 * sin(position.y * 2.3 + position.x * 2.9 - uTime * 9.0));
        transformed.y -= k * k * 0.25;`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        { float k = position.x / ${fw.toFixed(1)}; float d = k * 0.38 * 1.7 * cos(position.x * 1.7 - uTime * 6.0);
          objectNormal = normalize(vec3(-d, 0.0, 1.0)); }`);
  };
  flagMat.customProgramCacheKey = () => 'flag';
  const flag = new THREE.Mesh(flagGeo, flagMat); flag.position.set(0.12, 1.35 + poleH - fh / 2 - 0.3, 0); flag.rotation.y = -0.6; flag.castShadow = true; fl.add(flag);

  // two flags crowning the main gate towers
  const roofFlags = new THREE.Group(); g.add(roofFlags);
  for (const sx of [-1, 1]) {
    const px = sx * 13.6, pz = 76.7;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 11, 8), metal); pole.position.set(px, 44.8 + 5.5, pz); pole.castShadow = true; roofFlags.add(pole);
    const knob2 = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshStandardMaterial({ color: 0xd4a640, metalness: 0.9, roughness: 0.3 })); knob2.position.set(px, 44.8 + 11.1, pz); roofFlags.add(knob2);
    const fgeo = new THREE.PlaneGeometry(3.6, 2.2, 16, 4); fgeo.translate(1.8, 0, 0);
    const fp = fgeo.attributes.position;
    for (let i = 0; i < fp.count; i++) { const x = fp.getX(i); fp.setZ(i, Math.sin(x * 2.2) * 0.2 * (x / 3.6)); }
    fgeo.computeVertexNormals();
    const fl2 = new THREE.Mesh(fgeo, new THREE.MeshStandardMaterial({ map: flagTexture(), side: THREE.DoubleSide, roughness: 0.75 }));
    fl2.position.set(px + 0.12, 44.8 + 9.4, pz); fl2.rotation.y = -0.55; fl2.castShadow = true; roofFlags.add(fl2);
  }

  // low hedges and shrubs replace the two roads that used to flank the gate stone
  const hedges = new THREE.Group(); g.add(hedges);
  const hedgeMat = new THREE.MeshStandardMaterial({ color: 0x386b30, roughness: 0.9 });
  const bushMat = new THREE.MeshStandardMaterial({ color: 0x2f5a27, roughness: 0.9, flatShading: true });
  for (const [pa, pb] of [[[495, 795], [680, 811]], [[834, 824], [960, 835]]]) {
    const ax = ux(pa[0]), az = uz(pa[1]), bx = ux(pb[0]), bz = uz(pb[1]);
    const L = Math.hypot(bx - ax, bz - az), ang = Math.atan2(bz - az, bx - ax);
    for (let d = 1.2; d < L - 1; d += 2.2) {
      const h = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.75, 1.05), hedgeMat);
      h.position.set(ax + Math.cos(ang) * d, 0.375, az + Math.sin(ang) * d);
      h.rotation.y = -ang; h.castShadow = true; hedges.add(h);
    }
    for (let d = 2.5; d < L - 1; d += 6.5) for (const off of [-2.0, 2.0]) {
      const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.75, 0), bushMat);
      bush.position.set(ax + Math.cos(ang) * d - Math.sin(ang) * off, 0.55, az + Math.sin(ang) * d + Math.cos(ang) * off);
      bush.scale.set(1, 0.8, 1); bush.rotation.y = rand() * 6.28; bush.castShadow = true; hedges.add(bush);
    }
  }

  // fountain in the middle of the boulevard
  const fo = new THREE.Group(); fo.position.set(ux(SITE.fountain.x), 0, uz(SITE.fountain.y)); g.add(fo);
  const R0 = SITE.fountain.r;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R0, 0.45, 8, 48), stone); rim.rotation.x = Math.PI / 2; rim.position.y = 0.45; rim.castShadow = true; fo.add(rim);
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x3f7f96, roughness: 0.05, metalness: 0.3, emissive: 0x0b2630 });
  const water = new THREE.Mesh(new THREE.CircleGeometry(R0, 48), waterMat); water.rotation.x = -Math.PI / 2; water.position.y = 0.55; fo.add(water);
  const tier1 = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 2.2, 0.6, 32), stone); tier1.position.y = 1.6; fo.add(tier1);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 1.6, 16), stone); stem.position.y = 0.9; fo.add(stem);
  const tier2 = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.0, 0.45, 24), stone); tier2.position.y = 3.0; fo.add(tier2);
  const stem2 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 1.2, 12), stone); stem2.position.y = 2.3; fo.add(stem2);
  const N = 1800;
  const sprayGeo = new THREE.BufferGeometry();
  const seeds = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) seeds.set([rand(), rand(), rand()], i * 3);
  sprayGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  sprayGeo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));
  const sprayMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: U.time, uNight: U.night, uOn: { value: 0 } },
    vertexShader: `attribute vec3 aSeed; uniform float uTime, uOn; varying float vA;
      void main(){
        float jet = floor(aSeed.x * 9.0); float life = 1.6; float t = fract(uTime / life + aSeed.y) * life;
        vec3 p; vec3 v;
        if (jet < 1.0) { p = vec3(0.0, 3.3, 0.0); v = vec3((aSeed.z - 0.5) * 1.2, 7.5, (fract(aSeed.z * 7.3) - 0.5) * 1.2); }
        else { float a = jet / 8.0 * 6.2831 + aSeed.z * 0.2; p = vec3(cos(a) * ${(R0 - 0.6).toFixed(2)}, 0.6, sin(a) * ${(R0 - 0.6).toFixed(2)}); v = vec3(-cos(a) * 2.6, 4.2, -sin(a) * 2.6); }
        p += v * t + vec3(0.0, -4.9, 0.0) * t * t;
        p.y = max(p.y, 0.55);
        vA = (1.0 - t / life) * uOn;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = 900.0 / -mv.z * (0.6 + aSeed.z);
        gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uNight; varying float vA; void main(){ vec2 c = gl_PointCoord - 0.5; float d = dot(c, c); if (d > 0.25) discard;
        gl_FragColor = vec4(mix(vec3(0.85,0.93,1.0), vec3(1.0,0.86,0.6), uNight) , vA * (0.25 - d) * 1.6); }`,
  });
  const spray = new THREE.Points(sprayGeo, sprayMat); spray.frustumCulled = false; fo.add(spray);
  const foLight = new THREE.PointLight(0xffd59a, 0, 40, 1.5); foLight.position.y = 2; fo.add(foLight);

  // school gate at the south end of the boulevard
  const gt = new THREE.Group(); gt.position.set(ux(SITE.schoolGate.x), 0, uz(SITE.schoolGate.y)); g.add(gt);
  for (const sx of [-1, 1]) {
    for (const off of [17, 33]) {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(2.6, 7.5, 2.6), pink); pier.position.set(sx * off, 3.75, 0); pier.castShadow = true; gt.add(pier);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.7, 3.2), stone); cap.position.set(sx * off, 7.85, 0); gt.add(cap);
      const lampG = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), S.lamp); lampG.position.set(sx * off, 8.6, 0); lampG.userData.lamp = true; gt.add(lampG);
    }
    const wall = new THREE.Mesh(new THREE.BoxGeometry(14, 3.2, 1.2), pink); wall.position.set(sx * 25, 1.6, 0); wall.castShadow = true; gt.add(wall);
    const fence = new THREE.Mesh(new THREE.BoxGeometry(30, 2.2, 0.3), new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.5, metalness: 0.6 })); fence.position.set(sx * 50, 1.1, 0); gt.add(fence);
  }
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(12.5, 1.25), new THREE.MeshStandardMaterial({ map: bannerTexture('福州软件职业技术学院', '#a98a80', '#f5e4b8'), roughness: 0.4, metalness: 0.3 }));
  plate.position.set(-25, 2.0, 0.62); gt.add(plate);
  const plate2 = plate.clone(); plate2.material = new THREE.MeshStandardMaterial({ map: bannerTexture('厚德笃行 · 励学强技', '#a98a80', '#f5e4b8'), roughness: 0.4, metalness: 0.3 }); plate2.position.set(25, 2.0, 0.62); gt.add(plate2);

  // FSVC gate monument: one long rectangular granite block on a low plinth
  const st = new THREE.Group(); st.position.set(ux(SITE.stone.x), 0, uz(SITE.stone.y)); g.add(st);
  const pinkStone = new THREE.MeshStandardMaterial({ color: 0xb98f84, roughness: 0.55, metalness: 0.03 });
  const pinkLight = new THREE.MeshStandardMaterial({ color: 0xcbb8a6, roughness: 0.6 });
  const [gc, gg] = canvas(256, 256);
  gg.fillStyle = '#b28b81'; gg.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1100; i++) {
    const v = rand(), s = 1.4 + rand() * 2.8;
    gg.fillStyle = v < 0.55 ? `rgba(244,224,214,${0.07 + rand() * 0.13})` : `rgba(74,48,44,${0.06 + rand() * 0.11})`;
    gg.fillRect(rand() * 256, rand() * 256, s, s);
  }
  const graniteTex = tex(gc);
  graniteTex.wrapS = graniteTex.wrapT = THREE.RepeatWrapping; graniteTex.repeat.set(2, 1);
  const pinkGranite = new THREE.MeshStandardMaterial({ map: graniteTex, roughness: 0.72, metalness: 0.02 });
  const addStone = (w, h, d, mat, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; st.add(m); return m;
  };
  addStone(10.9, 0.22, 2.5, pinkLight, 0, 0.11, 0);
  addStone(10.5, 0.22, 2.3, pinkStone, 0, 0.33, 0);
  const slabShape = new THREE.Shape();
  slabShape.moveTo(-4.9, -1.3); slabShape.lineTo(4.9, -1.3); slabShape.lineTo(4.9, 1.3); slabShape.lineTo(-4.9, 1.3); slabShape.closePath();
  const slabGeo = new THREE.ExtrudeGeometry(slabShape, { depth: 1.5, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 2 });
  slabGeo.translate(0, 0, -0.75);
  const slab = new THREE.Mesh(slabGeo, pinkGranite);
  slab.position.y = 1.74; slab.castShadow = slab.receiveShadow = true; st.add(slab);
  const [lc, lg] = canvas(1024, 280);
  lg.clearRect(0, 0, 1024, 280);
  lg.textAlign = 'center'; lg.textBaseline = 'middle';
  lg.font = 'bold 180px "Times New Roman", Georgia, serif';
  if ('letterSpacing' in lg) lg.letterSpacing = '16px';
  lg.fillStyle = 'rgba(255,240,220,0.35)'; lg.fillText('FSVC', 515, 100);
  const goldGrad = lg.createLinearGradient(0, 20, 0, 185);
  goldGrad.addColorStop(0, '#5e3c25'); goldGrad.addColorStop(0.55, '#3c2113'); goldGrad.addColorStop(1, '#210f08');
  lg.fillStyle = goldGrad; lg.fillText('FSVC', 512, 97);
  lg.strokeStyle = 'rgba(92,58,35,0.8)'; lg.lineWidth = 2.5;
  lg.beginPath(); lg.moveTo(214, 168); lg.lineTo(810, 168); lg.stroke();
  lg.save(); lg.translate(512, 168); lg.rotate(Math.PI / 4); lg.fillStyle = '#6d4326'; lg.fillRect(-5, -5, 10, 10); lg.restore();
  if ('letterSpacing' in lg) lg.letterSpacing = '4px';
  lg.font = '72px "Noto Serif SC","SimSun",serif';
  lg.fillStyle = 'rgba(255,240,220,0.35)'; lg.fillText('厚德笃行，励学强技', 515, 223);
  const mottoGrad = lg.createLinearGradient(0, 182, 0, 260);
  mottoGrad.addColorStop(0, '#5e3c25'); mottoGrad.addColorStop(0.55, '#3c2113'); mottoGrad.addColorStop(1, '#210f08');
  lg.fillStyle = mottoGrad; lg.fillText('厚德笃行，励学强技', 512, 219);
  const ltex = tex(lc);
  const label = new THREE.Mesh(new THREE.PlaneGeometry(8.7, 2.38), new THREE.MeshStandardMaterial({
    map: ltex, transparent: true, roughness: 0.62, metalness: 0.08, polygonOffset: true, polygonOffsetFactor: -3,
  }));
  label.position.set(0, 1.76, 0.84); st.add(label);
  const uplightMat = new THREE.MeshStandardMaterial({ color: 0x2a2b2c, roughness: 0.4, metalness: 0.6 });
  const uplightGlow = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
  for (const sx of [-4.2, -1.4, 1.4, 4.2]) {
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.28, 10), uplightMat);
    can.position.set(sx, 0.58, 1.45); st.add(can);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.11, 10), uplightGlow);
    glow.rotation.x = -Math.PI / 2; glow.position.set(sx, 0.73, 1.45); st.add(glow);
  }
  for (const sx of [-1, 1]) {
    addStone(0.7, 0.4, 1.1, pinkStone, sx * 6.1, 0.44, 0);
    addStone(0.8, 0.08, 1.2, pinkLight, sx * 6.1, 0.68, 0);
    for (const dz of [-0.27, 0.27]) {
      const shrub = new THREE.Mesh(new THREE.IcosahedronGeometry(0.27, 0), bushMat);
      shrub.position.set(sx * 6.1, 0.79, dz); shrub.scale.set(1, 1.2, 1); shrub.castShadow = true; st.add(shrub);
    }
  }
  const stoneLight = new THREE.PointLight(0xffd2a0, 0, 22, 2);
  stoneLight.position.set(0, 1.4, 2.2); st.add(stoneLight);

  // small football pitch and two basketball courts in front of the south dorm
  const sports = new THREE.Group(); g.add(sports);
  const whiteMetal = new THREE.MeshStandardMaterial({ color: 0xf2f3ef, roughness: 0.45, metalness: 0.35 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xd6512f, roughness: 0.5, metalness: 0.2 });
  const goalPost = (x, z) => {
    const grp = new THREE.Group(); grp.position.set(ux(x), 0, uz(z)); sports.add(grp);
    for (const dz of [-1.5, 1.5]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2, 8), whiteMetal);
      post.position.set(0, 1, dz); post.castShadow = true; grp.add(post);
    }
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3, 8), whiteMetal);
    bar.rotation.x = Math.PI / 2; bar.position.set(0, 2, 0); bar.castShadow = true; grp.add(bar);
  };
  goalPost(1006, 749.5); goalPost(1071, 749.5);
  const hoop = (x, dir) => {
    const grp = new THREE.Group(); grp.position.set(ux(x), 0, uz(749)); grp.rotation.y = dir > 0 ? 0 : Math.PI; sports.add(grp);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 3.4, 8), whiteMetal);
    pole.position.y = 1.7; pole.castShadow = true; grp.add(pole);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.15, 8), whiteMetal);
    arm.rotation.z = -Math.PI / 2; arm.position.set(0.57, 3.28, 0); grp.add(arm);
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.05, 1.8), whiteMetal);
    board.position.set(1.15, 3.45, 0); board.castShadow = true; grp.add(board);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.03, 6, 14), rimMat);
    ring.rotation.x = -Math.PI / 2; ring.position.set(1.38, 3.05, 0); grp.add(ring);
  };
  hoop(1086, 1); hoop(1130, -1); hoop(1136, 1); hoop(1180, -1);

  const update = (day, t, night) => {
    const on = day > 560;
    st.visible = day > 615;
    stoneLight.intensity = st.visible ? night * 22 : 0;
    sports.visible = day > 605;
    fl.visible = day > 600; flag.visible = day > 640;
    roofFlags.visible = day > 648;
    hedges.visible = day > 600;
    fo.visible = day > 590; sprayMat.uniforms.uOn.value = day > 630 ? 1 : 0;
    foLight.intensity = night * 120 * (day > 630 ? 1 : 0);
    gt.visible = on;
    gt.children.forEach((m) => { if (m.userData.lamp) m.visible = night > 0.3; });
  };
  return { g, update };
}

// ---------------------------------------------------------------- public API
export function createConstruction(U) {
  const S = sharedMats();
  const root = new THREE.Group();
  const parts = [];
  const cranes = [];
  for (const b of BUILDINGS) {
    b.U = {
      faClip: { value: new THREE.Vector2(0, 0) }, roofClip: { value: new THREE.Vector2(0, -1) },
      skClip: { value: new THREE.Vector2(0, 0) }, netClip: { value: new THREE.Vector2(0, 0) }, lit: { value: 0 },
    };
    b.seed = rand();
    b._parts = b.parts.map((p) => buildPart(b, p, U, root));
  }
  // ---- crane placement: keep masts clear of every footprint and jibs above everything they can reach
  const foot = [];
  for (const b of BUILDINGS) for (const p of b.parts) foot.push({ b, p, top: b.height + (b.crenel ? 8.5 : b.style === 'atrium' ? 6 : 3.5) });
  const distTo = (x, z, p) => {
    const a = (p.rot * Math.PI) / 180, dx = x - p.cx, dz = z - p.cz;
    const lx = Math.cos(a) * dx + Math.sin(a) * dz, lz = -Math.sin(a) * dx + Math.cos(a) * dz;
    const qx = Math.max(Math.abs(lx) - p.w / 2, 0), qz = Math.max(Math.abs(lz) - p.d / 2, 0);
    const out = Math.hypot(qx, qz);
    return out > 0 ? out : -Math.min(p.w / 2 - Math.abs(lx), p.d / 2 - Math.abs(lz));
  };
  const clearance = (x, z) => Math.min(...foot.map((f) => distTo(x, z, f.p)));
  const placed = [];
  for (const b of BUILDINGS) {
    b._cranes = b.cranes.map(([x0, z0], i) => {
      let best = [x0, z0];
      const ok = (x, z) => clearance(x, z) >= 6 && placed.every(([px, pz]) => Math.hypot(px - x, pz - z) > 14);
      if (!ok(x0, z0)) {
        let found = false;
        for (let r = 2; r <= 60 && !found; r += 2) for (let k = 0; k < 24 && !found; k++) {
          const a = (k / 24) * Math.PI * 2, x = x0 + Math.cos(a) * r, z = z0 + Math.sin(a) * r;
          if (ok(x, z)) { best = [x, z]; found = true; }
        }
      }
      placed.push(best);
      const reach = 56;
      const need = Math.max(b.height + 16, ...foot.filter((f) => distTo(best[0], best[1], f.p) < reach).map((f) => f.top + 7));
      const c = makeCrane(need);
      c.position.set(best[0], 0, best[1]); c.userData.phase = rand() * 6.28; c.userData.b = b; c.userData.i = i;
      root.add(c); cranes.push(c);
      return c;
    });
    parts.push(...b._parts);
  }
  // gym steel truss + crawler crane
  const gym = BUILDINGS.find((b) => b.id === 'gym');
  const gp = gym.parts[0];
  const trussG = new THREE.Group(); trussG.position.set(gp.cx, gym.height, gp.cz); root.add(trussG);
  const latMat = S.mast.clone(); latMat.map = S.mast.map.clone(); latMat.map.repeat.set(gp.w / 2.5, 1); latMat.map.needsUpdate = true; latMat.color.set(0xd8dde2);
  const NS = 12, trussSecs = [];
  for (let i = 0; i < NS; i++) {
    const sec = new THREE.Group();
    const z = -gp.d / 2 + ((i + 0.5) / NS) * gp.d;
    const arch = new THREE.Mesh(new THREE.BoxGeometry(gp.w, 2.6, gp.d / NS - 0.3), latMat); arch.position.set(0, 1.3, 0);
    const curve = new THREE.Mesh(new THREE.CylinderGeometry(gp.w * 0.9, gp.w * 0.9, gp.d / NS - 0.3, 24, 1, true, -0.55, 1.1), latMat);
    curve.rotation.z = Math.PI / 2; curve.rotation.y = Math.PI / 2; curve.rotation.set(Math.PI / 2, 0, 0); curve.rotation.z = 0;
    curve.geometry.rotateX(Math.PI / 2); curve.geometry.rotateZ(0);
    void curve;
    sec.add(arch); sec.position.z = z; sec.userData.z = z; trussG.add(sec); trussSecs.push(sec);
  }
  const gymRoof = new THREE.Mesh(new THREE.BoxGeometry(gp.w + 2, 1.2, gp.d + 2), new THREE.MeshStandardMaterial({ color: 0xe9ecef, roughness: 0.35, metalness: 0.5 }));
  gymRoof.position.set(gp.cx, gym.height + 2.2, gp.cz); gymRoof.castShadow = true; root.add(gymRoof);
  const crawler = new THREE.Group(); root.add(crawler);
  for (const sz of [-2.2, 2.2]) {
    const track = new THREE.Mesh(new THREE.BoxGeometry(9.4, 1.25, 1.35), S.dark); track.position.set(0, 0.62, sz); track.castShadow = true; crawler.add(track);
    for (let k = -3; k <= 3; k++) { const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.5, 8), S.dark); wh.rotation.x = Math.PI / 2; wh.position.set(k * 1.25, 0.38, sz); crawler.add(wh); }
  }
  const cBase = new THREE.Mesh(new THREE.BoxGeometry(6.6, 2.0, 4.4), S.red); cBase.position.y = 2.2; cBase.castShadow = true; crawler.add(cBase);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.1, 2.2), S.white); cab.position.set(2.2, 3.4, 1.1); cab.castShadow = true; crawler.add(cab);
  const cw = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.8, 4.0), S.concrete); cw.position.set(-3.1, 2.5, 0); crawler.add(cw);
  const boomP = new THREE.Group(); boomP.position.set(2, 3, 0); crawler.add(boomP);
  const boomMat = S.mast.clone(); boomMat.map = S.mast.map.clone(); boomMat.map.repeat.set(18, 1); boomMat.map.needsUpdate = true; boomMat.color.set(0xff3b2b);
  const boom = new THREE.Mesh(new THREE.BoxGeometry(30, 1.2, 1.2), boomMat); boom.geometry.translate(15, 0, 0); boomP.add(boom); boom.castShadow = true;
  boomP.rotation.z = 1.3;
  const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 4), S.dark); root.add(hook);
  const lifted = new THREE.Mesh(new THREE.BoxGeometry(gp.w * 0.95, 2.6, gp.d / NS - 0.3), latMat); root.add(lifted);
  crawler.rotation.y = Math.PI / 2; // local +x (boom direction) -> world -z
  crawler.position.set(gp.cx, 0, gp.cz);

  const fence = makeFence(U); root.add(fence.g);
  const marks = makeLandmarks(U); root.add(marks.g);
  const camp = makeCamp(); root.add(camp.g);

  // trucks on a haul loop
  const loop = [[757, 900], [757, 720], [560, 720], [560, 240], [960, 240], [960, 720], [757, 720]].map(([x, y]) => new THREE.Vector3(ux(x), 0, uz(y)));
  const loop2 = [[960, 520], [1560, 520], [1560, 300], [1205, 300], [1205, 845], [1000, 845]].map(([x, y]) => new THREE.Vector3(ux(x), 0, uz(y)));
  const paths = [new THREE.CatmullRomCurve3(loop, true, 'catmullrom', 0.1), new THREE.CatmullRomCurve3(loop2, true, 'catmullrom', 0.1)];
  const trucks = [];
  for (let i = 0; i < 14; i++) {
    const t = makeTruck([0xd4882b, 0x2f6fb5, 0xe2c044, 0x9c3b2e][i % 4]);
    t.userData.path = paths[i % 2]; t.userData.off = rand(); t.userData.speed = 0.012 + rand() * 0.006;
    root.add(t); trucks.push(t);
  }
  // night welding sparks
  const sparkN = 400;
  const sparkGeo = new THREE.BufferGeometry(); sparkGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(sparkN * 3), 3));
  const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ color: 0xffb04a, size: 1.4, sizeAttenuation: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  sparks.frustumCulled = false; root.add(sparks);
  // site floodlight posts
  const lights = new THREE.Group(); root.add(lights);
  for (const [x, y] of [[560, 720], [960, 720], [560, 240], [960, 240], [300, 420], [300, 650], [1205, 300], [1205, 700], [1500, 520], [420, 120]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 22, 6), S.dark); pole.position.set(ux(x), 11, uz(y)); lights.add(pole);
    const l = new THREE.Mesh(new THREE.BoxGeometry(3, 1.4, 0.6), S.lamp); l.position.set(ux(x), 22, uz(y)); lights.add(l);
  }

  // pits for the ground shader
  const pitList = parts.filter((p) => p.part).map((p) => p);

  function update(day, t, env) {
    const night = env.night;
    marks.update(day, t, night);
    let pi = 0;
    for (const b of BUILDINGS) {
      const s = b.sched, H = b.height, isLink = !!b.link;
      const kSt = lin(day, s.st0, s.st1);
      // structure height snaps floor by floor with a short pour transition
      const floorsF = kSt * b.floors;
      const fl = Math.floor(floorsF), fr = floorsF - fl;
      const hAt = (n) => (n <= 0 ? 0 : b.gf + (n - 1) * b.fh);
      const Hs = kSt >= 1 ? H : hAt(fl) + (hAt(fl + 1) - hAt(fl)) * ss(fr, 0.2, 0.9);
      const kFa = lin(day, s.fa0, s.fa1);
      const netTop = day < s.fa0 ? Hs + (kSt < 1 ? 1.8 : 1.2) : (1 - kFa) * (H + 1.2);
      const facadeMin = day < s.fa0 ? 1e9 : netTop - 0.2;
      b.U.skClip.value.set(-1, kSt > 0 ? Hs : -2);
      b.U.netClip.value.set(kSt > 0.02 ? 0 : 99, kFa >= 1 ? -1 : netTop);
      b.U.faClip.value.set(kFa >= 1 ? -50 : facadeMin, kFa >= 1 ? 999 : (day < s.fa0 ? -1 : H + 0.01));
      b.U.roofClip.value.set(-50, day > s.fa0 + 4 ? 999 : -50);
      b.U.lit.value = kFa >= 1 ? 1 : 0;
      for (const P of b._parts) {
        const pd = P.pitDepth;
        const kEx = lin(day, s.ex0, s.fd0);
        const kFd = lin(day, s.fd0, s.st0);
        const pitOn = day >= s.ex0 && day < s.st0 + 6;
        const depth = kEx * pd;
        P.pit.visible = pitOn && !isLink;
        P.pitWalls.scale.y = Math.max(0.01, depth);
        P.found.visible = day > s.fd0 && !isLink;
        P.found.scale.y = Math.max(0.01, (kFd * 0.85 + 0.15 * (day >= s.st0 ? 1 : 0)) * depth);
        P.found.position.y = -depth + P.found.scale.y;
        const moundK = day < s.fd0 ? kEx : 1 - lin(day, s.fd0, s.fd0 + 20);
        P.mound.visible = !isLink && moundK > 0.01 && P.part.w * P.part.d > 1500;
        P.mound.scale.set(Math.max(0.01, moundK) * 10, Math.max(0.01, moundK) * 5, Math.max(0.01, moundK) * 10);
        P.mound.position.y = P.mound.scale.y / 2;
        P.exc.visible = !isLink && day > s.ex0 && day < s.fd0 + 4;
        P.exc.position.set(Math.sin(t * 0.2 + b.seed * 9) * P.pw * 0.25, -depth, Math.cos(t * 0.15) * P.pd * 0.2);
        P.exc.userData.body.rotation.y = Math.sin(t * 0.8 + b.seed * 6) * 1.2;
        P.exc.userData.arm.rotation.z = Math.sin(t * 1.3 + b.seed) * 0.3 - 0.2;
        P.slabs.forEach((sl, i) => { sl.visible = b.style !== 'gym' && kSt > 0 && sl.position.y <= Hs + 0.1 && kFa < 1; });
        P.skBox.visible = kSt > 0 && kFa < 1;
        P.net.visible = kSt > 0.02 && kFa < 1;
        P.grp.visible = day >= s.ex0;
        if (pitOn && !isLink && pi < U.pits.value.length) {
          U.pits.value[pi].set(P.grp.position.x, P.grp.position.z, P.pw / 2, P.pd / 2);
          U.pitInfo.value[pi].set(-P.grp.rotation.y, 1, 0, 0);
          pi++;
        }
      }
      for (const c of b._cranes) {
        const on0 = s.st0 - 10, off0 = s.fa0 + 18;
        const up = lin(day, on0, on0 + 6), down = 1 - lin(day, off0, off0 + 6);
        const k = Math.min(up, down);
        c.visible = k > 0.001;
        const mastH = Math.max(14, c.userData.height * Math.min(1, (Hs + 16) / (b.height + 16)));
        c.userData.mast.scale.y = mastH * k;
        c.userData.mast.material.map.repeat.y = (mastH * k) / 2;
        c.userData.head.position.y = mastH * k;
        c.userData.head.visible = k > 0.95;
        const ph = c.userData.phase;
        c.userData.head.rotation.y = ph + Math.sin(t * 0.35 + ph) * 1.4 + day * 0.03;
        const tr = 16 + 22 * (0.5 + 0.5 * Math.sin(t * 0.5 + ph * 2));
        c.userData.trolley.position.x = tr;
        const hookY = Math.max(4, mastH * k - (Hs + 4) + 6 * (0.5 + 0.5 * Math.sin(t * 0.7 + ph)));
        c.userData.cable.scale.y = hookY; c.userData.cable.position.y = -hookY / 2; c.userData.load.position.y = -hookY;
        c.userData.lamps.forEach((l) => { l.visible = night > 0.3; });
      }
    }
    for (let i = pi; i < U.pits.value.length; i++) U.pitInfo.value[i].set(0, 0, 0, 0);

    // gym truss
    const tk = lin(day, gym.truss.d0, gym.truss.d1);
    const nDone = tk * NS;
    trussSecs.forEach((sec, i) => { sec.visible = i < Math.floor(nDone) && day < gym.sched.fa1 + 5; });
    const lifting = tk > 0 && tk < 1;
    if (lifting) {
      // the crawler waits on the apron outside the south wall and lifts the last section over the
      // roof edge with a short luffed boom; the boom stays clear of the wall and the steel truss
      const tz = gp.cz + gp.d / 2 - 3.6;
      const CR_L = 30, zBase = gp.cz + gp.d / 2 + 12;
      crawler.position.set(gp.cx, 0, zBase);
      const ang = THREE.MathUtils.degToRad(63);
      boomP.rotation.z = ang;
      const tipY = 3 + Math.sin(ang) * CR_L;
      const f = (t * 0.14 + 0.25) % 1;
      const ly = lerp(gym.height + 9.5, gym.height + 0.2, ss(f, 0.08, 0.92));
      lifted.position.set(gp.cx, ly, tz);
      const top = ly + 1.3;
      hook.position.set(gp.cx, (tipY + top) / 2, tz);
      hook.scale.y = Math.max(0.1, tipY - top);
      hook.rotation.set(0, 0, 0);
    } else if (tk >= 1) {
      crawler.position.set(gp.cx, 0, gp.cz + gp.d / 2 + 14);
    }
    crawler.visible = (lifting || tk >= 1) && day > gym.truss.d0 - 8 && day < gym.truss.d1 + 6;
    hook.visible = lifted.visible = lifting;
    gymRoof.visible = day > gym.truss.d1 + 6;
    gymRoof.scale.z = lin(day, gym.truss.d1 + 6, gym.truss.d1 + 30) || 0.001;
    gymRoof.position.z = gp.cz - (gp.d + 2) / 2 * (1 - gymRoof.scale.z);

    // fence: erected days 2-16, removed 632-648
    const fk = Math.min(lin(day, 2, 16), 1 - lin(day, 632, 648));
    fence.g.visible = fk > 0;
    fence.segs.forEach((m, i) => { m.visible = (i / fence.segs.length) < fk; });
    camp.g.visible = day > 6 && day < 640;
    camp.g.children.forEach((c, i) => { if (c !== camp.yard) c.visible = day > 6 + (i % 20); });
    camp.yard.visible = day > 150 && day < 548;
    lights.visible = day > 20 && day < 640;
    lights.children.forEach((l) => { if (l.material === S.lamp) l.visible = night > 0.3; });

    // trucks
    trucks.forEach((tr, i) => {
      const on = day > 6 + i * 2 && day < 600 - i * 3;
      tr.visible = on;
      if (!on) return;
      const path = tr.userData.path;
      const u = (tr.userData.off + t * tr.userData.speed) % 1;
      const p = path.getPointAt(u), q = path.getTangentAt(u);
      tr.position.copy(p);
      tr.rotation.y = Math.atan2(-q.z, q.x);
      tr.userData.hl.visible = night > 0.3;
    });

    // sparks at structure tops at night
    const sp = sparks.geometry.attributes.position;
    let n = 0;
    if (night > 0.3) {
      const active = BUILDINGS.filter((b) => day > b.sched.st0 && day < b.sched.fa1);
      for (let i = 0; i < sparkN && active.length; i++) {
        const b = active[(i * 7) % active.length];
        const P = b._parts[i % b._parts.length].part;
        const ph = Math.floor(t * 12 + i * 3.7);
        const r1 = Math.abs(Math.sin(ph * 12.9898 + i * 78.233)) % 1, r2 = Math.abs(Math.sin(ph * 39.3468 + i * 11.135)) % 1;
        const s = b.sched;
        const kSt = lin(day, s.st0, s.st1);
        const y = day < s.fa0 ? kSt * b.height : b.height * (1 - lin(day, s.fa0, s.fa1));
        if (r1 > 0.55) continue;
        sp.setXYZ(n++, P.cx + (r2 - 0.5) * P.w, y + r1 * 2, P.cz + (r1 - 0.25) * P.d);
      }
    }
    for (let i = n; i < sparkN; i++) sp.setXYZ(i, 0, -1000, 0);
    sp.needsUpdate = true;
    sparks.material.opacity = night;
  }
  return { root, update, pitCount: pitList.length };
}





