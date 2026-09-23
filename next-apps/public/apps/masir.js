import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ============================================================
   الإعدادات — عدّلوا فقط رابط المشروع (URL) أدناه
   تجدونه في: Supabase Dashboard → Settings → API → Project URL
   ============================================================ */
const SUPABASE_URL = "https://zlqlxneqjtmgfocmyqwi.supabase.co";
const SUPABASE_KEY = "sb_publishable_LV_Epn9mXfFj_GvNRs4lIQ_mbOfoYmW";

const url = SUPABASE_URL.startsWith("http") ? SUPABASE_URL : `https://${SUPABASE_URL}`;
const supabase = createClient(url, SUPABASE_KEY);

/* ---------- عناصر الشاشات ---------- */
const loginView = document.getElementById("loginView");
const adminView = document.getElementById("adminView");
const deptView = document.getElementById("deptView");

function showView(view) {
  loginView.classList.add("hidden");
  adminView.classList.add("hidden");
  deptView.classList.add("hidden");
  resetView.classList.add("hidden");
  view.classList.remove("hidden");
}

const resetView = document.getElementById("resetView");
const resetError = document.getElementById("resetError");
const resetSuccess = document.getElementById("resetSuccess");

function getAppRedirectUrl() {
  // نفس صفحة التطبيق الحالية؛ يجب إضافة هذا العنوان في Supabase
  // Authentication → URL Configuration → Redirect URLs.
  return `${window.location.origin}${window.location.pathname}`;
}

function showResetView() {
  resetError.classList.remove("show");
  resetSuccess.classList.remove("show");
  document.getElementById("newPasswordInput").value = "";
  document.getElementById("newPasswordConfirmInput").value = "";
  showView(resetView);
}

function isRecoveryUrl() {
  const hash = window.location.hash || "";
  const search = window.location.search || "";
  return /(^|[&#?])type=recovery(&|$)/i.test(hash) || /(^|[?&])type=recovery(&|$)/i.test(search);
}

document.getElementById("forgotPasswordBtn").addEventListener("click", async () => {
  const errBox = document.getElementById("loginError");
  errBox.classList.remove("show");

  const email = document.getElementById("userInput").value.trim();
  if (!email || !email.includes("@")) {
    errBox.textContent = "اكتب بريد الأدمن مثل: medadschool22@gmail.com ثم اضغط «نسيت كلمة المرور؟».";
    errBox.classList.add("show");
    return;
  }

  const btn = document.getElementById("forgotPasswordBtn");
  btn.disabled = true;
  btn.textContent = "جارٍ إرسال رابط الاستعادة...";

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getAppRedirectUrl()
    });
    if (error) throw error;

    errBox.className = "alert success show";
    errBox.textContent = "تم إرسال رابط استعادة كلمة المرور. افتحه ليعيدك إلى هذه الصفحة.";
  } catch (err) {
    errBox.className = "alert error show";
    errBox.textContent = "تعذر إرسال رابط الاستعادة: " + (err.message || "خطأ غير معروف");
  } finally {
    btn.disabled = false;
    btn.textContent = "نسيت كلمة المرور؟";
  }
});

document.getElementById("saveNewPasswordBtn").addEventListener("click", async () => {
  resetError.classList.remove("show");
  resetSuccess.classList.remove("show");

  const password = document.getElementById("newPasswordInput").value;
  const confirmPassword = document.getElementById("newPasswordConfirmInput").value;

  if (password.length < 6) {
    resetError.textContent = "كلمة المرور يجب أن تكون 6 أحرف/أرقام على الأقل.";
    resetError.classList.add("show");
    return;
  }
  if (password !== confirmPassword) {
    resetError.textContent = "تأكيد كلمة المرور غير مطابق.";
    resetError.classList.add("show");
    return;
  }

  const btn = document.getElementById("saveNewPasswordBtn");
  btn.disabled = true;
  btn.textContent = "جارٍ الحفظ...";

  try {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;

    resetSuccess.textContent = "تم تغيير كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول.";
    resetSuccess.classList.add("show");
    document.getElementById("newPasswordInput").value = "";
    document.getElementById("newPasswordConfirmInput").value = "";
    setTimeout(() => {
      window.history.replaceState({}, document.title, getAppRedirectUrl());
      showView(loginView);
    }, 1200);
  } catch (err) {
    resetError.textContent = "تعذر تغيير كلمة المرور: " + (err.message || "قد تكون وصلة الاستعادة منتهية أو مستخدمة.");
    resetError.classList.add("show");
  } finally {
    btn.disabled = false;
    btn.textContent = "حفظ كلمة المرور";
  }
});

document.getElementById("backToLoginBtn").addEventListener("click", async () => {
  await supabase.auth.signOut();
  window.history.replaceState({}, document.title, getAppRedirectUrl());
  showView(loginView);
});

supabase.auth.onAuthStateChange(async (event) => {
  if (event === "PASSWORD_RECOVERY") {
    showResetView();
  }
});

/* ---------- تسجيل الدخول ---------- */
async function bootstrap() {
  const { data: { session } } = await supabase.auth.getSession();

  // إذا رجع المستخدم من رابط استعادة كلمة المرور، اعرض شاشة تغيير كلمة المرور.
  if (isRecoveryUrl()) {
    if (session) {
      showResetView();
    } else {
      showView(loginView);
      const errBox = document.getElementById("loginError");
      errBox.textContent = "رابط الاستعادة غير صالح أو انتهت صلاحيته. اطلب رابطًا جديدًا.";
      errBox.className = "alert error show";
    }
    return;
  }

  if (session) {
    await routeByRole(session.user.id);
  } else {
    showView(loginView);
  }
}

async function routeByRole(userId) {
  const { data: profile } = await supabase.from("profiles").select("role, department_id").eq("id", userId).single();
  if (profile?.role === "super_admin") {
    showView(adminView);
    await initAdmin();
  } else if (profile?.role === "department") {
    showView(deptView);
    setDeptTopbarForRealLogin();
    await initDept(profile.department_id);
  } else {
    document.getElementById("loginError").textContent = "لم يتم العثور على صلاحية لهذا الحساب.";
    document.getElementById("loginError").classList.add("show");
    showView(loginView);
  }
}

document.getElementById("loginBtn").addEventListener("click", async () => {
  const errBox = document.getElementById("loginError");
  errBox.classList.remove("show");
  let user = document.getElementById("userInput").value.trim();
  const password = document.getElementById("passInput").value;
  if (!user || !password) {
    errBox.textContent = "يرجى تعبئة اسم المستخدم وكلمة المرور.";
    errBox.classList.add("show");
    return;
  }
  const email = user.includes("@") ? user : `${user}@dept.internal`;
  const btn = document.getElementById("loginBtn");
  btn.disabled = true; btn.textContent = "جارٍ الدخول...";
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  btn.disabled = false; btn.textContent = "دخول";
  if (error) {
    errBox.textContent = "بيانات الدخول غير صحيحة.";
    errBox.classList.add("show");
    return;
  }
  await routeByRole(data.user.id);
});

