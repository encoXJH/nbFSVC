import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SITE, SAT, ux, uz, MPP, U0, BUILDINGS } from './layout.js';
import { canvas, tex, rand, loadImage } from './textures.js';

export const coastX = (z) => 700 - 0.2 * z + 28 * Math.sin(z * 0.0042) + 14 * Math.sin(z * 0.013 + 1.3);
const DAYMAX = 700;

// ---------------------------------------------------------------- site canvases
const SC = 2; // canvas px per satellite px
const W = 1920 * SC, H = 1080 * SC;
const P = (x, y) => [x * SC, y * SC];

function rrect(g, x0, y0, x1, y1, r) {
  [x0, y0] = P(x0, y0); [x1, y1] = P(x1, y1); r *= SC;
  g.beginPath(); g.roundRect(x0, y0, x1 - x0, y1 - y0, r);
}
function poly(g, pts) { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(...P(x, y)) : g.moveTo(...P(x, y)))); g.closePath(); }
function stadium(g, t, inset = 0) {
  // stadium in metres -> canvas: straight along local y (north-south)
  const k = SC / MPP, r = (t.r - inset) * k, s = (t.straight / 2) * k;
  g.save(); g.translate(...P(t.cx, t.cy)); g.rotate((t.rot * Math.PI) / 180);
  g.beginPath(); g.moveTo(-r, -s); g.arc(0, -s, r, Math.PI, 0); g.lineTo(r, s); g.arc(0, s, r, 0, Math.PI); g.closePath();
  g.restore();
}
function trackDraw(g, t, red = '#b5523f', inner = '#4c8f3c') {
  const lanesW = t.lanes * t.w;
  g.fillStyle = red; stadium(g, { ...t, r: t.r + lanesW }); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 1.2;
  for (let i = 0; i <= t.lanes; i++) { stadium(g, { ...t, r: t.r + i * t.w }); g.stroke(); }
  g.fillStyle = inner; stadium(g, t); g.fill();
  // mowing stripes
  g.save(); stadium(g, t); g.clip();
  const k = SC / MPP;
  g.translate(...P(t.cx, t.cy)); g.rotate((t.rot * Math.PI) / 180);
  for (let i = -12; i < 12; i++) { g.fillStyle = i % 2 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'; g.fillRect(-60 * k, i * 6 * k, 120 * k, 6 * k); }
  g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 1.5;
  g.strokeRect(-34 * k, -52 * k, 68 * k, 104 * k);
  g.beginPath(); g.moveTo(-34 * k, 0); g.lineTo(34 * k, 0); g.stroke();
  g.beginPath(); g.arc(0, 0, 9 * k, 0, Math.PI * 2); g.stroke();
  g.strokeRect(-20 * k, -52 * k, 40 * k, 16 * k); g.strokeRect(-20 * k, 36 * k, 40 * k, 16 * k);
  g.restore();
}
const dayCol = (d) => { const v = Math.round((d / DAYMAX) * 255); return `rgb(${v},0,0)`; };
const haulCol = (d) => { const v = Math.round((d / DAYMAX) * 255); return `rgb(0,${v},0)`; };

export function buildSiteCanvases() {
  // final landscaping colour
  const [cf, g] = canvas(W, H);
  const [cd, gd] = canvas(W, H); // R: final day, G: haul-road day
  const [cm, gm] = canvas(W, H); // R: campus mask, G: water
  gd.fillStyle = '#000'; gd.fillRect(0, 0, W, H);
  gm.fillStyle = '#000'; gm.fillRect(0, 0, W, H);

  // campus base lawn
  g.fillStyle = '#5d8a3e'; poly(g, SITE.campus); g.fill();
  g.save(); poly(g, SITE.campus); g.clip();
  for (let i = 0; i < 26000; i++) { g.fillStyle = `rgba(${rand() < 0.5 ? '40,70,20' : '140,170,80'},${0.15 * rand()})`; g.fillRect(rand() * W, rand() * H, 3 + rand() * 9, 3 + rand() * 9); }
  g.restore();
  gd.fillStyle = dayCol(612); poly(gd, SITE.campus); gd.fill();
  gm.filter = 'blur(6px)'; gm.fillStyle = '#f00'; poly(gm, SITE.campus); gm.fill(); gm.filter = 'none';

  const pave = '#d3cdc1', asphalt = '#505357';
  const fillBoth = (shape, col, day) => { shape(g); g.fillStyle = col; g.fill(); shape(gd); gd.fillStyle = dayCol(day); gd.fill(); };

  // west plaza & inner paving of the teaching complex
  const ip = SITE.innerPave;
  fillBoth((c) => rrect(c, ip.x0, ip.y0, ip.x1, ip.y1, 18), pave, 585);
  const wp = SITE.westPlaza;
  fillBoth((c) => rrect(c, wp.x0, wp.y0, wp.x1, wp.y1, 6), pave, 590);
  // courtyards inside complex get lawns
  for (const [x0, y0, x1, y1] of [[640, 392, 735, 450], [779, 392, 864, 450], [640, 510, 735, 584], [779, 510, 864, 584]]) {
    rrect(g, x0, y0, x1, y1, 4); g.fillStyle = '#6a9446'; g.fill();
  }
  // ring road around the complex
  const rg = SITE.ring;
  for (const c of [g, gd]) { rrect(c, rg.x0, rg.y0, rg.x1, rg.y1, rg.r); c.lineWidth = rg.w * SC; c.strokeStyle = c === g ? asphalt : dayCol(548); c.stroke(); }
  g.setLineDash([12, 14]); g.lineWidth = 1.5; g.strokeStyle = 'rgba(255,255,255,0.7)'; rrect(g, rg.x0, rg.y0, rg.x1, rg.y1, rg.r); g.stroke(); g.setLineDash([]);
  // 护城河保留三座连接桥，风雨长廊旁的西侧水面不再设置桥梁。
  const MR = SITE.moatRing;
  const ringPath = (c, pad) => {
    const o = MR.outer, i = MR.inner;
    c.beginPath();
    c.roundRect(...P(o.x0 - pad, o.y0 - pad), (o.x1 - o.x0 + 2 * pad) * SC, (o.y1 - o.y0 + 2 * pad) * SC, (o.r + pad) * SC);
    c.roundRect(...P(i.x0 + pad, i.y0 + pad), (i.x1 - i.x0 - 2 * pad) * SC, (i.y1 - i.y0 - 2 * pad) * SC, Math.max(2, i.r - pad) * SC);
  };
  ringPath(g, 4); g.fillStyle = '#2f9a48'; g.fill('evenodd');
  ringPath(g, 0); g.fillStyle = '#28433f'; g.fill('evenodd');
  // pale stone coping on both banks keeps the continuous ring legible from the air
  ringPath(g, 1.2); g.strokeStyle = '#c6bda9'; g.lineWidth = 2.6 * SC; g.stroke();
  ringPath(gd, 4); gd.fillStyle = dayCol(572); gd.fill('evenodd');
  ringPath(gm, 0); gm.globalCompositeOperation = 'lighter'; gm.fillStyle = '#0f0'; gm.fill('evenodd'); gm.globalCompositeOperation = 'source-over';
  for (const br of MR.bridges) {
    const [x0, y0, x1, y1] = br;
    for (const c of [g, gd]) { c.fillStyle = c === g ? '#c7c6c0' : dayCol(560); c.fillRect(...P(x0, y0), (x1 - x0) * SC, (y1 - y0) * SC); }
    gm.globalCompositeOperation = 'multiply'; gm.fillStyle = '#f00'; gm.fillRect(...P(x0, y0), (x1 - x0) * SC, (y1 - y0) * SC); gm.globalCompositeOperation = 'source-over';
  }
  // inner ring road between the moat and the building, with parking bays on the long sides
  const IR = SITE.innerRoad;
  for (const c of [g, gd]) { rrect(c, IR.x0, IR.y0, IR.x1, IR.y1, IR.r); c.lineWidth = IR.w * SC; c.strokeStyle = c === g ? asphalt : dayCol(552); c.stroke(); }
  g.setLineDash([10, 12]); g.lineWidth = 1.2; g.strokeStyle = 'rgba(255,255,255,0.6)'; rrect(g, IR.x0, IR.y0, IR.x1, IR.y1, IR.r); g.stroke(); g.setLineDash([]);
  g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 1;
  for (const x of [IR.x0 + IR.w / 2 + 1, IR.x1 - IR.w / 2 - 9]) for (let y = IR.y0 + 30; y < IR.y1 - 30; y += 4.2) {
    if (Math.abs(y - 481) < 14) continue;
    g.beginPath(); g.moveTo(...P(x, y)); g.lineTo(...P(x + 8, y)); g.stroke();
  }
  for (const y of [IR.y0 + IR.w / 2 + 1, IR.y1 - IR.w / 2 - 9]) for (let x = IR.x0 + 40; x < IR.x1 - 40; x += 4.2) {
    if (Math.abs(x - 757) < 24) continue;
    g.beginPath(); g.moveTo(...P(x, y)); g.lineTo(...P(x, y + 8)); g.stroke();
  }
  // roads
  for (const pts of SITE.roads) {
    for (const c of [g, gd]) {
      c.beginPath(); c.moveTo(...P(...pts[0])); for (const p of pts.slice(1)) c.lineTo(...P(...p));
      c.lineCap = 'round'; c.lineWidth = 13 * SC; c.strokeStyle = c === g ? asphalt : dayCol(540); c.stroke();
    }
    g.beginPath(); g.moveTo(...P(...pts[0])); for (const p of pts.slice(1)) g.lineTo(...P(...p));
    g.setLineDash([10, 12]); g.lineWidth = 1.2; g.strokeStyle = 'rgba(255,255,255,0.6)'; g.stroke(); g.setLineDash([]);
  }
  // the two former approach roads beside the FSVC stone are now planted beds
  for (const pts of [[[495, 795], [680, 811]], [[834, 824], [960, 835]]]) {
    for (const c of [g, gd]) {
      c.beginPath(); c.moveTo(...P(...pts[0])); for (const p of pts.slice(1)) c.lineTo(...P(...p));
      c.lineCap = 'round';
      c.lineWidth = 20 * SC; c.strokeStyle = c === g ? '#6f8a4d' : dayCol(600); c.stroke();
      c.lineWidth = 15 * SC; c.strokeStyle = c === g ? '#4f7f3a' : dayCol(600); c.stroke();
    }
    const [a, b] = pts, L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const nx = -(b[1] - a[1]) / L, ny = (b[0] - a[0]) / L;
    for (let t = 5; t < L - 3; t += 5) for (const off of [-3.2, 3.2]) {
      const x = a[0] + ((b[0] - a[0]) * t) / L + nx * off;
      const y = a[1] + ((b[1] - a[1]) * t) / L + ny * off;
      g.beginPath(); g.arc(...P(x, y), 2.3 * SC, 0, Math.PI * 2);
      g.fillStyle = Math.round(t / 5) % 2 ? '#2f5a27' : '#6b9447'; g.fill();
    }
  }
  // front formal garden on the main axis
  // front boulevard on the main axis (school gate -> teaching building gate), fountain in the middle
  const fg = SITE.frontGarden, fo = SITE.fountain;
  fillBoth((c) => rrect(c, fg.x0, fg.y0, fg.x1, fg.y1, 12), pave, 600);
  for (const [x0, x1] of [[fg.x0 + 6, 724], [790, fg.x1 - 6]]) { rrect(g, x0, fg.y0 + 10, x1, fg.y1 - 10, 6); g.fillStyle = '#5e8f42'; g.fill(); }
  rrect(g, 727, fg.y0, 787, fg.y1, 2); g.fillStyle = '#cfc6b6'; g.fill();
  g.strokeStyle = 'rgba(150,120,100,0.55)'; g.lineWidth = 1.2 * SC;
  for (let y = fg.y0 + 6; y < fg.y1; y += 9) { g.beginPath(); g.moveTo(...P(729, y)); g.lineTo(...P(785, y)); g.stroke(); }
  g.fillStyle = '#b98f7c'; g.fillRect(...P(729, fg.y0), 3 * SC, (fg.y1 - fg.y0) * SC); g.fillRect(...P(782, fg.y0), 3 * SC, (fg.y1 - fg.y0) * SC);
  g.beginPath(); g.arc(...P(fo.x, fo.y), fo.plaza * SC, 0, Math.PI * 2); g.fillStyle = '#d8cfbf'; g.fill();
  g.lineWidth = 1.5 * SC; g.strokeStyle = '#b98f7c'; g.stroke();
  g.beginPath(); g.arc(...P(fo.x, fo.y), fo.plaza * 0.78 * SC, 0, Math.PI * 2); g.stroke();
  // sports facilities
  trackDraw(g, SITE.track1); stadium(gd, { ...SITE.track1, r: SITE.track1.r + 12 }); gd.fillStyle = dayCol(578); gd.fill();
  trackDraw(g, SITE.track2); stadium(gd, { ...SITE.track2, r: SITE.track2.r + 10 }); gd.fillStyle = dayCol(590); gd.fill();
  trackDraw(g, SITE.blueCourt, '#3e4fa6', '#4d8f45');
  stadium(gd, { ...SITE.blueCourt, r: SITE.blueCourt.r + 8 }); gd.fillStyle = dayCol(596); gd.fill();
  const ct = SITE.courts;
  fillBoth((c) => rrect(c, ct.x0, ct.y0, ct.x1, ct.y1, 2), '#4b8a52', 598);
  for (let i = 0; i < 6; i++) { const x = ct.x0 + 6 + i * 29; rrect(g, x, ct.y0 + 8, x + 24, ct.y1 - 8, 1); g.fillStyle = '#3a63a8'; g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 1; g.stroke(); }
  const kp = SITE.kidsPlay;
  // 操场上方原蓝色儿童活动区恢复为草地。
  fillBoth((c) => rrect(c, kp.x0, kp.y0, kp.x1, kp.y1, 8), '#5d8a3e', 604);
  for (const [x, y, r] of SITE.roundPlay) {
    for (const c of [g, gd]) { c.beginPath(); c.arc(...P(x, y), r * SC, 0, Math.PI * 2); c.fillStyle = c === g ? '#c8573f' : dayCol(604); c.fill(); }
    g.beginPath(); g.arc(...P(x, y), r * SC * 0.7, 0, Math.PI * 2); g.fillStyle = '#d7e6e8'; g.fill();
  }
  // small football pitch and two basketball courts in front of the south dorm
  {
    const RM = (m) => (m / MPP) * SC;
    const pf = { x0: 1004, y0: 732, x1: 1073, y1: 767 };
    fillBoth((c) => rrect(c, pf.x0 - 3, pf.y0 - 3, pf.x1 + 3, pf.y1 + 3, 2), '#4d8a45', 606);
    g.save(); rrect(g, pf.x0, pf.y0, pf.x1, pf.y1, 1); g.clip();
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? '#5c9a4e' : '#6baa5b';
      g.fillRect(...P(pf.x0, pf.y0 + (i * (pf.y1 - pf.y0)) / 8), (pf.x1 - pf.x0) * SC, ((pf.y1 - pf.y0) / 8) * SC);
    }
    g.restore();
    g.strokeStyle = 'rgba(255,255,255,0.92)'; g.lineWidth = 1.2;
    rrect(g, pf.x0 + 2, pf.y0 + 2, pf.x1 - 2, pf.y1 - 2, 0); g.stroke();
    const pfMx = (pf.x0 + pf.x1) / 2, pfMy = (pf.y0 + pf.y1) / 2;
    g.beginPath(); g.moveTo(...P(pfMx, pf.y0 + 2)); g.lineTo(...P(pfMx, pf.y1 - 2)); g.stroke();
    g.beginPath(); g.arc(...P(pfMx, pfMy), RM(3), 0, Math.PI * 2); g.stroke();
    for (const sx of [-1, 1]) {
      const bx = sx < 0 ? pf.x0 + 2 : pf.x1 - 2 - 15.5;
      g.strokeRect(...P(bx, pfMy - 13.8), 15.5 * SC, 27.6 * SC);
    }
    const bc = { x0: 1084, y0: 734, x1: 1182, y1: 764 };
    fillBoth((c) => rrect(c, bc.x0, bc.y0, bc.x1, bc.y1, 1.5), '#2f6a5d', 607);
    g.strokeStyle = 'rgba(255,255,255,0.88)'; g.lineWidth = 1.1;
    for (const [cx0, cx1] of [[1086, 1130], [1136, 1180]]) {
      rrect(g, cx0, 736, cx1, 762, 0); g.stroke();
      const mx = (cx0 + cx1) / 2;
      g.beginPath(); g.moveTo(...P(mx, 736)); g.lineTo(...P(mx, 762)); g.stroke();
      g.beginPath(); g.arc(...P(mx, 749), RM(1.8), 0, Math.PI * 2); g.stroke();
      for (const ex of [cx0, cx1]) {
        const kx0 = ex === cx0 ? ex + 1 : ex - 11;
        g.strokeRect(...P(kx0, 744.2), 10 * SC, 9.6 * SC);
        g.beginPath(); g.arc(...P(ex === cx0 ? ex + 11 : ex - 11, 749), RM(1.8), 0, Math.PI * 2); g.stroke();
      }
    }
  }
  for (const pk of SITE.parking) {
    fillBoth((c) => rrect(c, pk.x0, pk.y0, pk.x1, pk.y1, 2), asphalt, 560);
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1;
    for (let x = pk.x0 + 2; x < pk.x1; x += 4.3) { g.beginPath(); g.moveTo(...P(x, pk.y0 + 3)); g.lineTo(...P(x, pk.y0 + 12)); g.stroke(); g.beginPath(); g.moveTo(...P(x, pk.y1 - 12)); g.lineTo(...P(x, pk.y1 - 3)); g.stroke(); }
  }
  // haul roads & material yards during construction
  gd.lineCap = 'round';
  const haul = [[[757, 888], [757, 700], [560, 700], [560, 240], [960, 240], [960, 700], [757, 700]],
    [[560, 481], [200, 481]], [[300, 795], [300, 40]], [[960, 520], [1560, 520]], [[1205, 230], [1205, 845]], [[1000, 300], [1580, 300]]];
  for (const pts of haul) { gd.beginPath(); gd.moveTo(...P(...pts[0])); for (const p of pts.slice(1)) gd.lineTo(...P(...p)); gd.lineWidth = 14 * SC; gd.globalCompositeOperation = 'lighter'; gd.strokeStyle = haulCol(22); gd.stroke(); gd.globalCompositeOperation = 'source-over'; }
  for (const [x0, y0, x1, y1] of [[1040, 380, 1200, 700], [560, 730, 700, 860], [200, 600, 300, 700], [1300, 640, 1500, 760]]) {
    gd.globalCompositeOperation = 'lighter'; gd.fillStyle = haulCol(28); gd.fillRect(...P(x0, y0), (x1 - x0) * SC, (y1 - y0) * SC); gd.globalCompositeOperation = 'source-over';
  }
  const out = { final: tex(cf, { srgb: true }), day: tex(cd, { srgb: false }), mask: tex(cm, { srgb: false }) };
  // canvas row 0 is north; ground UV v=0 is north too, so disable the default flip
  Object.values(out).forEach((t) => { t.flipY = false; t.needsUpdate = true; });
  return out;
}

