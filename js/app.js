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
  return Promise.all([
    fetch('data/land.json?v=17').then(r=>r.json()),
    fetch('data/countries.json?v=17').then(r=>r.json()).catch(()=>null),
    fetch('data/citypos.json?v=21').then(r=>r.json()).catch(()=>({}))
  ]);
}).then(([land, ctys, cpos]) => {
  CITYPOS = cpos || {};
  buildDayPos();
  drawMap(land, ctys);
  syncMap(+$('#scrub').value);
  aimDay(+$('#scrub').value, 900);
});

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

/* ---------------- the map : ORTHOGRAPHIC GLOBE ----------------
   Nicholas 2026-11-01: on the flat map the Pacific legs ran off the right edge
   and reappeared on the left, which is impossible to follow. So: a real sphere.
   Nothing wraps on a globe, and the globe turns itself to face whatever leg is
   playing. Flat view is still there behind the FLAT button.
---------------------------------------------------------------- */
const MAPW = 1200, MAPH = 500, LAT_N = 84, LAT_S = -58;
const R = Math.PI/180;
const GL = { cx: MAPW/2, cy: MAPH/2, r0: 232, r: 232, lam: -40, phi: 18, mode: 'globe', spin: true, rate: 0.07, z: 1 };
/* the globe frame is a FIXED square in user units. zoom scales the sphere
   inside it (GL.r = r0 * z) instead of padding the viewBox, so zooming in
   actually magnifies Japan instead of just trimming 24px of margin. */
const FRAME = 2*232 + 22;

const pxFlat = (lat,lon) => [ (lon+180)/360*MAPW, (LAT_N-lat)/(LAT_N-LAT_S)*MAPH ];

/* orthographic: returns [x,y,visible] */
function pxGlobe(lat,lon){
  const la = lat*R, lo = (lon - GL.lam)*R, p0 = GL.phi*R;
  const cosc = Math.sin(p0)*Math.sin(la) + Math.cos(p0)*Math.cos(la)*Math.cos(lo);
  const x = GL.cx + GL.r * Math.cos(la)*Math.sin(lo);
  const y = GL.cy - GL.r * (Math.cos(p0)*Math.sin(la) - Math.sin(p0)*Math.cos(la)*Math.cos(lo));
  return [x, y, cosc > 0.004];
}
const proj = (lat,lon) => GL.mode==='globe' ? pxGlobe(lat,lon) : [...pxFlat(lat,lon), true];
const r1 = v => Math.round(v*10)/10;

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
/* midpoint of a great circle, used to aim the globe */
function gcMid(a,b){ const g = gc(a,b,2); return g[1] || a; }
/* point f of the way along a great circle (f 0..1) */
function gcAt(a,b,f){ const n=24, g=gc(a,b,n); return g[Math.max(0,Math.min(n,Math.round(f*n)))] || a; }

/* ---- where he physically IS on day i ----------------------------------
   Nicholas 2026-11-02: the globe sat still through whole ocean crossings.
   Days carry a country, not a position, and a sea day's country is "SEA",
   which matches no polygon, so the camera had nothing to aim at. Build a
   position for every day off the move chain instead: last arrival for land
   days, and for a sea day interpolate along the leg to the next port, so
   the ship actually crawls across the Pacific. */
const DT = s => Date.parse(s+'T00:00:00Z')/86400000;
let DAYPOS = [], CITYPOS = {};
function buildDayPos(){
  /* a move's `d` is the ARRIVAL date and `a` is the port/airport it left from,
     so a sea day sits INSIDE the next move: interpolate along next.a -> next.b. */
  const ms = (D.moves||[]).slice().sort((x,y)=> x.d < y.d ? -1 : x.d > y.d ? 1 : 0);
  DAYPOS = D.days.map(day => {
    const t = DT(day.d);
    let prev=null, next=null;
    for(const m of ms){ const md = DT(m.d); if(md <= t) prev = m; else { next = m; break; } }
    if(day.kind !== 'sea'){
      /* the city he slept in beats the move chain: some hops (the Honolulu
         flight) were never ticketed, so the chain lags reality */
      if(day.city && CITYPOS[day.city]) return CITYPOS[day.city];
      if(prev) return prev.b;
      return next ? next.a : null;
    }
    if(!next) return prev ? prev.b : null;
    const t0 = prev ? DT(prev.d) : DT(next.d)-1, t1 = DT(next.d);
    const f = t1 > t0 ? Math.max(0, Math.min(1, (t-t0)/(t1-t0))) : 0.5;
    return gcAt(next.a, next.b, f);
  });
}

