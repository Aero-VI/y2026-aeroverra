/* 2026.aeroverra.com — year in motion  (v14) */

const COLORS = {
  US:'#3b6dff', JP:'#ff3864', SEA:'#14cfe0', AU:'#ff9f1c', MT:'#a855f7', ES:'#22c55e',
  GB:'#e879f9', HU:'#84cc16', SG:'#f59e0b', CH:'#ef4444', DK:'#38bdf8', AT:'#fb7185',
  ID:'#84cc16', SE:'#60a5fa', DE:'#fbbf24', BS:'#34d399', NO:'#818cf8', FI:'#f472b6',
  EE:'#2dd4bf', LV:'#fb7185', PL:'#c084fc', BE:'#facc15', RS:'#4ade80', MA:'#fb923c',
  CA:'#93c5fd', NL:'#fdba74', GI:'#f87171', ZW:'#f59e0b'
};
const NAMES = { ZW:'Zimbabwe', BW:'Botswana', GB:'United Kingdom', ES:'Spain' };
const MONTHS  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHSL = ['January','February','March','April','May','June','July','August','September','October','November','December'];

let D = null, META = {}, byDate = {}, isolate = null;

const $  = s => document.querySelector(s);
const el = (t,c,h) => { const e=document.createElement(t); if(c)e.className=c; if(h!==undefined)e.innerHTML=h; return e; };
const HEAD = new Set(['US','JP','SEA','AU','MT','ES','GB','HU','SG','CH','DK','AT']);
/* Cadence note: 26 bright hues collided. Headline + supporting keep their colour,
   the one and two day countries all drop to neutral so the eye only tracks what matters. */
const col = cc => !cc ? '#242838' : (HEAD.has(cc) ? COLORS[cc] : hsl(cc));
const NEUTRALS=['#5b6480','#66708c','#515a74','#6d7794','#4a5268'];
function hsl(cc){ let h=0; for(const ch of cc) h=(h*31+ch.charCodeAt(0))%97; return NEUTRALS[h%NEUTRALS.length]; }
const dObj   = s => new Date(s+'T12:00:00Z');
const pretty = s => { const d=dObj(s); return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getUTCDay()]+' '+d.getUTCDate()+' '+MONTHSL[d.getUTCMonth()]; };
const short  = s => { const d=dObj(s); return d.getUTCDate()+' '+MONTHS[d.getUTCMonth()]; };
const flagOf = cc => cc && cc.length===2 ? cc.toUpperCase().replace(/./g,c=>String.fromCodePoint(0x1F1E6+c.charCodeAt(0)-65)) : '🗓️';
const nameOf = cc => (META[cc] && META[cc].name) || NAMES[cc] || cc || 'Unlogged';
const dayDiff = (a,b) => Math.round((dObj(b)-dObj(a))/864e5);
const MOBILE = () => window.matchMedia('(max-width:720px)').matches;
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

fetch('data/year2026.json?v=14').then(r=>r.json()).then(data=>{
  D = data;
  D.countries.forEach(c => META[c.cc] = c);
  D.days.forEach(d => byDate[d.d] = d);
  heroStats(); buildNowNext(); buildRibbon(); buildLegend();
  buildBoard('all'); buildMonths(); buildCards(); buildStreaks(); buildShips();
  $('#genline').textContent = 'Data current to '+pretty(D.today).replace(/^\w+ /,'')+' 2026.';
  wire(); reveal();
  return fetch('data/land.json?v=14').then(r=>r.json());
}).then(land => { drawMap(land); syncMap(+$('#scrub').value); });

