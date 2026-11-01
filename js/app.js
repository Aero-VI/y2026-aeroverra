/* 2026.aeroverra.com — the year in motion  (v12) */

const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- palette: 6 headline, supporting, neutral long tail ---------- */
const TIER1 = { US:'#3b6dff', JP:'#ff3864', SEA:'#14cfe0', AU:'#ff9f1c', MT:'#a855f7', ES:'#22c55e' };
const TIER2 = { GB:'#e879f9', HU:'#84cc16', SG:'#f59e0b', CH:'#ef4444', DK:'#38bdf8', AT:'#fb7185' };
const NEUTRALS = ['#5b6480','#66708c','#515a74','#6d7794','#4a5268'];

const KINDWORD = {
  flight:'in the air', hotel:'checked in', home:'home', cruise:'on a ship',
  port:'port call', sea:'at sea', rail:'on the rails', stay:'staying put'
};
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHSL = ['January','February','March','April','May','June','July','August','September','October','November','December'];

let D = null, LAND = null, META = {}, COLOR = {}, byDate = {}, isolate = null;
let tiles = [], TODAY_I = 0, cur = 0;

const $ = s => document.querySelector(s);
const el = (t,c,h) => { const e=document.createElement(t); if(c)e.className=c; if(h!==undefined)e.innerHTML=h; return e; };
const svgEl = (t,a={}) => { const e=document.createElementNS('http://www.w3.org/2000/svg',t); for(const k in a) e.setAttribute(k,a[k]); return e; };
const col = cc => COLOR[cc] || '#242838';
const dObj = s => new Date(s+'T12:00:00Z');
const pretty = s => { const d=dObj(s); return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getUTCDay()]+' '+d.getUTCDate()+' '+MONTHSL[d.getUTCMonth()]; };
const shortd = s => { const d=dObj(s); return d.getUTCDate()+' '+MONTHS[d.getUTCMonth()]; };

Promise.all([
  fetch('data/year2026.json?v=12').then(r=>r.json()),
  fetch('data/land.json?v=1').then(r=>r.json())
]).then(([data,land])=>{
  D = data; LAND = land;
  let ni = 0;
  D.countries.forEach(c => {
    META[c.cc] = c;
    COLOR[c.cc] = TIER1[c.cc] || TIER2[c.cc] || NEUTRALS[(ni++)%NEUTRALS.length];
  });
  D.days.forEach((d,i) => { byDate[d.d] = d; d._i = i; });
  TODAY_I = Math.max(0, D.days.findIndex(x=>x.d===D.today));

  heroStats();
  buildMap();
  buildRibbon();
  buildLegend();
  buildBoard('all');
  buildMonths();
  buildCards();
  buildStreaks();
  buildShips();
  wire();
  observe();

  $('#genline').textContent = 'Data current to 1 November 2026.';
  goTo(TODAY_I, false);
});

