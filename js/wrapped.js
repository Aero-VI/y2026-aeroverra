/* ============================================================
   2026 WRAPPED — scene engine
   - no programmatic scrolling except explicit navigation (film / keys / buttons),
     and it only ever scrolls #deck. Never an ancestor, never horizontally.
     (Nicholas 2026-11-01: the old page yanked itself around on some devices.)
   - FILM mode autoplays each scene for its data-dur. Speed defaults to 1x and
     the slower options are there for recording.
   ============================================================ */
const DECK = document.getElementById('deck');
const SCENES = [...document.querySelectorAll('.scene')];
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fmt = n => (n == null ? '—' : n.toLocaleString('en-US'));
const DEC = new Set(['equators', 'air_days', 'avg_stay', 'flight_every', 'pace_days_per_country']);
function el(t, c, h) { const x = document.createElement(t); if (c) x.className = c; if (h != null) x.innerHTML = h; return x; }

let W = null, Y = null, NEXT = null;

Promise.all([
  fetch('data/wrapped2026.json').then(r => r.json()),
  fetch('data/year2026.json').then(r => r.json()).catch(() => null),
  fetch('data/next.json').then(r => r.json()).catch(() => null)
]).then(([w, y, n]) => { W = w; Y = y; NEXT = n; build(); })
  .catch(e => { console.warn('data load failed', e); observe(); });

/* ---------------------------------------------------------- numbers */
function fillNumbers() {
  document.querySelectorAll('[data-k]').forEach(node => {
    const k = node.dataset.k;
    let v = W[k];
    if (k === 'new_count') v = (W.new_countries || []).length;
    if (k === 'top1_days') v = (W.top_nonus && W.top_nonus[0]) ? W.top_nonus[0].days : null;
    if (k === 'bigday_miles') v = W.biggest_day ? W.biggest_day.miles : null;
    if (v == null) return;
    if (typeof v === 'number') {
      node.dataset.raw = v;
      node.textContent = DEC.has(k) ? String(Math.round(v * 100) / 100) : fmt(Math.round(v));
    } else {
      node.textContent = v;
    }
  });
}

function countUp(node) {
  const target = parseFloat(node.dataset.raw);
  if (!isFinite(target) || RM || node.dataset.done === '1') return;
  node.dataset.done = '1';
  const dec = DEC.has(node.dataset.k);
  const dur = Math.min(1700, 650 + Math.log10(Math.max(10, Math.abs(target))) * 340);
  const t0 = performance.now();
  (function tick(t) {
    const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3), v = target * e;
    node.textContent = dec ? (Math.round(v * 100) / 100).toFixed(1) : fmt(Math.round(v));
    if (p < 1) requestAnimationFrame(tick);
    else node.textContent = dec ? String(Math.round(target * 100) / 100) : fmt(target);
  })(t0);
}

