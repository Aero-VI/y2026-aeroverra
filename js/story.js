// The story: one chapter per screen, each with its own camera move on the globe behind it.
import { fmt, flag, longDate, dateParts } from './data.js?v=9';
import { setHot, setVisited, setLit, styleLegsState } from './map.js?v=9';
import { countryColor, TAIL } from './palette.js?v=9';
import { slerp, clamp } from './geo.js?v=9';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const phone = () => window.innerWidth <= 760;
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const stat = (n, u) => `<h2 class="stat"><span class="n">${n}</span><span class="u">${u}</span></h2>`;
const inJapan = p => p[0] > 30 && p[0] < 46 && p[1] > 128 && p[1] < 146;
const parallel = lat => Array.from({ length: 181 }, (_, k) => [lat, -180 + k * 2]);
const hm = mins => `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;

export function chapters(A) {
  const W = A.wrapped, N = A.next;
  const legs = A.legs;
  const byNum = n => legs.find(L => L.n === n);
  const lf = W.longest_flight;
  const longest = byNum(lf.num);
  const big = legs.filter(L => L.d0 === W.biggest_day.d && L.t === 'f');
  const jp = legs.filter(L => inJapan(L.a) && inJapan(L.b));
  const bw = W.busiest_week;
  const week = legs.filter(L => L.d0 >= '2026-06-13' && L.d1 <= bw.end && L.i0 >= A.dayIdx['2026-06-13']);
  const firstEver = new Set(W.new_countries.map(c => c.cc));
  const today = new Date().toISOString().slice(0, 10);

  const all = A.countriesAll;
  const sea = all.find(c => c.cc === 'SEA');
  const ranked = all.slice().sort((a, b) => b.days - a.days);
  const top = ranked.filter(c => c.days >= 5);
  const tail = ranked.filter(c => c.days < 5);

  // where he is now, judged by the reader's own date
  const every = [{ ...N.now, from: N.now.since, status: 'now' }, ...N.next];
  let ahead = every.filter(e => (e.to || e.from) >= today);
  if (!ahead.length) ahead = every.slice(-1);
  const nowIdx = Math.max(0, ahead.findIndex(e => e.from <= today && (e.to || e.from) >= today));

  return [
    {
      id: 'hero',
      cam: { c: [26, -44], z: 1.8 },
      pad: 'hero',
      spin: 1,
      intro: true,
      html: `
        <p class="hero-name">Nicholas Halka</p>
        <h1 class="hero-title">Where <span class="yr">2026</span> went</h1>
        <p class="lede">Every flight, ship and train of his year, drawn on the globe in the order it happened: <strong>${W.countries} countries</strong> and <strong>${fmt(W.total_miles)} miles</strong> so far.</p>
        <div class="hero-acts">
          <button class="btn btn-solid" type="button" data-act="play">Play the year</button>
          <a class="btn btn-ghost" href="#countries">Read the story</a>
        </div>
        <p class="asof">Through ${longDate(A.today)}, day ${W.day_of_year} of 365.</p>`,
    },
    {
      id: 'countries',
      cam: { c: [34, 18], z: 1.25 },
      spin: 1,
      lit: true,
      legs: { all: 0.3 },
      html: `
        ${stat(W.countries, 'countries')}
        <p class="lede">${W.countries_nonus} outside the US, and <strong>${firstEver.size} of them for the first time</strong>, from Australia in January to Gibraltar in October. Territories count on their own.</p>
        <ul class="viz flags">${A.countries.slice().sort((a, b) => b.days - a.days).map(c => `
          <li class="${firstEver.has(c.cc) ? 'new' : ''}" title="${esc(c.name)}"><span class="f" aria-hidden="true">${flag(c.cc)}</span><b>${c.cc}</b>${c.days} ${c.days === 1 ? 'day' : 'days'}</li>`).join('')}
        </ul>
        <p class="key"><i></i>First time ever</p>`,
    },
    {
      id: 'distance',
      cam: { c: [18, -20], z: 1.2 },
      spin: 1,
      legs: { all: 0.85 },
      html: `
        ${stat(fmt(W.total_miles), 'miles')}
        <p class="lede">That is ${W.equators.toFixed(1)} laps of the equator, or ${Math.round(W.moon_pct)}% of the way to the Moon.</p>
        <div class="split" aria-hidden="true">
          <span style="flex:${W.air_miles};background:var(--amber)"></span>
          <span style="flex:${W.sea_miles};background:var(--sea)"></span>
          <span style="flex:${W.rail_miles};background:var(--rail)"></span>
        </div>
        <ul class="split-legend">
          <li><i style="background:var(--amber)"></i><b>${fmt(W.air_miles)}</b> in the air</li>
          <li><i style="background:var(--sea)"></i><b>${fmt(W.sea_miles)}</b> at sea</li>
          <li><i style="background:var(--rail)"></i><b>${fmt(W.rail_miles)}</b> by train and bus</li>
        </ul>`,
    },
    {
      id: 'flights',
      cam: { c: [32, -35], z: 1.3 },
      spin: 1,
      legs: { focus: ['f'] },
      html: `
        ${stat(W.flights, 'flights')}
        <p class="lede"><strong>${W.air_hours} hours</strong> in the air on ${W.airlines} airlines, through ${W.airports} airports. A flight every ${Math.round(W.flight_every)} days, and ${W.redeyes} overnighters.</p>
        <ul class="viz bars">${W.top_airports.slice(0, 6).map(([code, n]) => `
          <li><span class="nm">${code}</span><span class="bar" style="width:${(n / W.top_airports[0][1]) * 100}%"></span><span class="v">${n}</span></li>`).join('')}
        </ul>
        <p class="key">Times through each airport</p>`,
    },
    {
      id: 'bigday',
      cam: { c: [10, -138], z: 1.45 },
      legs: { ids: big.map(L => L.i) },
      anim: { legs: big, loop: 7.5 },
      html: `
        ${stat(fmt(W.biggest_day.miles), 'miles in one day')}
        <p class="lede">${longDate(W.biggest_day.d)} started at home in Myrtle Beach and ended over the Pacific: three flights, one day.</p>
        <ul class="viz legs">${W.biggest_day.legs.map(l => `
          <li><span class="code">${esc(l.num)}</span><span>${esc(l.frm)} to ${esc(l.to)}</span><span class="v">${fmt(l.miles)} mi</span></li>`).join('')}
        </ul>`,
    },
    {
      id: 'dateline',
      cam: { c: [2, -172], z: 1.75 },
      legs: { ids: [longest.i] },
      anim: { legs: [longest], loop: 6.5 },
      guides: [{ pts: Array.from({ length: 61 }, (_, k) => [-60 + k * 2, 180]), color: '#ffb547', dash: [5, 6], label: 'Date line', labelAt: 0.62 }],
      html: `
        ${stat(hm(lf.mins), 'the longest flight')}
        <p class="lede">${esc(lf.num)} from Los Angeles to Brisbane, ${fmt(lf.miles)} miles overnight. It left at ${lf.dep_local} on ${longDate(lf.date)} and landed at ${lf.arr_local} on the 16th.</p>
        <p class="lede"><strong>January 15 never happened.</strong> Flying west over the date line skipped it, so it is the one blank square in his calendar.</p>`,
    },
    {
      id: 'japan',
      cam: { c: [37.6, 138.4], z: 4.7, p: 28 },
      legs: { ids: jp.map(L => L.i) },
      hot: 'JP',
      html: `
        ${stat(W.top_nonus[0].days, 'days in Japan')}
        <p class="lede"><strong>${W.longest_runs[0].n} of them in a row</strong>, from ${longDate(W.longest_runs[0].start)} into May: Hokkaido, Tokyo, a Grand Prix at Suzuka, then Osaka, Himeji, Akita and Kyoto by Shinkansen.</p>
        <ul class="viz stops">${['Tokyo', 'Niseko', 'Nagoya', 'Suzuka', 'Osaka', 'Himeji', 'Kyoto', 'Akita', 'Noshiro'].map(s => `<li>${s}</li>`).join('')}</ul>`,
    },
    {
      id: 'ships',
      cam: { c: [38, -28], z: 1.3 },
      spin: 1,
      legs: { focus: ['c'] },
      html: `
        ${stat(W.cruise_nights, 'nights on ships')}
        <p class="lede">${W.cruises} cruises and ${W.port_calls} port calls: the Great Barrier Reef, Darwin to Bali, the Baltic, Alaska's Inside Passage, and the Atlantic twice.</p>
        <ul class="viz legs ships">${W.ships.slice().sort((a, b) => a.start.localeCompare(b.start)).map(s => `
          <li><span class="code">${esc(s.ship.replace(/^Carnival /, ''))}</span><span>${esc(shortPort(s.frm))} to ${esc(shortPort(s.to))}</span><span class="v">${s.nights} nights</span></li>`).join('')}
        </ul>`,
    },
    {
      id: 'week',
      cam: { c: [57.5, 19], z: 3.9, p: 15 },
      legs: { ids: week.map(L => L.i) },
      anim: { legs: week, loop: 9 },
      html: `
        ${stat(bw.n, 'countries in a week')}
        <p class="lede">${longDate(bw.start)} to ${longDate(bw.end)}: the Baltic on the Sapphire Princess, then a flight to London.</p>
        <ul class="viz stops">${bw.ccs.map(cc => `<li>${flag(cc)} <b>${esc(A.names[cc])}</b></li>`).join('')}</ul>`,
    },
    {
      id: 'f1',
      cam: { c: [44, 78], z: 1.45 },
      legs: { all: 0.2 },
      pins: [{ p: [34.8431, 136.5407], label: 'Suzuka' }, { p: [47.5789, 19.2486], label: 'Hungaroring' }],
      html: `
        ${stat('2', 'Grand Prix weekends')}
        <p class="lede">Formula 1 at Suzuka in March, then the Hungaroring outside Budapest in July.</p>`,
    },
    {
      id: 'hotels',
      cam: { c: [35.7027, 139.7716], z: 15.2, p: 58, b: -24 },
      legs: { all: 0 },
      pins: [{ p: [35.7027, 139.7716], label: 'APA Hotel Akihabara' }],
      html: `
        ${stat(W.hotels, 'hotels')}
        <p class="lede">${W.hotel_nights} hotel nights. The longest stay was <strong>${W.longest_stay.nights} nights at the APA Hotel in Akihabara</strong>, Tokyo's electronics district.</p>
        <ul class="viz bars">${W.hotel_cities.slice(0, 5).map(([c, n]) => `
          <li><span class="nm">${esc(c)}</span><span class="bar" style="width:${(n / W.hotel_cities[0][1]) * 100}%;--c:var(--ink-3)"></span><span class="v">${n}</span></li>`).join('')}
        </ul>
        <p class="key">Hotels per city</p>`,
    },
    {
      id: 'home',
      cam: { c: [33.85, -79.1], z: 7.6, p: 20 },
      legs: { all: 0.35 },
      hot: 'US',
      pins: [{ p: [33.6891, -78.8867] }],
      html: `
        ${stat(W.home_days, 'nights in his own bed')}
        <p class="lede">Home is Myrtle Beach. Of the ${W.day_of_year} days so far, he spent ${W.days_us} in the US, ${W.days_abroad} abroad and ${W.days_sea} at sea.</p>
        <div class="split" aria-hidden="true">
          <span style="flex:${W.days_us};background:${countryColor('US')}"></span>
          <span style="flex:${W.days_abroad};background:var(--amber)"></span>
          <span style="flex:${W.days_sea};background:var(--sea)"></span>
        </div>
        <ul class="split-legend">
          <li><i style="background:${countryColor('US')}"></i><b>${W.days_us}</b> in the US</li>
          <li><i style="background:var(--amber)"></i><b>${W.days_abroad}</b> abroad</li>
          <li><i style="background:var(--sea)"></i><b>${W.days_sea}</b> at sea</li>
        </ul>`,
    },
    {
      id: 'extremes',
      cam: { c: [12, 92], z: 1.05 },
      legs: { all: 0.25 },
      guides: [
        { pts: parallel(W.north.lat), color: '#ffb547', label: `${W.north.lat.toFixed(1)}° N`, labelAt: 0.6 },
        { pts: parallel(W.south.lat), color: '#55d6c2', label: `${Math.abs(W.south.lat).toFixed(1)}° S`, labelAt: 0.6 },
      ],
      pins: [{ p: [60.17, 24.94], label: 'Helsinki' }, { p: [-33.87, 151.21], label: 'Sydney' }],
      html: `
        ${stat(`${Math.round(W.span_lat)}°`, 'of latitude')}
        <p class="lede">From the Baltic summer to the Australian one.</p>
        <ul class="viz compass">
          <li><span class="k">Farthest north</span><span class="p">${esc(W.north.label)}</span><span class="d">${W.north.lat.toFixed(2)}° N</span></li>
          <li><span class="k">Farthest south</span><span class="p">${esc(W.south.label)}</span><span class="d">${Math.abs(W.south.lat).toFixed(2)}° S</span></li>
          <li><span class="k">Farthest east</span><span class="p">${esc(W.east.label)}</span><span class="d">${W.east.lon.toFixed(2)}° E</span></li>
          <li><span class="k">Farthest west</span><span class="p">${esc(W.west.label)}</span><span class="d">${Math.abs(W.west.lon).toFixed(2)}° W</span></li>
        </ul>`,
    },
    {
      id: 'days',
      cam: { c: [30, 20], z: 1.1 },
      spin: 1,
      heavy: true,
      legs: { all: 0.3 },
      html: `
        <h2 class="stat"><span class="u" style="margin:0">Where the days went</span></h2>
        <ul class="viz bars" style="margin-top:22px">${top.map(c => `
          <li><span class="nm">${c.cc === 'SEA' ? 'At sea' : `${flag(c.cc)} ${esc(c.name)}`}</span><span class="bar" style="width:${(c.days / ranked[0].days) * 100}%;--c:${countryColor(c.cc)}"></span><span class="v">${c.days}</span></li>`).join('')}
          <li><span class="nm">${tail.length} more</span><span class="bar" style="width:${(tail.reduce((s, c) => s + c.days, 0) / ranked[0].days) * 100}%;--c:${TAIL}"></span><span class="v">${tail.reduce((s, c) => s + c.days, 0)}</span></li>
        </ul>
        <p class="key">Days per country. A travel day counts for both ends, so the total runs past ${W.day_of_year}.</p>`,
    },
    {
      id: 'calendar',
      cam: { c: [30, 20], z: 1.1 },
      spin: 1,
      heavy: true,
      legs: { all: 0.3 },
      html: `
        <h2 class="stat"><span class="u" style="margin:0">Every day of the year</span></h2>
        <p class="lede">Each square is a day, coloured by where he woke up. Pick one to play the year from there.</p>
        ${calendar(A)}
        <p class="cal-tip" id="calTip" aria-live="polite"></p>`,
    },
    {
      id: 'next',
      cam: { c: [14, 12], z: 2.2 },
      legs: { all: 0.25 },
      next: ahead,
      nowIdx,
      html: `
        <h2 class="stat"><span class="u" style="margin:0">Right now and next</span></h2>
        <ul class="viz ahead">${ahead.map((e, k) => `
          <li class="${k === nowIdx ? 'now' : ''}">
            <span class="when">${k === nowIdx ? 'Now' : range(e.from, e.to)}</span>
            <div><span class="where">${esc(e.city)}</span>${e.status !== 'now' ? `<span class="tag ${e.status}">${e.status}</span>` : ''}
            <p class="what">${flag(e.cc)} ${esc(e.country)}. ${esc(e.line)}</p></div>
          </li>`).join('')}
        </ul>
        <p class="meet">Nearby? He wants to hear from you. Say hi on Instagram at <a href="https://www.instagram.com/nnickkh/">@nnickkh</a>.</p>`,
    },
    {
      id: 'finale',
      cam: { c: [24, -42], z: 1.2 },
      spin: 1,
      legs: { all: 0.7 },
      html: `
        <h2 class="hero-title">Watch it happen</h2>
        <p class="lede">All ${legs.length} legs in order, with the camera riding along. About four and a half minutes at normal speed, and you can scrub to any day.</p>
        <div class="hero-acts"><button class="btn btn-solid" type="button" data-act="play">Play the year</button></div>
        <p class="method">Built from his booking confirmations: every flight, train, bus, cruise and hotel. A day counts for each country he set foot in. Dotted lines are hops with no ticket on file, like a drive or a local train. Distances are great circles. Updated ${longDate(A.today)}, 2026.<br><br>Map © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="https://openmaptiles.org">OpenMapTiles</a>, served by <a href="https://openfreemap.org">OpenFreeMap</a>. Terrain from Mapzen on AWS Open Data. Borders from Natural Earth.</p>`,
    },
  ];
}

const shortPort = s => String(s).replace('Cape Canaveral', 'Port Canaveral');
function range(a, b) {
  const pa = dateParts(a);
  if (!b || a === b) return `${pa.mon} ${pa.d}`;
  const pb = dateParts(b);
  return pa.m === pb.m ? `${pa.mon} ${pa.d} to ${pb.d}` : `${pa.mon} ${pa.d} to ${pb.mon} ${pb.d}`;
}

function calendar(A) {
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const rows = M.map((m, k) => {
    const days = A.days.filter(d => Number(d.d.slice(5, 7)) === k + 1);
    return `<div class="cal-row"><span>${m}</span><div class="cal-days">${days.map(d => {
      const cls = d.future ? 'future' : (!d.ccs || !d.ccs.length) ? 'blank' : '';
      const cc = d.ccs && d.ccs.length ? (d.ccs.find(c => c !== 'US' && c !== 'SEA') || d.ccs[0]) : null;
      const style = cc && !d.future ? ` style="--c:${countryColor(cc)}"` : '';
      return `<button type="button" class="${cls}" data-day="${d.i}"${style} aria-label="${d.d}"${d.future ? ' tabindex="-1"' : ''}></button>`;
    }).join('')}</div></div>`;
  });
  const keys = ['US', 'JP', 'SEA', 'AU', 'MT', 'ES', 'GB'];
  return `<div class="viz cal">${rows.join('')}</div>
    <ul class="cal-key">${keys.map(c => `<li><i style="background:${countryColor(c)}"></i>${c === 'SEA' ? 'At sea' : esc(A.names[c])}</li>`).join('')}<li><i style="background:${TAIL}"></i>Everywhere else</li></ul>`;
}

// ---------------------------------------------------------------- controller
export class Story {
  constructor(map, overlay, A, onPlay) {
    this.map = map; this.ov = overlay; this.A = A; this.onPlay = onPlay;
    this.list = chapters(A);
    this.root = document.getElementById('story');
    this.root.innerHTML = this.list.map(ch => `<section class="ch ${ch.id === 'hero' ? 'hero' : ch.id === 'finale' ? 'finale' : ''}" id="${ch.id}" data-ch="${ch.id}"><div class="ch-body">${ch.html}</div></section>`).join('');
    this.cur = null;
    this.visitedAll = new Set(A.countries.map(c => c.cc));
    this.bindCalendar();
    this.observe();
  }

  padding(ch) {
    const W = window.innerWidth, H = window.innerHeight;
    if (phone()) return { top: 64, bottom: Math.round(H * (ch.id === 'hero' ? 0.42 : 0.5)), left: 0, right: 0 };
    if (ch.pad === 'hero') return { top: 40, bottom: Math.round(H * 0.12), left: Math.round(W * 0.42), right: 0 };
    const col = Math.min(560, W * 0.44) + Math.min(56, W * 0.04);
    return { top: 70, bottom: 40, left: Math.round(col + 24), right: 24 };
  }

  /** Chapter zooms are written for a 700px view; scale to the room actually left beside the text. */
  zoomFor(ch, pad) {
    const W = window.innerWidth, H = window.innerHeight;
    const v = Math.max(240, Math.min(W - pad.left - pad.right, H - pad.top - pad.bottom));
    return ch.cam.z + Math.log2(v / 700);
  }

  observe() {
    const io = new IntersectionObserver(es => {
      for (const e of es) if (e.isIntersecting) this.activate(e.target.dataset.ch);
    }, { rootMargin: '-48% 0px -48% 0px' });
    this.root.querySelectorAll('.ch').forEach(s => io.observe(s));
  }

  activate(id, instant = false) {
    if (this.cur && this.cur.id === id && !instant) return;
    const ch = this.list.find(c => c.id === id);
    if (!ch) return;
    this.cur = ch;
    this.chStart = performance.now();
    if (this.suspended) return;
    this.apply(ch, instant);
  }

  apply(ch, instant) {
    const m = this.map, A = this.A;
    const pad = this.padding(ch);
    const view = { center: [ch.cam.c[1], ch.cam.c[0]], zoom: this.zoomFor(ch, pad), pitch: ch.cam.p || 0, bearing: ch.cam.b || 0, padding: pad };
    if (instant) m.jumpTo(view);
    else m.flyTo({ ...view, curve: 1.42, speed: 0.9, maxDuration: 4200, essential: true });
    const L = ch.legs || {};
    if (ch.intro && !this.introDone) this.intro();
    else styleLegsState(m, A, L.ids ? { ids: L.ids } : L.focus ? { focus: L.focus } : {});
    if (!ch.intro && L.all != null) for (const leg of A.legs) m.setFeatureState({ source: 'legs', id: leg.i }, { on: true, op: L.all });
    setVisited(m, A, this.visitedAll);
    setHot(m, A, ch.hot || null);
    setLit(m, A, !!ch.lit);
    this.ov.pins = ch.pins || [];
    this.ov.guides = (ch.guides || []).slice();
    if (ch.next) this.ov.guides.push(...futureGuides(ch.next, ch.nowIdx));
    if (ch.next) this.ov.pins = ch.next.slice(ch.nowIdx).map((e, k) => ({ p: e.p, label: k === 0 ? `${e.city}, now` : e.city }));
    this.ov.legs = []; this.ov.vehicle = null; this.ov.here = null;
    document.querySelector('.scrim').classList.toggle('is-heavy', !!ch.heavy);
    m.triggerRepaint();
  }

  /** The one orchestrated moment: the year's routes draw themselves in order on page load. */
  intro() {
    this.introDone = true;
    const n = this.A.legs.length, dur = reduced() ? 0 : 3400;
    const start = performance.now();
    const step = () => {
      const k = dur ? clamp((performance.now() - start) / dur, 0, 1) : 1;
      const upTo = Math.round(n * k);
      for (let i = this.shown || 0; i < upTo; i++) this.map.setFeatureState({ source: 'legs', id: i }, { on: true, op: 0.62 });
      this.shown = upTo;
      this.map.triggerRepaint();
      if (k < 1) requestAnimationFrame(step);
    };
    for (const L of this.A.legs) this.map.setFeatureState({ source: 'legs', id: L.i }, { on: false });
    this.shown = 0;
    requestAnimationFrame(step);
  }

  /** Per-frame work while the story is showing: idle spin and looping leg animations. */
  tick(dt) {
    const ch = this.cur;
    if (!ch || this.suspended) return;
    const m = this.map;
    if (ch.anim) {
      const t = ((performance.now() - this.chStart) / 1000) % ch.anim.loop;
      const legs = ch.anim.legs;
      const total = ch.anim.loop * 0.8;
      const per = total / legs.length;
      const active = [];
      let veh = null;
      legs.forEach((L, k) => {
        const f = clamp((t - k * per) / per, 0, 1);
        if (f > 0) active.push({ L, f, alpha: t > total ? 1 - (t - total) / (ch.anim.loop - total) : 1 });
        if (f > 0 && f < 1) veh = { L, f };
      });
      this.ov.legs = active;
      this.ov.vehicle = veh;
      m.triggerRepaint();
    }
    if (ch.spin && !reduced() && !m.isMoving()) {
      const c = m.getCenter();
      m.jumpTo({ center: [c.lng + dt * 2.2 * ch.spin, c.lat] });
    } else if (ch.pins || ch.next) {
      m.triggerRepaint();
    }
  }

  bindCalendar() {
    const tip = () => document.getElementById('calTip');
    const A = this.A;
    const say = i => {
      const d = A.days[i];
      if (!d || d.future) return;
      if (!d.ccs || !d.ccs.length) { tip().innerHTML = `<b>${longDate(d.d)}</b> never happened: lost to the date line on the way to Australia.`; return; }
      const where = d.city === 'At sea' ? 'at sea' : `${esc(d.city)}, ${esc(A.names[d.cc] || '')}`;
      const extra = d.ccs.length > 1 ? ` (${d.ccs.filter(c => c !== 'SEA').map(c => flag(c)).join(' ')} in one day)` : '';
      tip().innerHTML = `<b>${longDate(d.d)}</b> ${where}${extra}`;
    };
    this.root.addEventListener('pointerover', e => { const b = e.target.closest('[data-day]'); if (b) say(Number(b.dataset.day)); });
    this.root.addEventListener('focusin', e => { const b = e.target.closest('[data-day]'); if (b) say(Number(b.dataset.day)); });
    this.root.addEventListener('click', e => {
      const b = e.target.closest('[data-day]');
      if (b && !b.classList.contains('future')) this.onPlay(Number(b.dataset.day));
    });
  }
}

function futureGuides(list, nowIdx) {
  const out = [];
  const pts = list.slice(nowIdx);
  for (let k = 0; k < pts.length - 1; k++) {
    const a = pts[k].p, b = pts[k + 1].p;
    out.push({ pts: Array.from({ length: 41 }, (_, j) => slerp(a, b, j / 40)), color: '#efe9dc', dash: [2, 6], width: 2, alpha: 0.9 });
  }
  return out;
}
