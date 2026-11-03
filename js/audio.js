// An original, generated score (Web Audio, nothing to license or download). A slow D-major pad with a
// sub bass and a reverb wash; a plucked arpeggio and a soft pulse that come up while he is travelling;
// a whoosh on takeoff, a swell when a ship sails, a bell for a new country, a click for the board.
const NOTE = n => 440 * Math.pow(2, (n - 69) / 12);
// D, Bm, G, A(sus4 -> 3): two bars each at 76 bpm
const CHORDS = [
  { root: 38, pad: [50, 57, 64, 66], arp: [62, 66, 69, 74, 76, 74, 69, 66] },
  { root: 35, pad: [47, 54, 62, 64], arp: [59, 62, 66, 71, 74, 71, 66, 62] },
  { root: 31, pad: [43, 50, 59, 66], arp: [55, 59, 62, 67, 71, 67, 62, 59] },
  { root: 33, pad: [45, 52, 62, 64], arp: [57, 61, 64, 69, 73, 69, 64, 62] },
];
const BEAT = 60 / 76;
const BAR = BEAT * 4;
const KEY = 'y26-sound';

export class Sound {
  constructor() {
    let saved = null;
    try { saved = localStorage.getItem(KEY); } catch (e) { /* private mode */ }
    this.on = saved !== 'off';
    this.ctx = null;
    this.level = 0.3;       // 0 calm .. 1 flying
    this.target = 0.3;
    this.listeners = [];
  }

  onChange(fn) { this.listeners.push(fn); }
  emit() { this.listeners.forEach(f => f(this.on)); }

  /** Call from a click/keypress: browsers only let audio start inside a user gesture. */
  unlock() {
    if (!this.on) return;
    this.mediaSession();
    if (!this.ctx) this.build();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.fade(1, 1.6);
    if (!this.timer) this.startScore();
  }

