// Campus layout traced from the 1920x1080 satellite crop (0.58 m per px).
// Satellite-pixel coordinates are converted to metres with the teaching
// building centre at the origin, +x east, +z south.
export const MPP = 0.58;
export const U0 = { x: 757, y: 481 };
export const ux = (x) => (x - U0.x) * MPP;
export const uz = (y) => (y - U0.y) * MPP;
export const SAT = { x0: ux(0), z0: uz(0), x1: ux(1920), z1: uz(1080) };

// Box part from a satellite pixel rect
const R = (x0, y0, x1, y1, extra = {}) => ({
  cx: (ux(x0) + ux(x1)) / 2, cz: (uz(y0) + uz(y1)) / 2,
  w: Math.abs(ux(x1) - ux(x0)), d: Math.abs(uz(y1) - uz(y0)), rot: 0, ...extra,
});
// Box part from centre/size in satellite px; rot in degrees (clockwise from above)
const C = (cx, cy, w, d, rot = 0, extra = {}) => ({ cx: ux(cx), cz: uz(cy), w: w * MPP, d: d * MPP, rot, ...extra });

// Schedules in days: ex0 excavation, fd0 foundation, st0..st1 structure, fa0..fa1 facade
const S = (ex0, fd0, st0, st1, fa0, fa1) => ({ ex0, fd0, st0, st1, fa0, fa1 });
const B1 = S(40, 95, 128, 300, 318, 432);   // teaching complex + library
const B2 = S(58, 112, 140, 312, 328, 452);  // west dorms / canteen / admin
const B3 = S(86, 140, 170, 330, 352, 470);  // east & south group

export const BUILDINGS = [];
const add = (b) => { BUILDINGS.push(b); return b; };

// ---------------- Teaching complex (8F, tall ground floor) ----------------
const TB = { style: 'castle', floors: 8, gf: 5.6, fh: 3.8, sched: B1, group: 'tb' };
add({ id: 'tb_n', name: '图书馆', ...TB, parts: [R(612, 345, 892, 386)], cranes: [[-55, -42], [55, -42]] });
add({ id: 'tb_s', name: '教学楼', ...TB, glass: true, parts: [R(612, 590, 892, 627)], cranes: [[-60, 72], [60, 72]] });
add({ id: 'tb_w', name: '教学楼', ...TB, parts: [R(603, 345, 634, 627), R(634, 455, 692, 506)], cranes: [[-70, 20]] });
add({ id: 'tb_e', name: '教学楼', ...TB, parts: [R(870, 345, 901, 627), R(814, 455, 870, 506)], cranes: [[70, -20]] });
add({ id: 'tb_hall', name: '五四大厅', ...TB, floors: 5, style: 'atrium', parts: [R(741, 386, 773, 590)] });
for (const [x0, y0] of [[690, 436], [777, 436], [690, 503], [777, 503]])
  add({ id: `tb_pv${x0}_${y0}`, ...TB, floors: 4, parts: [R(x0, y0, x0 + 44, y0 + 27)] });
const towers = [
  [601, 330, 636, 362, 2], [868, 330, 903, 362, 2], [601, 605, 636, 636, 2], [868, 605, 903, 636, 2],
  [722, 600, 745, 637, 3], [769, 600, 792, 637, 3],
  [686, 603, 707, 632, 1], [807, 603, 828, 632, 1],
  [684, 330, 702, 350, 1], [720, 332, 740, 352, 1], [774, 332, 794, 352, 1], [810, 330, 828, 350, 1],
  [601, 470, 636, 492, 1], [868, 470, 903, 492, 1],
];
towers.forEach(([x0, y0, x1, y1, extra], i) =>
  add({ id: `tb_t${i}`, ...TB, floors: 8 + extra, crenel: true, parts: [R(x0, y0, x1, y1)] }));
add({ id: 'tb_gate', name: '正门', ...TB, floors: 6, style: 'gate', parts: [R(745, 606, 769, 642)] });

// ---------------- West zone ----------------
const DORM = { style: 'dorm', floors: 9, gf: 4.5, fh: 3.1, sched: B2, group: 'west' };
[[418, 30], [388, 113], [352, 200], [322, 287]].forEach(([x, y], i) =>
  add({ id: `dorm_nw${i}`, name: '宿舍楼', ...DORM, parts: [C(x, y, 112, 30, 22)], cranes: [[ux(x) + 22, uz(y) - 24]] }));
add({ id: 'dorm_row', name: '宿舍楼', ...DORM, parts: [R(240, 366, 362, 402), R(368, 366, 490, 402)],
  cranes: [[ux(300), uz(352)], [ux(430), uz(352)]] });