// ---------------------------------------------------------------- ground
const NOISE = /* glsl */`
float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<5;i++){ v+=a*vnoise(p); p*=2.03; a*=.5; } return v; }
`;

export const MAX_PITS = 80;

function roundedRectLoop(r, seg = 12) {
  const pts = [[r.x0 + r.r, r.y0]];
  const corners = [
    [r.x1 - r.r, r.y0 + r.r, -Math.PI / 2],
    [r.x1 - r.r, r.y1 - r.r, 0],
    [r.x0 + r.r, r.y1 - r.r, Math.PI / 2],
    [r.x0 + r.r, r.y0 + r.r, Math.PI],
  ];
  for (const [cx, cy, a0] of corners) {
    for (let j = 0; j <= seg; j++) {
      const a = a0 + (j / seg) * Math.PI / 2;
      pts.push([cx + Math.cos(a) * r.r, cy + Math.sin(a) * r.r]);
    }
  }
  pts.pop();
  return pts;
}

function expandedRect(r, pad) {
  return { x0: r.x0 - pad, y0: r.y0 - pad, x1: r.x1 + pad, y1: r.y1 + pad, r: Math.max(1, r.r + pad) };
}

function moatWallGeometry(loop, inner) {
  const pts = [...loop, loop[0]], pos = [], uv = [], idx = [];
  let length = 0;
  for (let i = 0; i < pts.length; i++) {
    if (i) length += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) * MPP;
    const x = ux(pts[i][0]), z = uz(pts[i][1]);
    pos.push(x, 0.06, z, x, -2.24, z);
    uv.push(length / 4, 0, length / 4, 1.15);
    if (i < pts.length - 1) {
      const a = i * 2;
      if (inner) idx.push(a, a + 2, a + 1, a + 2, a + 3, a + 1);
      else idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}

function moatBandGeometry(outer, inner, y) {
  const a = [...outer, outer[0]], b = [...inner, inner[0]], pos = [], uv = [], idx = [];
  let length = 0;
  for (let i = 0; i < a.length; i++) {
    if (i) length += Math.hypot(a[i][0] - a[i - 1][0], a[i][1] - a[i - 1][1]) * MPP;
    pos.push(ux(a[i][0]), y, uz(a[i][1]), ux(b[i][0]), y, uz(b[i][1]));
    uv.push(length / 2.4, 0, length / 2.4, 1);
    if (i < a.length - 1) {
      const k = i * 2;
      idx.push(k, k + 1, k + 2, k + 2, k + 1, k + 3);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}

function moatHorizontalGeometry(outer, inner, y) {
  const point = ([x, z]) => new THREE.Vector2(ux(x), -uz(z));
  const shape = new THREE.Shape(outer.map(point));
  shape.holes.push(new THREE.Path(inner.map(point).reverse()));
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI / 2); geo.translate(0, y, 0);
  return geo;
}

function moatStoneTexture() {
  const [c, g] = canvas(512, 256);
  g.fillStyle = '#777269'; g.fillRect(0, 0, 512, 256);
  for (let row = 0; row < 4; row++) {
    const off = row % 2 ? -64 : 0;
    for (let x = off; x < 512; x += 128) {
      const v = 154 + ((row * 17 + x / 8) % 20);
      g.fillStyle = `rgb(${v + 8},${v + 4},${v - 3})`;
      g.fillRect(x + 2, row * 64 + 2, 124, 60);
      g.fillStyle = 'rgba(255,255,255,.13)'; g.fillRect(x + 4, row * 64 + 4, 120, 3);
      g.fillStyle = 'rgba(40,35,30,.12)'; g.fillRect(x + 4, row * 64 + 56, 120, 3);
    }
  }
  return tex(c, { repeat: true });
}

function createBridges(MR, deckMat, railMat, supportMat) {
  const group = new THREE.Group(), deckGeos = [], railGeos = [], supportGeos = [];
  const profile = [
    [.13, 0], [.15, .05], [.15, .11], [.09, .16], [.075, .25],
    [.12, .36], [.12, .43], [.07, .52], [.075, .61], [.13, .66], [.13, .68],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const baluster = new THREE.LatheGeometry(profile, 10);
  const waterSpans = [
    [MR.outer.y0, MR.inner.y0], [MR.inner.y1, MR.outer.y1],
    [MR.outer.x0, MR.inner.x0], [MR.inner.x1, MR.outer.x1],
  ];

  MR.bridges.forEach(([x0, y0, x1, y1], index) => {
    const vertical = x1 - x0 < y1 - y0;
    const cx = (ux(x0) + ux(x1)) / 2, cz = (uz(y0) + uz(y1)) / 2;
    const length = vertical ? Math.abs(uz(y1) - uz(y0)) : Math.abs(ux(x1) - ux(x0));
    const width = vertical ? Math.abs(ux(x1) - ux(x0)) : Math.abs(uz(y1) - uz(y0));
    const box = (list, along, across, height, s, q, y) => {
      const geo = vertical ? new THREE.BoxGeometry(across, height, along) : new THREE.BoxGeometry(along, height, across);
      geo.translate(vertical ? cx + q : cx + s, y, vertical ? cz + s : cz + q);
      list.push(geo);
    };
    box(deckGeos, length, width, .30, 0, 0, -.01);
    for (const side of [-1, 1]) box(supportGeos, length, .32, .48, 0, side * (width / 2 - .65), -.38);

    const railLength = length - 8 * MPP, sections = Math.max(1, Math.ceil(railLength / 4.6));
    const sectionLength = railLength / sections;
    for (const side of [-1, 1]) {
      const q = side * (width / 2 - .22);
      box(railGeos, railLength, .30, .20, 0, q, .25);
      box(railGeos, railLength, .28, .16, 0, q, 1.09);
      for (let i = 0; i <= sections; i++) {
        const s = -railLength / 2 + i * sectionLength;
        box(railGeos, .54, .54, .16, s, q, .24);
        box(railGeos, .42, .42, 1.16, s, q, .74);
        box(railGeos, .56, .56, .10, s, q, 1.37);
      }
      for (let i = 0; i < sections; i++) {
        const start = -railLength / 2 + i * sectionLength;
        const count = Math.max(2, Math.round(sectionLength / .58) - 1);
        for (let j = 1; j <= count; j++) {
          const s = start + (sectionLength * j) / (count + 1);
          const geo = baluster.clone();
          geo.translate(vertical ? cx + q : cx + s, .34, vertical ? cz + s : cz + q);
          railGeos.push(geo);
        }
      }
    }

    const [a, b] = waterSpans[index];
    for (const v of [a, b]) {
      const s = vertical ? uz(v) - cz : ux(v) - cx;
      box(supportGeos, .65, width - .5, 2.12, s, 0, -1.18);
    }
  });
  baluster.dispose();
  for (const [geos, mat] of [[deckGeos, deckMat], [railGeos, railMat], [supportGeos, supportMat]]) {
    const geo = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}

function createMoat(U) {
  const group = new THREE.Group(), MR = SITE.moatRing;
  const outer = roundedRectLoop(MR.outer), inner = roundedRectLoop(MR.inner);
  const stone = moatStoneTexture();
  const wallMat = new THREE.MeshStandardMaterial({ map: stone, color: 0xd0cbc0, roughness: 0.93 });
  wallMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vMoatW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvMoatW=(modelMatrix*vec4(transformed,1.)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vMoatW;')
      .replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb*=mix(.58,1.,smoothstep(-1.08,-.48,vMoatW.y));');
  };
  const capMat = new THREE.MeshStandardMaterial({ map: stone, color: 0xe4dccb, roughness: 0.86 });
  capMat.onBeforeCompile = (sh) => {
    sh.uniforms.uDay = U.day;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uDay;')
      .replace('#include <map_fragment>', 'if(uDay<548.) discard;\n#include <map_fragment>');
  };
  for (const [loop, isInner] of [[outer, false], [inner, true]]) {
    const wall = new THREE.Mesh(moatWallGeometry(loop, isInner), wallMat);
    wall.castShadow = wall.receiveShadow = true; group.add(wall);
  }
  const capWidth = 1.55;
  for (const [a, b] of [
    [roundedRectLoop(expandedRect(MR.outer, capWidth)), outer],
    [inner, roundedRectLoop(expandedRect(MR.inner, -capWidth))],
  ]) {
    const cap = new THREE.Mesh(moatBandGeometry(a, b, 0.13), capMat);
    cap.receiveShadow = true; group.add(cap);
  }
  const bed = new THREE.Mesh(moatHorizontalGeometry(outer, inner, -2.2),
    new THREE.MeshStandardMaterial({ color: 0x384337, roughness: 1 }));
  bed.receiveShadow = true; group.add(bed);

  const waterMat = new THREE.MeshStandardMaterial({ color: 0x376e68, roughness: 0.16, metalness: 0.08, transparent: true, depthWrite: false });
  waterMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uDay: U.day, uTime: U.time, uSkyH: U.skyHorizon, uSkyZ: U.skyZenith, uSun: U.sunDir, uSunCol: U.sunColor, uNight: U.night });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvW=(modelMatrix*vec4(transformed,1.)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vW; uniform float uDay,uTime,uNight; uniform vec3 uSkyH,uSkyZ,uSun,uSunCol; ${NOISE}`)
      .replace('#include <map_fragment>', `
        diffuseColor.a*=smoothstep(566.,580.,uDay); if(diffuseColor.a<.01) discard;
        float ripple=fbm(vW.xz*.11+vec2(uTime*.025,-uTime*.018));
        diffuseColor.rgb=mix(vec3(.055,.17,.15),vec3(.11,.28,.24),ripple);`)
      .replace('#include <normal_fragment_maps>', `
        vec2 q=vW.xz*.16; float e=.35;
        float hx=fbm(q+vec2(e,0.)+uTime*.045)-fbm(q-vec2(e,0.)+uTime*.045);
        float hz=fbm(q+vec2(0.,e)-uTime*.035)-fbm(q-vec2(0.,e)-uTime*.035);
        normal=normalize(normal+(viewMatrix*vec4(hx*.24,0.,hz*.24,0.)).xyz);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        { vec3 V=normalize(cameraPosition-vW); float fr=.04+.96*pow(1.-max(V.y,0.),5.);
          vec3 R=reflect(-V,normalize(vec3(hx*.18,1.,hz*.18)));
          vec3 sky=mix(uSkyH,uSkyZ,pow(max(R.y,0.),.5));
          totalEmissiveRadiance+=(sky*fr*.38+uSunCol*pow(max(dot(R,normalize(uSun)),0.),260.)*1.8)*(1.-uNight*.35); }`);
  };
  const water = new THREE.Mesh(moatHorizontalGeometry(outer, inner, -0.95), waterMat);
  water.receiveShadow = true; water.renderOrder = 1; group.add(water);

  const bridgeMat = new THREE.MeshStandardMaterial({ color: 0xc7c6c0, roughness: 0.88 });
  const bridgeRailMat = new THREE.MeshStandardMaterial({ color: 0xeeede7, roughness: 0.72 });
  bridgeMat.onBeforeCompile = bridgeRailMat.onBeforeCompile = capMat.onBeforeCompile;
  group.add(createBridges(MR, bridgeMat, bridgeRailMat, capMat));
  return group;
}

export function createGround(satTex, site, U) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, {
      uSat: { value: satTex }, uFinal: { value: site.final }, uDayMap: { value: site.day }, uMask: { value: site.mask },
      uSat0: { value: new THREE.Vector2(SAT.x0, SAT.z0) }, uSat1: { value: new THREE.Vector2(SAT.x1, SAT.z1) },
      uDay: U.day, uWet: U.wet, uSkyH: U.skyHorizon, uPits: U.pits, uPitInfo: U.pitInfo, uNight: U.night,
    });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvW=(modelMatrix*vec4(transformed,1.)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vW; uniform sampler2D uSat,uFinal,uDayMap,uMask; uniform vec2 uSat0,uSat1;
      uniform float uDay,uWet,uNight; uniform vec3 uSkyH; uniform vec4 uPits[${MAX_PITS}]; uniform vec4 uPitInfo[${MAX_PITS}];
      float gWater=0.; ${NOISE}
      float coastX(float z){ return 700.-0.2*z+28.*sin(z*0.0042)+14.*sin(z*0.013+1.3); }`)
      .replace('#include <map_fragment>', `
      for(int i=0;i<${MAX_PITS};i++){ vec4 p=uPits[i]; vec4 q=uPitInfo[i]; if(q.y<0.01) continue;
        vec2 d=vW.xz-p.xy; float c=cos(q.x), s=sin(q.x); vec2 l=vec2(c*d.x-s*d.y, s*d.x+c*d.y);
        if(abs(l.x)<p.z && abs(l.y)<p.w) discard; }
      vec2 suv=(vW.xz-uSat0)/(uSat1-uSat0);
      float inSat=step(0.,suv.x)*step(suv.x,1.)*step(0.,suv.y)*step(suv.y,1.);
      float n=fbm(vW.xz*0.02), n2=fbm(vW.xz*0.15);
      vec3 proc=mix(vec3(0.30,0.36,0.20), vec3(0.42,0.43,0.28), n);
      proc=mix(proc, vec3(0.20,0.29,0.16), smoothstep(0.55,0.7,fbm(vW.xz*0.006+3.)));
      float cx=coastX(vW.z); float beach=smoothstep(cx-70.,cx-10.,vW.x);
      proc=mix(proc, vec3(0.78,0.70,0.55), beach);
      vec3 sat=texture2D(uSat,suv).rgb; sat=mix(sat, vec3(dot(sat,vec3(.3,.59,.11))), .18)*1.02;
      vec3 base=mix(proc, mix(proc, sat*vec3(1.02,1.0,0.94), 0.38), inSat*smoothstep(0.,.02,min(min(suv.x,1.-suv.x),min(suv.y,1.-suv.y))));
      base=mix(base, vec3(0.78,0.70,0.55), beach*step(.5,inSat)*0.8);
      vec4 msk=texture2D(uMask,suv)*inSat; vec4 dm=texture2D(uDayMap,suv);
      if(msk.g>.38 && uDay>510.+(n-.5)*12.) discard;
      vec3 natural=mix(vec3(0.62,0.53,0.38), vec3(0.45,0.47,0.30), smoothstep(.45,.7,n2*0.6+n*0.6));
      vec3 dirt=mix(vec3(0.55,0.42,0.30), vec3(0.47,0.36,0.26), n2); dirt*=0.92+0.16*vnoise(vW.xz*vec2(0.6,4.));
      float level=smoothstep(4.,32.,uDay+(n-.5)*30.);
      vec3 site=mix(natural,dirt,level);
      float haul=dm.g*${DAYMAX}.; if(haul>1. && uDay>haul) site=mix(site, vec3(0.66,0.60,0.52)*(0.9+0.2*n2), 0.85);
      float fday=dm.r*${DAYMAX}.; float f=smoothstep(fday, fday+14., uDay+(n-.5)*18.);
      vec4 fin=texture2D(uFinal,suv);
      site=mix(site, fin.rgb, f*step(1.,fday));
      gWater=msk.g*step(fday, uDay-2.)*f;
      base=mix(base, site, msk.r);
      base*=1.-uWet*0.38*(1.-gWater);
      diffuseColor.rgb*=base;`)
      .replace('#include <roughnessmap_fragment>', `float roughnessFactor=mix(roughness, 0.25, uWet*0.7); roughnessFactor=mix(roughnessFactor,0.06,gWater);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      { vec3 V=normalize(cameraPosition-vW); float fr=pow(1.-max(V.y,0.),4.);
        totalEmissiveRadiance+=uSkyH*fr*(gWater*0.9+uWet*0.35)*(1.-uNight*0.6); }`);
  };
  const geo = new THREE.PlaneGeometry(16000, 16000, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, mat);
  m.receiveShadow = true;
  const group = new THREE.Group();
  group.add(m, createMoat(U));
  return group;
}

// ---------------------------------------------------------------- sky
export function createSky(U) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uSun: U.sunDir, uZen: U.skyZenith, uHor: U.skyHorizon, uSunCol: U.sunColor, uCloud: U.cloud,
      uCloudCol: U.cloudColor, uStars: U.stars, uTime: U.time, uRain: U.rain },
    vertexShader: `varying vec3 vD; void main(){ vD=normalize((modelMatrix*vec4(position,0.)).xyz); gl_Position=projectionMatrix*viewMatrix*vec4((modelMatrix*vec4(position,1.)).xyz,1.); gl_Position.z=gl_Position.w*0.99999; }`,
    fragmentShader: `varying vec3 vD; uniform vec3 uSun,uZen,uHor,uSunCol,uCloudCol; uniform float uCloud,uStars,uTime,uRain; ${NOISE}
      void main(){ vec3 d=normalize(vD); float h=max(d.y,0.);
        vec3 col=mix(uHor,uZen,pow(h,0.55));
        col=mix(col, uHor*0.7, smoothstep(0.,-0.15,d.y));
        float sd=max(dot(d,normalize(uSun)),0.);
        col+=uSunCol*(pow(sd,900.)*25.+pow(sd,12.)*0.35+pow(sd,3.)*0.12)*(1.-uCloud*0.7);
        vec2 cp=d.xz/(d.y+0.12)*1.6+vec2(uTime*0.004,uTime*0.0015);
        float c=fbm(cp)*0.65+fbm(cp*3.1)*0.35;
        float cov=smoothstep(1.-uCloud*0.95-0.25, 1.05-uCloud*0.6, c)*smoothstep(-0.02,0.15,d.y);
        vec3 cc=uCloudCol*(0.75+0.5*fbm(cp*2.+3.))+uSunCol*pow(sd,6.)*0.6;
        col=mix(col, cc, cov*0.92);
        float st=step(0.9985, h21(floor(d.xz/(d.y+.3)*400.)))*uStars*smoothstep(0.05,0.3,d.y)*(1.-cov);
        col+=vec3(st);
        gl_FragColor=vec4(col,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(9000, 48, 24), mat);
  m.renderOrder = -10;
  m.frustumCulled = false;
  return m;
}

// ---------------------------------------------------------------- sea
export function createSea(U) {
  const mat = new THREE.MeshStandardMaterial({ color: 0x1f5b78, roughness: 0.12, metalness: 0.0 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uTime: U.time, uSkyH: U.skyHorizon, uSkyZ: U.skyZenith, uSun: U.sunDir, uSunCol: U.sunColor, uNight: U.night });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvW=(modelMatrix*vec4(transformed,1.)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vW; uniform float uTime,uNight; uniform vec3 uSkyH,uSkyZ,uSun,uSunCol; ${NOISE}
      float coastX(float z){ return 700.-0.2*z+28.*sin(z*0.0042)+14.*sin(z*0.013+1.3); }`)
      .replace('#include <map_fragment>', `if(vW.x<coastX(vW.z)-30.) discard;
        float shore=smoothstep(coastX(vW.z)-30., coastX(vW.z)+40., vW.x);
        diffuseColor.rgb=mix(vec3(0.45,0.62,0.6), vec3(0.08,0.24,0.33), shore);`)
      .replace('#include <normal_fragment_maps>', `
        vec2 q=vW.xz*0.05; float e=0.6;
        float hx=fbm(q+vec2(e,0.)+uTime*0.08)-fbm(q-vec2(e,0.)+uTime*0.08);
        float hz=fbm(q+vec2(0.,e)-uTime*0.06)-fbm(q-vec2(0.,e)-uTime*0.06);
        normal=normalize(normal+ (viewMatrix*vec4(hx*0.6,0.,hz*0.6,0.)).xyz);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        { vec3 V=normalize(cameraPosition-vW); float fr=0.04+0.96*pow(1.-max(V.y,0.),5.);
          vec3 R=reflect(-V, normalize(vec3(0.,1.,0.)+vec3((fbm(vW.xz*0.03+uTime*0.05)-.5)*0.25,0.,(fbm(vW.xz*0.03-uTime*0.04)-.5)*0.25)));
          vec3 sky=mix(uSkyH,uSkyZ,pow(max(R.y,0.),0.5));
          totalEmissiveRadiance+=sky*fr*0.9 + uSunCol*pow(max(dot(R,normalize(uSun)),0.),300.)*3.;
          shore*=1.; }`);
  };
  const geo = new THREE.PlaneGeometry(12000, 14000, 1, 1);
  geo.rotateX(-Math.PI / 2);
  geo.translate(5000, 0.25, 0);
  return new THREE.Mesh(geo, mat);
}

