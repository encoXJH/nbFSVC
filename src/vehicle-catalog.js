const named = (zh, en) => ({ zh, en });

export const BASE_SPECS = {
  scooter: {
    name: named('機車', 'Scooter'), w: .72, l: 1.86, h: 1.15, wheelbase: 1.22,
    axles: [-.62, .6], wheelR: .27, track: 0, wheelW: .11,
    maxKmh: 95, accel: 6.8, grip: 12, brake: 10, mass: 125, seats: 2, twoWheeler: true,
    colors: [0xf4f4f2, 0x1d1e21, 0x9fb7c6, 0xc8392f, 0xe7d9b8, 0x7fa99b, 0x8d9096, 0x2f4f86, 0xe9b93a],
  },
  motorcycle: {
    name: named('檔車', 'Motorcycle'), w: .76, l: 2, h: 1.12, wheelbase: 1.32,
    axles: [-.68, .64], wheelR: .31, track: 0, wheelW: .1,
    maxKmh: 115, accel: 7.8, grip: 12.5, brake: 11, mass: 150, seats: 2, twoWheeler: true,
    colors: [0xb3141b, 0x16171a, 0x1f4f9c, 0x2c5e3a, 0xc7c9cc, 0x6b1d1d, 0xe2b53b],
  },
  superbike: {
    name: named('重機', 'Superbike'), w: .76, l: 2.08, h: 1.16, wheelbase: 1.42,
    axles: [-.72, .7], wheelR: .31, track: 0, wheelW: .14,
    maxKmh: 265, accel: 12.5, grip: 13.5, brake: 13.5, mass: 205, seats: 2, twoWheeler: true,
    colors: [0xd4161d, 0x0f1012, 0x1b5fc9, 0x2aa04a, 0xf2f2f0, 0xf07f12, 0x6a2bb5],
  },
  sedan: {
    name: named('轎車', 'Sedan'), w: 1.8, l: 4.6, h: 1.45, wheelbase: 2.7,
    axles: [-1.36, 1.34], wheelR: .33, track: .76, wheelW: .22,
    maxKmh: 180, accel: 6.4, grip: 7.5, brake: 12, mass: 1300, seats: 4,
    colors: [0xf2f2f0, 0xe9e9e6, 0xb9bdc2, 0x8e9399, 0x1c1d20, 0x2b2e33, 0x1f3552, 0x6d1a1f, 0x5e6b5a, 0x8a7b66],
  },
  taxi: {
    name: named('計程車', 'Taxi'), w: 1.8, l: 4.6, h: 1.62, wheelbase: 2.74,
    axles: [-1.38, 1.36], wheelR: .33, track: .76, wheelW: .22,
    maxKmh: 170, accel: 5.9, grip: 7.2, brake: 11.5, mass: 1350, seats: 4,
    colors: [0xf6c21b],
  },
  suv: {
    name: named('休旅車', 'SUV'), w: 1.9, l: 4.7, h: 1.72, wheelbase: 2.78,
    axles: [-1.4, 1.38], wheelR: .38, track: .8, wheelW: .22,
    maxKmh: 165, accel: 5.5, grip: 6.6, brake: 10.5, mass: 1750, seats: 4,
    colors: [0xf2f2f0, 0x1c1d20, 0x8e9399, 0x3a4a5c, 0x6d1a1f, 0x4f5a45],
  },
  van: {
    name: named('廂型車', 'Van'), w: 1.92, l: 4.9, h: 2, wheelbase: 2.95,
    axles: [-1.5, 1.45], wheelR: .36, track: .82, wheelW: .22,
    maxKmh: 140, accel: 4.6, grip: 6.4, brake: 9.5, mass: 1950, seats: 4,
    colors: [0xf4f4f2, 0xe9e9e6, 0xb9bdc2],
  },
  bus: {
    name: named('公車', 'City Bus'), w: 2.5, l: 11.2, h: 3.15, wheelbase: 5.65,
    axles: [-3.1, 2.55], wheelR: .5, track: 1.02, wheelW: .32,
    maxKmh: 90, accel: 2.7, grip: 6, brake: 7, mass: 11000, seats: 4,
    colors: [0x1f63b8, 0x1c8a5a, 0xc9362d],
  },
  police: {
    name: named('警車', 'Police Car'), w: 1.84, l: 4.76, h: 1.52, wheelbase: 2.74,
    axles: [-1.38, 1.36], wheelR: .34, track: .78, wheelW: .22,
    maxKmh: 200, accel: 7.8, grip: 8, brake: 13, mass: 1450, seats: 4,
    colors: [0x111d32],
  },
  ambulance: {
    name: named('救護車', 'Ambulance'), w: 2, l: 5.5, h: 2.45, wheelbase: 3.15,
    axles: [-1.65, 1.5], wheelR: .38, track: .86, wheelW: .22,
    maxKmh: 150, accel: 4.9, grip: 6.4, brake: 9, mass: 2600, seats: 4,
    colors: [0xf7f7f7],
  },
  garbage: {
    name: named('垃圾車', 'Garbage Truck'), w: 2.24, l: 7.2, h: 3, wheelbase: 3.75,
    axles: [-2.45, 1.3], wheelR: .48, track: .94, wheelW: .3,
    maxKmh: 80, accel: 2.5, grip: 6, brake: 7, mass: 8000, seats: 4,
    colors: [0xf2c500],
  },
  sports: {
    name: named('跑車', 'Sports Car'), w: 1.94, l: 4.5, h: 1.2, wheelbase: 2.68,
    axles: [-1.38, 1.3], wheelR: .34, track: .82, wheelW: .27,
    maxKmh: 275, accel: 10.5, grip: 8.5, brake: 15.5, mass: 1350, seats: 4,
    colors: [0xd81f26, 0x111214, 0xf5f5f5, 0x1d7fd6, 0xf0b400, 0x2e8b57],
  },
  truck: {
    name: named('發財車', 'Pickup Truck'), w: 1.68, l: 4.4, h: 1.95, wheelbase: 2.45,
    axles: [-1.3, 1.15], wheelR: .3, track: .7, wheelW: .22,
    maxKmh: 125, accel: 4.5, grip: 6.6, brake: 9.5, mass: 1400, seats: 2,
    colors: [0x2759b8, 0x2a62c4, 0xf2f2f0],
  },
};

