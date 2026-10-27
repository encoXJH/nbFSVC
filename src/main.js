import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { BUILDINGS } from './layout.js';
import { buildSiteCanvases, createGround, createSky, createSea, createHills, createTown, createTrees, createRain, MAX_PITS } from './world.js';
import { createConstruction } from './construction.js';
import { facadeTextures, loadTexture, setSeed } from './textures.js';
import * as TL from './timeline.js';
import { createVehicleMode } from './vehicle-mode.js';

const W = window.innerWidth, H = window.innerHeight;
const BAR = 104; // letterbox bar height in px (~2.2:1 picture)
const ss = THREE.MathUtils.smoothstep;
const lerp = THREE.MathUtils.lerp;

setSeed(20231);
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xbfd0dd, 0.0008);
const camera = new THREE.PerspectiveCamera(42, W / H, 1, 20000);

const U = {
  day: { value: 0 }, wet: { value: 0 }, rain: { value: 0 }, night: { value: 0 }, time: { value: 0 }, cloud: { value: 0.3 }, stars: { value: 0 },
  sunDir: { value: new THREE.Vector3(1, 0.3, 0) }, sunColor: { value: new THREE.Color(1, 1, 1) },
  skyZenith: { value: new THREE.Color() }, skyHorizon: { value: new THREE.Color() }, cloudColor: { value: new THREE.Color() },
  pits: { value: Array.from({ length: MAX_PITS }, () => new THREE.Vector4()) },
  pitInfo: { value: Array.from({ length: MAX_PITS }, () => new THREE.Vector4()) },
};

const sun = new THREE.DirectionalLight(0xffffff, 3);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
Object.assign(sun.shadow.camera, { left: -560, right: 560, top: 560, bottom: -560, near: 10, far: 3000 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.6;
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(0xbcd4ff, 0x5a5040, 1.0);
scene.add(hemi);
const siteLights = [[-60, 40, 120], [80, 40, -100], [-250, 40, 0], [300, 40, -50], [200, 40, 150]].map(([x, y, z]) => {
  const l = new THREE.PointLight(0xffd7a0, 0, 380, 1.2); l.position.set(x, y, z); scene.add(l); return l;
});

let ready = false;
let vehicleMode = null;
let constr, trees, rain, sky, panoTex;

async function init() {
  const sat = await loadTexture('/assets/sat_ground.jpg');
  sat.flipY = false; sat.needsUpdate = true;
  const site = buildSiteCanvases();
  scene.add(createGround(sat, site, U));
  sky = createSky(U); scene.add(sky);
  scene.add(createSea(U));
  scene.add(createHills());
  scene.add(createTown(facadeTextures('modern', 8, 0.15), U));
  trees = await createTrees('/assets/sat.jpg'); scene.add(trees);
  constr = createConstruction(U); scene.add(constr.root);
  rain = createRain(U); scene.add(rain);
  panoTex = await loadTexture('/assets/pano_aerial_front.jpg');
  panoTex.wrapS = THREE.RepeatWrapping;
  gradePass.uniforms.tPano.value = panoTex;
  ready = true;
}

// ----------------------------------------------------------- post
const rt = new THREE.WebGLRenderTarget(W, H, { samples: 4, type: THREE.HalfFloatType });
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.35, 0.55, 0.9);
composer.addPass(bloom);
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null }, tPano: { value: null }, uSunUV: { value: new THREE.Vector2(0.5, 0.5) }, uSunVis: { value: 0 },
    uRay: { value: 0.3 }, uTime: { value: 0 }, uBar: { value: BAR / H }, uFade: { value: 0 }, uPano: { value: 0 }, uYaw: { value: 0 },
    uInvProj: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() }, uTint: { value: new THREE.Vector3(1, 1, 1) },
    uSat: { value: 1 }, uEndDim: { value: 0 }, uFlash: { value: 0 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: `
    uniform sampler2D tDiffuse, tPano; uniform vec2 uSunUV; uniform float uSunVis,uRay,uTime,uBar,uFade,uPano,uYaw,uSat,uEndDim,uFlash;
    uniform mat4 uInvProj, uCamWorld; uniform vec3 uTint; varying vec2 vUv;
    float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
    float vn(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
    float fbm(vec2 p){ float v=0.,a=.5; for(int i=0;i<5;i++){v+=a*vn(p);p*=2.;a*=.5;} return v; }
    void main(){
      vec3 c=texture2D(tDiffuse,vUv).rgb;
      // god rays toward the sun
      if(uSunVis>0.001){
        vec2 d=(uSunUV-vUv)/48.; vec2 p=vUv; float decay=1.; vec3 acc=vec3(0.);
        for(int i=0;i<48;i++){ p+=d; vec3 s=texture2D(tDiffuse,clamp(p,0.,1.)).rgb; float l=max(dot(s,vec3(.3,.59,.11))-0.82,0.); acc+=s*l*decay; decay*=0.965; }
        c+=acc*uRay*uSunVis/48.*6.;
      }
      // grade: gentle teal shadows / warm highlights
      float L=dot(c,vec3(.2126,.7152,.0722));
      c=mix(vec3(L),c,uSat);
      c*=uTint;
      c=mix(c, c*vec3(0.94,1.0,1.06), (1.-smoothstep(0.,.45,L))*0.6);
      c=mix(c, c*vec3(1.05,1.0,0.93), smoothstep(.5,1.,L)*0.5);
      // real panorama dissolve
      if(uPano>0.){
        vec4 ndc=vec4(vUv*2.-1.,1.,1.); vec4 v=uInvProj*ndc; v/=v.w; vec3 dir=normalize((uCamWorld*vec4(v.xyz,0.)).xyz);
        vec2 puv=vec2(atan(dir.x,-dir.z)/6.2831853+0.5+uYaw, asin(clamp(dir.y,-1.,1.))/3.14159265+0.5);
        vec3 pc=texture2D(tPano,puv).rgb;
        float n=fbm(vUv*vec2(6.,3.4))*0.75+fbm(vUv*28.)*0.25;
        float th=uPano*1.25-0.12;
        float m=smoothstep(th-0.03,th,n);
        float edge=smoothstep(0.06,0.,abs(n-th+0.015))*step(0.01,uPano)*step(uPano,0.99);
        c=mix(pc,c,m)+vec3(1.,.75,.4)*edge*1.6;
      }
      c+=uFlash;
      c*=1.-uEndDim*0.72;
      // vignette + grain
      vec2 q=vUv-.5; c*=1.-dot(q,q)*0.55;
      c+=(h21(vUv*vec2(1920.,1080.)+fract(uTime*7.31)*91.)-.5)*0.013;
      c*=1.-uFade;
      if(vUv.y<uBar||vUv.y>1.-uBar) c=vec3(0.);
      gl_FragColor=vec4(c,1.);
    }`,
};
const gradePass = new ShaderPass(GradeShader);
composer.addPass(new OutputPass());
composer.addPass(gradePass);

