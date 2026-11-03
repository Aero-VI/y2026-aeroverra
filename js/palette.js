// One colour per country wherever days are shown (ribbon, calendar, leaderboard). The places with five
// or more days get their own hue; the one- and two-day tail shares one quiet tone so it never competes.
const OWN = {
  US: '#7f97e0', JP: '#ff7f90', SEA: '#55d6c2', AU: '#ffb547', MT: '#cf8cff', ES: '#ffd76e',
  GB: '#8fd4ff', HU: '#9be08f', SG: '#ff9e6b', CH: '#f2f2f2', DK: '#ff6f6f', AT: '#e6a3b8',
};
export const TAIL = '#7d86a8';
export const countryColor = cc => OWN[cc] || TAIL;
