// A 2D canvas over the map for everything that moves: the leg being drawn, the vehicle on it, and the
// "here" marker. It repaints inside MapLibre's own render event, so the line tip, the vehicle and the
// globe are always from the same frame (no worker round trip, no tip trailing behind the plane).
import { COLORS as C } from './map.js?v=15';

const GLYPH = {
  f: new Path2D('M0,-11.5c1.3,0,1.8,1.4,1.8,3.2v5l9.2,5.3v2.3l-9.2-2.6v6.2l3.1,2.3v1.8l-4.9-1.3l-4.9,1.3v-1.8l3.1-2.3v-6.2l-9.2,2.6v-2.3l9.2-5.3v-5c0-1.8,0.5-3.2,1.8-3.2z'),
  c: new Path2D('M0,-11.5c3.2,3.4,4.6,7.6,4.6,12.4v8.2c0,1.4-1,2.4-2.4,2.4h-4.4c-1.4,0-2.4-1-2.4-2.4v-8.2c0-4.8,1.4-9,4.6-12.4z'),
  r: new Path2D('M0,-11.5c2.8,0,3.7,3.1,3.7,6.2v15.2c0,0.9-0.7,1.6-1.6,1.6h-4.2c-0.9,0-1.6-0.7-1.6-1.6v-15.2c0-3.1,0.9-6.2,3.7-6.2z'),
};
GLYPH.b = GLYPH.r;
const DECK = {
  c: new Path2D('M-2.3,-1.5h4.6v7h-4.6z'),
  r: new Path2D('M-2.2,-6h4.4v2.2h-4.4z'),
};
DECK.b = DECK.r;

const TINT = { f: C.amber, c: C.sea, r: C.rail, b: C.rail, g: C.ground };
const CORE = { f: '#ffe7bd', c: '#d4fff7', r: '#ffd9cf', b: '#ffd9cf', g: '#c9d1e8' };

export class Overlay {
  constructor(map) {
    this.map = map;
    this.legs = [];        // [{ L, f, alpha }]
    this.vehicle = null;   // { L, f }
    this.here = null;      // [lat, lon]
    this.pins = [];        // [{ p:[lat,lon], label }]
    this.guides = [];      // [{ pts:[[lat,lon]...], color, dash, label }] parallels, the date line, future trips
    this.cv = document.createElement('canvas');
    this.cv.className = 'overlay';
    map.getContainer().appendChild(this.cv);
    this.ctx = this.cv.getContext('2d');
    this.resize();
    map.on('resize', () => this.resize());
    map.on('render', () => this.draw());
  }

  resize() {
    const r = this.map.getContainer().getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = r.width; this.h = r.height;
    this.cv.width = Math.round(r.width * this.dpr);
    this.cv.height = Math.round(r.height * this.dpr);
  }

  hidden(lat, lon) {
    const t = this.map.transform;
    return t && t.isLocationOccluded ? t.isLocationOccluded({ lng: lon, lat }) : false;
  }

  pt(p) {
    if (this.hidden(p[0], p[1])) return null;
    const s = this.map.project([p[1], p[0]]);
    return [s.x, s.y];
  }

  draw() {
    const g = this.ctx, d = this.dpr;
    g.setTransform(d, 0, 0, d, 0, 0);
    g.clearRect(0, 0, this.w, this.h);
    // Chromium can keep compositing the last frame of a canvas that was only cleared, so an empty
    // overlay is hidden outright instead.
    const empty = !this.legs.length && !this.vehicle && !this.here && !this.pins.length && !this.guides.length;
    if (empty !== this.wasEmpty) { this.cv.style.visibility = empty ? 'hidden' : 'visible'; this.wasEmpty = empty; }
    if (empty) return;
    for (const gd of this.guides) this.drawGuide(gd);
    for (const a of this.legs) this.drawLeg(a);
    if (this.here) this.drawHere(this.here);
    this.taken = [];
    for (const p of this.pins) this.drawPin(p);
    if (this.vehicle) this.drawVehicle(this.vehicle);
  }

  drawLeg({ L, f, alpha = 1 }) {
    if (f <= 0) return;
    const g = this.ctx;
    const n = Math.max(8, Math.ceil(L.ns * f));
    const paths = [];
    let cur = null;
    for (let k = 0; k <= n; k++) {
      const q = this.pt(L.arc.at((k / n) * f));
      if (!q) { cur = null; continue; }
      if (!cur) { cur = []; paths.push(cur); }
      cur.push(q);
    }
    const dashed = L.t === 'g';
    const stroke = (w, color, a, blur = 0) => {
      g.save();
      g.globalAlpha = a * alpha;
      g.strokeStyle = color;
      g.lineWidth = w;
      g.lineCap = 'round'; g.lineJoin = 'round';
      if (dashed) g.setLineDash([3, 5]);
      if (blur) { g.shadowColor = color; g.shadowBlur = blur; }
      for (const pth of paths) {
        if (pth.length < 2) continue;
        g.beginPath();
        g.moveTo(pth[0][0], pth[0][1]);
        for (let i = 1; i < pth.length; i++) g.lineTo(pth[i][0], pth[i][1]);
        g.stroke();
      }
      g.restore();
    };
    if (!dashed) stroke(7, TINT[L.t], 0.28, 14);
    stroke(dashed ? 2 : 2.6, CORE[L.t], dashed ? 0.85 : 1);
  }

