/* ============================================================
   HCS Årshjul – statisk HTML, ingen backend.
   Offentlig visning uden login; redigering kræver login (admin).
   Adgangskoder ligger kun som saltet SHA-256-hash i *-users.json.
   ============================================================ */

const MONTHS = ['jan','feb','mar','apr','maj','jun','jul','aug','sep','okt','nov','dec'];
const MONTH_NAME = {jan:'Januar',feb:'Februar',mar:'Marts',apr:'April',maj:'Maj',jun:'Juni',jul:'Juli',aug:'August',sep:'September',okt:'Oktober',nov:'November',dec:'December'};
const MONTH_COLOR = {jan:'#3498db',feb:'#95a5a6',mar:'#1abc9c',apr:'#2ecc71',maj:'#f39c12',jun:'#f1c40f',jul:'#e67e22',aug:'#e74c3c',sep:'#c0392b',okt:'#e67e22',nov:'#c0392b',dec:'#8e44ad'};
const SESSION_TTL_MS = 30*60*1000;

const state = {
  customer: null, customers: [], year: null, data: {title:'', activities:[]},
  session: null, chart: null, editingId: null, openMonth: null,
};
const $ = id => document.getElementById(id);

/* ---------------- Helpers ---------------- */
async function sha256Hex(str){
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
async function fetchJSON(path){
  const res = await fetch(path, {cache:'no-store'});
  if(!res.ok) throw new Error('Kunne ikke hente ' + path);
  return res.json();
}
const sleep = ms => new Promise(r=>setTimeout(r,ms));
function el(tag, props={}, ...kids){
  const e = Object.assign(document.createElement(tag), props);
  kids.forEach(k=>e.append(k));
  return e;
}
const isAdmin = () => !!state.session && (state.session.role==='admin' || state.session.role==='superadmin');

/* ---------------- Session (kun denne fane) ---------------- */
function loadSession(){
  try{
    const s = JSON.parse(sessionStorage.getItem('session'));
    if(s && s.expires > Date.now()) return s;
  }catch{}
  sessionStorage.removeItem('session');
  return null;
}
function saveSession(){
  try{ sessionStorage.setItem('session', JSON.stringify(state.session)); }catch{}
}
function touchSession(){
  if(!state.session) return;
  state.session.expires = Date.now() + SESSION_TTL_MS;
  saveSession();
}
function startSession(username, role){
  state.session = {customerId: state.customer.id, username, role, expires: Date.now()+SESSION_TTL_MS};
  saveSession();
}
function endSession(){
  state.session = null;
  try{ sessionStorage.removeItem('session'); }catch{}
}
['mousemove','keydown','click','touchstart'].forEach(ev=>document.addEventListener(ev, touchSession, {passive:true}));
setInterval(()=>{
  if(state.session && Date.now() > state.session.expires){ endSession(); renderAll(); }
}, 5000);

/* ---------------- Login ---------------- */
function lockKey(user){ return `lockout:${state.customer.id}:${user.toLowerCase()}`; }
function getLock(user){
  try{ return JSON.parse(sessionStorage.getItem(lockKey(user))) || {fails:0, until:0}; }
  catch{ return {fails:0, until:0}; }
}
function setLock(user, v){ try{ sessionStorage.setItem(lockKey(user), JSON.stringify(v)); }catch{} }

function showLogin(){
  $('loginError').innerHTML = '';
  $('loginForm').reset();
  $('loginOverlay').classList.remove('hidden');
  $('lUser').focus();
}
function hideLogin(){ $('loginOverlay').classList.add('hidden'); }

async function onLogin(e){
  e.preventDefault();
  const username = $('lUser').value.trim();
  const password = $('lPass').value;
  const box = $('loginError');
  const showErr = msg => { box.replaceChildren(el('div', {className:'error', textContent:msg})); };
  box.innerHTML = '';

  const lock = getLock(username);
  if(lock.until > Date.now()){
    showErr(`For mange forsøg. Prøv igen om ${Math.ceil((lock.until-Date.now())/1000)} sekunder.`);
    return;
  }
  $('loginSubmit').disabled = true;
  try{
    await sleep(250 * (lock.fails||0));
    const [cu, gu] = await Promise.all([
      fetchJSON(`${state.customer.id}-users.json`).catch(()=>({users:[]})),
      fetchJSON('admin-users.json').catch(()=>({users:[]}))
    ]);
    let match = null;
    for(const u of [...cu.users, ...gu.users]){
      if(u.username.toLowerCase() === username.toLowerCase() && await sha256Hex(u.salt+':'+password) === u.hash){
        match = u; break;
      }
    }
    if(!match){
      const fails = (lock.fails||0)+1;
      setLock(username, {fails, until: fails>=5 ? Date.now()+60000 : 0});
      showErr('Forkert brugernavn eller adgangskode.');
      return;
    }
    setLock(username, {fails:0, until:0});
    startSession(match.username, match.role);
    hideLogin();
    renderAll();
  }catch(err){
    showErr(err.message);
  }finally{
    $('loginSubmit').disabled = false;
  }
}

/* ---------------- Data ---------------- */
async function loadYear(){
  $('loadError').innerHTML = '';
  try{
    state.data = await fetchJSON(`${state.customer.id}-${state.year}.json`);
  }catch{
    state.data = {title:`${state.customer.shortName||state.customer.name} Årshjul ${state.year}`, activities:[]};
  }
  state.data.activities = state.data.activities || [];
  state.openMonth = null;
  state.editingId = null;
  renderAll();
}

/* ---------------- Rendering ---------------- */
function renderAll(){
  const admin = isAdmin();
  const name = state.customer.shortName || state.customer.name;
  $('pageTitle').textContent = `📅 ${name} Årshjul ${state.year}`;
  $('roleBadge').textContent = admin ? 'Admin' : 'v5.0';
  $('loginBtn').classList.toggle('hidden', !!state.session);
  $('logoutBtn').classList.toggle('hidden', !state.session);
  $('adminPanel').classList.toggle('hidden', !admin);
  $('subtitle').textContent = admin
    ? 'Klik på en måned eller aktivitet for at se detaljer'
    : '💡 Klik på en måned for at se dens aktiviteter';
  $('footerNote').textContent = state.customer.name;
  renderWheel();
  renderDetails();
  if(admin){ renderActivityList(); updateDatePreview(); }
}

function buildChartData(){
  const monthLabels = [], monthData = [], monthColors = [];
  const actData = [], actColors = [], actInfo = [];
  MONTHS.forEach(m=>{
    const list = state.data.activities.filter(a=>a.month===m);
    monthLabels.push(MONTH_NAME[m].toUpperCase().slice(0,3));
    monthData.push(list.length || 1);
    monthColors.push(MONTH_COLOR[m]);
    if(list.length){
      list.forEach(a=>{ actData.push(1); actColors.push(MONTH_COLOR[m]); actInfo.push({month:m, activity:a}); });
    }else{
      actData.push(1); actColors.push(MONTH_COLOR[m]); actInfo.push({month:m, activity:null});
    }
  });
  return {monthLabels, monthData, monthColors, actData, actColors, actInfo};
}

function renderWheel(){
  if(typeof Chart === 'undefined'){
    $('loadError').replaceChildren(el('div', {className:'error', textContent:'Kunne ikke indlæse Chart.js (tjek internetforbindelsen).'}));
    return;
  }
  if(Chart.registry && !Chart.registry.plugins.get('datalabels') && window.ChartDataLabels) Chart.register(ChartDataLabels);
  const d = buildChartData();
  if(state.chart) state.chart.destroy();
  state.chart = new Chart($('wheel').getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: d.monthLabels,
      datasets: [
        {
          label:'Aktiviteter', data:d.actData, backgroundColor:d.actColors, borderWidth:1, borderColor:'#fff', weight:2,
          datalabels:{
            color:'#fff', font:{size:8},
            formatter:(v,ctx)=>{
              const a = d.actInfo[ctx.dataIndex].activity;
              if(!a) return '';
              return a.name.length>12 ? a.name.slice(0,10)+'..' : a.name;
            }
          }
        },
        {
          label:'Måneder', data:d.monthData, backgroundColor:d.monthColors, borderWidth:2, borderColor:'#fff', weight:1,
          datalabels:{color:'#fff', font:{weight:'bold', size:14}, formatter:(v,ctx)=>ctx.chart.data.labels[ctx.dataIndex]}
        }
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:true,
      plugins:{
        legend:{display:false},
        tooltip:{callbacks:{
          title:()=>'',
          label:ctx=>{
            if(ctx.datasetIndex===1){
              const m = MONTHS[ctx.dataIndex];
              const n = state.data.activities.filter(a=>a.month===m).length;
              return `${MONTH_NAME[m]}: ${n} aktivitet${n!==1?'er':''}`;
            }
            const info = d.actInfo[ctx.dataIndex];
            if(!info.activity) return '';
            const a = info.activity;
            return a.date ? `${MONTH_NAME[info.month]}: ${a.name} (${a.date})` : `${MONTH_NAME[info.month]}: ${a.name}`;
          }
        }}
      },
      onClick:(evt, elements)=>{
        if(!elements.length) return;
        const {datasetIndex, index} = elements[0];
        state.openMonth = datasetIndex===1 ? MONTHS[index] : d.actInfo[index].month;
        renderDetails();
        $('monthDetails').scrollIntoView({behavior:'smooth', block:'nearest'});
      }
    }
  });
}

