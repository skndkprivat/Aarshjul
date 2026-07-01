/* ============================================================
   Årshjul – multi-kunde app (statisk HTML, ingen backend)
   Sikkerhedsnote: se README for begrænsninger ved ren statisk hosting.
   ============================================================ */

const MONTHS = ['jan','feb','mar','apr','maj','jun','jul','aug','sep','okt','nov','dec'];
const MONTH_LABEL = {
  da: {jan:'Januar',feb:'Februar',mar:'Marts',apr:'April',maj:'Maj',jun:'Juni',jul:'Juli',aug:'August',sep:'September',okt:'Oktober',nov:'November',dec:'December'},
  en: {jan:'January',feb:'February',mar:'March',apr:'April',maj:'May',jun:'June',jul:'July',aug:'August',sep:'September',okt:'October',nov:'November',dec:'December'}
};

const I18N = {
  da: {
    pickCustomerTitle:'Vælg kunde', pickCustomerSub:'Vælg hvilken kundes årshjul du vil åbne.',
    back:'Tilbage', loginTitle:'Log ind', username:'Brugernavn', password:'Adgangskode', login:'Log ind',
    print:'Print', switchCustomer:'Skift kunde', logout:'Log ud', manageUsers:'Brugere', manageYears:'År',
    exportJson:'Eksportér JSON', wheelHint:'Klik på en måned for at folde aktiviteterne ud.',
    activitiesTitle:'Aktiviteter', activitiesSub:'Åbn en måned for at se og redigere aktiviteter.',
    noActivities:'Ingen aktiviteter i denne måned endnu.', addActivity:'+ Tilføj aktivitet',
    edit:'Redigér', delete:'Slet', calendar:'Kalender', save:'Gem', cancel:'Annullér',
    name:'Navn', date:'Dato (dag)', responsible:'Ansvarlig', notes:'Bemærkninger',
    confirmDelete:'Slet denne aktivitet?', loginError:'Forkert brugernavn eller adgangskode.',
    lockedOut:'For mange forsøg. Prøv igen om {s} sekunder.', sessionExpired:'Du er blevet logget ud pga. inaktivitet.',
    newActivityTitle:'Ny aktivitet', editActivityTitle:'Redigér aktivitet', selectMonth:'Måned',
    usersTitle:'Brugere for denne kunde', usersHint:'Brugere kan kun oprettes/ændres via hash-generator.html og manuel filupload, da løsningen ikke har en backend. Se README.',
    yearsTitle:'Håndter år', addYear:'Tilføj nyt år', yearsHint:'Opretter en tom årsfil du kan downloade og lægge på serveren under data/{kunde}/years/{år}.json — husk også at opdatere customers.json.',
    downloadFile:'Download fil', close:'Luk', role_superadmin:'Superadmin', role_admin:'Admin', role_viewer:'Læser',
    exportedFor:'Data for', updatedNow:'Ændringer er kun gemt i browseren – husk at eksportere og uploade filen, hvis de skal gemmes permanent.'
  },
  en: {
    pickCustomerTitle:'Select customer', pickCustomerSub:'Choose which customer\'s year wheel to open.',
    back:'Back', loginTitle:'Log in', username:'Username', password:'Password', login:'Log in',
    print:'Print', switchCustomer:'Switch customer', logout:'Log out', manageUsers:'Users', manageYears:'Years',
    exportJson:'Export JSON', wheelHint:'Click a month to expand its activities.',
    activitiesTitle:'Activities', activitiesSub:'Open a month to view and edit activities.',
    noActivities:'No activities in this month yet.', addActivity:'+ Add activity',
    edit:'Edit', delete:'Delete', calendar:'Calendar', save:'Save', cancel:'Cancel',
    name:'Name', date:'Date (day)', responsible:'Responsible', notes:'Notes',
    confirmDelete:'Delete this activity?', loginError:'Incorrect username or password.',
    lockedOut:'Too many attempts. Try again in {s} seconds.', sessionExpired:'You were logged out due to inactivity.',
    newActivityTitle:'New activity', editActivityTitle:'Edit activity', selectMonth:'Month',
    usersTitle:'Users for this customer', usersHint:'Users can only be created/changed via hash-generator.html and manual file upload, since this solution has no backend. See README.',
    yearsTitle:'Manage years', addYear:'Add new year', yearsHint:'Creates an empty year file you can download and place on the server under data/{customer}/years/{year}.json — remember to also update customers.json.',
    downloadFile:'Download file', close:'Close', role_superadmin:'Super admin', role_admin:'Admin', role_viewer:'Viewer',
    exportedFor:'Data for', updatedNow:'Changes are only saved in the browser – remember to export and upload the file if they should be permanent.'
  }
};

