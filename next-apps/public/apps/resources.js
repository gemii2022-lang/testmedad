// ===== CONFIG =====
const SB_URL = 'https://jsjuntblrbetodqymfnz.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzanVudGJscmJldG9kcXltZm56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwNzYyMTgsImV4cCI6MjA5NjY1MjIxOH0.Rv6IyKKAx8xGZmJRBHkwr-YG5vqbqHB1tDc38Nt16h8';
const DECL_TABLE   = 'declarations';
const SCHOOL_TABLE = 'schools';
const SETTINGS_TABLE = 'settings';

// ===== STATE =====
let ADMIN_HASH = null;
let schools = [];         // [{id, name, slug, declaration_text}]
let allRecords = [];
let currentPrint = null;
let editingSchoolId = null;

// ===== API =====
const headers = () => ({'apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY,'Content-Type':'application/json'});

async function apiGet(table, q='') {
  const order = table === SETTINGS_TABLE ? '' : '&order=created_at.desc';
  const r = await fetch(`${SB_URL}/rest/v1/${table}?${q}${order}`, {headers:headers()});
  if(!r.ok) throw new Error(await r.text());
  return r.json();
}
async function apiPost(table, data) {
  const r = await fetch(`${SB_URL}/rest/v1/${table}`, {method:'POST',headers:{...headers(),'Prefer':'return=representation'},body:JSON.stringify(data)});
  if(!r.ok) throw new Error(await r.text());
  return r.json();
}
async function apiPatch(table, id, data) {
  const r = await fetch(`${SB_URL}/rest/v1/${table}?id=eq.${id}`, {method:'PATCH',headers:{...headers(),'Prefer':'return=minimal'},body:JSON.stringify(data)});
  if(!r.ok) throw new Error(await r.text());
}
async function apiDelete(table, id) {
  const r = await fetch(`${SB_URL}/rest/v1/${table}?id=eq.${id}`, {method:'DELETE',headers:headers()});
  if(!r.ok) throw new Error(await r.text());
}
async function apiUpsert(table, data, conflict) {
  const r = await fetch(`${SB_URL}/rest/v1/${table}?on_conflict=${conflict}`, {
    method:'POST', headers:{...headers(),'Prefer':'resolution=merge-duplicates,return=minimal'},
    body:JSON.stringify(data)
  });
  if(!r.ok) throw new Error(await r.text());
}

// ===== INIT =====
async function init() {
  const slug = getSlugFromURL();
  if(slug) {
    // Teacher mode — load specific school
    await loadSchoolBySlug(slug);
  } else {
    // Normal mode
    await loadDefaultSchool();
  }
}

function getSlugFromURL() {
  const h = window.location.hash.replace('#','');
  if(h && h !== 'teacher' && h !== 'admin') return h;
  const p = new URLSearchParams(window.location.search).get('school');
  return p || null;
}

async function loadDefaultSchool() {
  try {
    const data = await apiGet(SCHOOL_TABLE, 'order=created_at.asc&limit=1');
    if(data && data.length > 0) setActiveSchool(data[0]);
  } catch(e) {}
}

async function loadSchoolBySlug(slug) {
  try {
    const data = await apiGet(SCHOOL_TABLE, `slug=eq.${encodeURIComponent(slug)}`);
    if(data && data.length > 0) {
      setActiveSchool(data[0]);
    } else {
      document.getElementById('teacher-form-wrap').style.display='none';
      document.getElementById('teacher-no-school').style.display='block';
    }
  } catch(e) {
    await loadDefaultSchool();
  }
}

function setActiveSchool(school) {
  document.getElementById('site-subtitle').textContent = school.name;
  const txt = school.declaration_text || '';
  document.getElementById('declaration-display').innerHTML = txt
    .replace(/(رقم الجوال والبريد الإلكتروني)/g,'<strong>$1</strong>')
    .replace(/(عنوان مراسلاتي الرسمي)/g,'<strong>$1</strong>')
    .replace(/(مداد البيان المحدودة)/g,'<strong>$1</strong>');
  const sd = document.getElementById('school-display');
  document.getElementById('school-display-name').textContent = '🏫 ' + school.name;
  // شعار المدرسة
  const logoImg = document.getElementById('school-logo-img');
  if(school.logo_data) {
    logoImg.src = school.logo_data;
    logoImg.style.display = 'block';
  } else {
    logoImg.style.display = 'none';
  }
  sd.style.display = 'block';
  window._activeSchool = school;
}

// ===== NAVIGATION =====
function showPage(page, btn) {
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));
  document.getElementById('page-'+page).classList.add('active');
  if(btn) btn.classList.add('active');
  // لو الأدمن داخل بالفعل ما نعملش setup تاني
  if(page==='admin' && document.getElementById('admin-dash').style.display==='block') return;
  if(page==='admin') checkAdminSetup();
}

