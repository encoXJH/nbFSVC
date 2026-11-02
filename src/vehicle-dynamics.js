import * as THREE from 'three';

// 校园按真实米制搭建（操场直道 / 弯道各约 100m），车辆仿真整体放慢到 0.7 倍。
export const SIM_TIME_SCALE = .7;
// 街机式加速：前段保持强推力，接近极速才快速衰减。
export const THROTTLE_PULL = 2.8;
// 刹车同样走街机手感，制动距离压到接近真实性能车。
export const BRAKE_BOOST = 2.5;

export function handlingFor(entry) {
  const spec = entry.spec;
  const tune = entry.tune || {};
  const drifty = tune.drifty || 1;
  const maxSpeed = spec.maxKmh / 3.6;
  return {
    accel: spec.accel,
    brake: spec.brake * BRAKE_BOOST,
    grip: spec.grip,
    wheelbase: spec.wheelbase,
    maxSpeed,
    drifty,
    driftGrip: 1.9 / (drifty > 1 ? Math.sqrt(drifty) : 1),
    handbrakeGrip: .9,
    latAccel: 50 * (tune.grip || 1),
    yawResp: 18,
    reverseMax: 9,
    maxSteer: .7,
    maxSteerHigh: .32,
    drag: Math.max(5e-5, (spec.accel * (1 - (1 / 1.14) ** 2.2) - .3) / maxSpeed ** 2),
  };
}

export function resetDynamics(state, x, z, heading = 0) {
  state.object.position.set(x, .04, z);
  state.heading = heading;
  state.speed = 0;
  state.steer = 0;
  state.vx = 0;
  state.vz = 0;
  state.yawRate = 0;
  state.gripK = state.entry.spec.grip;
  state.drifting = false;
  state.powerT = 0;
  state.slip = 0;
  state.wheelAngle = 0;
  state.object.rotation.set(0, -heading, 0);
}

function updateBikeDrive(state, input, dt) {
  const spec = state.entry.spec;
  const maxSpeed = spec.maxKmh / 3.6;
  if (input.throttle) {
    const ratio = THREE.MathUtils.clamp(Math.max(0, state.speed) / maxSpeed, 0, 1.2);
    const pull = THROTTLE_PULL * (1 - Math.min(1, ratio) ** 6);
    state.speed += spec.accel * pull * dt;
  }
  if (input.brake) {
    if (state.speed > .5) state.speed -= spec.brake * dt;
    else state.speed -= spec.accel * .62 * dt;
  }
  if (!input.throttle && !input.brake) {
    const drag = Math.min(Math.abs(state.speed), (1.1 + Math.abs(state.speed) * .055) * dt);
    state.speed -= Math.sign(state.speed) * drag;
  }
  if (input.handbrake) {
    const stopping = Math.min(Math.abs(state.speed), spec.brake * 1.65 * dt);
    state.speed -= Math.sign(state.speed) * stopping;
  }
  state.speed = THREE.MathUtils.clamp(state.speed, -maxSpeed * .28, maxSpeed);
  if (Math.abs(state.speed) > .04) {
    const lowSpeed = Math.min(1, Math.abs(state.speed) / 4);
    const turnRate = 1.2 * lowSpeed * (.7 + spec.grip / 24);
    state.heading += state.steer * Math.sign(state.speed) * turnRate * dt;
  }
  state.object.position.x += Math.sin(state.heading) * state.speed * dt;
  state.object.position.z -= Math.cos(state.heading) * state.speed * dt;
  state.vx = Math.sin(state.heading) * state.speed;
  state.vz = -Math.cos(state.heading) * state.speed;
  state.wheelAngle = state.steer * .32;
  state.drifting = false;
  state.slip = 0;
}