document.getElementById("adminLogoutBtn").addEventListener("click", doLogout);

function setDeptTopbarForRealLogin() {
  const btn = document.getElementById("deptLogoutBtn");
  btn.textContent = "تسجيل الخروج";
  btn.onclick = doLogout;
}
function setDeptTopbarForAdminView() {
  const btn = document.getElementById("deptLogoutBtn");
  btn.textContent = "العودة للوحة الأدمن";
  btn.onclick = () => showView(adminView);
}
async function doLogout() {
  await supabase.auth.signOut();
  location.reload();
}

/* ============================================================
   لوحة الأدمن العام
   ============================================================ */
let adminInitialized = false;
async function initAdmin() {
  document.querySelectorAll(".admin-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".admin-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById("tab-schools").classList.toggle("hidden", tab.dataset.tab !== "schools");
      document.getElementById("tab-departments").classList.toggle("hidden", tab.dataset.tab !== "departments");
    });
  });

  if (adminInitialized) return;
  adminInitialized = true;

  const logoFile = document.getElementById("logoFile");
  const logoDrop = document.getElementById("logoDrop");
  const logoDropText = document.getElementById("logoDropText");
  logoFile.addEventListener("change", () => {
    const f = logoFile.files[0];
    if (!f) return;
    logoDrop.classList.add("has-file");
    logoDropText.innerHTML = `<b>تم اختيار:</b> ${f.name}`;
  });

  document.getElementById("addSchoolBtn").addEventListener("click", async () => {
    const errorBox = document.getElementById("schoolError");
    const successBox = document.getElementById("schoolSuccess");
    errorBox.classList.remove("show"); successBox.classList.remove("show");
    const name = document.getElementById("schoolName").value.trim();
    if (!name) {
      errorBox.textContent = "يرجى إدخال اسم المدرسة.";
      errorBox.classList.add("show");
      return;
    }
    const btn = document.getElementById("addSchoolBtn");
    btn.disabled = true; btn.textContent = "جارٍ الحفظ...";
    try {
      let logo_url = null;
      const file = logoFile.files[0];
      if (file) {
        const path = `${Date.now()}_${file.name}`;
        const { error: upErr } = await supabase.storage.from("logos").upload(path, file);
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("logos").getPublicUrl(path);
        logo_url = pub.publicUrl;
      }
      const { error: insErr } = await supabase.from("schools").insert({ name, logo_url });
      if (insErr) throw insErr;
      successBox.classList.add("show");
      document.getElementById("schoolName").value = "";
      logoFile.value = "";
      logoDrop.classList.remove("has-file");
      logoDropText.innerHTML = "<b>اضغط لاختيار الشعار</b>";
      await loadSchools();
    } catch (err) {
      errorBox.textContent = "حدث خطأ: " + err.message;
      errorBox.classList.add("show");
    } finally {
      btn.disabled = false; btn.textContent = "إضافة المدرسة";
    }
  });

  document.getElementById("addDeptBtn").addEventListener("click", addDepartment);
  document.getElementById("deptSchoolSelect").addEventListener("change", loadDepartments);
  document.getElementById("closeModalBtn").addEventListener("click", () => {
    document.getElementById("credModal").classList.remove("show");
  });

  document.getElementById("closeLockModalBtn").addEventListener("click", () => {
    document.getElementById("monthLockModal").classList.remove("show");
  });
  document.getElementById("lockMonthPicker").addEventListener("change", refreshLockStatus);
  document.getElementById("toggleLockBtn").addEventListener("click", toggleMonthLock);

  await loadSchools();
  await loadSchoolOptions();
}

async function loadSchools() {
  const grid = document.getElementById("schoolsGrid");
  const emptyState = document.getElementById("schoolsEmpty");
  const { data, error } = await supabase.from("schools").select("*").order("created_at", { ascending: false });
  if (error || !data || !data.length) {
    grid.innerHTML = "";
    emptyState.style.display = "block";
    return;
  }
  emptyState.style.display = "none";
  grid.innerHTML = data.map(s => `
    <div class="entity-card">
      <div class="logo-mini">${s.logo_url ? `<img src="${s.logo_url}" style="width:100%;height:100%;object-fit:contain">` : ""}</div>
      <div class="name">${s.name}</div>
      <button class="btn small outline goto-dept" data-id="${s.id}">إدارة الأقسام</button>
    </div>
  `).join("");
  grid.querySelectorAll(".goto-dept").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelector('.admin-tab[data-tab="departments"]').click();
      document.getElementById("deptSchoolSelect").value = btn.dataset.id;
      loadDepartments();
    });
  });
}

async function loadSchoolOptions() {
  const { data: schools } = await supabase.from("schools").select("*").order("created_at", { ascending: false });
  const select = document.getElementById("deptSchoolSelect");
  select.innerHTML = (schools || []).map(s => `<option value="${s.id}">${s.name}</option>`).join("");
  if (schools && schools.length) await loadDepartments();
}

async function loadDepartments() {
  const schoolId = document.getElementById("deptSchoolSelect").value;
  const body = document.getElementById("deptBody");
  const emptyState = document.getElementById("deptEmpty");
  if (!schoolId) return;
  const { data, error } = await supabase.from("departments").select("*").eq("school_id", schoolId).order("created_at", { ascending: false });
  if (error || !data || !data.length) {
    body.innerHTML = "";
    emptyState.style.display = "block";
    return;
  }
  emptyState.style.display = "none";
  body.innerHTML = data.map(d => `
    <tr data-id="${d.id}" data-name="${d.name}">
      <td>${d.name}</td>
      <td style="direction:ltr">${d.username}</td>
      <td style="display:flex; gap:6px; justify-content:center; flex-wrap:wrap">
        <button class="btn small gold view-dept-btn">دخول لبيانات القسم</button>
        <button class="btn small outline lock-btn">قفل/فتح الأشهر</button>
        <button class="btn small outline regen-btn">تجديد بيانات الدخول</button>
        <button class="btn small danger-outline delete-dept-btn">حذف القسم</button>
      </td>
    </tr>`).join("");

  body.querySelectorAll(".view-dept-btn").forEach(btn => {
    btn.addEventListener("click", () => viewDepartmentAsAdmin(btn.closest("tr").dataset.id));
  });
  body.querySelectorAll(".lock-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const tr = btn.closest("tr");
      openMonthLock(tr.dataset.id, tr.dataset.name);
    });
  });
  body.querySelectorAll(".regen-btn").forEach(btn => {
    btn.addEventListener("click", () => regenerateDeptCredentials(btn.closest("tr").dataset.id, btn));
  });
  body.querySelectorAll(".delete-dept-btn").forEach(btn => {
    btn.addEventListener("click", () => deleteDepartment(btn.closest("tr"), btn));
  });
}

