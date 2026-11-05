// "Play the year": every leg in order on one clock. The camera flies each leg on a van Wijk curve walked
// along the sphere (pull back to see where he is going, push in on arrival), the vehicle rides the exact
// centre of that path, and on the ground the camera settles and slowly closes in to the scale of the
// next hop, so Japan's short train rides get room without any country-specific rules.
import { flyCurve, slerp, arcRad, km, zoomToFit, clamp, ease, lonLat } from './geo.js?v=15';
import { setHot, setVisited, styleLegsState } from './map.js?v=15';

const SPEEDS = [0.5, 1, 2, 4];
const PITCH_MAX = 42;
const pitchFor = z => clamp((z - 4.2) / 3.6, 0, 1) ** 1.4 * PITCH_MAX;
const expK = (dt, tau) => 1 - Math.exp(-dt / tau);
// dotted "not recorded" hops are drawn but never counted, so the tally ends on the verified total
const miOf = L => (L.t === 'g' ? 0 : L.km * 0.621371);

function buildBeats(A) {
  const beats = [];
  const legs = A.legs;
  let li = 0, run = 0;
  for (let di = 0; di <= A.todayIdx;) {
    if (li < legs.length && legs[li].i0 <= di) {
      const L = legs[li++];
      beats.push({ kind: 'leg', L, day: di });
      const arrive = Math.max(L.i1, di);
      const nx = legs[li];
      if (nx && nx.i0 <= arrive) beats.push({ kind: 'pause', day: arrive, L, port: L.t === 'c' && nx.t === 'c' });
      di = arrive;
      run = 0;
      continue;
    }
    beats.push({ kind: 'dwell', day: di, run: run++ });
    di++;
  }
  return beats;
}

