// The story: one chapter per screen, each with its own camera move on the globe behind it.
import { fmt, flag, longDate, dateParts } from './data.js?v=16';
import { setHot, setVisited, setLit, styleLegsState } from './map.js?v=16';
import { countryColor, TAIL } from './palette.js?v=16';
import { slerp, clamp, smooth as smoothstep } from './geo.js?v=16';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const phone = () => window.innerWidth <= 760;
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const stat = (n, u) => `<h2 class="stat"><span class="n">${n}</span><span class="u">${u}</span></h2>`;
const parallel = lat => Array.from({ length: 181 }, (_, k) => [lat, -180 + k * 2]);
const hm = mins => `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;

export function chapters(A) {
  const W = A.wrapped, N = A.next, S = A.site, Y = A.year;
  const legs = A.legs;
  const note = id => (S.notes && S.notes[id]) || '';
  const lf = W.longest_flight;
  const longest = lf && (legs.find(L => L.t === 'f' && L.d0 === lf.date && L.al === lf.frm && L.bl === lf.to) || legs.find(L => L.n === lf.num));
  const big = legs.filter(L => L.d0 === W.biggest_day.d && L.t === 'f');
  const bw = W.busiest_week;
  const weekFrom = A.days[Math.max(0, (A.dayIdx[bw.start] ?? 0) - 1)].d;
  const week = legs.filter(L => L.d0 >= weekFrom && L.d1 <= bw.end);
  const firstEver = W.new_countries.slice().sort((a, b) => a.on.localeCompare(b.on));
  const today = new Date().toISOString().slice(0, 10);
  const month = iso => dateParts(iso).mon.replace(/^(Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$/, m => ({ Jan: 'January', Feb: 'February', Mar: 'March', Apr: 'April', Jun: 'June', Jul: 'July', Aug: 'August', Sep: 'September', Oct: 'October', Nov: 'November', Dec: 'December' }[m]));
  const placeOf = name => A.places.find(p => p.name === name);

  const all = A.countriesAll;
  const ranked = all.slice().sort((a, b) => b.days - a.days);
  const top = ranked.filter(c => c.days >= 5);
  const tail = ranked.filter(c => c.days < 5);

  // the country (outside home) he spent longest in, and the places he slept there
  const tc = W.top_nonus[0];
  const tcPlaces = A.places.filter(p => p.cc === tc.cc).sort((a, b) => b.days - a.days);
  const tcRun = W.longest_runs.find(r => r.cc === tc.cc);
  const tcLegs = legs.filter(L => L.acc === tc.cc && L.bcc === tc.cc);

  // the blank square in the calendar, if the date line ate a day
  const lostDay = A.days.find(d => !d.future && d.ccs && !d.ccs.length);

  const every = N ? [{ ...N.now, from: N.now.since, status: 'now' }, ...N.next] : [];
  let ahead = every.filter(e => (e.to || e.from) >= today);
  if (!ahead.length) ahead = every.slice(-1);
  const nowIdx = Math.max(0, ahead.findIndex(e => e.from <= today && (e.to || e.from) >= today));

  const minutes = Math.max(2, Math.round((legs.length * 2.1 + 70) / 60));
  const lastPos = A.days[A.todayIdx].p;
  const north = placeOf(W.north.label), south = placeOf(W.south.label);
  const stay = W.longest_stay, stayPlace = placeOf(stay.city);
  const hotelPin = S.hotel || (stayPlace && { p: stayPlace.p, label: null, z: 11.5, p0: 30 });

  const list = [
    {
      id: 'hero',
      cam: { c: [26, -44], z: 1.8 },
      pad: 'hero',
      spin: 1,
      intro: true,
      html: `
        <p class="hero-name">Nicholas Halka</p>
        <h1 class="hero-title">Where <span class="yr">${Y}</span> went</h1>
        <p class="lede">Every flight, ship and train of his year, drawn on the globe in the order it happened: <strong>${W.countries} countries</strong> and <strong>${fmt(W.total_miles)} miles</strong>${A.complete ? '' : ' so far'}.</p>
        <div class="hero-acts">
          <button class="btn btn-solid" type="button" data-act="play">Play the year</button>
          <button class="btn btn-ghost" type="button" data-act="auto">Watch the story</button>
        </div>
        <p class="asof">${A.complete ? `January 1 to December 31, ${Y}.` : `Through ${longDate(A.today)}, day ${W.day_of_year} of ${A.days.length}.`}${(S.siblings || []).map(s => ` <a href="${s.url}">${s.year}</a>`).join('')}</p>`,
    },
    {
      id: 'countries',
      cam: { c: [34, 18], z: 1.25 },
      spin: 1,
      lit: true,
      legs: { all: 0.3 },
      html: `
        ${stat(W.countries, 'countries')}
        <p class="lede">${W.countries_nonus} outside the US${firstEver.length ? `, and <strong>${firstEver.length} of them for the first time</strong>, from ${esc(firstEver[0].name)} in ${month(firstEver[0].on)} to ${esc(firstEver[firstEver.length - 1].name)} in ${month(firstEver[firstEver.length - 1].on)}` : ''}. Territories count on their own.</p>
        <ul class="viz flags">${A.countries.slice().sort((a, b) => b.days - a.days).map(c => `
          <li class="${firstEver.some(f => f.cc === c.cc) ? 'new' : ''}" title="${esc(c.name)}"><span class="f" aria-hidden="true">${flag(c.cc)}</span><b>${c.cc}</b><span class="d">${c.days} ${c.days === 1 ? 'day' : 'days'}</span></li>`).join('')}
        </ul>
        ${firstEver.length ? '<p class="key"><i></i>First time ever</p>' : ''}`,
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
        <p class="lede"><strong>${W.air_hours} hours</strong> in the air on ${W.airlines} airlines, through ${W.airports} airports. A flight every ${Math.round(W.flight_every)} days${W.redeyes ? `, and ${W.redeyes} overnighter${W.redeyes === 1 ? '' : 's'}` : ''}.</p>
        <ul class="viz bars">${W.top_airports.slice(0, 6).map(([code, n]) => `
          <li><span class="nm">${code}</span><span class="bar" style="width:${(n / W.top_airports[0][1]) * 100}%"></span><span class="v">${n}</span></li>`).join('')}
        </ul>
        <p class="key">Times through each airport</p>`,
    },
    big.length > 1 && {
      id: 'bigday',
      cam: camFit(big.flatMap(L => [L.a, L.b])),
      legs: { ids: big.map(L => L.i) },
      anim: { legs: big, loop: 7.5 },
      html: `
        ${stat(fmt(W.biggest_day.miles), 'miles in one day')}
        <p class="lede">${note('bigday') || `${longDate(W.biggest_day.d)} started in ${esc(big[0].ac)} and ended in ${esc(big[big.length - 1].bc)}: ${big.length} flights, one day.`}</p>
        <ul class="viz legs">${W.biggest_day.legs.map(l => `
          <li><span class="code">${esc(l.num || '✈')}</span><span>${esc(l.frm)} to ${esc(l.to)}</span><span class="v">${fmt(l.miles)} mi</span></li>`).join('')}
        </ul>`,
    },
    longest && {
      id: 'longest',
      cam: camFit([longest.a, longest.b], 0.35),
      legs: { ids: [longest.i] },
      anim: { legs: [longest], loop: 6.5 },
      guides: longest.dl != null ? [{ pts: Array.from({ length: 61 }, (_, k) => [-60 + k * 2, 180]), color: '#ffb547', dash: [5, 6], label: 'Date line', labelAt: 0.62 }] : [],
      html: `
        ${stat(hm(lf.mins), 'the longest flight')}
        <p class="lede">${lf.num ? `${esc(lf.num)} from` : 'From'} ${esc(lf.frm_city)} to ${esc(lf.to_city)}, ${fmt(lf.miles)} miles${lf.overnight ? ' overnight' : ''}. It left at ${lf.dep_local} on ${longDate(lf.date)}${lf.arr_local ? ` and landed at ${lf.arr_local}` : ''}.</p>
        ${lostDay && longest.dl != null ? `<p class="lede"><strong>${month(lostDay.d)} ${dateParts(lostDay.d).d} never happened.</strong> Flying west over the date line skipped it, so it is the one blank square in his calendar.</p>` : ''}`,
    },
    tc && {
      id: 'top-country',
      cam: { ...camFit(tcPlaces.map(p => p.p), 0.6), p: 28 },
      legs: { ids: tcLegs.map(L => L.i) },
      hot: tc.cc,
      html: `
        ${stat(tc.days, `days in ${esc(tc.name)}`)}
        <p class="lede">${note('top-country') || (tcRun && tcRun.n > 4 ? `<strong>${tcRun.n} of them in a row</strong>, from ${longDate(tcRun.start)}.` : `Across ${tcPlaces.length} ${tcPlaces.length === 1 ? 'place' : 'places'}.`)}</p>
        <ul class="viz stops">${tcPlaces.slice(0, 9).map(p => `<li>${esc(p.name)}</li>`).join('')}</ul>`,
    },
    W.cruises > 0 && {
      id: 'ships',
      cam: { c: [38, -28], z: 1.3 },
      spin: 1,
      legs: { focus: ['c'] },
      html: `
        ${stat(W.cruise_nights, 'nights on ships')}
        <p class="lede">${W.cruises} ${W.cruises === 1 ? 'cruise' : 'cruises'} and ${W.port_calls} port calls${note('ships') ? `: ${note('ships')}` : '.'}</p>
        <ul class="viz legs ships">${W.ships.slice().sort((a, b) => a.start.localeCompare(b.start)).map(s => `
          <li><span class="code">${esc(s.ship.replace(/^Carnival /, ''))}</span><span>${esc(shortPort(s.frm))} to ${esc(shortPort(s.to))}</span><span class="v">${s.nights} nights</span></li>`).join('')}
        </ul>`,
    },
    bw && bw.n > 3 && {
      id: 'week',
      cam: { ...camFit(week.flatMap(L => [L.a, L.b]), 0.4), p: 15 },
      legs: { ids: week.map(L => L.i) },
      anim: week.length ? { legs: week, loop: Math.max(6, Math.min(12, week.length * 1.2)) } : null,
      html: `
        ${stat(bw.n, 'countries in a week')}
        <p class="lede">${longDate(bw.start)} to ${longDate(bw.end)}${note('week') ? `: ${note('week')}` : '.'}</p>
        <ul class="viz stops">${bw.ccs.map(cc => `<li>${flag(cc)} <b>${esc(A.names[cc] || cc)}</b></li>`).join('')}</ul>`,
    },
    ...(S.extras || []).map(x => ({
      id: x.id,
      cam: x.cam || camFit(x.pins.map(p => p.p)),
      legs: { all: 0.2 },
      pins: x.pins,
      html: `${stat(esc(x.stat), esc(x.unit))}<p class="lede">${x.lede}</p>`,
    })),
    {
      id: 'hotels',
      cam: hotelPin ? { c: hotelPin.p, z: hotelPin.z || 15.2, p: hotelPin.p0 ?? 58, b: hotelPin.b ?? -24 } : { c: [30, 0], z: 1.2 },
      legs: { all: 0 },
      pins: hotelPin ? [{ p: hotelPin.p, label: hotelPin.label }] : [],
      html: `
        ${stat(W.hotels, 'hotels')}
        <p class="lede">${W.hotel_nights} hotel nights. The longest stay was ${note('hotels') || `<strong>${stay.nights} nights at ${esc(stay.name.replace(/ \(Extended\)$/, ''))}</strong> in ${esc(stay.city)}`}.</p>
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
        <p class="lede">Home is Myrtle Beach. Of the ${W.day_of_year} days${A.complete ? ' of the year' : ' so far'}, he spent ${W.days_us} in the US, ${W.days_abroad} abroad and ${W.days_sea} at sea.</p>
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
      cam: { c: north && south ? slerp(north.p, south.p, 0.5) : [20, 0], z: 1.05 },
      legs: { all: 0.25 },
      guides: [
        { pts: parallel(W.north.lat), color: '#ffb547', label: latLabel(W.north.lat), labelAt: 0.6 },
        { pts: parallel(W.south.lat), color: '#55d6c2', label: latLabel(W.south.lat), labelAt: 0.6 },
      ],
      pins: [north && { p: north.p, label: north.name }, south && { p: south.p, label: south.name }].filter(Boolean),
      html: `
        ${stat(`${Math.round(W.span_lat)}°`, 'of latitude')}
        <p class="lede">${note('extremes') || `From ${esc(W.north.label)} down to ${esc(W.south.label)}.`}</p>
        <ul class="viz compass">
          <li><span class="k">Farthest north</span><span class="p">${esc(W.north.label)}</span><span class="d">${latLabel(W.north.lat, 2)}</span></li>
          <li><span class="k">Farthest south</span><span class="p">${esc(W.south.label)}</span><span class="d">${latLabel(W.south.lat, 2)}</span></li>
          <li><span class="k">Farthest east</span><span class="p">${esc(W.east.label)}</span><span class="d">${lonLabel(W.east.lon)}</span></li>
          <li><span class="k">Farthest west</span><span class="p">${esc(W.west.label)}</span><span class="d">${lonLabel(W.west.lon)}</span></li>
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
          ${tail.length ? `<li><span class="nm">${tail.length} more</span><span class="bar" style="width:${(tail.reduce((s, c) => s + c.days, 0) / ranked[0].days) * 100}%;--c:${TAIL}"></span><span class="v">${tail.reduce((s, c) => s + c.days, 0)}</span></li>` : ''}
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
    !A.complete && N && {
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
    A.complete && {
      id: 'next',
      cam: { c: lastPos, z: 4.5, p: 20 },
      legs: { all: 0.35 },
      pins: [{ p: lastPos, label: A.days[A.todayIdx].city }],
      html: `
        <h2 class="stat"><span class="u" style="margin:0">And then came ${Y + 1}</span></h2>
        <p class="lede">${Y} ended in ${esc(A.days[A.todayIdx].city)}. The next year picks up from there.</p>
        ${(S.siblings || []).filter(s => s.year === Y + 1).map(s => `<div class="hero-acts"><a class="btn btn-solid" href="${s.url}">See ${s.year}</a></div>`).join('')}`,
    },
    {
      id: 'finale',
      cam: { c: [24, -42], z: 1.2 },
      spin: 1,
      legs: { all: 0.7 },
      html: `
        <h2 class="hero-title">Watch it happen</h2>
        <p class="lede">All ${legs.length} legs in order, with the camera riding along. About ${minutes} minutes at normal speed, and you can scrub to any day.</p>
        <div class="hero-acts"><button class="btn btn-solid" type="button" data-act="play">Play the year</button></div>
        <p class="method">Built from his booking confirmations: every flight, train, bus, cruise and hotel. A day counts for each country he set foot in. Dotted lines are hops with no ticket on file, like a drive or a local train. Distances are great circles. ${A.complete ? `Covers all of ${Y}.` : `Updated ${longDate(A.today)}, ${Y}.`}${(S.siblings || []).length ? ` Other years: ${S.siblings.map(s => `<a href="${s.url}">${s.year}</a>`).join(', ')}.` : ''}<br><br>Map © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="https://openmaptiles.org">OpenMapTiles</a>, served by <a href="https://openfreemap.org">OpenFreeMap</a>. Terrain from Mapzen on AWS Open Data. Borders from Natural Earth.</p>`,
    },
  ].filter(Boolean);

  // optional chapters go where the year's config says (after a named chapter)
  for (const x of S.extras || []) {
    if (!x.after) continue;
    const i = list.findIndex(c => c.id === x.id), j = list.findIndex(c => c.id === x.after);
    if (i >= 0 && j >= 0) list.splice(j + 1, 0, ...list.splice(i, 1));
  }
  return list;
}