// يتيح للأدمن العام الدخول مباشرة لبيانات أي قسم (الموظفين والمسير) دون الحاجة
// لبيانات دخول ذلك القسم — الصلاحيات في قاعدة البيانات تسمح للأدمن العام بذلك أصلاً
async function viewDepartmentAsAdmin(departmentId) {
  setDeptTopbarForAdminView();
  showView(deptView);
  await initDept(departmentId);
}

let currentLockDeptId = null;

function openMonthLock(deptId, deptName) {
  currentLockDeptId = deptId;
  document.getElementById("lockModalTitle").textContent = `قفل/فتح الأشهر: ${deptName}`;
  const now = new Date();
  document.getElementById("lockMonthPicker").value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  document.getElementById("lockError").classList.remove("show");
  document.getElementById("monthLockModal").classList.add("show");
  refreshLockStatus();
}

async function refreshLockStatus() {
  const statusText = document.getElementById("lockStatusText");
  const toggleBtn = document.getElementById("toggleLockBtn");
  statusText.textContent = "...";
  const monthDate = monthToDate(document.getElementById("lockMonthPicker").value);

  const { data } = await supabase.from("month_locks").select("*").eq("department_id", currentLockDeptId).eq("month", monthDate).maybeSingle();
  const isLocked = data?.locked === true;

  statusText.textContent = isLocked ? "مقفل 🔒" : "مفتوح ✓";
  statusText.style.color = isLocked ? "var(--danger)" : "var(--success)";
  toggleBtn.textContent = isLocked ? "فتح هذا الشهر" : "قفل هذا الشهر";
  toggleBtn.className = isLocked ? "btn full gold" : "btn full danger-outline";
}

async function toggleMonthLock() {
  const errorBox = document.getElementById("lockError");
  errorBox.classList.remove("show");
  const monthDate = monthToDate(document.getElementById("lockMonthPicker").value);
  const toggleBtn = document.getElementById("toggleLockBtn");

  const { data: existing } = await supabase.from("month_locks").select("*").eq("department_id", currentLockDeptId).eq("month", monthDate).maybeSingle();
  const newLocked = !(existing?.locked === true);

  toggleBtn.disabled = true;
  const { error } = await supabase.from("month_locks").upsert({
    department_id: currentLockDeptId, month: monthDate, locked: newLocked, updated_at: new Date().toISOString()
  }, { onConflict: "department_id,month" });
  toggleBtn.disabled = false;

  if (error) {
    errorBox.textContent = "حدث خطأ: " + error.message;
    errorBox.classList.add("show");
    return;
  }
  await refreshLockStatus();
}

async function deleteDepartment(tr, btn) {
  const id = tr.dataset.id;
  const name = tr.dataset.name;
  if (!confirm(`متأكد تبي تحذف قسم "${name}"؟ سيتم حذف كل موظفيه وسجلات المسير الخاصة بهم أيضًا، ولا يمكن التراجع.`)) return;
  btn.disabled = true; btn.textContent = "...";
  const { error } = await supabase.from("departments").delete().eq("id", id);
  if (error) {
    alert("حدث خطأ أثناء الحذف: " + error.message);
    btn.disabled = false; btn.textContent = "حذف القسم";
    return;
  }
  await loadDepartments();
}

// "تجديد بيانات الدخول" — بما أننا لا نملك مفتاح صلاحيات كاملة (service role) هنا،
// لا يمكن تغيير كلمة مرور نفس الحساب مباشرة. البديل الآمن: إنشاء حساب دخول جديد
// بالكامل لنفس القسم، وإلغاء صلاحية الحساب القديم فورًا (يبقى بلا أي دور، فلا يستطيع الدخول).
async function regenerateDeptCredentials(deptId, btn) {
  if (!confirm("سيتم إلغاء بيانات الدخول القديمة لهذا القسم فورًا وتوليد بيانات جديدة بدلها. متابعة؟")) return;
  btn.disabled = true; btn.textContent = "...";

  try {
    const { data: deptRow, error: fetchErr } = await supabase.from("departments").select("*").eq("id", deptId).single();
    if (fetchErr) throw fetchErr;
    const oldAuthUserId = deptRow.auth_user_id;

    const username = "d" + Math.random().toString(36).slice(2, 8);
    const password = Math.random().toString(36).slice(2, 6) + Math.random().toString(36).slice(2, 6) + "A1";
    const email = `${username}@dept.internal`;

    const tempClient = createClient(url, SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data: signUpData, error: signUpErr } = await tempClient.auth.signUp({ email, password });
    if (signUpErr) throw signUpErr;
    if (!signUpData.user) throw new Error("تعذر إنشاء الحساب الجديد.");
    const newUserId = signUpData.user.id;

    const { error: updateErr } = await supabase.from("departments")
      .update({ username, auth_user_id: newUserId })
      .eq("id", deptId);
    if (updateErr) throw updateErr;

    const { error: newProfErr } = await supabase.from("profiles").insert({
      id: newUserId, role: "department", department_id: deptId
    });
    if (newProfErr) throw newProfErr;

    if (oldAuthUserId) {
      await supabase.from("profiles").delete().eq("id", oldAuthUserId);
    }

    document.getElementById("credUser").textContent = username;
    document.getElementById("credPass").textContent = password;
    document.getElementById("credModal").classList.add("show");
    await loadDepartments();
  } catch (err) {
    alert("حدث خطأ: " + err.message);
  } finally {
    btn.disabled = false; btn.textContent = "تجديد بيانات الدخول";
  }
}

// إنشاء حساب قسم جديد مباشرة من المتصفح، دون أي سيرفر إضافي:
// نستخدم عميل Supabase منفصل ومؤقت (لا يحفظ الجلسة) لإنشاء المستخدم،
// حتى لا تنقطع جلسة دخول الأدمن الحالية.
async function addDepartment() {
  const errorBox = document.getElementById("deptError");
  errorBox.classList.remove("show");
  const schoolId = document.getElementById("deptSchoolSelect").value;
  const deptName = document.getElementById("deptName").value.trim();
  if (!schoolId || !deptName) {
    errorBox.textContent = "يرجى اختيار المدرسة وإدخال اسم القسم.";
    errorBox.classList.add("show");
    return;
  }
  const btn = document.getElementById("addDeptBtn");
  btn.disabled = true; btn.textContent = "جارٍ الإنشاء...";

  try {
    const username = "d" + Math.random().toString(36).slice(2, 8);
    const password = Math.random().toString(36).slice(2, 6) + Math.random().toString(36).slice(2, 6) + "A1";
    const email = `${username}@dept.internal`;

    // عميل مؤقت منفصل — persistSession:false يمنعه من الكتابة فوق جلسة الأدمن الحالية
    const tempClient = createClient(url, SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: signUpData, error: signUpErr } = await tempClient.auth.signUp({ email, password });
    if (signUpErr) throw signUpErr;
    if (!signUpData.user) throw new Error("لم يتم إنشاء المستخدم — تأكدوا أن خيار 'Confirm email' مُعطَّل في إعدادات Supabase.");

    const newUserId = signUpData.user.id;

    const { data: dept, error: deptErr } = await supabase.from("departments").insert({
      school_id: schoolId, name: deptName, username, auth_user_id: newUserId
    }).select().single();
    if (deptErr) throw deptErr;

    const { error: profErr } = await supabase.from("profiles").insert({
      id: newUserId, role: "department", department_id: dept.id
    });
    if (profErr) throw profErr;

    document.getElementById("credUser").textContent = username;
    document.getElementById("credPass").textContent = password;
    document.getElementById("credModal").classList.add("show");
    document.getElementById("deptName").value = "";
    await loadDepartments();
  } catch (err) {
    errorBox.textContent = "حدث خطأ: " + err.message;
    errorBox.classList.add("show");
  } finally {
    btn.disabled = false; btn.textContent = "إضافة القسم وتوليد بيانات الدخول";
  }
}