function renderDetails(){
  const box = $('monthDetails');
  const m = state.openMonth;
  if(!m){ box.classList.add('hidden'); return; }
  $('detailsMonthName').textContent = MONTH_NAME[m];
  $('detailsMonthName').style.color = MONTH_COLOR[m];
  const list = $('detailsList');
  list.replaceChildren();
  const items = state.data.activities.filter(a=>a.month===m);
  if(!items.length){
    list.append(el('p', {textContent:'Ingen aktiviteter for denne måned', style:'text-align:center;color:#666'}));
  }
  items.forEach(a=>{
    const h = el('h4', {}, el('span', {textContent:a.name}));
    if(a.date){
      h.append(el('button', {className:'btn-calendar', textContent:'📅 Hent kalender', onclick:()=>downloadICS(a)}));
    }
    const meta = [];
    if(a.date) meta.push(`📅 Dato: ${a.date}`);
    if(a.responsible) meta.push(`👤 Ansvarlig: ${a.responsible}`);
    if(a.notes) meta.push(`💬 Bemærkninger: ${a.notes}`);
    const item = el('div', {className:'detail-item'}, h, el('div', {className:'detail-meta', textContent:meta.join('\n')}));
    item.style.borderLeftColor = MONTH_COLOR[m];
    list.append(item);
  });
  box.classList.remove('hidden');
}