/* ---------------------------------------------------------- builders */
function build() {
  fillNumbers();

  const storm = document.getElementById('storm');
  (W.all_flags || []).forEach((c, i) => {
    const s = el('span', 'fl' + (c.days <= 2 ? ' ghostf' : ''), c.flag);
    s.title = `${c.name} — ${c.days} day${c.days === 1 ? '' : 's'}`;
    s.style.animationDelay = (0.18 + i * 0.045) + 's';
    storm.appendChild(s);
  });

  const ng = document.getElementById('newgrid');
  (W.new_countries || []).forEach((c, i) => {
    const d = new Date(c.on + 'T00:00:00Z');
    const card = el('div', 'nc', `<em>${c.flag}</em><div><b>${c.name}</b>
      <span>${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })}</span></div>`);
    card.style.animationDelay = (0.2 + i * 0.06) + 's';
    ng.appendChild(card);
  });

  bars('#splitBars', [
    { nm: 'Abroad', v: W.days_abroad, max: W.days_tracked, sub: 'd' },
    { nm: 'United States', v: W.days_us, max: W.days_tracked, sub: 'd' },
    { nm: 'At sea', v: W.days_sea, max: W.days_tracked, sub: 'd' }
  ]);

  const nonus = (W.top || []).filter(c => c.cc !== 'US' && c.cc !== 'SEA').slice(0, 6);
  bars('#topBars', nonus.map((c, i) => ({ nm: c.flag + ' ' + c.name, v: c.days, max: nonus[0].days, sub: 'd', mute: i > 0 })));

  const strip = document.getElementById('strip365');
  if (Y && Y.days) Y.days.forEach(d => {
    const i = el('i');
    const cc = (d.ccs || [])[0];
    if (cc === 'JP') i.className = 'on';
    else if (cc === 'US') i.className = 'us';
    else if (cc === 'SEA') i.className = 'sea';
    i.title = d.d + (cc ? ' · ' + cc : '');
    strip.appendChild(i);
  });

  bars('#apBars', (W.top_airports || []).slice(0, 7).map(([a, n], i) =>
    ({ nm: a, v: n, max: W.top_airports[0][1], sub: '×', mute: i > 2 })));

  const sc = document.getElementById('shipCards');
  (W.ships || []).slice().sort((a, b) => b.nights - a.nights).forEach(s => {
    sc.appendChild(el('div', 'card' + (s.nights >= 13 ? ' hi' : ''),
      `<div class="k">${s.line || 'cruise'}</div>
       <div class="v" style="font-size:clamp(17px,2.4vw,27px)">${(s.ship || '').replace(/^Carnival /, '')}</div>
       <div class="s"><b>${s.nights}</b> nights · ${s.frm} → ${s.to}</div>`));
  });

  const tc = document.getElementById('tripleCards');
  (W.triple_days || []).forEach(t => {
    const d = new Date(t.d + 'T00:00:00Z');
    tc.appendChild(el('div', 'card',
      `<div class="k">${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' })}</div>
       <div class="v" style="font-size:clamp(26px,4vw,44px);letter-spacing:.06em">${t.flags.join('')}</div>
       <div class="s">${t.names.join(' → ')}</div>`));
  });
  const wk = W.busiest_week, wl = document.getElementById('weekLine');
  if (wk && wl) wl.innerHTML = `<b>${wk.n} countries in seven days</b> — ${wk.flags.join(' ')} — the Baltic run off the
    Sapphire Princess, a new stamp almost every morning.`;

  const mr = document.getElementById('mrail2');
  const maxc = Math.max(...W.months.map(m => m.countries));
  W.months.forEach(m => {
    const col = el('div', 'mcol' + (m.countries === maxc ? ' peak' : ''));
    const b = el('div', 'mb');
    b.dataset.h = Math.round(16 + (m.countries / maxc) * 84) + '%';
    col.appendChild(el('div', 'mn', m.countries || '·'));
    col.appendChild(b);
    col.appendChild(el('div', 'ml', m.name.slice(0, 3).toUpperCase()));
    col.title = `${m.name}: ${m.countries} countries, ${m.days} tracked days`;
    mr.appendChild(col);
  });

  bars('#lbBars', (W.top || []).slice(0, 10).map((c, i) =>
    ({ nm: c.flag + ' ' + c.name, v: c.days, max: W.top[0].days, sub: 'd', mute: i > 5 })));

  if (NEXT) {
    const n = NEXT.now;
    document.getElementById('nowCity').textContent = `${n.city}, ${n.country}`;
    document.getElementById('nowLine').textContent = n.line;
    const since = new Date(n.since + 'T00:00:00Z');
    document.getElementById('nowDay').textContent = Math.max(1, Math.floor((Date.now() - since.getTime()) / 864e5) + 1);
    const list = document.getElementById('nextList');
    NEXT.next.forEach(x => {
      const a = new Date(x.from + 'T00:00:00Z'), b = new Date(x.to + 'T00:00:00Z');
      const inDays = Math.round((a.getTime() - Date.now()) / 864e5);
      const o = { day: 'numeric', month: 'short', timeZone: 'UTC' };
      const range = x.from === x.to ? a.toLocaleDateString('en-GB', o)
        : a.toLocaleDateString('en-GB', o) + ' – ' + b.toLocaleDateString('en-GB', o);
      const flag = x.cc ? [...x.cc].map(ch => String.fromCodePoint(0x1F1E6 + ch.charCodeAt(0) - 65)).join('') : '📍';
      list.appendChild(el('div', 'nx',
        `<em>${flag}</em>
         <div class="w"><b>${x.city}</b><span>${range} · ${x.status}</span>
           <span style="color:#c2c9e8;font-family:var(--sans);font-size:13px;margin-top:6px">${x.line}</span></div>
         <div class="cd">${inDays > 0 ? 'in ' + inDays + 'd' : 'now'}</div>`));
    });
  }

  const g = document.getElementById('genline');
  if (g && W.generated) g.textContent = new Date(W.generated)
    .toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  observe();
}

