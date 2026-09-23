/* ============================== إعداد Supabase ============================== */
const SUPABASE_URL = 'https://aztsbtuypyoevhrupeen.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF6dHNidHV5cHlvZXZocnVwZWVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0NTQ1MjAsImV4cCI6MjEwNDAzMDUyMH0.v8E5x0cjzDaXVDzp3_qc2sh_4Oz5M2ou7oubJsnlksI';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const GRADE_SUBJECTS = {
  'ثالث ابتدائي': ['لغتي','رياضيات'],
  'سادس ابتدائي': ['لغتي','رياضيات','علوم'],
  'ثالث متوسط': ['لغتي','رياضيات','علوم']
};
const LETTERS = ['أ','ب','ج','د'];

let STATE = { classes:[], students:[], exams:[], view:'classes', chart1:null, chart2:null };

function toast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 2200);
}
function pctClass(p){ return p>=80?'high':(p>=60?'mid':'low'); }
function fmt(n){ return Math.round(n*10)/10; }

/* ============================== المصادقة ============================== */
async function doLogin(){
  const email = document.getElementById('loginEmail').value.trim();
  const pass = document.getElementById('loginPass').value;
  const errBox = document.getElementById('loginError');
  errBox.textContent = '';
  const { error } = await sb.auth.signInWithPassword({ email, password: pass });
  if (error){ errBox.textContent = 'بيانات الدخول غير صحيحة'; return; }
  enterApp();
}
async function doLogout(){
  await sb.auth.signOut();
  document.getElementById('app').classList.remove('on');
  document.getElementById('loginScreen').style.display = 'flex';
}
async function checkSession(){
  const { data } = await sb.auth.getSession();
  if (data.session) enterApp(); else document.getElementById('loginScreen').style.display='flex';
}
async function enterApp(){
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('app').classList.add('on');
  await loadAll();
  renderNav();
  setView('classes');
}

/* ============================== تحميل البيانات ============================== */
async function loadAll(){
  const [c,s,e] = await Promise.all([
    sb.from('classes').select('*').order('name'),
    sb.from('students').select('*').order('name'),
    sb.from('exams').select('*').order('exam_date', {ascending:false})
  ]);
  STATE.classes = c.data || [];
  STATE.students = s.data || [];
  STATE.exams = e.data || [];
}

/* ============================== التنقل ============================== */
const NAV = [
  {id:'classes', label:'الفصول'},
  {id:'students', label:'الطلاب ونقلهم'},
  {id:'examCreate', label:'إنشاء اختبار'},
  {id:'grading', label:'تصحيح الإجابات'},
  {id:'results', label:'نتائج اختبار'},
  {id:'studentProfile', label:'ملف الطالب'},
  {id:'classTrend', label:'تطور الفصل'},
];
function renderNav(){
  const nav = document.getElementById('navList');
  nav.innerHTML = NAV.map(n=>`<button data-id="${n.id}" onclick="setView('${n.id}')">${n.label}</button>`).join('');
}
function setView(id){
  STATE.view = id;
  document.querySelectorAll('#navList button').forEach(b=>b.classList.toggle('active', b.dataset.id===id));
  const renderers = { classes:renderClasses, students:renderStudents, examCreate:renderExamCreate, grading:renderGrading, results:renderResults, studentProfile:renderStudentProfile, classTrend:renderClassTrend };
  renderers[id]();
}

/* ============================== 1) الفصول ============================== */
function renderClasses(){
  const main = document.getElementById('mainView');
  main.innerHTML = `
    <div class="viewHead"><div><h2>الفصول</h2><p class="sub">أضف فصلاً وحدد صفه الدراسي — يحدد ذلك مواد الاختبار تلقائياً</p></div></div>
    <div class="card">
      <div class="row">
        <div class="field"><label>اسم الفصل</label><input id="clsName" placeholder="مثال: سادس / 2"></div>
        <div class="field"><label>الصف</label>
          <select id="clsGrade">${Object.keys(GRADE_SUBJECTS).map(g=>`<option value="${g}">${g}</option>`).join('')}</select>
        </div>
        <button class="btn" onclick="addClass()">إضافة الفصل</button>
      </div>
    </div>
    <div class="card">
      <table><thead><tr><th>الفصل</th><th>الصف</th><th>المواد</th><th>عدد الطلاب</th><th></th></tr></thead>
      <tbody>${STATE.classes.map(c=>{
        const count = STATE.students.filter(s=>s.class_id===c.id).length;
        return `<tr><td>${c.name}</td><td><span class="tag">${c.grade}</span></td><td class="muted">${GRADE_SUBJECTS[c.grade].join(' / ')}</td><td>${count}</td>
        <td><button class="btn danger small" onclick="deleteClass('${c.id}')">حذف</button></td></tr>`;
      }).join('') || `<tr><td colspan="5" class="empty">لا توجد فصول بعد</td></tr>`}</tbody></table>
    </div>`;
}
async function addClass(){
  const name = document.getElementById('clsName').value.trim();
  const grade = document.getElementById('clsGrade').value;
  if(!name){ toast('أدخل اسم الفصل'); return; }
  const { error } = await sb.from('classes').insert({ name, grade });
  if (error){ toast('تعذّرت الإضافة'); return; }
  await loadAll(); toast('تمت إضافة الفصل'); renderClasses();
}
async function deleteClass(id){
  if(!confirm('حذف الفصل سيحذف اختباراته المرتبطة به. متابعة؟')) return;
  await sb.from('classes').delete().eq('id', id);
  await loadAll(); renderClasses();
}

/* ============================== 2) الطلاب ونقلهم ============================== */
function renderStudents(){
  const main = document.getElementById('mainView');
  const classOpts = STATE.classes.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  main.innerHTML = `
    <div class="viewHead"><div><h2>الطلاب</h2><p class="sub">أدخل أسماء الطلاب بترتيب رفع الإجابات، ويمكنك نقل الطالب بين الفصول مع بقاء كل نتائجه السابقة</p></div></div>
    <div class="card">
      <div class="row">
        <div class="field"><label>اسم الطالب</label><input id="stuName" placeholder="اسم الطالب"></div>
        <div class="field"><label>الفصل</label><select id="stuClass">${classOpts}</select></div>
        <button class="btn" onclick="addStudent()">إضافة طالب</button>
      </div>
    </div>
    <div class="card">
      <div class="row" style="margin-bottom:10px;">
        <div class="field"><label>عرض فصل</label><select id="stuFilter" onchange="renderStudents()"><option value="">كل الفصول</option>${classOpts}</select></div>
      </div>
      ${renderStudentsTable()}
    </div>`;
}
function renderStudentsTable(){
  const filter = document.getElementById('stuFilter')?.value || '';
  const list = STATE.students.filter(s=>!filter || s.class_id===filter);
  if(!list.length) return `<div class="empty">لا يوجد طلاب</div>`;
  return `<table><thead><tr><th>الاسم</th><th>الفصل الحالي</th><th>نقل إلى</th><th></th></tr></thead><tbody>
    ${list.map(s=>{
      const cls = STATE.classes.find(c=>c.id===s.class_id);
      const opts = STATE.classes.map(c=>`<option value="${c.id}" ${c.id===s.class_id?'selected':''}>${c.name}</option>`).join('');
      return `<tr><td>${s.name}</td><td><span class="tag">${cls?cls.name:'—'}</span></td>
      <td><select id="mv_${s.id}">${opts}</select></td>
      <td><button class="btn secondary small" onclick="transferStudent('${s.id}')">نقل</button>
      <button class="btn danger small" onclick="deleteStudent('${s.id}')">حذف</button></td></tr>`;
    }).join('')}
  </tbody></table>`;
}
async function addStudent(){
  const name = document.getElementById('stuName').value.trim();
  const class_id = document.getElementById('stuClass').value;
  if(!name || !class_id){ toast('أدخل الاسم واختر الفصل'); return; }
  const { error } = await sb.from('students').insert({ name, class_id });
  if(error){ toast('تعذّرت الإضافة'); return; }
  await loadAll(); document.getElementById('stuName').value=''; renderStudents(); toast('تمت الإضافة');
}
async function transferStudent(id){
  const newClass = document.getElementById('mv_'+id).value;
  await sb.from('students').update({ class_id: newClass }).eq('id', id);
  await loadAll(); renderStudents(); toast('تم نقل الطالب — نتائجه السابقة محفوظة');
}
async function deleteStudent(id){
  if(!confirm('حذف الطالب سيحذف نتائجه أيضاً. متابعة؟')) return;
  await sb.from('students').delete().eq('id', id);
  await loadAll(); renderStudents();
}

/* ============================== 3) إنشاء اختبار ============================== */
function defaultSubjectRanges(subjects, total){
  const each = Math.floor(total/subjects.length);
  let start = 1; const out = {};
  subjects.forEach((sub,i)=>{
    const end = (i===subjects.length-1) ? total : start+each-1;
    out[sub] = [start, end]; start = end+1;
  });
  return out;
}
function renderExamCreate(){
  const main = document.getElementById('mainView');
  if(!STATE.classes.length){
    main.innerHTML = `<div class="viewHead"><h2>إنشاء اختبار</h2></div><div class="empty">أضف فصلاً أولاً من تبويب "الفصول"</div>`;
    return;
  }
  main.innerHTML = `
    <div class="viewHead">
      <div>
        <h2>إنشاء اختبار</h2>
        <p class="sub">إنشاء الاختبار من داخل البرنامج — مع نمط محاكي قريب من تنظيم اختبارات نافس</p>
      </div>
    </div>

    <div class="card">
      <div class="row">
        <div class="field">
          <label>الفصل</label>
          <select id="exClass" onchange="onExamClassChange()">
            ${STATE.classes.map(c=>`<option value="${c.id}">${c.name} — ${c.grade}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>نوع الاختبار</label>
          <select id="exMode" onchange="onExamModeChange()">
            <option value="nafs3" selected>محاكي نافس — ثالث ابتدائي</option>
            <option value="normal">اختبار عادي</option>
          </select>
        </div>
        <div class="field">
          <label>اسم الاختبار</label>
          <input id="exName" placeholder="مثال: اختبار نافس التجريبي 1">
        </div>
        <div class="field">
          <label>التاريخ</label>
          <input id="exDate" type="date">
        </div>
        <div class="field">
          <label>عدد الأسئلة</label>
          <select id="exTotal" onchange="rebuildSubjectRanges()">
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="30">30</option>
            <option value="40" selected>40</option>
            <option value="50">50</option>
            <option value="60">60</option>
          </select>
        </div>
        <div class="field" style="flex-direction:row;align-items:center;gap:6px;margin-top:18px;">
          <input type="checkbox" id="exSim" checked style="width:auto;">
          <label style="margin:0;">محاكي نافس</label>
        </div>
      </div>

      <div id="nafsInfo" class="card" style="margin-top:14px;background:#f7fbfa;border-color:#cfe2df;">
        <div style="font-weight:700;margin-bottom:6px;">نمط نافس — الصف الثالث الابتدائي</div>
        <div class="muted">ورقة الإجابة ثابتة دائمًا على 60 سؤالًا. أنت تحدد عدد أسئلة الاختبار التدريبي: 10 أو 20 أو 30 أو 40 أو 50 أو 60.</div>
        <div class="muted" style="margin-top:4px;">البرنامج مخصص للتصحيح والتدريب: تحدد عدد الأسئلة ومفتاح الإجابة، وتستخدم ورقة الإجابة الثابتة نفسها في جميع الصفوف.</div>
      </div>

      <div id="subjectRangesBox" style="margin-top:14px;"></div>
    </div>

    <div class="card">
      <h3 style="font-size:15px;">نموذج الإجابة الصحيحة</h3>
      <p class="muted">اضغط الحرف الصحيح لكل سؤال</p>
      <div id="keyGrid" class="bubbleGrid"></div>
      <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn" onclick="saveExam()">حفظ الاختبار</button>
        <button class="btn secondary" onclick="printFixedOMR()">طباعة ورقة الإجابة 60 سؤال</button>
        <button class="btn secondary" onclick="setView('classes')">إلغاء</button>
      </div>
    </div>`;
  document.getElementById('exDate').valueAsDate = new Date();
  onExamModeChange();
}

let EX_KEY = {};

function onExamModeChange(){
  const mode = document.getElementById('exMode')?.value || 'nafs3';
  const total = document.getElementById('exTotal');
  const sim = document.getElementById('exSim');
  const info = document.getElementById('nafsInfo');
  const cls = STATE.classes.find(c=>c.id===document.getElementById('exClass')?.value);

  if(mode === 'nafs3'){
    total.disabled = false;
    sim.checked = true;
    sim.disabled = true;
    info.style.display = '';
    document.getElementById('exName').placeholder = 'مثال: اختبار نافس التجريبي 1';
  }else{
    total.disabled = false;
    sim.disabled = false;
    info.style.display = 'none';
    document.getElementById('exName').placeholder = 'مثال: اختبار الأسبوع 3';
  }
  rebuildSubjectRanges();
}

function onExamClassChange(){
  onExamModeChange();
}

function rebuildSubjectRanges(){
  const cls = STATE.classes.find(c=>c.id===document.getElementById('exClass').value);
  const mode = document.getElementById('exMode')?.value || 'nafs3';
  const total = parseInt(document.getElementById('exTotal').value)||40;
  let subs, ranges;

  if(mode === 'nafs3'){
    // v13 fix: was hardcoded to قراءة=1-20 / رياضيات=21-40 regardless of the
    // selected total. That's correct only when total=40 — for any other
    // question count (10/20/30/50/60) the رياضيات range either ran past the
    // exam's actual last question or missed questions entirely. Now scales
    // with the same even-split logic used for non-simulator exams.
    subs = ['قراءة','رياضيات'];
    ranges = defaultSubjectRanges(subs, total);
  }else{
    subs = GRADE_SUBJECTS[cls.grade] || ['مادة 1'];
    ranges = defaultSubjectRanges(subs, total);
  }

  const box = document.getElementById('subjectRangesBox');
  box.innerHTML = `<div class="row">${subs.map(s=>`
    <div class="field"><label>${s} — من</label><input type="number" id="rs_${s}" value="${ranges[s][0]}" min="1" style="width:80px;"></div>
    <div class="field"><label>${s} — إلى</label><input type="number" id="re_${s}" value="${ranges[s][1]}" min="1" style="width:80px;"></div>
  `).join('')}</div>`;
  box.dataset.subjects = JSON.stringify(subs);
  EX_KEY = {};
  buildKeyGrid(total);
}

function buildKeyGrid(total){
  const grid = document.getElementById('keyGrid');
  let html = '';
  for(let q=1;q<=total;q++){
    html += `<div class="qrow"><span class="qnum">${q}</span>${LETTERS.map(l=>`<button class="opt" id="k_${q}_${l}" onclick="setKey(${q},'${l}')">${l}</button>`).join('')}</div>`;
  }
  grid.innerHTML = html;
}
function setKey(q,l){
  EX_KEY[q]=l;
  LETTERS.forEach(x=>document.getElementById(`k_${q}_${x}`).classList.toggle('sel', x===l));
}

async function saveExam(){
  const class_id = document.getElementById('exClass').value;
  const name = document.getElementById('exName').value.trim();
  const exam_date = document.getElementById('exDate').value;
  const total_questions = parseInt(document.getElementById('exTotal').value)||0;
  const mode = document.getElementById('exMode')?.value || 'normal';
  const is_simulated = mode === 'nafs3' ? true : document.getElementById('exSim').checked;
  const subs = JSON.parse(document.getElementById('subjectRangesBox').dataset.subjects);

  if(!name || !exam_date){ toast('أكمل اسم الاختبار والتاريخ'); return; }
  if(Object.keys(EX_KEY).length !== total_questions){ toast('أكمل نموذج الإجابة لكل الأسئلة'); return; }

  const subjects = {};
  subs.forEach(s=>{
    subjects[s]=[
      parseInt(document.getElementById('rs_'+s).value),
      parseInt(document.getElementById('re_'+s).value)
    ];
  });

  const { data: savedExam, error } = await sb.from('exams').insert({
    class_id,
    name,
    exam_date,
    total_questions,
    subjects,
    answer_key: EX_KEY,
    is_simulated
  }).select().single();
  if(error){ console.error(error); toast('تعذّر حفظ الاختبار'); return; }
  await loadAll();
  toast('تم حفظ الاختبار');
  if(confirm('تم حفظ الاختبار. هل تريد طباعة ورقة الإجابة الثابتة 60 سؤال الآن؟')){
    printFixedOMR();
  }
  setView('grading');
}

/* ============================== 3B) طباعة ورقة الإجابة الثابتة ============================== */
function printFixedOMR(){
  const w=window.open('','_blank','width=900,height=1100');
  if(!w){ toast('اسمح بالنوافذ المنبثقة للطباعة'); return; }
  w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>ورقة إجابة 60 سؤال</title>
  <style>
    @page{size:A4 portrait;margin:0}
    html,body{margin:0;padding:0;width:210mm;height:297mm;background:#fff;overflow:hidden}
    .page{width:210mm;height:297mm;display:flex;align-items:center;justify-content:center;overflow:hidden}
    img{display:block;width:auto;height:297mm;max-width:210mm;object-fit:contain}
    button{position:fixed;top:10px;left:10px;padding:8px 14px;z-index:5}
    @media print{button{display:none}}
  </style></head><body>
  <div class="page"><img id="sheet" src="${OMR_TEMPLATE_PNG}" alt="ورقة إجابة ثابتة 60 سؤال"></div>
  <button onclick="window.print()">طباعة</button>
  <script>window.onload=()=>setTimeout(()=>window.print(),500);<\/script></body></html>`);
  w.document.close();
}