// ----------------------------------------------------------- sky / lighting model
const C = (h) => new THREE.Color(h);
const SKY = [
  // elevation(deg), zenith, horizon, sun colour, sun intensity, hemi sky, hemi ground, hemi I
  [-18, C(0x03060f), C(0x0b1222), C(0x000000), 0.0, C(0x1c2a48), C(0x0c0c10), 0.35],
  [-8, C(0x0b1530), C(0x2c3558), C(0x000000), 0.0, C(0x2e3f66), C(0x151519), 0.45],
  [-2, C(0x203a6e), C(0xd9805a), C(0xff6a30), 0.0, C(0x6a7aa8), C(0x3a3030), 0.65],
  [3, C(0x3a64a6), C(0xf2a46b), C(0xff9a50), 1.6, C(0x8fa6cf), C(0x5a4a3c), 0.85],
  [10, C(0x3c74bd), C(0xf2cfa2), C(0xffc58a), 2.8, C(0xa8c0e2), C(0x645646), 1.0],
  [25, C(0x2f6fc0), C(0xbcd6ec), C(0xfff0dc), 3.4, C(0xb8d0ef), C(0x6d6250), 1.05],
  [70, C(0x2a66b8), C(0xb4cfe8), C(0xffffff), 3.6, C(0xbcd4f2), C(0x706452), 1.1],
];
function skyAt(el) {
  let i = 0;
  while (i < SKY.length - 2 && el > SKY[i + 1][0]) i++;
  const a = SKY[i], b = SKY[i + 1];
  const k = THREE.MathUtils.clamp((el - a[0]) / (b[0] - a[0]), 0, 1);
  const L = (j) => (a[j].isColor ? a[j].clone().lerp(b[j], k) : lerp(a[j], b[j], k));
  return { zen: L(1), hor: L(2), sunC: L(3), sunI: L(4), hs: L(5), hg: L(6), hi: L(7) };
}
function sunVector(tod) {
  const lat = THREE.MathUtils.degToRad(26.1), dec = THREE.MathUtils.degToRad(8);
  const Hh = THREE.MathUtils.degToRad((tod - 12.2) * 15);
  const up = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(Hh);
  const east = -Math.cos(dec) * Math.sin(Hh);
  const north = Math.cos(lat) * Math.sin(dec) - Math.sin(lat) * Math.cos(dec) * Math.cos(Hh);
  return new THREE.Vector3(east, up, -north).normalize();
}

