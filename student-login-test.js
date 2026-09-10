const elements = {
  loginPanel: document.querySelector("#loginPanel"),
  studentPanel: document.querySelector("#studentPanel"),
  loginForm: document.querySelector("#loginForm"),
  loginEmail: document.querySelector("#loginEmail"),
  loginPassword: document.querySelector("#loginPassword"),
  resetPasswordBtn: document.querySelector("#resetPasswordBtn"),
  loginResult: document.querySelector("#loginResult"),
  accountName: document.querySelector("#accountName"),
  logoutBtn: document.querySelector("#logoutBtn"),
  form: document.querySelector("#submissionForm"),
  studentSelect: document.querySelector("#studentSelect"),
  validatorSelect: document.querySelector("#validatorSelect"),
  weekSelect: document.querySelector("#studentWeekSelect"),
  validatorHint: document.querySelector("#validatorHint"),
  validatorList: document.querySelector("#validatorList"),
  note: document.querySelector("#studentNote"),
  result: document.querySelector("#studentResult"),
};

const FIREBASE_URL_KEY = "shatibiyya-firebase-url";
const GROUP_KEY = "shatibiyya-active-group";
const AUTH_SESSION_KEY = "shatibiyya-login-test-session";
const TEST_GROUP_STORAGE_ID = "login-test-group1";
const TEST_REMOTE_URL = "https://houssemhfaidh.github.io/groupe-shatibiyya/student-login-test.html";
const DEFAULT_GROUP_ID = "group1";
const VALID_GROUP_IDS = ["group1", "group2"];
let currentGroupId = initialGroupId();
let currentConfig = null;
let currentAuthSession = readAuthSession();
let currentUserProfile = null;

function initialGroupId() {
  const fromQuery = new URLSearchParams(window.location.search).get("group");
  const saved = localStorage.getItem(GROUP_KEY);
  const groupId = fromQuery || saved || DEFAULT_GROUP_ID;
  return VALID_GROUP_IDS.includes(groupId) ? groupId : DEFAULT_GROUP_ID;
}

function weekLabel(week) {
  return `من ${week.start} إلى ${week.end}`;
}

