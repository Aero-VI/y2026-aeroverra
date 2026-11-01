/* 2026.aeroverra.com — year in motion */

const COLORS = {
  US:'#4f7cff', JP:'#ff4d6d', SEA:'#19d2e6', AU:'#ffc234', MT:'#ff7a45', ES:'#f5c518',
  GB:'#a78bfa', HU:'#22c55e', SG:'#ec4899', CH:'#ef4444', DK:'#e879f9', AT:'#38bdf8',
  ID:'#84cc16', SE:'#60a5fa', DE:'#fbbf24', BS:'#34d399', NO:'#818cf8', FI:'#f472b6',
  EE:'#2dd4bf', LV:'#fb7185', PL:'#c084fc', BE:'#facc15', RS:'#4ade80', MA:'#fb923c',
  CA:'#93c5fd', NL:'#fdba74', GI:'#f87171'
};
const KINDWORD = {
  flight:'in the air', hotel:'checked in', home:'home', cruise:'on a ship',
  port:'port call', sea:'at sea', rail:'on the rails', stay:'staying put'
};
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHSL = ['January','February','March','April','May','June','July','August','September','October','November','December'];

let D = null, META = {}, byDate = {}, isolate = null;

const $ = s => document.querySelector(s);
const el = (t,c,h) => { const e=document.createElement(t); if(c)e.className=c; if(h!==undefined)e.innerHTML=h; return e; };
const col = cc => COLORS[cc] || (cc ? hsl(cc) : '#242838');
function hsl(cc){ let h=0; for(const ch of cc) h=(h*31+ch.charCodeAt(0))%360; return `hsl(${h} 70% 60%)`; }
const dObj = s => new Date(s+'T12:00:00Z');
const pretty = s => { const d=dObj(s); return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getUTCDay()]+' '+d.getUTCDate()+' '+MONTHSL[d.getUTCMonth()]; };

fetch('data/year2026.json?v=6').then(r=>r.json()).then(data=>{
  D = data;
  D.countries.forEach(c => META[c.cc] = c);
  D.days.forEach(d => byDate[d.d] = d);
  heroStats(); buildRibbon(); buildLegend(); buildBoard('all'); buildMonths(); buildCards(); buildStreaks(); buildShips();
  $('#genline').textContent = 'Data current to 1 November 2026.';
  wire();
});

