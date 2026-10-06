const API_URL = 'PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE';
let state = {events:[], announcements:[], memories:[], role:null, token:null, username:null, adminData:null, filter:'all'};

const $ = id => document.getElementById(id);
const api = async (payload) => {
  if (API_URL.includes('PASTE_YOUR')) throw new Error('Add your Apps Script Web App URL to app.js first.');
  const r = await fetch(API_URL, {method:'POST', body:JSON.stringify(payload)});
  const data = await r.json();
  if (!data.ok) throw new Error(data.error || 'Something went wrong');
  return data;
};

function toast(msg){$('toast').textContent=msg;$('toast').style.display='block';setTimeout(()=>$('toast').style.display='none',3000)}
function escapeHtml(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}

async function loadPublic(){
  try{
    const r=await fetch(API_URL+'?action=bootstrap'); const d=await r.json();
    if(!d.ok) throw new Error(d.error);
    state.events=d.events||[];state.announcements=d.announcements||[];state.memories=d.memories||[];
    renderAll();
  }catch(e){toast(e.message)}
}
function renderAll(){renderEvents();renderAnnouncements();renderMemories()}
function renderEvents(){
  const q=($('search').value||'').toLowerCase();
  const items=state.events.filter(e=>(state.filter==='all'||e.category===state.filter)&&(!q||`${e.title} ${e.description} ${e.location}`.toLowerCase().includes(q)));
  $('eventsGrid').innerHTML=items.length?items.map(e=>`<article class="card event-card"><span class="tag">${escapeHtml(e.category)}</span><h3>${escapeHtml(e.title)}</h3><div class="meta">📅 ${escapeHtml(e.date)} ${escapeHtml(e.time||'')}<br>📍 ${escapeHtml(e.location||'')}<br>🎟️ ${e.capacity?`${Number(e.capacity)-Number(e.registrationCount||0)} spots left`: 'Open'}</div><p>${escapeHtml(e.description||'')}</p><button class="btn register" data-id="${escapeHtml(e.id)}">Register</button></article>`).join(''):'<div class="card">No events found.</div>';
  document.querySelectorAll('.register').forEach(b=>b.onclick=()=>registerPrompt(b.dataset.id));
}
function renderAnnouncements(){$('announcementsGrid').innerHTML=state.announcements.map(a=>`<article class="card announcement"><span class="tag">Announcement</span><h3>${escapeHtml(a.title)}</h3><p>${escapeHtml(a.body)}</p><div class="meta">${escapeHtml(a.date||'')}</div></article>`).join('')||'<div class="card">No announcements yet.</div>'}
function renderMemories(){$('memoriesGrid').innerHTML=state.memories.map(m=>`<article class="memory">${m.imageUrl?`<img src="${escapeHtml(m.imageUrl)}" alt="">`:''}<div class="memory-body"><h3>${escapeHtml(m.title)}</h3><p>${escapeHtml(m.caption||'')}</p></div></article>`).join('')||'<div class="card">Memories will appear here.</div>'}

async function registerPrompt(eventId){
  const e=state.events.find(x=>x.id===eventId); if(!e)return;
  const firstName=prompt(`Register for ${e.title}\n\nFirst name:`); if(!firstName)return;
  const lastName=prompt('Last name (optional):')||'';
  const email=prompt('Email:'); if(!email)return;
  const activity=prompt('Activity/team (optional):')||'';
  try{const d=await api({action:'register',eventId,firstName,lastName,email,activity});toast(d.message+(d.remaining!==null?` ${d.remaining} spots left.`:''));loadPublic()}catch(err){toast(err.message)}
}

$('search').addEventListener('input',renderEvents);
document.querySelectorAll('.filter').forEach(b=>b.onclick=()=>{document.querySelectorAll('.filter').forEach(x=>x.classList.remove('active'));b.classList.add('active');state.filter=b.dataset.cat;renderEvents()});

$('ideaForm').onsubmit=async ev=>{ev.preventDefault();const f=new FormData(ev.target);try{const d=await api({action:'idea',name:f.get('name'),email:f.get('email'),idea:f.get('idea')});$('ideaMsg').textContent=d.message;ev.target.reset()}catch(e){$('ideaMsg').textContent=e.message}};