const state = {
  lang: 'da',
  customers: [],
  customer: null,      // full customer object
  session: null,        // {username, role, isGlobal}
  yearData: null,       // {title, activities}
  year: null,
  sessionTimer: null,
};

function t(key){ return (I18N[state.lang] && I18N[state.lang][key]) || key; }

/* ---------------- Crypto helpers ---------------- */
async function sha256Hex(str){
  const buf = new TextEncoder().encode(str);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
function randomHex(bytes=16){
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b=>b.toString(16).padStart(2,'0')).join('');
}

/* ---------------- Fetch helpers ---------------- */
async function fetchJSON(path){
  const res = await fetch(path, {cache:'no-store'});
  if(!res.ok) throw new Error('Kunne ikke hente ' + path);
  return res.json();
}

/* ---------------- Lockout (brute-force protection) ---------------- */
function lockoutKey(customerId, username){ return `lockout:${customerId}:${username.toLowerCase()}`; }
function getLockout(customerId, username){
  try{ return JSON.parse(sessionStorage.getItem(lockoutKey(customerId,username))) || {fails:0, until:0}; }
  catch{ return {fails:0, until:0}; }
}
function setLockout(customerId, username, data){
  sessionStorage.setItem(lockoutKey(customerId,username), JSON.stringify(data));
}
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

/* ---------------- Session ---------------- */
const SESSION_TTL_MS = 30*60*1000; // 30 minutter inaktivitet
function startSession(customerId, username, role, isGlobal){
  state.session = {customerId, username, role, isGlobal, expires: Date.now()+SESSION_TTL_MS};
  sessionStorage.setItem('session', JSON.stringify(state.session));
  resetInactivityWatch();
}
function touchSession(){
  if(!state.session) return;
  state.session.expires = Date.now()+SESSION_TTL_MS;
  sessionStorage.setItem('session', JSON.stringify(state.session));
}
function resetInactivityWatch(){
  ['mousemove','keydown','click','touchstart'].forEach(ev=>{
    document.addEventListener(ev, touchSession, {passive:true});
  });
  if(state.sessionTimer) clearInterval(state.sessionTimer);
  state.sessionTimer = setInterval(()=>{
    if(state.session && Date.now() > state.session.expires){
      doLogout(true);
    }
  }, 5000);
}
function endSession(){
  state.session = null;
  sessionStorage.removeItem('session');
  if(state.sessionTimer) clearInterval(state.sessionTimer);
}

/* ---------------- Bootstrap ---------------- */
async function init(){
  document.getElementById('langToggle').addEventListener('click', e=>{
    const btn = e.target.closest('button[data-lang]');
    if(!btn) return;
    setLang(btn.dataset.lang);
  });
  document.getElementById('backToCustomers').addEventListener('click', ()=>showScreen('customer'));
  document.getElementById('loginForm').addEventListener('submit', onLoginSubmit);
  document.getElementById('switchCustomerBtn').addEventListener('click', ()=>{ endSession(); showScreen('customer'); });
  document.getElementById('logoutBtn').addEventListener('click', ()=>doLogout(false));
  document.getElementById('printBtn').addEventListener('click', ()=>window.print());
  document.getElementById('yearSelect').addEventListener('change', onYearChange);
  document.getElementById('exportJsonBtn').addEventListener('click', exportCurrentYearJSON);
  document.getElementById('manageUsersBtn').addEventListener('click', openUsersModal);
  document.getElementById('manageYearsBtn').addEventListener('click', openYearsModal);

  try{
    const data = await fetchJSON('data/customers.json');
    state.customers = data.customers || [];
  }catch(err){
    document.getElementById('errorCustomer').innerHTML =
      `<div class="error-msg">⚠ Kunne ikke indlæse kundeliste (data/customers.json). Tjek at siden køres via en webserver, ikke som lokal fil.</div>`;
  }
  renderCustomerList();
  applyI18n();

  // Genopret session hvis stadig gyldig (samme fane)
  const saved = sessionStorage.getItem('session');
  if(saved){
    try{
      const s = JSON.parse(saved);
      if(s && s.expires > Date.now()){
        const customer = state.customers.find(c=>c.id===s.customerId);
        if(customer){
          state.customer = customer;
          state.session = s;
          resetInactivityWatch();
          enterDashboard();
          return;
        }
      }
    }catch{}
    sessionStorage.removeItem('session');
  }
}
document.addEventListener('DOMContentLoaded', init);

