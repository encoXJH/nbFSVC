import { WEAPONS, WEAPON_BY_ID } from './gun-catalog.js';

const EFFECTS = {
  smoke: { file: 'smoke.mp3', volume: .65 },
  fire: { file: 'fire.mp3', volume: .8 },
  grenade: { file: 'grenade.mp3', volume: .9 },
};

export class GunAudio {
  constructor() {
    this.context = null;
    this.buffers = new Map();
    this.effectBuffers = new Map();
    this.events = [];
    this.loading = null;
  }

  async preload(onProgress = () => {}) {
    if (!this.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.context = new AudioContext();
    }
    if (!this.loading) {
      let loaded = 0;
      const total = WEAPONS.length + Object.keys(EFFECTS).length;
      const load = async (id, file, buffers) => {
        const response = await fetch(`/cs2_materials/mp3/${file}`);
        if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
        const data = await response.arrayBuffer();
        const buffer = await this.context.decodeAudioData(data);
        buffers.set(id, buffer);
        loaded++;
        onProgress(loaded, total);
      };
      this.loading = Promise.all([
        ...WEAPONS.map((weapon) => load(weapon.id, weapon.audio, this.buffers)),
        ...Object.entries(EFFECTS).map(([id, effect]) => load(id, effect.file, this.effectBuffers)),
      ]);
    }
    await this.loading;
    return this.buffers.size;
  }

  async resume() {
    if (this.context?.state === 'suspended') await this.context.resume();
  }

  play(id) {
    const weapon = WEAPON_BY_ID[id];
    const buffer = this.buffers.get(id);
    if (!weapon || !buffer || this.context.state !== 'running') return false;
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    gain.gain.value = weapon.volume;
    source.connect(gain).connect(this.context.destination);
    source.start(0);
    this.events.push({ weapon: id, file: weapon.audio, at: this.context.currentTime });
    if (this.events.length > 80) this.events.shift();
    return true;
  }

  playEffect(type) {
    const effect = EFFECTS[type];
    const buffer = this.effectBuffers.get(type);
    if (!effect || !buffer || this.context.state !== 'running') return false;
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    gain.gain.value = effect.volume;
    source.connect(gain).connect(this.context.destination);
    source.start(0);
    this.events.push({ effect: type, file: effect.file, at: this.context.currentTime });
    if (this.events.length > 80) this.events.shift();
    return true;
  }

  getState() {
    return {
      context: this.context?.state || 'uninitialized',
      loaded: [...this.buffers.keys()],
      effectsLoaded: [...this.effectBuffers.keys()],
      events: this.events.map((event) => ({ ...event })),
    };
  }
}