async function deleteExam(examId){
  const exam = STATE.exams.find(e=>e.id===examId);
  if(!exam){ toast('اختر اختبارًا أولاً'); return; }
  if(!confirm(`متأكد من حذف اختبار "${exam.name}"؟ سيتم حذف كل النتائج وأوراق الإجابة المرتبطة به نهائيًا، ولا يمكن التراجع.`)) return;
  try{
    // Best-effort cleanup of any uploaded sheet images before removing the DB rows.
    try{
      const { data: files } = await sb.storage.from('exam-sheets').list(examId);
      if(files && files.length){
        await sb.storage.from('exam-sheets').remove(files.map(f=>`${examId}/${f.name}`));
      }
    }catch(storageErr){ console.warn('تعذر حذف صور الأوراق من التخزين:', storageErr); }

    const { error: e1 } = await sb.from('results').delete().eq('exam_id', examId);
    if(e1) throw e1;
    const { error: e2 } = await sb.from('exam_sheets').delete().eq('exam_id', examId);
    if(e2) throw e2;
    const { error: e3 } = await sb.from('exams').delete().eq('id', examId);
    if(e3) throw e3;

    toast('تم حذف الاختبار');
    await loadAll();
    setView('grading');
  }catch(err){
    console.error(err);
    toast('تعذر حذف الاختبار: ' + (err.message||'خطأ غير معروف'));
  }
}

/* ============================== حساب الدرجات ============================== */
function computeScore(answers, exam){
  const key = exam.answer_key;
  let correct = 0;
  const subjectScores = {};
  Object.entries(exam.subjects).forEach(([subj,[s,e]])=>{
    let c=0, t=0;
    for(let q=s;q<=e;q++){ t++; if(answers[q] && answers[q]===key[q]) c++; }
    subjectScores[subj] = { correct:c, total:t, percent: t? fmt(c/t*100):0 };
    correct += c;
  });
  const total_percent = exam.total_questions ? fmt(correct/exam.total_questions*100) : 0;
  return { correct, total_percent, subjectScores };
}

/* ============================== 4) تصحيح الإجابات ============================== */
let CUR_ANSWERS = {};
function renderGrading(){
  const main = document.getElementById('mainView');
  if(!STATE.exams.length){
    main.innerHTML = `<div class="viewHead"><h2>تصحيح الإجابات</h2></div><div class="empty">أنشئ اختباراً أولاً</div>`;
    return;
  }

  main.innerHTML = `
    <div class="viewHead">
      <div>
        <h2>تصحيح الإجابات</h2>
        <p class="sub">ارفع أوراق الإجابة بالترتيب نفسه لقائمة الطلاب. يدعم الاختبار 10 أو 20 أو 30 أو 40 أو 50 أو 60 سؤالًا، وتُقرأ أول أسئلة الاختبار من نموذج الـOMR تلقائيًا.</p>
      </div>
    </div>

    <div class="card">
      <div class="field" style="max-width:640px;">
        <label>الاختبار</label>
        <div style="display:flex;gap:8px;">
          <select id="gExam" onchange="onGradingExamChange()" style="flex:1;">
            ${STATE.exams.map(e=>{
              const c = STATE.classes.find(c=>c.id===e.class_id);
              return `<option value="${e.id}">${e.name} — ${c?c.name:''} — ${e.exam_date}</option>`;
            }).join('')}
          </select>
          <button class="btn secondary" style="white-space:nowrap;color:var(--danger);" onclick="deleteExam(document.getElementById('gExam').value)">
            حذف الاختبار
          </button>
        </div>
      </div>
    </div>

    <div id="gradingBody"></div>

    <div class="card">
      <h3 style="font-size:15px;">رفع أوراق الإجابة وتصحيحها</h3>
      <p class="muted">
        اختر صور أوراق الطلاب بالترتيب: الصورة الأولى للطالب الأول، والثانية للطالب الثاني، وهكذا.
        يدعم الرفع أيضًا ملف PDF واحد من السكانر يحتوي كل الأوراق — سيتم تقسيم صفحاته تلقائيًا وربطها بالطلاب بنفس ترتيبهم في القائمة.
        سيتم حفظ الصور في Supabase Storage وربط كل ورقة بالطالب. الأوراق الواضحة تُصحح وتُعتمد تلقائيًا، والمشكوك فيها فقط تظهر للمراجعة.<br><b>لأفضل دقة:</b> اطبع الورقة من البرنامج نفسه، وامسحها كاملة على السكانر بدقة 300 DPI، بالأبيض والأسود أو الرمادي، ولا تقص الحواف.
      </p>

      <div class="omr-upload">
        <input id="omrFiles" type="file" accept="image/*,application/pdf" multiple
               onchange="previewOMRFiles()">

        <div id="omrFileInfo" class="muted" style="margin-top:8px;">
          لم يتم اختيار ملفات
        </div>

        <div id="omrPreviewGrid" class="omr-preview-grid"></div>
         <div id="omrDebugBox" class="omr-debug" style="display:none;"></div>

        <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn" onclick="uploadAndProcessOMR()">
            رفع الأوراق وقراءة الإجابات
          </button>
          <button class="btn secondary" onclick="clearOMRFiles()">
            مسح الصور
          </button>
        </div>

        <div id="omrProcessMsg" class="muted" style="margin-top:10px;"></div>
      </div>
    </div>
  `;

  onGradingExamChange();
}

/* ---- غياب الطلاب: لو الطالب غايب مفيش ورقة إجابة ليه، فلازم يتشال من
   ترتيب مطابقة الصور بالطلاب علشان اللي بعده متزحزحش. الحالة دي بتتخزن في
   exam_sheets بنفس الأعمدة المستخدمة بالفعل (status:'absent') من غير أي
   تعديل في قاعدة البيانات. ---- */
let EXAM_ABSENT = new Set();
async function loadAbsentees(examId){
  EXAM_ABSENT = new Set();
  const { data, error } = await sb.from('exam_sheets').select('student_id,status').eq('exam_id', examId).eq('status','absent');
  if(!error && data) data.forEach(r=>EXAM_ABSENT.add(r.student_id));
}
async function toggleAbsent(examId, studentId, isAbsent){
  try{
    if(isAbsent){
      const payload={exam_id:examId,student_id:studentId,status:'absent',sheet_order:null,image_path:null,
        detected_answers:null,confidence:null,review_questions:null,requires_review:false,
        error_message:null,processed_at:new Date().toISOString(),approved_at:null};
      const {error}=await sb.from('exam_sheets').upsert(payload,{onConflict:'exam_id,student_id'});
      if(error)throw error;
      // لو كان له نتيجة سابقة اتسجلت غلط قبل ما يتعلم غيابه، نشيلها.
      await sb.from('results').delete().eq('exam_id',examId).eq('student_id',studentId);
      EXAM_ABSENT.add(studentId);
    }else{
      const {error}=await sb.from('exam_sheets').delete().eq('exam_id',examId).eq('student_id',studentId).eq('status','absent');
      if(error)throw error;
      EXAM_ABSENT.delete(studentId);
    }
  }catch(e){
    console.error(e);
    toast('تعذر تسجيل حالة الغياب: '+(e.message||''));
  }
  await onGradingExamChange();
  const grid=document.getElementById('omrPreviewGrid');
  if(grid && OMR_SELECTED_FILES.length){
    // أعِد رسم "الطالب المقابل" تحت كل صورة بعد تغيّر قائمة الحاضرين
    OMR_SELECTED_FILES.forEach((file,i)=>{
      const student=getCurrentExamStudents()[i];
      const el=grid.children[i]?.querySelector('.omr-status');
      if(el) el.innerHTML=`الطالب: <b>${student?escapeHtml(student.name):'لا يوجد طالب مقابل'}</b>`;
    });
  }
}
async function onGradingExamChange(){
  const exam = STATE.exams.find(e=>e.id===document.getElementById('gExam').value);
  const cls = STATE.classes.find(c=>c.id===exam.class_id);
  const students = STATE.students.filter(s=>s.class_id===exam.class_id);
  const { data: results } = await sb.from('results').select('*').eq('exam_id', exam.id);
  const resultMap = {}; (results||[]).forEach(r=>resultMap[r.student_id]=r);
  await loadAbsentees(exam.id);
  const body = document.getElementById('gradingBody');
  if(!students.length){ body.innerHTML = `<div class="empty">لا يوجد طلاب في فصل "${cls.name}"</div>`; return; }
  let presentOrder = 0;
  body.innerHTML = `<div class="card">
  <p class="muted" style="margin-bottom:8px;">علّم مربع "غائب" لأي طالب غير موجود <b>قبل رفع الصور</b>، وسيتم تخطّي اسمه تلقائيًا عند مطابقة الصور بالطلاب فلا تتزحزح باقي الأوراق.</p>
  <div id="studentList">
    ${students.map((s,i)=>{
      const r = resultMap[s.id];
      const isAbsent = EXAM_ABSENT.has(s.id);
      const orderLabel = isAbsent ? '—' : String(++presentOrder)+'.';
      return `<div class="studentRow"${isAbsent?' style="opacity:.6"':''}>
        <div><b>${orderLabel} ${s.name}</b> ${isAbsent?'<span class="tag" style="background:#f4e2dc;color:var(--danger);">غائب</span>':(r?`<span class="tag">${r.correct_count}/${exam.total_questions} — ${fmt(r.total_percent)}%</span>`:'<span class="muted">لم تُعتمد النتيجة</span>')}</div>
        <label style="display:flex;align-items:center;gap:6px;font-size:12.5px;color:#5c564b;cursor:pointer;">
          <input type="checkbox" ${isAbsent?'checked':''} onchange="toggleAbsent('${exam.id}','${s.id}',this.checked)">
          غائب
        </label>
      </div>`;
    }).join('')}
  </div></div>
  <div id="answerEntryBox"></div>`;
  renderOMRSheets(exam.id);
}


/* ============================================================
   OMR — رفع أوراق الإجابة وربطها بالطلاب
   ============================================================ */

let OMR_SELECTED_FILES = [];

/* ---- PDF support: a scanner usually produces ONE PDF with every student's
   sheet as a separate page, in the same order as the class list. We split it
   into one high-resolution image per page and feed those into the exact same
   pipeline used for individual photos — nothing downstream needs to know the
   image originally came from a PDF. ---- */
let PDFJS_READY = false;
function waitForPdfJs(timeoutMs=15000){
  return new Promise((resolve,reject)=>{
    if(window.pdfjsLib){
      if(!PDFJS_READY){
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
        PDFJS_READY = true;
      }
      resolve(true); return;
    }
    const t0=Date.now();
    const timer=setInterval(()=>{
      if(window.pdfjsLib){
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
        PDFJS_READY = true; clearInterval(timer); resolve(true);
      } else if(Date.now()-t0>timeoutMs){
        clearInterval(timer); reject(new Error('تعذر تحميل محرك قراءة PDF. تأكد من اتصال الإنترنت ثم أعد المحاولة.'));
      }
    },100);
  });
}
async function pdfFileToImageFiles(file){
  await waitForPdfJs();
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({data:buf}).promise;
  const baseName = file.name.replace(/\.pdf$/i,'');
  const out = [];
  for(let p=1;p<=pdf.numPages;p++){
    const page = await pdf.getPage(p);
    // Scale 2.5x a typical scan's native size so bubble sampling has enough
    // pixel resolution — matches the resolution the OMR templates expect.
    const SCANNER_DPI=300; const viewport = page.getViewport({scale:SCANNER_DPI/72});
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d',{willReadFrequently:true});
    await page.render({canvasContext:ctx, viewport}).promise;
    const blob = await new Promise(res=>canvas.toBlob(res,'image/png',0.95));
    out.push(new File([blob], `${baseName}_ص${String(p).padStart(2,'0')}.png`, {type:'image/png'}));
  }
  return out;
}

async function previewOMRFiles(){
  const input = document.getElementById('omrFiles');
  const grid = document.getElementById('omrPreviewGrid');
  const info = document.getElementById('omrFileInfo');
  const rawFiles = Array.from(input.files || []);

  if(!rawFiles.length){
    OMR_SELECTED_FILES = [];
    info.textContent = 'لم يتم اختيار ملفات';
    grid.innerHTML = '';
    return;
  }

  const hasPdf = rawFiles.some(f=>f.type==='application/pdf' || /\.pdf$/i.test(f.name));
  if(hasPdf) info.textContent = 'جارٍ تفكيك ملف/ملفات الـPDF إلى صفحات...';
  grid.innerHTML = '';

  // TIFF is a very common default output from flatbed scanner drivers, but no
  // mainstream browser can decode/display it. Catch this immediately instead
  // of letting every single sheet fail silently during processing.
  const tiffFiles = rawFiles.filter(f=>/\.tiff?$/i.test(f.name) || f.type==='image/tiff');
  if(tiffFiles.length){
    toast(`صيغة TIFF غير مدعومة (${tiffFiles.length} ملف). أعد الحفظ من برنامج السكانر بصيغة JPG أو PNG أو PDF.`);
  }

  const expanded = [];
  for(const f of rawFiles){
    if(/\.tiff?$/i.test(f.name) || f.type==='image/tiff') continue; // skip — see warning above
    if(f.type==='application/pdf' || /\.pdf$/i.test(f.name)){
      try{
        const pages = await pdfFileToImageFiles(f);
        expanded.push(...pages);
      }catch(e){
        console.error(e);
        toast(`تعذر فتح ملف PDF "${f.name}": ${e.message||''}`);
      }
    } else {
      expanded.push(f);
    }
  }

  OMR_SELECTED_FILES = expanded;

  if(!OMR_SELECTED_FILES.length){
    info.textContent = 'لم يتم التعرف على أي ورقة صالحة';
    return;
  }

  info.textContent = `تم تجهيز ${OMR_SELECTED_FILES.length} ورقة. سيتم ربطها بالطلاب حسب الترتيب.`;

  OMR_SELECTED_FILES.forEach((file, i)=>{
    const url = URL.createObjectURL(file);
    const student = getCurrentExamStudents()[i];

    const div = document.createElement('div');
    div.className = 'omr-preview';
    div.innerHTML = `
      <img src="${url}" alt="ورقة ${i+1}">
      <div class="omr-name"><b>${i+1}.</b> ${escapeHtml(file.name)}</div>
      <div class="omr-status">
        الطالب: <b>${student ? escapeHtml(student.name) : 'لا يوجد طالب مقابل'}</b>
      </div>\n         <div class="omr-preview-actions">\n           <button class="btn secondary small" onclick="document.getElementById('omrDebugBox').style.display='block';showOMRDebug(${i})">فحص المحاذاة</button>\n         </div>
    `;
    grid.appendChild(div);
  });
}

function clearOMRFiles(){
  OMR_SELECTED_FILES = [];
  const input = document.getElementById('omrFiles');
  const grid = document.getElementById('omrPreviewGrid');
  const info = document.getElementById('omrFileInfo');
  const msg = document.getElementById('omrProcessMsg');

  if(input) input.value = '';
  if(grid) grid.innerHTML = '';
  if(info) info.textContent = 'لم يتم اختيار ملفات';
  if(msg) msg.textContent = '';
}

function escapeHtml(value){
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#039;'
  }[ch]));
}

function getCurrentExamStudents(){
  const exam = STATE.exams.find(e=>e.id===document.getElementById('gExam')?.value);
  if(!exam) return [];
  // الطلاب الغائبون متشالين من الترتيب هنا علشان الصورة رقم i تفضل مطابقة
  // لأول طالب حاضر لسه ملوش ورقة، مش بترقيم القائمة الكاملة.
  return STATE.students.filter(s=>s.class_id===exam.class_id && !EXAM_ABSENT.has(s.id));
}