// ---------------------------------------------------------------- far hills & islands
export function createHills() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x4b5e45, roughness: 1, flatShading: true });
  const geo = new THREE.CylinderGeometry(1, 1, 1, 160, 6, true);
  const pos = geo.attributes.position;
  // ring of ridges at 3-5.5 km; skip the sea (east) sector
  const ridge = new THREE.BufferGeometry();
  const verts = [], idx = [];
  const segs = 220, R0 = 3600, R1 = 5600;
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const east = Math.cos(a);
    const hScale = east > 0.35 ? 0.05 : 1;
    const hgt = (180 + 260 * Math.abs(Math.sin(a * 3.1) * Math.sin(a * 7.3 + 1)) + 90 * Math.sin(a * 23.0)) * hScale;
    const r0 = R0 + 400 * Math.sin(a * 5), r1 = R1;
    verts.push(Math.cos(a) * r0, 0, Math.sin(a) * r0, Math.cos(a) * (r0 + 600), hgt, Math.sin(a) * (r0 + 600), Math.cos(a) * r1, hgt * 0.6, Math.sin(a) * r1);
    if (i < segs) { const b = i * 3; idx.push(b, b + 3, b + 1, b + 1, b + 3, b + 4, b + 1, b + 4, b + 2, b + 2, b + 4, b + 5); }
  }
  void pos;
  ridge.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  ridge.setIndex(idx); ridge.computeVertexNormals();
  g.add(new THREE.Mesh(ridge, mat));
  // headland & islands in the sea
  const isl = (x, z, r, h) => { const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 9, 1), mat); m.position.set(x, h / 2 - 2, z); m.scale.z = 0.6; g.add(m); };
  isl(1500, -400, 160, 40); isl(2300, 300, 90, 30); isl(2900, -900, 220, 70); isl(1200, 900, 120, 26);
  return g;
}

