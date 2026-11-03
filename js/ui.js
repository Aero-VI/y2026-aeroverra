// The player's heads-up display: departure-board date, where he is, running totals, the year ribbon.
import { fmt, dateParts, flag, MODE } from './data.js?v=9';
import { countryColor } from './palette.js?v=9';

const $ = id => document.getElementById(id);

class Flaps {
  constructor(el) { this.el = el; this.groups = []; }
  set(parts) {
    if (this.groups.length !== parts.length) {
      this.el.innerHTML = parts.map(p => `<span class="grp">${[...p].map(() => '<span class="cell"></span>').join('')}</span>`).join('');
      this.groups = [...this.el.querySelectorAll('.grp')].map(g => [...g.children]);
      this.last = parts.map(p => ' '.repeat(p.length));
    }
    parts.forEach((p, gi) => {
      const cells = this.groups[gi];
      [...p.padEnd(cells.length)].slice(0, cells.length).forEach((ch, ci) => {
        if (this.last[gi][ci] === ch) return;
        const c = cells[ci];
        c.textContent = ch;
        c.classList.remove('flip'); void c.offsetWidth; c.classList.add('flip');
      });
      this.last[gi] = p.padEnd(cells.length);
    });
  }
}

export class PlayerUI {
  constructor(A) {
    this.A = A;
    this.root = $('player');
    this.ev = {};
    this.flaps = new Flaps($('fDate'));
    this.cum = cumulative(A);
    this.root.addEventListener('click', e => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const act = b.dataset.act;
      if (act === 'toggle') this.emit('toggle');
      else if (act === 'follow') this.emit('follow');
      else if (act === 'again') this.emit('again');
      else if (act === 'close') this.emit('close');
      else if (act === 'next') this.emit('next');
      else if (act === 'speed') this.emit('speed', Number(b.dataset.s));
    });
    this.bindTrack();
    window.addEventListener('resize', () => this.drawRibbon());
  }

  on(n, fn) { (this.ev[n] ||= []).push(fn); }
  emit(n, ...a) { (this.ev[n] || []).forEach(f => f(...a)); }

  show() {
    this.root.hidden = false;
    document.body.classList.add('is-player');
    document.body.classList.remove('is-story');
    this.drawRibbon();
    this.measure();
  }
  hide() {
    this.root.hidden = true;
    document.body.classList.remove('is-player', 'is-paused');
    document.body.classList.add('is-story');
  }

  measure() {
    const deck = this.root.querySelector('.deck').getBoundingClientRect();
    document.documentElement.style.setProperty('--deck-h', `${Math.round(deck.height)}px`);
  }

  padding() {
    this.measure();
    const H = window.innerHeight;
    const board = this.root.querySelector('.board').getBoundingClientRect();
    const deck = this.root.querySelector('.deck').getBoundingClientRect();
    const phone = window.innerWidth <= 760;
    const top = Math.round(Math.max(board.bottom, 110) + (phone ? 4 : 10));
    const bottom = Math.round(H - deck.top + (phone ? 44 : 10));
    return { top, bottom, left: 0, right: 0 };
  }

  playing(on) {
    document.body.classList.toggle('is-paused', !on);
    this.root.querySelector('.playbtn').setAttribute('aria-label', on ? 'Pause' : 'Play');
  }

  speeds(list, cur) {
    $('speeds').innerHTML = list.map(s => `<button type="button" data-act="speed" data-s="${s}" aria-pressed="${s === cur}">${s}×</button>`).join('');
  }
  speed(s) { $('speeds').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.s) === s))); }
  follow(on) { this.root.querySelector('.follow').hidden = on; }
  end(on) { $('endcard').hidden = !on; }

  date(iso) {
    const p = dateParts(iso);
    this.flaps.set([p.wd.toUpperCase(), String(p.d).padStart(2, '0'), p.mon.toUpperCase()]);
  }

  place(day, cc) {
    const A = this.A;
    if (!day.ccs) return;
    const name = day.city || A.names[cc] || '';
    const country = cc && day.city !== 'At sea' ? A.names[cc] : '';
    $('pPlace').textContent = short(name);
    if (day.city === 'At sea') {
      $('pLeg').textContent = 'At sea';
    } else if (cc) {
      const n = this.cum[cc]?.[day.i] || 0;
      $('pLeg').innerHTML = n ? `${flag(cc)} ${esc(country)}, day ${n} there this year` : `${flag(cc)} ${esc(country)}`;
    } else $('pLeg').textContent = '';
  }

  leg(L) {
    if (!L) return;
    const what = L.t === 'g' ? 'Route not recorded' : `${L.t === 'f' ? 'Flight' : MODE[L.t][0].toUpperCase() + MODE[L.t].slice(1)} ${L.t === 'f' ? L.n : ''}`.trim();
    const ship = L.t === 'c' ? L.n : '';
    $('pPlace').innerHTML = `${esc(short(L.ac))}<span class="to">to</span>${esc(short(L.bc))}`;
    $('pLeg').innerHTML = `<span class="mode">${esc(ship || what)}</span>&ensp;${fmt(L.mi)} mi`;
  }

  tally(countries, miles, flights) {
    $('tCountries').textContent = countries;
    $('tCountries').nextElementSibling.textContent = countries === 1 ? 'country' : 'countries';
    $('tFlights').nextElementSibling.textContent = flights === 1 ? 'flight' : 'flights';
    $('tMiles').textContent = fmt(miles);
    $('tFlights').textContent = flights;
  }

  progress(frac, dayIdx) {
    const pct = (dayIdx + 0.5) / this.A.days.length * 100;
    $('playhead').style.left = `${pct}%`;
    $('trackMask').style.left = `${pct}%`;
    $('track').setAttribute('aria-valuenow', String(dayIdx + 1));
    $('track').setAttribute('aria-valuetext', this.A.days[dayIdx].d);
  }

  toast(cc, name, n, ever) {
    const t = $('toast');
    t.innerHTML = `<span class="t1">${flag(cc)} ${esc(name)}</span><span class="t2">Country ${n} this year${ever ? ', and his first time ever' : ''}</span>`;
    t.classList.add('on');
    clearTimeout(this.tt);
    this.tt = setTimeout(() => t.classList.remove('on'), 2300);
  }

  drawRibbon() {
    const cv = $('ribbon');
    const r = cv.getBoundingClientRect();
    if (!r.width) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    const g = cv.getContext('2d');
    const D = this.A.days, w = cv.width / D.length;
    D.forEach((d, i) => {
      if (d.future || !d.ccs) { g.fillStyle = 'rgba(206,216,245,0.07)'; }
      else if (!d.ccs.length) { g.fillStyle = 'rgba(255,181,71,0.5)'; }
      else g.fillStyle = countryColor(d.ccs.length > 1 ? d.ccs.find(c => c !== 'US' && c !== 'SEA') || d.ccs[0] : d.ccs[0]);
      g.fillRect(Math.floor(i * w), 0, Math.ceil(w) + 0.5, cv.height);
    });
    const months = $('months');
    if (!months.childElementCount) {
      const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      months.innerHTML = M.map((m, k) => {
        const i = this.A.dayIdx[`2026-${String(k + 1).padStart(2, '0')}-01`];
        return `<span style="left:${(i / D.length) * 100}%">${m}</span>`;
      }).join('');
    }
    months.classList.toggle('tight', r.width < 520);
    [...months.children].forEach((s, k) => { s.style.display = r.width < 520 && k % 2 ? 'none' : ''; });
  }

  bindTrack() {
    const tr = $('track');
    let down = false;
    const frac = e => {
      const r = tr.getBoundingClientRect();
      return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    };
    tr.addEventListener('pointerdown', e => { down = true; tr.setPointerCapture(e.pointerId); this.emit('seek', frac(e), false); });
    tr.addEventListener('pointermove', e => { if (down) this.emit('seek', frac(e), false); });
    const up = e => { if (!down) return; down = false; this.emit('seek', frac(e), true); };
    tr.addEventListener('pointerup', up);
    tr.addEventListener('pointercancel', up);
    tr.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        this.emit('step', e.key === 'ArrowRight' ? 1 : -1);
      }
    });
  }
}

function cumulative(A) {
  const out = {};
  const n = A.days.length;
  for (const d of A.days) for (const c of d.ccs || []) out[c] ||= new Int16Array(n);
  for (const c in out) {
    let k = 0;
    for (let i = 0; i < n; i++) { if ((A.days[i].ccs || []).includes(c)) k++; out[c][i] = k; }
  }
  return out;
}

const short = s => String(s || '').replace(/ HB$/, '').replace(/^(.+?) \(.+\)$/, '$1');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