  /**
   * iPhones play web audio through the ringer channel, so the silent switch mutes it. Declaring playback
   * (and starting a silent media element, for older iOS) puts it on the media channel like a video.
   */
  mediaSession() {
    if (this.media) return;
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* not supported */ }
    const a = this.media = document.createElement('audio');
    a.setAttribute('playsinline', ''); a.loop = true; a.volume = 0.01;
    a.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAAAA';
    a.play().catch(() => { /* fine: Web Audio still plays where the switch allows */ });
  }

  toggle() {
    this.on = !this.on;
    try { localStorage.setItem(KEY, this.on ? 'on' : 'off'); } catch (e) { /* ignore */ }
    if (this.on) { this.unlock(); if (this.media) this.media.play().catch(() => {}); }
    else { this.fade(0, 0.5); if (this.media) this.media.pause(); }
    this.emit();
  }

  /** How much is happening, 0..1. The arpeggio, pulse and filter follow it. */
  intensity(x) { this.target = Math.max(0, Math.min(1, x)); }

  build() {
    const C = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = C.createGain(); this.master.gain.value = 0;
    const comp = C.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.4;
    this.master.connect(comp).connect(C.destination);

    this.verb = C.createConvolver();
    this.verb.buffer = this.impulse(4.2, 2.6);
    const verbOut = C.createGain(); verbOut.gain.value = 0.55;
    this.verb.connect(verbOut).connect(this.master);

    this.padBus = C.createBiquadFilter(); this.padBus.type = 'lowpass'; this.padBus.frequency.value = 900; this.padBus.Q.value = 0.6;
    const padGain = C.createGain(); padGain.gain.value = 0.5;
    this.padBus.connect(padGain); padGain.connect(this.master); padGain.connect(this.verb);

    this.arpBus = C.createGain(); this.arpBus.gain.value = 0;
    const delay = C.createDelay(1); delay.delayTime.value = BEAT * 0.75;
    const fb = C.createGain(); fb.gain.value = 0.32;
    const dTone = C.createBiquadFilter(); dTone.type = 'lowpass'; dTone.frequency.value = 2600;
    this.arpBus.connect(this.master); this.arpBus.connect(this.verb);
    this.arpBus.connect(delay); delay.connect(dTone).connect(fb).connect(delay); dTone.connect(this.master);

    this.pulseBus = C.createGain(); this.pulseBus.gain.value = 0;
    this.pulseBus.connect(this.master);

    this.sfx = C.createGain(); this.sfx.gain.value = 0.9;
    this.sfx.connect(this.master); this.sfx.connect(this.verb);

    this.noise = this.noiseBuffer(2);
    // a background tab throttles the scheduler to once a second, which would stutter: go quiet instead
    document.addEventListener('visibilitychange', () => {
      if (!this.on) return;
      if (document.hidden) C.suspend(); else { C.resume(); this.next = Math.max(this.next, C.currentTime + 0.05); }
    });
  }

  impulse(sec, decay) {
    const C = this.ctx, n = Math.floor(C.sampleRate * sec), b = C.createBuffer(2, n, C.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay);
    }
    return b;
  }

  noiseBuffer(sec) {
    const C = this.ctx, n = Math.floor(C.sampleRate * sec), b = C.createBuffer(1, n, C.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  fade(to, sec) {
    if (!this.ctx) return;
    const g = this.master.gain, t = this.ctx.currentTime;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(to * 0.62, t + sec);
  }

  // ------------------------------------------------------------------ the score
  startScore() {
    const C = this.ctx;
    this.next = C.currentTime + 0.1;
    this.step = 0;
    this.timer = setInterval(() => this.schedule(), 90);
    this.schedule();
  }

  schedule() {
    const C = this.ctx;
    if (!C || C.state !== 'running') return;
    // ease the mix toward how busy the trip is
    this.level += (this.target - this.level) * 0.06;
    const t = C.currentTime, L = this.level;
    this.padBus.frequency.setTargetAtTime(700 + L * 1900, t, 0.8);
    this.arpBus.gain.setTargetAtTime(0.02 + L * 0.16, t, 0.6);
    this.pulseBus.gain.setTargetAtTime(L > 0.55 ? (L - 0.55) * 0.5 : 0, t, 0.8);
    while (this.next < t + 0.35) {
      const s = this.step, chord = CHORDS[Math.floor(s / 16) % CHORDS.length];
      const at = this.next;
      if (s % 16 === 0) this.padChord(chord, at, BAR * 2 + 1.2);
      this.pluck(NOTE(chord.arp[s % 8] + (Math.floor(s / 8) % 2 ? 12 : 0)), at, 0.55);
      if (s % 4 === 0) this.kick(at, s % 16 === 0 ? 1 : 0.6);
      if (s % 16 === 10 && Math.random() < 0.5) this.bell(NOTE(chord.arp[4] + 24), at, 0.05);
      this.next += BEAT / 2;
      this.step = s + 1;
    }
  }

  padChord(ch, at, dur) {
    const C = this.ctx;
    const env = C.createGain();
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(0.11, at + 1.8);
    env.gain.setValueAtTime(0.11, at + dur - 1.4);
    env.gain.linearRampToValueAtTime(0, at + dur);
    env.connect(this.padBus);
    for (const n of ch.pad) {
      for (const cents of [-7, 6]) {
        const o = C.createOscillator(); o.type = 'sawtooth';
        o.frequency.value = NOTE(n); o.detune.value = cents;
        const g = C.createGain(); g.gain.value = 0.22;
        o.connect(g).connect(env); o.start(at); o.stop(at + dur + 0.1);
      }
    }
    const sub = C.createOscillator(); sub.type = 'sine'; sub.frequency.value = NOTE(ch.root);
    const sg = C.createGain();
    sg.gain.setValueAtTime(0, at); sg.gain.linearRampToValueAtTime(0.24, at + 1.2);
    sg.gain.setValueAtTime(0.24, at + dur - 1.2); sg.gain.linearRampToValueAtTime(0, at + dur);
    sub.connect(sg).connect(this.master); sub.start(at); sub.stop(at + dur + 0.1);
  }

  pluck(f, at, dur) {
    const C = this.ctx;
    const o = C.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
    const o2 = C.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 2;
    const g = C.createGain();
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.5, at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    const g2 = C.createGain(); g2.gain.value = 0.25;
    o.connect(g); o2.connect(g2).connect(g); g.connect(this.arpBus);
    o.start(at); o2.start(at); o.stop(at + dur + 0.05); o2.stop(at + dur + 0.05);
  }

  kick(at, k) {
    const C = this.ctx;
    const o = C.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(110, at); o.frequency.exponentialRampToValueAtTime(42, at + 0.18);
    const g = C.createGain();
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.9 * k, at + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.42);
    o.connect(g).connect(this.pulseBus); o.start(at); o.stop(at + 0.45);
  }

  bell(f, at, vol = 0.12, out = null) {
    const C = this.ctx;
    for (const [m, v, d] of [[1, 1, 2.6], [2.76, 0.45, 1.4], [5.4, 0.22, 0.7]]) {
      const o = C.createOscillator(); o.type = 'sine'; o.frequency.value = f * m;
      const g = C.createGain();
      g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol * v, at + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, at + d);
      o.connect(g).connect(out || this.arpBus); o.start(at); o.stop(at + d + 0.05);
    }
  }

  // ------------------------------------------------------------------ effects
  ready() { return this.on && this.ctx && this.ctx.state === 'running'; }

  /** Departure. kind f/c/r/b, dur in seconds, size 0..1 (how far). */
  depart(kind, dur, size) {
    if (!this.ready() || kind === 'g') return;
    const C = this.ctx, at = C.currentTime + 0.02;
    const src = C.createBufferSource(); src.buffer = this.noise; src.loop = true;
    const f = C.createBiquadFilter();
    const g = C.createGain();
    const len = Math.min(dur, 3.2);
    if (kind === 'f') {
      f.type = 'bandpass'; f.Q.value = 0.9;
      f.frequency.setValueAtTime(260, at); f.frequency.exponentialRampToValueAtTime(1400 + size * 1400, at + len * 0.45);
      f.frequency.exponentialRampToValueAtTime(380, at + len);
      g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.16 + size * 0.22, at + len * 0.4);
      g.gain.exponentialRampToValueAtTime(0.0001, at + len);
      if (size > 0.5) this.boom(at, size);
    } else if (kind === 'c') {
      f.type = 'lowpass'; f.Q.value = 0.4;
      f.frequency.setValueAtTime(180, at); f.frequency.linearRampToValueAtTime(520, at + len * 0.5); f.frequency.linearRampToValueAtTime(200, at + len);
      g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.3, at + len * 0.5);
      g.gain.exponentialRampToValueAtTime(0.0001, at + len);
    } else {
      f.type = 'bandpass'; f.Q.value = 2.5; f.frequency.value = 900;
      g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.07, at + 0.25);
      g.gain.exponentialRampToValueAtTime(0.0001, at + Math.min(1.2, len));
      for (let k = 0; k < 4; k++) this.click(at + 0.15 + k * 0.19, 0.05);
    }
    src.connect(f).connect(g).connect(this.sfx);
    src.start(at); src.stop(at + len + 0.1);
  }

  boom(at, size) {
    const C = this.ctx;
    const o = C.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(70, at); o.frequency.exponentialRampToValueAtTime(34, at + 1.6);
    const g = C.createGain();
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.35 * size, at + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 2.2);
    o.connect(g).connect(this.sfx); o.start(at); o.stop(at + 2.3);
  }

  /** A new country: two bell notes up a fifth, in key with the score. */
  arrive() {
    if (!this.ready()) return;
    const at = this.ctx.currentTime + 0.02;
    this.bell(NOTE(86), at, 0.2, this.sfx);
    this.bell(NOTE(93), at + 0.16, 0.16, this.sfx);
  }

  /** One soft departure-board click, never more than one every 70 ms. */
  flap() {
    if (!this.ready()) return;
    const now = this.ctx.currentTime;
    if (now - (this.lastFlap || 0) < 0.07) return;
    this.lastFlap = now;
    this.click(now + 0.005, 0.045);
  }

  click(at, vol) {
    const C = this.ctx;
    const src = C.createBufferSource(); src.buffer = this.noise;
    const f = C.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2200;
    const g = C.createGain();
    g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.03);
    src.connect(f).connect(g).connect(this.master);
    src.start(at, Math.random()); src.stop(at + 0.04);
  }

  /** A new month on the board: one low, soft bell under the score. */
  month() {
    if (!this.ready()) return;
    this.bell(NOTE(62), this.ctx.currentTime + 0.02, 0.09, this.sfx);
  }

  /** A chapter change in the story: a short airy swell. */
  turn() {
    if (!this.ready()) return;
    this.depart('f', 1.4, 0.15);
  }
}
