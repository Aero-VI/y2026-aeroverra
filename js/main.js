import { loadAll } from './data.js?v=9';
import { createMap, addLayers } from './map.js?v=9';
import { Overlay } from './overlay.js?v=9';
import { Story } from './story.js?v=9';
import { Player } from './player.js?v=9';
import { PlayerUI } from './ui.js?v=9';

const body = document.body;
const fail = msg => {
  const el = document.getElementById('bootError');
  el.textContent = msg;
  el.hidden = false;
};

async function boot() {
  if (!window.maplibregl) return fail('The map library did not load. Check your connection and reload the page.');
  let map;
  try {
    map = createMap('map');
  } catch (e) {
    return fail('This browser cannot draw the globe (WebGL is off or unsupported).');
  }
  const [A] = await Promise.all([loadAll(), new Promise(r => map.once('load', r))]);
  addLayers(map, A);
  const ov = new Overlay(map);
  const ui = new PlayerUI(A);
  const player = new Player(map, ov, A, ui);
  const story = new Story(map, ov, A, day => openPlayer(day));
  body.classList.remove('is-loading');
  map.getContainer().classList.add('is-ready');

  function openPlayer(day = 0) {
    story.suspended = true;
    player.start(day);
    history.replaceState(null, '', `#play${day ? `-${A.days[day].d}` : ''}`);
  }
  function closePlayer(to) {
    player.close();
    story.suspended = false;
    map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
    map.scrollZoom.disable(); map.dragPan.disable(); map.touchZoomRotate.disable();
    history.replaceState(null, '', to ? `#${to}` : location.pathname);
    if (to) document.getElementById(to).scrollIntoView({ behavior: 'instant', block: 'start' });
    story.activate(story.cur ? story.cur.id : 'hero', true);
  }
  ui.on('close', () => closePlayer());
  ui.on('next', () => closePlayer('next'));

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act="play"]');
    if (b) openPlayer(0);
  });
  document.addEventListener('keydown', e => {
    if (!player.open) return;
    if (e.target.closest('input, textarea')) return;
    if (e.key === ' ' || e.key === 'k') { e.preventDefault(); player.toggle(); }
    else if (e.key === 'Escape') closePlayer();
    else if (e.key === 'ArrowRight' && e.target.id !== 'track') player.stepLeg(1);
    else if (e.key === 'ArrowLeft' && e.target.id !== 'track') player.stepLeg(-1);
  });

  // story mode: the map is a backdrop, the page scrolls over it
  map.scrollZoom.disable(); map.dragPan.disable(); map.touchZoomRotate.disable(); map.doubleClickZoom.disable();
  const onScroll = () => body.classList.toggle('is-scrolled', window.scrollY > window.innerHeight * 0.6);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  let last = performance.now();
  const frame = now => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!player.open) story.tick(dt);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  // deep links: #play, #play-2026-06-14, ?play=1 (and the old /explore.html sends people to #play)
  const playHash = () => location.hash.match(/^#play(?:-(\d{4}-\d{2}-\d{2}))?$/);
  const dayOf = d => (d && A.dayIdx[d] != null ? A.dayIdx[d] : 0);
  window.addEventListener('hashchange', () => {
    const m = playHash();
    if (m && !player.open) openPlayer(dayOf(m[1]));
    else if (m && player.open) player.seek(dayOf(m[1]), true);
  });
  const h = playHash();
  const q = new URLSearchParams(location.search);
  // ?film: the player with no controls, for screen-recording the year as a video
  if (q.has('film')) body.classList.add('is-film');
  if (h || q.has('play') || q.has('film')) {
    openPlayer(dayOf((h && h[1]) || q.get('day')));
  } else {
    const id = location.hash.slice(1);
    story.activate(id && document.getElementById(id) ? id : 'hero', true);
  }
  if (q.has('speed')) player.setSpeed(Number(q.get('speed')) || 1);
  window.__y2026 = { map, player, story, A };
}

boot().catch(e => {
  console.error(e);
  fail(`The year's data did not load (${e.message}). Reload to try again.`);
});