/* ---------------- hero ---------------- */
function heroStats(){
  const s = D.stats;
  const items = [
    [s.countries_total, 'countries'],
    [s.days_tracked, 'days mapped'],
    [s.days_abroad, 'days abroad'],
    [s.flights, 'flights'],
    [s.cruise_nights, 'nights at sea'],
    [s.switches, 'border hops']
  ];
  const box = $('#heroStats');
  items.forEach(([n,l],i)=>{
    const c = el('div','chip',`<b data-n="${n}">0</b><span>${l}</span>`);
    box.appendChild(c);
    countUp(c.querySelector('b'), n, 900 + i*110);
  });
}
function countUp(node, to, dur){
  const t0 = performance.now();
  const step = t => {
    const p = Math.min(1,(t-t0)/dur), e = 1-Math.pow(1-p,3);
    node.textContent = Math.round(to*e);
    if(p<1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ---------------- ribbon ---------------- */
let tiles = [];
function buildRibbon(){
  const rb = $('#ribbon'), mr = $('#monthRow');
  const first = dObj(D.days[0].d).getUTCDay();
  for(let i=0;i<first;i++) rb.appendChild(el('div','day blank'));

  D.days.forEach((d,idx)=>{
    const t = el('div','day');
    const cc = d.ccs[0];
    if(d.future){ t.classList.add('future'); }
    else if(cc){ t.style.background = col(cc); }
    t.dataset.i = idx;
    if(d.ccs[1]) t.style.background = `linear-gradient(135deg,${col(d.ccs[0])} 50%,${col(d.ccs[1])} 50%)`;
    t.addEventListener('mouseenter', e => { showTip(e,d); setReadout(idx,false); });
    t.addEventListener('mouseleave', hideTip);
    t.addEventListener('click', ()=>{ setReadout(idx,true); $('#scrub').value = idx; });
    rb.appendChild(t); tiles.push(t);
  });

  // month labels across 53 columns
  let col1 = Math.floor(first/7);
  const seen = {};
  D.days.forEach((d,idx)=>{
    const m = dObj(d.d).getUTCMonth();
    if(seen[m]===undefined) seen[m] = Math.floor((idx+first)/7);
  });
  for(let c=0;c<53;c++){
    const m = Object.keys(seen).find(k=>seen[k]===c);
    mr.appendChild(el('div','', m!==undefined ? MONTHS[m] : ''));
  }
  $('#scrub').max = D.days.length-1;
  const ti = D.days.findIndex(x=>x.d===D.today);
  if(ti>=0){ setReadout(ti,true); $('#scrub').value = ti; }
}

function setReadout(idx, lock){
  const d = D.days[idx];
  const cc = d.ccs[0];
  const m = META[cc] || {flag:'🗓️', name:'Unlogged'};
  const fe = $('#roFlag');
  const nf = d.future ? '🔮' : m.flag;
  if(fe.textContent !== nf){ fe.classList.remove('pop'); void fe.offsetWidth; fe.classList.add('pop'); }
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
  tiles.forEach(t=>t.classList.remove('now'));
  tiles[idx].classList.add('now');
}

/* ---------------- legend ---------------- */
function buildLegend(){
  const lg = $('#legend');
  D.countries.filter(c=>c.days>0).forEach(c=>{
    const b = el('div','lg',`<i style="background:${col(c.cc)}"></i>${c.flag} ${c.name} <b>${c.days}</b>`);
    b.addEventListener('click',()=>{
      isolate = (isolate===c.cc) ? null : c.cc;
      document.querySelectorAll('.lg').forEach(x=>x.classList.toggle('off', isolate && x!==b));
      tiles.forEach((t,i)=>{
        const d = D.days[i];
        t.classList.toggle('dim', !!isolate && !d.ccs.includes(isolate));
      });
    });
    lg.appendChild(b);
  });
}

/* ---------------- player ---------------- */
let timer=null, speed=28;
function wire(){
  const btn = $('#playBtn'), scrub = $('#scrub');
  btn.addEventListener('click',()=>{
    if(timer){ stop(); return; }
    btn.classList.add('playing'); btn.innerHTML = '❚❚<span>Pause</span>';
    const END = Math.max(1, D.days.findIndex(x=>x.d===D.today));
    let i = +scrub.value;
    if(i >= END) i = 0;
    timer = setInterval(()=>{
      setReadout(i,true); scrub.value = i;
      const t = tiles[i];
      if(i%7===0) t.scrollIntoView({block:'nearest',inline:'center',behavior:'smooth'});
      i++;
      if(i>END) stop();
    }, speed);
  });
  function stop(){ clearInterval(timer); timer=null; btn.classList.remove('playing'); btn.innerHTML='▶<span>Play the year</span>'; }
  scrub.addEventListener('input',()=>setReadout(+scrub.value,true));
  document.querySelectorAll('.sp').forEach(b=>b.addEventListener('click',()=>{
    document.querySelectorAll('.sp').forEach(x=>x.classList.remove('on'));
    b.classList.add('on'); speed = +b.dataset.sp;
    if(timer){ $('#playBtn').click(); $('#playBtn').click(); }
  }));
  document.querySelectorAll('.tg').forEach(b=>b.addEventListener('click',()=>{
    document.querySelectorAll('.tg').forEach(x=>x.classList.remove('on'));
    b.classList.add('on'); buildBoard(b.dataset.mode);
  }));
}

/* ---------------- leaderboard ---------------- */
function buildBoard(mode){
  const box = $('#board'); box.innerHTML='';
  let list = D.countries.slice();
  if(mode==='nonus') list = list.filter(c=>c.cc!=='US');
  if(mode==='land')  list = list.filter(c=>c.cc!=='SEA');
  const max = Math.max(...list.map(c=>c.days));
  const denom = D.stats.days_tracked;
  list.forEach((c,i)=>{
    const r = el('div','row');
    r.innerHTML = `<div class="fl">${c.flag}</div>
      <div class="bar"><div class="fill" style="background:linear-gradient(90deg,${col(c.cc)},${col(c.cc)}99)"></div>
      <div class="nm">${c.name}</div></div>
      <div class="vl">${c.days}<s>${(c.days/denom*100).toFixed(0)}%</s></div>`;
    box.appendChild(r);
    const fill = r.querySelector('.fill');
    setTimeout(()=>{ fill.style.width = Math.max(4, c.days/max*100)+'%'; }, 40+i*35);
  });
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
      s.title = `${(META[cc]||{name:cc}).name}: ${n}`;
      bars.appendChild(s);
    });
    mo.appendChild(bars);
    mo.appendChild(el('div','n', land||'—'));
    mo.appendChild(el('div','lb', MONTHS[m]));
    rail.appendChild(mo);
  }
}

/* ---------------- cards ---------------- */
function buildCards(){
  const s = D.stats, box = $('#cards');
  const longest = s.longest_runs[0];
  const nonUs = s.longest_runs.find(r=>r.cc!=='US');
  const add = (h)=>{ const c=el('div','card',h); box.appendChild(c); };

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
       <div class="sub">days in the United States versus days on foreign soil. ${s.days_untracked===0?'Every day':(304)+' of 305 days'}
       is accounted for by a booking.</div>`);
}

/* ---------------- streaks ---------------- */
function buildStreaks(){
  const box = $('#streaks'); if(!box) return;
  const multi = D.days.filter(d=>!d.future && d.ccs.length>1).length;
  const hop = D.days.filter(d=>!d.future && d.ccs.length>2).length;
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
  const t = $('#tip');
  const names = d.ccs.map(c=>(META[c]||{}).flag+' '+(META[c]||{name:c}).name).join(' → ') || 'no booking';
  t.innerHTML = `<b>${pretty(d.d)}</b>${names}${d.label?`<s>${d.label}</s>`:''}`;
  const r = e.target.getBoundingClientRect();
  t.style.left = r.left + r.width/2 + 'px';
  t.style.top = r.top + 'px';
  t.style.opacity = 1;
}
function hideTip(){ $('#tip').style.opacity = 0; }