/* ---------------- hero ---------------- */
function heroStats(){
  const s = D.stats;
  const items = [
    [s.countries_total, 'countries'], [s.days_tracked, 'days mapped'],
    [s.days_abroad, 'days abroad'],   [s.flights, 'flights'],
    [s.cruise_nights, 'nights at sea'], [s.switches, 'border hops']
  ];
  const box = $('#heroStats');
  items.forEach(([n,l],i)=>{
    const c = el('div','chip',`<b data-n="${n}">0</b><span>${l}</span>`);
    box.appendChild(c);
    countUp(c.querySelector('b'), n, 900 + i*110);
  });
}
function countUp(node, to, dur){
  if(REDUCED){ node.textContent = to; return; }
  const t0 = performance.now();
  const step = t => {
    const p = Math.min(1,(t-t0)/dur), e = 1-Math.pow(1-p,3);
    node.textContent = Math.round(to*e);
    if(p<1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ---------------- here now / here next ---------------- */
function buildNowNext(){
  const n = D.now, box = $('#nowStrip');
  if(!box) return;
  if(n && n.cc){
    const days = dayDiff(n.since, n.date) + 1;
    box.innerHTML =
      `<div class="nf">${META[n.cc] ? META[n.cc].flag : flagOf(n.cc)}</div>
       <div class="nb">
         <div class="lbl"><i></i>here now</div>
         <div class="ct">${n.city ? n.city+', ' : ''}${nameOf(n.cc)}</div>
         <div class="sub">${n.label ? n.label.charAt(0).toUpperCase()+n.label.slice(1) : 'in country'} · since ${short(n.since)}</div>
       </div>
       <div class="ctr"><b>${days}</b><s>${days===1?'day':'days'} in ${nameOf(n.cc)}</s></div>`;
  } else {
    box.innerHTML = `<div class="nf">🌊</div><div class="nb"><div class="lbl"><i></i>here now</div>
      <div class="ct">At sea</div><div class="sub">no country under his feet today</div></div>`;
  }

  const rail = $('#nextRail');
  const list = (D.next || []).filter(x => x.end >= D.today).slice(0,5);
  if(!list.length){ rail.innerHTML = `<div class="nxt planned"><div class="wh">next</div>
    <div class="fl">🕳️</div><div class="pl">Nothing booked</div>
    <div class="lb">The calendar past today is genuinely empty. That never lasts.</div></div>`; return; }

  list.forEach((x,i)=>{
    const away = Math.max(0, dayDiff(D.today, x.start));
    const span = dayDiff(x.start, x.end) + 1;
    const c = el('div','nxt'+(x.status==='planned'?' planned':''));
    c.innerHTML =
      `<div class="wh">${i===0?'up next':'then'}</div>
       <div class="cd">${away===0?'<b>today</b>':`<b>${away}</b>${away===1?'day':'days'} out`}</div>
       <div class="fl">${flagOf(x.cc)}</div>
       <div class="pl">${x.city || nameOf(x.cc)}</div>
       <div class="dt">${x.start===x.end ? short(x.start) : short(x.start)+' → '+short(x.end)+'  ·  '+span+' days'}</div>
       <div class="lb">${x.label||''}</div>
       ${x.src?`<div class="src">${x.src}</div>`:''}`;
    if(x.status!=='planned') c.style.setProperty('--k', col(x.cc));
    rail.appendChild(c);
  });
}

/* ---------------- ribbon ---------------- */
let tiles = [];
function buildRibbon(){
  const rb = $('#ribbon'), mr = $('#monthRow');
  tiles = [];
  rb.innerHTML = ''; mr.innerHTML = '';

  const mkTile = (d, idx) => {
    const t = el('div','day');
    const cc = d.ccs[0];
    if(d.future) t.classList.add('future');
    else if(cc) t.style.background = col(cc);
    if(d.ccs[1]) t.style.background = `linear-gradient(135deg,${col(d.ccs[0])} 50%,${col(d.ccs[1])} 50%)`;
    t.dataset.i = idx;
    t.addEventListener('mouseenter', e => { showTip(e,d); setReadout(idx,false); });
    t.addEventListener('mouseleave', hideTip);
    t.addEventListener('click', ()=>{ setReadout(idx,true); $('#scrub').value = idx; syncMap(idx); });
    tiles[idx] = t;
    return t;
  };

  if(MOBILE()){
    /* phones: twelve month blocks, nothing cut off */
    rb.classList.add('bymonth'); mr.style.display = 'none';
    for(let m=0;m<12;m++){
      const blk = el('div','mb');
      blk.appendChild(el('div','mbl', MONTHSL[m]));
      const grid = el('div','mbg');
      const firstIdx = D.days.findIndex(d=>dObj(d.d).getUTCMonth()===m);
      const pad = dObj(D.days[firstIdx].d).getUTCDay();
      for(let i=0;i<pad;i++) grid.appendChild(el('div','day blank'));
      D.days.forEach((d,idx)=>{ if(dObj(d.d).getUTCMonth()===m) grid.appendChild(mkTile(d,idx)); });
      blk.appendChild(grid); rb.appendChild(blk);
    }
    $('#ribHint').textContent = 'Tap any day for the detail';
  } else {
    const first = dObj(D.days[0].d).getUTCDay();
    for(let i=0;i<first;i++) rb.appendChild(el('div','day blank'));
    D.days.forEach((d,idx)=> rb.appendChild(mkTile(d,idx)));
    const seen = {};
    D.days.forEach((d,idx)=>{ const m = dObj(d.d).getUTCMonth(); if(seen[m]===undefined) seen[m] = Math.floor((idx+first)/7); });
    for(let c=0;c<53;c++){
      const m = Object.keys(seen).find(k=>+seen[k]===c);
      mr.appendChild(el('div','', m!==undefined ? MONTHS[m] : ''));
    }
  }

  $('#scrub').max = D.days.length-1;
  const ti = D.days.findIndex(x=>x.d===D.today);
  if(ti>=0){ setReadout(ti,true); $('#scrub').value = ti; }
}

function setReadout(idx, lock){
  const d = D.days[idx]; if(!d) return;
  const cc = d.ccs[0];
  const m = META[cc] || {flag:'🗓️', name:'Unlogged'};
  const fe = $('#roFlag');
  const nf = d.future ? '🔮' : m.flag;
  if(fe.textContent !== nf && !REDUCED){ fe.classList.remove('pop'); void fe.offsetWidth; fe.classList.add('pop'); }
  fe.textContent = nf;
  $('#roDate').textContent = pretty(d.d) + (d.future ? ' · still to come' : '');
  $('#roCountry').textContent = d.ccs.length>1
      ? d.ccs.map(c=>nameOf(c)).join('  →  ')
      : (cc ? m.name : 'No booking on file');
  $('#roLabel').textContent = d.label || (d.future ? 'not booked yet' : '—');
  const c = $('#roCount');
  if(cc && cc!=='SEA' && META[cc]) c.innerHTML = `<b>${META[cc].days}</b>days in ${META[cc].name} this year`;
  else if(cc==='SEA') c.innerHTML = `<b>${D.stats.days_sea}</b>sea days this year`;
  else c.innerHTML = '';
  const r = $('#readout');
  r.style.borderColor = cc ? col(cc)+'88' : '';
  r.style.boxShadow = cc ? `0 0 44px -16px ${col(cc)}` : '';
  tiles.forEach(t=>t && t.classList.remove('now'));
  if(tiles[idx]) tiles[idx].classList.add('now');
}

/* ---------------- legend ---------------- */
function buildLegend(){
  const lg = $('#legend'), tl = $('#legendTail');
  const live = D.countries.filter(c=>c.days>0);
  const head = live.filter(c=>c.days>=3), tail = live.filter(c=>c.days<3);
  const mk = (c, small) => {
    const b = el('div','lg'+(small?' sm':''),`<i style="background:${col(c.cc)}"></i>${c.flag} ${c.name} <b>${c.days}</b>`);
    b.addEventListener('click',()=>{
      isolate = (isolate===c.cc) ? null : c.cc;
      document.querySelectorAll('.lg').forEach(x=>x.classList.toggle('off', !!isolate && x!==b));
      tiles.forEach((t,i)=>{ if(!t) return; t.classList.toggle('dim', !!isolate && !D.days[i].ccs.includes(isolate)); });
    });
    return b;
  };
  head.forEach(c=>lg.appendChild(mk(c,false)));
  tail.forEach(c=>tl.appendChild(mk(c,true)));
}

/* ---------------- the map ---------------- */
const MAPW = 1200, MAPH = 500, LAT_N = 84, LAT_S = -58;
const px = (lat,lon) => [ (lon+180)/360*MAPW, (LAT_N-lat)/(LAT_N-LAT_S)*MAPH ];
const R = Math.PI/180;

function gc(a, b, n){            /* great circle, lat/lon pairs */
  const [la1,lo1]=[a[0]*R,a[1]*R], [la2,lo2]=[b[0]*R,b[1]*R];
  const d = 2*Math.asin(Math.sqrt(Math.sin((la2-la1)/2)**2 + Math.cos(la1)*Math.cos(la2)*Math.sin((lo2-lo1)/2)**2));
  if(!d) return [a,b];
  const out=[];
  for(let i=0;i<=n;i++){
    const f=i/n, A=Math.sin((1-f)*d)/Math.sin(d), B=Math.sin(f*d)/Math.sin(d);
    const x=A*Math.cos(la1)*Math.cos(lo1)+B*Math.cos(la2)*Math.cos(lo2);
    const y=A*Math.cos(la1)*Math.sin(lo1)+B*Math.cos(la2)*Math.sin(lo2);
    const z=A*Math.sin(la1)+B*Math.sin(la2);
    out.push([Math.atan2(z,Math.hypot(x,y))/R, Math.atan2(y,x)/R]);
  }
  return out;
}
function pathOf(a, b){            /* splits at the antimeridian */
  const pts = gc(a,b,64).map(p=>px(p[0],p[1]));
  let dstr='', prev=null;
  pts.forEach(p=>{
    if(prev && Math.abs(p[0]-prev[0]) > MAPW/2) dstr += ` M${p[0].toFixed(1)},${p[1].toFixed(1)}`;
    else dstr += (prev?' L':'M')+p[0].toFixed(1)+','+p[1].toFixed(1);
    prev=p;
  });
  return dstr;
}

let arcs = [], nodes = {}, mapReady = false;
function drawMap(land){
  const gL = $('#gLand'), gA = $('#gArcs'), gN = $('#gNodes');
  const NS = 'http://www.w3.org/2000/svg';
  land.forEach(ring=>{
    let d='';
    ring.forEach((pt,i)=>{ const [x,y]=px(pt[1],pt[0]); d += (i?'L':'M')+x.toFixed(1)+','+y.toFixed(1); });
    const p = document.createElementNS(NS,'path'); p.setAttribute('d', d+'Z'); gL.appendChild(p);
  });

  D.moves.forEach((m,i)=>{
    const p = document.createElementNS(NS,'path');
    p.setAttribute('d', pathOf(m.a, m.b));
    p.setAttribute('class','arc '+m.t);
    gA.appendChild(p);
    arcs.push({el:p, m, len:0});
    [[m.a,m.al],[m.b,m.bl]].forEach(([c,lbl])=>{
      const k = c[0].toFixed(2)+','+c[1].toFixed(2);
      if(nodes[k]) return;
      const [x,y]=px(c[0],c[1]);
      const ci = document.createElementNS(NS,'circle');
      ci.setAttribute('cx',x); ci.setAttribute('cy',y); ci.setAttribute('r',2.2);
      ci.setAttribute('class','nd'); gN.appendChild(ci);
      nodes[k] = {el:ci, x, y, lbl};
    });
  });
  mapReady = true;
}

function ping(x,y){
  if(REDUCED) return;
  const NS='http://www.w3.org/2000/svg';
  const c = document.createElementNS(NS,'circle');
  c.setAttribute('cx',x); c.setAttribute('cy',y); c.setAttribute('r',2);
  c.setAttribute('class','ndring ping');
  $('#gLive').appendChild(c);
  setTimeout(()=>c.remove(), 1200);
}
function comet(path){
  if(REDUCED) return;
  const NS='http://www.w3.org/2000/svg';
  const len = path.getTotalLength(); if(!len) return;
  const c = document.createElementNS(NS,'circle');
  c.setAttribute('r',2.6); c.setAttribute('class','comet');
  $('#gLive').appendChild(c);
  const t0 = performance.now(), dur = 850;
  const step = t => {
    const f = Math.min(1,(t-t0)/dur);
    const p = path.getPointAtLength(len*f);
    c.setAttribute('cx',p.x); c.setAttribute('cy',p.y);
    c.setAttribute('opacity', 1-f*0.7);
    if(f<1) requestAnimationFrame(step); else c.remove();
  };
  requestAnimationFrame(step);
}

let lastIdx = -1;
function syncMap(idx, animate){
  if(!mapReady) return;
  const upto = D.days[idx] ? D.days[idx].d : D.today;
  let f=0,c=0,r=0;
  arcs.forEach(a=>{
    const on = a.m.d <= upto;
    if(on !== a.el.classList.contains('on')){
      a.el.classList.toggle('on', on);
      if(on && animate){
        a.el.classList.add('hot'); setTimeout(()=>a.el.classList.remove('hot'), 1400);
        comet(a.el);
        const k = a.m.b[0].toFixed(2)+','+a.m.b[1].toFixed(2);
        if(nodes[k]) ping(nodes[k].x, nodes[k].y);
      }
    }
    if(on){ a.el.classList.remove('hot'); if(a.m.t==='f')f++; else if(a.m.t==='c')c++; else r++; }
  });
  arcs.forEach(a=>{ if(a.m.d<=upto){ const k1=a.m.a[0].toFixed(2)+','+a.m.a[1].toFixed(2), k2=a.m.b[0].toFixed(2)+','+a.m.b[1].toFixed(2);
    if(nodes[k1]) nodes[k1].el.classList.add('on'); if(nodes[k2]) nodes[k2].el.classList.add('on'); } });
  $('#nFl').textContent=f; $('#nCr').textContent=c; $('#nRl').textContent=r;
  const d = D.days[idx];
  $('#mapNow').textContent = d ? (d.city ? d.city : (d.ccs[0] ? nameOf(d.ccs[0]) : '')) : '';
  lastIdx = idx;
}

/* ---------------- player ---------------- */
let timer=null, speed=70;   // default 1x (Nicholas 2026-11-01)
function wire(){
  const btn = $('#playBtn'), scrub = $('#scrub');
  function stop(){ clearInterval(timer); timer=null; btn.classList.remove('playing'); btn.innerHTML='▶<span>Play the year</span>'; }
  btn.addEventListener('click',()=>{
    if(timer){ stop(); return; }
    btn.classList.add('playing'); btn.innerHTML = '❚❚<span>Pause</span>';
    const END = Math.max(1, D.days.findIndex(x=>x.d===D.today));
    let i = +scrub.value;
    if(i >= END) i = 0;
    arcs.forEach(a=>a.el.classList.remove('on'));
    Object.values(nodes).forEach(n=>n.el.classList.remove('on'));
    timer = setInterval(()=>{
      setReadout(i,true); scrub.value = i; syncMap(i, true);
      const t = tiles[i];
      if(t && i%7===0) keepVisible(t);
      i++;
      if(i>END) stop();
    }, speed);
  });
  scrub.addEventListener('input',()=>{ setReadout(+scrub.value,true); syncMap(+scrub.value); });
  document.querySelectorAll('.sp').forEach(b=>b.addEventListener('click',()=>{
    document.querySelectorAll('.sp').forEach(x=>x.classList.remove('on'));
    b.classList.add('on'); speed = +b.dataset.sp;
    if(timer){ stop(); $('#playBtn').click(); }
  }));
  document.querySelectorAll('.tg').forEach(b=>b.addEventListener('click',()=>{
    document.querySelectorAll('.tg').forEach(x=>x.classList.remove('on'));
    b.classList.add('on'); buildBoard(b.dataset.mode);
  }));
  let w = window.innerWidth;
  window.addEventListener('resize',()=>{
    if(Math.abs(window.innerWidth-w) < 80) return;
    w = window.innerWidth;
    const was = +$('#scrub').value;
    $('#ribbon').classList.remove('bymonth'); $('#monthRow').style.display='';
    buildRibbon(); setReadout(was,true); $('#scrub').value = was;
  });
}

/* ---------------- reveal ---------------- */
function reveal(){
  const secs = document.querySelectorAll('.reveal');
  if(!('IntersectionObserver' in window) || REDUCED){ secs.forEach(s=>s.classList.add('in')); return; }
  const io = new IntersectionObserver(es=>es.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } }), {rootMargin:'-60px'});
  secs.forEach(s=>io.observe(s));
}