function formatDate(dateString) {
  if (!dateString) return "";
  return new Intl.DateTimeFormat("ar", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${dateString}T12:00:00`));
}

function normalizeArabic(value) {
  return value
    .toString()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u064b-\u065f\u0670]/g, "")
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function studentId(name) {
  return normalizeArabic(name).replace(/\s+/g, "-");
}

function statusKey(studentName, weekId) {
  return `${studentId(studentName)}__${weekId}`;
}

function getStatus(config, studentName, weekId) {
  return config?.statuses?.[statusKey(studentName, weekId)] || "";
}

function isGreenStudent(config, studentName, weekId) {
  return getStatus(config, studentName, weekId) === "done";
}

function findWeek(weekId) {
  return currentConfig?.weeks?.find((week) => week.id === weekId);
}

function endOfDay(dateString) {
  return new Date(`${dateString}T23:59:59.999`);
}

function weekDeadline(week) {
  if (!week?.date) return null;
  const deadline = endOfDay(week.date);
  const boundaryDay = Number(currentConfig?.settings?.weekBoundaryDay ?? 6);
  let dayOffset = (boundaryDay - deadline.getDay() + 7) % 7;
  if (dayOffset === 0) dayOffset = 7;
  deadline.setDate(deadline.getDate() + dayOffset);
  return deadline;
}

function isLateConfirmation(weekId, createdAt) {
  const deadline = weekDeadline(findWeek(weekId));
  if (!deadline || !createdAt) return false;
  return new Date(createdAt) > deadline;
}

function confirmationStatus(weekId, createdAt) {
  return isLateConfirmation(weekId, createdAt) ? "makeup" : "done";
}

function getFirebaseUrl() {
  if (window.SHATIBIYYA_LOGIN_TEST_LOCAL_ONLY) return "";
  const fromQuery = new URLSearchParams(window.location.search).get("db");
  const configured = fromQuery || localStorage.getItem(FIREBASE_URL_KEY) || window.SHATIBIYYA_FIREBASE_DB_URL || "";
  const cleaned = configured.trim().replace(/\/+$/, "");
  if (cleaned) {
    localStorage.setItem(FIREBASE_URL_KEY, cleaned);
  }
  localStorage.setItem(GROUP_KEY, currentGroupId);
  return cleaned;
}

function seedCurrentUserForLoginTest(config) {
  if (!currentUserProfile?.studentName) {
    return config;
  }
  const weekId = config.weeks?.at(-1)?.id;
  if (!weekId) return config;
  return {
    ...config,
    statuses: {
      ...(config.statuses || {}),
      [statusKey(currentUserProfile.studentName, weekId)]: "done",
    },
  };
}

function firebasePath(path) {
  const url = new URL(`${getFirebaseUrl()}/${path}.json`);
  if (currentAuthSession?.idToken) {
    url.searchParams.set("auth", currentAuthSession.idToken);
  }
  return url.toString();
}

function groupPath(path) {
  if (path === "config") return `config/groups/${TEST_GROUP_STORAGE_ID}`;
  if (path.startsWith("config/")) return `config/groups/${TEST_GROUP_STORAGE_ID}/${path.slice("config/".length)}`;
  if (path === "submissions") return `submissions/groups/${TEST_GROUP_STORAGE_ID}`;
  if (path.startsWith("submissions/")) return `submissions/groups/${TEST_GROUP_STORAGE_ID}/${path.slice("submissions/".length)}`;
  return path;
}

function productionGroupPath(path) {
  if (currentGroupId === DEFAULT_GROUP_ID) return path;
  if (path === "config") return `config/groups/${currentGroupId}`;
  if (path.startsWith("config/")) return `config/groups/${currentGroupId}/${path.slice("config/".length)}`;
  if (path === "submissions") return `submissions/groups/${currentGroupId}`;
  if (path.startsWith("submissions/")) return `submissions/groups/${currentGroupId}/${path.slice("submissions/".length)}`;
  return path;
}

async function firebaseRequest(path, options = {}) {
  await ensureFreshAuthSession();
  const response = await fetch(firebasePath(path), {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!response.ok) {
    throw new Error("لم يقبل Firebase الطلب.");
  }
  return response.json();
}

function getAuthConfig() {
  return window.SHATIBIYYA_FIREBASE_AUTH_CONFIG || null;
}

function authEndpoint(path) {
  const apiKey = getAuthConfig()?.apiKey;
  if (!apiKey) throw new Error("إعدادات الدخول غير موجودة.");
  return `https://identitytoolkit.googleapis.com/v1/${path}?key=${encodeURIComponent(apiKey)}`;
}

function refreshEndpoint() {
  const apiKey = getAuthConfig()?.apiKey;
  if (!apiKey) throw new Error("إعدادات الدخول غير موجودة.");
  return `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(apiKey)}`;
}

function readAuthSession() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

function saveAuthSession(session) {
  currentAuthSession = session;
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
}

function clearAuthSession() {
  currentAuthSession = null;
  currentUserProfile = null;
  localStorage.removeItem(AUTH_SESSION_KEY);
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

async function profileForEmail(email) {
  if (!normalizeEmail(email)) return null;
  return window.SHATIBIYYA_LOGIN_TEST_PROFILE || null;
}

function sessionFromAuthPayload(payload) {
  const expiresInMs = Number(payload.expiresIn || 3600) * 1000;
  return {
    idToken: payload.idToken,
    refreshToken: payload.refreshToken,
    email: normalizeEmail(payload.email || ""),
    localId: payload.localId,
    expiresAt: Date.now() + expiresInMs - 60000,
  };
}

async function signInWithPassword(email, password) {
  if (window.location.protocol === "file:") {
    throw new Error(`افتح صفحة الاختبار من هذا الرابط: ${TEST_REMOTE_URL}`);
  }
  const response = await fetch(authEndpoint("accounts:signInWithPassword"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(authErrorMessage(payload.error?.message));
  }
  return sessionFromAuthPayload(payload);
}

async function sendPasswordResetEmail(email) {
  if (window.location.protocol === "file:") {
    throw new Error(`افتح صفحة الاختبار من هذا الرابط: ${TEST_REMOTE_URL}`);
  }
  const response = await fetch(authEndpoint("accounts:sendOobCode"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requestType: "PASSWORD_RESET",
      email,
    }),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(authErrorMessage(payload.error?.message));
  }
  return payload;
}

async function refreshAuthSession(session) {
  const response = await fetch(refreshEndpoint(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: session.refreshToken,
    }),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(authErrorMessage(payload.error?.message));
  }
  return {
    idToken: payload.id_token,
    refreshToken: payload.refresh_token,
    email: session.email,
    localId: payload.user_id,
    expiresAt: Date.now() + Number(payload.expires_in || 3600) * 1000 - 60000,
  };
}

async function ensureFreshAuthSession() {
  if (!currentAuthSession) return null;
  if (currentAuthSession.expiresAt > Date.now()) return currentAuthSession;
  const refreshed = await refreshAuthSession(currentAuthSession);
  saveAuthSession(refreshed);
  return refreshed;
}

function authErrorMessage(code = "") {
  if (code.includes("OPERATION_NOT_ALLOWED")) {
    return "يجب تفعيل Email/Password في Firebase Authentication.";
  }
  if (code.includes("INVALID_EMAIL")) {
    return "صيغة البريد الإلكتروني غير صحيحة.";
  }
  if (code.includes("USER_DISABLED")) {
    return "هذا الحساب معطل في Firebase.";
  }
  if (code.includes("INVALID_API_KEY")) {
    return "مفتاح Firebase غير صحيح.";
  }
  if (code.includes("API_KEY_SERVICE_BLOCKED") || code.includes("REQUEST_FROM_REFERER_BLOCKED")) {
    return "يجب السماح لهذا الرابط في إعدادات مفتاح Firebase.";
  }
  if (code.includes("UNAUTHORIZED_DOMAIN")) {
    return "يجب إضافة هذا النطاق في Firebase Authentication > Settings > Authorized domains.";
  }
  if (code.includes("INVALID_LOGIN_CREDENTIALS") || code.includes("INVALID_PASSWORD")) {
    return "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
  }
  if (code.includes("EMAIL_NOT_FOUND")) {
    return "هذا البريد الإلكتروني غير موجود.";
  }
  if (code.includes("TOO_MANY_ATTEMPTS_TRY_LATER")) {
    return "محاولات كثيرة. حاول مرة أخرى لاحقا.";
  }
  return code ? `تعذر تسجيل الدخول. (${code})` : "تعذر تسجيل الدخول.";
}

function groupLabel(groupId) {
  return groupId === "group1" ? "المجموعة 1" : "المجموعة 2";
}

function applyAuthenticatedProfile(profile) {
  currentUserProfile = profile;
  currentGroupId = profile.groupId;
  localStorage.setItem(GROUP_KEY, currentGroupId);
  elements.accountName.textContent = `${profile.studentName} - ${groupLabel(profile.groupId)}`;
  elements.loginPanel.hidden = true;
  elements.studentPanel.hidden = false;
}

function showLogin(message = "الرجاء تسجيل الدخول.") {
  elements.loginResult.textContent = window.location.protocol === "file:"
    ? `افتح صفحة الاختبار من هذا الرابط: ${TEST_REMOTE_URL}`
    : message;
  elements.loginPanel.hidden = false;
  elements.studentPanel.hidden = true;
}

async function requireLogin() {
  if (!currentAuthSession) {
    showLogin();
    return false;
  }

  try {
    await ensureFreshAuthSession();
    const profile = await profileForEmail(currentAuthSession.email);
    if (!profile || profile.role !== "student") {
      clearAuthSession();
      showLogin("هذا الحساب غير مسموح له بالدخول إلى بوابة الطالب.");
      return false;
    }
    applyAuthenticatedProfile(profile);
    return true;
  } catch {
    clearAuthSession();
    showLogin("انتهت الجلسة. الرجاء تسجيل الدخول من جديد.");
    return false;
  }
}

async function localRequest(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "خطأ في الخادم المحلي.");
  }
  return payload;
}