/* ---------------- Admin: redigering ---------------- */
function updateDatePreview(){
  const day = $('fDay').value, m = $('fMonth').value;
  const p = $('datePreview');
  p.textContent = day ? `${day}/${MONTHS.indexOf(m)+1}` : '--/--';
  p.style.color = day ? MONTH_COLOR[m] : '#666';
}
function renderActivityList(){
  const list = $('activityList');
  list.replaceChildren();
  if(!state.data.activities.length){
    list.append(el('p', {textContent:'Ingen aktiviteter endnu', style:'text-align:center;color:#666'}));
    return;
  }
  MONTHS.forEach(m=>{
    const items = state.data.activities.filter(a=>a.month===m);
    if(!items.length) return;
    list.append(el('h4', {textContent:MONTH_NAME[m], style:`color:${MONTH_COLOR[m]};margin:20px 0 10px`}));
    items.forEach(a=>{
      const meta = [];
      if(a.date) meta.push(`📅 ${a.date}`);
      if(a.responsible) meta.push(`👤 ${a.responsible}`);
      if(a.notes) meta.push(`💬 ${a.notes}`);
      const info = el('div', {style:'flex:1'}, el('strong', {textContent:a.name}));
      if(meta.length) info.append(el('div', {className:'activity-meta', textContent:meta.join(' | ')}));
      const btns = el('div', {className:'activity-buttons'},
        el('button', {className:'btn-small btn-success', textContent:'✏️ Rediger', onclick:()=>startEdit(a.id)}),
        el('button', {className:'btn-small btn-danger', textContent:'🗑️ Slet', onclick:()=>deleteActivity(a.id)}));
      const row = el('div', {className:'activity-item'}, info, btns);
      row.style.borderLeftColor = MONTH_COLOR[m];
      list.append(row);
    });
  });
}
function flash(msg){
  const box = $('successMessage');
  box.textContent = msg;
  box.classList.remove('hidden');
  setTimeout(()=>box.classList.add('hidden'), 4000);
}
function clearForm(){
  $('fMonth').value = 'jan'; $('fName').value = ''; $('fDay').value = '';
  $('fResp').value = ''; $('fNotes').value = '';
  state.editingId = null;
  $('addBtn').classList.remove('hidden');
  $('updateBtn').classList.add('hidden');
  $('cancelBtn').classList.add('hidden');
  updateDatePreview();
}
function readForm(){
  const month = $('fMonth').value;
  const name = $('fName').value.trim();
  if(!name){ alert('Aktivitetsnavn er påkrævet.'); return null; }
  const day = parseInt($('fDay').value, 10);
  const date = day ? `${day}/${MONTHS.indexOf(month)+1}` : '';
  return {month, name, date, responsible:$('fResp').value.trim(), notes:$('fNotes').value.trim()};
}
function addActivity(){
  const a = readForm(); if(!a) return;
  a.id = 'a' + Date.now();
  state.data.activities.push(a);
  clearForm(); renderAll(); flash('✅ Aktivitet tilføjet');
}
function startEdit(id){
  const a = state.data.activities.find(x=>x.id===id); if(!a) return;
  state.editingId = id;
  $('fMonth').value = a.month; $('fName').value = a.name;
  $('fDay').value = (a.date||'').split('/')[0] || '';
  $('fResp').value = a.responsible||''; $('fNotes').value = a.notes||'';
  $('addBtn').classList.add('hidden');
  $('updateBtn').classList.remove('hidden');
  $('cancelBtn').classList.remove('hidden');
  updateDatePreview();
  $('adminPanel').scrollIntoView({behavior:'smooth'});
}
function updateActivity(){
  const a = readForm(); if(!a) return;
  const cur = state.data.activities.find(x=>x.id===state.editingId); if(!cur) return;
  Object.assign(cur, a);
  clearForm(); renderAll(); flash('✅ Aktivitet opdateret');
}
function deleteActivity(id){
  if(!confirm('Slet denne aktivitet?')) return;
  state.data.activities = state.data.activities.filter(x=>x.id!==id);
  renderAll(); flash('✅ Aktivitet slettet');
}

