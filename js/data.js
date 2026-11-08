import { makeArc, sampleArc, km } from './geo.js?v=19';
import { setPalette } from './palette.js?v=19';

const V = '19';
const get = p => fetch(`${p}?v=${V}`).then(r => {
  if (!r.ok) throw new Error(`${p}: HTTP ${r.status}`);
  return r.json();
});

export const MODE = { f: 'flight', c: 'ship', r: 'train', b: 'bus', g: 'unrecorded' };
export const flag = cc => (!cc || cc === 'SEA' ? '' : String.fromCodePoint(...[...cc].map(c => 0x1f1a5 + c.charCodeAt(0))));

const EXTRA_NAMES = { ZA: 'South Africa', ZW: 'Zimbabwe', BW: 'Botswana', SEA: 'At sea' };

export async function loadAll() {
  // data/site.json says which year this copy of the site is (2025.aeroverra.com, 2026.aeroverra.com, ...)
  const S = await get('data/site.json');
  const [J, W, N, shapes] = await Promise.all([
    get('data/journey.json'), get(`data/wrapped${S.year}.json`),
    S.complete ? Promise.resolve(null) : get('data/next.json').catch(() => null),
    get('data/visited.geojson'),
  ]);
  const A = prepare(J, W, N, shapes);
  A.site = S; A.year = S.year; A.complete = !!S.complete;
  setPalette(A.countriesAll);
  return A;
}

function prepare(J, W, N, shapes) {
  const names = { ...EXTRA_NAMES };
  for (const c of J.countries) names[c.cc] = c.name;

  const days = J.days.map((d, i) => ({ ...d, i, cc: d.ccs ? (d.ccs.find(c => c !== 'SEA') || d.ccs[0] || null) : null }));
  const dayIdx = Object.fromEntries(days.map(d => [d.d, d.i]));
  const todayIdx = dayIdx[J.today];
  // the player runs on through booked trips (legs flagged booked), the story stays on today
  const playIdx = Math.max(todayIdx, ...J.legs.filter(L => L.booked).map(L => dayIdx[L.d1] ?? 0));

  // Fill the date-line hole (Jan 15) and any blank day with the day before, so the camera never loses him.
  for (let i = 1; i <= playIdx; i++) if (!days[i].p) days[i].p = days[i - 1].p;

  const perDir = {};
  const legs = J.legs.map(L => {
    const dirKey = `${L.t === 'f' ? 'air' : 'ground'}:${L.a.map(x => Math.round(x * 2)).join(',')}>${L.b.map(x => Math.round(x * 2)).join(',')}`;
    const k = (perDir[dirKey] = (perDir[dirKey] ?? -1) + 1);
    const rad0 = makeArc(L.a, L.b).rad;
    let bulge = 0;
    if (L.t === 'f') bulge = Math.max(rad0 * 0.075, 0.0035) * (1 + 0.7 * k);
    else if (L.t === 'c') bulge = rad0 * (0.03 + 0.05 * k);
    else if (L.t !== 'g') bulge = rad0 * (0.05 + 0.08 * k);
    const arc = makeArc(L.a, L.b, bulge);
    const deg = arc.rad * 57.2958;
    const ns = Math.round(Math.max(16, Math.min(200, deg * 2.2)));
    // where the route crosses the date line, so the calendar can flip there and not before
    let dl = null;
    for (let k = 1, prev = arc.at(0)[1]; k <= 64 && dl == null; k++) {
      const lon = arc.at(k / 64)[1];
      if (Math.abs(lon - prev) > 180) dl = (k - 0.5) / 64;
      prev = lon;
    }
    return {
      ...L, arc, deg, ns, dl,
      coords: sampleArc(arc, ns),
      mi: Math.round(L.km * 0.621371),
      i0: dayIdx[L.d0] ?? 0,
      i1: dayIdx[L.d1] ?? dayIdx[L.d0] ?? 0,
    };
  });

  // First time in each country, in order.
  const first = {};
  for (const d of days) {
    if (d.i > todayIdx || !d.ccs) continue;
    for (const c of d.ccs) if (c !== 'SEA' && !(c in first)) first[c] = d.i;
  }

  // Cities he slept in, weighted by days.
  const placeMap = new Map();
  for (const d of days) {
    if (d.i > todayIdx || !d.p || d.city === 'At sea' || !d.city) continue;
    const key = d.city;
    const e = placeMap.get(key) || { name: d.city, p: d.p, days: 0, cc: d.cc };
    e.days++;
    placeMap.set(key, e);
  }
  // merge spellings that sit on top of each other (Zurich / Zürich, Rümlang)
  const places = [];
  for (const e of [...placeMap.values()].sort((a, b) => b.days - a.days)) {
    const near = places.find(p => km(p.p, e.p) < 12);
    if (near) near.days += e.days; else places.push({ ...e });
  }

  const byId = {};
  shapes.features.forEach(f => { byId[f.properties.cc] = f.id; });
  // a city belongs to the country whose outline it sits in (a travel day can credit the wrong one)
  for (const pl of places) {
    const hit = shapes.features.find(f => inShape(f.geometry, pl.p));
    if (hit) pl.cc = hit.properties.cc;
  }

  return {
    today: J.today, todayIdx, playIdx, days, dayIdx, legs, names, first, places,
    wrapped: W, next: N, shapes, shapeId: byId,
    countries: J.countries.filter(c => c.cc !== 'SEA'),
    countriesAll: J.countries,
  };
}

function inRing(ring, x, y) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function inShape(g, [lat, lon]) {
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  return polys.some(p => inRing(p[0], lon, lat));
}

export const fmt = n => Math.round(n).toLocaleString('en-US');
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const dateParts = iso => {
  const [y, m, d] = iso.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return { y, m, d, mon: MON[m - 1], wd: WD[wd] };
};
export const longDate = iso => { const p = dateParts(iso); return `${p.mon} ${p.d}`; };
