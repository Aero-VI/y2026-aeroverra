// One colour per country wherever days are shown (ribbon, calendar, leaderboard). Home and the sea keep
// fixed colours; the year's other countries with five or more days get hues in order of time spent; the
// one- and two-day tail shares one quiet tone so it never competes.
const FIXED = { US: '#7f97e0', SEA: '#55d6c2' };
const HUES = ['#ff7f90', '#ffb547', '#cf8cff', '#ffd76e', '#8fd4ff', '#9be08f', '#ff9e6b', '#f2f2f2', '#ff6f6f', '#e6a3b8', '#7fe0d0', '#c9b6ff'];
export const TAIL = '#7d86a8';
let own = { ...FIXED };
export function setPalette(countries) {
  own = { ...FIXED };
  let k = 0;
  for (const c of countries.slice().sort((a, b) => b.days - a.days)) {
    if (own[c.cc] || c.days < 5 || k >= HUES.length) continue;
    own[c.cc] = HUES[k++];
  }
}
export const countryColor = cc => own[cc] || TAIL;