/* ============================================================
   لوحة القسم
   ============================================================ */
let deptInitialized = false;
let myDepartmentId = null;
let mySchoolInfo = null;

async function initDept(departmentId) {
  myDepartmentId = departmentId;

  const { data: deptRow, error: deptError } = await supabase.from("departments").select("id, school_id, name").eq("id", departmentId).single();
  if (deptError || !deptRow) throw new Error("تعذر تحديد القسم الحالي.");
  if (deptRow?.school_id) {
    const { data: schoolRow } = await supabase.from("schools").select("name, logo_url").eq("id", deptRow.school_id).single();
    mySchoolInfo = schoolRow || null;
  }

  if (deptInitialized) {
    document.querySelectorAll(".dept-tab").forEach(t => t.classList.remove("active"));
    document.querySelector('.dept-tab[data-tab="employees"]').classList.add("active");
    document.getElementById("tab-employees").classList.remove("hidden");
    document.getElementById("tab-sheet").classList.add("hidden");
    await loadEmployees();
    return;
  }
  deptInitialized = true;

  document.querySelectorAll(".dept-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".dept-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById("tab-employees").classList.toggle("hidden", tab.dataset.tab !== "employees");
      document.getElementById("tab-sheet").classList.toggle("hidden", tab.dataset.tab !== "sheet");
      if (tab.dataset.tab === "sheet") loadSheet();
    });
  });

  const monthPicker = document.getElementById("monthPicker");
  const now = new Date();
  monthPicker.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  document.getElementById("addEmpBtn").addEventListener("click", addEmployee);
  document.getElementById("loadSheetBtn").addEventListener("click", loadSheet);
  document.getElementById("saveAllBtn").addEventListener("click", saveSheet);
  document.getElementById("saveAllBtn2").addEventListener("click", saveSheet);
  document.getElementById("exportPdfBtn").addEventListener("click", exportPDF);

  document.getElementById("closeEmpReportModalBtn").addEventListener("click", () => {
    document.getElementById("empReportModal").classList.remove("show");
  });
  document.getElementById("repAllMonths").addEventListener("change", (e) => {
    document.getElementById("repFromMonth").disabled = e.target.checked;
    document.getElementById("repToMonth").disabled = e.target.checked;
  });
  document.getElementById("generateEmpReportBtn").addEventListener("click", generateEmployeeReport);

  await loadEmployees();
}

async function addEmployee() {
  const errorBox = document.getElementById("empError");
  errorBox.classList.remove("show");
  const full_name = document.getElementById("empName").value.trim();
  const job_title = document.getElementById("empJob").value.trim();
  const start_date = document.getElementById("empStart").value || null;
  const email = document.getElementById("empEmail").value.trim() || null;
  if (!full_name) {
    errorBox.textContent = "يرجى إدخال اسم الموظف.";
    errorBox.classList.add("show");
    return;
  }
  const btn = document.getElementById("addEmpBtn");
  btn.disabled = true;
  const { error } = await supabase.from("employees").insert({ department_id: myDepartmentId, full_name, job_title, start_date, email });
  btn.disabled = false;
  if (error) {
    errorBox.textContent = "حدث خطأ: " + error.message;
    errorBox.classList.add("show");
    return;
  }
  document.getElementById("empName").value = "";
  document.getElementById("empJob").value = "";
  document.getElementById("empStart").value = "";
  document.getElementById("empEmail").value = "";
  await loadEmployees();
}

async function loadEmployees() {
  const body = document.getElementById("empBody");
  const emptyState = document.getElementById("empEmpty");
  const { data, error } = await supabase.from("employees").select("*").eq("department_id", myDepartmentId).order("created_at", { ascending: true });
  if (error || !data || !data.length) {
    body.innerHTML = "";
    emptyState.style.display = "block";
    return;
  }
  emptyState.style.display = "none";
  body.innerHTML = data.map((e, i) => `
    <tr data-id="${e.id}" data-name="${(e.full_name || "").replace(/"/g, "&quot;")}" style="${e.is_active === false ? "opacity:.55" : ""}">
      <td>${i + 1}</td>
      <td class="name-cell"><input type="text" class="f-name" value="${e.full_name || ""}"></td>
      <td><input type="text" class="f-job" value="${e.job_title || ""}"></td>
      <td><input type="date" class="f-date" value="${e.start_date || ""}"></td>
      <td><input type="text" class="f-email" value="${e.email || ""}" placeholder="teacher@example.com" style="direction:ltr"></td>
      <td>${e.is_active === false
        ? `<span style="color:var(--danger); font-weight:700; font-size:12px">مجمّد</span>`
        : `<span style="color:var(--success); font-weight:700; font-size:12px">نشط</span>`}</td>
      <td style="display:flex; gap:6px; justify-content:center; flex-wrap:wrap">
        <button class="btn small outline save-btn">حفظ</button>
        <button class="btn small ${e.is_active === false ? "gold" : "outline"} freeze-btn">${e.is_active === false ? "تفعيل" : "تجميد"}</button>
        <button class="btn small outline report-btn">تقرير</button>
        <button class="btn small danger-outline delete-btn">حذف</button>
      </td>
    </tr>`).join("");
  body.querySelectorAll(".save-btn").forEach(saveBtn => {
    saveBtn.addEventListener("click", async (ev) => {
      const tr = ev.target.closest("tr");
      const id = tr.dataset.id;
      const full_name = tr.querySelector(".f-name").value.trim();
      const job_title = tr.querySelector(".f-job").value.trim();
      const start_date = tr.querySelector(".f-date").value || null;
      const email = tr.querySelector(".f-email").value.trim() || null;
      saveBtn.disabled = true; saveBtn.textContent = "...";
      const { error } = await supabase.from("employees").update({ full_name, job_title, start_date, email, updated_at: new Date().toISOString() }).eq("id", id);
      saveBtn.disabled = false; saveBtn.textContent = error ? "خطأ" : "تم ✓";
      setTimeout(() => (saveBtn.textContent = "حفظ"), 1500);
    });
  });
  body.querySelectorAll(".freeze-btn").forEach(freezeBtn => {
    freezeBtn.addEventListener("click", async (ev) => {
      const tr = ev.target.closest("tr");
      const id = tr.dataset.id;
      const currentlyFrozen = freezeBtn.textContent.trim() === "تفعيل";
      freezeBtn.disabled = true;
      const { error } = await supabase.from("employees").update({ is_active: currentlyFrozen, updated_at: new Date().toISOString() }).eq("id", id);
      freezeBtn.disabled = false;
      if (error) { alert("حدث خطأ: " + error.message); return; }
      await loadEmployees();
    });
  });
  body.querySelectorAll(".report-btn").forEach(repBtn => {
    repBtn.addEventListener("click", (ev) => {
      const tr = ev.target.closest("tr");
      openEmployeeReport(tr.dataset.id, tr.dataset.name);
    });
  });
  body.querySelectorAll(".delete-btn").forEach(delBtn => {
    delBtn.addEventListener("click", async (ev) => {
      const tr = ev.target.closest("tr");
      const id = tr.dataset.id;
      const name = tr.querySelector(".f-name").value.trim();
      if (!confirm(`متأكد تبي تحذف "${name}"؟ سيتم حذف كل سجلات المسير الخاصة به أيضًا ولا يمكن التراجع.`)) return;
      delBtn.disabled = true; delBtn.textContent = "...";
      const { error } = await supabase.from("employees").delete().eq("id", id);
      if (error) {
        alert("حدث خطأ أثناء الحذف: " + error.message);
        delBtn.disabled = false; delBtn.textContent = "حذف";
        return;
      }
      await loadEmployees();
    });
  });
}