/* ---------------- Language ---------------- */
function setLang(lang){
  state.lang = lang;
  document.querySelectorAll('#langToggle button').forEach(b=>b.classList.toggle('active', b.dataset.lang===lang));
  document.documentElement.lang = lang;
  applyI18n();
  if(state.session) renderDashboard();
}
function applyI18n(){
  document.querySelectorAll('[data-i18n]').forEach(el=>{
    el.textContent = t(el.dataset.i18n);
  });
}

/* ---------------- Screens ---------------- */
function showScreen(name){
  document.getElementById('screen-customer').classList.toggle('hidden', name!=='customer');
  document.getElementById('screen-login').classList.toggle('hidden', name!=='login');
  document.getElementById('screen-dashboard').classList.toggle('hidden', name!=='dashboard');
}

/* ---------------- Step 1: customer picker ---------------- */
function renderCustomerList(){
  const wrap = document.getElementById('customerList');
  wrap.innerHTML = '';
  state.customers.forEach(c=>{
    const btn = document.createElement('button');
    btn.className = 'customer-item';
    btn.innerHTML = `<span class="swatch" style="background:${escapeAttr(c.accent||'#2F6F5E')}"></span><span></span>`;
    btn.querySelector('span:last-child').textContent = c.name;
    btn.addEventListener('click', ()=>selectCustomer(c));
    wrap.appendChild(btn);
  });
}
function selectCustomer(customer){
  state.customer = customer;
  document.getElementById('loginSub').textContent = customer.name;
  document.getElementById('errorLogin').innerHTML = '';
  document.getElementById('loginForm').reset();
  showScreen('login');
  document.getElementById('loginUsername').focus();
}

/* ---------------- Step 2: login ---------------- */
async function onLoginSubmit(e){
  e.preventDefault();
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errorBox = document.getElementById('errorLogin');
  errorBox.innerHTML = '';
  const submitBtn = document.getElementById('loginSubmit');

  const lock = getLockout(state.customer.id, username);
  if(lock.until > Date.now()){
    const secs = Math.ceil((lock.until - Date.now())/1000);
    errorBox.innerHTML = `<div class="error-msg">⚠ ${t('lockedOut').replace('{s}', secs)}</div>`;
    return;
  }

  submitBtn.disabled = true;
  await sleep(250 * (lock.fails||0)); // progressiv forsinkelse mod brute force

  try{
    const [customerUsers, globalUsers] = await Promise.all([
      fetchJSON(`data/${state.customer.id}/users.json`).catch(()=>({users:[]})),
      fetchJSON('data/admin-users.json').catch(()=>({users:[]}))
    ]);

    let match = null, isGlobal = false;
    for(const u of customerUsers.users){
      if(u.username.toLowerCase() === username.toLowerCase()){
        const hash = await sha256Hex(u.salt + ':' + password);
        if(hash === u.hash){ match = u; }
      }
    }
    if(!match){
      for(const u of globalUsers.users){
        if(u.username.toLowerCase() === username.toLowerCase()){
          const hash = await sha256Hex(u.salt + ':' + password);
          if(hash === u.hash){ match = u; isGlobal = true; }
        }
      }
    }

    if(!match){
      const fails = (lock.fails||0) + 1;
      const until = fails >= 5 ? Date.now() + 60000 : 0;
      setLockout(state.customer.id, username, {fails, until});
      errorBox.innerHTML = `<div class="error-msg">⚠ ${t('loginError')}</div>`;
      submitBtn.disabled = false;
      return;
    }

    setLockout(state.customer.id, username, {fails:0, until:0});
    startSession(state.customer.id, match.username, match.role, isGlobal);
    await enterDashboard();
  }catch(err){
    errorBox.innerHTML = `<div class="error-msg">⚠ ${err.message}</div>`;
  }finally{
    submitBtn.disabled = false;
  }
}