function showInnerTab(tab, btn) {
  ['schools','records','account'].forEach(t=>{
    document.getElementById('itab-'+t).style.display = t===tab?'block':'none';
  });
  document.querySelectorAll('.inner-tab').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  if(tab==='records') loadAllRecords();
  if(tab==='schools') loadSchoolsList();
}

// ===== TEACHER FORM =====
async function submitTeacher() {
  const name    = document.getElementById('t-name').value.trim();
  const nid     = document.getElementById('t-id').value.trim();
  const phone   = document.getElementById('t-phone').value.trim();
  const email   = document.getElementById('t-email').value.trim();
  const address = document.getElementById('t-address').value.trim();
  const iban    = document.getElementById('t-iban').value.trim();
  const idImage = document.getElementById('t-id-image-data').value.trim();
  const agreed  = document.getElementById('t-agree').checked;
  const alertEl = document.getElementById('teacher-alert');

  if(!name||!nid||!phone||!email||!address||!iban){ showAlert(alertEl,'error','يرجى تعبئة جميع الحقول'); return; }
  if(!idImage){ showAlert(alertEl,'error','يرجى رفع صورة الهوية الوطنية'); return; }
  if(nid.length!==10||!/^\d{10}$/.test(nid)){ showAlert(alertEl,'error','رقم الهوية يجب أن يكون 10 أرقام'); return; }
  if(!/^05\d{8}$/.test(phone)){ showAlert(alertEl,'error','رقم الجوال يجب أن يبدأ بـ 05 ويكون 10 أرقام'); return; }
  if(iban.length!==22){ showAlert(alertEl,'error','الآيبان يجب أن يكون 22 رقماً بعد SA'); return; }
  if(!agreed){ showAlert(alertEl,'error','يجب الموافقة على الإقرار أولاً'); return; }

  const school = window._activeSchool;
  const btn = document.getElementById('submit-btn');
  btn.disabled=true; btn.innerHTML='جاري التحقق... <span class="spinner"></span>';

  try {
    // تحقق إذا الهوية مسجلة قبل كده في نفس المدرسة
    const schoolId = school ? school.id : null;
    const checkQ = schoolId
      ? 'national_id=eq.'+nid+'&school_id=eq.'+schoolId
      : 'national_id=eq.'+nid;
    const existing = await apiGet(DECL_TABLE, checkQ);
    if(existing && existing.length > 0) {
      showAlert(alertEl,'error','⚠️ تم تسجيل هذا الرقم مسبقاً — لا يمكن التسجيل مرة أخرى');
      btn.disabled=false; btn.innerHTML='✅ تسجيل البيانات والإقرار';
      return;
    }
    btn.innerHTML='جاري الحفظ... <span class="spinner"></span>';
    await apiPost(DECL_TABLE, {
      full_name:name, national_id:nid, phone, email, national_address:address, iban:'SA'+iban,
      id_image: idImage,
      school_id: school ? school.id : null,
      school_name: school ? school.name : '',
      declaration_text: school ? school.declaration_text : '',
      agreed:true
    });
    ['t-name','t-id','t-phone','t-email','t-address','t-iban'].forEach(id=>document.getElementById(id).value='');
    document.getElementById('t-agree').checked=false;
    clearIdImage();
    alertEl.classList.remove('show');
    document.getElementById('success-modal').classList.add('show');
  } catch(e) {
    showAlert(alertEl,'error','خطأ في الحفظ: '+e.message);
  } finally {
    btn.disabled=false; btn.innerHTML='✅ تسجيل البيانات والإقرار';
  }
}

// ===== ADMIN AUTH =====
async function hashPassword(p) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(p+'mdad_2026'));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