async function loadConfig() {
  try {
    const previousWeek = elements.weekSelect.value;
    const previousValidator = elements.validatorSelect.value;
    const previousStudent = elements.studentSelect.value;
    let config = getFirebaseUrl()
      ? await firebaseRequest(groupPath("config"))
      : await localRequest("/api/config");

    if ((!config?.students?.length || !config?.weeks?.length) && getFirebaseUrl()) {
      const productionConfig = await firebaseRequest(productionGroupPath("config"));
      if (productionConfig?.students?.length && productionConfig?.weeks?.length) {
        const testStatuses = productionConfig.statuses || {};
        const testWeekId = productionConfig.weeks.at(-1)?.id;
        if (currentUserProfile?.studentName && testWeekId) {
          testStatuses[statusKey(currentUserProfile.studentName, testWeekId)] = "done";
        }
        config = {
          students: productionConfig.students,
          weeks: productionConfig.weeks,
          settings: productionConfig.settings || { weekBoundaryDay: 6 },
          statuses: testStatuses,
          readyOrder: productionConfig.readyOrder || {},
        };
        await firebaseRequest(groupPath("config"), {
          method: "PUT",
          body: JSON.stringify(config),
        });
      }
    }

    if (!config?.students?.length || !config?.weeks?.length) {
      throw new Error("الإعدادات غير موجودة.");
    }

    config = seedCurrentUserForLoginTest(config);
    currentConfig = config;
    renderWeeks(config, previousWeek);
    renderWeekState(previousValidator, previousStudent);
    elements.result.textContent = "البوابة جاهزة.";
  } catch {
    elements.result.textContent =
      "تعذر تحميل البوابة، تحقق من رابط الأستاذ.";
  }
}