/* build a path string from lat/lon points, breaking when they go behind the
   limb (globe) or jump the antimeridian (flat) */
/* front = facing you, back = the far side of the sphere, drawn as a ghost so a
   leg happening on the other side of the planet is still visible (Nicholas: "hiding
   a bunch of activity"). */
function lineOfSplit(pts){
  let f='', b='', fpen=false, bpen=false;
  for(const pt of pts){
    const [x,y,vis] = proj(pt[0], pt[1]);
    const X = r1(x), Y = r1(y);
    if(vis){ f += (fpen?'L':'M')+X+','+Y; fpen=true; bpen=false; }
    else   { b += (bpen?'L':'M')+X+','+Y; bpen=true; fpen=false; }
  }
  return [f,b];
}
function lineOf(pts, closed){
  let d='', pen=false, prev=null;
  for(const pt of pts){
    const [x,y,vis] = proj(pt[0], pt[1]);
    if(!vis){ pen=false; prev=null; continue; }
    if(GL.mode==='flat' && prev && Math.abs(x-prev[0]) > MAPW/2){ pen=false; }
    d += (pen ? 'L' : 'M') + r1(x) + ',' + r1(y);
    pen = true; prev=[x,y];
  }
  return d + (closed && d ? 'Z' : '');
}

let arcs = [], nodes = {}, mapReady = false, LANDRINGS = [], landPaths = [], gridPaths = [], CTY = null, ctyPaths = [], hotCCs = [];
function drawMap(land, ctys){
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.getElementById('map');
  const gL = $('#gLand'), gA = $('#gArcs'), gN = $('#gNodes');
  LANDRINGS = land.map(ring => ring.map(pt => [pt[1], pt[0]]));   // [lat,lon]

  /* sphere + graticule go behind the land */
  const gSphere = document.createElementNS(NS,'g'); gSphere.setAttribute('id','gSphere');
  const ocean = document.createElementNS(NS,'circle');
  ocean.setAttribute('id','ocean');
  ocean.setAttribute('cx',GL.cx); ocean.setAttribute('cy',GL.cy); ocean.setAttribute('r',GL.r);
  gSphere.appendChild(ocean);
  const gGrid = document.createElementNS(NS,'g'); gGrid.setAttribute('id','gGrid');
  for(let lon=-180; lon<180; lon+=30){
    const p = document.createElementNS(NS,'path'); p.setAttribute('class','grat');
    gGrid.appendChild(p);
    gridPaths.push({el:p, pts: Array.from({length:37},(_,i)=>[-90+i*5, lon])});
  }
  for(let lat=-60; lat<=60; lat+=30){
    const p = document.createElementNS(NS,'path'); p.setAttribute('class','grat');
    gGrid.appendChild(p);
    gridPaths.push({el:p, pts: Array.from({length:73},(_,i)=>[lat, -180+i*5])});
  }
  const gBack = document.createElementNS(NS,'g'); gBack.setAttribute('id','gBack');
  svg.insertBefore(gSphere, gL);
  svg.insertBefore(gBack, gL);
  svg.insertBefore(gGrid, gL);

  if(ctys && ctys.length){
    /* real country polygons: every country gets an outline so the globe reads as a
       map, visited ones are filled brighter, and the one he is standing in glows.
       (Nicholas 2026-11-01: "it's all dark", "highlight the country I go to") */
    CTY = ctys;
    ctys.forEach(c=>{
      const g = document.createElementNS(NS,'g');
      g.setAttribute('class','cty'+(c.v?' v':''));
      g.dataset.cc = c.cc;
      const paths = c.r.map(()=>{ const p=document.createElementNS(NS,'path'); g.appendChild(p); return p; });
      gL.appendChild(g);
      ctyPaths.push({g, paths, rings: c.r.map(r=>r.map(pt=>[pt[1],pt[0]])), cc:c.cc, name:c.n});
    });
  } else {
    LANDRINGS.forEach(()=>{
      const p = document.createElementNS(NS,'path'); gL.appendChild(p); landPaths.push(p);
    });
  }

  const gBackRef = document.getElementById('gBack');
  D.moves.forEach(m=>{
    const p = document.createElementNS(NS,'path');
    p.setAttribute('class','arc '+m.t);
    gA.appendChild(p);
    const pb = document.createElementNS(NS,'path');
    pb.setAttribute('class','arc back '+m.t);
    gBackRef.appendChild(pb);
    arcs.push({el:p, elB:pb, m, pts: gc(m.a, m.b, 64)});
    [[m.a,m.al],[m.b,m.bl]].forEach(([c,lbl])=>{
      const k = c[0].toFixed(2)+','+c[1].toFixed(2);
      if(nodes[k]) return;
      const ci = document.createElementNS(NS,'circle');
      ci.setAttribute('r',2.2); ci.setAttribute('class','nd'); gN.appendChild(ci);
      nodes[k] = {el:ci, x:0, y:0, lbl, c};
    });
  });
  mapReady = true;
  fitMap();
  renderMap();
  mapControls();
  if(GL.spin && !REDUCED) runTween();
  addEventListener('resize', ()=>{ fitMap(); renderMap(); });
}