/* ---------------- leaderboard ---------------- */
function buildBoard(mode){
  const box = $('#board'); box.innerHTML='';
  let list = D.countries.slice();
  if(mode==='nonus') list = list.filter(c=>c.cc!=='US');
  if(mode==='land')  list = list.filter(c=>c.cc!=='SEA');
  const show = list.filter(c=>c.days>=3), tail = list.filter(c=>c.days<3);
  const max = Math.max(...show.map(c=>c.days));
  const denom = D.stats.days_tracked;
  show.forEach((c,i)=>{
    const r = el('div','row');
    r.innerHTML = `<div class="fl">${c.flag}</div>
      <div class="bar"><div class="fill" style="background:linear-gradient(90deg,${col(c.cc)},${col(c.cc)}99)"></div>
      <div class="nm">${c.name}</div></div>
      <div class="vl">${c.days}<s>${(c.days/denom*100).toFixed(0)}%</s></div>`;
    box.appendChild(r);
    const fill = r.querySelector('.fill');
    setTimeout(()=>{ fill.style.width = Math.max(4, c.days/max*100)+'%'; }, 40+i*35);
  });
  const tc = $('#tailChips'); tc.innerHTML='';
  $('#tailHead').textContent = tail.length ? `The ${tail.length} flying visits — one or two days each` : '';
  tail.forEach(c=>tc.appendChild(el('div','tc',`<span>${c.flag}</span>${c.name}<b>${c.days}</b>`)));
}