/* ---------------- Filer ---------------- */
async function downloadJSON(obj, filename){
  const json = JSON.stringify(obj, null, 2);
  if(window.showSaveFilePicker){
    try{
      const handle = await window.showSaveFilePicker({suggestedName:filename, types:[{description:'JSON', accept:{'application/json':['.json']}}]});
      const w = await handle.createWritable();
      await w.write(json); await w.close();
      return true;
    }catch(err){
      if(err && err.name==='AbortError') return false;
    }
  }
  const a = el('a', {href:URL.createObjectURL(new Blob([json], {type:'application/json'})), download:filename});
  document.body.append(a); a.click(); a.remove();
  URL.revokeObjectURL(a.href);
  return true;
}
async function saveYear(){
  if(await downloadJSON(state.data, `${state.customer.id}-${state.year}.json`)) flash('✅ Filen er gemt – kør publicer.bat for at udgive');
}
async function addYear(){
  const year = (prompt('Hvilket årstal vil du tilføje?') || '').trim();
  if(!/^\d{4}$/.test(year)) return;
  if(state.customer.years.includes(year)){ alert('Året findes allerede.'); return; }
  const blank = {title:`${state.customer.shortName||state.customer.name} Årshjul ${year}`, activities:[]};
  if(!await downloadJSON(blank, `${state.customer.id}-${year}.json`)) return;
  state.customer.years.push(year);
  state.customer.years.sort();
  await downloadJSON({customers:state.customers}, 'customers.json');
  fillYearSelect();
  alert('Gem begge filer i repo-mappen og kør publicer.bat.');
}
function downloadICS(a){
  const [day, month] = (a.date||'').split('/').map(n=>parseInt(n,10));
  if(!day || !month) return;
  const pad = n => String(n).padStart(2,'0');
  const d = `${state.year}${pad(month)}${pad(day)}`;
  const esc = s => String(s||'').replace(/[\\,;]/g, c=>'\\'+c).replace(/\n/g,'\\n');
  const ics = [
    'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//HCS//Aarshjul//DA','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT',
    `DTSTART;VALUE=DATE:${d}`, `SUMMARY:${esc(a.name)}`,
    `DESCRIPTION:${esc([a.notes, a.responsible && 'Ansvarlig: '+a.responsible].filter(Boolean).join('\n') || 'HCS aktivitet')}`,
    `LOCATION:${esc(state.customer.name)}`, 'STATUS:CONFIRMED', `UID:${d}-${a.id}@hcs-aarshjul`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').split('.')[0]}Z`, 'END:VEVENT','END:VCALENDAR'
  ].join('\r\n');
  const link = el('a', {href:URL.createObjectURL(new Blob([ics], {type:'text/calendar;charset=utf-8'})), download:`${a.name.replace(/[^a-zæøå0-9]+/gi,'_')}_${d}.ics`});
  document.body.append(link); link.click(); link.remove();
  URL.revokeObjectURL(link.href);
}