// ----------------------------------------------------------- camera
const v3 = (a) => new THREE.Vector3(...a);
function sampleShot(t) {
  const s = TL.SHOTS.find((x) => t >= x.t0 && t < x.t1) || TL.SHOTS[TL.SHOTS.length - 1];
  let u = THREE.MathUtils.clamp((t - s.t0) / (s.t1 - s.t0), 0, 1);
  const uu = s.e === 'lin' ? u : s.e === 'io' ? TL.ease(u) * 0.5 + u * 0.5 : u;
  let pos, tgt;
  if (s.orbit) {
    const o = s.orbit, a = THREE.MathUtils.degToRad(lerp(o.a0, o.a1, uu)), r = lerp(o.r0, o.r1, uu), h = lerp(o.h0, o.h1, uu);
    pos = new THREE.Vector3(o.c[0] + Math.sin(a) * r, h, o.c[2] + Math.cos(a) * r);
    tgt = v3(o.c);
  } else {
    if (!s._p) { s._p = new THREE.CatmullRomCurve3(s.pos.map(v3), false, 'centripetal'); s._t = new THREE.CatmullRomCurve3(s.tgt.map(v3), false, 'centripetal'); }
    pos = s._p.getPoint(uu); tgt = s._t.getPoint(uu);
  }
  // subtle handheld drift
  pos.x += Math.sin(t * 0.7) * 0.6; pos.y += Math.sin(t * 0.9 + 1) * 0.4;
  return { pos, tgt, fov: s.fov || 42 };
}

// ----------------------------------------------------------- HUD
const $ = (id) => document.getElementById(id);
const ui = { title: $('title'), caption: $('caption'), counter: $('counter'), chapter: $('chapter'), hudL: $('hudL'), hudR: $('hudR'), prog: $('prog'),
  big666: $('big666'), weather: $('weather'), slogan: $('slogan') };
