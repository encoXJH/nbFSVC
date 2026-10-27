import { Vector3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// 初始机位与俯视机位
const INITIAL_POSITION = [300, 215, 480];
const INITIAL_TARGET = [0, 24, 80];
const TOP_POSITION = [0, 980, 30];
const TOP_TARGET = [0, 0, 10];

// OrbitControls 参数
const DAMPING_FACTOR = 0.06;
const MAX_POLAR_ANGLE = Math.PI / 2 - 0.02;
const MIN_DISTANCE = 40;
const MAX_DISTANCE = 1900;

// 平移参数：速度随视距自适应，dt 最大取 0.1 秒
const PAN_SPEED_FACTOR = 0.42;
const MIN_PAN_SPEED = 28;
const MAX_PAN_SPEED = 340;
const MAX_DELTA_TIME = 0.1;
const MIN_FORWARD_LENGTH_SQ = 0.00000001;

const KEY_TO_DIRECTION = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};
const DIRECTIONS = ['up', 'down', 'left', 'right'];
const FORM_TAGS = new Set(['INPUT', 'SELECT', 'TEXTAREA']);

function isFormInput(target) {
  return !!target && FORM_TAGS.has(target.tagName);
}

function clampDelta(dt) {
  return Math.min(Math.max(dt, 0), MAX_DELTA_TIME);
}

export function createPanControls(camera, controls) {
  // 总体状态用于逐帧计算，分来源状态避免键盘与触屏互相覆盖。
  const active = { up: false, down: false, left: false, right: false };
  const keyboard = { ...active };
  const pointer = { ...active };
  const forward = new Vector3();
  const right = new Vector3();
  const displacement = new Vector3();
  const listeners = [];
  const buttons = [...document.querySelectorAll('#dpad button[data-dir]')];

  const on = (target, type, handler, options) => {
    target.addEventListener(type, handler, options);
    listeners.push([target, type, handler, options]);
  };
  const setDirection = (source, direction, pressed) => {
    source[direction] = pressed;
    active[direction] = keyboard[direction] || pointer[direction];
  };
  const clear = () => {
    for (const direction of DIRECTIONS) {
      keyboard[direction] = pointer[direction] = active[direction] = false;
    }
    buttons.forEach((button) => button.classList.remove('on'));
  };

  // 输入框保留原生方向键行为，其余区域由相机接管。
  on(window, 'keydown', (event) => {
    if (isFormInput(event.target)) return;
    const direction = KEY_TO_DIRECTION[event.code];
    if (!direction) return;
    event.preventDefault();
    setDirection(keyboard, direction, true);
  }, true);
  on(window, 'keyup', (event) => {
    if (isFormInput(event.target)) return;
    const direction = KEY_TO_DIRECTION[event.code];
    if (!direction) return;
    event.preventDefault();
    setDirection(keyboard, direction, false);
  }, true);
  on(window, 'blur', clear);

  // 屏幕方向盘同时支持鼠标与触屏，按下高亮，结束立即松开。
  for (const button of buttons) {
    const direction = button.dataset.dir;
    if (!DIRECTIONS.includes(direction)) continue;
    const end = (event) => {
      setDirection(pointer, direction, false);
      button.classList.remove('on');
      if (button.hasPointerCapture?.(event.pointerId)) button.releasePointerCapture(event.pointerId);
    };
    on(button, 'pointerdown', (event) => {
      event.preventDefault();
      try { button.setPointerCapture(event.pointerId); } catch { /* 合成事件没有活动指针时无需捕获 */ }
      setDirection(pointer, direction, true);
      button.classList.add('on');
    });
    on(button, 'pointerup', end);
    on(button, 'pointercancel', end);
    on(button, 'pointerleave', end);
    on(button, 'contextmenu', (event) => event.preventDefault());
  }

  function update(dt) {
    const x = Number(active.right) - Number(active.left);
    const z = Number(active.up) - Number(active.down);
    if (x === 0 && z === 0) return;

    // 世界朝向投影到 XZ 平面；正俯视时直接跳过，避免归一化产生 NaN。
    camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < MIN_FORWARD_LENGTH_SQ) return;
    forward.normalize();
    right.crossVectors(forward, camera.up).normalize();

    displacement.set(0, 0, 0);
    displacement.addScaledVector(right, x).addScaledVector(forward, z).normalize();
    const distance = camera.position.distanceTo(controls.target);
    const speed = Math.min(MAX_PAN_SPEED, Math.max(MIN_PAN_SPEED, distance * PAN_SPEED_FACTOR));
    displacement.multiplyScalar(speed * clampDelta(dt));

    // 相机与观察目标同步位移，保证平移前后视线方向不变。
    camera.position.add(displacement);
    controls.target.add(displacement);
  }

  function dispose() {
    clear();
    for (const [target, type, handler, options] of listeners) target.removeEventListener(type, handler, options);
  }

  return { active, update, clear, dispose };
}

export function setupControls(camera, dom) {
  const controls = new OrbitControls(camera, dom);
  controls.enableDamping = true;
  controls.dampingFactor = DAMPING_FACTOR;
  controls.maxPolarAngle = MAX_POLAR_ANGLE;
  controls.minDistance = MIN_DISTANCE;
  controls.maxDistance = MAX_DISTANCE;

  const pan = createPanControls(camera, controls);
  let topMode = false;

  const applyView = (position, target) => {
    camera.position.fromArray(position);
    controls.target.fromArray(target);
    controls.update();
  };
  const reset = () => {
    topMode = false;
    pan.clear();
    applyView(INITIAL_POSITION, INITIAL_TARGET);
  };
  const toggleTop = () => {
    topMode = !topMode;
    pan.clear();
    applyView(topMode ? TOP_POSITION : INITIAL_POSITION, topMode ? TOP_TARGET : INITIAL_TARGET);
  };

  const onShortcut = (event) => {
    if (isFormInput(event.target) || event.repeat) return;
    if (event.code === 'KeyR') {
      event.preventDefault();
      reset();
    } else if (event.code === 'KeyT') {
      event.preventDefault();
      toggleTop();
    }
  };
  window.addEventListener('keydown', onShortcut, true);
  applyView(INITIAL_POSITION, INITIAL_TARGET);

  return {
    controls,
    pan,
    reset,
    toggleTop,
    get topMode() { return topMode; },
    // 平移先于 OrbitControls 更新，二者可在同一帧生效；俯视时禁用平移。
    update(dt) {
      const delta = clampDelta(dt);
      if (!topMode) pan.update(delta);
      controls.update();
    },
    dispose() {
      window.removeEventListener('keydown', onShortcut, true);
      pan.dispose();
      controls.dispose();
    },
  };
}