/* ============================== OMR ENGINE ============================== */
let OMR_CV_READY = false;
function waitForOpenCV(timeoutMs=20000){
  return new Promise((resolve,reject)=>{
    const t0=Date.now();
    const timer=setInterval(()=>{
      if(window.cv && cv.Mat){
        OMR_CV_READY=true; clearInterval(timer); resolve(true);
      } else if(Date.now()-t0>timeoutMs){
        clearInterval(timer); reject(new Error('تعذر تحميل محرك قراءة الصور. تأكد من اتصال الإنترنت ثم أعد المحاولة.'));
      }
    },100);
  });
}
function loadImageElement(file){
  return new Promise((resolve,reject)=>{
    const img=new Image();
    const url=URL.createObjectURL(file);
    img.onload=()=>{URL.revokeObjectURL(url);resolve(img);};
    img.onerror=()=>{
      URL.revokeObjectURL(url);
      const isTiff = /\.tiff?$/i.test(file.name) || file.type==='image/tiff';
      reject(new Error(isTiff
        ? `تعذر فتح "${file.name}": صيغة TIFF غير مدعومة من المتصفح. احفظ الورقة من برنامج السكانر بصيغة JPG أو PNG أو PDF بدلاً منها.`
        : `تعذر فتح صورة الورقة "${file.name}" — الملف تالف أو بصيغة غير مدعومة من المتصفح.`));
    };
    img.src=url;
  });
}
function orderQuad(pts){
  const sum=pts.map(p=>p.x+p.y), diff=pts.map(p=>p.x-p.y);
  return [pts[sum.indexOf(Math.min(...sum))],pts[diff.indexOf(Math.max(...diff))],pts[sum.indexOf(Math.max(...sum))],pts[diff.indexOf(Math.min(...diff))]];
}
function findPageQuad(src){
  let gray=null,blur=null,edges=null,contours=null,hierarchy=null,best=null,bestArea=0;
  try{
    gray=new cv.Mat(); blur=new cv.Mat(); edges=new cv.Mat(); contours=new cv.MatVector(); hierarchy=new cv.Mat();
    cv.cvtColor(src,gray,cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray,blur,new cv.Size(5,5),0,0,cv.BORDER_DEFAULT);
    cv.Canny(blur,edges,45,140);
    const kernel=cv.Mat.ones(3,3,cv.CV_8U); cv.dilate(edges,edges,kernel); kernel.delete();
    cv.findContours(edges,contours,hierarchy,cv.RETR_LIST,cv.CHAIN_APPROX_SIMPLE);
    const areaImg=src.cols*src.rows;
    for(let i=0;i<contours.size();i++){
      const c=contours.get(i), peri=cv.arcLength(c,true), approx=new cv.Mat();
      cv.approxPolyDP(c,approx,0.025*peri,true);
      const area=Math.abs(cv.contourArea(approx));
      if(approx.rows===4 && area>areaImg*0.30 && area>bestArea){
        const pts=[]; for(let j=0;j<4;j++) pts.push({x:approx.intAt(j,0),y:approx.intAt(j,1)});
        best=orderQuad(pts); bestArea=area;
      }
      approx.delete();c.delete();
    }
    return best;
  } finally {[gray,blur,edges,contours,hierarchy].forEach(x=>{try{x&&x.delete()}catch(e){}});}
}
function correctIllumination(srcGray){
  // Phone photos of a paper sheet almost always carry a large-scale shading
  // gradient (shadow from the hand/phone, page curl, uneven room light).
  // That gradient is much bigger than a single bubble, so we estimate it by
  // heavily blurring the image (its "local background") and dividing the
  // original by that background. This flattens the lighting across the whole
  // sheet BEFORE we ever compare bubble darkness values.
  const bg=new cv.Mat();
  let k=Math.round(Math.min(srcGray.rows,srcGray.cols)/10);
  if(k%2===0) k+=1;
  if(k<31) k=31;
  cv.GaussianBlur(srcGray,bg,new cv.Size(k,k),0,0,cv.BORDER_REPLICATE);

  const srcF=new cv.Mat(),bgF=new cv.Mat(),divF=new cv.Mat(),out=new cv.Mat();
  srcGray.convertTo(srcF,cv.CV_32F);
  bg.convertTo(bgF,cv.CV_32F,1,1); // +1 avoids division by zero
  cv.divide(srcF,bgF,divF,255);
  divF.convertTo(out,cv.CV_8U);

  bg.delete(); srcF.delete(); bgF.delete(); divF.delete();
  return out;
}
function normalizeOMRGray(srcGray){
  // Step 1: flatten large-scale shading/curl/lighting gradients from the photo.
  const flat=correctIllumination(srcGray);
  // Step 2: normalize the resulting contrast range, then enhance local contrast.
  const norm=new cv.Mat();
  cv.normalize(flat,norm,0,255,cv.NORM_MINMAX);
  flat.delete();
  try{
    const clahe=cv.createCLAHE(2.0,new cv.Size(8,8));
    const eq=new cv.Mat();
    clahe.apply(norm,eq);
    clahe.delete(); norm.delete();
    return eq;
  }catch(e){
    return norm;
  }
}
function findFiducialMarks(src){
  // Looks for 4 solid black corner marks printed on the sheet (one per image
  // quadrant) and returns their centers as [topLeft, topRight, bottomRight,
  // bottomLeft]. Solid printed ink is far more reliable to lock onto than the
  // outer page edge: it doesn't depend on background contrast, survives a
  // cropped photo of just the answer area, and is immune to shadows along the
  // page boundary. Returns null unless a confident candidate is found in ALL
  // four quadrants (a partial fix is worse than none — it would silently warp
  // the whole grid off-position).
  const gray=new cv.Mat(), th=new cv.Mat(), contours=new cv.MatVector(), hierarchy=new cv.Mat();
  try{
    cv.cvtColor(src,gray,cv.COLOR_RGBA2GRAY);
    // Solid ink is much darker than pencil marks, printed guide outlines, or
    // paper shadow — a fixed low cut isolates it cleanly.
    cv.threshold(gray,th,60,255,cv.THRESH_BINARY_INV);
    cv.findContours(th,contours,hierarchy,cv.RETR_EXTERNAL,cv.CHAIN_APPROX_SIMPLE);
    const W=src.cols,H=src.rows,candidates=[];
    for(let i=0;i<contours.size();i++){
      const c=contours.get(i);
      const area=cv.contourArea(c);
      const r=cv.boundingRect(c);
      c.delete();
      if(area<25) continue; // dust/noise speck
      const boxArea=r.width*r.height;
      if(boxArea<=0) continue;
      const fill=area/boxArea; // ~1 for a solid filled circle/square, low for outlines/text
      const aspect=r.width/r.height;
      if(fill<0.6) continue;
      if(aspect<0.6||aspect>1.6) continue; // reject thin lines/strokes
      if(r.width>W*0.08||r.height>H*0.08) continue; // reject large regions (page border, boxes)
      candidates.push({cx:r.x+r.width/2,cy:r.y+r.height/2});
    }
    const quadrants=[
      {test:p=>p.cx<W/2&&p.cy<H/2, corner:{x:0,y:0}},
      {test:p=>p.cx>=W/2&&p.cy<H/2, corner:{x:W,y:0}},
      {test:p=>p.cx>=W/2&&p.cy>=H/2, corner:{x:W,y:H}},
      {test:p=>p.cx<W/2&&p.cy>=H/2, corner:{x:0,y:H}}
    ];
    const picked=[];
    for(const q of quadrants){
      const inQ=candidates.filter(q.test);
      if(!inQ.length) return null;
      // The real fiducial sits closest to the physical page corner; stray
      // ink/noise elsewhere in the quadrant sits further from it.
      inQ.sort((a,b)=>((a.cx-q.corner.x)**2+(a.cy-q.corner.y)**2)-((b.cx-q.corner.x)**2+(b.cy-q.corner.y)**2));
      picked.push({x:inQ[0].cx,y:inQ[0].cy});
    }
    return picked;
  } finally {
    try{gray.delete();th.delete();contours.delete();hierarchy.delete();}catch(e){}
  }
}
// TODO: measure this once on the finished master template — how far (in
// pixels, at the OMR_FULL/OMR_CROP template's own width) the CENTER of a
// corner mark sits from the true page edge, averaged over the 4 corners.
// Until it's measured, marks are treated as sitting exactly at the page
// edge (0 inset), which will leave the whole grid off by a small constant
// offset equal to the real inset. Send the clean master sheet image and
// this gets set precisely instead of guessed.
const FIDUCIAL_INSET_PX=0;

function warpImage(src,W,H){
  // Prefer printed corner fiducial marks when all 4 are found — see
  // findFiducialMarks for why that's more reliable than the page-edge quad.
  // Fall back to detecting the outer page edge, then to a plain resize.
  const fid=findFiducialMarks(src);
  const quad=fid||findPageQuad(src);
  if(!quad){
    const out=new cv.Mat();
    cv.resize(src,out,new cv.Size(W,H),0,0,cv.INTER_AREA);
    return {mat:out,warped:false};
  }
  const inset=fid?Math.round(FIDUCIAL_INSET_PX*(W/OMR_FULL.W)):0;
  const srcTri=cv.matFromArray(4,1,cv.CV_32FC2,quad.flatMap(p=>[p.x,p.y]));
  const dstTri=cv.matFromArray(4,1,cv.CV_32FC2,[inset,inset, W-1-inset,inset, W-1-inset,H-1-inset, inset,H-1-inset]);
  const M=cv.getPerspectiveTransform(srcTri,dstTri),out=new cv.Mat();
  cv.warpPerspective(src,out,M,new cv.Size(W,H),cv.INTER_LINEAR,cv.BORDER_REPLICATE);
  srcTri.delete();dstTri.delete();M.delete();
  return {mat:out,warped:true,usedFiducials:!!fid};
}

/*
 * نموذج الورقة الحقيقي: 4 أعمدة، كل عمود 15 سؤالًا رأسيًا.
 * داخل كل سؤال ترتيب الخيارات على الورقة من اليمين إلى اليسار:
 * أ ثم ب ثم ج ثم د.
 * لذلك xs[] هنا أيضًا من أقصى اليمين إلى اليسار.
 */
const OMR_LABELS=['أ','ب','ج','د'];

/* ================================================================
   OMR PRO V4 — MASTER-GRID REGISTRATION
   The printed sheet itself is the geometry master.
   4 corner fiducials -> exact 1125x1625 master canvas -> fixed bubble grid.
   No Hough clustering is allowed to move an answer column.
   ================================================================ */
const OMR_FULL={
  W:1125,H:1625,
  // exact bubble centers measured from the supplied master PDF raster
  groups:[
    {xs:[1037,992,947,902]}, // 1-15  : أ ب ج د (right -> left)
    {xs:[759,714,669,624]},  // 16-30
    {xs:[482,437,392,347]},  // 31-45
    {xs:[204,159,114,69]}    // 46-60
  ],
  // first row has a larger gap below the option header; the remaining rows
  // follow the printed master exactly rather than one guessed dy.
  ys:[966.25,1007.25,1046.25,1086.25,1124.75,1162.25,1202.25,1241.25,1280.75,1320.25,1357.50,1397.25,1434.25,1474.75,1513.50],
  radius:15,
  fiducials:[{x:38.0,y:38.9},{x:1084.6,y:38.9},{x:1084.6,y:1588.0},{x:38.0,y:1588.0}]
};

/* Kept only as a fallback for a photo cropped so tightly that the corner
   registration marks are gone. Normal full-page student photos use OMR_FULL. */
const OMR_CROP={W:1100,H:840,groups:[
  {xs:[1099,1034,987,940]},{xs:[810,745,696,652]},
  {xs:[519,454,407,366]},{xs:[226,164,117,69]}],
  y0:106,dy:40.7,innerRadius:7};

function clampOMR(v,a,b){return Math.max(a,Math.min(b,v));}
function grayFromOMR(mat){
  const g=new cv.Mat();
  if(mat.channels()===4) cv.cvtColor(mat,g,cv.COLOR_RGBA2GRAY);
  else if(mat.channels()===3) cv.cvtColor(mat,g,cv.COLOR_RGB2GRAY);
  else mat.copyTo(g);
  return g;
}

function findFiducialMarks(src){
  const gray=new cv.Mat(),th=new cv.Mat(),contours=new cv.MatVector(),hierarchy=new cv.Mat();
  try{
    cv.cvtColor(src,gray,cv.COLOR_RGBA2GRAY);
    cv.threshold(gray,th,75,255,cv.THRESH_BINARY_INV);
    cv.findContours(th,contours,hierarchy,cv.RETR_EXTERNAL,cv.CHAIN_APPROX_SIMPLE);
    const W=src.cols,H=src.rows,c=[];
    for(let i=0;i<contours.size();i++){
      const co=contours.get(i), area=cv.contourArea(co), r=cv.boundingRect(co); co.delete();
      const ba=r.width*r.height, fill=ba?area/ba:0, ar=r.height? r.width/r.height:0;
      if(area<1200||area>30000||fill<0.62||ar<0.55||ar>1.8) continue;
      if(r.width>W*.12||r.height>H*.12) continue;
      c.push({x:r.x+r.width/2,y:r.y+r.height/2,area});
    }
    const qs=[
      p=>p.x<W*.5&&p.y<H*.5,
      p=>p.x>=W*.5&&p.y<H*.5,
      p=>p.x>=W*.5&&p.y>=H*.5,
      p=>p.x<W*.5&&p.y>=H*.5
    ];
    const corners=[{x:0,y:0},{x:W,y:0},{x:W,y:H},{x:0,y:H}],out=[];
    for(let i=0;i<4;i++){
      const a=c.filter(qs[i]); if(!a.length) return null;
      a.sort((u,v)=>((u.x-corners[i].x)**2+(u.y-corners[i].y)**2)-((v.x-corners[i].x)**2+(v.y-corners[i].y)**2));
      out.push({x:a[0].x,y:a[0].y});
    }
    return out;
  }finally{gray.delete();th.delete();contours.delete();hierarchy.delete();}
}

function findPageQuad(src){
  const g=grayFromOMR(src),b=new cv.Mat(),e=new cv.Mat(),cs=new cv.MatVector(),h=new cv.Mat();
  try{
    cv.GaussianBlur(g,b,new cv.Size(5,5),1.2,1.2);
    cv.Canny(b,e,40,120); cv.findContours(e,cs,h,cv.RETR_LIST,cv.CHAIN_APPROX_SIMPLE);
    const W=src.cols,H=src.rows; let best=null,area=0;
    for(let i=0;i<cs.size();i++){
      const c=cs.get(i), a=Math.abs(cv.contourArea(c));
      if(a<0.55*W*H){c.delete();continue;}
      const peri=cv.arcLength(c,true), approx=new cv.Mat();
      cv.approxPolyDP(c,approx,.02*peri,true); c.delete();
      if(approx.rows!==4){approx.delete();continue;}
      const pts=[]; for(let j=0;j<4;j++)pts.push({x:approx.data32S[j*2],y:approx.data32S[j*2+1]}); approx.delete();
      const minX=Math.min(...pts.map(p=>p.x)),maxX=Math.max(...pts.map(p=>p.x)),minY=Math.min(...pts.map(p=>p.y)),maxY=Math.max(...pts.map(p=>p.y));
      const box=(maxX-minX)*(maxY-minY); if(box>area){area=box;best=orderQuad(pts);}
    }
    return best;
  }finally{g.delete();b.delete();e.delete();cs.delete();h.delete();}
}

function warpImage(src,W,H){
  const fid=findFiducialMarks(src);
  const quad=fid||findPageQuad(src);
  if(!quad){const out=new cv.Mat();cv.resize(src,out,new cv.Size(W,H),0,0,cv.INTER_AREA);return {mat:out,warped:false,usedFiducials:false};}
  const d=(W===OMR_FULL.W&&H===OMR_FULL.H)?OMR_FULL.fiducials:[{x:0,y:0},{x:W-1,y:0},{x:W-1,y:H-1},{x:0,y:H-1}];
  const a=cv.matFromArray(4,1,cv.CV_32FC2,quad.flatMap(p=>[p.x,p.y]));
  const z=cv.matFromArray(4,1,cv.CV_32FC2,d.flatMap(p=>[p.x,p.y]));
  const M=cv.getPerspectiveTransform(a,z),out=new cv.Mat();
  cv.warpPerspective(src,out,M,new cv.Size(W,H),cv.INTER_LINEAR,cv.BORDER_REPLICATE);
  a.delete();z.delete();M.delete();
  return {mat:out,warped:true,usedFiducials:!!fid};
}

function bubbleMetric(gray,x,y,r){
  // Large inner sample: the student's mark fills the bubble interior.
  // The old 0.52*r sample mostly saw the printed Arabic glyph and was the
  // main reason marks were being assigned to neighbouring choices.
  const inner=r*.70, outer1=r*1.18, outer2=r*1.72;
  let inSum=0,inDark=0,inN=0,outSum=0,outN=0;
  const xmin=Math.max(0,Math.floor(x-outer2)),xmax=Math.min(gray.cols-1,Math.ceil(x+outer2));
  const ymin=Math.max(0,Math.floor(y-outer2)),ymax=Math.min(gray.rows-1,Math.ceil(y+outer2));
  for(let yy=ymin;yy<=ymax;yy++)for(let xx=xmin;xx<=xmax;xx++){
    const dx=xx-x,dy=yy-y,d2=dx*dx+dy*dy,v=gray.ucharAt(yy,xx);
    if(d2<=inner*inner){inSum+=v;inN++;if(v<175)inDark++;}
    else if(d2>=outer1*outer1&&d2<=outer2*outer2){outSum+=v;outN++;}
  }
  const mean=inN?inSum/inN:255, dark=inN?inDark/inN:0, outer=outN?outSum/outN:255;
  const density=1-mean/255;
  const contrast=clampOMR((outer-mean)/180,0,1);
  return {mean,dark,density,outer,contrast,score:.62*dark+.23*density+.15*contrast};
}