let adminSetupDone = false;

async function checkAdminSetup() {
  if(adminSetupDone) return;
  adminSetupDone = true;

  // اعرض loading أثناء الانتظار
  document.getElementById('admin-setup').style.display='none';
  document.getElementById('admin-login').style.display='none';
  document.getElementById('admin-dash').style.display='none';
  document.getElementById('admin-loading').style.display='block';

  try {
    const data = await apiGet(SETTINGS_TABLE,'key=eq.admin_password_hash');
    document.getElementById('admin-loading').style.display='none';
    if(data && data.length>0 && data[0].value) {
      ADMIN_HASH = data[0].value;
      showLoginScreen();
    } else {
      showSetupScreen();
    }
  } catch(e) {
    document.getElementById('admin-loading').style.display='none';
    const local = localStorage.getItem('adm_h');
    if(local) { ADMIN_HASH=local; showLoginScreen(); }
    else showSetupScreen();
  }
}

function showLoginScreen() {
  document.getElementById('admin-setup').style.display='none';
  document.getElementById('admin-login').style.display='block';
  document.getElementById('admin-dash').style.display='none';
}
function showSetupScreen() {
  document.getElementById('admin-setup').style.display='block';
  document.getElementById('admin-login').style.display='none';
  document.getElementById('admin-dash').style.display='none';
}

async function createAdminPassword() {
  const p1=document.getElementById('setup-pass1').value;
  const p2=document.getElementById('setup-pass2').value;
  const err=document.getElementById('setup-error');
  if(!p1||p1.length<6){showAlert(err,'error','6 أحرف على الأقل');return;}
  if(p1!==p2){showAlert(err,'error','كلمتا المرور غير متطابقتين');return;}
  const h=await hashPassword(p1);
  try {
    await apiUpsert(SETTINGS_TABLE,[{key:'admin_password_hash',value:h}],'key');
    ADMIN_HASH=h;
    document.getElementById('admin-setup').style.display='none';
    enterDash();
  } catch(e) {
    showAlert(err,'error','فشل الحفظ على السيرفر: '+e.message);
  }
}

async function adminLogin() {
  const p=document.getElementById('admin-pass').value;
  const err=document.getElementById('login-error');
  if(!p){showAlert(err,'error','أدخل كلمة المرور');return;}
  const h=await hashPassword(p);
  if(h===ADMIN_HASH){ document.getElementById('admin-login').style.display='none'; enterDash(); }
  else showAlert(err,'error','كلمة المرور غير صحيحة');
}

async function changePassword() {
  const p1=document.getElementById('new-pass1').value;
  const p2=document.getElementById('new-pass2').value;
  const al=document.getElementById('pass-alert');
  if(!p1||p1.length<6){showAlert(al,'error','6 أحرف على الأقل');return;}
  if(p1!==p2){showAlert(al,'error','كلمتا المرور غير متطابقتين');return;}
  const h=await hashPassword(p1);
  try {
    await apiUpsert(SETTINGS_TABLE,[{key:'admin_password_hash',value:h}],'key');
    ADMIN_HASH=h;
    document.getElementById('new-pass1').value='';
    document.getElementById('new-pass2').value='';
    showAlert(al,'success','✅ تم تغيير كلمة المرور وحُفظت على السيرفر');
  } catch(e) {
    showAlert(al,'error','فشل الحفظ: '+e.message);
  }
}

let siteBaseUrl = "";

function enterDash() {
  document.getElementById('admin-dash').style.display='block';
  apiGet(SETTINGS_TABLE,'key=eq.site_base_url').then(data=>{
    if(data&&data.length>0&&data[0].value) {
      siteBaseUrl = data[0].value;
      document.getElementById('site-base-url').value = siteBaseUrl;
      renderSchools();
    }
  }).catch(()=>{});
  loadSchoolsList();
}

async function saveSiteUrl() {
  const url = document.getElementById('site-base-url').value.trim();
  const al = document.getElementById('url-alert');
  if(!url || !url.startsWith('http')) { showAlert(al,'error','أدخل رابط صحيح يبدأ بـ https://'); return; }
  try {
    await apiUpsert(SETTINGS_TABLE,[{key:'site_base_url',value:url}],'key');
    siteBaseUrl = url;
    showAlert(al,'success','✅ تم حفظ الرابط على السيرفر');
    setTimeout(()=>loadSchoolsList(), 400);
  } catch(e) {
    showAlert(al,'error','فشل الحفظ: '+e.message);
  }
}