// ---------------------------------------------------------------- distant town
export function createTown(facadeTex, U) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ map: facadeTex.map, emissiveMap: facadeTex.emissive, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.9 });
  mat.onBeforeCompile = (sh) => { sh.uniforms.uNight = U.night; sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uNight;').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance*=uNight*2.2;'); };
  const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0);
  const N = 360;
  const im = new THREE.InstancedMesh(geo, mat, N);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  let k = 0;
  const clusters = [[-1500, -900, 500], [-1300, 800, 420], [100, -1700, 600], [-2200, 0, 700], [-500, 1600, 500]];
  for (const [cx, cz, r] of clusters) for (let i = 0; i < N / clusters.length && k < N; i++) {
    const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * r;
    p.set(cx + Math.cos(a) * d, 0, cz + Math.sin(a) * d);
    if (Math.abs(p.x) < 700 && Math.abs(p.z) < 450) continue;
    const tall = rand() < 0.2;
    s.set(16 + rand() * 24, tall ? 28 + rand() * 30 : 8 + rand() * 12, 12 + rand() * 16);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (rand() - 0.5) * 0.4);
    im.setMatrixAt(k++, m4.compose(p, q, s));
  }
  im.count = k;
  im.castShadow = false; im.receiveShadow = true;
  g.add(im);
  return g;
}