function monthToDate(monthStr) { return `${monthStr}-01`; }

function formatAbsenceDate(v) {
  const m = String(v || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}
// متاح أيضًا عالميًا لمنع خطأ formatAbsenceDate في أي استدعاء قديم/خارجي.
window.formatAbsenceDate = formatAbsenceDate;

function renderAbsenceDates(tr) {
  const hidden = tr.querySelector(".f-absdates");
  const list = tr.querySelector(".absence-date-list");
  const dates = (hidden.value || "").split(/\n+/).map(x => x.trim()).filter(Boolean);
  list.innerHTML = dates.map((d, idx) => `
    <div class="absence-date-item">
      <span>${window.formatAbsenceDate(d)}</span>
      <button type="button" class="remove-date" data-index="${idx}" title="حذف">×</button>
    </div>`).join("");
  list.querySelectorAll(".remove-date").forEach(btn => btn.addEventListener("click", () => {
    const arr = (hidden.value || "").split(/\n+/).map(x => x.trim()).filter(Boolean);
    arr.splice(Number(btn.dataset.index), 1);
    hidden.value = arr.join("\n");
    renderAbsenceDates(tr);
  }));
}

async function loadSheet() {
  const errorBox = document.getElementById("sheetError");
  const successBox = document.getElementById("sheetSuccess");
  errorBox.classList.remove("show"); successBox.classList.remove("show");
  const body = document.getElementById("sheetBody");
  const emptyState = document.getElementById("sheetEmpty");

  const { data: employees, error: empErr } = await supabase.from("employees").select("*").eq("department_id", myDepartmentId).eq("is_active", true).order("created_at", { ascending: true });
  if (empErr || !employees || !employees.length) {
    body.innerHTML = "";
    emptyState.style.display = "block";
    return;
  }
  emptyState.style.display = "none";

  const monthDate = monthToDate(document.getElementById("monthPicker").value);
  const { data: entries } = await supabase.from("attendance_entries").select("*").eq("month", monthDate).in("employee_id", employees.map(e => e.id));
  const entryMap = {};
  (entries || []).forEach(e => (entryMap[e.employee_id] = e));

  body.innerHTML = employees.map((emp, i) => {
    const en = entryMap[emp.id] || {};
    return `
    <tr data-emp="${emp.id}" data-emp-name="${(emp.full_name || "").replace(/"/g, "&quot;")}" data-emp-email="${emp.email || ""}">
      <td>${i + 1}</td>
      <td class="name-cell">${emp.full_name}</td>
      <td>${emp.job_title || "-"}</td>
      <td>${emp.start_date || "-"}</td>
      <td><input type="number" min="0" class="f-exc" value="${en.absence_excused ?? 0}"></td>
      <td><input type="number" min="0" class="f-unexc" value="${en.absence_unexcused ?? 0}"></td>
      <td class="f-total">${(en.absence_excused ?? 0) + (en.absence_unexcused ?? 0)}</td>
      <td class="absence-date-editor">
        <div class="date-add-row">
          <input type="date" class="f-absdate-picker" aria-label="اختيار تاريخ الغياب">
          <button type="button" class="add-date-btn btn small outline">إضافة</button>
        </div>
        <div class="absence-date-list"></div>
        <textarea class="f-absdates" style="display:none">${(en.absence_dates || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</textarea>
      </td>
      <td><input type="number" min="0" class="f-late" value="${en.late_minutes ?? 0}"></td>
      <td><input type="number" min="0" class="f-early" value="${en.early_leave_minutes ?? 0}"></td>
      <td><input type="number" min="0" class="f-nofp" value="${en.no_fingerprint_days ?? 0}"></td>
      <td><input type="number" min="0" class="f-perm" value="${en.permission_days ?? 0}"></td>
      <td><input type="number" min="0" class="f-extra" value="${en.extra_classes ?? 0}"></td>
      <td><div class="manual-sign-box" aria-label="خانة توقيع يدوي"></div></td>
      <td><input type="text" class="f-notes" value="${en.notes || ""}"></td>
      <td><button class="btn small outline send-btn">إرسال</button></td>
    </tr>`;
  }).join("");

  body.querySelectorAll("tr").forEach(tr => {
    renderAbsenceDates(tr);
    const picker = tr.querySelector(".f-absdate-picker");
    const addBtn = tr.querySelector(".add-date-btn");
    addBtn.addEventListener("click", () => {
      const value = picker.value;
      if (!value) return;
      const hidden = tr.querySelector(".f-absdates");
      const arr = (hidden.value || "").split(/\n+/).map(x => x.trim()).filter(Boolean);
      if (!arr.includes(value)) arr.push(value);
      arr.sort();
      hidden.value = arr.join("\n");
      picker.value = "";
      renderAbsenceDates(tr);
    });
  });

  body.querySelectorAll(".send-btn").forEach(sendBtn => {
    sendBtn.addEventListener("click", (ev) => {
      const tr = ev.target.closest("tr");
      sendEmployeeEmail(tr);
    });
  });

  // شريط تمرير علوي متزامن مع جدول المسير، حتى تقدر تحرك الأعمدة وأنت في أول معلم.
  const sheetCard = document.getElementById("sheetTableCard");
  const topScroll = document.getElementById("sheetScrollTop");
  const topInner = document.getElementById("sheetScrollTopInner");
  const sheetTable = sheetCard?.querySelector("table");
  if (sheetCard && topScroll && topInner && sheetTable) {
    const syncScrollWidth = () => {
      topInner.style.width = sheetTable.scrollWidth + "px";
      topScroll.scrollLeft = sheetCard.scrollLeft;
    };
    let syncingTop = false, syncingCard = false;
    topScroll.onscroll = () => {
      if (syncingTop) return;
      syncingCard = true;
      sheetCard.scrollLeft = topScroll.scrollLeft;
      syncingCard = false;
    };
    sheetCard.onscroll = () => {
      if (syncingCard) return;
      syncingTop = true;
      topScroll.scrollLeft = sheetCard.scrollLeft;
      syncingTop = false;
    };
    syncScrollWidth();
    requestAnimationFrame(syncScrollWidth);
  }

  body.querySelectorAll("tr").forEach(tr => {
    const exc = tr.querySelector(".f-exc"), unexc = tr.querySelector(".f-unexc"), total = tr.querySelector(".f-total");
    function updateTotal() { total.textContent = (Number(exc.value) || 0) + (Number(unexc.value) || 0); }
    exc.addEventListener("input", updateTotal);
    unexc.addEventListener("input", updateTotal);
  });

  // التحقق من قفل هذا الشهر لهذا القسم (يضبطه الأدمن العام)
  const { data: lockRow } = await supabase.from("month_locks").select("locked").eq("department_id", myDepartmentId).eq("month", monthDate).maybeSingle();
  const isLocked = lockRow?.locked === true;
  const lockBanner = document.getElementById("lockBanner");
  lockBanner.classList.toggle("show", isLocked);
  body.querySelectorAll("input").forEach(inp => (inp.disabled = isLocked));
  document.getElementById("saveAllBtn").disabled = isLocked;
  document.getElementById("saveAllBtn2").disabled = isLocked;
}

async function saveSheet() {
  const errorBox = document.getElementById("sheetError");
  const successBox = document.getElementById("sheetSuccess");
  errorBox.classList.remove("show"); successBox.classList.remove("show");

  const monthDate = monthToDate(document.getElementById("monthPicker").value);
  const rows = document.getElementById("sheetBody").querySelectorAll("tr");
  if (!rows.length) return;

  const payload = Array.from(rows).map(tr => ({
    employee_id: tr.dataset.emp,
    month: monthDate,
    absence_excused: Number(tr.querySelector(".f-exc").value) || 0,
    absence_unexcused: Number(tr.querySelector(".f-unexc").value) || 0,
    absence_dates: tr.querySelector(".f-absdates").value.trim(),
    late_minutes: Number(tr.querySelector(".f-late").value) || 0,
    early_leave_minutes: Number(tr.querySelector(".f-early").value) || 0,
    no_fingerprint_days: Number(tr.querySelector(".f-nofp").value) || 0,
    permission_days: Number(tr.querySelector(".f-perm").value) || 0,
    extra_classes: Number(tr.querySelector(".f-extra").value) || 0,
    teacher_ack: false,
    notes: tr.querySelector(".f-notes").value.trim(),
    updated_at: new Date().toISOString()
  }));

  const { error } = await supabase.from("attendance_entries").upsert(payload, { onConflict: "employee_id,month" });
  if (error) {
    errorBox.textContent = "حدث خطأ أثناء الحفظ: " + error.message;
    errorBox.classList.add("show");
    return;
  }
  successBox.classList.add("show");
}

// يجهّز رسالة بريد جاهزة لهذا الموظف تتضمن أرقام الشهر المطلوبة
// (الاستئذان، الغياب، التأخير) ويفتحها في برنامج البريد الافتراضي للمستخدم
// (لا يوجد سيرفر بريد في هذا الموقع، فالإرسال الفعلي يتم من برنامج بريد المستخدم نفسه)
function sendEmployeeEmail(tr) {
  const empName = tr.dataset.empName;
  const empEmail = tr.dataset.empEmail;
  if (!empEmail) {
    alert(`لا يوجد بريد إلكتروني مسجّل للموظف "${empName}". أضيفوه أولًا من "قائمة الموظفين".`);
    return;
  }

  const monthValue = document.getElementById("monthPicker").value;
  if (!monthValue) { alert("اختر الشهر أولًا."); return; }
  const [y, m] = monthValue.split("-");
  const monthLabel = `${arabicMonths[parseInt(m, 10) - 1]} ${y}`;

  // جميع أعمدة المسير بدون استثناء.
  const no = tr.children[0]?.textContent?.trim() || "";
  const job = tr.children[2]?.textContent?.trim() || "";
  const startDate = tr.children[3]?.textContent?.trim() || "";
  const exc = tr.querySelector(".f-exc")?.value || "0";
  const unexc = tr.querySelector(".f-unexc")?.value || "0";
  const total = tr.querySelector(".f-total")?.textContent?.trim() || "0";
  const absDatesRaw = tr.querySelector(".f-absdates")?.value || "";
  const absDates = absDatesRaw ? absDatesRaw.split(/\n+/).map(d => { const m=d.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${m[3]}/${m[2]}/${m[1]}` : d.trim(); }).filter(Boolean).join("\n") : "لا يوجد";
  const late = tr.querySelector(".f-late")?.value || "0";
  const early = tr.querySelector(".f-early")?.value || "0";
  const noFingerprint = tr.querySelector(".f-nofp")?.value || "0";
  const permission = tr.querySelector(".f-perm")?.value || "0";
  const extra = tr.querySelector(".f-extra")?.value || "0";
  const ack = tr.querySelector(".f-ack")?.checked ? "تم" : "لم يتم";
  const notes = tr.querySelector(".f-notes")?.value || "لا توجد";

  const subject = `المسير الكامل - ${empName} - ${monthLabel}`;
  const body = `الأستاذ/ة ${empName} المحترم/ة

بيانات المسير الكاملة لشهر ${monthLabel}:

م: ${no}
اسم الموظف: ${empName}
المسمى الوظيفي: ${job}
تاريخ المباشرة: ${startDate}

عدد أيام الغياب بعذر: ${exc}
عدد أيام الغياب بدون عذر: ${unexc}
إجمالي أيام الغياب: ${total}
تاريخ الغياب (ميلادي): ${absDates}
عدد دقائق التأخير: ${late}
عدد دقائق الانصراف المبكر: ${early}
عدد أيام عدم البصمة: ${noFingerprint}
عدد أيام الاستئذان: ${permission}
حصص إضافية: ${extra}
توقيع المعلم بالعلم: ${ack}
ملاحظات: ${notes}

مع تحيات الإدارة.`;

  // لا يوضع أي service_role/secret داخل المتصفح.
  // الإرسال الحالي يفتح برنامج البريد؛ الإرسال الآلي الآمن يحتاج Edge Function على الخادم.
  const mailtoLink = `mailto:${encodeURIComponent(empEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = mailtoLink;
}

let currentReportEmpId = null;
let currentReportEmpName = null;

function openEmployeeReport(empId, empName) {
  currentReportEmpId = empId;
  currentReportEmpName = empName;
  document.getElementById("empReportTitle").textContent = `تقرير الموظف: ${empName}`;
  document.getElementById("repAllMonths").checked = false;
  document.getElementById("repShowStartDate").checked = true;
  document.getElementById("repFromMonth").disabled = false;
  document.getElementById("repToMonth").disabled = false;
  document.getElementById("repFromMonth").value = "";
  document.getElementById("repToMonth").value = "";
  document.getElementById("empReportError").classList.remove("show");
  document.getElementById("empReportModal").classList.add("show");
}

async function generateEmployeeReport() {
  const errorBox = document.getElementById("empReportError");
  errorBox.classList.remove("show");

  const allMonths = document.getElementById("repAllMonths").checked;
  const showStartDate = document.getElementById("repShowStartDate").checked;
  const fromVal = document.getElementById("repFromMonth").value;
  const toVal = document.getElementById("repToMonth").value;

  if (!allMonths && (!fromVal || !toVal)) {
    errorBox.textContent = "يرجى تحديد الفترة، أو اختيار 'كل الشهور'.";
    errorBox.classList.add("show");
    return;
  }

  const btn = document.getElementById("generateEmpReportBtn");
  btn.disabled = true; btn.textContent = "جارٍ التحضير...";

  try {
    const { data: emp, error: empError } = await supabase.from("employees").select("*").eq("id", currentReportEmpId).eq("department_id", myDepartmentId).single();
    if (empError || !emp) throw new Error("هذا الموظف لا يتبع القسم الحالي.");

    let query = supabase.from("attendance_entries").select("*").eq("employee_id", currentReportEmpId).order("month", { ascending: true });
    if (!allMonths) {
      query = query.gte("month", monthToDate(fromVal)).lte("month", monthToDate(toVal));
    }
    const { data: entries, error } = await query;
    if (error) throw error;

    if (!entries || !entries.length) {
      errorBox.textContent = "لا توجد سجلات مسير لهذا الموظف في الفترة المحددة.";
      errorBox.classList.add("show");
      return;
    }

    const totals = { exc: 0, unexc: 0, total: 0, late: 0, early: 0, nofp: 0, perm: 0, extra: 0 };
    const rowsHtml = entries.map(en => {
      const [ey, em] = en.month.split("-");
      const label = `${arabicMonths[parseInt(em, 10) - 1]} ${ey}`;
      const exc = en.absence_excused || 0, unexc = en.absence_unexcused || 0;
      totals.exc += exc; totals.unexc += unexc; totals.total += exc + unexc;
      totals.late += en.late_minutes || 0; totals.early += en.early_leave_minutes || 0;
      totals.nofp += en.no_fingerprint_days || 0; totals.perm += en.permission_days || 0; totals.extra += en.extra_classes || 0;
      return `<tr>
        <td class="pr-name">${label}</td><td>${exc}</td><td>${unexc}</td><td>${exc + unexc}</td>
        <td><div class="absence-date-list">${String(en.absence_dates || "").split(/\n+/).map(d => d.trim()).filter(Boolean).map(d => `<div>${window.formatAbsenceDate(d)}</div>`).join("")}</div></td><td>${en.late_minutes || 0}</td><td>${en.early_leave_minutes || 0}</td>
        <td>${en.no_fingerprint_days || 0}</td><td>${en.permission_days || 0}</td><td>${en.extra_classes || 0}</td>
        <td>${en.notes || ""}</td>
      </tr>`;
    }).join("");

    const totalRowHtml = `<tr style="font-weight:bold; background:#f2ead6">
      <td class="pr-name">المجموع</td><td>${totals.exc}</td><td>${totals.unexc}</td><td>${totals.total}</td>
      <td>-</td><td>${totals.late}</td><td>${totals.early}</td><td>${totals.nofp}</td><td>${totals.perm}</td><td>${totals.extra}</td><td>-</td>
    </tr>`;

    const today = new Date();
    const todayLabel = `${String(today.getDate()).padStart(2,"0")} / ${String(today.getMonth()+1).padStart(2,"0")} / ${today.getFullYear()}م`;

    const printArea = document.getElementById("printArea");
    printArea.innerHTML = `
      ${buildHeaderHtml(todayLabel)}
      <hr style="border:none; border-top:1.5px solid #999; margin:8px 0 14px">
      <div style="text-align:center; margin-bottom:6px">
        <h3 style="margin:0; font-size:15px">تقرير الموظف: ${emp?.full_name || currentReportEmpName}</h3>
        <div style="font-size:10px; color:#555">${emp?.job_title || ""}${showStartDate && emp?.start_date ? ` — تاريخ المباشرة: ${emp.start_date}` : ""}${allMonths ? " — كل الشهور" : ` — من ${fromVal} إلى ${toVal}`}</div>
      </div>
      <table>
        <colgroup><col style="width:12%"><col style="width:8%"><col style="width:8%"><col style="width:8%"><col style="width:10%"><col style="width:9%"><col style="width:10%"><col style="width:9%"><col style="width:9%"><col style="width:6%"><col style="width:11%"></colgroup>
        <thead><tr>
          <th>الشهر</th><th>بعذر</th><th>بدون عذر</th><th>مجموع الغياب</th><th>تاريخ الغياب</th>
          <th>دقائق التأخير</th><th>دقائق الانصراف<br>المبكر</th><th>أيام عدم<br>البصمة</th><th>أيام<br>الاستئذان</th><th>حصص<br>إضافية</th><th>ملاحظات</th>
        </tr></thead>
        <tbody>${rowsHtml}${totalRowHtml}</tbody>
      </table>
      <div class="employee-report-signature" style="margin-top:10px; width:100%; border:1px solid #777; box-sizing:border-box; page-break-inside:avoid;">
        <div style="font-size:10px; font-weight:700; text-align:right; padding:4px 8px; border-bottom:1px solid #777;">توقيع المعلم بالعلم</div>
        <div style="height:70px;"></div>
      </div>
      <div class="print-page-date">تاريخ الطباعة: ${todayLabel}</div>
    `;

    document.getElementById("empReportModal").classList.remove("show");
    document.body.classList.add("printing");
    window.print();
  } catch (err) {
    errorBox.textContent = "حدث خطأ: " + err.message;
    errorBox.classList.add("show");
  } finally {
    btn.disabled = false; btn.textContent = "إنشاء وطباعة التقرير";
  }
}

const arabicMonths = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

// عناوين نظيفة (بدون فواصل أسطر) — تُستخدم في Excel حيث لا يصح ظهور وسوم HTML
const REPORT_HEADERS = ["م","اسم الموظف","المسمى الوظيفي","تاريخ المباشرة","بعذر","بدون عذر","مجموع","تاريخ الغياب (ميلادي)","دقائق التأخير","دقائق الانصراف المبكر","أيام عدم البصمة","أيام الاستئذان","حصص إضافية","توقيع العلم","ملاحظات"];
// نفس العناوين لكن مقسّمة على سطرين حيث يلزم — لعرض أنظف في PDF/Word (لا مشكلة إطلاقًا أن يظهر العنوان تحت بعضه)
const REPORT_HEADERS_DISPLAY = ["م","اسم الموظف","المسمى<br>الوظيفي","تاريخ<br>المباشرة","بعذر","بدون<br>عذر","مجموع","تاريخ الغياب<br>(ميلادي)","دقائق<br>التأخير","دقائق الانصراف<br>المبكر","أيام عدم<br>البصمة","أيام<br>الاستئذان","حصص<br>إضافية","توقيع<br>العلم","ملاحظات"];
// عرض كل عمود كنسبة مئوية (المجموع = 100) — يمنع تداخل الأعمدة في PDF/Word
const REPORT_COL_WIDTHS = [3, 12, 7, 7, 4, 5, 4, 9, 6, 7, 7, 6, 6, 10, 7];

// يجمع بيانات المسير الحالية المعروضة على الشاشة (تشمل أي تعديل لسا ما انحفظ)
// ليستخدمها كل من تصدير PDF وExcel وWord بنفس البيانات بالضبط
function getReportData() {
  const rows = document.getElementById("sheetBody").querySelectorAll("tr");
  if (!rows.length) return null;

  const [y, m] = document.getElementById("monthPicker").value.split("-");
  const monthLabel = `${arabicMonths[parseInt(m, 10) - 1]} ${y}`;
  const today = new Date();
  const todayLabel = `${String(today.getDate()).padStart(2,"0")} / ${String(today.getMonth()+1).padStart(2,"0")} / ${today.getFullYear()}م`;

  const dataRows = Array.from(rows).map((tr, i) => [
    String(i + 1),
    tr.querySelector(".name-cell").textContent,
    tr.children[2].textContent,
    tr.children[3].textContent,
    tr.querySelector(".f-exc").value || "0",
    tr.querySelector(".f-unexc").value || "0",
    tr.querySelector(".f-total").textContent,
    tr.querySelector(".f-absdates").value,
    tr.querySelector(".f-late").value || "0",
    tr.querySelector(".f-early").value || "0",
    tr.querySelector(".f-nofp").value || "0",
    tr.querySelector(".f-perm").value || "0",
    tr.querySelector(".f-extra").value || "0",
    "",
    tr.querySelector(".f-notes").value
  ]);

  return { monthLabel, todayLabel, dataRows };
}

// ترويسة موحّدة (مبنية كجدول وليس flexbox، لأن Word لا يدعم flexbox إطلاقًا)
// تُستخدم في كل من PDF وWord لضمان تطابق الشكل
function buildHeaderHtml(todayLabel) {
  const logoCell = mySchoolInfo?.logo_url
    ? `<img src="${mySchoolInfo.logo_url}" style="width:72px; height:72px; object-fit:contain; border-radius:50%; border:2px solid #C9A24B;">`
    : "";
  return `
    <table style="width:100%; border-collapse:collapse; margin-bottom:8px;" cellpadding="0" cellspacing="0">
      <tr>
        <td style="width:38%; vertical-align:top; text-align:right; line-height:1.9; font-size:12px;">
          <div style="font-weight:bold; font-size:14px;">${mySchoolInfo?.name || ""}</div>
          <div>تحت إشراف وزارة التعليم ـ منطقة الرياض</div>
          <div>الادارة العامة للمدارس</div>
        </td>
        <td style="width:24%; vertical-align:top; text-align:center;">${logoCell}</td>
        <td style="width:38%; vertical-align:top; text-align:right; line-height:1.9; font-size:12px;">
          <div>الرقيم: ................................</div>
          <div>التاريخ: ................................</div>
          <div>الموافق: ${todayLabel}</div>
          <div>المرفقات: ................................</div>
        </td>
      </tr>
    </table>`;
}

function buildColgroupHtml() {
  return `<colgroup>${REPORT_COL_WIDTHS.map(w => `<col style="width:${w}%">`).join("")}</colgroup>`;
}

function exportPDF() {
  const report = getReportData();
  if (!report) { alert("لا يوجد بيانات لتصديرها — حمّلوا المسير أولاً."); return; }

  const rowsHtml = report.dataRows.map(r => `
    <tr>
      <td>${r[0]}</td><td class="pr-name">${r[1]}</td><td class="monthly-job">${r[2]}</td><td>${document.getElementById("sheetShowStartDate")?.checked ? r[3] : ""}</td>
      <td>${r[4]}</td><td>${r[5]}</td><td>${r[6]}</td>
      <td><div class="absence-date-list">${String(r[7] || "").split(/\n+/).map(d => d.trim()).filter(Boolean).map(d => { const m=d.match(/^(\d{4})-(\d{2})-(\d{2})$/); return `<div>${m ? `${m[3]}/${m[2]}/${m[1]}` : d}</div>`; }).join("")}</div></td>
      <td>${r[8]}</td><td>${r[9]}</td><td>${r[10]}</td><td>${r[11]}</td>
      <td>${r[12]}</td><td><div class="print-sign-box"></div></td><td class="monthly-notes">${r[14]}</td>
    </tr>`).join("");

  const printArea = document.getElementById("printArea");
  printArea.innerHTML = `
    ${buildHeaderHtml(report.todayLabel)}
    <hr style="border:none; border-top:1.5px solid #999; margin:8px 0 14px">
    <div style="text-align:center; margin-bottom:12px">
      <h3 style="margin:0; font-size:15px">مسير شهر ${report.monthLabel}</h3>
    </div>
    <table>
      ${buildColgroupHtml()}
      <thead><tr>${REPORT_HEADERS_DISPLAY.map(h => `<th>${h}</th>`).join("")}</tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <div class="monthly-approval">
      <div class="approval-title">اعتماد إدارة المدرسة</div>
      <table style="width:100%; border-collapse:collapse; table-layout:fixed;">
        <tr>
          <td><strong>مدير المدرسة</strong><br><br>التوقيع: ................................</td>
          <td><strong>وكيل المدرسة</strong><br><br>التوقيع: ................................</td>
          <td><strong>الختم</strong><br><br>................................</td>
        </tr>
      </table>
    </div>
    <div class="print-page-date">تاريخ الطباعة: ${report.todayLabel}</div>
  `;

  document.body.classList.add("printing");
  window.print();
}

window.addEventListener("afterprint", () => document.body.classList.remove("printing"));

function downloadBlob(blob, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}



bootstrap();
