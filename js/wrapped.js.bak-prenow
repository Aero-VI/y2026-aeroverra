/* 2026 Wrapped — scroll story (v3) */
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const el = (t,c,h) => { const e=document.createElement(t); if(c)e.className=c; if(h!==undefined)e.innerHTML=h; return e; };
const HUE = { open:['#3b6dff','#ff3864','#14cfe0'], split:['#ff3864','#3b6dff','#14cfe0'],
  flags:['#ffc234','#a855f7','#3b6dff'], podium:['#ff3864','#ffc234','#3b6dff'],
  miles:['#14cfe0','#a855f7','#3b6dff'], air:['#a855f7','#3b6dff','#14cfe0'],
  bigday:['#ff3864','#ffc234','#a855f7'], sea:['#14cfe0','#3b6dff','#22c55e'],
  beds:['#22c55e','#14cfe0','#3b6dff'], whip:['#ff3864','#a855f7','#ffc234'],
  corners:['#3b6dff','#14cfe0','#ffc234'], week:['#a855f7','#ff3864','#14cfe0'],
  end:['#3b6dff','#a855f7','#ff3864'] };

fetch('data/wrapped2026.json?v=3').then(r=>r.json()).then(W=>{
  buildFlags(W); buildPodium(W); buildAir(W); buildLegs(W); buildShips(W); buildChain(W); buildWeek(W);
  buildDots(); observe(); progress();
});

/* ---------- builders ---------- */
function buildFlags(W){
  const wall = $('#flagwall');
  const isNew = new Set(W.new_countries.map(c=>c.cc));
  W.all_flags.slice().sort((a,b)=>b.days-a.days).forEach((c,i)=>{
    const f = el('div','fw'+(isNew.has(c.cc)?' new':''),
      `<div class="e">${c.flag}</div><div class="c">${isNew.has(c.cc)?'NEW':c.cc}</div><div class="d">${c.days}d</div>`);
    f.style.animationDelay = (i*34)+'ms';
    f.title = `${c.name} · ${c.days} day${c.days>1?'s':''} · first on ${c.first}`;
    wall.appendChild(f);
  });
}
function buildPodium(W){
  const box = $('#podium');
  const list = W.top_nonus.slice(0,6);
  const max = list[0].days;
  const tones = ['#ff3864','#ff9f1c','#a855f7','#22c55e','#e879f9','#38bdf8'];
  list.forEach((c,i)=>{
    const r = el('div','pr',
      `<div class="fl">${c.flag}</div>
       <div class="track"><div class="fill" style="background:linear-gradient(90deg,${tones[i]},${tones[i]}88)"></div>
       <div class="nm">${c.name}</div></div>
       <div class="v">${c.days}</div>`);
    r.querySelector('.fill').dataset.w = Math.max(5, c.days/max*100);
    box.appendChild(r);
  });
}
function buildAir(W){
  const g = $('#airgrid'), L = W.longest_flight, S = W.shortest_flight, E = W.earliest;
  const hm = m => `${Math.floor(m/60)}h ${String(m%60).padStart(2,'0')}m`;
  g.appendChild(el('div','gc',`<h4>Longest flight</h4><div class="r">${L.frm} → ${L.to}</div>
    <div class="s">${L.frm_city} to ${L.to_city} · ${L.num} · ${L.miles.toLocaleString()} miles · ${hm(L.mins)}, overnight.</div>`));
  g.appendChild(el('div','gc',`<h4>Shortest flight</h4><div class="r">${S.frm} → ${S.to}</div>
    <div class="s">${S.frm_city} to ${S.to_city} · ${S.num} · ${S.miles} miles · ${hm(S.mins)}. A 6:15am Ryanair hop.</div>`));
  g.appendChild(el('div','gc',`<h4>Most used airport</h4><div class="r">${W.top_airports[0][0]} · ${W.top_airports[0][1]} times</div>
    <div class="s">Then ${W.top_airports.slice(1,4).map(a=>a[0]+' ('+a[1]+')').join(', ')}. ${W.top_routes[0][0].replace('-',' to ')} alone was flown ${W.top_routes[0][1]} times.</div>`));
  g.appendChild(el('div','gc',`<h4>Favourite airline</h4><div class="r">${W.top_airlines[0][0]}</div>
    <div class="s">${W.top_airlines[0][1]} of 39 flights. ${W.top_airlines[1][0]} took another ${W.top_airlines[1][1]}.</div>`));
  g.appendChild(el('div','gc',`<h4>Earliest departure</h4><div class="r">${E.dep_local} · ${E.frm} → ${E.to}</div>
    <div class="s">${E.airline} out of ${E.frm_city}, ${fmt(E.date)}.</div>`));
  g.appendChild(el('div','gc',`<h4>Time zones crossed</h4><div class="r">${W.tz_hours} hours of clock change</div>
    <div class="s">Net body-clock damage across ${W.flights} flights, ${W.dateline_crossings} of them over the dateline.</div>`));
}
function buildLegs(W){
  const box = $('#legs');
  W.biggest_day.legs.forEach((l,i)=>{
    if(i) { const a = el('div','arrow','→'); a.style.animationDelay=(i*220-60)+'ms'; box.appendChild(a); }
    const d = el('div','leg',`<div class="rt">${l.frm} → ${l.to}</div><div class="nu">${l.num}</div>
      <div class="mi">${l.miles.toLocaleString()} mi</div>`);
    d.style.animationDelay = (i*220)+'ms';
    box.appendChild(d);
  });
}
function buildShips(W){
  const box = $('#shipline');
  W.ships.slice().sort((a,b)=>b.nights-a.nights).forEach((s,i)=>{
    const d = el('div','shp',`<b>${s.ship}</b><span>${s.nights} nights · ${s.frm} → ${s.to}</span>
      <i style="width:${Math.max(18,s.nights/14*100)}%"></i>`);
    d.style.animationDelay = (i*70)+'ms';
    box.appendChild(d);
  });
}
function buildChain(W){
  const box = $('#chain'), t = W.triple_days[0];
  t.flags.forEach((f,i)=>{
    if(i){ const a = el('div','arrow','→'); a.style.animationDelay=(i*260-80)+'ms'; box.appendChild(a); }
    const c = el('div','ch',`<div class="e">${f}</div><div class="n">${t.names[i]}</div>`);
    c.style.animationDelay = (i*260)+'ms';
    box.appendChild(c);
  });
}
function buildWeek(W){
  const box = $('#weekflags');
  W.busiest_week.flags.forEach((f,i)=>{
    const d = el('div','wf',f); d.style.animationDelay=(i*110)+'ms'; box.appendChild(d);
  });
}
function fmt(s){
  const d = new Date(s+'T12:00:00Z');
  return d.getUTCDate()+' '+['January','February','March','April','May','June','July','August','September','October','November','December'][d.getUTCMonth()];
}