const DETAIL_MODELS = [
  ['scooter-neo', 'scooter', 'Neo 速克達'],
  ['scooter-white', 'scooter', 'White 速克達'],
  ['scooter-jet', 'scooter', 'Jet 速克達'],
  ['scooter-gp', 'scooter', 'GP 速克達'],
  ['scooter-axis', 'scooter', 'Axis 速克達'],
  ['scooter-swish', 'scooter', 'Swish 速克達'],
  ['scooter-gogoro', 'scooter', 'Gogoro 電動機車'],
  ['scooter-wemo', 'scooter', 'WeMo 電動機車'],
  ['scooter-duke', 'scooter', 'Duke 速克達'],
  ['scooter-fiddle', 'scooter', 'Fiddle 速克達'],
  ['scooter-saluto', 'scooter', 'Saluto 速克達'],
  ['scooter-vespa', 'scooter', 'Vespa 速克達'],
  ['scooter-bws', 'scooter', 'BWS 速克達'],
  ['scooter-maxi', 'scooter', 'Maxi 速克達'],
  ['scooter-cub', 'scooter', 'Cub 速克達'],
  ['corolla-cross', 'suv', 'Corolla Cross'],
  ['altis', 'sedan', 'Altis'],
  ['cayenne', 'suv', 'Cayenne'],
  ['model3', 'sedan', 'Model 3'],
];