/* On a phone a 1200x500 box renders the globe about 150px across, which is
   useless. Crop the viewBox to a square around the sphere instead. */
function fitMap(){
  const svg = document.getElementById('map');
  if(!svg) return;
  const box = svg.parentElement;
  /* never make the wrapper a flex row: under 720px .maplegend is position:static,
     so it becomes a sibling flex item and shrinks the sphere to nothing. */
  if(box){ box.style.display=''; box.style.justifyContent=''; box.style.alignItems=''; box.style.height=''; }
  if(GL.mode==='globe'){
    GL.r = GL.r0 * GL.z;
    const oc = document.getElementById('ocean');
    if(oc) oc.setAttribute('r', r1(GL.r));
    svg.setAttribute('viewBox', `${GL.cx-FRAME/2} ${GL.cy-FRAME/2} ${FRAME} ${FRAME}`);
    const narrow = innerWidth < 760;
    const side = Math.min(innerHeight*0.74, 720);
    /* shrink the card to the globe on desktop so there is no dead gutter
       either side of the square once it is zoomed in */
    if(box){ box.style.maxWidth = narrow ? '' : side + 'px'; box.style.margin = narrow ? '' : '0 auto 30px'; }
    svg.style.width  = narrow ? '100%' : side + 'px';
    svg.style.height = 'auto';          /* square viewBox => square box */
    svg.style.aspectRatio = '';
    svg.style.maxWidth = '100%';
    svg.style.margin = '0 auto';
    svg.style.display = 'block';
  } else {
    svg.setAttribute('viewBox', `0 0 ${MAPW} ${MAPH}`);
    if(box){ box.style.maxWidth=''; box.style.margin=''; }
    svg.style.aspectRatio=''; svg.style.width='100%'; svg.style.height='auto';
    svg.style.maxWidth=''; svg.style.margin=''; svg.style.display='block';
  }
}