const latLabel = (lat, d = 1) => `${Math.abs(lat).toFixed(d)}° ${lat >= 0 ? 'N' : 'S'}`;
const lonLabel = lon => `${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? 'E' : 'W'}`;

/** A camera that frames a set of points: their spherical middle, zoomed to their spread (700px view basis). */
function camFit(points, pad = 0.5) {
  const pts = points.filter(Boolean);
  if (!pts.length) return { c: [20, 0], z: 1.2 };
  const R = Math.PI / 180;
  let x = 0, y = 0, z = 0;
  for (const [la, lo] of pts) { x += Math.cos(la * R) * Math.cos(lo * R); y += Math.cos(la * R) * Math.sin(lo * R); z += Math.sin(la * R); }
  const c = [Math.atan2(z, Math.hypot(x, y)) / R, Math.atan2(y, x) / R];
  let span = 0;
  for (const p of pts) span = Math.max(span, arcDeg(c, p));
  const zoom = Math.log2(180 / Math.max(1.5, span * 2 * (1 + pad))) + 1.3;
  return { c, z: clamp(zoom, 1.05, 7) };
}
function arcDeg(a, b) {
  const R = Math.PI / 180, p1 = a[0] * R, p2 = b[0] * R, dl = (b[1] - a[1]) * R;
  return Math.acos(clamp(Math.sin(p1) * Math.sin(p2) + Math.cos(p1) * Math.cos(p2) * Math.cos(dl), -1, 1)) / R;
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
  const keys = A.countriesAll.slice().sort((a, b) => b.days - a.days).slice(0, 7).map(c => c.cc);
  return `<div class="viz cal">${rows.join('')}</div>
    <ul class="cal-key">${keys.map(c => `<li><i style="background:${countryColor(c)}"></i>${c === 'SEA' ? 'At sea' : esc(A.names[c])}</li>`).join('')}<li><i style="background:${TAIL}"></i>Everywhere else</li></ul>`;
}

