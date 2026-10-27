import * as THREE from 'three';

const cache = new Map();
let seed = 12345;
export const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
export const setSeed = (s) => { seed = s; };

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
function tex(c, { repeat = false, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  else { t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; }
  return t;
}
function noise(ctx, w, h, amt, alpha = 0.06) {
  for (let i = 0; i < amt; i++) {
    const v = rand() < 0.5 ? 0 : 255;
    ctx.fillStyle = `rgba(${v},${v},${v},${alpha * rand()})`;
    ctx.fillRect(rand() * w, rand() * h, 1 + rand() * 3, 1 + rand() * 3);
  }
}

const STYLE = {
  castle: { wall: '#e9d7b0', wall2: '#dcc69c', base: '#a88880', win: '#2f4a63', frame: '#f4e8cc', bays: 4 },
  gate: { wall: '#e9d7b0', wall2: '#dcc69c', base: '#a88880', win: '#2f4a63', frame: '#f4e8cc', bays: 4 },
  atrium: { wall: '#e9d7b0', wall2: '#dcc69c', base: '#a88880', win: '#3d6683', frame: '#f4e8cc', bays: 4 },
  dorm: { wall: '#ecdcbc', wall2: '#e2cfa9', base: '#9f7b74', win: '#33475a', frame: '#f6ecd6', bays: 4 },
  arcade: { wall: '#e6d2ad', wall2: '#d9c19a', base: '#9c7a72', win: '#30485e', frame: '#f2e5c8', bays: 4 },
  modern: { wall: '#e4e4e0', wall2: '#d3d5d6', base: '#8f9497', win: '#3b5b77', frame: '#f4f4f4', bays: 4 },
  colorful: { wall: '#f1efe9', wall2: '#e2e0da', base: '#9b9a96', win: '#36566f', frame: '#ffffff', bays: 4 },
  gym: { wall: '#d9dcdf', wall2: '#c9cdd1', base: '#8a8f94', win: '#2f5776', frame: '#eef0f2', bays: 4 },
  stand: { wall: '#cfd2d4', wall2: '#bfc3c6', base: '#7f8488', win: '#555', frame: '#ddd', bays: 4 },
  ship: { wall: '#9a5a3c', wall2: '#86492f', base: '#5f3a2a', win: '#2a2a2a', frame: '#c58b5a', bays: 4 },
  dormC: { wall: '#b6c0bc', wall2: '#535b5d', base: '#34393b', win: '#3f6c88', frame: '#dfe3df', bays: 4 },
  podium: { wall: '#a88880', wall2: '#9a7a72', base: '#a3837b', win: '#3b3436', frame: '#d9c9a8', bays: 4 },
};
// optional palette overrides that keep the original style detailing
const TINT = {
  green: { wall: '#82ab80', wall2: '#6f9670', base: '#4f6753', frame: '#edf4e9' },
};

// Facade colour + emissive (night windows) textures covering the full height.
export function facadeTextures(style, floors, gfRatio, glass = false, tint = '') {
  const key = `${style}|${floors}|${gfRatio.toFixed(3)}|${glass}|${tint}`;
  if (cache.has(key)) return cache.get(key);
  const s = { ...(STYLE[style] || STYLE.castle), ...(TINT[tint] || {}) };
  const W = ['castle', 'gate', 'atrium', 'dormC'].includes(style) && !glass ? 1024 : 512, H = W * 2, bays = s.bays, bw = W / bays;
  const [c, g] = canvas(W, H);
  const [e, ge] = canvas(W, H);
  ge.fillStyle = '#000'; ge.fillRect(0, 0, W, H);
  // floor rows in canvas space (y down). Ground floor occupies gfRatio of height at the bottom.
  const gfH = H * gfRatio, fH = (H - gfH) / Math.max(1, floors - 1);
  const rowTop = (i) => (i === 0 ? H - gfH : H - gfH - i * fH); // top y of floor i
  const rowH = (i) => (i === 0 ? gfH : fH);
  const palette = ['#e8584a', '#f2b33d', '#57b36b', '#4a8fd6', '#ffffff'];

  if (style === 'dormC') {
    // reference photos: pale grey-green tile field, charcoal window surrounds and pilasters,
    // light frames, blue-grey glass, dark stone ground floor and a dark parapet band
    g.fillStyle = '#b6c0bc'; g.fillRect(0, 0, W, H);
    // fine ceramic tile joints
    g.strokeStyle = 'rgba(125,138,134,0.22)'; g.lineWidth = 1;
    if (fH > 1) for (let y = 0; y < H - gfH; y += fH / 10) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    for (let x = 0; x < W; x += bw / 8) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H - gfH); g.stroke(); }
    // weathered panel variation
    for (let i = 0; i < 70; i++) {
      g.fillStyle = `rgba(${rand() < 0.5 ? '255,255,255' : '70,80,78'},${0.02 + rand() * 0.025})`;
      g.fillRect(rand() * W, rand() * (H - gfH), 20 + rand() * 90, 20 + rand() * 140);
    }
    noise(g, W, H, 3000, 0.04);
    // dark stone ground floor
    g.fillStyle = '#34393b'; g.fillRect(0, H - gfH, W, gfH);
    g.strokeStyle = 'rgba(18,20,21,0.55)';
    for (let y = H - gfH; y < H; y += gfH / 4) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    for (let y = H - gfH, r = 0; y < H; y += gfH / 4, r++) for (let x = (r % 2) * 36; x < W; x += 72) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + gfH / 4); g.stroke(); }
    const frame = '#e2e6e2', glassTop = '#9fb6c1', glassBot = '#3f6a86';
    const win = (x, y, w, h, vent, lit) => {
      // charcoal surround, light stone frame, recessed glass
      g.fillStyle = '#4f5658'; g.fillRect(x - 11, y - 11, w + 22, h + 20);
      g.fillStyle = frame; g.fillRect(x - 5, y - 5, w + 10, h + 10);
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x - 11, y + h + 7, w + 22, 4);
      if (vent) {
        g.fillStyle = '#5c6161'; g.fillRect(x, y, w, h * 0.55);
        g.fillStyle = '#8c9190'; for (let k = 0; k < 6; k++) g.fillRect(x + 2, y + 3 + k * (h * 0.55 / 6), w - 4, 2);
        g.fillStyle = glassTop; g.fillRect(x, y + h * 0.6, w, h * 0.4);
      } else {
        const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, glassTop); gr.addColorStop(1, glassBot);
        g.fillStyle = gr; g.fillRect(x, y, w, h);
        g.fillStyle = 'rgba(255,255,255,0.2)'; g.beginPath(); g.moveTo(x, y + h * 0.75); g.lineTo(x + w * 0.55, y); g.lineTo(x + w, y); g.lineTo(x, y + h); g.fill();
        g.fillStyle = frame; g.fillRect(x + w / 2 - 2, y, 4, h); g.fillRect(x, y + h * 0.3, w, 3);
      }
      if (lit) { ge.fillStyle = `rgba(255,${205 + rand() * 30},${140 + rand() * 50},1)`; ge.fillRect(x, y, w, h); }
    };
    for (let i = 0; i < floors; i++) {
      const y = rowTop(i), h = rowH(i);
      if (i === 0) {
        // ground floor glazing with heavy charcoal mullions
        for (let b = 0; b < bays; b++) {
          const x = b * bw + bw * 0.12, w = bw * 0.76, wh = h * 0.5, wy = y + h * 0.3;
          g.fillStyle = '#202527'; g.fillRect(x - 9, wy - 9, w + 18, wh + 18);
          const gr = g.createLinearGradient(0, wy, 0, wy + wh); gr.addColorStop(0, glassTop); gr.addColorStop(1, '#22404f');
          g.fillStyle = gr; g.fillRect(x, wy, w, wh);
          g.fillStyle = frame; for (let k = 1; k < 4; k++) g.fillRect(x + (w * k) / 4 - 2, wy, 4, wh);
          g.fillRect(x, wy + wh * 0.55, w, 3);
          if (rand() < 0.6) { ge.fillStyle = 'rgba(255,214,150,0.9)'; ge.fillRect(x, wy, w, wh); }
        }
        continue;
      }
      for (let b = 0; b < bays; b++) {
        const x = b * bw, vent = b % 2 === 1;
        const ww = vent ? bw * 0.16 : bw * 0.28, wh = h * (vent ? 0.52 : 0.58);
        const wy = y + h * 0.19;
        win(x + bw * 0.5 - ww - 6, wy, ww, wh, vent, rand() < 0.5);
        win(x + bw * 0.5 + 6, wy, ww, wh, vent, rand() < 0.5);
      }
      // light string course between floors
      g.fillStyle = '#d3d9d5'; g.fillRect(0, y + h - 8, W, 5);
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, y + h - 3, W, 3);
    }
    // charcoal pilasters with a light edge, and the dark parapet
    g.fillStyle = '#4f5658';
    for (let b = 0; b <= bays; b++) g.fillRect(b * bw - 14, 0, 28, H - gfH);
    g.fillStyle = 'rgba(220,226,222,0.5)';
    for (let b = 0; b <= bays; b++) g.fillRect(b * bw - 14, 0, 3, H - gfH);
    // warm wall lanterns on alternate piers
    for (let b = 0; b <= bays; b += 2) {
      for (const i of [2, 4]) {
        if (i >= floors) continue;
        const ly = rowTop(i) + rowH(i) * 0.42, lx = b * bw;
        g.fillStyle = 'rgba(40,48,49,0.55)'; g.fillRect(lx - 3, ly - 10, 6, 4);
        g.fillStyle = '#3f4648'; g.fillRect(lx - 2, ly - 7, 4, 5);
        g.fillStyle = '#ffd89a'; g.fillRect(lx - 5, ly - 3, 10, 14);
        g.fillStyle = 'rgba(255,214,150,0.28)'; g.fillRect(lx - 9, ly - 6, 18, 20);
        ge.fillStyle = 'rgba(255,200,120,0.9)'; ge.fillRect(lx - 5, ly - 3, 10, 14);
      }
    }
    g.fillStyle = '#3d4345'; g.fillRect(0, 0, W, 18);
    g.fillStyle = '#cfd5d1'; g.fillRect(0, 18, W, 5);
    // white stone ledge above the dark base
    g.fillStyle = '#c9d0cc'; g.fillRect(0, H - gfH - 12, W, 9);
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(0, H - gfH - 3, W, 5);
    const res = { map: tex(c), emissive: tex(e), normal: normalFrom(c, 1.5) };
    cache.set(key, res);
    return res;
  }

  if (!glass && (style === 'castle' || style === 'gate' || style === 'atrium')) {
    // high-detail sandstone castle facade: ashlar joints, quoined pilasters, paired windows with sills and
    // keystones, arched top floor, heavy belt course and a rusticated pink-granite arcade base
    g.fillStyle = '#e8d6ae'; g.fillRect(0, 0, W, H);
    const stoneH = Math.max(8, fH / 4);
    g.strokeStyle = 'rgba(158,132,92,0.34)'; g.lineWidth = 1.5;
    for (let y = H - gfH, r = 0; y > 0; y -= stoneH, r++) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
      for (let x = (r % 2) * 32; x < W; x += 64) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - stoneH); g.stroke(); }
    }
    noise(g, W, H, 18000, 0.05);
    for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(120,95,60,${0.025 * rand()})`; g.fillRect(rand() * W, rand() * H, 4 + rand() * 30, 30 + rand() * 200); }
    // soft sun bleach at the top, deeper shade under the cornice
    const bleach = g.createLinearGradient(0, 0, 0, H);
    bleach.addColorStop(0, 'rgba(255,248,225,0.16)'); bleach.addColorStop(0.55, 'rgba(255,248,225,0.02)'); bleach.addColorStop(1, 'rgba(90,70,50,0.1)');
    g.fillStyle = bleach; g.fillRect(0, 0, W, H);
    // rusticated pink-granite arcade base
    g.fillStyle = '#a98a80'; g.fillRect(0, H - gfH, W, gfH);
    const baseRow = gfH / 5;
    g.strokeStyle = 'rgba(58,40,36,0.5)'; g.lineWidth = 2.2;
    for (let y = H - gfH + baseRow; y < H; y += baseRow) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    for (let y = H - gfH, r = 0; y < H; y += baseRow, r++) for (let x = (r % 2) * 46; x < W; x += 92) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + baseRow); g.stroke(); }
    for (let b = 0; b < bays; b++) {
      const x = b * bw, aw = bw * 0.5, ax = x + (bw - aw) / 2, ay = H - gfH + gfH * 0.16;
      // stone archivolt with rusticated voussoirs
      g.fillStyle = '#cdb49a'; g.beginPath(); g.moveTo(ax - 12, H); g.lineTo(ax - 12, ay + aw / 2); g.arc(ax + aw / 2, ay + aw / 2, aw / 2 + 12, Math.PI, 0); g.lineTo(ax + aw + 12, H); g.fill();
      g.strokeStyle = 'rgba(80,55,48,0.4)'; g.lineWidth = 1.6;
      for (let k = 1; k < 8; k++) {
        const a = Math.PI + (k / 8) * Math.PI;
        g.beginPath(); g.moveTo(ax + aw / 2 + Math.cos(a) * (aw / 2 - 4), ay + aw / 2 + Math.sin(a) * (aw / 2 - 4));
        g.lineTo(ax + aw / 2 + Math.cos(a) * (aw / 2 + 12), ay + aw / 2 + Math.sin(a) * (aw / 2 + 12)); g.stroke();
      }
      g.fillStyle = '#2e2a2c'; g.beginPath(); g.moveTo(ax, H); g.lineTo(ax, ay + aw / 2); g.arc(ax + aw / 2, ay + aw / 2, aw / 2, Math.PI, 0); g.lineTo(ax + aw, H); g.fill();
      const gg2 = g.createLinearGradient(0, ay, 0, H); gg2.addColorStop(0, '#8fabbc'); gg2.addColorStop(0.5, '#5d7f92'); gg2.addColorStop(1, '#324450');
      g.fillStyle = gg2; g.fillRect(ax + 8, ay + aw / 2, aw - 16, H - ay - aw / 2);
      g.fillStyle = '#3a3436'; g.fillRect(ax + aw / 2 - 3, ay + aw / 2, 6, H - ay - aw / 2);
      g.fillStyle = 'rgba(255,255,255,0.2)'; g.fillRect(ax + 12, ay + aw / 2 + 4, 5, H - ay - aw / 2 - 10);
      g.fillStyle = '#f0dfba'; g.beginPath(); g.moveTo(ax + aw / 2 - 13, ay - 12); g.lineTo(ax + aw / 2 + 13, ay - 12); g.lineTo(ax + aw / 2 + 9, ay + 16); g.lineTo(ax + aw / 2 - 9, ay + 16); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(ax + aw / 2 + 9, ay + 16, 4, 10);
      if (rand() < 0.75) { ge.fillStyle = 'rgba(255,214,150,0.95)'; ge.fillRect(ax + 8, ay + aw / 2, aw - 16, H - ay - aw / 2); }
    }
    // granite piers between the arches
    for (let b = 0; b <= bays; b++) {
      const x = b * bw - 18;
      g.fillStyle = '#b99a8d'; g.fillRect(x, H - gfH, 36, gfH);
      g.fillStyle = 'rgba(255,240,220,0.16)'; g.fillRect(x, H - gfH, 4, gfH);
      g.fillStyle = 'rgba(40,25,22,0.25)'; g.fillRect(x + 32, H - gfH, 4, gfH);
      for (let y = H - gfH + baseRow * 0.5, k = 0; y < H; y += baseRow * 0.5, k++) { g.fillStyle = k % 2 ? '#c9aa9c' : '#ad8d80'; g.fillRect(x + (k % 2) * 3, y, 36 - (k % 2) * 6, baseRow * 0.5 - 2); }
    }
    // pilasters with quoins at each bay edge
    for (let b = 0; b <= bays; b++) {
      const x = b * bw - 14;
      g.fillStyle = '#ddc8a0'; g.fillRect(x, 0, 28, H - gfH);
      for (let y = H - gfH, k = 0; y > 0; y -= stoneH, k++) { g.fillStyle = k % 2 ? '#f0dfba' : '#d6c098'; g.fillRect(x - (k % 2 ? 6 : 0), y - stoneH + 1, 28 + (k % 2 ? 12 : 0), stoneH - 2); }
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x + 28, 0, 5, H - gfH);
      // capital at every floor line
      for (let i = 1; i < floors; i++) {
        const cy = rowTop(i) + rowH(i) - 20;
        g.fillStyle = '#cbb185'; g.fillRect(x - 4, cy, 36, 8);
        g.fillStyle = '#f4e5c3'; g.fillRect(x - 4, cy - 3, 36, 3);
        g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x - 4, cy + 8, 36, 3);
      }
    }
    // floors: stone surrounds, pediments, balustrades and a richer window section
    for (let i = 1; i < floors; i++) {
      const y = rowTop(i), h = rowH(i), top = i === floors - 1;
      g.fillStyle = '#d8c39b'; g.fillRect(0, y + h - 10, W, 10);
      g.fillStyle = '#f1e2bd'; g.fillRect(0, y + h - 13, W, 3);
      g.fillStyle = 'rgba(0,0,0,0.26)'; g.fillRect(0, y + h - 2, W, 4);
      for (let b = 0; b < bays; b++) {
        const x = b * bw;
        for (const k of [0, 1]) {
          const ww = bw * 0.21, wh = h * 0.6, wx = x + bw * (k ? 0.55 : 0.21), wy = y + h * 0.18;
          // projecting stone surround, shadow reveal
          g.fillStyle = '#d6bd93'; g.fillRect(wx - 14, wy - 14, ww + 28, wh + 24);
          g.fillStyle = '#f6e8c6'; g.fillRect(wx - 9, wy - 9, ww + 18, wh + 16);
          g.fillStyle = 'rgba(80,60,40,0.28)'; g.fillRect(wx + ww + 5, wy - 2, 4, wh + 4); g.fillRect(wx - 9, wy + wh + 5, ww + 18, 3);
          if (top) { g.fillStyle = '#f3e4c2'; g.beginPath(); g.arc(wx + ww / 2, wy, ww / 2 + 9, Math.PI, 0); g.fill(); }
          g.fillStyle = '#1f2a33';
          if (top) { g.beginPath(); g.arc(wx + ww / 2, wy, ww / 2, Math.PI, 0); g.fill(); }
          const wg = g.createLinearGradient(0, wy, 0, wy + wh); wg.addColorStop(0, '#94b3c7'); wg.addColorStop(0.5, '#4b6d85'); wg.addColorStop(1, '#293f50');
          g.fillStyle = wg; g.fillRect(wx, wy, ww, wh);
          g.fillStyle = 'rgba(255,255,255,0.22)'; g.beginPath(); g.moveTo(wx, wy + wh * 0.52); g.lineTo(wx + ww * 0.58, wy); g.lineTo(wx + ww, wy); g.lineTo(wx, wy + wh); g.fill();
          g.fillStyle = 'rgba(255,255,255,0.1)'; g.fillRect(wx + 3, wy + 3, ww - 6, wh * 0.12);
          g.fillStyle = '#efe2c2'; g.fillRect(wx + ww / 2 - 2, wy, 4, wh); g.fillRect(wx, wy + wh * 0.32, ww, 4);
          g.fillStyle = '#efe0ba'; g.fillRect(wx - 3, wy - 16, ww + 6, 6); g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(wx - 3, wy - 10, ww + 6, 2);
          // keystone
          g.fillStyle = '#f0dfb8'; g.beginPath(); g.moveTo(wx + ww / 2 - 8, wy - 12); g.lineTo(wx + ww / 2 + 8, wy - 12); g.lineTo(wx + ww / 2 + 5, wy + 8); g.lineTo(wx + ww / 2 - 5, wy + 8); g.fill();
          // sill with brackets
          g.fillStyle = '#cdb48a'; g.fillRect(wx - 16, wy + wh + 3, ww + 32, 8);
          g.fillStyle = '#f2e3c0'; g.fillRect(wx - 16, wy + wh + 1, ww + 32, 3);
          g.fillStyle = '#b99b72'; g.fillRect(wx - 12, wy + wh + 11, 8, 5); g.fillRect(wx + ww + 4, wy + wh + 11, 8, 5);
          g.fillStyle = 'rgba(0,0,0,0.24)'; g.fillRect(wx - 18, wy + wh + 16, ww + 36, 4);
          // stone pediment over alternate windows
          if (!top && i > 1 && (i + b + k) % 3 !== 0) {
            g.fillStyle = '#ead7ae';
            if ((i + k) % 2) { g.beginPath(); g.moveTo(wx - 10, wy - 16); g.lineTo(wx + ww / 2, wy - 30); g.lineTo(wx + ww + 10, wy - 16); g.fill(); }
            else { g.beginPath(); g.moveTo(wx - 10, wy - 16); g.quadraticCurveTo(wx + ww / 2, wy - 34, wx + ww + 10, wy - 16); g.fill(); }
            g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(wx - 10, wy - 16, ww + 20, 3);
          }
          // small stone balustrade under the sill on the middle floors
          if (i >= 2 && i <= 4) {
            g.fillStyle = '#d8c39c'; g.fillRect(wx - 10, wy + wh + 20, ww + 20, 4);
            g.fillStyle = '#e7d6b0';
            for (let q = 0; q < 4; q++) g.fillRect(wx - 4 + (q * (ww + 8)) / 3.4, wy + wh + 24, 5, 11);
            g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(wx - 10, wy + wh + 35, ww + 20, 3);
          }
          if (rand() < 0.5) { const warm = rand() < 0.8; ge.fillStyle = warm ? `rgba(255,${200 + rand() * 40},${130 + rand() * 50},1)` : 'rgba(215,232,255,1)'; ge.fillRect(wx, wy, ww, wh); }
        }
      }
      // wall lanterns on alternate bay piers (warm night glow)
      for (let b = 0; b <= bays; b += 2) {
        const lx = b * bw, ly = y + h * 0.34;
        g.fillStyle = 'rgba(60,45,35,0.5)'; g.fillRect(lx - 3, ly - 10, 6, 4);
        g.fillStyle = '#4b3a2c'; g.fillRect(lx - 2, ly - 7, 4, 5);
        g.fillStyle = '#ffd89a'; g.fillRect(lx - 5, ly - 3, 10, 14);
        g.fillStyle = 'rgba(255,214,150,0.35)'; g.fillRect(lx - 9, ly - 6, 18, 20);
        ge.fillStyle = 'rgba(255,200,120,0.9)'; ge.fillRect(lx - 5, ly - 3, 10, 14);
      }
    }
    // heavy belt course above the arcade, dentil cornice under the parapet
    const by = H - gfH;
    g.fillStyle = '#cdb48c'; g.fillRect(0, by - 22, W, 22);
    g.fillStyle = '#f0e0bc'; g.fillRect(0, by - 26, W, 6);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, by, W, 6);
    g.fillStyle = '#d2bb92'; g.fillRect(0, 0, W, 30);
    g.fillStyle = '#f2e3c0'; for (let x = 4; x < W; x += 16) g.fillRect(x, 30, 9, 11);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 41, W, 5);
    const res = { map: tex(c), emissive: tex(e), normal: normalFrom(c, 2.2) };
    cache.set(key, res);
    return res;
  }

  if (glass) {
    const grd = g.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#8fb5d2'); grd.addColorStop(0.5, '#4b7ba2'); grd.addColorStop(1, '#2f5a7c');
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,0.14)';
    for (let i = 0; i < 8; i++) { g.save(); g.translate(rand() * W, 0); g.rotate(0.35); g.fillRect(0, -200, 30 + rand() * 60, H * 1.5); g.restore(); }
    // sky reflected in the upper panes
    const sky = g.createLinearGradient(0, 0, 0, H * 0.38);
    sky.addColorStop(0, 'rgba(225,242,252,0.38)'); sky.addColorStop(0.5, 'rgba(190,218,236,0.12)'); sky.addColorStop(1, 'rgba(190,218,236,0)');
    g.fillStyle = sky; g.fillRect(0, 0, W, H * 0.38);
    // faint cloud streaks
    g.fillStyle = 'rgba(255,255,255,0.09)';
    for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(rand() * W, rand() * H * 0.3, 40 + rand() * 90, 10 + rand() * 26, 0, 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = '#c9d6df'; g.lineWidth = 3;
    for (let x = 0; x <= W; x += bw / 2) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    for (let i = 0; i < floors; i++) { const y = rowTop(i); g.fillStyle = '#9fb3c2'; g.fillRect(0, y - 3, W, 6); }
    g.fillStyle = s.base; g.fillRect(0, H - gfH * 0.35, W, gfH * 0.35);
    for (let i = 1; i < floors; i++) for (let b = 0; b < bays * 2; b++) {
      if (rand() < 0.45) { ge.fillStyle = `rgba(255,${210 + rand() * 30},${150 + rand() * 60},${0.5 + rand() * 0.5})`; ge.fillRect(b * bw / 2 + 4, rowTop(i) + 6, bw / 2 - 8, rowH(i) - 12); }
    }
  } else {
    g.fillStyle = s.wall; g.fillRect(0, 0, W, H);
    noise(g, W, H, 4000, 0.05);
    if (style === 'colorful') {
      for (let b = 0; b < bays; b++) if (rand() < 0.55) { g.fillStyle = palette[Math.floor(rand() * palette.length)]; g.fillRect(b * bw, 0, bw, H - gfH); }
    }
    // base / plinth
    g.fillStyle = s.base; g.fillRect(0, H - gfH, W, gfH);
    noise(g, W, H, 0, 0);
    for (let i = 0; i < floors; i++) {
      const y = rowTop(i), h = rowH(i);
      // floor cornice line
      g.fillStyle = s.wall2; g.fillRect(0, y - 2, W, 5);
      for (let b = 0; b < bays; b++) {
        const x = b * bw;
        // pilaster every other bay for classical rhythm
        if (style !== 'modern' && style !== 'colorful' && b % 2 === 0) { g.fillStyle = s.wall2; g.fillRect(x, y, 6, h); }
        let ww = bw * 0.42, wh = h * 0.58, wx = x + (bw - ww) / 2, wy = y + h * 0.2;
        if (style === 'modern' || style === 'colorful') { ww = bw * 0.8; wh = h * 0.55; wx = x + bw * 0.1; }
        if (style === 'dorm') { ww = bw * 0.5; }
        if (i === 0) {
          // ground floor: arches for classical styles, glass doors otherwise
          if (['castle', 'arcade', 'dorm', 'atrium', 'gate', 'podium'].includes(style)) {
            const aw = bw * 0.62, ax = x + (bw - aw) / 2, ay = y + h * 0.18, ah = h * 0.82;
            g.fillStyle = '#3b3436';
            g.beginPath(); g.moveTo(ax, y + h); g.lineTo(ax, ay + aw / 2); g.arc(ax + aw / 2, ay + aw / 2, aw / 2, Math.PI, 0); g.lineTo(ax + aw, y + h); g.fill();
            g.fillStyle = 'rgba(120,150,170,0.6)'; g.fillRect(ax + 6, ay + aw / 2, aw - 12, ah - aw / 2);
            if (rand() < 0.7) { ge.fillStyle = 'rgba(255,214,150,0.95)'; ge.fillRect(ax + 4, ay + aw / 2, aw - 8, ah - aw / 2); }
            continue;
          }
          wh = h * 0.7; wy = y + h * 0.25;
        }
        g.fillStyle = s.frame; g.fillRect(wx - 4, wy - 4, ww + 8, wh + 8);
        const wg = g.createLinearGradient(0, wy, 0, wy + wh);
        wg.addColorStop(0, '#6e8faa'); wg.addColorStop(1, s.win);
        g.fillStyle = wg; g.fillRect(wx, wy, ww, wh);
        g.fillStyle = s.frame; g.fillRect(wx + ww / 2 - 1.5, wy, 3, wh); g.fillRect(wx, wy + wh * 0.3, ww, 3);
        if ((style === 'dorm') && i > 0) { g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(wx - 6, wy + wh - 4, ww + 12, 6); }
        if (rand() < (style === 'dorm' ? 0.6 : 0.45)) {
          const warm = rand();
          ge.fillStyle = warm < 0.75 ? `rgba(255,${200 + rand() * 40},${130 + rand() * 60},1)` : 'rgba(220,235,255,1)';
          ge.fillRect(wx, wy, ww, wh);
        }
      }
    }
    // top parapet band
    g.fillStyle = s.wall2; g.fillRect(0, 0, W, 10);
  }
  const res = { map: tex(c), emissive: tex(e), normal: normalFrom(c, 1.4) };
  cache.set(key, res);
  return res;
}

// tangent-space normal map from luminance (dark = recessed)
export function normalFrom(src, strength = 1.5) {
  const w = src.width, h = src.height;
  const d = src.getContext('2d').getImageData(0, 0, w, h).data;
  const L = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) L[i] = (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11) / 255;
  const [c, g] = canvas(w, h); const img = g.createImageData(w, h); const o = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const xl = x > 0 ? x - 1 : x, xr = x < w - 1 ? x + 1 : x, yu = y > 0 ? y - 1 : y, yd = y < h - 1 ? y + 1 : y;
    const dx = (L[y * w + xr] - L[y * w + xl]) * strength, dy = (L[yd * w + x] - L[yu * w + x]) * strength;
    const n = 1 / Math.hypot(dx, dy, 1), k = (y * w + x) * 4;
    o[k] = (-dx * n * 0.5 + 0.5) * 255; o[k + 1] = (dy * n * 0.5 + 0.5) * 255; o[k + 2] = (n * 0.5 + 0.5) * 255; o[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return tex(c, { srgb: false });
}

// Weathered timber, stitched junk sails and the painted bow guardian for the campus ship.
export function shipTextures() {
  const key = 'ship-assets-v2';
  if (cache.has(key)) return cache.get(key);
  let seed = 918273;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  const [wc, wg] = canvas(1024, 512);
  wg.fillStyle = '#624733'; wg.fillRect(0, 0, 1024, 512);
  const rows = 12, rh = 512 / rows;
  const shades = ['#6d503b', '#74543d', '#654834', '#7b5940', '#5f4433', '#70503a'];
  for (let r = 0; r < rows; r++) {
    const y = r * rh;
    const gr = wg.createLinearGradient(0, y, 0, y + rh);
    gr.addColorStop(0, shades[r % shades.length]);
    gr.addColorStop(0.55, shades[(r + 2) % shades.length]);
    gr.addColorStop(1, '#4e382b');
    wg.fillStyle = gr; wg.fillRect(0, y, 1024, rh);
    // Long grain and worn streaks follow each horizontal strake.
    for (let k = 0; k < 65; k++) {
      const x = rnd() * 1024, yy = y + 3 + rnd() * (rh - 7), len = 25 + rnd() * 190;
      wg.strokeStyle = rnd() < 0.55 ? `rgba(37,25,18,${0.05 + rnd() * 0.13})` : `rgba(220,183,137,${0.025 + rnd() * 0.07})`;
      wg.lineWidth = 0.5 + rnd() * 1.4;
      wg.beginPath(); wg.moveTo(x, yy);
      wg.bezierCurveTo(x + len * 0.3, yy - 2 + rnd() * 4, x + len * 0.7, yy - 2 + rnd() * 4, x + len, yy);
      wg.stroke();
    }
    // Staggered board joints, end grain and paired iron fasteners.
    let x = (r % 3) * 71 + 95;
    while (x < 1024) {
      wg.fillStyle = 'rgba(35,24,18,0.62)'; wg.fillRect(x, y + 2, 2.4, rh - 3);
      wg.fillStyle = 'rgba(205,165,119,0.16)'; wg.fillRect(x + 2.4, y + 3, 1.2, rh - 5);
      for (const yy of [y + rh * 0.3, y + rh * 0.72]) {
        wg.fillStyle = '#2d2925'; wg.beginPath(); wg.arc(x - 8, yy, 2.1, 0, Math.PI * 2); wg.fill();
        wg.fillStyle = 'rgba(210,190,155,0.35)'; wg.beginPath(); wg.arc(x - 8.5, yy - 0.6, 0.75, 0, Math.PI * 2); wg.fill();
      }
      x += 205 + Math.floor(rnd() * 85);
    }
    wg.fillStyle = 'rgba(30,21,16,0.78)'; wg.fillRect(0, y + rh - 3, 1024, 3);
    wg.fillStyle = 'rgba(222,187,143,0.2)'; wg.fillRect(0, y + 1, 1024, 1.4);
  }
  for (let i = 0; i < 7000; i++) {
    const v = rnd() < 0.5 ? 25 : 225;
    wg.fillStyle = `rgba(${v},${v * 0.8},${v * 0.6},${rnd() * 0.055})`;
    wg.fillRect(rnd() * 1024, rnd() * 512, 1 + rnd() * 2, 1 + rnd() * 2);
  }

  const [dc, dg] = canvas(512, 512);
  dg.fillStyle = '#806247'; dg.fillRect(0, 0, 512, 512);
  for (let x = 0; x < 512; x += 42) {
    dg.fillStyle = (x / 42) % 2 ? '#806248' : '#74573f'; dg.fillRect(x, 0, 42, 512);
    dg.fillStyle = 'rgba(40,28,20,0.65)'; dg.fillRect(x, 0, 2, 512);
    for (let k = 0; k < 22; k++) {
      dg.strokeStyle = `rgba(44,30,20,${0.05 + rnd() * 0.12})`; dg.lineWidth = 1;
      const xx = x + 4 + rnd() * 34, yy = rnd() * 512;
      dg.beginPath(); dg.moveTo(xx, yy); dg.lineTo(xx + rnd() * 3, yy + 30 + rnd() * 100); dg.stroke();
    }
  }

  const [sc, sg] = canvas(512, 1024);
  const sailGrad = sg.createLinearGradient(0, 0, 512, 1024);
  sailGrad.addColorStop(0, '#d8c8a8'); sailGrad.addColorStop(0.5, '#c9b795'); sailGrad.addColorStop(1, '#b6a07d');
  sg.fillStyle = sailGrad; sg.fillRect(0, 0, 512, 1024);
  for (let x = 0; x < 512; x += 64) {
    sg.fillStyle = (x / 64) % 2 ? 'rgba(255,246,218,0.075)' : 'rgba(76,54,32,0.045)'; sg.fillRect(x, 0, 64, 1024);
    sg.fillStyle = 'rgba(91,69,45,0.26)'; sg.fillRect(x, 0, 2, 1024);
    sg.fillStyle = 'rgba(245,229,191,0.22)'; sg.fillRect(x + 2, 0, 1, 1024);
  }
  for (let y = 42; y < 1024; y += 116) {
    sg.fillStyle = 'rgba(79,59,38,0.22)'; sg.fillRect(0, y, 512, 3);
    sg.fillStyle = 'rgba(245,230,197,0.22)'; sg.fillRect(0, y + 3, 512, 2);
    sg.strokeStyle = 'rgba(75,55,35,0.25)'; sg.lineWidth = 1; sg.setLineDash([4, 5]);
    sg.beginPath(); sg.moveTo(0, y + 8); sg.lineTo(512, y + 8); sg.stroke(); sg.setLineDash([]);
  }
  for (let i = 0; i < 6500; i++) {
    sg.fillStyle = rnd() < 0.5 ? `rgba(70,50,30,${rnd() * 0.055})` : `rgba(255,246,220,${rnd() * 0.09})`;
    sg.fillRect(rnd() * 512, rnd() * 1024, 1 + rnd() * 2, 1 + rnd() * 3);
  }
  sg.strokeStyle = 'rgba(83,61,39,0.55)'; sg.lineWidth = 8; sg.strokeRect(4, 4, 504, 1016);

  const [bc, bg] = canvas(512, 512);
  // Vermilion guardian painted directly on the wooden bow, like the reference installation.
  bg.lineJoin = 'round'; bg.lineCap = 'round';
  bg.beginPath(); bg.moveTo(256, 58);
  bg.bezierCurveTo(308, 76, 363, 89, 400, 139);
  bg.lineTo(374, 176); bg.bezierCurveTo(414, 221, 401, 292, 373, 333);
  bg.bezierCurveTo(348, 391, 303, 434, 256, 451);
  bg.bezierCurveTo(209, 434, 164, 391, 139, 333);
  bg.bezierCurveTo(111, 292, 98, 221, 138, 176);
  bg.lineTo(112, 139); bg.bezierCurveTo(149, 89, 204, 76, 256, 58); bg.closePath();
  bg.fillStyle = '#a84129'; bg.fill(); bg.strokeStyle = '#713021'; bg.lineWidth = 13; bg.stroke();
  bg.beginPath(); bg.moveTo(142, 160); bg.quadraticCurveTo(184, 104, 238, 137);
  bg.moveTo(274, 137); bg.quadraticCurveTo(328, 104, 370, 160);
  bg.strokeStyle = '#d07836'; bg.lineWidth = 22; bg.stroke();
  bg.beginPath(); bg.moveTo(137, 248); bg.quadraticCurveTo(106, 283, 139, 314);
  bg.moveTo(375, 248); bg.quadraticCurveTo(406, 283, 373, 314);
  bg.strokeStyle = '#cf6b32'; bg.lineWidth = 15; bg.stroke();
  for (const x of [190, 322]) {
    bg.fillStyle = '#f2e6c9'; bg.beginPath(); bg.arc(x, 213, 35, 0, Math.PI * 2); bg.fill();
    bg.strokeStyle = '#762c20'; bg.lineWidth = 7; bg.stroke();
    bg.fillStyle = '#2d2822'; bg.beginPath(); bg.arc(x + (x < 256 ? 5 : -5), 216, 12, 0, Math.PI * 2); bg.fill();
    bg.fillStyle = '#fff7dd'; bg.beginPath(); bg.arc(x + (x < 256 ? 1 : -9), 211, 4, 0, Math.PI * 2); bg.fill();
  }
  bg.beginPath(); bg.moveTo(256, 217); bg.lineTo(224, 286); bg.quadraticCurveTo(256, 309, 288, 286); bg.closePath();
  bg.fillStyle = '#7f3023'; bg.fill();
  bg.fillStyle = '#d07234'; bg.beginPath(); bg.ellipse(256, 274, 26, 18, 0, 0, Math.PI * 2); bg.fill();
  bg.beginPath(); bg.moveTo(135, 315); bg.quadraticCurveTo(256, 270, 377, 315);
  bg.quadraticCurveTo(354, 404, 256, 424); bg.quadraticCurveTo(158, 404, 135, 315); bg.closePath();
  bg.fillStyle = '#f0dfbd'; bg.fill(); bg.strokeStyle = '#70291f'; bg.lineWidth = 8; bg.stroke();
  bg.beginPath(); bg.moveTo(157, 326); bg.quadraticCurveTo(256, 299, 355, 326);
  bg.quadraticCurveTo(327, 382, 256, 397); bg.quadraticCurveTo(185, 382, 157, 326); bg.closePath(); bg.fillStyle = '#44231e'; bg.fill();
  bg.fillStyle = '#f4e8cc';
  for (const [x, y, dir] of [[179, 319, 1], [224, 308, 1], [288, 308, 1], [333, 319, 1], [208, 388, -1], [304, 388, -1]]) {
    bg.beginPath(); bg.moveTo(x - 13, y); bg.lineTo(x + 13, y); bg.lineTo(x, y + dir * 30); bg.closePath(); bg.fill();
  }

  const res = {
    wood: tex(wc, { repeat: true }), woodNormal: normalFrom(wc, 2.2),
    deck: tex(dc, { repeat: true }), sail: tex(sc), dragon: tex(bc),
  };
  res.deck.repeat.set(0.12, 0.12);
  cache.set(key, res);
  return res;
}

export function roofTexture(kind = 'flat') {
  const key = 'roof|' + kind;
  if (cache.has(key)) return cache.get(key);
  const [c, g] = canvas(256, 256);
  g.fillStyle = kind === 'gym' ? '#dfe3e6' : kind === 'deck' ? '#cdbfae' : '#9b9a96'; g.fillRect(0, 0, 256, 256);
  if (kind === 'deck') {
    g.strokeStyle = 'rgba(120,100,85,0.45)'; g.lineWidth = 2;
    for (let i = 0; i <= 256; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke(); }
    g.fillStyle = '#5f8a45'; g.fillRect(40, 40, 60, 24); g.fillRect(156, 180, 60, 24);
  }
  noise(g, 256, 256, 3000, 0.08);
  if (kind === 'gym') { g.fillStyle = '#b9c4cc'; for (let x = 0; x < 256; x += 16) g.fillRect(x, 0, 3, 256); }
  else if (kind === 'flat') {
    g.fillStyle = '#4b5a78';
    for (let i = 0; i < 3; i++) g.fillRect(20 + i * 70, 40, 50, 160);
    g.fillStyle = '#7d7c78'; g.fillRect(180, 200, 50, 40);
  }
  const t = tex(c, { repeat: true });
  cache.set(key, t);
  return t;
}

// Concrete frame tile: one bay x one floor, alpha-cut openings
export function skeletonTexture() {
  if (cache.has('skel')) return cache.get('skel');
  const [c, g] = canvas(128, 128);
  g.clearRect(0, 0, 128, 128);
  g.fillStyle = '#b7b4ad'; g.fillRect(0, 108, 128, 20);
  g.fillStyle = '#a9a69f'; g.fillRect(0, 0, 14, 128); g.fillRect(114, 0, 14, 128);
  g.fillStyle = 'rgba(90,70,60,0.5)'; g.fillRect(0, 104, 128, 4);
  const t = tex(c, { repeat: true });
  cache.set('skel', t);
  return t;
}

export function netTexture() {
  if (cache.has('net')) return cache.get('net');
  const [c, g] = canvas(128, 128);
  g.fillStyle = 'rgba(46,120,58,0.82)'; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(20,70,30,0.6)'; g.lineWidth = 1;
  for (let i = 0; i < 128; i += 6) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(128, i); g.stroke(); }
  g.fillStyle = 'rgba(230,230,210,0.85)'; g.fillRect(0, 0, 128, 5);
  g.fillStyle = 'rgba(200,170,40,0.9)'; g.fillRect(0, 120, 128, 6);
  const t = tex(c, { repeat: true });
  cache.set('net', t);
  return t;
}

export function latticeTexture() {
  if (cache.has('lat')) return cache.get('lat');
  const [c, g] = canvas(64, 64);
  g.clearRect(0, 0, 64, 64);
  g.strokeStyle = '#e8b31e'; g.lineWidth = 5;
  g.strokeRect(2, 2, 60, 60);
  g.beginPath(); g.moveTo(0, 0); g.lineTo(64, 64); g.stroke();
  const t = tex(c, { repeat: true });
  cache.set('lat', t);
  return t;
}

export function acTexture() {
  if (cache.has('ac')) return cache.get('ac');
  const [c, g] = canvas(64, 64);
  g.fillStyle = '#bcc5c1'; g.fillRect(0, 0, 64, 64);
  g.strokeStyle = '#7c8582'; g.lineWidth = 3; g.strokeRect(3, 3, 58, 58);
  g.fillStyle = '#8b9491';
  for (let y = 13; y < 55; y += 7) g.fillRect(9, y, 46, 3);
  g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(9, 8, 46, 3);
  const t = tex(c);
  cache.set('ac', t);
  return t;
}

export function bannerTexture(text, bg = '#c3161c', fg = '#ffffff') {
  const key = 'ban|' + text + bg;
  if (cache.has(key)) return cache.get(key);
  const [c, g] = canvas(1024, 96);
  g.fillStyle = bg; g.fillRect(0, 0, 1024, 96);
  g.fillStyle = fg; g.font = 'bold 60px "Noto Sans SC","Microsoft YaHei"'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 512, 50);
  const t = tex(c);
  cache.set(key, t);
  return t;
}

export function loadTexture(url, srgb = true) {
  return new Promise((res, rej) => new THREE.TextureLoader().load(url, (t) => {
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    res(t);
  }, undefined, rej));
}
export function loadImage(url) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
}
export { canvas, tex };