function doLogout(expired){
  endSession();
  showScreen('customer');
  if(expired){
    document.getElementById('errorCustomer').innerHTML = `<div class="error-msg">⚠ ${t('sessionExpired')}</div>`;
  }
}

/* ---------------- Step 3: dashboard ---------------- */
async function enterDashboard(){
  showScreen('dashboard');
  document.getElementById('brandDot').style.background = state.customer.accent || '#2F6F5E';
  document.getElementById('brandName').textContent = state.customer.name;
  document.getElementById('roleBadge').textContent = t('role_' + state.session.role) || state.session.role;

  const isAdmin = state.session.role === 'admin' || state.session.role === 'superadmin';
  document.getElementById('adminTools').classList.toggle('hidden', !isAdmin);

  const years = state.customer.years && state.customer.years.length ? state.customer.years : [String(new Date().getFullYear())];
  const yearSelect = document.getElementById('yearSelect');
  yearSelect.innerHTML = years.map(y=>`<option value="${y}">${y}</option>`).join('');
  state.year = years[0];
  yearSelect.value = state.year;

  await loadYearData();
}

async function onYearChange(e){
  state.year = e.target.value;
  await loadYearData();
}

async function loadYearData(){
  try{
    state.yearData = await fetchJSON(`data/${state.customer.id}/years/${state.year}.json`);
  }catch(err){
    state.yearData = {title: `Årshjul ${state.year}`, activities: []};
  }
  renderDashboard();
}

function renderDashboard(){
  document.getElementById('wheelTitle').textContent = state.yearData.title || `Årshjul ${state.year}`;
  document.getElementById('wheelMeta').textContent = `${state.customer.name} · ${state.year}`;
  document.getElementById('footerNote').textContent = t('updatedNow');
  renderWheel();
  renderMonthGroups();
}

