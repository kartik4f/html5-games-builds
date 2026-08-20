//==================================================
// AudioFX.js
//==================================================
// Small synthesized sound effects using the Web Audio API directly —
// no audio files, no npm packages. Every sound is generated on the
// fly from oscillators + a bit of noise. Shared by both single-player
// (GameScene) and multiplayer (NetGameScene).
//
// A single AudioFX instance is exported so all scenes share one
// AudioContext instead of creating a new one per game/room.
//==================================================

class AudioFX {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.muted = false;
  }

  //--------------------------------------------------
  // Lazily create the AudioContext — browsers require it to happen
  // after (or during) a user gesture, so the first real sound call
  // (always triggered by a pointer action) is what creates it.
  //--------------------------------------------------

  ensure() {
    if (this.ctx) return this.ctx;

    const AC = window.AudioContext || window.webkitAudioContext;

    if (!AC) return null;

    this.ctx = new AC();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.5;
    this.masterGain.connect(this.ctx.destination);

    return this.ctx;
  }

  resume() {
    const ctx = this.ensure();

    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  setMuted(muted) {
    this.muted = muted;

    if (this.masterGain) {
      this.masterGain.gain.value = muted ? 0 : 0.5;
    }
  }

  toggleMuted() {
    this.setMuted(!this.muted);

    return this.muted;
  }

  //--------------------------------------------------
  // Helpers
  //--------------------------------------------------

  _envGain(startGain, duration) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    const now = ctx.currentTime;

    g.gain.setValueAtTime(Math.max(startGain, 0.0001), now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    g.connect(this.masterGain);

    return g;
  }

  _noiseBurst(duration, gainAmt, highpassFreq = 1200) {
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = highpassFreq;

    const g = this._envGain(gainAmt, duration);

    src.connect(filter);
    filter.connect(g);

    src.start(now);
    src.stop(now + duration);
  }

  //--------------------------------------------------
  // Pen-on-pen collision — a short percussive "clack", pitched and
  // sized by impact strength (0..1).
  //--------------------------------------------------

  playCollision(strength = 0.5) {
    const ctx = this.ensure();

    if (!ctx || this.muted) return;

    this.resume();

    const s = Phaser.Math.Clamp(strength, 0, 1);
    const now = ctx.currentTime;

    const freq = 650 + s * 900;

    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.4, now + 0.08);

    const g = this._envGain(0.1 + s * 0.28, 0.12);

    osc.connect(g);
    osc.start(now);
    osc.stop(now + 0.13);

    this._noiseBurst(0.05, 0.04 + s * 0.14);
  }

  //--------------------------------------------------
  // A pen sliding off the table — falling pitch + a soft noise tail.
  //--------------------------------------------------

  playEliminate() {
    const ctx = this.ensure();

    if (!ctx || this.muted) return;

    this.resume();

    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(500, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.45);

    const g = this._envGain(0.22, 0.5);

    osc.connect(g);
    osc.start(now);
    osc.stop(now + 0.5);

    this._noiseBurst(0.3, 0.08, 400);
  }

  //--------------------------------------------------
  // Lobby countdown beep — higher pitch on the final "1".
  //--------------------------------------------------

  playCountdownBeep(isFinal = false) {
    const ctx = this.ensure();

    if (!ctx || this.muted) return;

    this.resume();

    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = isFinal ? 880 : 520;

    const g = this._envGain(0.28, 0.18);

    osc.connect(g);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  //--------------------------------------------------
  // Win fanfare — a quick 4-note arpeggio.
  //--------------------------------------------------

  playWin() {
    const ctx = this.ensure();

    if (!ctx || this.muted) return;

    this.resume();

    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];

    notes.forEach((freq, i) => {
      const t = now + i * 0.11;

      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.26, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      g.connect(this.masterGain);

      osc.connect(g);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  }

  //--------------------------------------------------
  // Draw — a short, flat, slightly deflated tone (distinct from win).
  //--------------------------------------------------

  playDraw() {
    const ctx = this.ensure();

    if (!ctx || this.muted) return;

    this.resume();

    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(330, now);
    osc.frequency.linearRampToValueAtTime(280, now + 0.3);

    const g = this._envGain(0.2, 0.35);

    osc.connect(g);
    osc.start(now);
    osc.stop(now + 0.35);
  }

  //--------------------------------------------------
  // Power-up pickup — a bright rising "sparkle" blip.
  //--------------------------------------------------

  playPickup() {
    const ctx = this.ensure();

    if (!ctx || this.muted) return;

    this.resume();

    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(920, now + 0.12);

    const g = this._envGain(0.22, 0.15);

    osc.connect(g);
    osc.start(now);
    osc.stop(now + 0.16);
  }
}

const audioFX = new AudioFX();

export default audioFX;