const CUSTOM_CARS = [
  {
    id: 'car-santaizi', base: 'truck', name: named('電音三太子花車', 'Techno Prince Float'),
    paint: 16727972, trim: 16765503, glow: 16728016, kit: ['ledArch', 'speakers', 'neonStrip'],
    tune: { maxKmh: 165, accel: 6.2, grip: 1.05, drifty: 1.2, brake: 1.1 },
  },
  {
    id: 'car-tofu86', base: 'sedan', name: named('陽明山豆花 86', 'Yangmingshan Tofu 86'),
    paint: 16053488, trim: 1381913, glow: 0, kit: ['ducktail', 'splitter', 'sideSkirts'],
    tune: { maxKmh: 215, accel: 8.6, grip: 1.08, drifty: 1.9, brake: 1.15 },
  },
  {
    id: 'car-hehuan', base: 'suv', name: named('合歡山越野怪獸', 'Hehuan Mountain Beast'),
    paint: 4872748, trim: 1776670, glow: 0, kit: ['bullBar', 'snorkel', 'roofRack', 'lightBar'],
    tune: { maxKmh: 200, accel: 7.6, grip: 1.15, drifty: .9, brake: 1.15 },
  },
  {
    id: 'car-neon-gt', base: 'sports', name: named('霓虹夜市 GT', 'Night Market Neon GT'),
    paint: 3870584, trim: 1372415, glow: 16723926, kit: ['gtWing', 'splitter', 'sideSkirts', 'neonStrip'],
    tune: { maxKmh: 300, accel: 12.2, grip: 1.12, drifty: 1.2, brake: 1.1 },
  },
  {
    id: 'car-golden-101', base: 'sports', name: named('101 黃金閃電', 'Golden Bolt 101'),
    paint: 13144602, trim: 1184276, glow: 16761370, kit: ['gtWing', 'hoodStripes', 'splitter', 'sideSkirts'],
    tune: { maxKmh: 340, accel: 14.5, grip: 1.2, drifty: 1.1, brake: 1.2 },
  },
];

const PLAYER_BIKES = [
  { id: 'bike-scooter', kind: 'scooter', name: named('我的速克達', 'My scooter'), paint: 9426628 },
  { id: 'bike-motorcycle', kind: 'motorcycle', name: named('我的檔車', 'My motorcycle'), paint: 1908257 },
  { id: 'bike-superbike', kind: 'superbike', name: named('我的重機', 'My superbike'), paint: 13112863 },
];

const baseVehicles = Object.entries(BASE_SPECS).map(([kind, spec]) => ({
  id: kind, kind, name: spec.name, spec, paint: spec.colors[0], group: 'base', model: 'generic',
}));

const detailVehicles = DETAIL_MODELS.map(([id, kind, label], index) => ({
  id, kind, name: named(label, label), spec: BASE_SPECS[kind],
  paint: BASE_SPECS[kind].colors[index % BASE_SPECS[kind].colors.length], group: 'detail', model: 'detail',
}));

const customVehicles = CUSTOM_CARS.map((car) => ({
  ...car, kind: car.base, group: 'custom', model: 'generic',
  spec: {
    ...BASE_SPECS[car.base],
    maxKmh: car.tune.maxKmh,
    accel: car.tune.accel,
    grip: BASE_SPECS[car.base].grip * car.tune.grip,
    brake: BASE_SPECS[car.base].brake * car.tune.brake,
    drifty: car.tune.drifty,
  },
}));

const playerVehicles = PLAYER_BIKES.map((bike) => ({
  ...bike, spec: BASE_SPECS[bike.kind], group: 'player', model: 'generic',
}));

export const VEHICLES = [...baseVehicles, ...detailVehicles, ...customVehicles, ...playerVehicles];
export const VEHICLE_BY_ID = Object.fromEntries(VEHICLES.map((vehicle) => [vehicle.id, vehicle]));
export const DETAIL_IDS = DETAIL_MODELS.map(([id]) => id);