const win = (t, a, b, f = 0.8) => Math.min(ss(t, a, a + f), 1 - ss(t, b - f, b));
function phaseText(day) {
  if (day < 4) return '场地移交 · 测量放线';
  if (day < 20) return '围挡搭设 · 临时设施';
  if (day < 40) return '场地平整 · 施工便道';
  const act = [];
  const counts = {};
  for (const b of BUILDINGS) {
    const s = b.sched;
    let p = null;
    if (day >= s.ex0 && day < s.fd0) p = '基坑开挖';
    else if (day >= s.fd0 && day < s.st0) p = '基础浇筑';
    else if (day >= s.st0 && day < s.st1) p = '主体结构';
    else if (day >= s.fa0 && day < s.fa1) p = '外立面装饰';
    if (p) counts[p] = (counts[p] || 0) + 1;
  }
  if (day > 468 && day < 520) counts['钢网架吊装'] = 9;
  if (day > 548 && day < 640) counts['道路 · 绿化 · 跑道'] = 8;
  if (day >= 640) return '竣工验收 · 交付使用';
  for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 2)) act.push(k);
  return act.join(' / ') || '设备安装 · 内部装修';
}
function setText(el, html) { if (el._h !== html) { el.innerHTML = html; el._h = html; } }
function updateHUD(t, env) {
  ui.title.style.opacity = win(t, 1.6, 8.6, 1.2);
  const cap = TL.CAPTIONS.find((c) => t >= c.t0 - 1 && t < c.t1 + 1);
  ui.caption.style.opacity = cap ? win(t, cap.t0, cap.t1, 0.8) : 0;
  if (cap) setText(ui.caption, `${cap.zh}<small>${cap.en}</small>`);
  const sl = TL.SLOGANS.find((c) => t >= c.t0 - 1 && t < c.t1 + 1);
  ui.slogan.style.opacity = sl ? win(t, sl.t0, sl.t1, 0.8) : 0;
  if (sl) setText(ui.slogan, sl.text);
  // reverse counter
  const cOp = win(t, 29.8, 40.6, 0.9);
  ui.counter.style.opacity = cOp;
  if (cOp > 0) {
    const n = Math.max(1, Math.round(env.day * TL.SHOW_SCALE));
    setText(ui.counter.querySelector('.n'), String(n).padStart(3, '0'));
    setText(ui.counter.querySelector('.l'), t < 34.2 ? '它用了 999 天' : t < 39.6 ? '回到起点' : '第 1 天');
  }
  const ch = TL.chapterAt(t);
  if (ch) {
    const k = t - ch.t0;
    ui.chapter.style.opacity = Math.min(ss(k, 0.1, 0.7), 1 - ss(k, 2.6, 3.3));
    setText(ui.chapter.querySelector('.no'), `CHAPTER ${ch.no}`);
    setText(ui.chapter.querySelector('.zh'), ch.zh);
    setText(ui.chapter.querySelector('.en'), ch.en);
    ui.chapter.querySelector('.bar').style.width = `${ss(k, 0.3, 1.6) * 260}px`;
    setText(ui.hudL, `<span class="no">${ch.no}</span><span class="zh">${ch.zh}</span><span class="en">${ch.en}</span>`);
    setText(ui.weather, ch.weather);
  } else ui.chapter.style.opacity = 0;
  const hud = win(t, 40.5, 108.5, 0.7);
  ui.hudL.style.opacity = ui.hudR.style.opacity = ui.prog.style.opacity = hud;
  ui.weather.style.opacity = hud * 0.8;
  if (hud > 0) {
    const d = Math.max(1, Math.round(env.day * TL.SHOW_SCALE));
    setText(ui.hudR.querySelector('.d'), `第 <b>${String(d).padStart(3, '0')}</b><span> / 999 天</span>`);
    setText(ui.hudR.querySelector('.m'), `${TL.dateOf(d)}　${phaseText(env.day)}`);
    ui.prog.firstElementChild.style.width = `${(d / 999) * 100}%`;
  }
  ui.big666.style.opacity = win(t, 109.5, 116.8, 1.0);
}

