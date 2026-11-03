import { loadAll } from './data.js?v=13';
import { createMap, addLayers } from './map.js?v=13';
import { Overlay } from './overlay.js?v=13';
import { Story } from './story.js?v=13';
import { Player } from './player.js?v=13';
import { PlayerUI } from './ui.js?v=13';
import { Sound } from './audio.js?v=13';

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
  const sound = new Sound();
  const ui = new PlayerUI(A);
  ui.onFlip = () => sound.flap();
  ui.onMonth = () => sound.month();
  const player = new Player(map, ov, A, ui, sound);
  const story = new Story(map, ov, A, day => openPlayer(day), sound);
  body.classList.remove('is-loading');
  map.getContainer().classList.add('is-ready');

  // Play and Watch the story always bring the music in, even after an earlier mute
  const soundOn = () => { if (!sound.on) sound.toggle(); else sound.unlock(); paintSound(); };

  function openPlayer(day = 0) {
    story.stopAuto();
    soundOn();
    story.suspended = true;
    player.start(day);
    history.replaceState(null, '', `#play${day ? `-${A.days[day].d}` : ''}`);
  }
  function closePlayer(to) {
    player.close();
    sound.intensity(0.3);
    story.suspended = false;
    map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
    map.scrollZoom.disable(); map.dragPan.disable(); map.touchZoomRotate.disable();
    history.replaceState(null, '', to ? `#${to}` : location.pathname);
    const id = to || (story.cur ? story.cur.id : 'hero');
    story.cur = null;
    story.goId(id, false);
  }
  ui.on('close', () => closePlayer());
  ui.on('next', () => closePlayer('next'));

  // Sound is on by default (unless muted before). Browsers allow no audio until the first tap, click or key,
  // so it starts on that; until then the speaker pulses.
  const live = () => !!sound.ctx && sound.ctx.state === 'running';
  const paintSound = () => document.querySelectorAll('[data-act="sound"]').forEach(b => {
    b.setAttribute('aria-pressed', String(sound.on));
    b.classList.toggle('is-waiting', sound.on && !live());
    b.setAttribute('aria-label', sound.on ? 'Mute' : 'Turn sound on');
  });
  sound.onChange(paintSound);
  paintSound();
  const wake = e => {
    if (!sound.on || live()) return;
    if (e.target.closest && e.target.closest('[data-act="sound"]')) return;
    sound.unlock();
    setTimeout(paintSound, 60);
  };
  ['pointerup', 'keydown', 'touchend'].forEach(t => window.addEventListener(t, wake, true));

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'play') openPlayer(0);
    else if (act === 'auto') { if (!story.auto) soundOn(); story.toggleAuto(); sound.intensity(story.auto ? 0.4 : 0.3); paintSound(); }
    else if (act === 'sound') {
      if (sound.on && !live()) sound.unlock();
      else sound.toggle();
      setTimeout(paintSound, 60);
    }
  });
  const NEXT = ['ArrowDown', 'ArrowRight', 'PageDown'], PREV = ['ArrowUp', 'ArrowLeft', 'PageUp'];
  document.addEventListener('keydown', e => {
    if (e.target.closest('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (!player.open) {
      // the story behaves like slides: arrows step a chapter, space starts or pauses autoplay
      if (NEXT.includes(e.key)) { e.preventDefault(); story.next(); }
      else if (PREV.includes(e.key)) { e.preventDefault(); story.prev(); }
      else if (e.key === 'Home') { e.preventDefault(); story.go(0, false); }
      else if (e.key === 'End') { e.preventDefault(); story.go(story.list.length - 1, false); }
      else if (e.key === ' ' && !e.target.closest('button, a')) { e.preventDefault(); sound.unlock(); story.toggleAuto(); paintSound(); }
      else if (e.key === 'm') { sound.toggle(); paintSound(); }
      return;
    }
    if (e.key === ' ' || e.key === 'k') { e.preventDefault(); player.toggle(); }
    else if (e.key === 'Escape') closePlayer();
    else if (e.key === 'm') { sound.toggle(); paintSound(); }
    else if (e.key === 'ArrowRight' && e.target.id !== 'track') player.stepLeg(1);
    else if (e.key === 'ArrowLeft' && e.target.id !== 'track') player.stepLeg(-1);
  });


  // story mode: the map is a backdrop, the page scrolls over it
  map.scrollZoom.disable(); map.dragPan.disable(); map.touchZoomRotate.disable(); map.doubleClickZoom.disable();

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
  // ?film: the whole thing as a video (story on autoplay, then the year), no controls. One click starts
  // it so the browser lets the sound play.
  if (q.has('film')) {
    body.classList.add('is-film');
    const go = document.getElementById('filmStart');
    go.hidden = false;
    go.addEventListener('click', () => { go.hidden = true; sound.unlock(); paintSound(); story.go(0, false); story.startAuto(); }, { once: true });
  }
  if (h || q.has('play')) {
    openPlayer(dayOf((h && h[1]) || q.get('day')));
  } else {
    const id = location.hash.slice(1);
    story.goId(id && document.getElementById(id) ? id : 'hero', false);
  }
  if (q.has('speed')) player.setSpeed(Number(q.get('speed')) || 1);
  window.__y2026 = { map, player, story, A, sound };
}

boot().catch(e => {
  console.error(e);
  fail(`The year's data did not load (${e.message}). Reload to try again.`);
});