/* ---------------- month rail ---------------- */
function buildMonths(){
  const rail = $('#mrail');
  const perMonth = {};
  D.days.forEach(d=>{
    if(d.future) return;
    const m = dObj(d.d).getUTCMonth();
    perMonth[m] = perMonth[m] || {};
    d.ccs.forEach(cc=>{ perMonth[m][cc] = (perMonth[m][cc]||0)+1; });
  });
  for(let m=0;m<12;m++){
    const cs = perMonth[m] || {};
    const entries = Object.entries(cs).sort((a,b)=>b[1]-a[1]);
    const land = entries.filter(e=>e[0]!=='SEA').length;
    const mo = el('div','mo');
    const bars = el('div','bars');
    const total = entries.reduce((a,b)=>a+b[1],0) || 1;
    entries.forEach(([cc,n],i)=>{
      const s = el('div','seg');
      s.style.background = col(cc);
      s.style.height = Math.max(5, n/total*118)+'px';
      s.style.animationDelay = (m*60+i*40)+'ms';
      s.title = `${nameOf(cc)}: ${n}`;
      bars.appendChild(s);
    });
    mo.appendChild(bars);
    mo.appendChild(el('div','n', land||'—'));
    mo.appendChild(el('div','lb', MONTHS[m]));
    mo.addEventListener('click',()=>{
      const i = D.days.findIndex(d=>dObj(d.d).getUTCMonth()===m);
      if(i<0) return;
      $('#scrub').value = i; setReadout(i,true); syncMap(i);
      const sec = document.getElementById('motion-sec');
      const r = sec.getBoundingClientRect();
      if(r.bottom < 80 || r.top > window.innerHeight - 80){
        window.scrollTo({top: window.scrollY + r.top - 12, behavior:'smooth'});
      }
    });
    rail.appendChild(mo);
  }
}