/* ---------------- Wheel (SVG) ---------------- */
function hexToHsl(hex){
  hex = hex.replace('#','');
  if(hex.length===3) hex = hex.split('').map(c=>c+c).join('');
  const r = parseInt(hex.substr(0,2),16)/255, g = parseInt(hex.substr(2,2),16)/255, b = parseInt(hex.substr(4,2),16)/255;
  const max=Math.max(r,g,b), min=Math.min(r,g,b);
  let h,s,l=(max+min)/2;
  if(max===min){ h=s=0; }
  else{
    const d = max-min;
    s = l>0.5 ? d/(2-max-min) : d/(max+min);
    switch(max){
      case r: h=(g-b)/d+(g<b?6:0); break;
      case g: h=(b-r)/d+2; break;
      case b: h=(r-g)/d+4; break;
    }
    h/=6;
  }
  return {h:h*360, s:s*100, l:l*100};
}
function hslToHex(h,s,l){
  s/=100; l/=100;
  const k = n => (n + h/30) % 12;
  const a = s * Math.min(l, 1-l);
  const f = n => l - a * Math.max(-1, Math.min(k(n)-3, Math.min(9-k(n), 1)));
  const toHex = x => Math.round(255*x).toString(16).padStart(2,'0');
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}
function monthPalette(accentHex){
  const {h,s} = hexToHsl(accentHex || '#2F6F5E');
  return MONTHS.map((_,i)=>{
    const hue = (h + (i-5.5)*4 + 360) % 360;
    const light = 34 + (i%2===0 ? 0 : 8);
    return hslToHex(hue, Math.max(28,Math.min(s,55)), light);
  });
}
function polar(cx,cy,r,angleDeg){
  const a = (angleDeg-90) * Math.PI/180;
  return {x: cx + r*Math.cos(a), y: cy + r*Math.sin(a)};
}
function wedgePath(cx,cy,rOuter,rInner,startAngle,endAngle){
  const p1 = polar(cx,cy,rOuter,startAngle);
  const p2 = polar(cx,cy,rOuter,endAngle);
  const p3 = polar(cx,cy,rInner,endAngle);
  const p4 = polar(cx,cy,rInner,startAngle);
  const large = endAngle-startAngle > 180 ? 1 : 0;
  return `M ${p1.x} ${p1.y} A ${rOuter} ${rOuter} 0 ${large} 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${rInner} ${rInner} 0 ${large} 0 ${p4.x} ${p4.y} Z`;
}
function renderWheel(){
  const svg = document.getElementById('wheelSvg');
  const cx=230, cy=230, rOuter=200, rInner=64;
  const palette = monthPalette(state.customer.accent);
  const counts = {};
  MONTHS.forEach(m=>counts[m]=0);
  (state.yearData.activities||[]).forEach(a=>{ if(counts[a.month]!==undefined) counts[a.month]++; });

  let svgParts = [];
  MONTHS.forEach((m,i)=>{
    const start = i*30, end = (i+1)*30;
    const mid = (start+end)/2;
    const path = wedgePath(cx,cy,rOuter,rInner,start,end);
    svgParts.push(`<path d="${path}" fill="${palette[i]}" stroke="#fff" stroke-width="2" data-month="${m}" style="cursor:pointer"></path>`);
    const labelPos = polar(cx,cy,(rOuter+rInner)/2 + 8, mid);
    svgParts.push(`<text x="${labelPos.x}" y="${labelPos.y}" fill="#fff" font-family="Space Grotesk, sans-serif" font-weight="600" font-size="12" text-anchor="middle" dominant-baseline="middle" style="pointer-events:none;text-transform:uppercase;letter-spacing:.03em">${MONTH_LABEL[state.lang][m].slice(0,3)}</text>`);
    if(counts[m]>0){
      const badgePos = polar(cx,cy,rOuter+16, mid);
      svgParts.push(`<circle cx="${badgePos.x}" cy="${badgePos.y}" r="10" fill="${palette[i]}"></circle>`);
      svgParts.push(`<text x="${badgePos.x}" y="${badgePos.y}" fill="#fff" font-size="10" font-weight="700" text-anchor="middle" dominant-baseline="middle" style="pointer-events:none">${counts[m]}</text>`);
    }
  });
  svgParts.push(`<circle cx="${cx}" cy="${cy}" r="${rInner-6}" fill="#fff"></circle>`);
  svgParts.push(`<text x="${cx}" y="${cy-6}" text-anchor="middle" font-family="Space Grotesk, sans-serif" font-weight="700" font-size="15" fill="#1B2430">${state.year}</text>`);
  svgParts.push(`<text x="${cx}" y="${cy+14}" text-anchor="middle" font-family="Inter, sans-serif" font-size="10" fill="#5B6672">${escapeHtml(state.customer.shortName || state.customer.name)}</text>`);

  svg.innerHTML = svgParts.join('');
  svg.querySelectorAll('path[data-month]').forEach(p=>{
    p.addEventListener('click', ()=>{
      const details = document.getElementById('month-'+p.dataset.month);
      if(details){ details.open = true; details.scrollIntoView({behavior:'smooth', block:'center'}); }
    });
  });
}