/* ---------------- Init ---------------- */
function fillYearSelect(){
  const years = state.customer.years && state.customer.years.length ? state.customer.years : [String(new Date().getFullYear())];
  $('yearSelect').replaceChildren(...years.map(y=>el('option', {value:y, textContent:y})));
  if(!years.includes(state.year)) state.year = years.includes(String(new Date().getFullYear())) ? String(new Date().getFullYear()) : years[0];
  $('yearSelect').value = state.year;
}

async function init(){
  $('loginBtn').addEventListener('click', showLogin);
  $('loginCancel').addEventListener('click', hideLogin);
  $('loginForm').addEventListener('submit', onLogin);
  $('logoutBtn').addEventListener('click', ()=>{ endSession(); renderAll(); });
  $('closeDetails').addEventListener('click', ()=>{ state.openMonth = null; renderDetails(); });
  $('yearSelect').addEventListener('change', e=>{ state.year = e.target.value; loadYear(); });
  $('fMonth').replaceChildren(...MONTHS.map(m=>el('option', {value:m, textContent:MONTH_NAME[m]})));
  $('fMonth').addEventListener('change', updateDatePreview);
  $('fDay').addEventListener('input', updateDatePreview);
  $('addBtn').addEventListener('click', addActivity);
  $('updateBtn').addEventListener('click', updateActivity);
  $('cancelBtn').addEventListener('click', clearForm);
  $('saveJsonBtn').addEventListener('click', saveYear);
  $('addYearBtn').addEventListener('click', addYear);

  try{
    state.customers = (await fetchJSON('customers.json')).customers || [];
  }catch{
    $('loadError').replaceChildren(el('div', {className:'error', textContent:'Kunne ikke indlæse customers.json. Siden skal køres via en webserver.'}));
    return;
  }
  const wanted = new URLSearchParams(location.search).get('kunde');
  state.customer = state.customers.find(c=>c.id===wanted) || state.customers[0];
  if(!state.customer) return;
  fillYearSelect();

  const s = loadSession();
  if(s && s.customerId === state.customer.id) state.session = s;
  await loadYear();
}
document.addEventListener('DOMContentLoaded', init);