// ---------------------------------------------------------------- controller
export class Story {
  constructor(map, overlay, A, onPlay, sound) {
    this.map = map; this.ov = overlay; this.A = A; this.onPlay = onPlay; this.sound = sound;
    this.list = chapters(A);
    this.root = document.getElementById('story');
    this.root.innerHTML = `<div class="pages">${this.list.map(ch => `<section class="ch ${ch.id === 'hero' ? 'hero' : ch.id === 'finale' ? 'finale' : ''}" id="${ch.id}" data-ch="${ch.id}"><div class="ch-body">${ch.html}</div></section>`).join('')}</div>`;
    this.pages = this.root.firstElementChild;
    this.cur = null;
    this.visitedAll = new Set(A.countries.map(c => c.cc));
    this.auto = false;
    this.lock = 0;
    this.buildProgress();
    this.bindCalendar();
    this.bindPaging();
  }

  // ---------------------------------------------------------------- slides: keys, autoplay, progress
  get index() { return Math.max(0, this.list.indexOf(this.cur)); }

  /** Seconds a chapter stays up in autoplay: long enough to read it and to see its camera move land. */
  dwell(ch) {
    if (ch.id === 'hero') return 5.5;
    if (ch.id === 'finale') return 4.5;
    const words = ch.html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
    return Math.max(ch.anim ? ch.anim.loop + 1 : 0, clamp(4.5 + words * 0.11, 6.5, 11));
  }