function renderWeeks(config, preferredWeekId = "") {
  const selected = config.weeks.some((week) => week.id === preferredWeekId)
    ? preferredWeekId
    : config.weeks.at(-1)?.id;

  elements.weekSelect.innerHTML = "";
  config.weeks.forEach((week) => {
    const option = document.createElement("option");
    option.value = week.id;
    option.textContent = `${weekLabel(week)} - ${formatDate(week.date)}`;
    elements.weekSelect.append(option);
  });

  if (selected) {
    elements.weekSelect.value = selected;
  }
}

function renderWeekState(preferredValidator = "", preferredStudent = "") {
  if (!currentConfig) return;

  const weekId = elements.weekSelect.value;
  const greenStudents = currentConfig.students.filter((student) => isGreenStudent(currentConfig, student, weekId));
  const currentStudentName = currentUserProfile?.studentName || "";
  const validatorStudents = greenStudents.filter((student) => student === currentStudentName);
  const waitingStudents = currentConfig.students.filter((student) => (
    student !== currentStudentName && !isGreenStudent(currentConfig, student, weekId)
  ));

  renderAvailabilityList(greenStudents, weekId);
  renderValidatorSelect(validatorStudents, preferredValidator);
  renderStudentSelect(waitingStudents, preferredStudent);
  setFormEnabled(validatorStudents.length > 0 && waitingStudents.length > 0);
}

function renderAvailabilityList(greenStudents, weekId) {
  elements.validatorList.innerHTML = "";

  if (!greenStudents.length) {
    elements.validatorHint.textContent =
      "لا يوجد طالب معتمد لهذا الأسبوع. أول طالب يسمع للأستاذ ثم يعتمده الأستاذ.";
  } else {
    elements.validatorHint.textContent =
      "اتصل بطالب معتمد خارج البوابة، وبعد التسميع يؤكد هنا.";
  }

  currentConfig.students.forEach((student) => {
    const green = isGreenStudent(currentConfig, student, weekId);
    const item = document.createElement("div");
    item.className = `validator-option ${green ? "available" : "unavailable"}`;
    item.setAttribute("aria-disabled", String(!green));

    const marker = document.createElement("span");
    marker.className = "validator-marker";
    marker.textContent = green ? "معتمد" : "غير معتمد";

    const name = document.createElement("strong");
    name.textContent = student;

    item.append(marker, name);
    elements.validatorList.append(item);
  });
}

function renderValidatorSelect(greenStudents, preferredValidator = "") {
  elements.validatorSelect.innerHTML = "";
  if (!greenStudents.length) {
    elements.validatorSelect.append(emptyOption("حسابك غير معتمد لهذا الأسبوع"));
    return;
  }

  greenStudents.forEach((student) => {
    const option = document.createElement("option");
    option.value = student;
    option.textContent = student;
    elements.validatorSelect.append(option);
  });

  if (greenStudents.includes(preferredValidator)) {
    elements.validatorSelect.value = preferredValidator;
  }
}

function renderStudentSelect(waitingStudents, preferredStudent = "") {
  elements.studentSelect.innerHTML = "";
  if (!waitingStudents.length) {
    elements.studentSelect.append(emptyOption("كل الطلاب معتمدون"));
    return;
  }

  waitingStudents.forEach((student) => {
    const option = document.createElement("option");
    option.value = student;
    option.textContent = student;
    elements.studentSelect.append(option);
  });

  if (waitingStudents.includes(preferredStudent)) {
    elements.studentSelect.value = preferredStudent;
  }
}

function emptyOption(label) {
  const option = document.createElement("option");
  option.value = "";
  option.textContent = label;
  return option;
}

function setFormEnabled(enabled) {
  elements.validatorSelect.disabled = !enabled;
  elements.studentSelect.disabled = !enabled;
  elements.note.disabled = !enabled;
  elements.form.querySelector("button[type='submit']").disabled = !enabled;
}