// ---------------------------------------------------------------- trees
function treeGeos() {
  const crownB = new THREE.IcosahedronGeometry(1, 0); crownB.scale(1, 1.1, 1); crownB.translate(0, 1.9, 0);
  const trunk = new THREE.CylinderGeometry(0.12, 0.16, 1.2, 5); trunk.translate(0, 0.6, 0);
  const crownP = new THREE.ConeGeometry(0.9, 2.6, 6); crownP.translate(0, 2.2, 0);
  const color = (geo, c) => { const n = geo.attributes.position.count; const a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c[0]; a[i * 3 + 1] = c[1]; a[i * 3 + 2] = c[2]; } geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); return geo; };
  const merge = (a, b) => {
    const g = new THREE.BufferGeometry();
    const A = a.toNonIndexed(), B = b.toNonIndexed();
    for (const k of ['position', 'normal', 'color']) {
      const arr = new Float32Array(A.attributes[k].array.length + B.attributes[k].array.length);
      arr.set(A.attributes[k].array); arr.set(B.attributes[k].array, A.attributes[k].array.length);
      g.setAttribute(k, new THREE.BufferAttribute(arr, 3));
    }
    return g;
  };
  return {
    broad: merge(color(trunk.clone(), [0.35, 0.25, 0.18]), color(crownB, [1, 1, 1])),
    pine: merge(color(trunk.clone(), [0.33, 0.24, 0.16]), color(crownP, [1, 1, 1])),
  };
}