/* keepVisible: nudge ONLY the ribbon's own horizontal scroller. Never touches the
   window scroll position (that was the "page jumps around" bug). */
function keepVisible(tile){
  const box = document.getElementById('ribbonWrap');
  if(!box) return;
  if(box.scrollWidth <= box.clientWidth + 4) return;   // nothing to scroll (mobile wrap mode)
  const target = tile.offsetLeft - (box.clientWidth/2) + (tile.offsetWidth/2);
  const max = box.scrollWidth - box.clientWidth;
  box.scrollTo({left: Math.max(0, Math.min(max, target)), behavior:'smooth'});
}

/* ---------------- cards ---------------- */
function buildCards(){
  const s = D.stats, box = $('#cards');
  const longest = s.longest_runs[0];
  const add = (h)=>{ box.appendChild(el('div','card',h)); };

  add(`<h3>Longest stretch in one place</h3><div class="big">${longest.n} <span style="font-size:20px">days</span></div>
       <div class="sub">${longest.flag} ${longest.name}, starting ${pretty(longest.start)}. The next longest run anywhere
       was ${s.longest_runs[1].n} days in ${s.longest_runs[1].name}.</div>`);

  add(`<h3>Busiest airports</h3><ol>${s.top_airports.slice(0,6).map(a=>`<li><span>${a[0]}</span><b>${a[1]}</b></li>`).join('')}</ol>
       <div class="sub">${s.airports} airports, ${s.airlines} different airlines, ${s.flights} flights.</div>`);

  add(`<h3>Airlines flown</h3><ol>${s.top_airlines.slice(0,6).map(a=>`<li><span>${a[0]}</span><b>${a[1]}</b></li>`).join('')}</ol>`);

  add(`<h3>Beds</h3><div class="big">${s.hotels}</div>
       <div class="sub">separate hotel bookings, ${s.hotel_nights} nights between them. Add ${s.cruise_nights} cruise nights
       and that is ${s.hotel_nights + s.cruise_nights} nights of 2026 paid for by the night.</div>`);

  add(`<h3>Water vs land</h3><div class="big">${s.days_sea}</div>
       <div class="sub">days spent in no country at all, mid-ocean. More than he spent in any single European country
       this year.</div>`);

  add(`<h3>The split</h3><div class="big">${s.days_us} / ${s.days_abroad}</div>
       <div class="sub">days in the United States versus days on foreign soil. ${s.days_tracked} of
       ${s.days_tracked+s.days_untracked} elapsed days are accounted for by a booking.</div>`);
}