add({ id: 'dorm_aux1', ...DORM, floors: 4, parts: [R(452, 158, 500, 196)] });
add({ id: 'dorm_aux2', ...DORM, floors: 4, parts: [R(500, 222, 540, 256)] });
add({ id: 'dorm_aux3', ...DORM, floors: 4, parts: [R(446, 285, 482, 320)] });
add({ id: 'admin', name: '行政楼', style: 'arcade', floors: 5, gf: 4.8, fh: 3.8, sched: B2, group: 'west',
  parts: [C(226, 480, 50, 100, 8)], cranes: [[ux(272), uz(470)]] });
add({ id: 'canteen', name: '食堂', style: 'arcade', floors: 3, gf: 5.5, fh: 4.6, sched: B2, group: 'west',
  parts: [R(346, 437, 475, 525)], cranes: [[ux(410), uz(424)]] });
add({ id: 'corridor', name: '风雨长廊', style: 'arcade', floors: 2, gf: 4.5, fh: 3.5, group: 'west',
  sched: S(300, 330, 360, 420, 440, 520), parts: [R(475, 473, 603, 487)] });

// C-shaped dorm (7F) as seven independent blocks linked by two-storey glazed corridors:
// two blocks on the north bar, two on the curved west end, three on the slanted south bar.
{
  const T = 26, cx = 218, cy = 637, r = 63;
  const arcSegs = (t0, t1, n) => {
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = t0 + ((t1 - t0) * i) / n, b = t0 + ((t1 - t0) * (i + 1)) / n, tm = (a + b) / 2;
      const x = cx - Math.sin(tm) * r, y = cy - Math.cos(tm) * r;
      const len = 2 * r * Math.sin((b - a) / 2) + 1.2;
      const rot = (Math.atan2(Math.sin(tm), -Math.cos(tm)) * 180) / Math.PI;
      out.push(C(x, y, len, T, rot));
    }
    return out;
  };
  const gapA = 5 / r;
  const arcN = arcSegs(0, Math.PI / 2 - gapA, 4);
  const arcS = arcSegs(Math.PI / 2 + gapA, Math.PI, 4);
  const CW = { ...DORM, style: 'dormC', floors: 7, sched: B2 };
  add({ id: 'dorm_c1', name: '宿舍楼', ...CW, doorFace: -1, parts: [R(364, 561, 490, 587)], cranes: [[ux(430), uz(550)]] });
  add({ id: 'dorm_c2', name: '宿舍楼', ...CW, parts: [R(228, 561, 354, 587)], cranes: [[ux(280), uz(550)]] });
  add({ id: 'dorm_c3', name: '宿舍楼', ...CW, parts: arcN, cranes: [[ux(170), uz(600)]] });
  add({ id: 'dorm_c4', name: '宿舍楼', ...CW, parts: arcS });
  add({ id: 'dorm_c5', name: '宿舍楼', ...CW, doorFace: -1, parts: [C(269.9, 709.6, 85.6, T, 10.44)] });
  add({ id: 'dorm_c6', name: '宿舍楼', ...CW, doorFace: -1, parts: [C(364.0, 726.9, 85.6, T, 10.44)], cranes: [[ux(360), uz(765)]] });
  add({ id: 'dorm_c7', name: '宿舍楼', ...CW, doorFace: -1, parts: [C(458.0, 744.2, 85.6, T, 10.44)] });
  const LINK = { style: 'modern', glass: true, floors: 3, gf: 4.0, fh: 3.2, group: 'west',
    link: true, sched: S(300, 330, 360, 420, 440, 520) };
  add({ id: 'dorm_l1', name: '连廊', ...LINK, parts: [R(354, 561, 364, 587)] });
  add({ id: 'dorm_l2', name: '连廊', ...LINK, parts: [R(218, 561, 228, 587)] });
  add({ id: 'dorm_l3', name: '连廊', ...LINK, parts: [C(155, 637, 10, T, 90)] });
  add({ id: 'dorm_l4', name: '连廊', ...LINK, parts: [C(222.9, 700.9, 10, T, 10.44)] });
  add({ id: 'dorm_l5', name: '连廊', ...LINK, parts: [C(316.96, 718.23, 10, T, 10.44)] });
  add({ id: 'dorm_l6', name: '连廊', ...LINK, parts: [C(411.0, 735.55, 10, T, 10.44)] });
}
// raised podium deck (2nd-floor platform) between the C-dorm wings and the ship
add({ id: 'podium', name: '二楼平台', style: 'podium', floors: 1, gf: 5.2, fh: 3, group: 'west',
  sched: S(70, 120, 150, 200, 340, 420), parts: [R(395, 588, 468, 720)] });
add({ id: 'ship', name: '船', style: 'ship', floors: 3, gf: 4, fh: 3.5, group: 'west',
  sched: S(380, 400, 420, 470, 480, 560), parts: [C(492, 652, 46, 14, -8)] });