// ----------------------------------------------------------- frame
const tmpV = new THREE.Vector3();
function renderAt(t, updateCamera = true) {
  if (!ready) return false;
  const env = Object.assign(TL.envAt(t), window.envOverride || {});
  const { day, tod, cloud, rain: rainK, wet, fog } = env;
  U.day.value = day; U.time.value = t + day * 2.2; U.cloud.value = cloud; U.rain.value = rainK; U.wet.value = wet;

  const sd = sunVector(tod);
  const el = THREE.MathUtils.radToDeg(Math.asin(sd.y));
  const S = skyAt(el);
  const night = ss(-1, -10, el) ? 1 - ss(el, -10, -1) : 0;
  U.night.value = night;
  U.stars.value = ss(-el, 6, 14) * (1 - cloud * 0.8);
  const grey = new THREE.Color(0x8d969e).multiplyScalar(lerp(1, 0.25, night));
  const ov = ss(cloud, 0.45, 0.95);
  U.skyZenith.value.copy(S.zen).lerp(grey.clone().multiplyScalar(0.85), ov);
  U.skyHorizon.value.copy(S.hor).lerp(grey, ov);
  U.sunDir.value.copy(sd);
  U.sunColor.value.copy(S.sunC).multiplyScalar(1 - ov * 0.85);
  U.cloudColor.value.copy(S.hor).lerp(new THREE.Color(1, 1, 1), 0.45 * (1 - night)).multiplyScalar(lerp(1, 0.55, ov) * lerp(1, 0.3, night));

  // sun or moon light
  const moon = el < -4;
  const ld = moon ? new THREE.Vector3(-0.4, 0.75, 0.35).normalize() : sd.clone();
  if (!moon) ld.y = Math.max(ld.y, 0.05);
  const center = new THREE.Vector3(60, 0, 0);
  sun.position.copy(center).addScaledVector(ld, 1500); sun.target.position.copy(center);
  sun.color.copy(moon ? new THREE.Color(0x9fb4e0) : S.sunC);
  sun.intensity = moon ? 0.35 * night : S.sunI * (1 - ov * 0.82);
  hemi.color.copy(S.hs).lerp(new THREE.Color(0xa7adb3), ov);
  hemi.groundColor.copy(S.hg);
  hemi.intensity = S.hi * lerp(1, 1.15, ov);
  const constructing = day > 15 && day < 640;
  siteLights.forEach((l) => { l.intensity = constructing ? night * 2.6e3 / 1000 * 30 : 0; });

  const fogCol = U.skyHorizon.value.clone().lerp(U.skyZenith.value, 0.25).lerp(new THREE.Color(0xaab3b8).multiplyScalar(lerp(1, 0.2, night)), ss(fog, 0.0009, 0.0019) * 0.7);
  scene.fog.color.copy(fogCol);
  scene.fog.density = fog + rainK * 0.001;
  renderer.toneMappingExposure = lerp(1.0, 1.55, night) * lerp(1, 1.12, ov);

  constr.update(day, t, { night });
  trees.userData.update(day, t);

  if (updateCamera && !vehicleMode?.isDriving()) {
    const cam = window.camOverride ? { ...window.camOverride, pos: v3(window.camOverride.pos), tgt: v3(window.camOverride.tgt) } : sampleShot(t);
    camera.up.set(...(window.camOverride && window.camOverride.up ? window.camOverride.up : [0, 1, 0]));
    camera.position.copy(cam.pos);
    camera.lookAt(cam.tgt);
    camera.fov = cam.fov; camera.updateProjectionMatrix();
  }
  camera.updateMatrixWorld();
  rain.material.uniforms.uCam.value.copy(camera.position);
  rain.visible = rainK > 0.01;

  // post uniforms
  const g = gradePass.uniforms;
  tmpV.copy(camera.position).addScaledVector(sd, 5000).project(camera);
  const facing = tmpV.z < 1 && Math.abs(tmpV.x) < 1.6 && Math.abs(tmpV.y) < 1.6;
  g.uSunUV.value.set(tmpV.x * 0.5 + 0.5, tmpV.y * 0.5 + 0.5);
  g.uSunVis.value = facing ? (1 - ov) * ss(el, -2, 3) * (1 - ss(el, 30, 50)) : 0;
  g.uTime.value = t;
  g.uBar.value = window.camOverride || vehicleMode?.isDriving() ? 0 : BAR / H;
  g.uFade.value = 1 - ss(t, 0, 1.4);
  g.uPano.value = ss(t, TL.PANO.t0, TL.PANO.t1);
  g.uYaw.value = TL.PANO.yawDeg / 360;
  g.uInvProj.value.copy(camera.projectionMatrixInverse);
  g.uCamWorld.value.copy(camera.matrixWorld);
  g.uSat.value = lerp(1.04, 0.82, ov) * lerp(1, 0.9, night);
  g.uEndDim.value = ss(t, 122.6, 124);
  g.uFlash.value = 0;
  bloom.strength = lerp(0.22, 0.5, night);
  bloom.threshold = lerp(0.92, 0.75, night);

  composer.render();
  updateHUD(t, env);
  return true;
}

window.renderAt = renderAt;
window.TL = TL;
window.sceneReady = () => ready;

// 静态建成校园查看器：仅在加载完成或手动操作时重新渲染。
const MODEL_TIME = 15;
window.envOverride = { day: 666, tod: 10, cloud: 0.3, rain: 0, wet: 0, fog: 0.0006 };
window.camOverride = { pos: [520, 340, 520], tgt: [40, 15, 0], fov: 42 };
$('ui').style.display = 'none';

init().then(() => {
  renderAt(MODEL_TIME);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(v3(window.camOverride.tgt));
  controls.enableDamping = false;
  controls.minDistance = 80;
  controls.maxDistance = 1800;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.update();
  controls.addEventListener('change', () => renderAt(MODEL_TIME, false));
  vehicleMode = createVehicleMode({
    scene, camera, renderer, controls,
    renderFrame: () => renderAt(MODEL_TIME, false),
  });
  window.vehicleMode = vehicleMode;

  window.addEventListener('resize', () => {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
    renderAt(MODEL_TIME, false);
  });
}).catch((e) => { console.error(e); window.initError = String(e.stack || e); });