  /** Turn to chapter i. The whole page slides in one eased move; there is no position in between. */
  go(i, animate = true) {
    i = clamp(i, 0, this.list.length - 1);
    const from = this.cur ? this.index : -1;
    if (i === from && this.cur) return;
    const ms = !animate || from < 0 ? 0 : reduced() ? 250 : 950;
    this.pages.style.transition = ms ? `transform ${ms}ms cubic-bezier(0.65, 0, 0.35, 1)` : 'none';
    this.pages.style.transform = `translate3d(0, ${-i * 100}%, 0)`;
    this.lock = performance.now() + ms + 120;
    const body = this.bodyOf(i);
    if (body) body.scrollTop = 0;
    this.root.scrollTop = 0;
    document.body.classList.toggle('is-scrolled', i > 0);
    this.fit(i);
    this.activate(this.list[i].id);
    document.querySelectorAll('.ch').forEach((s, k) => { s.inert = k !== i; s.setAttribute('aria-hidden', String(k !== i)); });
  }

  goId(id, animate = true) {
    const i = this.list.findIndex(c => c.id === id);
    if (i >= 0) this.go(i, animate);
  }

  /**
   * Phones: a chapter must fit one screen (one swipe = one slide), so text that would still overflow is
   * scaled down a little, never below 80%.
   */
  fit(i) {
    const b = this.bodyOf(i);
    if (!b) return;
    b.style.zoom = '';
    if (!phone()) return;
    const sec = b.parentElement, cs = getComputedStyle(sec);
    const room = sec.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    if (b.scrollHeight > room + 1) b.style.zoom = String(Math.max(0.8, room / b.scrollHeight));
  }