export class Player {
  constructor(map, overlay, A, ui, sound) {
    this.map = map; this.ov = overlay; this.A = A; this.ui = ui; this.sound = sound;
    this.beats = buildBeats(A);
    this.speed = 1;
    this.playing = false;
    this.follow = true;
    this.raf = 0;
    this.newEver = new Set((A.wrapped.new_countries || []).map(c => c.cc));
    this.reset();
    this.bindUI();
    // Touching the map holds the camera at once (a jumpTo every frame would cancel MapLibre's drag
    // before it starts); actually moving it, or a wheel/pinch, hands the camera to the viewer.
    const el = map.getCanvasContainer();
    let down = null;
    el.addEventListener('pointerdown', e => { if (!this.open) return; down = [e.clientX, e.clientY]; this.hold = true; });
    window.addEventListener('pointermove', e => {
      if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4) { this.setFollow(false); down = null; }
    });
    const up = () => { down = null; this.hold = false; };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    el.addEventListener('wheel', () => { if (this.open) this.setFollow(false); }, { passive: true });
  }

  reset() {
    this.bi = 0; this.t = 0;
    this.pendingCC = null;
    this.miles = 0; this.flights = 0;
    this.visited = new Set();
    this.day = -1;
    const home = this.A.days[0].p;
    this.cam = { c: home, z: 4.2, p: 0 };
    this.zStay = 5.5;
    this.fading = [];
    this.hot = null;
  }

  // ---------------------------------------------------------------- lifecycle
  start(fromDay = 0) {
    this.open = true;
    const m = this.map;
    m.stop();
    this.ui.show();
    this.applyPadding();
    m.scrollZoom.enable(); m.dragPan.enable(); m.touchZoomRotate.enable();
    styleLegsState(m, this.A, { upTo: 0 });
    this.seek(fromDay, true);
    this.play();
    this.loop(performance.now());
  }

  close() {
    this.open = false;
    this.pause();
    cancelAnimationFrame(this.raf);
    this.ov.legs = []; this.ov.vehicle = null; this.ov.here = null;
    this.ui.hide();
  }

  play() {
    if (this.bi >= this.beats.length) this.seek(0, true);
    this.playing = true; this.ui.playing(true); this.ui.end(false); this.sound.intensity(0.25);
  }
  pause() { this.playing = false; this.ui.playing(false); this.sound.intensity(0.12); }
  toggle() { this.playing ? this.pause() : this.play(); }
  setSpeed(s) { this.speed = s; this.ui.speed(s); }
  setFollow(on, ease = true) {
    this.follow = on;
    this.ui.follow(on);
    this.blend = on && ease ? 1.2 : 0;
  }

  applyPadding() {
    const pad = this.ui.padding();
    this.pad = pad;
    this.map.setPadding(pad);
  }

  viewPx() {
    const c = this.map.getContainer();
    const w = c.clientWidth - this.pad.left - this.pad.right;
    const h = c.clientHeight - this.pad.top - this.pad.bottom;
    return Math.max(200, Math.min(w, h));
  }

  // ---------------------------------------------------------------- camera targets
  /** Scale of the place he is in: the shorter of the hop that brought him and the hop that takes him on. */
  stayZoom(L) {
    const nx = this.A.legs[L.i + 1];
    let d = L.km;
    if (nx && km(nx.a, L.b) < 60) d = Math.min(d, nx.km);
    d = clamp(d, 70, 1500);
    return clamp(zoomToFit(d, this.viewPx(), L.b[0], 0.5), 3.4, 8.6);
  }

  arrivalZoom(L) {
    const nx = this.A.legs[L.i + 1];
    const V = this.viewPx(), lat = L.b[0];
    const connecting = nx && nx.i0 <= L.i1 && km(nx.a, L.b) < 60 && nx.t !== 'g';
    if (connecting) return clamp(zoomToFit(Math.max(L.km, nx.km), V, lat, 0.75), 1, 7.2);
    return clamp(Math.min(zoomToFit(L.km * 0.5, V, lat, 0.6), this.stayZoom(L)), 1, 8.6);
  }

  /** Seconds at 1x. Grows with how far the camera has to travel (S) and with the real distance, so a
   *  Pacific crossing takes noticeably longer than a train to Suzuka without either feeling rushed. */
  legDuration(L, S) {
    const mode = { f: 1, c: 1.15, r: 0.9, b: 0.9, g: 0.65 }[L.t] || 1;
    const seaDays = L.t === 'c' ? Math.max(0, L.i1 - L.i0 - 1) * 0.16 : 0;
    const travel = (0.45 + 0.7 * S + 0.85 * Math.log1p(L.km / 500)) * mode + seaDays;
    // never faster than the camera can comfortably change scale (a short hop into a big zoom-out)
    return clamp(Math.max(travel, 0.55 + 0.8 * S), 0.9, 7.5);
  }

  // ---------------------------------------------------------------- the clock
  loop(now) {
    const dt = Math.min(0.05, ((now - (this.last || now)) / 1000));
    this.last = now;
    if (this.playing) this.step(dt * this.speed, dt);
    else this.settle(dt);
    this.render(dt);
    if (this.open) this.raf = requestAnimationFrame(t => this.loop(t));
  }

  step(dt, realDt) {
    let budget = dt;
    let guard = 0;
    while (budget > 0 && this.bi < this.beats.length && guard++ < 50) {
      const b = this.beats[this.bi];
      if (!b.ready) this.enter(b);
      const left = b.dur - this.t;
      const use = Math.min(budget, left);
      this.t += use; budget -= use;
      this.update(b, use);
      if (this.t >= b.dur - 1e-9) { this.exit(b); this.bi++; this.t = 0; }
      else break;
    }
    if (this.bi >= this.beats.length && this.playing) {
      this.pause();
      this.ui.end(true);
    }
    if (this.blend > 0) this.blend -= realDt;
  }

  /** Paused: the camera still finishes settling so a scrub or a pause never freezes mid-swing. */
  settle(dt) {
    const b = this.beats[Math.min(this.bi, this.beats.length - 1)];
    if (b && b.kind !== 'leg') { const [p, z] = this.groundView(b); this.creep(dt, p, z); }
  }

  enter(b) {
    b.ready = true;
    const A = this.A;
    if (b.kind === 'leg') {
      const L = b.L;
      const c0 = this.cam.c, z0 = this.cam.z;
      const zA = this.arrivalZoom(L);
      const curve = flyCurve(c0, z0, L.b, zA, this.viewPx());
      b.plan = { c0, z0, curve, near: arcRad(c0, L.a) < 0.02 };
      b.dur = this.legDuration(L, curve.S);
      if (this.playing) {
        const size = clamp(L.km / 7000, 0, 1);
        this.sound.depart(L.t, b.dur, size);
        if (L.t !== 'g') this.sound.intensity(L.t === 'f' || L.t === 'c' ? 0.5 + 0.5 * size : 0.45);
      }
      this.leg = { L, f: 0 };
      this.ov.here = null;
      this.ui.leg(L);
      // the country at the far end only counts once he gets there
      this.pendingCC = L.bcc !== L.acc ? L.bcc : null;
      this.setDay(Math.max(b.day, L.i0));
    } else {
      b.dur = b.kind === 'pause' ? (b.port ? 0.45 : 0.25) : (b.run < 3 ? 0.24 : 0.085);
      if (b.kind === 'dwell' && this.playing) this.sound.intensity(0.22);
      this.setDay(b.day);
      const d = A.days[b.day];
      if (b.kind === 'pause') this.ui.place({ ...d, city: b.L.bc, ccs: d.ccs || [] }, b.L.bcc !== 'SEA' ? b.L.bcc : null);
      else this.ui.place(d, this.hotFor(b.day));
    }
  }

  update(b, dt) {
    if (b.kind === 'leg') {
      const { L } = b, P = b.plan;
      const k = ease(clamp(this.t / b.dur, 0, 1));
      const { u, z } = P.curve.at(k);
      const f = P.near ? clamp(u, 0, 1) : k;
      const c = slerp(P.c0, L.b, clamp(u, 0, 1));
      this.cam.c = c; this.cam.z = z;
      this.cam.p += (pitchFor(z) - this.cam.p) * expK(dt, 0.35);
      this.leg.f = f;
      const span = L.i1 - L.i0;
      if (span > 0 && L.t === 'f') this.setDay(L.dl != null ? (f < L.dl ? L.i0 : L.i1) : (f < 0.5 ? L.i0 : L.i1));
      else if (span > 0) this.setDay(Math.min(L.i1, L.i0 + Math.floor(f * (span + 1))));
      this.ui.tally(this.visited.size, this.miles + miOf(L) * f, this.flights);
      if (f > 0.9 && L.bcc && L.bcc !== 'SEA') { this.arrive(); this.setHotCC(L.bcc); }
      else if (L.t === 'c' && span > 1 && f > 0.15 && f < 0.9) this.setHotCC(null);
    } else {
      // a connection holds at the airport, wide; a port call or a day on the ground settles in
      const [p, z] = this.groundView(b);
      this.creep(dt, p, z);
    }
  }

  groundView(b) {
    if (b.kind === 'pause') return [b.L.b, b.port ? this.zStay : this.cam.z];
    return [this.A.days[b.day].p, this.zStay];
  }

  exit(b) {
    if (b.kind !== 'leg') return;
    this.arrive();
    const L = b.L;
    this.miles += miOf(L);
    if (L.t === 'f') this.flights++;
    this.zStay = this.stayZoom(L);
    this.fading.push({ L, f: 1, alpha: 1 });
    this.leg = null;
    styleLegsState(this.map, this.A, { upTo: L.i + 1, recent: L.i });
    this.ui.tally(this.visited.size, this.miles, this.flights);
  }

  creep(dt, p, z) {
    const c = this.cam;
    c.c = slerp(c.c, p, expK(dt, 0.7));
    // pulling back is quick, closing in is a slow drift
    c.z += (z - c.z) * expK(dt, z > c.z ? 2.2 : 0.8);
    c.p += (pitchFor(c.z) - c.p) * expK(dt, 0.8);
  }

  visit(cc, announce) {
    if (!cc || cc === 'SEA' || this.visited.has(cc)) return;
    this.visited.add(cc);
    setVisited(this.map, this.A, this.visited);
    if (announce && this.playing) {
      this.ui.toast(cc, this.A.names[cc], this.visited.size, this.newEver.has(cc));
      this.sound.arrive();
    }
  }

  arrive() {
    if (!this.pendingCC) return;
    const cc = this.pendingCC;
    this.pendingCC = null;
    this.visit(cc, true);
    this.ui.tally(this.visited.size, this.miles + (this.leg ? miOf(this.leg.L) * this.leg.f : 0), this.flights);
  }

  setDay(i) {
    if (i === this.day) return;
    const A = this.A;
    const from = this.day;
    this.day = i;
    const d = A.days[i];
    // countries reached on every day between the last tick and this one
    for (let k = Math.max(0, from + 1); k <= i; k++) {
      for (const cc of A.days[k].ccs || []) if (cc !== this.pendingCC) this.visit(cc, k > 0);
    }
    this.ui.date(d.d);
    if (!this.leg) {
      this.ui.place(d, this.hotFor(i));
      this.setHotCC(this.hotFor(i));
    }
    this.ui.progress(i / A.days.length, i);
  }

  /** The country to light on day i. A sea day keeps the light on only if he lands back in the same country. */
  hotFor(i) {
    const D = this.A.days;
    const cc = D[i].cc;
    if (cc && cc !== 'SEA') return cc;
    let a = i, b = i;
    while (a > 0 && (!D[a].cc || D[a].cc === 'SEA')) a--;
    while (b < this.A.todayIdx && (!D[b].cc || D[b].cc === 'SEA')) b++;
    return D[a].cc && D[a].cc === D[b].cc ? D[a].cc : null;
  }

  setHotCC(cc) {
    if (cc === this.hot) return;
    this.hot = cc;
    setHot(this.map, this.A, cc);
  }

  // ---------------------------------------------------------------- drawing
  render(dt) {
    const m = this.map;
    for (const f of this.fading) f.alpha -= dt / 0.6;
    this.fading = this.fading.filter(f => f.alpha > 0);
    this.ov.legs = [...this.fading, ...(this.leg ? [this.leg] : [])];
    this.ov.vehicle = this.leg;
    this.ov.here = this.leg ? null : this.A.days[Math.max(0, this.day)].p;
    if (this.follow && !this.hold) {
      let c = this.cam.c, z = this.cam.z;
      if (this.blend > 0) {
        const cur = m.getCenter(), k = expK(dt, 0.25);
        c = slerp([cur.lat, cur.lng], c, k);
        z = m.getZoom() + (z - m.getZoom()) * k;
      }
      m.jumpTo({ center: lonLat(c), zoom: z, pitch: this.cam.p, bearing: 0 });
    }
    m.redraw();
  }

  // ---------------------------------------------------------------- scrubbing
  seek(dayIdx, hard = false) {
    const A = this.A;
    dayIdx = clamp(Math.round(dayIdx), 0, A.todayIdx);
    this.reset();
    this.beats.forEach(b => { b.ready = false; });
    let bi = this.beats.findIndex(b => b.day >= dayIdx && b.kind !== 'pause');
    if (bi < 0) bi = this.beats.length - 1;
    let lastLeg = null;
    for (let k = 0; k < bi; k++) {
      const b = this.beats[k];
      if (b.kind === 'leg') { this.miles += miOf(b.L); if (b.L.t === 'f') this.flights++; lastLeg = b.L; }
    }
    this.bi = bi;
    this.day = -1;
    const wasPlaying = this.playing;
    this.playing = false;
    this.setDay(Math.min(dayIdx, this.beats[bi].day));
    this.playing = wasPlaying;
    this.zStay = lastLeg ? this.stayZoom(lastLeg) : 5.4;
    // stand where he was when this beat begins: the end of the previous leg, not the end of the day
    const start = lastLeg ? lastLeg.b : A.days[0].p;
    this.cam = { c: this.beats[bi].kind === 'leg' ? start : A.days[this.day].p, z: this.zStay, p: pitchFor(this.zStay) };
    styleLegsState(this.map, A, { upTo: lastLeg ? lastLeg.i + 1 : 0, recent: lastLeg ? lastLeg.i : 0 });
    this.ui.tally(this.visited.size, this.miles, this.flights);
    this.ui.end(false);
    if (hard) this.setFollow(true, false);
  }

  stepLeg(dir) {
    const legs = this.beats.map((b, i) => [b, i]).filter(([b]) => b.kind === 'leg');
    if (dir > 0) {
      const nx = legs.find(([, i]) => i > this.bi);
      if (nx) this.seek(nx[0].day);
    } else {
      const pv = legs.filter(([, i]) => i < this.bi - 1).pop();
      this.seek(pv ? pv[0].day : 0);
    }
  }

  bindUI() {
    const ui = this.ui;
    ui.on('toggle', () => this.toggle());
    ui.on('speed', s => this.setSpeed(s));
    ui.on('seek', (frac, done) => {
      if (!this.scrubbing) { this.scrubbing = true; this.resume = this.playing; this.pause(); }
      this.seek(frac * (this.A.days.length - 1));
      if (done) { this.scrubbing = false; if (this.resume) this.play(); }
    });
    ui.on('follow', () => this.setFollow(true));
    ui.on('again', () => { this.seek(0, true); this.play(); });
    ui.on('step', d => this.stepLeg(d));
    ui.speeds(SPEEDS, this.speed);
  }
}