/* ---------------- streaks ---------------- */
function buildStreaks(){
  const box = $('#streaks'); if(!box) return;
  const multi = D.days.filter(d=>!d.future && d.ccs.length>1).length;
  const hop   = D.days.filter(d=>!d.future && d.ccs.length>2).length;
  const items = D.stats.longest_runs.slice(0,3).map(r=>
    ({f:r.flag, n:r.n, w:'day run', d:r.name+', from '+pretty(r.start), c:col(r.cc)}));
  items.push({f:'🛬', n:multi, w:'two-country days', d:'days that started in one country and ended in another', c:'#19d2e6'});
  items.push({f:'🤯', n:hop, w:'three-country days', d:'airport, airport, hotel, all before midnight', c:'#ff4d6d'});
  items.push({f:'🧭', n:D.stats.switches, w:'border hops', d:'times the country under his feet changed', c:'#ffc234'});
  items.forEach(it=>{
    const s = el('div','stk');
    s.innerHTML = `<i class="glow" style="background:${it.c}"></i><div class="f">${it.f}</div>
      <div class="n">${it.n}</div><div class="w">${it.w}</div><div class="d">${it.d}</div>`;
    box.appendChild(s);
  });
}

/* ---------------- ships ---------------- */
function buildShips(){
  const box = $('#ships');
  D.cruises.slice().sort((a,b)=>a.start.localeCompare(b.start)).forEach(c=>{
    const s = el('div','ship');
    s.innerHTML = `<div class="nt">${c.nights}</div>
      <div class="nm">${c.ship}</div>
      <div class="dt">${pretty(c.start)} → ${pretty(c.end)} · ${c.line}</div>
      <div class="rt">${c.frm} → ${c.to}${c.ports.length?`<br><span style="color:#8d96ac;font-size:12px">${c.ports.join(' · ')}</span>`:''}</div>`;
    box.appendChild(s);
  });
}

/* ---------------- tooltip ---------------- */
function showTip(e,d){
  if(MOBILE()) return;
  const t = $('#tip');
  const names = d.ccs.map(c=>(META[c]||{}).flag+' '+nameOf(c)).join(' → ') || 'no booking';
  t.innerHTML = `<b>${pretty(d.d)}</b>${names}${d.label?`<s>${d.label}</s>`:''}`;
  const r = e.target.getBoundingClientRect();
  t.style.left = r.left + r.width/2 + 'px';
  t.style.top = r.top + 'px';
  t.style.opacity = 1;
}
function hideTip(){ $('#tip').style.opacity = 0; }