function readBubble(gray,x,y,r){
  // Small search around the registered center handles a 1–4 px print/scan shift
  // without allowing the point to jump to the neighbouring answer.
  let best=null;
  for(let dy=-5;dy<=5;dy++)for(let dx=-5;dx<=5;dx++){
    const m=bubbleMetric(gray,x+dx,y+dy,r);
    if(!best||m.score>best.score)best={...m,x:x+dx,y:y+dy};
  }
  return best;
}

function classifyFixedRow(gray,xs,y){
  const raw=xs.map((x,i)=>({label:OMR_LABELS[i],...readBubble(gray,x,y,OMR_FULL.radius)}));
  const s=raw.slice().sort((a,b)=>b.score-a.score),best=s[0],second=s[1];
  const rest=(s[1].score+s[2].score+s[3].score)/3;
  const lift=best.score-rest;
  // Conservative commercial-style gate: blank/unclear is never silently
  // converted to an answer.
  const single=best.score>=.30 && lift>=.075 && (best.score-second.score)>=.025;
  const multiple=best.score>=.30 && second.score>=best.score*.78 && (second.score-rest)>=.055;
  const status=multiple?'MULTIPLE':single?'SINGLE':best.score<.22?'BLANK':'UNCLEAR';
  const conf=clampOMR(.50*Math.min(1,lift/.20)+.30*Math.min(1,best.score/.60)+.20*Math.min(1,(best.score-second.score)/.20),0,1);
  return {raw,best,second,rest,lift,status,confidence:conf};
}

function circleRegistrationScore(gray,x,y,r){
  // Score the PRINTED bubble ring, not the student's ink. This lets us
  // re-register the answer grid even when the perspective warp is slightly
  // different from the PDF raster.
  const rr=r*0.92, ro=r*1.20;
  let s=0,n=0,so=0,no=0;
  for(let k=0;k<24;k++){
    const a=(Math.PI*2*k)/24,ca=Math.cos(a),sa=Math.sin(a);
    const xi=Math.round(x+rr*ca), yi=Math.round(y+rr*sa);
    const xo=Math.round(x+ro*ca), yo=Math.round(y+ro*sa);
    if(xi>=0&&xi<gray.cols&&yi>=0&&yi<gray.rows){s+=1-gray.ucharAt(yi,xi)/255;n++;}
    if(xo>=0&&xo<gray.cols&&yo>=0&&yo<gray.rows){so+=1-gray.ucharAt(yo, xo)/255;no++;}
  }
  // A printed ring has high darkness on the inner ring and much less just
  // outside it. Filled bubbles still score strongly.
  return (n?s/n:0)*0.75 + (n&&no?Math.max(0,(s/n-so/no)):0)*0.25;
}

function calibrateAnswerGrid(gray){
  // Estimate the residual affine registration left after corner-marker warp.
  // Search is deliberately global per column group, so one dark student's
  // mark can never pull a single question onto a neighbouring option.
  const groups=OMR_FULL.groups;
  const rows=OMR_FULL.ys;
  const out={groups:[],yA:1,yB:0};
  function scoreGroup(g,a,b){
    let z=0;
    for(let r=0;r<15;r++) for(let j=0;j<4;j++) z+=circleRegistrationScore(gray,a*groups[g].xs[j]+b,rows[r],OMR_FULL.radius);
    return z/60;
  }
  for(let g=0;g<4;g++){
    let best={score:-1,a:1,b:0};
    for(let ai=0;ai<=20;ai++){
      const a=.84+ai*.01;
      for(let b=-90;b<=45;b+=3){
        const sc=scoreGroup(g,a,b);
        if(sc>best.score)best={score:sc,a,b};
      }
    }
    out.groups.push(best);
  }
  // Y registration: score all groups together.
  function scoreY(a,b){
    let z=0;
    for(let g=0;g<4;g++) for(let r=0;r<15;r++){
      const y=a*rows[r]+b;
      for(let j=0;j<4;j++) z+=circleRegistrationScore(gray,out.groups[g].a*groups[g].xs[j]+out.groups[g].b,y,OMR_FULL.radius);
    }
    return z/240;
  }
  let by={score:-1,a:1,b:0};
  for(let ai=0;ai<=20;ai++){
    const a=.94+ai*.006;
    for(let b=-20;b<=35;b+=2){
      const sc=scoreY(a,b);
      if(sc>by.score)by={score:sc,a,b};
    }
  }
  out.yA=by.a;out.yB=by.b;
  return out;
}

function detectOMRAnswers(warped,totalQuestions,mode='full'){
  const gray=grayFromOMR(warped),maxQ=Math.min(Number(totalQuestions)||60,60);
  const answers={},confidence={},review=[],diagnostics={};
  if(mode==='full'){
    const reg=calibrateAnswerGrid(gray);
    for(let g=0;g<4;g++){
      const q0=g*15+1, base=OMR_FULL.groups[g].xs;
      const xs=base.map(x=>reg.groups[g].a*x+reg.groups[g].b);
      for(let row=0;row<15;row++){
        const q=q0+row;if(q>maxQ)continue;
        const y=reg.yA*OMR_FULL.ys[row]+reg.yB, rr=classifyFixedRow(gray,xs,y);
        diagnostics[q]={status:rr.status,answer:rr.status==='SINGLE'?rr.best.label:null,
          choices:rr.raw.map(v=>({label:v.label,x:Math.round(v.x),y:Math.round(v.y),score:+v.score.toFixed(4),mean:+v.mean.toFixed(1),dark:+v.dark.toFixed(4)})),
          best:rr.best.label,second:rr.second.label,lift:+rr.lift.toFixed(4),confidence:+rr.confidence.toFixed(3),geometry:'AUTO-REGISTERED'};
        if(rr.status==='SINGLE'){answers[q]=rr.best.label;confidence[q]=+rr.confidence.toFixed(3);} else review.push(q);
      }
    }
  }else{
    // Legacy crop fallback: fixed template only when a tightly cropped image
    // contains no registration marks. It is deliberately lower priority.
    for(let g=0;g<4;g++){
      const f=OMR_CROP.groups[g],q0=g*15+1;
      for(let row=0;row<15;row++){
        const q=q0+row;if(q>maxQ)continue;
        const y=OMR_CROP.y0+row*OMR_CROP.dy;
        const rr=classifyFixedRow(gray,f.xs,y);
        diagnostics[q]={status:rr.status,answer:rr.status==='SINGLE'?rr.best.label:null,
          choices:rr.raw.map(v=>({label:v.label,x:Math.round(v.x),y:Math.round(v.y),score:+v.score.toFixed(4),mean:+v.mean.toFixed(1),dark:+v.dark.toFixed(4)})),
          best:rr.best.label,second:rr.second.label,lift:+rr.lift.toFixed(4),confidence:+rr.confidence.toFixed(3),geometry:'CROP-FIXED'};
        if(rr.status==='SINGLE'){answers[q]=rr.best.label;confidence[q]=+rr.confidence.toFixed(3);} else review.push(q);
      }
    }
  }
  gray.delete();
  return {answers,confidence,review:[...new Set(review)].sort((a,b)=>a-b),diagnostics,
    engineVersion:'omr-v11-scanner-similarity-grid',geometryDetected:mode==='full',detectedCircles:0,calibrationOK:mode==='full',
    geometry:mode==='full'?OMR_FULL.groups.map(g=>({xs:g.xs.slice(),ys:OMR_FULL.ys.slice(),r:OMR_FULL.radius})):[]};
}


/* ================================================================
   OMR COMMERCIAL-STYLE V7 — MARKER HOMOGRAPHY + TEMPLATE DIFFERENCE
   ================================================================ */
const OMR_TEMPLATE_PNG = "data:image/png;base64,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";
const OMR_TW=1125, OMR_TH=1625;
const OMR_SCAN_POLICY={dpi:300,mode:'flatbed-similarity',longMin:1800,longMax:5000};
const OMR_MARKERS=[[37,37],[1087,37],[37,1587],[1087,1587]];
const OMR_TX=[[1035,991,947,902],[759,715,669,625],[481,437,392,347],[203,159,115,70]];
const OMR_TY=[966.25,1007.25,1046.25,1086.25,1124.75,1162.25,1202.25,1241.25,1280.75,1320.25,1357.50,1397.25,1434.25,1474.75,1513.50];
let OMR_TEMPLATE_CACHE=null;
async function loadOMRTemplate(){
  if(OMR_TEMPLATE_CACHE) return OMR_TEMPLATE_CACHE;
  const im=new Image(); im.decoding='async';
  await new Promise((resolve,reject)=>{im.onload=resolve;im.onerror=reject;im.src=OMR_TEMPLATE_PNG;});
  const c=document.createElement('canvas'); c.width=OMR_TW; c.height=OMR_TH;
  c.getContext('2d',{willReadFrequently:true}).drawImage(im,0,0,OMR_TW,OMR_TH);
  const mat=cv.imread(c), gray=grayFromOMR(mat); OMR_TEMPLATE_CACHE={mat,gray}; return OMR_TEMPLATE_CACHE;
}
function detectRegistrationMarks(src){
  const gray=grayFromOMR(src), th=new cv.Mat(), contours=new cv.MatVector(), hierarchy=new cv.Mat(), cand=[];
  try{
    cv.threshold(gray,th,75,255,cv.THRESH_BINARY_INV); cv.findContours(th,contours,hierarchy,cv.RETR_EXTERNAL,cv.CHAIN_APPROX_SIMPLE);
    const W=src.cols,H=src.rows;
    for(let i=0;i<contours.size();i++){
      const c=contours.get(i), r=cv.boundingRect(c), area=cv.contourArea(c), cx=r.x+r.width/2, cy=r.y+r.height/2;
      const ar=r.width/Math.max(1,r.height), fill=area/Math.max(1,r.width*r.height);
      const near=(cx<W*.18||cx>W*.82)&&(cy<H*.18||cy>H*.82);
      if(area>500&&r.width>22&&r.height>22&&r.width<180&&r.height<180&&ar>.65&&ar<1.35&&fill>.45&&near) cand.push({x:cx,y:cy,area});
      c.delete();
    }
    const out=[];
    for(const corner of [[0,0],[1,0],[0,1],[1,1]]){
      const side=cand.filter(p=>{const rx=corner[0]?p.x:W-p.x,ry=corner[1]?p.y:H-p.y;return rx<W*.24&&ry<H*.24;}).sort((a,b)=>b.area-a.area);
      if(!side.length)return null; out.push(side[0]);
    }
    return out;
  }finally{gray.delete();th.delete();contours.delete();hierarchy.delete();}
}
function similarityFrom4Points(srcPts,dstPts){
  // Canonical flatbed/scanner registration: rotation + uniform scale + translation.
  // Unlike homography, this cannot bend the page or make the middle drift.
  const n=srcPts.length;
  let sx=0,sy=0,dx=0,dy=0;
  for(let i=0;i<n;i++){sx+=srcPts[i].x;sy+=srcPts[i].y;dx+=dstPts[i][0];dy+=dstPts[i][1];}
  sx/=n; sy/=n; dx/=n; dy/=n;
  let A=0,B=0,D=0;
  for(let i=0;i<n;i++){
    const x=srcPts[i].x-sx,y=srcPts[i].y-sy;
    const X=dstPts[i][0]-dx,Y=dstPts[i][1]-dy;
    A += x*X + y*Y;
    B += x*Y - y*X;
    D += x*x + y*y;
  }
  if(!(D>0)) throw new Error('تعذر حساب محاذاة الورقة');
  const scale=Math.sqrt(A*A+B*B)/D;
  const c=(scale>1e-9)?A/(scale*D):1;
  const sn=(scale>1e-9)?B/(scale*D):0;
  const tx=dx-scale*(c*sx-sn*sy);
  const ty=dy-scale*(sn*sx+c*sy);
  return {scale,c,sn,tx,ty};
}
function warpByRegistrationMarks(src,marks){
  const T=similarityFrom4Points(marks,OMR_MARKERS);
  if(T.scale<0.25||T.scale>3.5) throw new Error('حجم الصورة الممسوحة غير مناسب للورقة');
  const A=cv.matFromArray(2,3,cv.CV_64F,[T.scale*T.c,-T.scale*T.sn,T.tx,T.scale*T.sn,T.scale*T.c,T.ty]);
  const out=new cv.Mat();
  cv.warpAffine(src,out,A,new cv.Size(OMR_TW,OMR_TH),cv.INTER_CUBIC,cv.BORDER_REPLICATE);
  A.delete();
  return out;
}
function warpByRegistrationMarksLegacyPerspective(src,marks){
  const sp=[];for(const p of marks)sp.push(p.x,p.y); const dp=[];for(const p of OMR_MARKERS)dp.push(p[0],p[1]);
  const a=cv.matFromArray(4,1,cv.CV_32FC2,sp),b=cv.matFromArray(4,1,cv.CV_32FC2,dp),H=cv.getPerspectiveTransform(a,b),out=new cv.Mat();
  cv.warpPerspective(src,out,H,new cv.Size(OMR_TW,OMR_TH),cv.INTER_CUBIC,cv.BORDER_REPLICATE); a.delete();b.delete();H.delete(); return out;
}
function normalizedInk(gray,tpl,x,y){
  const r=12,ro1=17,ro2=23;let si=0,ti=0,so=0,to=0,ni=0,no=0;
  for(let yy=y-ro2;yy<=y+ro2;yy++)for(let xx=x-ro2;xx<=x+ro2;xx++){
    if(xx<0||yy<0||xx>=gray.cols||yy>=gray.rows)continue;
    const dx=xx-x,dy=yy-y,d2=dx*dx+dy*dy,v=gray.ucharAt(yy,xx),tv=tpl.ucharAt(yy,xx);
    if(d2<=r*r){si+=v;ti+=tv;ni++;}else if(d2>=ro1*ro1&&d2<=ro2*ro2){so+=v;to+=tv;no+=0;}
  }
  const im=ni?si/ni:255,tm=ni?ti/ni:255,io=no?so/no:255,to2=no?to/no:255;
  return {delta:(io-im)-(to2-tm),inner:im,templateInner:tm};
}

/* ================================================================
   OMR ROBUST ROW-MARKER ENGINE V9
   The printable sheet carries one black marker beside every answer row.
   We use the markers as the local coordinate system:
     marker center -> row Y
     marker lane X -> group X
     fixed offsets from the marker -> A/B/C/D bubbles
   This is deliberately independent of page pixel size and does not use
   Hough circles or a guessed global dy.
   ================================================================ */
const OMR_ROW_MARKER_LANES=[840,560,280,42];
const OMR_ROW_Y_RANGE=[875,1515];
const OMR_ROW_MARKER_EXPECTED=OMR_TY.slice();
const OMR_ROW_MARKER_SIZE={min:7,max:16};
// Bubble centers relative to the row-marker center in the printed master.
// These are measured from the supplied answer sheet and are kept per group.
const OMR_BUBBLE_OFFSETS=[
  [197,152,107,62],
  [199,155,109,65],
  [201,157,112,67],
  [162,117,72,27]
];