async function applyConfirmedStatus(student, weekId, status) {
  const key = statusKey(student, weekId);

  if (getFirebaseUrl()) {
    await firebaseRequest(groupPath("config/statuses"), {
      method: "PATCH",
      body: JSON.stringify({ [key]: status }),
    });
  } else {
    await localRequest("/api/config", {
      method: "PUT",
      body: JSON.stringify({
        ...currentConfig,
        statuses: {
          ...(currentConfig.statuses || {}),
          [key]: status,
        },
      }),
    });
  }

  currentConfig.statuses = {
    ...(currentConfig.statuses || {}),
    [key]: status,
  };
}

async function submitResponse(event) {
  event.preventDefault();
  const validator = currentUserProfile?.studentName || elements.validatorSelect.value;
  const student = elements.studentSelect.value;
  const weekId = elements.weekSelect.value;

  if (!validator || !student) {
    elements.result.textContent =
      "يجب اختيار طالب معتمد وطالب للتأكيد.";
    return;
  }

  if (validator === student) {
    elements.result.textContent =
      "لا يمكن للطالب أن يؤكد نفسه.";
    return;
  }

  const payload = {
    student,
    weekId,
    status: "done",
    validator,
    validatorLabel: validator,
    validatorEmail: currentAuthSession?.email || "",
    validatorUid: currentAuthSession?.localId || "",
    note: elements.note.value.trim(),
  };

  elements.result.textContent = "جار الإرسال...";
  try {
    const createdAt = new Date().toISOString();
    const appliedStatus = confirmationStatus(weekId, createdAt);
    const late = appliedStatus === "makeup";

    if (getFirebaseUrl()) {
      await firebaseRequest(groupPath("submissions"), {
        method: "POST",
        body: JSON.stringify({
          ...payload,
          applied: true,
          appliedAt: createdAt,
          appliedStatus,
          createdAt,
          late,
        }),
      });
      await applyConfirmedStatus(student, weekId, appliedStatus);
    } else {
      await localRequest("/api/submissions", {
        method: "POST",
        body: JSON.stringify({
          ...payload,
          applied: true,
          appliedAt: createdAt,
          appliedStatus,
          createdAt,
          late,
        }),
      });
    }

    elements.note.value = "";
    elements.result.textContent =
      "تم إرسال التأكيد للأستاذ.";
    await loadConfig();
  } catch (error) {
    elements.result.textContent = error.message;
  }
}

async function handleLogin(event) {
  event.preventDefault();
  elements.loginResult.textContent = "جار تسجيل الدخول...";
  try {
    const session = await signInWithPassword(elements.loginEmail.value, elements.loginPassword.value);
    const profile = await profileForEmail(session.email);
    if (!profile || profile.role !== "student") {
      throw new Error("هذا الحساب غير مسموح له بالدخول إلى بوابة الطالب.");
    }
    saveAuthSession(session);
    elements.loginPassword.value = "";
    applyAuthenticatedProfile(profile);
    await loadConfig();
  } catch (error) {
    clearAuthSession();
    showLogin(error.message);
  }
}

function handleLogout() {
  clearAuthSession();
  showLogin("تم تسجيل الخروج.");
}

async function handlePasswordReset() {
  const email = normalizeEmail(elements.loginEmail.value);
  if (!email) {
    showLogin("اكتب البريد الإلكتروني أولا، ثم اضغط على نسيت كلمة المرور.");
    elements.loginEmail.focus();
    return;
  }

  elements.loginResult.textContent = "جار إرسال رابط تغيير كلمة المرور...";
  try {
    await sendPasswordResetEmail(email);
    showLogin("تم إرسال رابط تغيير كلمة المرور إلى البريد الإلكتروني.");
  } catch (error) {
    showLogin(error.message);
  }
}

elements.form.addEventListener("submit", submitResponse);
elements.loginForm.addEventListener("submit", handleLogin);
elements.resetPasswordBtn.addEventListener("click", handlePasswordReset);
elements.logoutBtn.addEventListener("click", handleLogout);
elements.weekSelect.addEventListener("change", () => renderWeekState());

requireLogin().then((allowed) => {
  if (allowed) loadConfig();
});

window.addEventListener("focus", () => {
  if (currentAuthSession) loadConfig();
});

setInterval(() => {
  if (currentAuthSession) loadConfig();
}, 30000);