  bodyOf(i = this.index) { return this.pages.children[i]?.querySelector('.ch-body'); }

  /** Can the current chapter's own text still scroll that way? (tall chapters on short screens) */
  canScroll(dir) {
    const b = this.bodyOf();
    if (!b || b.scrollHeight <= b.clientHeight + 2) return false;
    return dir > 0 ? b.scrollTop + b.clientHeight < b.scrollHeight - 2 : b.scrollTop > 2;
  }

  next() {
    if (this.canScroll(1)) { this.bodyOf().scrollBy({ top: this.bodyOf().clientHeight * 0.8, behavior: reduced() ? 'auto' : 'smooth' }); return; }
    if (this.index >= this.list.length - 1) { if (this.auto) { this.stopAuto(); this.onPlay(0); } return; }
    this.go(this.index + 1);
  }
  prev() {
    if (this.canScroll(-1)) { this.bodyOf().scrollBy({ top: -this.bodyOf().clientHeight * 0.8, behavior: reduced() ? 'auto' : 'smooth' }); return; }
    this.go(this.index - 1);
  }

  /**
   * Wheel and swipe turn whole pages. A gesture that the chapter's own text can absorb scrolls the text
   * first; a trackpad's inertia tail after a turn is ignored, so one flick is one page.
   */
  bindPaging() {
    const now = () => performance.now();
    // One gesture turns one page. A gesture ends when the wheel goes quiet for a moment; until then
    // everything (a trackpad's long inertia tail included) is ignored, unless the reader clearly pushes
    // again (a sharp rise in speed).
    let acc = 0, lastT = 0, lastMag = 0, lastDir = 0, innerT = 0, spent = false;
    window.addEventListener('wheel', e => {
      if (this.suspended || e.ctrlKey) return;
      const dy = e.deltaMode === 1 ? e.deltaY * 32 : e.deltaY;
      // gaps between events are measured on the input's own clock (a busy main thread can't fake a pause);
      // the page lock is on the page's clock
      const t = e.timeStamp || now(), clock = now(), mag = Math.abs(dy), dir = Math.sign(dy);
      const fresh = t - lastT > 240 || (dir && dir !== lastDir);
      // a mouse-wheel notch (big, separate steps) is a new request every time; a trackpad's momentum tail
      // fades smoothly and is not
      const notch = mag >= 50 && mag >= lastMag * 0.9 && t - lastT > 60;
      const push = mag > 28 && mag > lastMag * 1.8;
      if (fresh) { acc = 0; spent = false; if (mag > 4) this.userMoved(); }
      lastT = t; lastMag = mag; if (dir) lastDir = dir;
      if (this.canScroll(dir) && clock >= this.lock && !spent) {
        // The chapter's text is taller than the screen. Over the text the browser scrolls it; anywhere
        // else (the globe) nothing would move, so scroll it from here.
        innerT = clock;
        const b = this.bodyOf();
        if (b.contains(e.target)) return;
        e.preventDefault();
        b.scrollBy({ top: dy, behavior: mag >= 50 ? 'smooth' : 'auto' });
        return;
      }
      e.preventDefault();
      if (clock < this.lock || clock - innerT < 350) return;
      if (spent && !notch && !push) return;
      acc += dy;
      if (Math.abs(acc) < 24) return;
      acc > 0 ? this.next() : this.prev();
      acc = 0;
      spent = true;
    }, { passive: false });

    let y0 = null, t0 = 0, inner = false;
    window.addEventListener('touchstart', e => {
      if (this.suspended || e.touches.length !== 1) { y0 = null; return; }
      y0 = e.touches[0].clientY; t0 = now(); inner = false;
    }, { passive: true });
    window.addEventListener('touchmove', e => {
      if (y0 == null || this.suspended) return;
      const dy = y0 - e.touches[0].clientY;
      if (this.canScroll(Math.sign(dy)) && e.target.closest('.ch-body')) { inner = true; return; }
      if (e.cancelable) e.preventDefault();
    }, { passive: false });
    window.addEventListener('touchend', e => {
      if (y0 == null || this.suspended) return;
      const dy = y0 - e.changedTouches[0].clientY, dt = now() - t0;
      y0 = null;
      const swiped = Math.abs(dy) > 48 || (Math.abs(dy) > 22 && dt < 250);
      if (swiped || inner) this.userMoved();
      if (inner) return;
      // every swipe counts, even one made while the last page is still sliding in: two quick swipes are
      // two pages (the slide simply retargets from wherever it is)
      if (swiped) dy > 0 ? this.next() : this.prev();
    }, { passive: true });

    // focus (Tab) or a #chapter link lands on the right page, never on a half-way scroll offset
    this.root.addEventListener('scroll', () => { this.root.scrollTop = 0; });
    window.addEventListener('resize', () => this.fit(this.index));
    window.addEventListener('scroll', () => { if (window.scrollY) window.scrollTo(0, 0); });
    this.root.addEventListener('focusin', e => {
      const sec = e.target.closest('.ch');
      const i = sec ? [...this.pages.children].indexOf(sec) : -1;
      if (i >= 0 && i !== this.index) this.go(i);
    });
    window.addEventListener('hashchange', () => {
      const id = location.hash.slice(1);
      if (id && this.list.some(c => c.id === id)) this.goId(id);
    });
    document.addEventListener('click', e => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute('href').slice(1);
      if (this.list.some(c => c.id === id)) { e.preventDefault(); this.goId(id); }
    });
  }

  /** A swipe or a flick from the reader takes over from autoplay (except when recording a film). */
  userMoved() {
    if (this.auto && !document.body.classList.contains('is-film')) this.stopAuto();
  }

  startAuto() {
    this.auto = true;
    this.autoT0 = performance.now();
    document.body.classList.add('is-auto');
    this.syncAutoButtons();
  }
  stopAuto() {
    if (!this.auto) return;
    this.auto = false;
    document.body.classList.remove('is-auto');
    this.syncAutoButtons();
    this.paintProgress();
  }
  toggleAuto() { this.auto ? this.stopAuto() : this.startAuto(); }
  syncAutoButtons() {
    document.querySelectorAll('[data-act="auto"]').forEach(b => b.setAttribute('aria-pressed', String(this.auto)));
    const m = document.querySelector('.auto-btn span');
    if (m) m.textContent = this.auto ? 'Pause' : 'Autoplay';
  }

  buildProgress() {
    const nav = document.getElementById('progress');
    nav.innerHTML = this.list.map((ch, i) => `<button type="button" data-go="${i}" aria-label="Chapter ${i + 1} of ${this.list.length}"><i></i></button>`).join('');
    this.bars = [...nav.querySelectorAll('i')];
    nav.addEventListener('click', e => {
      const b = e.target.closest('[data-go]');
      if (b) { this.go(Number(b.dataset.go)); if (this.auto) this.autoT0 = performance.now(); }
    });
  }

  paintProgress(frac = 1) {
    const k = this.index;
    this.bars.forEach((b, i) => { b.style.transform = `scaleX(${i < k ? 1 : i > k ? 0 : (this.auto ? frac : 1)})`; });
  }

  padding(ch) {
    const W = window.innerWidth, H = window.innerHeight;
    if (phone()) {
      // the globe sits in whatever height the chapter's text leaves free (at least a third of the screen)
      const textH = this.textHeight(ch);
      return { top: 64, bottom: Math.round(Math.min(H * 0.66, Math.max(H * 0.4, textH + 24))), left: 0, right: 0 };
    }
    if (ch.pad === 'hero') return { top: 40, bottom: Math.round(H * 0.12), left: Math.round(W * 0.42), right: 0 };
    const col = Math.min(560, W * 0.44) + Math.min(56, W * 0.04);
    return { top: 70, bottom: 40, left: Math.round(col + 24), right: 24 };
  }

  textHeight(ch) {
    const sec = document.getElementById(ch.id);
    const b = sec && sec.querySelector('.ch-body');
    return b ? b.scrollHeight + 24 : window.innerHeight * 0.5;
  }

  /** Chapter zooms are written for a 700px view; scale to the room actually left beside the text. */
  zoomFor(ch, pad) {
    const W = window.innerWidth, H = window.innerHeight;
    const v = Math.max(240, Math.min(W - pad.left - pad.right, H - pad.top - pad.bottom));
    return ch.cam.z + Math.log2(v / 700);
  }

  activate(id, instant = false) {
    if (this.cur && this.cur.id === id && !instant) return;
    const ch = this.list.find(c => c.id === id);
    if (!ch) return;
    const changed = this.cur && this.cur !== ch;
    this.cur = ch;
    this.chStart = performance.now();
    this.autoT0 = this.chStart;
    if (this.suspended) return;
    if (changed && this.sound) this.sound.turn();
    this.apply(ch, instant);
    this.paintProgress(0);
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
    document.documentElement.style.setProperty('--text-h', `${Math.round(this.textHeight(ch))}px`);
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
    if (this.auto) {
      const frac = (performance.now() - this.autoT0) / 1000 / this.dwell(ch);
      this.paintProgress(Math.min(1, frac));
      // a chapter taller than the screen rolls its own text up while it is on, like credits
      const b = this.bodyOf(), over = b ? b.scrollHeight - b.clientHeight : 0;
      if (over > 2) b.scrollTop = over * smoothstep(clamp((frac - 0.2) / 0.65, 0, 1));
      if (frac >= 1) {
        if (this.index < this.list.length - 1) this.go(this.index + 1);
        else { this.stopAuto(); this.onPlay(0); }
      }
    }
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