function renderMap(){
  const globe = GL.mode==='globe';
  document.getElementById('ocean').style.display = globe ? '' : 'none';
  document.getElementById('gGrid').style.display = globe ? '' : 'none';
  gridPaths.forEach(g => g.el.setAttribute('d', lineOf(g.pts,false)));
  if(ctyPaths.length){
    for(const c of ctyPaths){
      for(let i=0;i<c.rings.length;i++) c.paths[i].setAttribute('d', lineOf(c.rings[i], true));
    }
  } else {
    LANDRINGS.forEach((ring,i) => landPaths[i].setAttribute('d', lineOf(ring,true)));
  }
  arcs.forEach(a => {
    if(globe){
      const [f,b] = lineOfSplit(a.pts);
      a.el.setAttribute('d', f);
      a.elB.setAttribute('d', b);
      a.elB.style.display = a.el.classList.contains('on') ? '' : 'none';
    } else {
      a.el.setAttribute('d', lineOf(a.pts,false));
      a.elB.setAttribute('d','');
    }
  });
  document.getElementById('gBack').style.display = globe ? '' : 'none';
  for(const k in nodes){
    const n = nodes[k];
    const [x,y,vis] = proj(n.c[0], n.c[1]);
    n.x=x; n.y=y;
    n.el.setAttribute('cx',r1(x)); n.el.setAttribute('cy',r1(y));
    n.el.style.display = vis ? '' : 'none';
  }
}

/* --- turn the globe, smoothly --- */
let spinRAF = 0, CAM = null, camLock = 0, AUTOCAM = true, AUTOZOOM = true, PLAYING = false, autoBtn = null;
/* The camera is a TARGET the globe eases toward every frame, not a fixed-length
   tween. Re-aiming on every day tick used to restart the tween, so the easing
   never got off the starting block and the globe looked frozen. (2026-11-02) */
function aimAt(lat,lon,ms=1100,z,kind='arc'){
  if(GL.mode!=='globe' || REDUCED) return;
  if(!AUTOCAM) return;
  const now = performance.now();
  if(kind==='day' && now < camLock) return;       // a leg in flight owns the camera for a beat
  if(kind==='arc') camLock = now + ms;
  const z1 = (!AUTOZOOM || z==null) ? GL.z : Math.max(1, Math.min(ZMAX, z));
  CAM = { lam: lon,
          phi: Math.max(-62, Math.min(62, lat*0.85)),
          z: z1,
          k: kind==='arc' ? 0.055 : 0.075 };
  runTween();
}
/* point the camera at wherever he woke up on day idx */
let aimCC = null;
function aimDay(idx, ms){
  const d = D.days[idx]; if(!d) return;
  const pos = DAYPOS[idx];
  let z = null;
  const cc = (d.ccs||[])[0];
  if(cc && cc!=='SEA'){
    const c = ctyPaths.find(x => x.cc === cc);
    if(c){
      let laMin=90,laMax=-90,loMin=180,loMax=-180;
      for(const r of c.rings){ for(const pt of r){
        laMin=Math.min(laMin,pt[0]); laMax=Math.max(laMax,pt[0]);
        loMin=Math.min(loMin,pt[1]); loMax=Math.max(loMax,pt[1]);
      } }
      const span = Math.max(laMax-laMin, (loMax-loMin)*Math.cos(((laMin+laMax)/2)*R));
      z = zForSpan(span*2.1);
    }
  } else { z = 1.6; }            /* mid-ocean: pull back a bit, there is no coastline to frame */
  if(pos) aimAt(pos[0], pos[1], ms || 420, z, 'day');
  aimCC = cc;
}
/* frame something that spans `deg` degrees of arc */
const ZMAX = 7;
function zForSpan(deg){ return Math.max(1, Math.min(ZMAX, 95/Math.max(11, deg))); }
function angDist(a,b){
  const [la1,lo1]=[a[0]*R,a[1]*R], [la2,lo2]=[b[0]*R,b[1]*R];
  return 2*Math.asin(Math.sqrt(Math.sin((la2-la1)/2)**2 + Math.cos(la1)*Math.cos(la2)*Math.sin((lo2-lo1)/2)**2))/R;
}
function runTween(){
  cancelAnimationFrame(spinRAF);
  const loop = () => {
    let busy = false;
    if(CAM){
      const dl = ((CAM.lam - GL.lam + 540) % 360) - 180;
      const dp = CAM.phi - GL.phi, dz = CAM.z - GL.z;
      if(Math.abs(dl) > 0.06 || Math.abs(dp) > 0.06 || Math.abs(dz) > 0.003){
        GL.lam = ((GL.lam + dl*CAM.k) + 540) % 360 - 180;
        GL.phi = Math.max(-78, Math.min(78, GL.phi + dp*CAM.k));
        if(Math.abs(dz) > 0.003){ GL.z = Math.max(1, Math.min(ZMAX, GL.z + dz*CAM.k)); fitMap(); }
        busy = true;
      } else { CAM = null; }
    }
    if(GL.spin && !CAM && !PLAYING){ GL.lam = (GL.lam + GL.rate + 540)%360 - 180; busy = true; }
    renderMap();
    if(busy) spinRAF = requestAnimationFrame(loop);
  };
  spinRAF = requestAnimationFrame(loop);
}