function detectMarkerComponents(gray,xCenter){
  // Dedicated timing lane: the only intentional solid-black components here
  // are the row markers.  We use two thresholds and keep only compact squares.
  const xMin=Math.max(0,Math.round(xCenter-18)), xMax=Math.min(gray.cols-1,Math.round(xCenter+18));
  const yMin=OMR_ROW_Y_RANGE[0], yMax=Math.min(gray.rows-1,OMR_ROW_Y_RANGE[1]);
  const roi=gray.roi(new cv.Rect(xMin,yMin,xMax-xMin+1,yMax-yMin+1));
  const found=[];
  try{
    for(const cut of [90,125,155]){
      const th=new cv.Mat(), contours=new cv.MatVector(), hierarchy=new cv.Mat();
      try{
        cv.threshold(roi,th,cut,255,cv.THRESH_BINARY_INV);
        cv.findContours(th,contours,hierarchy,cv.RETR_EXTERNAL,cv.CHAIN_APPROX_SIMPLE);
        for(let i=0;i<contours.size();i++){
          const c=contours.get(i), r=cv.boundingRect(c), area=cv.contourArea(c); c.delete();
          const box=r.width*r.height, fill=area/Math.max(1,box), ar=r.height? r.width/r.height:0;
          if(r.width>=OMR_ROW_MARKER_SIZE.min&&r.width<=OMR_ROW_MARKER_SIZE.max&&
             r.height>=OMR_ROW_MARKER_SIZE.min&&r.height<=OMR_ROW_MARKER_SIZE.max&&
             fill>=.55&&ar>=.70&&ar<=1.42){
            found.push({x:xMin+r.x+r.width/2,y:yMin+r.y+r.height/2,w:r.width,h:r.height,area,cut});
          }
        }
      }finally{th.delete();contours.delete();hierarchy.delete();}
    }
  }finally{roi.delete();}
  // Merge detections of the same printed square across the three thresholds.
  found.sort((a,b)=>a.y-b.y);
  const ded=[];
  for(const f of found){
    const hit=ded.find(d=>Math.abs(d.y-f.y)<5&&Math.abs(d.x-f.x)<5);
    if(hit){ if(f.area>hit.area) Object.assign(hit,f); }
    else ded.push(f);
  }
  return ded.sort((a,b)=>a.y-b.y);
}
function fitMarkerRows(points){
  if(points.length<14) return null;
  // The markers are intentionally printed once per row. After page registration
  // their Y positions should form one clean 15-point sequence.  Select the
  // sequence closest to the master spacing instead of trusting one noisy blob.
  const ys=points.slice().sort((a,b)=>a.y-b.y);
  const target=OMR_ROW_MARKER_EXPECTED;
  let best=null;
  for(let si=0;si<Math.min(ys.length,4);si++){
    const seq=[]; let j=si;
    for(let r=0;r<15 && j<ys.length;r++,j++) seq.push(ys[j]);
    if(seq.length<14) continue;
    const residual=seq.reduce((z,p,r)=>z+Math.abs(p.y-target[r]),0)/seq.length;
    const spacing=seq.slice(1).reduce((z,p,r)=>z+Math.abs((p.y-seq[r].y)-(target[r+1]-target[r])),0)/Math.max(1,seq.length-1);
    const score=residual+spacing*1.5;
    if(!best||score<best.score)best={seq,score};
  }
  if(!best || best.seq.length<14 || best.score>24) return null;
  const out=best.seq.slice(0,15).sort((a,b)=>a.y-b.y);
  // A missing last marker is not silently invented. For a print/scan system
  // designed for 99.9%-class reliability, missing timing marks cause review.
  if(out.length!==15) return null;
  return out;
}
function detectRowMarkerGrid(gray){
  const lanes=[];
  for(let li=0;li<OMR_ROW_MARKER_LANES.length;li++){
    const x=OMR_ROW_MARKER_LANES[li];
    const pts=detectMarkerComponents(gray,x);
    const rows=fitMarkerRows(pts);
    lanes.push(rows||null);
  }
  const usable=lanes.filter(Boolean);
  if(usable.length<3) return null;
  const rowYs=[];
  for(let r=0;r<15;r++){
    const vals=usable.map(l=>l[r]?.y).filter(Number.isFinite).sort((a,b)=>a-b);
    rowYs[r]=vals.length?vals[Math.floor(vals.length/2)]:null;
  }
  // Require almost all rows; one missing row can be interpolated, but not more.
  const missing=rowYs.filter(v=>!Number.isFinite(v)).length;
  if(missing>1) return null;
  if(missing!==0) return null;
  // Reject a distorted timing rail before reading any answer. The median row
  // spacing must remain physically plausible and monotonic.
  for(let r=1;r<15;r++){
    const d=rowYs[r]-rowYs[r-1];
    if(!(d>28 && d<52)) return null;
  }
  // X is measured per lane from the actual marker components. This makes the
  // answer grid follow the marker even if the warp has residual scale/shift.
  const laneX=lanes.map(l=>{
    if(!l) return null;
    const xs=l.map(p=>p?.x).filter(Number.isFinite).sort((a,b)=>a-b);
    return xs.length?xs[Math.floor(xs.length/2)]:null;
  });
  if(usable.length<3) return null;
  return {rowYs,laneX,lanesDetected:usable.length,missingRows:missing};
}

function sampleAnswerDelta(gray,tpl,x,y){
  const r=11, ro1=16, ro2=22;
  let s=0,t=0,n=0;
  for(let yy=Math.round(y-ro2);yy<=Math.round(y+ro2);yy++){
    for(let xx=Math.round(x-ro2);xx<=Math.round(x+ro2);xx++){
      if(xx<0||yy<0||xx>=gray.cols||yy>=gray.rows)continue;
      const dx=xx-x,dy=yy-y,d2=dx*dx+dy*dy;
      if(d2<=r*r){s+=gray.ucharAt(yy,xx);t+=tpl.ucharAt(yy,xx);n++;}
    }
  }
  if(!n)return {delta:0,inner:255,templateInner:255};
  // Template difference: printed glyph/ring exists in both images, while
  // student ink makes the inner region substantially darker.
  return {delta:(t-s)/n,inner:s/n,templateInner:t/n};
}

function classifyMarkerRow(gray,tpl,g,y,markerX){
  const raw=OMR_BUBBLE_OFFSETS[g].map((off,i)=>{
    const x=markerX+off;
    // Small local search protects against a few pixels of print/camera error,
    // but the search is locked to this option and can never jump columns.
    let best=null;
    for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){
      const m=sampleAnswerDelta(gray,tpl,x+dx,y+dy);
      if(!best||m.delta>best.delta)best={...m,x:x+dx,y:y+dy};
    }
    return {label:OMR_LABELS[i],...best};
  });
  const s=raw.slice().sort((a,b)=>b.delta-a.delta),best=s[0],second=s[1];
  const rest=(s[1].delta+s[2].delta+s[3].delta)/3;
  const lift=best.delta-rest,gap=best.delta-second.delta;
  // Relative gate: robust to different pencil/pen darkness.
  const single=best.delta>=24 && lift>=10 && gap>=7;
  const multiple=best.delta>=24 && second.delta>=24 && gap<7;
  const status=multiple?'MULTIPLE':single?'SINGLE':best.delta<14?'BLANK':'UNCLEAR';
  const conf=Math.max(0,Math.min(1,.55*Math.min(1,lift/35)+.45*Math.min(1,gap/25)));
  return {raw,best,second,status,lift,gap,confidence:conf};
}

function detectOMRReferenceAnswers(warped,totalQuestions){
  const gray=grayFromOMR(warped),tpl=OMR_TEMPLATE_CACHE.gray,maxQ=Math.min(Number(totalQuestions)||60,60);
  const answers={},confidence={},review=[],diagnostics={};
  const grid=detectRowMarkerGrid(gray);
  if(!grid) throw new Error('تعذر اكتشاف مربعات الصفوف المطبوعة. صوّر الورقة كاملة وبوضوح، وتأكد أن المربعات السوداء ظاهرة.');
  for(let g=0;g<4;g++){
    const markerX=Number.isFinite(grid.laneX[g])?grid.laneX[g]:OMR_ROW_MARKER_LANES[g];
    for(let row=0;row<15;row++){
      const q=g*15+row+1;if(q>maxQ)continue;
      const y=grid.rowYs[row];
      const rr=classifyMarkerRow(gray,tpl,g,y,markerX);
      diagnostics[q]={
        status:rr.status,answer:rr.status==='SINGLE'?rr.best.label:null,
        geometry:'ROW-MARKER-XY+TEMPLATE-DIFF',rowY:+y.toFixed(1),markerX:+markerX.toFixed(1),
        lanesDetected:grid.lanesDetected,choices:rr.raw.map(v=>({label:v.label,x:+v.x.toFixed(1),y:+v.y.toFixed(1),delta:+v.delta.toFixed(1),inner:+v.inner.toFixed(1),templateInner:+v.templateInner.toFixed(1)})),
        best:rr.best.label,second:rr.second.label,lift:+rr.lift.toFixed(1),gap:+rr.gap.toFixed(1),confidence:+rr.confidence.toFixed(3)
      };
      if(rr.status==='SINGLE'){answers[q]=rr.best.label;confidence[q]=+rr.confidence.toFixed(3);} else review.push(q);
    }
  }
  gray.delete();
  return {answers,confidence,review,diagnostics,engineVersion:'omr-v11-scanner-similarity-timing-rail',geometryDetected:true,calibrationOK:true,rowMarkersDetected:true,rowMarkerYs:grid.rowYs,rowMarkerXs:grid.laneX};
}

async function readOMRImageV6(file,totalQuestions){
  await waitForOpenCV();
  const img=await loadImageElement(file),canvas=document.createElement('canvas');
  canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
  canvas.getContext('2d',{willReadFrequently:true}).drawImage(img,0,0);
  const src=cv.imread(canvas);
  try{
    const marks=detectRegistrationMarks(src);
    if(!marks) throw new Error('لم أجد علامات التسجيل الأربع. تأكد أن الورقة كاملة داخل السكانر وأن المربعات السوداء الأربع ظاهرة.');
    let aligned=null, mode='scanner-similarity';
    try{
      aligned=warpByRegistrationMarks(src,marks);
    }catch(simErr){
      // Only a perspective capture uses this fallback. A flatbed scan stays
      // on the similarity path above.
      aligned=warpByRegistrationMarksLegacyPerspective(src,marks);
      mode='perspective-fallback';
    }
    try{
      await loadOMRTemplate();
      const d=detectOMRReferenceAnswers(aligned,totalQuestions);
      return {...d,warped:true,usedFiducials:true,mode,
        registrationMarks:marks.map(p=>({x:+p.x.toFixed(1),y:+p.y.toFixed(1)})),
        readQuality:Object.keys(d.answers).length*10-d.review.length};
    }finally{aligned.delete();}
  }finally{src.delete();}
}

async function readOMRImageLegacy(file,totalQuestions){
  await waitForOpenCV();
  const img=await loadImageElement(file),canvas=document.createElement('canvas');
  canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);
  const src=cv.imread(canvas);
  try{
    // Full page is the canonical route. If four fiducials are visible, do not
    // let a second heuristic attempt override it with a worse crop reading.
    const fid=findFiducialMarks(src);
    if(fid){
      const wi=warpImage(src,OMR_FULL.W,OMR_FULL.H);
      try{
        const d=detectOMRAnswers(wi.mat,totalQuestions,'full');
        return {...d,warped:wi.warped,usedFiducials:true,mode:'full',readQuality:Object.keys(d.answers).length*10-d.review.length};
      }finally{wi.mat.delete();}
    }
    // No marks: still use the full master after page-edge perspective correction.
    const wi=warpImage(src,OMR_FULL.W,OMR_FULL.H);
    try{
      const d=detectOMRAnswers(wi.mat,totalQuestions,'full');
      return {...d,warped:wi.warped,usedFiducials:false,mode:'full',readQuality:Object.keys(d.answers).length*10-d.review.length};
    }finally{wi.mat.delete();}
  }finally{src.delete();}
}


function getScannerQuality(nw,nh){
  const short=Math.min(nw,nh), long=Math.max(nw,nh);
  const plausible=long>=1800 && long<=5000 && short>=1200 && short<=3800;
  return {short,long,plausible};
}
function overlayScalar(status){
  return status==='SINGLE' ? new cv.Scalar(22,128,60,255)
       : status==='BLANK' ? new cv.Scalar(120,120,120,255)
       : new cv.Scalar(192,57,43,255);
}
async function inspectOMRFile(file,totalQuestions){
  const debug=document.getElementById('omrDebugBox');
  if(!debug) return;
  debug.innerHTML='<div class="muted">جاري فحص المحاذاة والدوائر…</div>';
  try{
    await waitForOpenCV();
    const img=await loadImageElement(file);
    const quality=getScannerQuality(img.naturalWidth,img.naturalHeight);
    const c=document.createElement('canvas'); c.width=img.naturalWidth;c.height=img.naturalHeight;
    c.getContext('2d').drawImage(img,0,0);
    const src=cv.imread(c), marks=detectRegistrationMarks(src);
    if(!marks){src.delete();debug.innerHTML='<div class="warn">فشل التسجيل: لم تُكتشف العلامات الأربع. لا يتم اعتماد أي إجابة.</div>';return;}
    const aligned=warpByRegistrationMarks(src,marks);
    const read=detectOMRReferenceAnswers(aligned,totalQuestions);
    const rgba=new cv.Mat(); cv.cvtColor(aligned,rgba,cv.COLOR_RGBA2RGB);
    for(let qn=1;qn<=Math.min(totalQuestions,60);qn++){
      const d=read.diagnostics[qn]; if(!d) continue;
      const g=Math.floor((qn-1)/15), row=(qn-1)%15;
      for(const p of d.choices){
        cv.circle(rgba,new cv.Point(Math.round(p.x),Math.round(p.y)),16,overlayScalar(d.status),2);
      }
      cv.putText(rgba,String(qn),new cv.Point(Math.max(5,Math.round(d.markerX-25)),Math.round(d.rowY+4)),
        cv.FONT_HERSHEY_SIMPLEX,.42,new cv.Scalar(20,20,20,255),1);
    }
    const out=document.createElement('canvas');out.width=rgba.cols;out.height=rgba.rows;cv.imshow(out,rgba);
    debug.innerHTML=`
      <div><b>فحص بصري — ${escapeHtml(file.name)}</b></div>
      <div class="omr-metric">
        <div>الأبعاد: ${img.naturalWidth} × ${img.naturalHeight}</div>
        <div>مناسبة لـ300 DPI: <b class="${quality.plausible?'ok':'warn'}">${quality.plausible?'نعم':'ليست مثالية'}</b></div>
        <div>علامات التسجيل: <b class="ok">4/4</b></div>
        <div>صفوف التوقيت: <b class="${read.rowMarkersDetected?'ok':'warn'}">${read.rowMarkersDetected?'مكتملة':'ناقصة'}</b></div>
        <div>إجابات واثقة: ${Object.keys(read.answers).length}/${Math.min(totalQuestions,60)}</div>
        <div>للمراجعة: ${read.review.length}</div>
      </div>
      <img src="${out.toDataURL('image/png')}" alt="OMR diagnostic overlay">
      <p class="muted" style="margin-top:7px">الأخضر = قراءة منفردة، الرمادي = فارغ، الأحمر = متعدد/غير واضح. إذا كانت الدوائر فوق أماكنها فالتسجيل سليم والمشكلة في القراءة فقط.</p>`;
    [src,aligned,rgba].forEach(m=>{try{m.delete()}catch(e){}});
  }catch(e){
    console.error(e);
    debug.innerHTML=`<div class="warn">فشل الفحص: ${escapeHtml(e.message||'خطأ غير معروف')}</div>`;
  }
}
function showOMRDebug(fileIndex){
  const file=OMR_SELECTED_FILES[fileIndex];
  const exam=STATE.exams.find(e=>e.id===document.getElementById('gExam')?.value);
  if(file&&exam) inspectOMRFile(file,exam.total_questions);
}
async function uploadAndProcessOMR(){
  const exam=STATE.exams.find(e=>e.id===document.getElementById('gExam')?.value);
  const msg=document.getElementById('omrProcessMsg');
  if(!exam){if(msg)msg.textContent='اختر الاختبار أولاً';return;}
  if(!OMR_SELECTED_FILES.length){if(msg)msg.textContent='اختر صور أوراق الإجابة أولاً';return;}
  const students=getCurrentExamStudents(); // الحاضرون فقط — الغائبون متشالين من هنا
  if(OMR_SELECTED_FILES.length>students.length){
    if(!confirm(`عدد الصور (${OMR_SELECTED_FILES.length}) أكبر من عدد الطلاب (${students.length}). سيتم استخدام أول ${students.length} صورة فقط. متابعة؟`))return;
  }
  const n=Math.min(OMR_SELECTED_FILES.length,students.length);
  if(msg)msg.innerHTML='<div class="omr-progress"><strong>جاري تشغيل محرك OMR...</strong><br>20/30/40/50/60 سؤالًا مدعومة، والورقة تربط بالطالب حسب الترتيب.</div>';
  try{await waitForOpenCV();}catch(e){if(msg)msg.textContent=e.message;return;}
  let approvedCount=0,reviewCount=0,errorCount=0;
  for(let i=0;i<n;i++){
    const file=OMR_SELECTED_FILES[i],student=students[i];
    try{
      if(msg)msg.innerHTML=`<div class="omr-progress"><strong>قراءة الورقة ${i+1} من ${n}</strong><br>${escapeHtml(student.name)} — ${exam.total_questions} سؤال</div>`;
      const read=await readOMRImageV6(file,exam.total_questions);
      // Supabase Storage keys must be ASCII-only — Arabic (or any non-ASCII)
      // characters in the object key are rejected with "Invalid key", which is
      // exactly what happened with the original PDF/scanner filenames here.
      // \w with no 'u' flag only matches [A-Za-z0-9_], so this now strips
      // Arabic (and any other non-ASCII) instead of keeping it.
      const safeName=file.name.replace(/[^\w.-]+/g,'_').replace(/_+/g,'_').slice(0,60) || 'sheet';
      const path=`${exam.id}/${String(i+1).padStart(3,'0')}_${student.id}_${Date.now()}_${safeName}`;
      // v13 fix: a transient network blip (the "Failed to fetch" case) used to
      // fail the whole sheet permanently on one bad request. Retry the two
      // network calls a few times with backoff before giving up — most drops
      // resolve themselves within a second or two.
      const upload=await withRetry(()=>sb.storage.from('exam-sheets').upload(path,file,{upsert:true,contentType:file.type||'image/jpeg'}));
      if(upload.error)throw upload.error;
      const needsReview=read.review.length>0;
      const status=needsReview?'review':'processed';
      const payload={exam_id:exam.id,student_id:student.id,sheet_order:i+1,status,image_path:path,
        detected_answers:read.answers,confidence:read.confidence,review_questions:read.review,
        requires_review:needsReview,error_message:null,processed_at:new Date().toISOString(),approved_at:null};
      const {data:sheet,error:dbError}=await withRetry(()=>sb.from('exam_sheets').upsert(payload,{onConflict:'exam_id,student_id'}).select('*').single());
      if(dbError)throw dbError;
      if(!needsReview){
        const score=computeScore(read.answers,exam);
        const {error:re}=await withRetry(()=>sb.from('results').upsert({exam_id:exam.id,student_id:student.id,answers:read.answers,correct_count:score.correct,total_percent:score.total_percent,subject_scores:score.subjectScores,updated_at:new Date().toISOString()},{onConflict:'exam_id,student_id'}));
        if(re)throw re;
        const {error:ae}=await withRetry(()=>sb.from('exam_sheets').update({status:'approved',requires_review:false,approved_at:new Date().toISOString()}).eq('id',sheet.id));
        if(ae)throw ae;
        approvedCount++;
      }else reviewCount++;
      if(msg)msg.innerHTML=`<div class="omr-progress"><strong>تمت معالجة ${i+1} من ${n}</strong><br>${escapeHtml(student.name)} — ${Object.keys(read.answers).length}/${exam.total_questions} إجابة — ${needsReview?`⚠️ مراجعة ${read.review.length}`:'✅ اعتماد تلقائي'}</div>`;
    }catch(err){
      console.error(err);errorCount++;
      await withRetry(()=>sb.from('exam_sheets').upsert({exam_id:exam.id,student_id:student.id,sheet_order:i+1,status:'error',error_message:err.message||'خطأ غير معروف'},{onConflict:'exam_id,student_id'})).catch(e2=>console.error('retry-log-failed',e2));
      if(msg)msg.innerHTML=`<div class="omr-progress"><strong>خطأ في ورقة ${escapeHtml(student.name)}</strong><br>${escapeHtml(err.message||'')}</div>`;
    }
  }
  toast(`تمت معالجة ${n} ورقة: ${approvedCount} معتمدة، ${reviewCount} للمراجعة، ${errorCount} أخطاء`);
  await loadAll();
  await onGradingExamChange();
}