function stepCar(state, input, dt) {
  const h = state.handling;
  const sin = Math.sin(state.heading);
  const cos = Math.cos(state.heading);
  let u = state.vx * sin - state.vz * cos;
  let d = state.vx * cos + state.vz * sin;
  const f = Math.abs(u);
  const direction = Math.sign(u || 1);
  const throttle = input.throttle ? 1 : 0;
  let force = 0;
  if (input.throttle) {
    if (u < -.6) {
      force = h.brake * .8;
    } else {
      const ratio = THREE.MathUtils.clamp(u / h.maxSpeed, 0, 1.3);
      const pull = THROTTLE_PULL * (1 - Math.min(1, ratio) ** 6);
      force = h.accel * pull
        * (1 + .35 * Math.max(0, 1 - f / 7)) * (state.drifting ? .55 : 1);
    }
  }
  if (input.brake && u <= .6 && !input.throttle) {
    force = -.65 * h.accel * Math.max(0, 1 - Math.abs(Math.min(0, u)) / h.reverseMax);
  }
  let brakeForce = input.brake && u > .6 ? h.brake : 0;
  if (input.handbrake) {
    const straight = Math.abs(state.steer) < .2;
    const handbrakeForce = f > .2
      ? h.brake * (state.drifting ? .22 : straight ? .75 : .4)
      : 20;
    brakeForce = Math.max(brakeForce, handbrakeForce);
    if (f > .5) brakeForce = Math.min(brakeForce, 1.02 * h.brake);
  }
  const rollingDrag = .3 + (input.throttle ? 0 : 1.2) + h.drag * f * f;
  u += force * dt;
  const longitudinalLoss = (brakeForce + rollingDrag) * dt;
  if (Math.abs(u) > longitudinalLoss) u -= Math.sign(u) * longitudinalLoss;
  else if (!(force !== 0 && Math.abs(force * dt) > longitudinalLoss)) u = 0;
  u = THREE.MathUtils.clamp(u, -h.reverseMax, h.maxSpeed * 1.08);

  const speedRatio = THREE.MathUtils.clamp(f / (.7 * h.maxSpeed), 0, 1);
  const wheelAngle = state.steer * (h.maxSteer + (h.maxSteerHigh - h.maxSteer) * speedRatio ** .7);
  state.wheelAngle = wheelAngle;
  let yawTarget = THREE.MathUtils.clamp(
    u * Math.tan(wheelAngle) / h.wheelbase,
    -h.latAccel / Math.max(f, 1.5),
    h.latAccel / Math.max(f, 1.5),
  );
  const slip = Math.atan2(d, Math.max(f, .5));
  const signedSlip = -slip * direction;
  let targetGrip = input.handbrake && f > 3 ? h.handbrakeGrip : h.grip;
  if (input.handbrake && !state.drifting && f > 3) yawTarget *= 1.5;

  if (!state.drifting && h.drifty > .2 && f > 8.5) {
    if (input.handbrake && Math.abs(state.steer) > .25) state.drifting = true;
    else if (Math.abs(slip) > .3) state.drifting = true;
    else if (h.drifty > 1.1 && throttle > .9 && Math.abs(state.steer) > .85
      && f > 12 && f < .55 * h.maxSpeed && state.powerT > .5) state.drifting = true;
  }

  if (state.drifting) {
    let gain = .64 * Math.min(1.2, h.drifty) * (input.handbrake ? 1.18 : 1);
    if (state.steer * signedSlip < 0) gain *= .3;
    const targetSlip = state.steer * gain;
    targetGrip = h.driftGrip * (.85 + .3 * throttle);
    if (input.handbrake) targetGrip = Math.min(targetGrip, h.handbrakeGrip * 1.4);
    yawTarget = state.gripK * Math.sin(signedSlip) * direction
      + 3.6 * (targetSlip - signedSlip) * direction;
  }

  const gripResponse = targetGrip > state.gripK ? 2.5 : 10;
  state.gripK += (targetGrip - state.gripK) * (1 - Math.exp(-gripResponse * dt));
  const lateralBefore = d;
  d *= Math.exp(-state.gripK * dt);
  if (state.drifting) {
    u += direction * Math.max(0, Math.abs(lateralBefore) - Math.abs(d)) * (.42 + .3 * throttle);
  }
  state.yawRate += (yawTarget - state.yawRate) * (1 - Math.exp(-h.yawResp * dt));
  state.vx = sin * u + cos * d;
  state.vz = -cos * u + sin * d;
  state.object.position.x += state.vx * dt;
  state.object.position.z += state.vz * dt;
  const nextHeading = state.heading + state.yawRate * dt;
  state.heading = Math.atan2(Math.sin(nextHeading), Math.cos(nextHeading));
  state.speed = u;
  state.slip = signedSlip;

  if (state.drifting && (f < 4 || Math.abs(signedSlip) > 1.75
    || (Math.abs(signedSlip) < .09 && Math.abs(state.steer) < .15 && !input.handbrake))) {
    state.drifting = false;
  }
}

function updateCarDrive(state, input, dt) {
  const speed = Math.hypot(state.vx, state.vz);
  const steps = Math.max(1, Math.min(16,
    Math.ceil(dt / (1 / 120) - 1e-6),
    Math.ceil(speed * dt / .15 - 1e-6),
  ));
  for (let i = 0; i < steps; i++) stepCar(state, input, dt / steps);
}

export function updateDynamics(state, input, dt) {
  dt *= SIM_TIME_SCALE;
  const steerResponse = (input.steer === 0 || input.steer * state.steer < 0 ? 14 : 8) / SIM_TIME_SCALE;
  state.steer = THREE.MathUtils.damp(state.steer, input.steer, steerResponse, dt);
  state.powerT = input.throttle && Math.abs(state.steer) > .85 ? state.powerT + dt : 0;
  if (state.entry.spec.twoWheeler) updateBikeDrive(state, input, dt);
  else updateCarDrive(state, input, dt);
}
