const at30Fps = (frames) => frames / 30;

export const WEAPONS = [
  {
    id: 'usp', name: 'USP 消音版', short: 'USP', audio: 'usp.mp3', mode: 'semi',
    sourceFrames: 7, interval: at30Fps(7), magazine: 12, reserve: 48,
    reloadTime: 2.1, recoil: .65, volume: .55,
  },
  {
    id: 'deserteagle', name: '沙漠之鹰', short: '沙鹰', audio: 'deserteagle.mp3', mode: 'semi',
    sourceFrames: 6, interval: at30Fps(6), magazine: 7, reserve: 35,
    reloadTime: 2.2, recoil: 1.35, volume: .85,
  },
  {
    id: 'm4a1s', name: 'M4A1 消音版', short: 'M4A1-S', audio: 'm4a1s.mp3', mode: 'auto',
    sourceFrames: 3, interval: at30Fps(3), magazine: 20, reserve: 80,
    reloadTime: 2.45, recoil: .52, volume: .5,
  },
  {
    id: 'm4a4', name: 'M4A4', short: 'M4A4', audio: 'm4a4.mp3', mode: 'auto',
    sourceFrames: 3, interval: at30Fps(3), magazine: 30, reserve: 90,
    reloadTime: 2.55, recoil: .58, volume: .75,
  },
  {
    id: 'ak47', name: 'AK-47', short: 'AK-47', audio: 'ak47.mp3', mode: 'auto',
    sourceFrames: 3, interval: at30Fps(3), magazine: 30, reserve: 90,
    reloadTime: 2.65, recoil: .82, volume: .8,
  },
  {
    id: 'galiar', name: '加利尔 AR', short: '加利尔', audio: 'gailar.mp3', mode: 'auto',
    sourceFrames: 3, interval: at30Fps(3), magazine: 35, reserve: 90,
    reloadTime: 2.7, recoil: .7, volume: .75,
  },
  {
    id: 'awp', name: 'AWP', short: 'AWP', audio: 'awp.mp3', mode: 'bolt',
    sourceFrames: null, interval: 1.45, magazine: 5, reserve: 30,
    reloadTime: 3.65, recoil: 2.2, volume: 1, zoomFov: [38, 12],
  },
];

export const WEAPON_BY_ID = Object.fromEntries(WEAPONS.map((weapon) => [weapon.id, weapon]));
export const DEFAULT_FOV = 72;