function adminLogout() {
  document.getElementById('admin-dash').style.display='none';
  adminSetupDone = false;
  checkAdminSetup();
}

// ===== LOGO HELPERS =====
function previewLogo(input) {
  const file = input.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('logo-preview').src = e.target.result;
    document.getElementById('logo-preview').style.display = 'block';
    document.getElementById('modal-logo-data').value = e.target.result;
  };
  reader.readAsDataURL(file);
}
function clearLogo() {
  document.getElementById('logo-preview').src='';
  document.getElementById('logo-preview').style.display='none';
  document.getElementById('modal-logo-data').value='';
  document.getElementById('modal-logo-file').value='';
}

// ===== ID PHOTO HELPERS =====
function previewIdImage(input) {
  const file = input.files && input.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      // تصغير/ضغط الصورة قبل التخزين حتى لا يكبر حجم البيانات
      const maxW = 1000;
      const scale = Math.min(1, maxW / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
      document.getElementById('id-image-preview').src = dataUrl;
      document.getElementById('id-image-preview').style.display = 'block';
      document.getElementById('t-id-image-data').value = dataUrl;
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}
function clearIdImage() {
  document.getElementById('id-image-preview').src='';
  document.getElementById('id-image-preview').style.display='none';
  document.getElementById('t-id-image-data').value='';
  document.getElementById('t-id-image-file').value='';
}
function viewFullImage(src) {
  if(!src) return;
  const w = window.open('','_blank');
  w.document.write(`<!DOCTYPE html><html dir="rtl"><head><title>صورة الهوية</title>
  <style>body{margin:0;background:#111;display:flex;align-items:center;justify-content:center;min-height:100vh}
  img{max-width:100%;max-height:100vh}</style></head><body><img src="${src}"></body></html>`);
  w.document.close();
}

// ===== SCHOOLS =====
async function loadSchoolsList() {
  document.getElementById('schools-list').innerHTML='<div class="loading">جاري التحميل... <span class="spinner"></span></div>';
  try {
    schools = await apiGet(SCHOOL_TABLE,'order=created_at.asc');
    renderSchools();
    // update filter dropdown
    const sel=document.getElementById('filter-school');
    sel.innerHTML='<option value="">كل المدارس</option>';
    schools.forEach(s=>{
      const o=document.createElement('option');
      o.value=s.id; o.textContent=s.name; sel.appendChild(o);
    });
  } catch(e) {
    document.getElementById('schools-list').innerHTML=`<div class="loading" style="color:var(--red)">خطأ: ${e.message}<br><small>تأكد من إنشاء جدول schools في Supabase</small></div>`;
  }
}

function renderSchools() {
  const el=document.getElementById('schools-list');
  if(!schools.length){
    el.innerHTML='<div class="loading">لا توجد مدارس بعد — أضف مدرسة للبدء</div>';
    return;
  }
  el.innerHTML=schools.map(s=>{
    const link=makeSchoolLink(s.slug);
    const logoHtml = s.logo_data ? `<img src="${s.logo_data}" style="width:40px;height:40px;object-fit:contain;border-radius:6px;border:1px solid var(--border);background:white;padding:2px">` : '';
    return `
    <div class="school-item">
      <div class="school-item-header">
        <div class="school-name-badge" style="display:flex;align-items:center;gap:8px">${logoHtml}🏫 ${esc(s.name)}</div>
        <div class="school-actions">
          <button class="btn btn-sm btn-outline" onclick="openSchoolModal('${s.id}')">✏️ تعديل</button>
          <button class="btn btn-sm btn-red" onclick="deleteSchool('${s.id}','${esc(s.name)}')">🗑️</button>
        </div>
      </div>
      <div class="link-box" style="margin-bottom:8px">
        <span class="link-url">${link}</span>
        <button class="btn btn-sm btn-outline" onclick="copyText('${link}',this)">📋 نسخ</button>
      </div>
      <button class="btn btn-sm btn-gold" onclick="showQR('${esc(s.name)}','${link}')">📲 باركود QR</button>
      <div style="font-size:.8rem;color:var(--gray);margin-top:8px">نص الإقرار: ${esc(s.declaration_text.substring(0,80))}...</div>
    </div>`;
  }).join('');
}

function makeSchoolLink(slug) {
  if(siteBaseUrl) return siteBaseUrl.replace(/\/$/, '') + '?school=' + encodeURIComponent(slug);
  return '⚠️ حدد رابط الموقع من إعدادات الحساب';
}

function openSchoolModal(id) {
  editingSchoolId = id;
  document.getElementById('school-modal-alert').classList.remove('show');
  clearLogo();
  if(id) {
    const s=schools.find(x=>x.id===id);
    document.getElementById('school-modal-title').textContent='تعديل المدرسة / الجهة';
    document.getElementById('modal-school-name').value=s.name;
    document.getElementById('modal-decl-text').value=s.declaration_text;
    if(s.logo_data) {
      document.getElementById('logo-preview').src=s.logo_data;
      document.getElementById('logo-preview').style.display='block';
      document.getElementById('modal-logo-data').value=s.logo_data;
    }
  } else {
    document.getElementById('school-modal-title').textContent='إضافة مدرسة / جهة جديدة';
    document.getElementById('modal-school-name').value='';
    document.getElementById('modal-decl-text').value='أُقرّ أنا الموظف/الموظفة الموضّحة بياناته أعلاه بصحة جميع البيانات المُدخَلة، وأتعهد بأن رقم الجوال والبريد الإلكتروني المُدخَلَين هما وسيلة التواصل المعتمدة والرسمية لشخصي، وأنهما يُمثِّلان عنوان مراسلاتي الرسمي مع شركة مداد البيان المحدودة.';
  }
  document.getElementById('school-modal').classList.add('show');
}

function closeSchoolModal() {
  document.getElementById('school-modal').classList.remove('show');
  editingSchoolId=null;
}

function makeSlug(name) {
  return name.trim()
    .replace(/\s+/g,'-')
    .replace(/[^\u0600-\u06FFa-zA-Z0-9-]/g,'')
    .substring(0,40) + '-' + Date.now().toString(36);
}

async function saveSchool() {
  const name=document.getElementById('modal-school-name').value.trim();
  const decl=document.getElementById('modal-decl-text').value.trim();
  const logo=document.getElementById('modal-logo-data').value||null;
  const al=document.getElementById('school-modal-alert');
  if(!name||!decl){showAlert(al,'error','يرجى تعبئة جميع الحقول');return;}

  try {
    if(editingSchoolId) {
      await apiPatch(SCHOOL_TABLE,editingSchoolId,{name,declaration_text:decl,logo_data:logo});
      if(window._activeSchool && window._activeSchool.id === editingSchoolId) {
        setActiveSchool({...window._activeSchool, name, declaration_text: decl, logo_data: logo});
      }
    } else {
      await apiPost(SCHOOL_TABLE,{name,slug:makeSlug(name),declaration_text:decl,logo_data:logo});
    }
    closeSchoolModal();
    loadSchoolsList();
  } catch(e){
    showAlert(al,'error','خطأ: '+e.message);
  }
}

async function deleteSchool(id, name) {
  if(!confirm(`حذف مدرسة "${name}"؟\nسيتم حذف المدرسة فقط، الإقرارات لن تُحذف.`)) return;
  try {
    await apiDelete(SCHOOL_TABLE,id);
    loadSchoolsList();
  } catch(e){ alert('خطأ: '+e.message); }
}

// ===== RECORDS =====
async function loadAllRecords() {
  document.getElementById('table-body').innerHTML='<tr><td colspan="11" class="loading">جاري التحميل... <span class="spinner"></span></td></tr>';
  try {
    allRecords = await apiGet(DECL_TABLE);
    renderTable(allRecords);
    updateStats(allRecords);
  } catch(e){
    document.getElementById('table-body').innerHTML=`<tr><td colspan="11" class="loading" style="color:var(--red)">خطأ: ${e.message}</td></tr>`;
  }
}

function filterRecords() {
  const sid=document.getElementById('filter-school').value;
  const filtered = sid ? allRecords.filter(r=>r.school_id===sid) : allRecords;
  renderTable(filtered);
  updateStats(filtered);
}

function renderTable(data) {
  const tb=document.getElementById('table-body');
  if(!data.length){tb.innerHTML='<tr><td colspan="11" class="loading">لا توجد بيانات</td></tr>';return;}
  tb.innerHTML=data.map((r,i)=>`
    <tr>
      <td><strong>${i+1}</strong></td>
      <td style="font-weight:600">${esc(r.full_name)}</td>
      <td style="font-family:monospace">${esc(r.national_id)}</td>
      <td>${r.id_image ? `<img src="${r.id_image}" onclick="viewFullImage(this.src)" title="اضغط للتكبير" style="width:42px;height:42px;object-fit:cover;border-radius:6px;border:1px solid var(--border);cursor:pointer">` : '—'}</td>
      <td dir="ltr">${esc((r.phone||'').replace(/^0/,''))}</td>
      <td dir="ltr" style="font-size:.82rem">${esc(r.email)}</td>
      <td style="font-size:.85rem">${esc(r.national_address||'—')}</td>
      <td style="font-size:.85rem;font-family:monospace">${esc(r.iban||'—')}</td>
      <td style="font-size:.85rem">${esc(r.school_name||'—')}</td>
      <td style="font-size:.82rem;color:var(--gray);white-space:nowrap">${fmtDate(r.created_at)}</td>
      <td><button class="btn btn-sm btn-print" onclick='openPrint(${JSON.stringify(r).replace(/'/g,"&#39;")})'>🖨️</button></td>
    </tr>`).join('');
}

function updateStats(data) {
  document.getElementById('stat-total').textContent=data.length;
  const today=new Date().toDateString();
  const week=new Date(Date.now()-7*86400000);
  document.getElementById('stat-today').textContent=data.filter(r=>new Date(r.created_at).toDateString()===today).length;
  document.getElementById('stat-week').textContent=data.filter(r=>new Date(r.created_at)>=week).length;
}

// ===== PRINT =====
function openPrint(row) {
  currentPrint=row;
  document.getElementById('modal-print-content').innerHTML=buildPrintPreview(row);
  document.getElementById('print-modal').classList.add('show');
}

function buildPrintPreview(r) {
  const logoHtml = r.school_logo ? `<img src="${r.school_logo}" style="width:70px;height:70px;object-fit:contain;margin:0 auto 8px;display:block">` : '';
  return `<div class="print-preview">
    ${logoHtml}
    <div class="p-school">${esc(r.school_name||'—')}</div>
    <div class="p-doctitle">🛡️ إقرار وتعهد</div>
    <div class="p-info">
      <div class="p-row"><span class="p-label">الاسم الكامل:</span><span>${esc(r.full_name)}</span></div>
      <div class="p-row"><span class="p-label">رقم الهوية:</span><span dir="ltr">${esc(r.national_id)}</span></div>
      <div class="p-row"><span class="p-label">رقم الجوال:</span><span dir="ltr">${esc(r.phone)}</span></div>
      <div class="p-row"><span class="p-label">البريد الإلكتروني:</span><span dir="ltr">${esc(r.email)}</span></div>
      <div class="p-row"><span class="p-label">العنوان الوطني:</span><span>${esc(r.national_address||'—')}</span></div>
      <div class="p-row"><span class="p-label">الآيبان:</span><span dir="ltr">${esc(r.iban||'—')}</span></div>
      <div class="p-row"><span class="p-label">تاريخ الإقرار:</span><span>${fmtDate(r.created_at)}</span></div>
    </div>
    ${r.id_image ? `<div style="text-align:center;margin-bottom:16px"><div style="font-weight:700;color:var(--green-dark);margin-bottom:6px">صورة الهوية الوطنية</div><img src="${r.id_image}" style="max-width:220px;max-height:150px;object-fit:contain;border-radius:8px;border:2px solid var(--border)"></div>` : ''}
    <div class="p-decl">${esc(r.declaration_text||'')}</div>
    <div style="background:#d1fae5;border:1px solid #6ee7b7;border-radius:8px;padding:9px 14px;text-align:center;color:#065f46;font-weight:700;margin-bottom:14px">✅ وافق الموظف/الموظفة على هذا الإقرار إلكترونياً</div>
    <div class="p-sig">
      <div class="p-sigbox"><div style="font-weight:700;color:var(--gray)">توقيع الموظف/الموظفة</div><div class="p-sigline"></div><div style="font-size:.85rem;color:var(--gray)">${esc(r.full_name)}</div></div>
      <div class="p-sigbox"><div style="font-weight:700;color:var(--gray)">ختم الجهة</div><div class="p-sigline"></div><div style="font-size:.85rem;color:var(--gray)">${esc(r.school_name||'')}</div></div>
    </div>
  </div>`;
}

function doPrint() {
  const r=currentPrint;
  const w=window.open('','_blank','width=800,height=700');
  const logoHtml = r.school_logo ? `<img src="${r.school_logo}" style="width:80px;height:80px;object-fit:contain;display:block;margin:0 auto 10px">` : '';
  w.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8">
  <title>إقرار - ${esc(r.full_name)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Tajawal',sans-serif;direction:rtl;padding:35px;color:#1a1a1a;font-size:14px}
    .school{font-size:1.5rem;font-weight:800;color:#1B4332;text-align:center;margin-bottom:5px}
    .title{font-size:1.1rem;font-weight:700;color:#8B6914;text-align:center;margin-bottom:22px;border-bottom:2px solid #C9A84C;padding-bottom:10px}
    .info{background:#F5EDD8;border-radius:10px;padding:16px;margin-bottom:18px}
    .row{display:flex;gap:12px;margin-bottom:7px;line-height:1.6}
    .lbl{font-weight:700;color:#1B4332;min-width:140px}
    .decl{background:#fffef5;border:1.5px solid #C9A84C;border-radius:10px;padding:18px;text-align:center;line-height:2.3;margin-bottom:18px}
    .agreed{background:#d1fae5;border:1px solid #6ee7b7;border-radius:8px;padding:9px 14px;text-align:center;color:#065f46;font-weight:700;margin-bottom:22px}
    .sigs{display:flex;justify-content:space-between;margin-top:36px;padding-top:18px;border-top:1px dashed #e5d9c0}
    .sig{text-align:center}.sigline{width:150px;border-bottom:1.5px solid #1a1a1a;margin:32px auto 7px}
    @media print{@page{margin:15mm}}
  </style></head><body>
  ${logoHtml}
  <div class="school">${esc(r.school_name||'')}</div>
  <div class="title">🛡️ إقرار وتعهد</div>
  <div class="info">
    <div class="row"><span class="lbl">الاسم الكامل:</span><span>${esc(r.full_name)}</span></div>
    <div class="row"><span class="lbl">رقم الهوية:</span><span dir="ltr">${esc(r.national_id)}</span></div>
    <div class="row"><span class="lbl">رقم الجوال:</span><span dir="ltr">${esc(r.phone)}</span></div>
    <div class="row"><span class="lbl">البريد الإلكتروني:</span><span dir="ltr">${esc(r.email)}</span></div>
    <div class="row"><span class="lbl">العنوان الوطني:</span><span>${esc(r.national_address||'—')}</span></div>
    <div class="row"><span class="lbl">الآيبان:</span><span dir="ltr">${esc(r.iban||'—')}</span></div>
    <div class="row"><span class="lbl">تاريخ الإقرار:</span><span>${fmtDate(r.created_at)}</span></div>
  </div>
  ${r.id_image ? `<div style="text-align:center;margin-bottom:18px"><div style="font-weight:700;color:#1B4332;margin-bottom:6px">صورة الهوية الوطنية</div><img src="${r.id_image}" style="max-width:220px;max-height:150px;object-fit:contain;border-radius:8px;border:2px solid #e5d9c0"></div>` : ''}
  <div class="decl">${esc(r.declaration_text||'')}</div>
  <div class="agreed">✅ وافق الموظف/الموظفة على هذا الإقرار إلكترونياً</div>
  <div class="sigs">
    <div class="sig"><div style="font-weight:700;color:#6b7280">توقيع الموظف/الموظفة</div><div class="sigline"></div><div style="font-size:.88rem;color:#6b7280">${esc(r.full_name)}</div></div>
    <div class="sig"><div style="font-weight:700;color:#6b7280">ختم الجهة</div><div class="sigline"></div><div style="font-size:.88rem;color:#6b7280">${esc(r.school_name||'')}</div></div>
  </div>
  </body></html>`);
  w.document.close(); w.focus(); setTimeout(()=>w.print(),600);
}

// ===== EXCEL EXPORT =====
function exportExcel() {
  const sid=document.getElementById('filter-school').value;
  const data = sid ? allRecords.filter(r=>r.school_id===sid) : allRecords;
  if(!data.length){showAdminAlert('error','لا توجد بيانات للتصدير');return;}

  const schoolName = sid ? (schools.find(s=>s.id===sid)||{}).name||'الكل' : 'كل_المدارس';

  // XLS عبر HTML table — يدعم العربي 100% في Excel
  const rows = data.map((r,i)=>`
    <tr>
      <td>${i+1}</td>
      <td>${r.full_name||''}</td>
      <td style="mso-number-format:'@'">${r.national_id||''}</td>
      <td>${r.id_image ? 'مرفقة' : 'غير مرفقة'}</td>
      <td style="mso-number-format:'@'">${(r.phone||'').replace(/^0/,'')}</td>
      <td>${r.email||''}</td>
      <td>${r.national_address||''}</td>
      <td style="mso-number-format:'@'">${r.iban||''}</td>
      <td>${r.school_name||''}</td>
      <td>${fmtDate(r.created_at)}</td>
    </tr>`).join('');

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="UTF-8">
    <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
    <x:Name>إقرارات</x:Name>
    <x:WorksheetOptions><x:DisplayRightToLeft/></x:WorksheetOptions>
    </x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
    <style>
      td,th{font-family:Arial,sans-serif;font-size:12pt;border:1px solid #ccc;padding:6px}
      th{background:#1B4332;color:white;font-weight:bold}
      tr:nth-child(even) td{background:#f5f5f5}
    </style>
    </head><body dir="rtl">
    <table>
      <thead><tr>
        <th>#</th><th>الاسم الكامل</th><th>رقم الهوية</th><th>صورة الهوية</th><th>رقم الجوال</th>
        <th>البريد الإلكتروني</th><th>العنوان الوطني</th><th>الآيبان</th><th>اسم الجهة</th><th>تاريخ الإقرار</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    </body></html>`;

  const blob = new Blob(['\uFEFF'+html], {type:'application/vnd.ms-excel;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `إقرارات_${schoolName}_${new Date().toLocaleDateString('en-CA')}.xls`;
  a.click();
  URL.revokeObjectURL(a.href);
  showAdminAlert('success','✅ تم تصدير ملف Excel — افتحه مباشرة');
}

// ===== UTILS =====
function copyText(text, btn) {
  navigator.clipboard.writeText(text).then(()=>{
    const orig=btn.innerHTML; btn.innerHTML='✅ تم';
    setTimeout(()=>btn.innerHTML=orig,2000);
  });
}
function showAlert(el,type,msg){el.className=`alert alert-${type} show`;el.textContent=msg;setTimeout(()=>el.classList.remove('show'),5000)}
function showAdminAlert(type,msg){showAlert(document.getElementById('admin-alert'),type,msg)}
function esc(s){if(!s)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function fmtDate(iso){if(!iso)return'—';try{return new Date(iso).toLocaleDateString('ar-SA',{year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'})}catch{return iso}}


// ===== QR CODE =====
function showQR(name, link) {
  if(link.startsWith('⚠️')) { alert('حدد رابط الموقع أولاً من إعدادات الحساب'); return; }
  document.getElementById('qr-school-name').textContent = name;
  const container = document.getElementById('qr-container');
  container.innerHTML = '';
  // استخدم QR API
  const size = 220;
  const img = document.createElement('img');
  img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=' + size + 'x' + size + '&data=' + encodeURIComponent(link) + '&color=1B4332&bgcolor=FDF8F0';
  img.style.cssText = 'width:220px;height:220px;border-radius:12px;border:3px solid var(--border)';
  img.id = 'qr-img';
  container.appendChild(img);
  document.getElementById('qr-modal').classList.add('show');
}

function downloadQR() {
  const img = document.getElementById('qr-img');
  const name = document.getElementById('qr-school-name').textContent;
  const a = document.createElement('a');
  a.href = img.src;
  a.download = 'QR_' + name + '.png';
  a.target = '_blank';
  a.click();
}

// ===== START =====
init();
