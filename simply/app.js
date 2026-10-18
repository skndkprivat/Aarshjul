/* ============================================================
   HCS Årshjul – serverversion (PHP-API på samme domæne).
   Hjulet er offentligt; admins logger ind og rettelser gemmes med det samme.
   ============================================================ */

const MONTHS = ['jan','feb','mar','apr','maj','jun','jul','aug','sep','okt','nov','dec'];
const MONTH_NAME = {jan:'Januar',feb:'Februar',mar:'Marts',apr:'April',maj:'Maj',jun:'Juni',jul:'Juli',aug:'August',sep:'September',okt:'Oktober',nov:'November',dec:'December'};
const MONTH_COLOR = {jan:'#3498db',feb:'#95a5a6',mar:'#1abc9c',apr:'#2ecc71',maj:'#f39c12',jun:'#f1c40f',jul:'#e67e22',aug:'#e74c3c',sep:'#c0392b',okt:'#e67e22',nov:'#c0392b',dec:'#8e44ad'};

const state = {
  customer: null, customers: [], year: null, data: {title:'', activities:[]}, version: null,
  user: null, csrf: null, chart: null, editingId: null, openMonth: null, saving: false,
};
const $ = id => document.getElementById(id);

/* ---------------- Hjælpere ---------------- */
function el(tag, props={}, ...kids){
  const e = Object.assign(document.createElement(tag), props);
  kids.forEach(k=>e.append(k));
  return e;
}
const isAdmin = () => !!state.user;