  drawGuide({ pts, color = '#c9d1e8', dash = [4, 6], width = 1.5, alpha = 0.8, label, labelAt = 0.5 }) {
    const g = this.ctx;
    g.save();
    g.globalAlpha = alpha;
    g.strokeStyle = color; g.lineWidth = width; g.setLineDash(dash); g.lineCap = 'round';
    g.beginPath();
    let pen = false, lab = null;
    pts.forEach((p, k) => {
      const q = this.pt(p);
      if (!q) { pen = false; return; }
      if (k === Math.round(labelAt * (pts.length - 1))) lab = q;
      if (pen) g.lineTo(q[0], q[1]); else { g.moveTo(q[0], q[1]); pen = true; }
    });
    g.stroke();
    if (label && lab) {
      g.setLineDash([]);
      g.font = '600 13px "Hanken Grotesk", sans-serif';
      g.textAlign = 'left';
      g.lineWidth = 4; g.strokeStyle = 'rgba(7,13,34,0.85)';
      g.strokeText(label, lab[0] + 8, lab[1] - 8);
      g.fillStyle = color; g.globalAlpha = 1;
      g.fillText(label, lab[0] + 8, lab[1] - 8);
    }
    g.restore();
  }

  drawVehicle({ L, f }) {
    if (L.t === 'g') return;
    const p = this.pt(L.arc.at(f));
    if (!p) return;
    const e = 0.004;
    const a = this.pt(L.arc.at(Math.max(0, f - e)));
    const b = this.pt(L.arc.at(Math.min(1, f + e)));
    let ang = this.lastAng ?? 0;
    if (a && b && Math.hypot(b[0] - a[0], b[1] - a[1]) > 0.05) ang = Math.atan2(b[1] - a[1], b[0] - a[0]) + Math.PI / 2;
    this.lastAng = ang;
    const g = this.ctx, R = window.innerWidth < 600 ? 16 : 18;
    g.save();
    g.translate(p[0], p[1]);
    g.beginPath(); g.arc(0, 0, R + 6, 0, Math.PI * 2);
    g.fillStyle = TINT[L.t]; g.globalAlpha = 0.18; g.fill();
    g.globalAlpha = 1;
    g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2);
    g.fillStyle = 'rgba(7,13,34,0.92)'; g.fill();
    g.lineWidth = 1.5; g.strokeStyle = TINT[L.t]; g.stroke();
    g.rotate(ang);
    const s = (R / 13.5);
    g.scale(s, s);
    g.fillStyle = CORE[L.t];
    g.fill(GLYPH[L.t] || GLYPH.f);
    if (DECK[L.t]) { g.fillStyle = 'rgba(7,13,34,0.75)'; g.fill(DECK[L.t]); }
    g.restore();
  }

  drawHere(pos) {
    const p = this.pt(pos);
    if (!p) return;
    const g = this.ctx, t = (performance.now() % 2400) / 2400;
    g.save();
    g.translate(p[0], p[1]);
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      g.beginPath(); g.arc(0, 0, 7 + t * 22, 0, Math.PI * 2);
      g.strokeStyle = C.amber; g.globalAlpha = 0.6 * (1 - t); g.lineWidth = 2; g.stroke();
    }
    g.globalAlpha = 1;
    g.beginPath(); g.arc(0, 0, 7, 0, Math.PI * 2);
    g.fillStyle = C.amber; g.fill();
    g.lineWidth = 2.5; g.strokeStyle = '#fff3dc'; g.stroke();
    g.restore();
  }

  drawPin({ p, label }) {
    const q = this.pt(p);
    if (!q) return;
    const g = this.ctx;
    g.save();
    g.translate(q[0], q[1]);
    g.beginPath(); g.arc(0, 0, 5, 0, Math.PI * 2);
    g.fillStyle = C.amber; g.fill();
    g.lineWidth = 2; g.strokeStyle = '#fff3dc'; g.stroke();
    if (label) {
      g.font = '600 13px "Hanken Grotesk", sans-serif';
      const w = g.measureText(label).width, h = 16;
      // first free spot among above, below, right, left of the pin
      const spots = [[-w / 2, -24], [-w / 2, 10], [10, -8], [-w - 10, -8]];
      let at = spots[0];
      for (const s of spots) {
        const r = [q[0] + s[0] - 3, q[1] + s[1] - 2, w + 6, h + 4];
        if (!this.taken.some(t => r[0] < t[0] + t[2] && t[0] < r[0] + r[2] && r[1] < t[1] + t[3] && t[1] < r[1] + r[3])) { at = s; break; }
      }
      this.taken.push([q[0] + at[0] - 3, q[1] + at[1] - 2, w + 6, h + 4]);
      g.textAlign = 'left'; g.textBaseline = 'top';
      g.lineWidth = 4; g.strokeStyle = 'rgba(7,13,34,0.88)';
      g.strokeText(label, at[0], at[1]);
      g.fillStyle = '#fff3dc';
      g.fillText(label, at[0], at[1]);
    }
    g.restore();
  }

  /** Keep repainting while something on the overlay animates on its own (the pulse). */
  tick() { this.map.triggerRepaint(); }
}