// v13: retry helper for the network calls in uploadAndProcessOMR. Only retries
// transient/network-shaped failures (fetch drop, timeout, 5xx) — a real auth
// or validation error (4xx, RLS rejection, bad payload) fails immediately
// since retrying it would just waste time and delay the user's feedback.
async function withRetry(fn,attempts=3,baseDelayMs=600){
  let lastErr=null;
  for(let i=0;i<attempts;i++){
    const result=await fn();
    const err=result && result.error;
    if(!err) return result;
    const msg=String(err.message||err);
    const transient=/fetch|network|timeout|ETIMEDOUT|ECONNRESET|failed to fetch|5\d\d/i.test(msg);
    lastErr=result;
    if(!transient || i===attempts-1) return result; // non-transient: surface immediately
    await new Promise(r=>setTimeout(r,baseDelayMs*Math.pow(2,i)));
  }
  return lastErr;
}

async function renderOMRSheets(examId){
  const exam = STATE.exams.find(e=>e.id===examId);
  if(!exam) return;

  const { data: sheets, error } = await sb
    .from('exam_sheets')
    .select('*')
    .eq('exam_id', examId)
    .order('sheet_order');

  if(error){
    console.error(error);
    return;
  }

  const old = document.getElementById('omrSheetsList');
  if(old) old.remove();

  const card = document.createElement('div');
  card.id = 'omrSheetsList';
  card.className = 'card';

  card.innerHTML = `
    <h3 style="font-size:15px;">الأوراق المرفوعة</h3>
    <p class="muted">يمكن مراجعة حالة كل ورقة قبل اعتماد النتيجة.</p>

    <div style="overflow:auto;margin-top:10px;">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>الطالب</th>
            <th>الحالة</th>
            <th>الأسئلة المقروءة</th>
            <th>المراجعة</th>
            <th>إجراء</th>
          </tr>
        </thead>
        <tbody>
          ${(sheets || []).map(sheet=>{
            const student = STATE.students.find(s=>s.id===sheet.student_id);
            const count = Object.keys(sheet.detected_answers || {}).length;
            const reviewCount = Array.isArray(sheet.review_questions)
              ? sheet.review_questions.length
              : 0;

            let statusText = 'مرفوعة';
            if(sheet.status === 'processed') statusText = 'تمت القراءة';
            if(sheet.status === 'review') statusText = 'تحتاج مراجعة';
            if(sheet.status === 'approved') statusText = 'معتمدة';
            if(sheet.status === 'error') statusText = `خطأ${sheet.error_message ? ' — '+escapeHtml(sheet.error_message) : ''}`;
            if(sheet.status === 'absent') statusText = 'غائب — بدون ورقة';

            if(sheet.status === 'absent'){
              return `
                <tr style="opacity:.65">
                  <td>—</td>
                  <td>${student ? escapeHtml(student.name) : '—'}</td>
                  <td>${statusText}</td>
                  <td>—</td>
                  <td>—</td>
                  <td class="muted">لا يوجد ورقة</td>
                </tr>
              `;
            }

            return `
              <tr>
                <td>${sheet.sheet_order}</td>
                <td>${student ? escapeHtml(student.name) : '—'}</td>
                <td>${statusText}</td>
                <td>${count}/${exam.total_questions}</td>
                <td>${reviewCount}</td>
                <td>
                  <button class="btn secondary small"
                    onclick="openOMRSheet('${sheet.id}')">
                    مراجعة
                  </button>
                </td>
              </tr>
            `;
          }).join('') || `
            <tr><td colspan="6" class="empty">لا توجد أوراق مرفوعة</td></tr>
          `}
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('gradingBody')?.after(card);
}

async function openOMRSheet(sheetId){
  const { data: sheet, error } = await sb
    .from('exam_sheets')
    .select('*')
    .eq('id', sheetId)
    .maybeSingle();

  if(error || !sheet){
    toast('تعذر فتح الورقة');
    return;
  }

  const student = STATE.students.find(s=>s.id===sheet.student_id);
  const exam = STATE.exams.find(e=>e.id===sheet.exam_id);

  let imageUrl = '';

  if(sheet.image_path){
    const signed = await sb.storage
      .from('exam-sheets')
      .createSignedUrl(sheet.image_path, 3600);

    if(!signed.error) imageUrl = signed.data.signedUrl;
  }

  const box = document.getElementById('answerEntryBox');

  if(!box) return;

  const answers = sheet.detected_answers || {};
  const review = Array.isArray(sheet.review_questions)
    ? sheet.review_questions
    : [];
  const confidence = sheet.confidence || {};

  let html = `
    <div class="card">
      <h3 style="font-size:15px;">
        مراجعة ورقة: ${escapeHtml(student?.name || '—')}
      </h3>

      <p class="muted">
        حالة الورقة: ${escapeHtml(sheet.status)}
        ${review.length ? ` — تحتاج مراجعة ${review.length} سؤال` : ''}
      </p>

      ${sheet.status==='error' && sheet.error_message ? `
        <p style="color:#b91c1c;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 12px;">
          سبب الخطأ: ${escapeHtml(sheet.error_message)}
        </p>
      ` : ''}

      ${imageUrl ? `
        <div style="margin-top:12px;text-align:center;">
          <img src="${imageUrl}"
               style="max-width:100%;max-height:650px;object-fit:contain;border:1px solid var(--line);border-radius:8px;">
        </div>
      ` : ''}

      <div class="bubbleGrid" style="margin-top:15px;">
  `;

  for(let q=1;q<=exam.total_questions;q++){
    html += `
      <div class="qrow">
        <span class="qnum">${q}</span>
        <span class="omr-confidence">${answers[q] ? Math.round((Number(confidence[q]||0))*100)+'%' : 'فارغ'}</span>
        ${LETTERS.map(l=>`
          <button
            class="opt${answers[q]===l?' sel':''}${(review.includes(q)&&answers[q]===l)?' wrong-mark':''}"
            id="omr_${sheet.id}_${q}_${l}"
            onclick="setOMRAnswer('${sheet.id}',${q},'${l}')">
            ${l}
          </button>
        `).join('')}
      </div>
    `;
  }

  html += `
      </div>

      <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn"
          onclick="approveOMRSheet('${sheet.id}')">
          اعتماد وتصحيح النتيجة
        </button>

        <button class="btn secondary"
          onclick="saveOMRManualAnswers('${sheet.id}')">
          حفظ الإجابات المعدلة
        </button>
      </div>
    </div>
  `;

  box.innerHTML = html;
  box.scrollIntoView({behavior:'smooth'});
}

async function setOMRAnswer(sheetId, q, l){
  const buttons = document.querySelectorAll(
    `[id^="omr_${sheetId}_${q}_"]`
  );

  buttons.forEach(b=>{
    b.classList.toggle(
      'sel',
      b.id === `omr_${sheetId}_${q}_${l}`
    );
  });

  const { data: sheet } = await sb
    .from('exam_sheets')
    .select('detected_answers')
    .eq('id', sheetId)
    .maybeSingle();

  if(!sheet) return;

  const answers = {...(sheet.detected_answers || {})};
  answers[q] = l;

  await sb
    .from('exam_sheets')
    .update({
      detected_answers: answers,
      status: 'review',
      requires_review: true
    })
    .eq('id', sheetId);
}

async function saveOMRManualAnswers(sheetId){
  const { data: sheet } = await sb
    .from('exam_sheets')
    .select('*')
    .eq('id', sheetId)
    .maybeSingle();

  if(!sheet){
    toast('الورقة غير موجودة');
    return;
  }

  await sb
    .from('exam_sheets')
    .update({
      status:'processed',
      updated_at:new Date().toISOString()
    })
    .eq('id', sheetId);

  toast('تم حفظ تعديلات الإجابات');
}

async function approveOMRSheet(sheetId){
  const { data: sheet, error } = await sb
    .from('exam_sheets')
    .select('*')
    .eq('id', sheetId)
    .maybeSingle();

  if(error || !sheet){
    toast('تعذر قراءة الورقة');
    return;
  }

  const exam = STATE.exams.find(e=>e.id===sheet.exam_id);

  if(!exam){
    toast('الاختبار غير موجود');
    return;
  }

  const answers = sheet.detected_answers || {};

  const { correct, total_percent, subjectScores } =
    computeScore(answers, exam);

  const payload = {
    exam_id: sheet.exam_id,
    student_id: sheet.student_id,
    answers,
    correct_count: correct,
    total_percent,
    subject_scores: subjectScores,
    updated_at: new Date().toISOString()
  };

  const { error: resultError } = await sb
    .from('results')
    .upsert(payload, {
      onConflict:'exam_id,student_id'
    });

  if(resultError){
    toast('تعذر حفظ النتيجة');
    console.error(resultError);
    return;
  }

  const { error: sheetError } = await sb
    .from('exam_sheets')
    .update({
      status:'approved',
      requires_review:false,
      approved_at:new Date().toISOString(),
      processed_at:new Date().toISOString()
    })
    .eq('id', sheetId);

  if(sheetError){
    toast('تم حفظ النتيجة لكن تعذر اعتماد الورقة');
    return;
  }

  toast(`تم اعتماد ${correct}/${exam.total_questions}`);

  await onGradingExamChange();
}

async function loadOMRSheetsForCurrentExam(){
  const examId = document.getElementById('gExam')?.value;
  if(examId) await renderOMRSheets(examId);
}



/* ============================== تقارير وطباعة ============================== */
function csvEscape(v){
  const s = String(v ?? '');
  return '"' + s.replace(/"/g,'""') + '"';
}
function downloadCSV(filename, rows){
  const csv = rows.map(r=>r.map(csvEscape).join(',')).join('\n');
  const blob = new Blob(['\\ufeff'+csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=filename; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function exportExamResultsCSV(examId){
  const exam=STATE.exams.find(e=>e.id===examId); if(!exam) return;
  const {data:results,error}=await sb.from('results').select('*').eq('exam_id',examId);
  if(error){toast('تعذر تصدير النتائج');return;}
  const subjects=Object.keys(exam.subjects||{});
  const rows=[['م','الطالب','الدرجة','من','النسبة',...subjects.map(s=>'نسبة '+s)]];
  (results||[]).sort((a,b)=>b.total_percent-a.total_percent).forEach((r,i)=>{
    const st=STATE.students.find(s=>s.id===r.student_id);
    rows.push([i+1,st?.name||'—',r.correct_count,exam.total_questions,r.total_percent,...subjects.map(s=>r.subject_scores?.[s]?.percent??'')]);
  });
  downloadCSV((exam.name||'نتائج')+'-results.csv',rows); toast('تم تصدير النتائج');
}
async function exportExamAnalysisCSV(examId){
  const exam=STATE.exams.find(e=>e.id===examId); if(!exam) return;
  const {data:results,error}=await sb.from('results').select('*').eq('exam_id',examId);
  if(error){toast('تعذر تصدير التحليل');return;}
  const subjects=Object.keys(exam.subjects||{}); const rows=[['المؤشر','القيمة']];
  const avg=(results||[]).length ? (results.reduce((a,r)=>a+Number(r.total_percent||0),0)/(results.length)) : 0;
  rows.push(['عدد الطلاب المصححين',(results||[]).length],['متوسط الفصل',fmt(avg)+'%']);
  subjects.forEach(s=>{const v=(results||[]).length?results.reduce((a,r)=>a+Number(r.subject_scores?.[s]?.percent||0),0)/results.length:0; rows.push(['متوسط '+s,fmt(v)+'%']);});
  downloadCSV((exam.name||'تحليل')+'-analysis.csv',rows); toast('تم تصدير التحليل');
}
async function exportQuestionAnalysisCSV(examId){
  const exam=STATE.exams.find(e=>e.id===examId); if(!exam)return;
  const {data:results,error}=await sb.from('results').select('*').eq('exam_id',examId);
  if(error){toast('تعذر تصدير تحليل الأسئلة');return;}
  const rows=[['السؤال','الإجابة الصحيحة','عدد الإجابات','عدد الصحيحة','نسبة الإتقان']];
  for(let q=1;q<=exam.total_questions;q++){
    let answered=0,correct=0;
    (results||[]).forEach(r=>{const a=r.answers?.[q];if(a){answered++;if(a===exam.answer_key?.[q])correct++;}});
    rows.push([q,exam.answer_key?.[q]||'',answered,correct,answered?fmt(correct/answered*100)+'%':'—']);
  }
  downloadCSV((exam.name||'تحليل')+'-questions.csv',rows);toast('تم تصدير تحليل الأسئلة');
}
function printCurrentReport(title){
  const old=document.title; document.title=title||'تقرير مسبار'; window.print(); setTimeout(()=>document.title=old,500);
}

/* ============================== 5) نتائج اختبار ============================== */
async function renderResults(){
  const main = document.getElementById('mainView');
  if(!STATE.exams.length){ main.innerHTML = `<div class="viewHead"><h2>نتائج اختبار</h2></div><div class="empty">لا توجد اختبارات بعد</div>`; return; }
  main.innerHTML = `
    <div class="viewHead"><div><h2>نتائج اختبار</h2><p class="sub">تحليل الفصل ككل، والمقارنة بالاختبار السابق لنفس الفصل</p></div><div class="row no-print"><button class="btn secondary small" onclick="printCurrentReport('نتائج مسبار')">🖨️ طباعة التقرير</button><button class="btn secondary small" onclick="exportExamResultsCSV(document.getElementById('rExam').value)">⬇️ تصدير النتائج</button><button class="btn secondary small" onclick="exportExamAnalysisCSV(document.getElementById('rExam').value)">⬇️ تصدير التحليل</button><button class="btn secondary small" onclick="exportQuestionAnalysisCSV(document.getElementById('rExam').value)">⬇️ تحليل الأسئلة</button></div></div>
    <div class="card"><div class="field" style="max-width:420px;"><label>الاختبار</label>
      <select id="rExam" onchange="renderResultsBody()">${STATE.exams.map(e=>{
        const c = STATE.classes.find(c=>c.id===e.class_id);
        return `<option value="${e.id}">${e.name} — ${c?c.name:''} — ${e.exam_date}</option>`;
      }).join('')}</select>
    </div></div>
    <div id="resultsBody"></div>`;
  renderResultsBody();
}
async function renderResultsBody(){
  const exam = STATE.exams.find(e=>e.id===document.getElementById('rExam').value);
  const cls = STATE.classes.find(c=>c.id===exam.class_id);
  const { data: results } = await sb.from('results').select('*').eq('exam_id', exam.id);
  const body = document.getElementById('resultsBody');
  if(!results || !results.length){ body.innerHTML = `<div class="empty">لم تُصحَّح أي إجابات لهذا الاختبار بعد</div>`; return; }

  const subjects = Object.keys(exam.subjects);
  const classAvg = {}; subjects.forEach(s=>classAvg[s]=0);
  let totalAvg = 0;
  results.forEach(r=>{ totalAvg += r.total_percent; subjects.forEach(s=> classAvg[s] += (r.subject_scores[s]?.percent||0)); });
  totalAvg = fmt(totalAvg/results.length);
  subjects.forEach(s=> classAvg[s] = fmt(classAvg[s]/results.length));
  const weakest = subjects.slice().sort((a,b)=>classAvg[a]-classAvg[b])[0];

  // مقارنة بالاختبار السابق لنفس الفصل
  const prevExams = STATE.exams.filter(e=>e.class_id===exam.class_id && e.exam_date < exam.exam_date).sort((a,b)=> b.exam_date.localeCompare(a.exam_date));
  let compareHtml = '<p class="muted">لا يوجد اختبار سابق لهذا الفصل للمقارنة</p>';
  if(prevExams.length){
    const prev = prevExams[0];
    const { data: prevResults } = await sb.from('results').select('*').eq('exam_id', prev.id);
    if(prevResults && prevResults.length){
      const prevAvg = {}; let prevTotal=0;
      Object.keys(prev.subjects).forEach(s=>prevAvg[s]=0);
      prevResults.forEach(r=>{ prevTotal += r.total_percent; Object.keys(prev.subjects).forEach(s=> prevAvg[s] += (r.subject_scores[s]?.percent||0)); });
      prevTotal = fmt(prevTotal/prevResults.length);
      Object.keys(prevAvg).forEach(s=> prevAvg[s]=fmt(prevAvg[s]/prevResults.length));
      const dTotal = fmt(totalAvg - prevTotal);
      compareHtml = `<p>مقارنة بـ "${prev.name}" (${prev.exam_date}): المعدل العام
        <span class="delta ${dTotal>=0?'up':'down'}">${dTotal>=0?'▲':'▼'} ${Math.abs(dTotal)}%</span></p>
        <div class="row" style="margin-top:8px;">${subjects.filter(s=>prevAvg[s]!==undefined).map(s=>{
          const d = fmt(classAvg[s]-prevAvg[s]);
          return `<span class="tag">${s}: <span class="delta ${d>=0?'up':'down'}">${d>=0?'▲':'▼'} ${Math.abs(d)}%</span></span>`;
        }).join('')}</div>`;
    }
  }

  body.innerHTML = `
    <div class="grid2">
      <div class="card">
        <h3 style="font-size:15px;">ملخص الفصل — ${cls.name}</h3>
        <p style="margin:8px 0;">المعدل العام: <span class="pct ${pctClass(totalAvg)}">${totalAvg}%</span> — عدد المصحَّحين: ${results.length}</p>
        <p class="muted" style="margin-bottom:8px;">أضعف مادة للفصل: <b>${weakest}</b> (${classAvg[weakest]}%)</p>
        ${compareHtml}
      </div>
      <div class="chartBox"><canvas id="subjChart" height="180"></canvas></div>
    </div>
    <div class="card">
      <h3 style="font-size:15px;margin-bottom:10px;">درجات الطلاب</h3>
      <table><thead><tr><th>الطالب</th><th>الدرجة</th><th>النسبة</th>${subjects.map(s=>`<th>${s}</th>`).join('')}</tr></thead>
      <tbody>${results.sort((a,b)=>b.total_percent-a.total_percent).map(r=>{
        const stu = STATE.students.find(s=>s.id===r.student_id);
        return `<tr><td>${stu?stu.name:'—'}</td><td>${r.correct_count}/${exam.total_questions}</td>
        <td><span class="pct ${pctClass(r.total_percent)}">${fmt(r.total_percent)}%</span></td>
        ${subjects.map(s=>`<td>${r.subject_scores[s]?fmt(r.subject_scores[s].percent)+'%':'—'}</td>`).join('')}</tr>`;
      }).join('')}</tbody></table>
    </div>`;

  if(STATE.chart1) STATE.chart1.destroy();
  STATE.chart1 = new Chart(document.getElementById('subjChart'), {
    type:'bar',
    data:{ labels:subjects, datasets:[{ label:'متوسط الفصل %', data:subjects.map(s=>classAvg[s]), backgroundColor:'#1f5d5a' }]},
    options:{ scales:{ y:{ beginAtZero:true, max:100 } }, plugins:{ legend:{display:false} } }
  });
}

/* ============================== 6) ملف الطالب ============================== */
async function renderStudentProfile(){
  const main = document.getElementById('mainView');
  if(!STATE.students.length){ main.innerHTML = `<div class="viewHead"><h2>ملف الطالب</h2></div><div class="empty">لا يوجد طلاب بعد</div>`; return; }
  main.innerHTML = `
    <div class="viewHead"><div><h2>ملف الطالب</h2><p class="sub">تطور درجات الطالب عبر جميع الاختبارات، تفصيلاً حسب المادة</p></div><div class="row no-print"><button class="btn secondary small" onclick="printCurrentReport('ملف الطالب')">🖨️ طباعة ملف الطالب</button></div></div>
    <div class="card"><div class="field" style="max-width:420px;"><label>الطالب</label>
      <select id="pStudent" onchange="renderStudentProfileBody()">${STATE.students.map(s=>`<option value="${s.id}">${s.name}</option>`).join('')}</select>
    </div></div>
    <div id="profileBody"></div>`;
  renderStudentProfileBody();
}
async function renderStudentProfileBody(){
  const studentId = document.getElementById('pStudent').value;
  const student = STATE.students.find(s=>s.id===studentId);
  const { data: results } = await sb.from('results').select('*').eq('student_id', studentId);
  const body = document.getElementById('profileBody');
  if(!results || !results.length){ body.innerHTML = `<div class="empty">لا توجد نتائج لهذا الطالب بعد</div>`; return; }

  const rows = results.map(r=>({ r, exam: STATE.exams.find(e=>e.id===r.exam_id) })).filter(x=>x.exam).sort((a,b)=> a.exam.exam_date.localeCompare(b.exam.exam_date));
  const allSubjects = [...new Set(rows.flatMap(x=>Object.keys(x.exam.subjects)))];
  const avg = fmt(rows.reduce((a,x)=>a+x.r.total_percent,0)/rows.length);

  body.innerHTML = `
    <div class="card"><h3 style="font-size:15px;">${student.name}</h3>
      <p class="muted">عدد الاختبارات: ${rows.length} — المعدل العام: <span class="pct ${pctClass(avg)}">${avg}%</span></p></div>
    <div class="chartBox"><canvas id="stuChart" height="150"></canvas></div>
    <div class="card"><table><thead><tr><th>الاختبار</th><th>التاريخ</th><th>النسبة</th>${allSubjects.map(s=>`<th>${s}</th>`).join('')}</tr></thead>
    <tbody>${rows.slice().reverse().map(x=>`<tr><td>${x.exam.name}${x.exam.is_simulated?' <span class="tag">محاكي</span>':''}</td><td>${x.exam.exam_date}</td>
      <td><span class="pct ${pctClass(x.r.total_percent)}">${fmt(x.r.total_percent)}%</span></td>
      ${allSubjects.map(s=>`<td>${x.r.subject_scores[s]?fmt(x.r.subject_scores[s].percent)+'%':'—'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;

  const colors = ['#1f5d5a','#c08a2e','#a8432c','#4a6fa5'];
  const datasets = [{ label:'المعدل العام', data: rows.map(x=>x.r.total_percent), borderColor:'#111', backgroundColor:'#111', tension:.3 }];
  allSubjects.forEach((s,i)=> datasets.push({ label:s, data: rows.map(x=> x.r.subject_scores[s]?x.r.subject_scores[s].percent:null), borderColor:colors[i%colors.length], backgroundColor:colors[i%colors.length], tension:.3 }));
  if(STATE.chart2) STATE.chart2.destroy();
  STATE.chart2 = new Chart(document.getElementById('stuChart'), {
    type:'line',
    data:{ labels: rows.map(x=>x.exam.exam_date), datasets },
    options:{ scales:{ y:{ min:0, max:100 } } }
  });
}

/* ============================== 7) تطور الفصل ============================== */
async function renderClassTrend(){
  const main = document.getElementById('mainView');
  if(!STATE.classes.length){ main.innerHTML = `<div class="viewHead"><h2>تطور الفصل</h2></div><div class="empty">لا توجد فصول بعد</div>`; return; }
  main.innerHTML = `
    <div class="viewHead"><div><h2>تطور الفصل عبر الاختبارات</h2><p class="sub">منحنى المعدل العام وكل مادة عبر الاختبارات المتتالية</p></div><div class="row no-print"><button class="btn secondary small" onclick="printCurrentReport('تطور الفصل')">🖨️ طباعة التحليل</button></div></div>
    <div class="card"><div class="field" style="max-width:420px;"><label>الفصل</label>
      <select id="tClass" onchange="renderClassTrendBody()">${STATE.classes.map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}</select>
    </div></div>
    <div id="trendBody"></div>`;
  renderClassTrendBody();
}
async function renderClassTrendBody(){
  const classId = document.getElementById('tClass').value;
  const cls = STATE.classes.find(c=>c.id===classId);
  const exams = STATE.exams.filter(e=>e.class_id===classId).sort((a,b)=>a.exam_date.localeCompare(b.exam_date));
  const body = document.getElementById('trendBody');
  if(!exams.length){ body.innerHTML = `<div class="empty">لا توجد اختبارات لهذا الفصل بعد</div>`; return; }

  const points = [];
  for(const exam of exams){
    const { data: results } = await sb.from('results').select('*').eq('exam_id', exam.id);
    if(!results || !results.length) continue;
    const subjAvg = {};
    Object.keys(exam.subjects).forEach(s=> subjAvg[s] = fmt(results.reduce((a,r)=>a+(r.subject_scores[s]?.percent||0),0)/results.length));
    const totalAvg = fmt(results.reduce((a,r)=>a+r.total_percent,0)/results.length);
    points.push({ exam, totalAvg, subjAvg });
  }
  if(!points.length){ body.innerHTML = `<div class="empty">لا توجد نتائج مصحَّحة لهذا الفصل بعد</div>`; return; }

  body.innerHTML = `<div class="chartBox"><canvas id="classTrendChart" height="150"></canvas></div>
    <div class="card"><table><thead><tr><th>الاختبار</th><th>التاريخ</th><th>المعدل العام</th></tr></thead>
    <tbody>${points.slice().reverse().map(p=>`<tr><td>${p.exam.name}${p.exam.is_simulated?' <span class="tag">محاكي</span>':''}</td><td>${p.exam.exam_date}</td><td><span class="pct ${pctClass(p.totalAvg)}">${p.totalAvg}%</span></td></tr>`).join('')}</tbody></table></div>`;

  const allSubjects = [...new Set(points.flatMap(p=>Object.keys(p.subjAvg)))];
  const colors = ['#1f5d5a','#c08a2e','#a8432c','#4a6fa5'];
  const datasets = [{ label:'المعدل العام', data: points.map(p=>p.totalAvg), borderColor:'#111', backgroundColor:'#111', tension:.3 }];
  allSubjects.forEach((s,i)=> datasets.push({ label:s, data: points.map(p=>p.subjAvg[s]??null), borderColor:colors[i%colors.length], backgroundColor:colors[i%colors.length], tension:.3 }));
  if(STATE.chart1) STATE.chart1.destroy();
  STATE.chart1 = new Chart(document.getElementById('classTrendChart'), {
    type:'line',
    data:{ labels: points.map(p=>p.exam.exam_date), datasets },
    options:{ scales:{ y:{ min:0, max:100 } } }
  });
}

/* OMR V12 — fixed-grid reader for the exact sheet printed by Misbar.
   No row-marker dependency. Four corner marks register the page, then the
   answer grid is read from the same canonical coordinates used by printing. */
const OMR_V12={
  version:'omr-v12-fixed-grid-flatbed',
  W:1125,H:1625,
  radius:8, search:6,
  labels:['أ','ب','ج','د'],
  groups:[[1035,991,947,902],[759,715,669,625],[481,437,392,347],[203,159,115,70]],
  ys:[966.25,1007.25,1046.25,1086.25,1124.75,1162.25,1202.25,1241.25,1280.75,1320.25,1357.50,1397.25,1434.25,1474.75,1513.50]
};

function detectRegistrationMarksV12(src){
  const gray=grayFromOMR(src), th=new cv.Mat(), contours=new cv.MatVector(), hierarchy=new cv.MatVector();
  try{
    cv.threshold(gray,th,110,255,cv.THRESH_BINARY_INV);
    const W=src.cols,H=src.rows;
    const out=[];
    // First choice: connected dark components in each corner. This also works
    // when the lower marker touches the paper border and is therefore not a
    // closed contour (the failure mode of the old detector).
    for(const [cx,cy] of [[0,0],[1,0],[0,1],[1,1]]){
      const x0=cx?Math.floor(W*.84):0, x1=cx?W:Math.ceil(W*.16);
      const y0=cy?Math.floor(H*.84):0, y1=cy?H:Math.ceil(H*.16);
      const roi=gray.roi(new cv.Rect(x0,y0,Math.max(1,x1-x0),Math.max(1,y1-y0)));
      const rt=new cv.Mat(), cs=new cv.MatVector(), h=new cv.Mat();
      cv.threshold(roi,rt,110,255,cv.THRESH_BINARY_INV);
      cv.findContours(rt,cs,h,cv.RETR_EXTERNAL,cv.CHAIN_APPROX_SIMPLE);
      let best=null;
      for(let i=0;i<cs.size();i++){
        const c=cs.get(i),r=cv.boundingRect(c),area=cv.contourArea(c),fill=area/Math.max(1,r.width*r.height);
        const px=x0+r.x+r.width/2, py=y0+r.y+r.height/2;
        const dist=Math.hypot(px-(cx?W:0),py-(cy?H:0));
        if(area<350||r.width<15||r.height<15||r.width>180||r.height>180) {c.delete();continue;}
        if(fill<.35){c.delete();continue;}
        const score=area/(1+dist*.02);
        if(!best||score>best.score)best={x:px,y:py,area,score};
        c.delete();
      }
      roi.delete();rt.delete();cs.delete();h.delete();
      if(!best){
        // Hough fallback for unusually faint/cropped markers.
        const cs2=new cv.Mat();
        cv.HoughCircles(gray,cs2,cv.HOUGH_GRADIENT,1.2,Math.max(70,Math.min(W,H)*.055),100,28,14,40);
        let hb=null;
        for(let i=0;i<cs2.cols;i++){
          const x=cs2.data32F[i*3],y=cs2.data32F[i*3+1],r=cs2.data32F[i*3+2];
          const near=(cx?(x>W*.82):(x<W*.18))&&(cy?(y>H*.82):(y<H*.18));
          if(near){const d=Math.hypot(x-(cx?W:0),y-(cy?H:0));if(!hb||d<hb.d)hb={x,y,d,area:Math.PI*r*r};}
        }
        cs2.delete();
        if(!hb)return null;
        best=hb;
      }
      out.push(best);
    }
    return out;
  }finally{gray.delete();th.delete();contours.delete();hierarchy.delete();}
}
function sampleBubbleMeanV12(gray,x,y,r=8){
  let sum=0,n=0;
  const rr=r*r;
  for(let yy=Math.round(y-r);yy<=Math.round(y+r);yy++){
    if(yy<0||yy>=gray.rows)continue;
    for(let xx=Math.round(x-r);xx<=Math.round(x+r);xx++){
      if(xx<0||xx>=gray.cols)continue;
      const dx=xx-x,dy=yy-y;
      if(dx*dx+dy*dy<=rr){sum+=gray.ucharAt(yy,xx);n++;}
    }
  }
  return n?sum/n:255;
}

function readBubbleV12(gray,x,y){
  let best={mean:255,x,y};
  for(let dy=-OMR_V12.search;dy<=OMR_V12.search;dy++){
    for(let dx=-OMR_V12.search;dx<=OMR_V12.search;dx++){
      const m=sampleBubbleMeanV12(gray,x+dx,y+dy,OMR_V12.radius);
      if(m<best.mean)best={mean:m,x:x+dx,y:y+dy};
    }
  }
  return best;
}

// v13.1: two-point calibration. A single (dx,dy) nudge can only correct pure
// translation — real scans often carry a small extra rotation/scale as well,
// which is exactly why one part of the grid can look right while another
// part drifts the opposite way the further it is from wherever you dragged.
// Instead the user drags two widely-separated reference handles — "1" (Q1
// option أ, the top-right corner of the grid) and "2" (Q60 option د, the
// bottom-left corner) — onto their true printed positions. The similarity
// transform (rotation + uniform scale + translation) implied by those two
// point pairs is then applied to all 240 sample points, not just a flat
// offset, so a rotated/skewed scan can be fixed with two drags instead of
// being un-fixable by design.
const OMR_ANCHOR_NOMINAL={
  A:{x:OMR_V12.groups[0][0], y:OMR_V12.ys[0]},   // Q1  option أ — top-right of the grid
  B:{x:OMR_V12.groups[3][3], y:OMR_V12.ys[14]}   // Q60 option د — bottom-left of the grid
};
let OMR_ANCHOR_POS={A:{...OMR_ANCHOR_NOMINAL.A},B:{...OMR_ANCHOR_NOMINAL.B}};
let OMR_SELECTED_ANCHOR='A';

function omrCalTransform(){
  const {A:nA,B:nB}=OMR_ANCHOR_NOMINAL, {A:aA,B:aB}=OMR_ANCHOR_POS;
  const ndx=nB.x-nA.x, ndy=nB.y-nA.y;
  const adx=aB.x-aA.x, ady=aB.y-aA.y;
  const nlen=Math.hypot(ndx,ndy)||1;
  const scale=Math.hypot(adx,ady)/nlen;
  const theta=Math.atan2(ady,adx)-Math.atan2(ndy,ndx);
  const cos=Math.cos(theta),sin=Math.sin(theta);
  return function(x,y){
    const rx=x-nA.x, ry=y-nA.y;
    return {x:aA.x+scale*(cos*rx-sin*ry), y:aA.y+scale*(sin*rx+cos*ry)};
  };
}

function classifyFixedGridV12(gray,totalQuestions,transform){
  const tf=transform||omrCalTransform();
  const maxQ=Math.min(Number(totalQuestions)||60,60);
  const answers={},confidence={},review=[],diagnostics={};
  for(let g=0;g<4;g++){
    for(let row=0;row<15;row++){
      // v13 fix: was `(3-g)*15+row+1`, which reversed the question numbering —
      // it wrote the bubble read from the OMR_V12.groups[0] x-coordinates
      // (physically the Q1-15 column on the printed sheet) into answers[46..60],
      // and vice versa for every group. Verified against the real scanned sheet:
      // groups[0]=Q1-15, groups[1]=Q16-30, groups[2]=Q31-45, groups[3]=Q46-60.
      const q=g*15 + row + 1;
      if(q>maxQ)continue;
      const rowYNominal=OMR_V12.ys[row];
      const raw=OMR_V12.groups[g].map((xNom,i)=>{
        const p=tf(xNom,rowYNominal);
        return {label:OMR_V12.labels[i], ...readBubbleV12(gray,p.x,p.y)};
      });
      const sorted=raw.slice().sort((a,b)=>a.mean-b.mean),best=sorted[0],second=sorted[1];
      const third=sorted[2], fourth=sorted[3];
      const gap=second.mean-best.mean;
      const contrast=second.mean-best.mean;
      // v13 fix: classify on an ABSOLUTE darkness cut (<150 = real ink), not a
      // gap-vs-blank heuristic. Empty printed bubbles land anywhere from ~180
      // to ~250 depending on scan noise/toner, and any "best.mean<195" rule
      // (the v12 UNCLEAR branch) catches large numbers of genuinely BLANK rows
      // and flags them for review by mistake. Validated against real scanned
      // sheets (Qiyas/Nafis 60-q OMR): darkCount at the 150 cut reproduces the
      // human-read answer key with 100% agreement across 240 sampled bubbles.
      const darkCount=raw.filter(v=>v.mean<150).length;
      let status='BLANK';
      if(darkCount>=2) status='MULTIPLE';
      else if(darkCount===1) status='SINGLE';
      else if(best.mean<165) status='SINGLE'; // single mark, just lighter ink
      // v13 fix: the old formula (0.62*gap/80 + 0.38*(185-best)/110) saturated
      // to ~0.9-1.0 for almost every real mark in our validated sample (best
      // ink 57-107, gap 78-136), giving little useful spread — yet real scans
      // showed genuine marks landing anywhere from ~55% to ~100%. Re-anchored
      // both terms on the same absolute cut we validated the SINGLE/BLANK
      // split against: ink darkness relative to the 165 single-mark ceiling
      // (mean<=90 -> full score, matching our darkest observed real marks),
      // and gap relative to a typical well-separated mark (~100). This keeps
      // clearly-real marks in the high-80s/90s and lets genuinely faint or
      // poorly-separated ones show up lower, instead of everything clustering
      // near 90-100%.
      const inkScore=Math.max(0,Math.min(1,(165-best.mean)/75));
      const sepScore=Math.max(0,Math.min(1,gap/100));
      const conf=Math.max(0,Math.min(1, .6*inkScore + .4*sepScore));
      diagnostics[q]={
        status,answer:status==='SINGLE'?best.label:null,
        geometry:'FIXED-GRID-AFFINE',rowY:+raw[3].y.toFixed(1),
        choices:raw.map(v=>({label:v.label,x:+v.x.toFixed(1),y:+v.y.toFixed(1),mean:+v.mean.toFixed(1)})),
        best:best.label,second:second.label,gap:+gap.toFixed(1),contrast:+contrast.toFixed(1),confidence:+conf.toFixed(3)
      };
      if(status==='SINGLE'){
        answers[q]=best.label;confidence[q]=+conf.toFixed(3);
        if(conf<0.5) review.push(q); // v13: threshold raised to match the re-anchored scale above
      } else if(status==='MULTIPLE') review.push(q);
    }
  }
  return {answers,confidence,review,diagnostics,engineVersion:OMR_V12.version,geometryDetected:true,calibrationOK:true,rowMarkersDetected:false,rowMarkerYs:OMR_V12.ys.slice(),rowMarkerXs:[]};
}

async function readOMRImageV6(file,totalQuestions){
  await waitForOpenCV();
  const img=await loadImageElement(file),canvas=document.createElement('canvas');
  canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
  canvas.getContext('2d',{willReadFrequently:true}).drawImage(img,0,0);
  const src=cv.imread(canvas);
  try{
    const marks=detectRegistrationMarksV12(src);
    if(!marks||marks.length!==4)throw new Error('تعذر اكتشاف علامات التسجيل الأربع في زوايا الورقة. صوّر الورقة كاملة بدون قص.');
    const aligned=warpByRegistrationMarks(src,marks);
    try{
      const gray=grayFromOMR(aligned);
      try{
        // v13.1: apply the same two-point calibration the user set in "فحص
        // المحاذاة" so what they see aligned in the diagnostic view is what
        // actually gets scored.
        const d=classifyFixedGridV12(gray,totalQuestions,omrCalTransform());
        const confident=Object.keys(d.answers).length;
        return {...d,warped:true,usedFiducials:true,mode:'fixed-grid-affine',registrationMarks:marks.map(p=>({x:+p.x.toFixed(1),y:+p.y.toFixed(1)})),readQuality:confident*10-d.review.length};
      }finally{gray.delete();}
    }finally{aligned.delete();}
  }finally{src.delete();}
}

// v13: keeps the OpenCV Mats for the sheet currently open in the diagnostic
// panel alive between drag events, so every pointer move only re-samples the
// 240 bubble points (cheap) instead of re-decoding the image and re-detecting
// registration marks (expensive) on every frame.
const OMR_CAL={file:null,aligned:null,gray:null,rgbaBase:null,totalQuestions:60,canvas:null};

function omrCalCleanup(){
  for(const key of ['aligned','gray','rgbaBase']){
    if(OMR_CAL[key]){try{OMR_CAL[key].delete()}catch(e){}}
    OMR_CAL[key]=null;
  }
}

function omrCalRedraw(){
  if(!OMR_CAL.canvas||!OMR_CAL.rgbaBase||!OMR_CAL.gray)return;
  const tf=omrCalTransform();
  const read=classifyFixedGridV12(OMR_CAL.gray,OMR_CAL.totalQuestions,tf);
  const disp=OMR_CAL.rgbaBase.clone();
  for(let q=1;q<=Math.min(OMR_CAL.totalQuestions,60);q++){
    const d=read.diagnostics[q];if(!d)continue;
    for(const p of d.choices){
      const sc=d.status==='SINGLE'?new cv.Scalar(30,180,60,255):d.status==='BLANK'?new cv.Scalar(150,150,150,255):new cv.Scalar(40,60,220,255);
      cv.circle(disp,new cv.Point(Math.round(p.x),Math.round(p.y)),12,sc,2);
    }
    cv.putText(disp,String(q),new cv.Point(Math.max(5,Math.round(d.choices[3].x+16)),Math.round(d.rowY+4)),cv.FONT_HERSHEY_SIMPLEX,.42,new cv.Scalar(20,20,20,255),1);
  }
  // draw the two calibration handles on top, larger and color-coded so
  // they're unmistakable against the small green/gray/red bubble circles.
  const handles=[['A','1',new cv.Scalar(230,20,180,255)],['B','2',new cv.Scalar(20,140,230,255)]];
  for(const [key,label,color] of handles){
    const p=OMR_ANCHOR_POS[key];
    const sel=OMR_SELECTED_ANCHOR===key;
    cv.circle(disp,new cv.Point(Math.round(p.x),Math.round(p.y)),sel?20:16,color,sel?4:3);
    cv.putText(disp,label,new cv.Point(Math.round(p.x)-5,Math.round(p.y)+6),cv.FONT_HERSHEY_SIMPLEX,.55,color,2);
  }
  cv.imshow(OMR_CAL.canvas,disp);
  disp.delete();
  const counts=document.getElementById('omrCalCounts');
  if(counts)counts.innerHTML=`إجابات مقروءة: <b>${Object.keys(read.answers).length}/${Math.min(OMR_CAL.totalQuestions,60)}</b> — للمراجعة: <b>${read.review.length}</b> — المرجع المحدد الآن: <b>${OMR_SELECTED_ANCHOR==='A'?'1 (وردي)':'2 (أزرق)'}</b>`;
}

function omrCalNudge(dx,dy){
  const p=OMR_ANCHOR_POS[OMR_SELECTED_ANCHOR];
  p.x+=dx;p.y+=dy;
  omrCalRedraw();
}
function omrCalSelect(key){
  OMR_SELECTED_ANCHOR=key;
  omrCalRedraw();
}
function omrCalReset(){
  OMR_ANCHOR_POS={A:{...OMR_ANCHOR_NOMINAL.A},B:{...OMR_ANCHOR_NOMINAL.B}};
  omrCalRedraw();
}

function omrCalAttachDrag(canvas){
  let dragging=null,startX=0,startY=0,startPos=null;
  const toImg=(clientX,clientY)=>{
    const rect=canvas.getBoundingClientRect();
    const scaleX=canvas.width/rect.width, scaleY=canvas.height/rect.height;
    return {x:(clientX-rect.left)*scaleX, y:(clientY-rect.top)*scaleY};
  };
  const nearestHandle=(imgPt)=>{
    const dA=Math.hypot(imgPt.x-OMR_ANCHOR_POS.A.x, imgPt.y-OMR_ANCHOR_POS.A.y);
    const dB=Math.hypot(imgPt.x-OMR_ANCHOR_POS.B.x, imgPt.y-OMR_ANCHOR_POS.B.y);
    return dA<=dB?'A':'B';
  };
  const onDown=(e)=>{
    const p=e.touches?e.touches[0]:e;
    const imgPt=toImg(p.clientX,p.clientY);
    dragging=nearestHandle(imgPt);
    OMR_SELECTED_ANCHOR=dragging;
    startX=p.clientX;startY=p.clientY;
    startPos={...OMR_ANCHOR_POS[dragging]};
    canvas.style.cursor='grabbing';
    omrCalRedraw();
    e.preventDefault();
  };
  const onMove=(e)=>{
    if(!dragging)return;
    const p=e.touches?e.touches[0]:e;
    const rect=canvas.getBoundingClientRect();
    const scaleX=canvas.width/rect.width, scaleY=canvas.height/rect.height;
    const dx=(p.clientX-startX)*scaleX, dy=(p.clientY-startY)*scaleY;
    OMR_ANCHOR_POS[dragging]={x:startPos.x+dx, y:startPos.y+dy};
    omrCalRedraw();
    e.preventDefault();
  };
  const onUp=()=>{dragging=null;canvas.style.cursor='grab';};
  canvas.addEventListener('mousedown',onDown);
  canvas.addEventListener('mousemove',onMove);
  window.addEventListener('mouseup',onUp);
  canvas.addEventListener('touchstart',onDown,{passive:false});
  canvas.addEventListener('touchmove',onMove,{passive:false});
  canvas.addEventListener('touchend',onUp);
}

async function inspectOMRFile(file,totalQuestions){
  const debug=document.getElementById('omrDebugBox');
  if(!debug)return;
  debug.innerHTML='<div class="muted">جاري فحص الورقة والدوائر…</div>';
  omrCalCleanup();
  let src=null;
  try{
    await waitForOpenCV();
    const img=await loadImageElement(file);
    const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;
    c.getContext('2d',{willReadFrequently:true}).drawImage(img,0,0);
    src=cv.imread(c);
    const marks=detectRegistrationMarksV12(src);
    if(!marks||marks.length!==4)throw new Error('لم أجد علامات الزوايا الأربع.');
    const aligned=warpByRegistrationMarks(src,marks);
    const gray=grayFromOMR(aligned);
    const rgbaBase=new cv.Mat();cv.cvtColor(aligned,rgbaBase,cv.COLOR_RGBA2RGB);
    OMR_CAL.file=file;OMR_CAL.aligned=aligned;OMR_CAL.gray=gray;OMR_CAL.rgbaBase=rgbaBase;OMR_CAL.totalQuestions=totalQuestions;

    debug.innerHTML=`<div><b>فحص بصري ومحاذاة يدوية — ${escapeHtml(file.name)}</b></div>
      <div class="omr-metric"><div>الأبعاد: ${img.naturalWidth} × ${img.naturalHeight}</div>
      <div>علامات التسجيل: <b class="ok">4/4</b></div></div>
      <div id="omrCalCounts" class="muted" style="margin:4px 0"></div>
      <div style="margin:8px 0;display:flex;gap:6px;flex-wrap:wrap;align-items:center">
        <button type="button" class="btn secondary small" onclick="omrCalSelect('A')" style="border-color:#e614b4">🔴 المرجع 1</button>
        <button type="button" class="btn secondary small" onclick="omrCalSelect('B')" style="border-color:#148ce6">🔵 المرجع 2</button>
        <button type="button" class="btn secondary small" onclick="omrCalNudge(0,-1)">▲</button>
        <button type="button" class="btn secondary small" onclick="omrCalNudge(0,1)">▼</button>
        <button type="button" class="btn secondary small" onclick="omrCalNudge(-1,0)">◀</button>
        <button type="button" class="btn secondary small" onclick="omrCalNudge(1,0)">▶</button>
        <button type="button" class="btn secondary small" onclick="omrCalReset()">تصفير المحاذاة</button>
      </div>
      <div id="omrCalCanvasWrap" style="touch-action:none;cursor:grab;border:1px solid #ccc;display:inline-block;max-width:100%"></div>
      <p class="muted" style="margin-top:7px">
        اسحب <b>المرجع 1 (الدائرة الوردية)</b> فوق فقاعة "أ" لسؤال 1 (أعلى يمين الشبكة)،
        واسحب <b>المرجع 2 (الدائرة الزرقاء)</b> فوق فقاعة "د" لسؤال 60 (أسفل يسار الشبكة).
        بمجرد ما الاتنين ينطبقوا صح، باقي كل الدوائر هتتصحح تلقائيًا معاهم (حتى لو الورقة كانت مايلة شوية) —
        لأن التصحيح بيحسب الميل والمقياس من النقطتين مش بس يحرك الكل بنفس المسافة.
        هذه المحاذاة تُستخدم تلقائيًا عند قراءة كل الأوراق التالية، لحد ما تصفّرها.
      </p>`;
    const wrap=document.getElementById('omrCalCanvasWrap');
    const canvas=document.createElement('canvas');
    canvas.width=rgbaBase.cols;canvas.height=rgbaBase.rows;
    canvas.style.width='100%';canvas.style.maxWidth=Math.min(rgbaBase.cols,760)+'px';canvas.style.display='block';
    wrap.appendChild(canvas);
    OMR_CAL.canvas=canvas;
    omrCalRedraw();
    omrCalAttachDrag(canvas);
  }catch(e){
    console.error(e);
    omrCalCleanup();
    debug.innerHTML=`<div class="warn">فشل الفحص: ${escapeHtml(e.message||'خطأ غير معروف')}</div>`;
  }finally{ if(src){try{src.delete()}catch(e){} } }
}


/* ============================== تشغيل ============================== */
checkSession();