async function api(action, {method='GET', params={}, body}={}){
  const qs = new URLSearchParams({action, ...params});
  const headers = {};
  if(state.csrf) headers['X-CSRF-Token'] = state.csrf;
  if(body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`api.php?${qs}`, {
    method, headers, credentials:'same-origin', cache:'no-store',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try{ data = await res.json(); }catch{}
  if(!res.ok){
    if(res.status === 401 && state.user && action !== 'login') sessionLost();
    const err = new Error(data.error || `Fejl (${res.status})`);
    err.status = res.status; err.data = data;
    throw err;
  }
  return data;
}
function showError(msg){
  $('loadError').replaceChildren(el('div', {className:'error', textContent:msg}));
}
function sessionLost(){
  state.user = null; state.csrf = null;
  renderAll();
  showError('Du er blevet logget ud. Log ind igen for at fortsætte.');
}

/* ---------------- Login ---------------- */
function showLogin(){
  $('loginError').innerHTML = '';
  $('loginForm').reset();
  $('loginOverlay').classList.remove('hidden');
  $('lUser').focus();
}
function hideLogin(){ $('loginOverlay').classList.add('hidden'); }

async function onLogin(e){
  e.preventDefault();
  $('loginError').innerHTML = '';
  $('loginSubmit').disabled = true;
  try{
    const r = await api('login', {method:'POST', body:{username:$('lUser').value.trim(), password:$('lPass').value}});
    state.user = r.user; state.csrf = r.csrf;
    $('loadError').innerHTML = '';
    hideLogin();
    renderAll();
  }catch(err){
    $('loginError').replaceChildren(el('div', {className:'error', textContent:err.message}));
  }finally{
    $('loginSubmit').disabled = false;
    $('lPass').value = '';
  }
}
async function logout(){
  try{ await api('logout', {method:'POST'}); }catch{}
  state.user = null; state.csrf = null; state.editingId = null;
  renderAll();
}

/* ---------------- Data ---------------- */
async function loadYear(){
  $('loadError').innerHTML = '';
  try{
    const r = await api('year', {params:{customer:state.customer.id, year:state.year}});
    state.data = r.data; state.version = r.version;
  }catch(err){
    state.data = {title:'', activities:[]}; state.version = null;
    showError('Kunne ikke hente årshjulet: ' + err.message);
  }
  state.data.activities = state.data.activities || [];
  state.openMonth = null;
  state.editingId = null;
  renderAll();
}

/** Gem den aktuelle årsfil på serveren. Ved fejl rulles den lokale ændring tilbage. */
async function persist(before, okMsg){
  if(state.saving) return false;
  state.saving = true;
  try{
    const r = await api('save', {method:'POST', body:{customer:state.customer.id, year:state.year, baseVersion:state.version, data:state.data}});
    state.version = r.version;
    flash(okMsg || '✅ Gemt');
    return true;
  }catch(err){
    if(err.status === 409 && err.data && err.data.data){
      state.data = err.data.data; state.version = err.data.version;
      renderAll();
      alert('Årshjulet blev rettet af en anden, mens du arbejdede. De nyeste data er hentet – gentag din ændring.');
    }else if(err.status !== 401){
      state.data = before;
      renderAll();
      alert('Ændringen blev ikke gemt: ' + err.message);
    }
    return false;
  }finally{
    state.saving = false;
  }
}

/* ---------------- Rendering ---------------- */
function renderAll(){
  const admin = isAdmin();
  const name = state.customer.shortName || state.customer.name;
  $('pageTitle').textContent = `📅 ${name} Årshjul ${state.year}`;
  $('roleBadge').textContent = admin ? `Admin: ${state.user.username}` : 'v6.0';
  $('loginBtn').classList.toggle('hidden', admin);
  $('logoutBtn').classList.toggle('hidden', !admin);
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
  if(typeof Chart === 'undefined'){ showError('Kunne ikke indlæse diagram-biblioteket.'); return; }
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
  clearTimeout(flash.t);
  flash.t = setTimeout(()=>box.classList.add('hidden'), 3000);
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
  if($('fDay').value && !(day >= 1 && day <= 31)){ alert('Dagen skal være mellem 1 og 31.'); return null; }
  const date = day ? `${day}/${MONTHS.indexOf(month)+1}` : '';
  return {month, name, date, responsible:$('fResp').value.trim(), notes:$('fNotes').value.trim()};
}
async function addActivity(){
  const a = readForm(); if(!a) return;
  const before = structuredClone(state.data);
  a.id = 'a' + Date.now();
  state.data.activities.push(a);
  clearForm(); renderAll();
  await persist(before, '✅ Aktivitet tilføjet og gemt');
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
async function updateActivity(){
  const a = readForm(); if(!a) return;
  const cur = state.data.activities.find(x=>x.id===state.editingId); if(!cur) return;
  const before = structuredClone(state.data);
  Object.assign(cur, a);
  clearForm(); renderAll();
  await persist(before, '✅ Aktivitet opdateret og gemt');
}
async function deleteActivity(id){
  if(!confirm('Slet denne aktivitet?')) return;
  const before = structuredClone(state.data);
  state.data.activities = state.data.activities.filter(x=>x.id!==id);
  renderAll();
  await persist(before, '✅ Aktivitet slettet');
}

/* ---------------- Modaler ---------------- */
function closeModal(){ $('modalRoot').replaceChildren(); }
function openModal(title, ...content){
  const box = el('div', {className:'login-box', style:'max-width:540px;max-height:90vh;overflow:auto'},
    el('h2', {textContent:title}), ...content,
    el('button', {className:'btn-secondary', textContent:'Luk', onclick:closeModal, style:'margin-top:15px'}));
  const overlay = el('div', {className:'overlay'}, box);
  overlay.addEventListener('click', e=>{ if(e.target === overlay) closeModal(); });
  $('modalRoot').replaceChildren(overlay);
}
function field(label, props){
  return el('div', {className:'form-group'}, el('label', {textContent:label}), el('input', props));
}
function msgBox(){ return el('div'); }
function say(box, msg, ok=false){
  box.replaceChildren(el('div', {className: ok ? 'success-message' : 'error', textContent:msg}));
}

async function openUsers(){
  const listBox = el('div');
  const msg = msgBox();
  async function refresh(){
    try{
      const r = await api('users');
      listBox.replaceChildren(...r.users.map(u=>{
        const row = el('div', {className:'activity-item', style:'padding:10px 15px'}, el('strong', {textContent:u.username}));
        if(u.username.toLowerCase() !== state.user.username.toLowerCase()){
          row.append(el('button', {className:'btn-small btn-danger', style:'width:auto', textContent:'Slet', onclick:async()=>{
            if(!confirm(`Slet brugeren ${u.username}?`)) return;
            try{ await api('deleteUser', {method:'POST', body:{username:u.username}}); say(msg, 'Brugeren er slettet.', true); refresh(); }
            catch(err){ say(msg, err.message); }
          }}));
        }
        return row;
      }));
    }catch(err){ say(msg, err.message); }
  }
  const newUser = field('Brugernavn', {autocomplete:'off'});
  const newPass = field('Adgangskode (mindst 10 tegn)', {type:'password', autocomplete:'new-password'});
  const oldPass = field('Nuværende adgangskode', {type:'password', autocomplete:'current-password'});
  const chgPass = field('Ny adgangskode (mindst 10 tegn)', {type:'password', autocomplete:'new-password'});
  openModal('Brugere og adgangskode',
    msg,
    el('h3', {textContent:'Admin-brugere', style:'margin-bottom:10px'}), listBox,
    el('h3', {textContent:'Opret ny bruger', style:'margin:20px 0 10px'}),
    newUser, newPass,
    el('button', {textContent:'Opret bruger', onclick:async()=>{
      try{
        await api('createUser', {method:'POST', body:{username:newUser.querySelector('input').value.trim(), password:newPass.querySelector('input').value}});
        newUser.querySelector('input').value = ''; newPass.querySelector('input').value = '';
        say(msg, 'Brugeren er oprettet.', true); refresh();
      }catch(err){ say(msg, err.message); }
    }}),
    el('h3', {textContent:'Skift din egen adgangskode', style:'margin:25px 0 10px'}),
    oldPass, chgPass,
    el('button', {textContent:'Skift adgangskode', onclick:async()=>{
      try{
        await api('changePassword', {method:'POST', body:{oldPassword:oldPass.querySelector('input').value, newPassword:chgPass.querySelector('input').value}});
        oldPass.querySelector('input').value = ''; chgPass.querySelector('input').value = '';
        say(msg, 'Adgangskoden er ændret.', true);
      }catch(err){ say(msg, err.message); }
    }}));
  refresh();
}

function fmtHistoryTime(s){
  const m = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/.exec(s);
  if(!m) return s;
  return new Date(Date.UTC(+m[1], +m[2]-1, +m[3], +m[4], +m[5], +m[6])).toLocaleString('da-DK');
}
async function openHistory(){
  const listBox = el('div');
  const msg = msgBox();
  openModal(`Historik for ${state.year}`,
    el('p', {textContent:'De seneste versioner, før hver rettelse blev gemt. "Gendan" lægger versionen tilbage (og gemmer den nuværende i historikken).', style:'color:#666;font-size:.9em;margin-bottom:12px'}),
    msg, listBox);
  try{
    const r = await api('history', {params:{customer:state.customer.id, year:state.year}});
    if(!r.items.length) listBox.append(el('p', {textContent:'Ingen historik endnu.'}));
    r.items.forEach(it=>{
      listBox.append(el('div', {className:'activity-item', style:'padding:10px 15px'},
        el('div', {style:'flex:1'}, el('strong', {textContent:fmtHistoryTime(it.time)}), el('div', {className:'activity-meta', textContent:`${it.user} · ${it.count} aktiviteter`})),
        el('button', {className:'btn-small btn-success', style:'width:auto', textContent:'Gendan', onclick:async()=>{
          if(!confirm('Gendan denne version?')) return;
          try{
            const res = await api('restore', {method:'POST', body:{customer:state.customer.id, year:state.year, id:it.id}});
            state.data = res.data; state.version = res.version;
            renderAll(); closeModal(); flash('✅ Versionen er gendannet');
          }catch(err){ say(msg, err.message); }
        }})));
    });
  }catch(err){ say(msg, err.message); }
}

/* ---------------- Nyt år, backup, kalender ---------------- */
function fillYearSelect(){
  const years = (state.customer.years || []).map(String);
  const list = years.length ? years : [String(new Date().getFullYear())];
  $('yearSelect').replaceChildren(...list.map(y=>el('option', {value:y, textContent:y})));
  const now = String(new Date().getFullYear());
  if(!list.includes(state.year)) state.year = list.includes(now) ? now : list[0];
  $('yearSelect').value = state.year;
}
async function addYear(){
  const year = (prompt('Hvilket årstal vil du tilføje?') || '').trim();
  if(!year) return;
  if(!/^(19|20)\d{2}$/.test(year)){ alert('Skriv et årstal, fx 2027.'); return; }
  try{
    const r = await api('addYear', {method:'POST', body:{customer:state.customer.id, year}});
    state.customers = r.customers;
    state.customer = state.customers.find(c=>c.id===state.customer.id);
    fillYearSelect();
    flash(`✅ ${year} er tilføjet – vælg året i listen øverst`);
  }catch(err){ alert(err.message); }
}
function downloadBackup(){
  const a = el('a', {href:URL.createObjectURL(new Blob([JSON.stringify(state.data, null, 2)], {type:'application/json'})), download:`${state.customer.id}-${state.year}.json`});
  document.body.append(a); a.click(); a.remove();
  URL.revokeObjectURL(a.href);
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
async function init(){
  $('loginBtn').addEventListener('click', showLogin);
  $('loginCancel').addEventListener('click', hideLogin);
  $('loginForm').addEventListener('submit', onLogin);
  $('logoutBtn').addEventListener('click', logout);
  $('closeDetails').addEventListener('click', ()=>{ state.openMonth = null; renderDetails(); });
  $('yearSelect').addEventListener('change', e=>{ state.year = e.target.value; loadYear(); });
  $('fMonth').replaceChildren(...MONTHS.map(m=>el('option', {value:m, textContent:MONTH_NAME[m]})));
  $('fMonth').addEventListener('change', updateDatePreview);
  $('fDay').addEventListener('input', updateDatePreview);
  $('addBtn').addEventListener('click', addActivity);
  $('updateBtn').addEventListener('click', updateActivity);
  $('cancelBtn').addEventListener('click', clearForm);
  $('saveJsonBtn').addEventListener('click', downloadBackup);
  $('addYearBtn').addEventListener('click', addYear);
  $('historyBtn').addEventListener('click', openHistory);
  $('usersBtn').addEventListener('click', openUsers);

  try{
    state.customers = (await api('customers')).customers || [];
  }catch(err){
    showError('Kunne ikke hente årshjulet: ' + err.message);
    return;
  }
  const wanted = new URLSearchParams(location.search).get('kunde');
  state.customer = state.customers.find(c=>c.id===wanted) || state.customers[0];
  if(!state.customer){ showError('Ingen kunder er oprettet.'); return; }
  try{
    const me = await api('me');
    state.user = me.user; state.csrf = me.csrf;
  }catch{}
  fillYearSelect();
  await loadYear();
}
document.addEventListener('DOMContentLoaded', init);