function bars(sel, rows) {
  const host = document.querySelector(sel);
  if (!host) return;
  rows.forEach(r => {
    const b = el('div', 'bar' + (r.mute ? ' mute' : ''));
    b.appendChild(el('div', 'nm', r.nm));
    const tr = el('div', 'tr'), fi = el('div', 'fi');
    fi.dataset.w = Math.max(1.5, (r.v / r.max) * 100) + '%';
    tr.appendChild(fi); b.appendChild(tr);
    b.appendChild(el('div', 'vl', fmt(r.v) + (r.sub ? '<span style="opacity:.45"> ' + r.sub + '</span>' : '')));
    host.appendChild(b);
  });
}

/* ---------------------------------------------------------- reveal + rail */
const rail = document.getElementById('rail');
SCENES.forEach(() => rail.appendChild(el('i', null, '<b></b>')));
const nav = document.getElementById('nav');
let current = 0;

function markRail(i) {
  [...rail.children].forEach((s, k) => s.classList.toggle('done', k <= i));
  nav.innerHTML = `<b>${String(i + 1).padStart(2, '0')}</b> / ${SCENES.length} &nbsp;·&nbsp; ` +
    (film ? 'film running · space to pause' : 'scroll or press →');
}

function enter(sc) {
  sc.classList.add('in');
  sc.querySelectorAll('[data-raw]').forEach(countUp);
  sc.querySelectorAll('.fi').forEach(f => { f.style.width = f.dataset.w; });
  sc.querySelectorAll('.mb').forEach((m, i) => setTimeout(() => { m.style.height = m.dataset.h; }, 90 + i * 55));
}

function observe() {
  const io = new IntersectionObserver(es => {
    es.forEach(e => {
      if (e.intersectionRatio > .5) {
        current = SCENES.indexOf(e.target);
        markRail(current);
        enter(e.target);
      }
    });
  }, { root: DECK, threshold: [0, .25, .5, .75] });
  SCENES.forEach(s => io.observe(s));
  enter(SCENES[0]);
  markRail(0);
}