export async function createTrees(satUrl) {
  const img = await loadImage(satUrl);
  const [c, g] = canvas(480, 270);
  g.drawImage(img, 0, 0, 480, 270);
  const data = g.getImageData(0, 0, 480, 270).data;
  const geos = treeGeos();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });
  const wild = [], planted = [];

  // ---- no-tree mask (satellite px, 1 canvas px = 1 sat px): footprints, sports, water, roads, plazas
  const MW = 1920, MH = 1080;
  const [mc, mg] = canvas(MW, MH);
  mg.fillStyle = '#000'; mg.fillRect(0, 0, MW, MH); mg.fillStyle = '#fff'; mg.strokeStyle = '#fff';
  const rr = (o, pad = 0, r = 4) => { mg.beginPath(); mg.roundRect(o.x0 - pad, o.y0 - pad, o.x1 - o.x0 + 2 * pad, o.y1 - o.y0 + 2 * pad, r + pad); mg.fill(); };
  for (const b of BUILDINGS) for (const p of b.parts) {
    const k = 1 / MPP, pad = 9;
    mg.save(); mg.translate(p.cx * k + U0.x, p.cz * k + U0.y); mg.rotate((p.rot * Math.PI) / 180);
    mg.fillRect(-(p.w * k) / 2 - pad, -(p.d * k) / 2 - pad, p.w * k + 2 * pad, p.d * k + 2 * pad); mg.restore();
  }
  const stad = (t, extra) => { const k = 1 / MPP, r = (t.r + (t.lanes || 5) * (t.w || 1.2)) * k + extra, s = (t.straight / 2) * k;
    mg.save(); mg.translate(t.cx, t.cy); mg.rotate((t.rot * Math.PI) / 180);
    mg.beginPath(); mg.moveTo(-r, -s); mg.arc(0, -s, r, Math.PI, 0); mg.lineTo(r, s); mg.arc(0, s, r, 0, Math.PI); mg.closePath(); mg.fill(); mg.restore(); };
  stad(SITE.track1, 10); stad(SITE.track2, 10); stad(SITE.blueCourt, 10);
  rr(SITE.courts, 6); rr(SITE.kidsPlay, 6); rr(SITE.westPlaza, 4); rr(SITE.frontGarden, 4);
  rr(SITE.moatRing.outer, 8, SITE.moatRing.outer.r);
  SITE.parking.forEach((p) => rr(p, 4));
  SITE.stone && (mg.beginPath(), mg.arc(SITE.stone.x, SITE.stone.y, 14, 0, Math.PI * 2), mg.fill());
  // 校门及牌匾前方保持净空，避免树冠遮挡入口视线。
  rr({ x0: SITE.schoolGate.x - 95, y0: SITE.schoolGate.y - 8, x1: SITE.schoolGate.x + 95, y1: SITE.schoolGate.y + 115 }, 0, 6);
  for (const [x, y, r] of SITE.roundPlay) { mg.beginPath(); mg.arc(x, y, r + 6, 0, Math.PI * 2); mg.fill(); }
  mg.beginPath(); mg.arc(SITE.flag.x, SITE.flag.y, 16, 0, Math.PI * 2); mg.fill();
  mg.lineCap = 'round';
  const ring = SITE.ring; mg.lineWidth = ring.w + 10; mg.beginPath(); mg.roundRect(ring.x0, ring.y0, ring.x1 - ring.x0, ring.y1 - ring.y0, ring.r); mg.stroke();
  mg.lineWidth = 22; for (const pts of SITE.roads) { mg.beginPath(); mg.moveTo(...pts[0]); pts.slice(1).forEach((p) => mg.lineTo(...p)); mg.stroke(); }
  // keep the ground between the C-dorm wings and the north field open
  rr({ x0: 205, y0: 586, x1: 500, y1: 735 }, 0); rr({ x0: 530, y0: 0, x1: 1200, y1: 205 }, 0);
  const md = mg.getImageData(0, 0, MW, MH).data;
  const blocked = (sx, sy) => { const x = Math.round(sx), y = Math.round(sy); if (x < 0 || y < 0 || x >= MW || y >= MH) return false; return md[(y * MW + x) * 4] > 128; };

  // ---- wild trees from satellite greenery outside the campus (sparser grid)
  const inPoly = (x, y, pts) => { let ins = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins; } return ins; };
  for (let y = 0; y < 270; y += 2) for (let x = 0; x < 480; x += 2) {
    const i = (y * 480 + x) * 4, r = data[i], gg = data[i + 1], b = data[i + 2];
    const green = gg - (r + b) / 2;
    if (green < 9 || gg > 150) continue;
    const sx = x * 4 + rand() * 8, sy = y * 4 + rand() * 8;
    if (inPoly(sx, sy, SITE.campus) || blocked(sx, sy)) continue;
    const forest = sx > 1460;
    if (rand() > (forest ? 0.42 : 0.35) * Math.min(1, (green - 6) / 16)) continue;
    wild.push({ x: ux(sx), z: uz(sy), s: 3 + rand() * 2.8, pine: forest || rand() < 0.25, dark: 0.6 + 0.3 * rand() });
  }
  // coastal pine belt beyond the satellite crop
  for (let i = 0; i < 900; i++) {
    const z = -1200 + rand() * 2200, x = 680 + rand() * 260;
    if (x > coastX(z) - 70 || (z > SAT.z0 && z < SAT.z1 && x < SAT.x1)) continue;
    wild.push({ x, z, s: 3 + rand() * 3.5, pine: true, dark: 0.55 + 0.3 * rand() });
  }
  // ---- planted campus trees: single rows of street trees, never on the main axis
  const along = (pts, step, off, day, sides = [-1, 1]) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
      const L = Math.hypot(x1 - x0, y1 - y0), nx = -(y1 - y0) / L, ny = (x1 - x0) / L;
      for (let t = step / 2; t < L; t += step) for (const sgn of sides) {
        const x = x0 + ((x1 - x0) * t) / L + nx * off * sgn, y = y0 + ((y1 - y0) * t) / L + ny * off * sgn;
        planted.push({ sx: x, sy: y, x: ux(x), z: uz(y), s: 2.5 + rand() * 0.9, pine: false, dark: 0.8 + 0.2 * rand(), day: day + rand() * 30, row: true });
      }
    }
  };
  along([[522, 481], [215, 481]], 17, 15, 595);
  along([[545, 212], [1600, 226]], 18, 15, 605, [1]);
  along([[960, 838], [1500, 848]], 18, 15, 600, [-1]);
  along([[495, 795], [680, 811]], 18, 15, 590, [1]);
  along([[1205, 226], [1205, 462]], 18, 14, 600);
  along([[1205, 622], [1205, 845]], 18, 14, 600);
  // flanking rows outside the boulevard lawns (frame the axis without blocking it)
  along([[668, 740], [668, 878]], 16, 0, 610, [1]);
  along([[846, 740], [846, 878]], 16, 0, 610, [1]);
  for (const [x0, y0, x1, y1, n] of [[1500, 640, 1600, 760, 8], [140, 560, 200, 760, 6]])
    for (let i = 0; i < n; i++) { const sx = x0 + rand() * (x1 - x0), sy = y0 + rand() * (y1 - y0); planted.push({ sx, sy, x: ux(sx), z: uz(sy), s: 2.6 + rand() * 1.2, pine: rand() < 0.3, dark: 0.8 + rand() * 0.2, day: 600 + rand() * 40 }); }
  for (let i = planted.length - 1; i >= 0; i--) if (blocked(planted[i].sx, planted[i].sy)) planted.splice(i, 1);
  for (let i = planted.length - 1; i >= 0; i--) {
    const t = planted[i];
    // rows may sit beside roads, but never on footprints, fields, water or the boulevard
    const hard = BUILDINGS.some((b) => b.parts.some((p) => { const dx = t.x - p.cx, dz = t.z - p.cz, a = (p.rot * Math.PI) / 180;
      const lx = Math.cos(a) * dx + Math.sin(a) * dz, lz = -Math.sin(a) * dx + Math.cos(a) * dz; return Math.abs(lx) < p.w / 2 + 5 && Math.abs(lz) < p.d / 2 + 5; }));
    const fg = SITE.frontGarden;
    if (hard || (t.sx > fg.x0 && t.sx < fg.x1 && t.sy > fg.y0 && t.sy < fg.y1)) planted.splice(i, 1);
  }

  // road clearance: no trunk, and no crown, may overlap the asphalt of any campus road
  const segDist = (px, py, x0, y0, x1, y1) => {
    const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy;
    const u = l2 > 0 ? Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / l2)) : 0;
    return Math.hypot(px - (x0 + u * dx), py - (y0 + u * dy));
  };
  const roundDist = (px, py, o) => {
    const hx = (o.x1 - o.x0) / 2, hy = (o.y1 - o.y0) / 2;
    const cx = (o.x0 + o.x1) / 2, cy = (o.y0 + o.y1) / 2;
    const qx = Math.abs(px - cx) - hx + o.r, qy = Math.abs(py - cy) - hy + o.r;
    return Math.abs(Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - o.r);
  };
  const clearRoads = (t) => {
    const sx = t.sx != null ? t.sx : t.x / MPP + U0.x;
    const sy = t.sy != null ? t.sy : t.z / MPP + U0.y;
    const crown = (t.pine ? 0.9 : 1) * t.s / MPP;
    const margin = 1.2;
    for (const pts of SITE.roads) {
      for (let i = 0; i < pts.length - 1; i++) {
        if (segDist(sx, sy, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]) < 6.5 + crown + margin) return false;
      }
    }
    if (roundDist(sx, sy, SITE.ring) < SITE.ring.w / 2 + crown + margin) return false;
    if (roundDist(sx, sy, SITE.innerRoad) < SITE.innerRoad.w / 2 + crown + margin) return false;
    return true;
  };
  for (const list of [wild, planted]) for (let i = list.length - 1; i >= 0; i--) if (!clearRoads(list[i])) list.splice(i, 1);

  const mk = (list, geo) => {
    const im = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
    list.forEach((t, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * 6.28);
      m4.compose(new THREE.Vector3(t.x, 0, t.z), q, new THREE.Vector3(t.s, t.s * (0.9 + rand() * 0.3), t.s));
      im.setMatrixAt(i, m4);
      col.setRGB(0.28 * t.dark, 0.45 * t.dark + 0.05 * rand(), 0.2 * t.dark);
      if (t.pine) col.setRGB(0.16 * t.dark, 0.33 * t.dark, 0.18 * t.dark);
      im.setColorAt(i, col);
    });
    im.castShadow = true; im.receiveShadow = true;
    return im;
  };
  const wildB = wild.filter((t) => !t.pine), wildP = wild.filter((t) => t.pine);
  const plB = planted.filter((t) => !t.pine), plP = planted.filter((t) => t.pine);
  const group = new THREE.Group();
  const meshes = { wildB: mk(wildB, geos.broad), wildP: mk(wildP, geos.pine), plB: mk(plB, geos.broad), plP: mk(plP, geos.pine) };
  Object.values(meshes).forEach((m) => group.add(m));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  const qs = [plB, plP].map((l) => l.map(() => q.clone().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * 6.28)));
  let lastDay = -1;
  group.userData.update = (day, time) => {
    if (Math.abs(day - lastDay) < 0.5) return;
    lastDay = day;
    [[plB, meshes.plB, qs[0]], [plP, meshes.plP, qs[1]]].forEach(([list, im, qq]) => {
      list.forEach((t, i) => {
        const k = THREE.MathUtils.smoothstep(day, t.day, t.day + 10);
        const s = Math.max(0.0001, k) * t.s;
        m4.compose(new THREE.Vector3(t.x, 0, t.z), qq[i], new THREE.Vector3(s, s, s));
        im.setMatrixAt(i, m4);
      });
      im.instanceMatrix.needsUpdate = true;
    });
    void time;
  };
  return group;
}