// ---------------- East / south groups ----------------
const EAST = { floors: 5, gf: 4.5, fh: 3.8, sched: B3, group: 'east' };
add({ id: 'east_a', name: '实训楼', style: 'modern', ...EAST,
  parts: [R(1207, 240, 1300, 262), R(1207, 315, 1300, 337), R(1207, 262, 1232, 315), R(1276, 262, 1300, 315)],
  cranes: [[ux(1253), uz(226)]] });
add({ id: 'gym', name: '体育馆', style: 'gym', floors: 1, gf: 15, fh: 4, group: 'east',
  sched: S(86, 140, 170, 300, 525, 562), truss: { d0: 468, d1: 520 }, parts: [R(1305, 247, 1420, 337)] });
add({ id: 'east_c', name: '综合楼', style: 'modern', ...EAST,
  parts: [R(1440, 297, 1597, 333), R(1440, 395, 1597, 430), R(1440, 333, 1508, 395), R(1566, 333, 1597, 395)],
  cranes: [[ux(1520), uz(284)]] });
add({ id: 'east_d1', name: '实验楼', style: 'colorful', ...EAST, floors: 4, parts: [R(1375, 505, 1440, 600)], cranes: [[ux(1358), uz(552)]] });
add({ id: 'east_d2', style: 'colorful', ...EAST, floors: 4, parts: [R(1440, 535, 1530, 615)] });
add({ id: 'east_e', style: 'colorful', ...EAST, floors: 4, parts: [R(1370, 640, 1530, 700), R(1410, 700, 1520, 758)],
  cranes: [[ux(1420), uz(628)]] });
add({ id: 'dorm_s', name: '宿舍楼', ...DORM, tint: 'green', sched: B3, group: 'east',
  parts: [R(1000, 778, 1094, 814), R(1108, 778, 1205, 814)],
  cranes: [[ux(1047), uz(764)], [ux(1157), uz(764)]] });
// single grandstand on the far (east) side of the field, square to the field and the teaching building
add({ id: 'stand_e', name: '看台', style: 'stand', floors: 1, gf: 6.5, fh: 3, group: 'east',
  sched: S(480, 500, 510, 555, 570, 615), parts: [R(1201, 478, 1217, 606)] });

for (const b of BUILDINGS) {
  b.height = b.gf + (b.floors - 1) * b.fh;
  b.cranes = b.cranes || [];
}

// ---------------- Site plan (satellite px) ----------------
export const SITE = {
  campus: [[236, 0], [530, 0], [545, 212], [1200, 212], [1612, 226], [1614, 625], [1505, 848], [1320, 848],
    [1000, 838], [960, 888], [560, 888], [495, 795], [148, 795], [136, 560], [200, 420], [236, 0]],
  ring: { x0: 522, y0: 228, x1: 1000, y1: 724, r: 78, w: 16 },
  moatRing: {
    outer: { x0: 536, y0: 250, x1: 968, y1: 712, r: 56 },
    inner: { x0: 570, y0: 300, x1: 934, y1: 655, r: 24 },
    // 桥面包含两端引道，并与两侧道路略有重叠，避免出现草地断点。
    bridges: [[750, 232, 764, 314], [746, 650, 768, 720], [526, 470, 586, 492], [918, 474, 996, 488]],
  },
  innerRoad: { x0: 586, y0: 314, x1: 918, y1: 650, r: 18, w: 9 },
  innerPave: { x0: 582, y0: 312, x1: 922, y1: 648 },
  frontGarden: { x0: 680, y0: 733, x1: 834, y1: 884 },
  fountain: { x: 757, y: 772, r: 9, plaza: 26 },
  stone: { x: 757, y: 818 },
  schoolGate: { x: 757, y: 884 },
  flag: { x: 1022, y: 542 },
  track1: { cx: 1120, cy: 542, rot: 0, straight: 84.39, r: 36.5, lanes: 8, w: 1.22 },
  track2: { cx: 1292, cy: 612, rot: -13, straight: 62, r: 26, lanes: 6, w: 1.22 },
  blueCourt: { cx: 1341, cy: 399, straight: 50, r: 22, rot: 0 },
  courts: { x0: 1382, y0: 428, x1: 1560, y1: 515 },
  kidsPlay: { x0: 1206, y0: 342, x1: 1280, y1: 414 },
  roundPlay: [[1272, 760, 30], [1238, 736, 11], [1255, 800, 14]],
  parking: [{ x0: 1325, y0: 762, x1: 1475, y1: 832 }],
  westPlaza: { x0: 254, y0: 410, x1: 346, y1: 545 },
  roads: [
    [[757, 228], [757, 212]],
    [[522, 481], [205, 481]],
    [[1205, 226], [1205, 462]], [[1205, 622], [1205, 845]], [[545, 212], [1612, 226]],
    [[236, 338], [522, 338]], [[200, 545], [522, 545]], [[960, 838], [1505, 848]],
    [[1000, 300], [1205, 300]], [[1000, 716], [1205, 716]],
  ],
};