/* which countries are lit right now */
function setHot(ccs){
  const key = ccs.join(',');
  if(key === hotCCs.join(',')) return;
  hotCCs = ccs.slice();
  ctyPaths.forEach(c => c.g.classList.toggle('hot', ccs.includes(c.cc)));
}

/* floating label so you can tell where a dot is heading */
function tagMove(m){
  if(REDUCED) return;
  const NS='http://www.w3.org/2000/svg';
  const g = $('#gLive');
  const t = document.createElementNS(NS,'text');
  t.setAttribute('class','movetag');
  t.textContent = (m.bl || '').split(',')[0];
  g.appendChild(t);
  const k = m.b[0].toFixed(2)+','+m.b[1].toFixed(2);
  const place = () => {
    const n = nodes[k]; if(!n) return;
    t.setAttribute('x', n.x + 9); t.setAttribute('y', n.y - 9);
  };
  place();
  const iv = setInterval(place, 60);
  setTimeout(()=>{ clearInterval(iv); t.remove(); }, 2600);
}

let GRABBED = false;
function mapControls(){
  const lg = document.querySelector('.maplegend');
  if(!lg || document.getElementById('mapBtns')) return;
  const box = el('span','mapbtns');
  box.id = 'mapBtns';
  const mk = (label,title,on,fn)=>{
    const b = document.createElement('button');
    b.textContent = label; b.title = title; b.className = 'mb' + (on?' on':'');
    b.addEventListener('click',()=>{ fn(b); });
    box.appendChild(b); return b;
  };
  const bG = mk('GLOBE','Orthographic globe. Nothing wraps off the edge.', true, b=>{
    GL.mode = GL.mode==='globe' ? 'flat' : 'globe';
    b.textContent = GL.mode==='globe' ? 'GLOBE' : 'FLAT';
    b.classList.toggle('on', GL.mode==='globe');
    renderMap();
  });
  mk('SPIN','Idle rotation', true, b=>{
    GL.spin = !GL.spin; b.classList.toggle('on', GL.spin);
    if(GL.spin) runTween();
  });
  autoBtn = mk('AUTO','Camera follows the action and zooms to the country', true, b=>{
    AUTOCAM = !AUTOCAM; b.classList.toggle('on', AUTOCAM);
    AUTOZOOM = AUTOCAM;
    if(AUTOCAM){ GL.z = 1; fitMap(); renderMap(); syncMap(+$('#scrub').value); aimDay(+$('#scrub').value, 700); }
  });
  mk('＋','Zoom in', false, ()=>zoom(1.35));
  mk('－','Zoom out', false, ()=>zoom(1/1.35));
  lg.appendChild(box);

  /* Nicholas 2026-11-02: this used to swallow every wheel event over the map.
     Scrolling the page down to the player therefore zoomed the globe AND killed
     the auto-camera, which is why it stopped following. Now the wheel only
     zooms once you've actually grabbed the globe (or hold shift). */
  document.getElementById('map').addEventListener('wheel', e=>{
    if(GL.mode!=='globe') return;
    if(!GRABBED && !e.shiftKey) return;            // let the page scroll
    e.preventDefault(); zoom(e.deltaY < 0 ? 1.12 : 1/1.12);
  }, {passive:false});

  /* drag to rotate */
  const svg = document.getElementById('map');
  let drag = null;
  /* arming the drag no longer kills the auto-camera on contact: a touch has to
     actually travel (and travel sideways) before it counts as grabbing the globe,
     otherwise swiping PAST the map on a phone silently turned follow-mode off. */
  const down = e => {
    if(GL.mode!=='globe') return;
    const t = e.touches?e.touches[0]:e;
    drag = { x:t.clientX, y:t.clientY, lam:GL.lam, phi:GL.phi, live:!e.touches };
    if(drag.live) grab();
  };
  const grab = () => {
    GRABBED = true; AUTOCAM = false; AUTOZOOM = false;
    if(autoBtn) autoBtn.classList.remove('on');
    svg.classList.add('grabbing');
  };
  const move = e => {
    if(!drag) return;
    const t = e.touches?e.touches[0]:e;
    const dx = t.clientX-drag.x, dy = t.clientY-drag.y;
    if(!drag.live){
      if(Math.hypot(dx,dy) < 8) return;            // still just a tap
      if(Math.abs(dy) > Math.abs(dx)){ drag = null; return; }  // vertical = scroll the page
      drag.live = true; grab();
    }
    const k = 0.32 * (FRAME / svg.getBoundingClientRect().width) / GL.z;
    GL.lam = ((drag.lam - dx*k) + 540)%360 - 180;
    GL.phi = Math.max(-78, Math.min(78, drag.phi + dy*k));
    CAM = null; renderMap();
    if(e.cancelable) e.preventDefault();
  };
  const up = () => { drag=null; svg.classList.remove('grabbing'); };
  svg.addEventListener('mousedown',down); addEventListener('mousemove',move); addEventListener('mouseup',up);
  svg.addEventListener('touchstart',down,{passive:true}); svg.addEventListener('touchmove',move,{passive:false}); addEventListener('touchend',up);
}