/* ---------------------------------------------------------- navigation */
function go(i, smooth = true) {
  i = Math.max(0, Math.min(SCENES.length - 1, i));
  DECK.scrollTo({ top: SCENES[i].offsetTop, behavior: (smooth && !RM) ? 'smooth' : 'auto' });
  current = i; markRail(i);
}
addEventListener('keydown', e => {
  if (['ArrowDown', 'ArrowRight', 'PageDown'].includes(e.key)) { e.preventDefault(); pause(); go(current + 1); }
  else if (['ArrowUp', 'ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); pause(); go(current - 1); }
  else if (e.key === ' ') { e.preventDefault(); film ? pause() : startFilm(); }
  else if (e.key === 'Escape') pause();
  else if (e.key === 'f') document.getElementById('frameBtn').click();
});

/* ---------------------------------------------------------- film mode */
let film = false, filmT = null, rate = 1;
const filmBtn = document.getElementById('filmBtn');

function startFilm(from) {
  film = true;
  document.body.classList.add('cinema');
  filmBtn.textContent = '❚❚ PAUSE';
  filmBtn.classList.add('on');
  if (from != null && from !== current) { go(from); setTimeout(step, 520); } else step();
}
function step() {
  clearTimeout(filmT);
  if (!film) return;
  const dur = (+SCENES[current].dataset.dur || 5200) * rate;
  const seg = rail.children[current] && rail.children[current].firstChild;
  if (seg) {
    seg.style.transition = 'none'; seg.style.width = '0%';
    requestAnimationFrame(() => { seg.style.transition = `width ${dur}ms linear`; seg.style.width = '100%'; });
  }
  filmT = setTimeout(() => {
    if (!film) return;
    if (current >= SCENES.length - 1) { pause(); return; }
    go(current + 1);
    setTimeout(step, 420);
  }, dur);
}
function pause() {
  if (!film) return;
  film = false; clearTimeout(filmT);
  document.body.classList.remove('cinema');
  filmBtn.textContent = '▶ FILM';
  filmBtn.classList.remove('on');
  markRail(current);
}
filmBtn.addEventListener('click', () => film ? pause() : startFilm());
document.getElementById('startBtn').addEventListener('click', () => startFilm(1));
const again = document.getElementById('againBtn');
if (again) again.addEventListener('click', () => startFilm(0));

/* speed picker — slower first, 1x default */
const spWrap = el('div');
spWrap.style.cssText = 'display:flex;gap:4px';
[['0.5×', 2], ['0.75×', 1.333], ['1×', 1], ['1.5×', 0.666]].forEach(([lab, mult]) => {
  const b = el('button', mult === 1 ? 'on' : null, lab);
  b.style.padding = '11px 12px';
  b.title = 'Film speed (0.5× is slower)';
  b.addEventListener('click', () => {
    rate = mult;
    [...spWrap.children].forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    if (film) step();
  });
  spWrap.appendChild(b);
});
document.querySelector('.ctl').prepend(spWrap);

/* 9:16 frame for vertical video capture */
document.getElementById('frameBtn').addEventListener('click', e => {
  document.body.classList.toggle('frame');
  e.currentTarget.classList.toggle('on');
  setTimeout(() => go(current, false), 60);
});

/* motion toggle */
const muteBtn = document.getElementById('muteBtn');
muteBtn.addEventListener('click', () => {
  const off = document.body.classList.toggle('stillness');
  muteBtn.classList.toggle('on', !off);
  document.querySelectorAll('.glows i').forEach(i => i.style.animationPlayState = off ? 'paused' : 'running');
  if (off) {
    cancelAnimationFrame(fxRAF);
    const c = document.getElementById('fx');
    c.getContext('2d').clearRect(0, 0, c.width, c.height);
  } else fx();
});

/* deep links */
const q = new URLSearchParams(location.search);
if (q.get('frame') === '1') document.getElementById('frameBtn').click();
if (q.get('speed')) { const m = parseFloat(q.get('speed')); if (m > 0) rate = 1 / m; }
if (q.get('film') === '1') setTimeout(() => startFilm(0), 700);
if (location.hash === '#next') setTimeout(() => go(SCENES.findIndex(s => s.id === 'next'), false), 150);

/* ---------------------------------------------------------- canvas sparks */
const cv = document.getElementById('fx');
const ctx = cv.getContext('2d');
let fxRAF = 0, stars = [];
function sizeFx() {
  const dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
  cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  stars = Array.from({ length: Math.round(innerWidth * innerHeight / 26000) }, () => ({
    x: Math.random() * innerWidth, y: Math.random() * innerHeight,
    r: Math.random() * 1.4 + .25, v: Math.random() * .2 + .04, a: Math.random() * .45 + .1
  }));
}
function fx() {
  if (RM || document.body.classList.contains('stillness')) return;
  cancelAnimationFrame(fxRAF);
  (function loop() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ctx.fillStyle = '#cfe0ff';
    for (const s of stars) {
      s.x -= s.v; if (s.x < -4) { s.x = innerWidth + 4; s.y = Math.random() * innerHeight; }
      ctx.globalAlpha = s.a;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.283); ctx.fill();
    }
    ctx.globalAlpha = 1;
    fxRAF = requestAnimationFrame(loop);
  })();
}
addEventListener('resize', sizeFx);
sizeFx(); fx();
markRail(0);
