// Edit decision list: everything in the film is a pure function of video time t (seconds).
export const FPS = 30;
export const DURATION = 127;
export const TOTAL_DAYS = 999;
// the build model runs on a 666-step schedule; HUD days/dates are shown on a 999-day calendar
export const SHOW_SCALE = 999 / 666;
export const START_DATE = new Date(Date.UTC(2023, 2, 1));

const ease = (x) => x * x * (3 - 2 * x);
const easeIO = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

// piecewise track: [[t, v], ...] with smooth interpolation
export function track(keys, t, fn = ease) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, v0] = keys[i], [t1, v1] = keys[i + 1];
    if (t <= t1) return v0 + (v1 - v0) * fn((t - t0) / (t1 - t0));
  }
  return keys[keys.length - 1][1];
}
const linF = (x) => x;

export const DAY = [[0, 666], [34, 666], [40, 1], [50, 40], [58, 135], [70, 330], [78, 466], [82, 520], [88, 565], [100, 640], [108, 666], [127, 666]];
export const TOD = [[0, 5.75], [10, 6.9], [19, 7.9], [27, 10], [30.5, 17.3], [33.5, 18.75], [35.5, 19.9], [39.5, 29.6], [44, 30.4], [50, 31.3],
  [58, 33.2], [70, 37.2], [78, 39.4], [81.5, 42.4], [84, 44.6], [86.4, 46.0], [88.4, 54.6], [90, 55.8], [100, 63.2], [108, 65.6], [116, 66.85], [127, 67.1]];
export const CLOUD = [[0, 0.32], [10, 0.3], [40, 0.3], [44, 0.45], [50, 0.62], [57, 0.55], [60, 0.28], [66, 0.35], [69.5, 0.92], [77, 0.95], [80, 0.55], [84, 0.3], [127, 0.3]];
export const RAIN = [[0, 0], [69.6, 0], [71, 1], [76.8, 1], [78.4, 0], [127, 0]];
export const WET = [[0, 0], [70, 0], [72, 1], [79, 1], [87, 0.1], [90, 0], [127, 0]];
export const FOG = [[0, 0.0011], [8, 0.0007], [30, 0.0006], [40, 0.0007], [42, 0.0013], [50, 0.0016], [57, 0.0011], [60, 0.0006], [69, 0.0008], [72, 0.0016], [78, 0.0011], [82, 0.0008], [127, 0.0007]];
export const CLOUD_SPEED = 1;

export function dayAt(t) { return track(DAY, t, (x) => (t > 34 && t < 40 ? easeIO(x) : x)); }
export function envAt(t) {
  return {
    day: dayAt(t), tod: track(TOD, t, linF) % 24, cloud: track(CLOUD, t), rain: track(RAIN, t), wet: track(WET, t), fog: track(FOG, t),
  };
}

export const CHAPTERS = [
  { t0: 40, t1: 50, no: '01', zh: '施工准备', en: 'SITE PREPARATION', weather: '晨 · 薄雾' },
  { t0: 50, t1: 58, no: '02', zh: '基坑与基础', en: 'EXCAVATION & FOUNDATIONS', weather: '阴 · 大雾' },
  { t0: 58, t1: 70, no: '03', zh: '主体结构', en: 'SUPERSTRUCTURE', weather: '晴' },
  { t0: 70, t1: 78, no: '04', zh: '雨季 · 外装', en: 'RAINY SEASON · FACADES', weather: '雨' },
  { t0: 78, t1: 82, no: '05', zh: '钢网架吊装', en: 'STEEL ROOF TRUSS', weather: '多云转晴' },
  { t0: 82, t1: 88, no: '06', zh: '夜以继日', en: 'THROUGH THE NIGHT', weather: '夜' },
  { t0: 88, t1: 100, no: '07', zh: '室外工程 · 运动场', en: 'SITE WORKS · SPORTS FIELDS', weather: '晴' },
  { t0: 100, t1: 108, no: '08', zh: '竣工验收', en: 'COMPLETION', weather: '晴 · 黄昏' },
];

export const CAPTIONS = [
  { t0: 11, t1: 18, zh: '教学主楼 · 城堡式建筑群', en: 'THE MAIN TEACHING COMPLEX' },
  { t0: 20, t1: 26.5, zh: '中轴线 · 正门广场', en: 'THE CENTRAL AXIS' },
  { t0: 89, t1: 95, zh: '运动场 · 先作材料堆场，最后铺设跑道', en: 'THE FIELD WAS A MATERIAL YARD FIRST' },
  { t0: 72, t1: 77, zh: '外架自上而下拆除，立面逐层显露', en: 'SCAFFOLDS COME DOWN, FACADES APPEAR' },
];
export const SLOGANS = [
  { t0: 60, t1: 66, text: '百年大计 · 质量第一' },
  { t0: 96, t1: 99.5, text: '厚德笃行 · 励学强技' },
];