/* ---------------- Activity list ---------------- */
function escapeHtml(str){
  return String(str??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escapeAttr(str){ return escapeHtml(str); }

function renderMonthGroups(){
  const isAdmin = state.session.role === 'admin' || state.session.role === 'superadmin';
  const wrap = document.getElementById('monthGroups');
  wrap.innerHTML = '';
  const palette = monthPalette(state.customer.accent);

  MONTHS.forEach((m,i)=>{
    const items = (state.yearData.activities||[]).filter(a=>a.month===m);
    const details = document.createElement('details');
    details.className = 'month-group';
    details.id = 'month-'+m;
    const summary = document.createElement('summary');
    summary.innerHTML = `<span class="m-dot" style="background:${palette[i]}"></span><span></span>`;
    summary.querySelector('span:last-child').textContent = MONTH_LABEL[state.lang][m];
    details.appendChild(summary);

    if(items.length===0){
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = t('noActivities');
      details.appendChild(empty);
    }else{
      items.forEach(a=>{
        details.appendChild(renderActivityRow(a, isAdmin));
      });
    }

    if(isAdmin){
      const addBtn = document.createElement('button');
      addBtn.className = 'btn small add-row';
      addBtn.textContent = t('addActivity');
      addBtn.addEventListener('click', ()=>openActivityModal(null, m));
      details.appendChild(addBtn);
    }

    wrap.appendChild(details);
  });
}

function renderActivityRow(a, isAdmin){
  const row = document.createElement('div');
  row.className = 'activity-row';
  const main = document.createElement('div');
  main.className = 'a-main';
  const name = document.createElement('div');
  name.className = 'a-name';
  name.textContent = a.name;
  main.appendChild(name);
  const metaParts = [];
  if(a.date) metaParts.push(`${a.date}/${state.year}`);
  if(a.responsible) metaParts.push(a.responsible);
  if(a.notes) metaParts.push(a.notes);
  if(metaParts.length){
    const meta = document.createElement('div');
    meta.className = 'a-meta';
    meta.textContent = metaParts.join(' · ');
    main.appendChild(meta);
  }
  row.appendChild(main);

  const actions = document.createElement('div');
  actions.className = 'a-actions';
  if(a.date){
    const icsBtn = document.createElement('button');
    icsBtn.className = 'btn small';
    icsBtn.textContent = '📅';
    icsBtn.title = t('calendar');
    icsBtn.addEventListener('click', ()=>downloadICS(a));
    actions.appendChild(icsBtn);
  }
  if(isAdmin){
    const editBtn = document.createElement('button');
    editBtn.className = 'btn small';
    editBtn.textContent = '✎';
    editBtn.title = t('edit');
    editBtn.addEventListener('click', ()=>openActivityModal(a, a.month));
    actions.appendChild(editBtn);

    const delBtn = document.createElement('button');
    delBtn.className = 'btn small danger';
    delBtn.textContent = '✕';
    delBtn.title = t('delete');
    delBtn.addEventListener('click', ()=>{
      if(confirm(t('confirmDelete'))){
        state.yearData.activities = state.yearData.activities.filter(x=>x.id!==a.id);
        renderDashboard();
      }
    });
    actions.appendChild(delBtn);
  }
  row.appendChild(actions);
  return row;
}

/* ---------------- Modals ---------------- */
function closeModal(){
  document.getElementById('modalRoot').innerHTML = '';
}
function openModal(html){
  document.getElementById('modalRoot').innerHTML = `<div class="modal-overlay" id="modalOverlay"><div class="modal">${html}</div></div>`;
  document.getElementById('modalOverlay').addEventListener('click', e=>{
    if(e.target.id === 'modalOverlay') closeModal();
  });
}

function openActivityModal(activity, defaultMonth){
  const isNew = !activity;
  const monthOptions = MONTHS.map(m=>`<option value="${m}" ${m===defaultMonth?'selected':''}>${MONTH_LABEL[state.lang][m]}</option>`).join('');
  openModal(`
    <h2>${isNew ? t('newActivityTitle') : t('editActivityTitle')}</h2>
    <div class="field"><label>${t('selectMonth')}</label>
      <select class="select" id="fMonth" style="width:100%">${monthOptions}</select></div>
    <div class="field"><label>${t('name')}</label><input id="fName" type="text" value="${escapeAttr(activity?.name||'')}"></div>
    <div class="field"><label>${t('date')}</label><input id="fDate" type="text" placeholder="19" value="${escapeAttr((activity?.date||'').split('/')[0]||'')}"></div>
    <div class="field"><label>${t('responsible')}</label><input id="fResp" type="text" value="${escapeAttr(activity?.responsible||'')}"></div>
    <div class="field"><label>${t('notes')}</label><input id="fNotes" type="text" value="${escapeAttr(activity?.notes||'')}"></div>
    <div class="modal-actions">
      <button class="btn" id="cancelActivity">${t('cancel')}</button>
      <button class="btn primary" id="saveActivity">${t('save')}</button>
    </div>
  `);
  document.getElementById('cancelActivity').addEventListener('click', closeModal);
  document.getElementById('saveActivity').addEventListener('click', ()=>{
    const month = document.getElementById('fMonth').value;
    const name = document.getElementById('fName').value.trim();
    const day = document.getElementById('fDate').value.trim();
    const responsible = document.getElementById('fResp').value.trim();
    const notes = document.getElementById('fNotes').value.trim();
    if(!name) return;
    const monthNum = MONTHS.indexOf(month)+1;
    const date = day ? `${parseInt(day,10)}/${monthNum}` : '';
    if(isNew){
      state.yearData.activities = state.yearData.activities || [];
      state.yearData.activities.push({id:'a'+Date.now(), month, name, date, responsible, notes});
    }else{
      Object.assign(activity, {month, name, date, responsible, notes});
    }
    closeModal();
    renderDashboard();
  });
}

function openUsersModal(){
  openModal(`
    <h2>${t('usersTitle')}</h2>
    <p style="color:var(--ink-soft);font-size:.85rem;line-height:1.5;margin-bottom:16px;">${t('usersHint')}</p>
    <div class="modal-actions"><button class="btn primary" id="closeUsers">${t('close')}</button></div>
  `);
  document.getElementById('closeUsers').addEventListener('click', closeModal);
}

function openYearsModal(){
  openModal(`
    <h2>${t('yearsTitle')}</h2>
    <p style="color:var(--ink-soft);font-size:.85rem;line-height:1.5;margin-bottom:16px;">${t('yearsHint')}</p>
    <div class="field"><label>${t('selectMonth')==='' ? '' : ''}Årstal</label><input id="fYear" type="text" placeholder="2027"></div>
    <div class="modal-actions">
      <button class="btn" id="cancelYear">${t('cancel')}</button>
      <button class="btn primary" id="createYear">${t('addYear')}</button>
    </div>
  `);
  document.getElementById('cancelYear').addEventListener('click', closeModal);
  document.getElementById('createYear').addEventListener('click', ()=>{
    const year = document.getElementById('fYear').value.trim();
    if(!/^\d{4}$/.test(year)) return;
    const blank = {title: `Årshjul ${year}`, activities: []};
    downloadJSON(blank, `${year}.json`);
    if(!state.customer.years.includes(year)) state.customer.years.push(year);
    const updatedCustomers = {customers: state.customers};
    downloadJSON(updatedCustomers, 'customers.json');
    closeModal();
    alert(state.lang==='da'
      ? `Upload "${year}.json" til data/${state.customer.id}/years/ og erstat data/customers.json på serveren.`
      : `Upload "${year}.json" to data/${state.customer.id}/years/ and replace data/customers.json on the server.`);
  });
}

/* ---------------- Export helpers ---------------- */
function downloadJSON(obj, filename){
  const blob = new Blob([JSON.stringify(obj, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
function exportCurrentYearJSON(){
  downloadJSON(state.yearData, `${state.year}.json`);
}
function downloadICS(activity){
  const [day, month] = (activity.date||'').split('/').map(n=>parseInt(n,10));
  if(!day || !month) return;
  const year = parseInt(state.year,10);
  const dt = new Date(Date.UTC(year, month-1, day, 9, 0, 0));
  const dtEnd = new Date(dt.getTime() + 60*60*1000);
  const fmt = d => d.toISOString().replace(/[-:]/g,'').split('.')[0]+'Z';
  const ics = [
    'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Aarshjul//DA',
    'BEGIN:VEVENT',
    `UID:${activity.id}@aarshjul`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(dt)}`,
    `DTEND:${fmt(dtEnd)}`,
    `SUMMARY:${icsEscape(activity.name)}`,
    `DESCRIPTION:${icsEscape([activity.responsible, activity.notes].filter(Boolean).join(' - '))}`,
    `LOCATION:${icsEscape(state.customer.name)}`,
    'END:VEVENT','END:VCALENDAR'
  ].join('\r\n');
  const blob = new Blob([ics], {type:'text/calendar'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${activity.name.replace(/[^a-z0-9]+/gi,'_')}.ics`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
function icsEscape(str){ return String(str||'').replace(/[\\,;]/g, m=>'\\'+m).replace(/\n/g,'\\n'); }