/* ---------- animation on view ---------- */
function observe(){
  const slides = $$('.slide');
  const io = new IntersectionObserver(es=>{
    es.forEach(e=>{
      if(!e.isIntersecting) return;
      const s = e.target;
      if(s.classList.contains('live')) return;
      s.classList.add('live');
      tint(s.dataset.k);
      s.querySelectorAll('[data-n]').forEach((n,i)=> countUp(n, +n.dataset.n, 1100, i*90));
      setTimeout(()=>{
        s.querySelectorAll('[data-w]').forEach(b=>{ b.style.width = b.dataset.w+'%'; });
      }, RM?0:160);
      $$('.dots b').forEach(d=>d.classList.toggle('on', d.dataset.i===String(slides.indexOf(s))));
    });
  },{threshold:.42});
  slides.forEach(s=>io.observe(s));
}
function tint(k){
  const c = HUE[k]; if(!c) return;
  $$('.bgfx i').forEach((n,i)=> n.style.background = c[i]);
}
function countUp(node, to, dur, delay){
  if(RM){ node.textContent = to.toLocaleString(); return; }
  setTimeout(()=>{
    const t0 = performance.now();
    const step = t=>{
      const p = Math.min(1,(t-t0)/dur), e = 1-Math.pow(1-p,3);
      node.textContent = Math.round(to*e).toLocaleString();
      if(p<1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, delay||0);
}

/* ---------- nav ---------- */
function buildDots(){
  const box = $('#dots'), slides = $$('.slide');
  slides.forEach((s,i)=>{
    const b = el('b'); b.dataset.i = i; b.title = s.dataset.k;
    b.addEventListener('click',()=> s.scrollIntoView({behavior:RM?'auto':'smooth',block:'start'}));
    box.appendChild(b);
  });
}
function progress(){
  const bar = $('#progBar');
  const run = ()=>{
    const h = document.documentElement.scrollHeight - innerHeight;
    bar.style.width = (h>0 ? scrollY/h*100 : 0)+'%';
  };
  addEventListener('scroll', run, {passive:true}); run();
}