// ----------------------------------------------------------- camera shots
// Each shot: positions/targets as Catmull-Rom control points, sampled with eased u.
export const SHOTS = [
  { t0: 0, t1: 10.5, pos: [[760, 22, 260], [640, 48, 300], [500, 85, 330]], tgt: [[1600, 60, -40], [900, 30, 60], [40, 18, 10]], fov: 42, e: 'io' },
  { t0: 10.5, t1: 19.5, orbit: { c: [0, 14, 0], r0: 235, r1: 205, a0: 25, a1: 128, h0: 72, h1: 52 }, fov: 40 },
  { t0: 19.5, t1: 27.5, pos: [[0, 36, 330], [0, 34, 275], [0, 30, 238], [0, 20, 224], [0, 10, 212], [0, 14, 192], [0, 42, 150], [0, 86, 60], [0, 118, -70]],
    tgt: [[0, 10, 190], [0, 8, 185], [0, 6, 190], [0, 4, 190], [0, 4, 172], [0, 8, 160], [0, 12, 80], [0, 8, -20], [0, -8, -140]], fov: 46, e: 'lin' },
  { t0: 27.5, t1: 40, pos: [[-160, 210, 360], [-150, 330, 470], [-120, 380, 520]], tgt: [[50, 0, -20], [60, 0, -30], [60, 0, -30]], fov: 40, e: 'io' },
  { t0: 40, t1: 50, pos: [[-40, 26, 265], [20, 38, 262], [90, 60, 245]], tgt: [[-100, 4, 168], [-75, 4, 140], [-10, 0, 50]], fov: 42, e: 'io' },
  { t0: 50, t1: 58, pos: [[230, 85, 210], [175, 62, 140], [130, 52, 110]], tgt: [[20, -6, 0], [0, -6, -10], [-20, -4, -20]], fov: 44, e: 'io' },
  { t0: 58, t1: 70, orbit: { c: [-20, 18, 0], r0: 250, r1: 230, a0: 135, a1: 245, h0: 95, h1: 120 }, fov: 42 },
  { t0: 70, t1: 78, pos: [[-40, 52, 210], [-70, 46, 235], [-110, 42, 255]], tgt: [[-240, 16, 20], [-250, 16, 10], [-250, 14, 0]], fov: 44, e: 'io' },
  { t0: 78, t1: 82, pos: [[285, 62, 45], [292, 70, 22], [300, 80, 0]], tgt: [[350, 12, -112], [350, 12, -112], [350, 12, -112]], fov: 42, e: 'io' },
  { t0: 82, t1: 88, pos: [[380, 200, 360], [250, 175, 420], [120, 160, 440]], tgt: [[20, 0, -10], [0, 0, -10], [-20, 0, -10]], fov: 42, e: 'io' },
  { t0: 88, t1: 100, pos: [[200, 18, 160], [270, 30, 120], [340, 70, 60], [380, 140, 70]], tgt: [[210, 0, 30], [210, 0, 30], [200, 0, 20], [120, 0, 0]], fov: 44, e: 'io' },
  { t0: 100, t1: 108, pos: [[90, 42, 330], [20, 50, 290], [-50, 62, 250]], tgt: [[0, 22, 60], [0, 22, 40], [10, 22, 20]], fov: 42, e: 'io' },
  { t0: 108, t1: 118, pos: [[470, 55, 170], [430, 80, 60], [360, 95, -20]], tgt: [[0, 25, 0], [-40, 25, 0], [-80, 25, 0]], fov: 40, e: 'io' },
  { t0: 118, t1: 127, pos: [[0, 95, 330], [0, 95, 318], [0, 95, 310]], tgt: [[0, 40, 0], [0, 40, 0], [0, 40, 0]], fov: 60, e: 'lin' },
];
export const PANO = { t0: 118.3, t1: 121.3, yawDeg: 0 };

export function chapterAt(t) { return CHAPTERS.find((c) => t >= c.t0 && t < c.t1); }
export function dateOf(day) {
  const d = new Date(START_DATE.getTime() + (Math.max(1, Math.round(day)) - 1) * 86400000);
  return `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${String(d.getUTCDate()).padStart(2, '0')}`;
}
export { ease, easeIO };