$('loginBtn').onclick=()=>{$('loginModal').classList.remove('hidden');$('loginMsg').textContent=''};
$('closeLogin').onclick=()=>$('loginModal').classList.add('hidden');
$('loginForm').onsubmit=async ev=>{ev.preventDefault();const f=new FormData(ev.target);try{const d=await api({action:'login',username:f.get('username'),password:f.get('password')});state.token=d.token;state.role=d.role;state.username=d.username;$('loginModal').classList.add('hidden');ev.target.reset();if(state.role==='admin'){$('admin').classList.remove('hidden');await loadAdmin()}toast('Logged in as '+state.username);location.hash='admin'}catch(e){$('loginMsg').textContent=e.message}};

$('logoutBtn').onclick=()=>{state.token=null;state.role=null;$('admin').classList.add('hidden');toast('Logged out')};

document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.tab-panel').forEach(x=>x.classList.add('hidden'));b.classList.add('active');$('tab-'+b.dataset.tab).classList.remove('hidden')});

async function loadAdmin(){try{const d=await api({action:'adminData',token:state.token});state.adminData=d;renderAdmin(d)}catch(e){toast(e.message)}}
function renderAdmin(d){
  $('walkEvent').innerHTML=d.events.map(e=>`<option value="${escapeHtml(e.id)}">${escapeHtml(e.title)}</option>`).join('');
  $('attendanceList').innerHTML=d.registrations.map(r=>`<div class="record"><b>${escapeHtml(r.eventTitle)}</b> — ${escapeHtml(r.firstName)} ${escapeHtml(r.lastName||'')}<br><small>${escapeHtml(r.email)}</small><br><label><input type="checkbox" class="att" data-id="${escapeHtml(r.id)}" data-event="${escapeHtml(r.eventId)}" data-title="${escapeHtml(r.eventTitle)}" data-first="${escapeHtml(r.firstName)}" ${d.attendance.some(a=>a.registrationId===r.id&&String(a.present)==='true')?'checked':''}> Present</label></div>`).join('');
  document.querySelectorAll('.att').forEach(c=>c.onchange=async()=>{try{await api({action:'toggleAttendance',token:state.token,registrationId:c.dataset.id,eventId:c.dataset.event,eventTitle:c.dataset.title,firstName:c.dataset.first,present:c.checked});toast('Attendance updated')}catch(e){toast(e.message)}});
  $('recordsList').innerHTML='<h3>Registrations</h3>'+d.registrations.map(r=>`<div class="record"><b>${escapeHtml(r.eventTitle)}</b><br>${escapeHtml(r.firstName)} ${escapeHtml(r.lastName||'')} · ${escapeHtml(r.email)}<br><small>${escapeHtml(r.createdAt)}</small></div>`).join('')+'<h3>Ideas</h3>'+d.ideas.map(i=>`<div class="record"><b>${escapeHtml(i.name||'Anonymous')}</b><br>${escapeHtml(i.idea)}</div>`).join('');
}
$('eventForm').onsubmit=async ev=>{ev.preventDefault();const f=new FormData(ev.target);try{await api({action:'createEvent',token:state.token,title:f.get('title'),category:f.get('category'),date:f.get('date'),time:f.get('time'),location:f.get('location'),capacity:f.get('capacity'),description:f.get('description')});toast('Event created');ev.target.reset();await loadAdmin();loadPublic()}catch(e){toast(e.message)}};
$('announcementForm').onsubmit=async ev=>{ev.preventDefault();const f=new FormData(ev.target);try{await api({action:'createAnnouncement',token:state.token,title:f.get('title'),body:f.get('body')});toast('Announcement published');ev.target.reset();await loadAdmin();loadPublic()}catch(e){toast(e.message)}};
$('uploadBtn').onclick=async()=>{const f=document.querySelector('#announcementForm');const file=f.photo.files[0];if(!file)return toast('Choose a photo');const reader=new FileReader();reader.onload=async()=>{try{await api({action:'uploadPhoto',token:state.token,title:f.title.value||'Assembly memory',caption:f.caption.value||'',date:f.date.value||'',filename:file.name,mime:file.type,data:reader.result.split(',')[1]});$('uploadMsg').textContent='Photo uploaded';f.photo.value='';await loadAdmin();loadPublic()}catch(e){$('uploadMsg').textContent=e.message}};reader.readAsDataURL(file)};
$('walkBtn').onclick=async()=>{try{const id=$('walkEvent').value;const e=state.adminData.events.find(x=>x.id===id);await api({action:'walkin',token:state.token,eventId:id,eventTitle:e.title,firstName:$('walkFirst').value,lastName:$('walkLast').value,note:$('walkNote').value});$('walkMsg').textContent='Walk-in marked present';$('walkFirst').value='';$('walkLast').value='';$('walkNote').value='';await loadAdmin()}catch(e){$('walkMsg').textContent=e.message}};

loadPublic();