// ---------------------------------------------------------------- rain
export function createRain(U) {
  const N = 26000, pos = new Float32Array(N * 6), seedA = new Float32Array(N * 2 * 3);
  for (let i = 0; i < N; i++) {
    const x = rand(), y = rand(), z = rand();
    for (let k = 0; k < 2; k++) { seedA.set([x, y, z], (i * 2 + k) * 3); pos.set([0, k, 0], (i * 2 + k) * 3); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seedA, 3));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    uniforms: { uTime: U.time, uRain: U.rain, uCam: { value: new THREE.Vector3() }, uCol: U.skyHorizon },
    vertexShader: `attribute vec3 aSeed; uniform float uTime; uniform vec3 uCam; varying float vA;
      void main(){ float S=90.; vec3 p=aSeed*S;
        p.y=mod(p.y - uTime*38. , S); p.x=mod(p.x+uTime*4., S);
        vec3 w=uCam + p - vec3(S*.5);
        w.y-=position.y*1.4; w.x-=position.y*0.15;
        vA=1.-position.y*0.6;
        gl_Position=projectionMatrix*viewMatrix*vec4(w,1.); }`,
    fragmentShader: `uniform float uRain; uniform vec3 uCol; varying float vA; void main(){ gl_FragColor=vec4(mix(vec3(0.8,0.85,0.9),uCol,0.3), 0.35*uRain*vA); }`,
  });
  const m = new THREE.LineSegments(geo, mat);
  m.frustumCulled = false;
  m.renderOrder = 10;
  return m;
}