/* ================= hero ================= */
function heroStats(){
  const s = D.stats;
  const items = [
    [s.countries_total,'countries'], [s.days_tracked,'days mapped'], [s.days_abroad,'days abroad'],
    [s.flights,'flights'], [s.cruise_nights,'nights at sea'], [s.switches,'border hops']
  ];
  const box = $('#heroStats');
  items.forEach(([n,l],i)=>{
    const c = el('div','chip',`<b>0</b><span>${l}</span>`);
    box.appendChild(c);
    countUp(c.querySelector('b'), n, 900 + i*110);
  });
}
function countUp(node, to, dur){
  if(RM){ node.textContent = to; return; }
  const t0 = performance.now();
  const step = t => {
    const p = Math.min(1,(t-t0)/dur), e = 1-Math.pow(1-p,3);
    node.textContent = Math.round(to*e);
    if(p<1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ================= map ================= */
const MW = 1200, MH = 500, LAT_TOP = 83, LAT_BOT = -58;
const projX = lon => (lon+180)/360*MW;
const projY = lat => (LAT_TOP - Math.max(LAT_BOT,Math.min(LAT_TOP,lat)))/(LAT_TOP-LAT_BOT)*MH;
let MOVES = [], NODES = {}, hotTimer = null;

function gcPoints(a,b,n){
  const R = Math.PI/180;
  const la1=a[0]*R, lo1=a[1]*R, la2=b[0]*R, lo2=b[1]*R;
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
function arcPath(m){
  const N = 60, pts = gcPoints(m.a,m.b,N);
  const p0=[projX(m.a[1]),projY(m.a[0])], p1=[projX(m.b[1]),projY(m.b[0])];
  let dx = Math.abs(p1[0]-p0[0]); if(dx > MW/2) dx = MW - dx;
  const dist = Math.hypot(dx, p1[1]-p0[1]);
  const lift = Math.min(140, dist * (m.t==='f' ? .15 : .05));
  let d='', prev=null;
  pts.forEach((p,i)=>{
    const f=i/N;
    const x = projX(p[1]);
    const y = projY(p[0]) - Math.sin(Math.PI*f)*lift;
    if(prev===null || Math.abs(x-prev) > MW/2) d += `M${x.toFixed(1)},${y.toFixed(1)}`;
    else d += `L${x.toFixed(1)},${y.toFixed(1)}`;
    prev = x;
  });
  return d;
}

function buildMap(){
  const gLand = $('#gLand');
  LAND.forEach(ring=>{
    let d='';
    ring.forEach((p,i)=>{ d += (i?'L':'M') + projX(p[0]).toFixed(1) + ',' + projY(p[1]).toFixed(1); });
    gLand.appendChild(svgEl('path',{d:d+'Z'}));
  });

  const gArcs = $('#gArcs'), gNodes = $('#gNodes');
  const key = p => p[0].toFixed(3)+','+p[1].toFixed(3);

  D.moves.forEach(m=>{
    const di = byDate[m.d] ? byDate[m.d]._i : -1;
    if(di < 0) return;
    const p = svgEl('path',{class:'arc '+m.t, d:arcPath(m)});
    gArcs.appendChild(p);
    let len = 0; try{ len = p.getTotalLength(); }catch(e){}
    const rec = {m, di, p, len, on:false};
    p.addEventListener('mouseenter', e=>{
      $('#tip').innerHTML = `<b>${m.n||''} · ${shortd(m.d)}</b>${m.ac||m.al} → ${m.bc||m.bl}`;
      const r = p.getBoundingClientRect();
      $('#tip').style.left = (r.left+r.width/2)+'px';
      $('#tip').style.top = (r.top+r.height/2)+'px';
      $('#tip').style.opacity = 1;
    });
    p.addEventListener('mouseleave', hideTip);
    MOVES.push(rec);

    [[m.a,m.al,m.ac],[m.b,m.bl,m.bc]].forEach(([pt,lab,city])=>{
      const k = key(pt);
      if(!NODES[k]){
        const c = svgEl('circle',{class:'nd', cx:projX(pt[1]).toFixed(1), cy:projY(pt[0]).toFixed(1), r:2.2});
        gNodes.appendChild(c);
        NODES[k] = {c, di, label:city||lab, x:projX(pt[1]), y:projY(pt[0])};
      } else if(di < NODES[k].di) NODES[k].di = di;
    });
  });
  MOVES.sort((a,b)=>a.di-b.di);
}

function syncMap(i, animate){
  let nf=0, nc=0, nr=0, last=null;
  MOVES.forEach(r=>{
    const should = r.di <= i;
    if(should && !r.on){
      r.on = true;
      if(animate && !RM && r.len){
        r.p.style.transition = 'none';
        r.p.style.strokeDasharray = r.len;
        r.p.style.strokeDashoffset = r.len;
        r.p.classList.add('on','hot');
        void r.p.getBoundingClientRect();
        const dur = Math.max(260, Math.min(1100, r.len*2.2));
        r.p.style.transition = `stroke-dashoffset ${dur}ms cubic-bezier(.3,.7,.3,1), opacity .3s`;
        r.p.style.strokeDashoffset = 0;
        comet(r, dur);
        ping(r);
        clearTimeout(hotTimer);
        hotTimer = setTimeout(()=>r.p.classList.remove('hot'), dur+500);
      } else {
        r.p.style.transition='none'; r.p.style.strokeDasharray='none'; r.p.style.strokeDashoffset=0;
        r.p.classList.add('on');
      }
    } else if(!should && r.on){
      r.on = false;
      r.p.style.transition='none';
      r.p.classList.remove('on','hot');
      if(r.len){ r.p.style.strokeDasharray=r.len; r.p.style.strokeDashoffset=r.len; }
    }
    if(r.on){
      if(r.m.t==='f') nf++; else if(r.m.t==='c') nc++; else nr++;
      if(!last || r.di >= last.di) last = r;
    }
  });
  for(const k in NODES){
    const n = NODES[k];
    n.c.classList.toggle('on', n.di <= i);
  }
  $('#nFl').textContent = nf; $('#nCr').textContent = nc; $('#nRl').textContent = nr;
  $('#mapNow').textContent = last ? `${last.m.ac||last.m.al} → ${last.m.bc||last.m.bl}` : '';
}

function comet(r, dur){
  const g = $('#gLive');
  const c = svgEl('circle',{class:'comet', r:3.2, cx:0, cy:0});
  g.appendChild(c);
  const t0 = performance.now();
  const step = t=>{
    const f = Math.min(1,(t-t0)/dur);
    try{ const p = r.p.getPointAtLength(r.len*f); c.setAttribute('cx',p.x); c.setAttribute('cy',p.y); }catch(e){}
    if(f<1) requestAnimationFrame(step); else c.remove();
  };
  requestAnimationFrame(step);
}
function ping(r){
  const g = $('#gLive');
  try{
    const p = r.p.getPointAtLength(r.len);
    const c = svgEl('circle',{class:'ndring ping', cx:p.x, cy:p.y, r:2});
    g.appendChild(c);
    setTimeout(()=>c.remove(), 1200);
  }catch(e){}
}

/* ================= ribbon ================= */
let ribMode = null;
function wantMode(){ return window.innerWidth < 720 ? 'month' : 'cal'; }

function buildRibbon(){
  const mode = wantMode();
  if(mode === ribMode) return;
  ribMode = mode;
  const rb = $('#ribbon'), mr = $('#monthRow');
  rb.innerHTML=''; mr.innerHTML=''; tiles = [];

  const mk = (d, idx) => {
    const t = el('div','day');
    const cc = d.ccs[0];
    if(d.future) t.classList.add('future');
    else if(cc) t.style.background = col(cc);
    if(d.ccs[1] && !d.future) t.style.background = `linear-gradient(135deg,${col(d.ccs[0])} 50%,${col(d.ccs[1])} 50%)`;
    t.dataset.i = idx;
    t.addEventListener('mouseenter', e => { if(matchMedia('(hover:hover)').matches){ showTip(e,d); goTo(idx,false,true); } });
    t.addEventListener('mouseleave', hideTip);
    t.addEventListener('click', e => { showTip(e,d); goTo(idx,false); setTimeout(hideTip, 2600); });
    tiles[idx] = t;
    return t;
  };

  if(mode === 'cal'){
    rb.classList.remove('bymonth');
    const first = dObj(D.days[0].d).getUTCDay();
    for(let i=0;i<first;i++) rb.appendChild(el('div','day blank'));
    D.days.forEach((d,idx)=> rb.appendChild(mk(d,idx)));
    const seen = {};
    D.days.forEach((d,idx)=>{ const m = dObj(d.d).getUTCMonth(); if(seen[m]===undefined) seen[m] = Math.floor((idx+first)/7); });
    for(let c=0;c<53;c++){
      const m = Object.keys(seen).find(k=>+seen[k]===c);
      mr.appendChild(el('div','', m!==undefined ? MONTHS[m] : ''));
    }
    $('#ribHint').textContent = 'Hover any day for the detail';
  } else {
    rb.classList.add('bymonth');
    mr.style.display='none';
    for(let m=0;m<12;m++){
      const block = el('div','mb');
      block.appendChild(el('div','mbl', MONTHSL[m]));
      const g = el('div','mbg');
      const days = D.days.filter(d=>dObj(d.d).getUTCMonth()===m);
      const lead = dObj(days[0].d).getUTCDay();
      for(let i=0;i<lead;i++) g.appendChild(el('div','day blank'));
      days.forEach(d=> g.appendChild(mk(d, d._i)));
      block.appendChild(g); rb.appendChild(block);
    }
    $('#ribHint').textContent = 'Tap any day for the detail';
  }
  applyIsolate();
  if(tiles[cur]) tiles[cur].classList.add('now');
}

/* ================= the one timeline ================= */
function goTo(i, animate, hoverOnly){
  i = Math.max(0, Math.min(D.days.length-1, i));
  const d = D.days[i];
  if(!hoverOnly){ cur = i; $('#scrub').value = i; }
  const cc = d.ccs[0];
  const m = META[cc] || {flag:'🗓️', name:'Unlogged'};
  const fe = $('#roFlag');
  const nf = d.future ? '🔮' : m.flag;
  if(fe.textContent !== nf && !RM){ fe.classList.remove('pop'); void fe.offsetWidth; fe.classList.add('pop'); }
  fe.textContent = nf;
  $('#roDate').textContent = pretty(d.d) + (d.future ? ' · still to come' : '');
  $('#roCountry').textContent = d.ccs.length>1
      ? d.ccs.map(c=>(META[c]||{name:c}).name).join('  →  ')
      : (cc ? m.name : 'No booking on file');
  $('#roLabel').textContent = d.label || (d.future ? 'not booked yet' : '—');
  const c = $('#roCount');
  if(cc && cc!=='SEA' && META[cc]) c.innerHTML = `<b>${META[cc].days}</b>days in ${META[cc].name} this year`;
  else if(cc==='SEA') c.innerHTML = `<b>${D.stats.days_sea}</b>sea days this year`;
  else c.innerHTML = '';
  const r = $('#readout');
  r.style.borderColor = cc ? col(cc)+'88' : '';
  r.style.boxShadow = cc ? `0 0 44px -16px ${col(cc)}` : '';

  if(!hoverOnly){
    tiles.forEach(t=>t && t.classList.remove('now'));
    if(tiles[i]) tiles[i].classList.add('now');
    syncMap(i, !!animate);
  }
}

/* ================= legend ================= */
function buildLegend(){
  const lg = $('#legend'), tl = $('#legendTail');
  lg.innerHTML=''; tl.innerHTML='';
  D.countries.filter(c=>c.days>0).forEach(c=>{
    const small = c.tier===3;
    const b = el('div','lg'+(small?' sm':''),
      `<i style="background:${col(c.cc)}"></i>${c.flag} ${c.name} <b>${c.days}</b>`);
    b.addEventListener('click',()=>{
      isolate = (isolate===c.cc) ? null : c.cc;
      applyIsolate();
    });
    b.dataset.cc = c.cc;
    (small ? tl : lg).appendChild(b);
  });
}
function applyIsolate(){
  document.querySelectorAll('.lg').forEach(x=>x.classList.toggle('off', !!isolate && x.dataset.cc!==isolate));
  tiles.forEach((t,i)=>{ if(t) t.classList.toggle('dim', !!isolate && !D.days[i].ccs.includes(isolate)); });
}

/* ================= player ================= */
let timer=null, speed=32;
function wire(){
  const btn = $('#playBtn'), scrub = $('#scrub');
  scrub.max = D.days.length-1;

  function stop(){ clearInterval(timer); timer=null; btn.classList.remove('playing'); btn.innerHTML='▶<span>Play the year</span>'; }
  function start(){
    btn.classList.add('playing'); btn.innerHTML='❚❚<span>Pause</span>';
    let i = cur >= TODAY_I ? 0 : cur;
    if(i===0){ MOVES.forEach(r=>{ r.on=true; }); syncMap(-1,false); }
    timer = setInterval(()=>{
      goTo(i, true);
      const t = tiles[i];
      if(t && i%7===0 && ribMode==='cal') t.scrollIntoView({block:'nearest',inline:'center',behavior:RM?'auto':'smooth'});
      i++;
      if(i>TODAY_I) stop();
    }, speed);
  }
  btn.addEventListener('click',()=> timer ? stop() : start());

  scrub.addEventListener('input',()=>{ if(timer) stop(); goTo(+scrub.value,false); });
  document.querySelectorAll('.sp').forEach(b=>b.addEventListener('click',()=>{
    document.querySelectorAll('.sp').forEach(x=>x.classList.remove('on'));
    b.classList.add('on'); speed = +b.dataset.sp;
    if(timer){ stop(); start(); }
  }));
  document.querySelectorAll('.tg').forEach(b=>b.addEventListener('click',()=>{
    document.querySelectorAll('.tg').forEach(x=>x.classList.remove('on'));
    b.classList.add('on'); buildBoard(b.dataset.mode);
  }));

  let rt=null;
  window.addEventListener('resize',()=>{ clearTimeout(rt); rt=setTimeout(()=>{ buildRibbon(); goTo(cur,false); },180); });
}

/* ================= leaderboard ================= */
function buildBoard(mode){
  const box = $('#board'); box.innerHTML='';
  let list = D.countries.slice();
  if(mode==='nonus') list = list.filter(c=>c.cc!=='US');
  if(mode==='land')  list = list.filter(c=>c.cc!=='SEA');
  const top = list.slice(0,10), tail = list.slice(10);
  const max = Math.max(...top.map(c=>c.days));
  const denom = D.stats.days_tracked;
  top.forEach((c,i)=>{
    const r = el('div','row');
    r.innerHTML = `<div class="fl">${c.flag}</div>
      <div class="bar"><div class="fill" style="background:linear-gradient(90deg,${col(c.cc)},${col(c.cc)}99)"></div>
      <div class="nm">${c.name}</div></div>
      <div class="vl">${c.days}<s>${(c.days/denom*100).toFixed(0)}%</s></div>`;
    box.appendChild(r);
    const fill = r.querySelector('.fill');
    const w = Math.max(4, c.days/max*100)+'%';
    if(RM) fill.style.width = w;
    else setTimeout(()=>{ fill.style.width = w; }, 60+i*45);
  });
  const tc = $('#tailChips'); tc.innerHTML='';
  $('#tailHead').textContent = tail.length ? `The other ${tail.length}, a day or two each` : '';
  tail.forEach(c=> tc.appendChild(el('div','tc',`${c.flag} ${c.name} <b>${c.days}</b>`)));
}

/* ================= month rail ================= */
function buildMonths(){
  const rail = $('#mrail'); rail.innerHTML='';
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
      s.style.animationDelay = (m*55+i*35)+'ms';
      s.title = `${(META[cc]||{name:cc}).name}: ${n}`;
      bars.appendChild(s);
    });
    mo.appendChild(bars);
    mo.appendChild(el('div','n', land||'—'));
    mo.appendChild(el('div','lb', MONTHS[m]));
    mo.addEventListener('click',()=>{
      const idx = D.days.findIndex(d=>dObj(d.d).getUTCMonth()===m);
      goTo(idx,false);
      document.getElementById('motion-sec').scrollIntoView({behavior:RM?'auto':'smooth',block:'start'});
    });
    rail.appendChild(mo);
  }
}

/* ================= cards ================= */
function buildCards(){
  const s = D.stats, box = $('#cards'); box.innerHTML='';
  const longest = s.longest_runs[0];
  const add = h => box.appendChild(el('div','card',h));

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
       <div class="sub">days spent in no country at all, mid-ocean. That is more than he spent in any single European country
       this year.</div>`);

  add(`<h3>The split</h3><div class="big">${s.days_us} / ${s.days_abroad}</div>
       <div class="sub">days in the United States versus days on foreign soil. ${s.days_tracked} of
       ${s.days_tracked + s.days_untracked} days is accounted for by a booking.</div>`);
}

/* ================= streaks ================= */
function buildStreaks(){
  const box = $('#streaks'); box.innerHTML='';
  const multi = D.days.filter(d=>!d.future && d.ccs.length>1).length;
  const hop = D.days.filter(d=>!d.future && d.ccs.length>2).length;
  const items = D.stats.longest_runs.slice(0,3).map(r=>
    ({f:r.flag, n:r.n, w:'day run', d:r.name+', from '+pretty(r.start), c:col(r.cc)}));
  items.push({f:'🛬', n:multi, w:'two-country days', d:'days that started in one country and ended in another', c:'#14cfe0'});
  items.push({f:'🤯', n:hop, w:'three-country days', d:'airport, airport, hotel, all before midnight', c:'#ff3864'});
  items.push({f:'🧭', n:D.stats.switches, w:'border hops', d:'times the country under his feet changed', c:'#ff9f1c'});
  items.forEach(it=>{
    const s = el('div','stk');
    s.innerHTML = `<i class="glow" style="background:${it.c}"></i><div class="f">${it.f}</div>
      <div class="n">${it.n}</div><div class="w">${it.w}</div><div class="d">${it.d}</div>`;
    box.appendChild(s);
  });
}

/* ================= ships ================= */
function buildShips(){
  const box = $('#ships'); box.innerHTML='';
  D.cruises.slice().sort((a,b)=>a.start.localeCompare(b.start)).forEach(c=>{
    const s = el('div','ship');
    s.innerHTML = `<div class="nt">${c.nights}</div>
      <div class="nm">${c.ship}</div>
      <div class="dt">${pretty(c.start)} → ${pretty(c.end)} · ${c.line}</div>
      <div class="rt">${c.frm} → ${c.to}${c.ports.length?`<br><span style="color:#8d96ac;font-size:12px">${c.ports.join(' · ')}</span>`:''}</div>`;
    box.appendChild(s);
  });
}

/* ================= reveal on scroll ================= */
function observe(){
  if(RM){ document.querySelectorAll('.reveal').forEach(s=>s.classList.add('in')); return; }
  const io = new IntersectionObserver(es=>{
    es.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
  },{threshold:.12});
  document.querySelectorAll('.reveal').forEach(s=>io.observe(s));
}

/* ================= tooltip ================= */
function showTip(e,d){
  const t = $('#tip');
  const names = d.ccs.map(c=>(META[c]||{}).flag+' '+(META[c]||{name:c}).name).join(' → ') || 'no booking';
  t.innerHTML = `<b>${pretty(d.d)}</b>${names}${d.label?`<s>${d.label}</s>`:''}`;
  const r = e.currentTarget.getBoundingClientRect();
  t.style.left = Math.max(80, Math.min(window.innerWidth-80, r.left + r.width/2)) + 'px';
  t.style.top = r.top + 'px';
  t.style.opacity = 1;
}
function hideTip(){ $('#tip').style.opacity = 0; }