function zoom(f){
  GL.z = Math.max(1, Math.min(ZMAX, GL.z * f));
  AUTOZOOM = false;                 /* your zoom sticks, the camera keeps following */
  fitMap(); renderMap();
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
/* a plane for flights, a ship for cruises, a train for rail — not a dot
   (Nicholas 2026-11-01) */
const GLYPH = { f:'\u2708', c:'\uD83D\uDEF3', r:'\uD83D\uDE86', b:'\uD83D\uDE8C' };
/* How long a leg takes to cross the screen. A 300-mile hop should snap; a
   Pacific crossing should take its time. Length-scaled instead of a flat 1.5s
   for everything, and it rides the playback speed. (Nicholas 2026-11-02) */
function legMs(deg){
  const base = 620 + Math.pow(Math.max(0,deg), 0.85) * 62;   // 5deg~0.9s, 60deg~2.7s, 160deg~5.2s
  const scale = PLAYING ? Math.max(0.5, Math.min(1.6, speed/70)) : 1;
  return Math.round(Math.max(600, Math.min(5200, base)) * scale);
}
let animSeq = 0;
/* The glyph flies AND the line draws itself behind it, over the same clock. */
function comet(path, type, dur){
  if(REDUCED) return;
  const NS='http://www.w3.org/2000/svg';
  let len = 0; try{ len = path.getTotalLength(); }catch(e){}
  if(!len) return;
  const g = document.createElementNS(NS,'text');
  g.setAttribute('class','vehicle v-'+(type||'f'));
  g.textContent = GLYPH[type] || GLYPH.f;
  $('#gLive').appendChild(g);
  const mine = ++animSeq;
  path.dataset.anim = mine;
  const clear = () => { if(+path.dataset.anim === mine){ path.style.strokeDasharray=''; path.style.strokeDashoffset=''; } };
  const t0 = performance.now();
  dur = dur || 1500;
  const step = t => {
    const f = Math.min(1,(t-t0)/dur);
    const e = f<.5 ? 2*f*f : 1-Math.pow(-2*f+2,2)/2;      // leave gently, arrive gently
    let L, p, q;
    try{
      L = path.getTotalLength();
      if(!L){ g.remove(); clear(); return; }
      p = path.getPointAtLength(L*e);
      q = path.getPointAtLength(Math.min(L, L*e + Math.max(1, L*0.02)));
    }catch(err){ g.remove(); clear(); return; }
    if(+path.dataset.anim === mine){
      path.style.strokeDasharray = L;
      path.style.strokeDashoffset = L*(1-e);
    }
    const ang = Math.atan2(q.y-p.y, q.x-p.x) * 180/Math.PI;
    const rot = (type==='f') ? ang + 45 : 0;        /* the plane glyph points NE */
    g.setAttribute('transform', `translate(${p.x},${p.y}) rotate(${rot})`);
    g.setAttribute('opacity', f<.08 ? f/.08 : (f>.94 ? (1-f)/.06 : 1));
    if(f<1) requestAnimationFrame(step); else { g.remove(); clear(); }
  };
  requestAnimationFrame(step);
}

let lastIdx = -1;
function syncMap(idx, animate){
  if(!mapReady) return;
  let flew = false;
  const upto = D.days[idx] ? D.days[idx].d : D.today;
  let f=0,c=0,r=0;
  arcs.forEach(a=>{
    const on = a.m.d <= upto;
    if(on !== a.el.classList.contains('on')){
      a.el.classList.toggle('on', on);
      if(on && animate){
        const span = angDist(a.m.a, a.m.b);
        const dur = legMs(span);
        a.el.classList.add('hot'); setTimeout(()=>a.el.classList.remove('hot'), dur+260);
        const mid = gcMid(a.m.a, a.m.b);
        flew = true;
        /* the camera lock stays short even on a 5s crossing, or the day-by-day
           follow would sit blocked for dozens of ticks */
        aimAt(mid[0], mid[1], Math.min(1100, dur), zForSpan(span * 1.45), 'arc');
        comet(a.el, a.m.t, dur);
        const k = a.m.b[0].toFixed(2)+','+a.m.b[1].toFixed(2);
        if(nodes[k]) ping(nodes[k].x, nodes[k].y);
        tagMove(a.m);
      }
    }
    if(on){ a.el.classList.remove('hot'); if(a.m.t==='f')f++; else if(a.m.t==='c')c++; else r++; }
  });
  arcs.forEach(a=>{ if(a.m.d<=upto){ const k1=a.m.a[0].toFixed(2)+','+a.m.a[1].toFixed(2), k2=a.m.b[0].toFixed(2)+','+a.m.b[1].toFixed(2);
    if(nodes[k1]) nodes[k1].el.classList.add('on'); if(nodes[k2]) nodes[k2].el.classList.add('on'); } });
  $('#nFl').textContent=f; $('#nCr').textContent=c; $('#nRl').textContent=r;
  const d = D.days[idx];
  $('#mapNow').textContent = d ? (d.city ? d.city : (d.ccs[0] ? nameOf(d.ccs[0]) : '')) : '';
  if(d){
    setHot(d.ccs || []);
    if(!flew) aimDay(idx, PLAYING ? Math.max(220, speed*5) : 700);
  }
  lastIdx = idx;
}

/* ---------------- player ---------------- */
let timer=null, speed=70;   // default 1x (Nicholas 2026-11-01)
function wire(){
  const btn = $('#playBtn'), scrub = $('#scrub');
  function stop(){ clearInterval(timer); timer=null; PLAYING=false; btn.classList.remove('playing'); btn.innerHTML='▶<span>Play the year</span>'; }
  btn.addEventListener('click',()=>{
    if(timer){ stop(); return; }
    btn.classList.add('playing'); btn.innerHTML = '❚❚<span>Pause</span>';
    PLAYING = true;
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
