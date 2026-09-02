const STORAGE_KEY = "shatibiyya-tracker-v1";
const FIREBASE_URL_KEY = "shatibiyya-firebase-url";
const GROUP_KEY = "shatibiyya-active-group";
const DEFAULT_GROUP_ID = "group1";

const defaultStudents = [
  "أنيس عمار",
  "أسماء شلبي",
  "أسماء قرشان",
  "آدم الماجري",
  "حسام حفيظ",
  "حسنين عكروت",
  "زينب بالحاج صالح",
  "سمية الشيخ علي",
  "علي اليانقي",
  "مالك بن عبدالله",
  "محمد الصادق الكشباطى",
  "مصطفى أحمدي",
  "معز بن زيد",
  "ياسين بن عمار",
  "أشرف السماوي",
  "فارس المسعدي",
  "حمزة الورتاني",
];

const group2Students = [
  "إيناس غيضاوي",
  "سلسبيل القاضي",
  "أنور المناعي",
  "ياسين الماجري",
  "خديجة العفاس",
  "أشرف قرمش",
  "محمد أمين كمون",
  "محمد نزار بشير",
  "محمد البدوي",
  "محمد قطاطة",
  "أسماء مسعودي",
  "نور القاضي",
  "غيث عبد الله",
  "أحمد أمين شقرون",
  "ضياء الدين بن سليمان",
  "محمد خليل حيزاوي",
  "مسعود خرشوفي",
  "أحمد جوانب",
  "محمد الهادى الغربي",
  "أنور عزديني",
  "مصطفى الأحمدي",
  "أسامة عصمان",
  "عزیز موسی",
  "تيسير عمارة",
  "محمد الصادق الكشباطي",
];

const defaultWeeks = [
  { id: "2026-09-05-1061-1080", start: 1061, end: 1080, date: "2026-09-05" },
];

const group2Weeks = [
  { id: "2026-09-06-431-450", start: 431, end: 450, date: "2026-09-06" },
];

const defaultSettings = {
  weekBoundaryDay: 6,
};

const groupDefinitions = {
  group1: {
    label: "المجموعة 1",
    students: defaultStudents,
    weeks: defaultWeeks,
    settings: defaultSettings,
  },
  group2: {
    label: "المجموعة 2",
    students: group2Students,
    weeks: group2Weeks,
    settings: { weekBoundaryDay: 0 },
  },
};

let currentGroupId = initialGroupId();

const recoveredStatusWeekIds = [];

const recoveredMissedStatuses = {};

const recoveredMakeupStatuses = {};

const state = loadState();

const elements = {
  groupSelect: document.querySelector("#groupSelect"),
  weekSelect: document.querySelector("#weekSelect"),
  apiUrlInput: document.querySelector("#apiUrlInput"),
  saveApiUrlBtn: document.querySelector("#saveApiUrlBtn"),
  copyPortalBtn: document.querySelector("#copyPortalBtn"),
  refreshSubmissionsBtn: document.querySelector("#refreshSubmissionsBtn"),
  applySubmissionsBtn: document.querySelector("#applySubmissionsBtn"),
  markNoReplyBtn: document.querySelector("#markNoReplyBtn"),
  syncStatus: document.querySelector("#syncStatus"),
  submissionList: document.querySelector("#submissionList"),
  noReplyList: document.querySelector("#noReplyList"),
  tableScroll: document.querySelector("#tableScroll"),
  chatInput: document.querySelector("#chatInput"),
  analyzeBtn: document.querySelector("#analyzeBtn"),
  clearChatBtn: document.querySelector("#clearChatBtn"),
  analysisResult: document.querySelector("#analysisResult"),
  studentForm: document.querySelector("#studentForm"),
  studentName: document.querySelector("#studentName"),
  studentList: document.querySelector("#studentList"),
  weekBoundaryDay: document.querySelector("#weekBoundaryDay"),
  weekForm: document.querySelector("#weekForm"),
  nextWeekBtn: document.querySelector("#nextWeekBtn"),
  lineStart: document.querySelector("#lineStart"),
  lineEnd: document.querySelector("#lineEnd"),
  weekDate: document.querySelector("#weekDate"),
  trackingTable: document.querySelector("#trackingTable"),
  readingChain: document.querySelector("#readingChain"),
  reportDate: document.querySelector("#reportDate"),
  studentPortalLink: document.querySelector("#studentPortalLink"),
  exportImageBtn: document.querySelector("#exportImageBtn"),
  exportCsvBtn: document.querySelector("#exportCsvBtn"),
  shareBtn: document.querySelector("#shareBtn"),
  resetBtn: document.querySelector("#resetBtn"),
};

function initialGroupId() {
  const fromQuery = new URLSearchParams(window.location.search).get("group");
  const saved = localStorage.getItem(GROUP_KEY);
  return normalizeGroupId(fromQuery || saved || DEFAULT_GROUP_ID);
}

function normalizeGroupId(groupId) {
  return groupDefinitions[groupId] ? groupId : DEFAULT_GROUP_ID;
}

function currentGroup() {
  return groupDefinitions[currentGroupId] || groupDefinitions[DEFAULT_GROUP_ID];
}

function currentStorageKey() {
  return `${STORAGE_KEY}-${currentGroupId}`;
}

function currentDefaultStudents() {
  return [...currentGroup().students];
}

function currentDefaultWeeks() {
  return currentGroup().weeks.map((week) => ({ ...week }));
}

function currentDefaultSettings() {
  return { ...currentGroup().settings };
}

function currentDefaultStatuses() {
  return currentGroupId === DEFAULT_GROUP_ID ? buildRecoveredStatuses() : {};
}

function currentDefaultReadyOrder() {
  return currentGroupId === DEFAULT_GROUP_ID ? buildRecoveredReadyOrder() : {};
}

function makeDefaultState() {
  return {
    students: currentDefaultStudents(),
    weeks: mergeWeeks(currentDefaultWeeks()),
    settings: currentDefaultSettings(),
    statuses: currentDefaultStatuses(),
    readyOrder: currentDefaultReadyOrder(),
    submissions: [],
  };
}

function loadState() {
  const saved = localStorage.getItem(currentStorageKey());
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      return {
        students: parsed.students?.length ? parsed.students : currentDefaultStudents(),
        weeks: mergeWeeks(parsed.weeks?.length ? parsed.weeks : currentDefaultWeeks()),
        settings: normalizeSettings(parsed.settings),
        statuses: { ...currentDefaultStatuses(), ...(parsed.statuses || {}) },
        readyOrder: parsed.readyOrder || currentDefaultReadyOrder(),
        submissions: parsed.submissions || [],
      };
    } catch {
      localStorage.removeItem(currentStorageKey());
    }
  }

  return makeDefaultState();
}

function normalizeSettings(settings = {}) {
  const weekBoundaryDay = Number(settings.weekBoundaryDay);
  const defaults = currentDefaultSettings();
  return {
    weekBoundaryDay: Number.isInteger(weekBoundaryDay) && weekBoundaryDay >= 0 && weekBoundaryDay <= 6
      ? weekBoundaryDay
      : defaults.weekBoundaryDay,
  };
}

function mergeWeeks(weeks = [], baseWeeks = currentDefaultWeeks()) {
  const byId = new Map();
  [...weeks, ...baseWeeks].forEach((week) => {
    if (!week?.id) return;
    byId.set(week.id, {
      id: String(week.id),
      start: Number(week.start),
      end: Number(week.end),
      date: String(week.date),
    });
  });
  return [...byId.values()].filter((week) => week.start && week.end && week.date);
}

function saveState() {
  localStorage.setItem(currentStorageKey(), JSON.stringify(state));
  syncConfigToBackend();
}

function getFirebaseUrl() {
  const fromQuery = new URLSearchParams(window.location.search).get("db");
  const configured = localStorage.getItem(FIREBASE_URL_KEY) || window.SHATIBIYYA_FIREBASE_DB_URL || fromQuery || "";
  return configured.trim().replace(/\/+$/, "");
}

function setFirebaseUrl(url) {
  const cleaned = url.trim().replace(/\/+$/, "");
  if (cleaned) {
    localStorage.setItem(FIREBASE_URL_KEY, cleaned);
  } else {
    localStorage.removeItem(FIREBASE_URL_KEY);
  }
  updateBackendUi();
}

function firebasePath(path) {
  return `${getFirebaseUrl()}/${path}.json`;
}

function groupPath(path) {
  if (currentGroupId === DEFAULT_GROUP_ID) return path;
  if (path === "config") return `config/groups/${currentGroupId}`;
  if (path.startsWith("config/")) return `config/groups/${currentGroupId}/${path.slice("config/".length)}`;
  if (path === "submissions") return `submissions/groups/${currentGroupId}`;
  if (path.startsWith("submissions/")) return `submissions/groups/${currentGroupId}/${path.slice("submissions/".length)}`;
  return path;
}

async function firebaseRequest(path, options = {}) {
  if (!getFirebaseUrl()) {
    throw new Error("لم يتم ضبط رابط Firebase.");
  }
  const response = await fetch(firebasePath(path), {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!response.ok) {
    throw new Error("لم يقبل Firebase الطلب.");
  }
  return response.json();
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

async function loadConfigFromBackend() {
  try {
    let config;
    if (getFirebaseUrl()) {
      config = await firebaseRequest(groupPath("config"));
    } else {
      config = await localRequest("/api/config");
    }
    if (config?.students?.length && config?.weeks?.length) {
      state.students = config.students;
      state.weeks = mergeWeeks(config.weeks);
      state.settings = normalizeSettings(config.settings);
      state.statuses = { ...currentDefaultStatuses(), ...(config.statuses || {}) };
      state.readyOrder = { ...currentDefaultReadyOrder(), ...(config.readyOrder || {}) };
      localStorage.setItem(currentStorageKey(), JSON.stringify(state));
      render();
    } else if (getFirebaseUrl()) {
      await syncConfigNow();
    }
    updateBackendUi("تم تحميل الإعدادات.");
  } catch (error) {
    updateBackendUi(getFirebaseUrl() ? error.message : "وضع محلي بدون خادم بيانات.");
  }
}

let syncTimer;
function syncConfigToBackend() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(syncConfigNow, 350);
}

async function syncConfigNow() {
  try {
    const config = {
      students: state.students,
      weeks: state.weeks,
      settings: state.settings,
      statuses: state.statuses,
      readyOrder: state.readyOrder,
    };
    if (getFirebaseUrl()) {
      await firebaseRequest(groupPath("config"), {
        method: currentGroupId === DEFAULT_GROUP_ID ? "PATCH" : "PUT",
        body: JSON.stringify(config),
      });
    } else {
      await localRequest("/api/config", {
        method: "PUT",
        body: JSON.stringify(config),
      });
    }
    updateBackendUi("تم حفظ الطلاب والأسابيع.");
  } catch {
    updateBackendUi(getFirebaseUrl() ? "تعذرت المزامنة مع Firebase." : "وضع محلي.");
  }
}

async function loadSubmissions() {
  const weekId = elements.weekSelect.value;
  try {
    if (getFirebaseUrl()) {
      const all = (await firebaseRequest(groupPath("submissions"))) || {};
      state.submissions = Object.entries(all)
        .map(([id, submission]) => ({ id, ...submission }))
        .filter((submission) => submission.weekId === weekId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else {
      const payload = await localRequest(`/api/submissions?weekId=${encodeURIComponent(weekId)}`);
      state.submissions = payload.submissions;
    }
    localStorage.setItem(currentStorageKey(), JSON.stringify(state));
    renderSubmissions();
    updateBackendUi(`تم استرجاع ${state.submissions.length} إجابة.`);
  } catch (error) {
    updateBackendUi(error.message);
  }
}

async function markSubmissionApplied(submissionId, metadata = {}) {
  if (getFirebaseUrl()) {
    await firebaseRequest(groupPath(`submissions/${submissionId}`), {
      method: "PATCH",
      body: JSON.stringify({
        applied: true,
        appliedAt: new Date().toISOString(),
        ...metadata,
      }),
    });
  } else {
    await localRequest(`/api/submissions/${submissionId}/apply`, {
      method: "PATCH",
      body: JSON.stringify(metadata),
    });
  }
}

function updateBackendUi(message = "") {
  if (elements.groupSelect) {
    elements.groupSelect.value = currentGroupId;
  }
  if (elements.apiUrlInput) {
    elements.apiUrlInput.value = getFirebaseUrl();
  }
  const source = getFirebaseUrl()
    ? `المصدر: Firebase. ${currentGroup().label}.`
    : "المصدر: المتصفح المحلي. أضف رابط Firebase.";
  if (elements.syncStatus) {
    elements.syncStatus.textContent = message ? `${source} ${message}` : source;
  }
  if (elements.studentPortalLink) {
    elements.studentPortalLink.href = buildStudentPortalUrl();
  }
}

function buildStudentPortalUrl() {
  const url = new URL("student.html", window.location.href);
  url.searchParams.set("group", currentGroupId);
  if (getFirebaseUrl()) {
    url.searchParams.set("db", getFirebaseUrl());
  }
  return url.toString();
}

function switchGroup(groupId) {
  currentGroupId = normalizeGroupId(groupId);
  localStorage.setItem(GROUP_KEY, currentGroupId);
  Object.assign(state, loadState());
  render();
  loadConfigFromBackend();
  loadSubmissions();
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

function buildRecoveredStatuses() {
  const statuses = {};
  defaultStudents.forEach((student) => {
    recoveredStatusWeekIds.forEach((weekId) => {
      let status = "done";
      if ((recoveredMissedStatuses[student] || []).includes(weekId)) {
        status = "missed";
      }
      if ((recoveredMakeupStatuses[student] || []).includes(weekId)) {
        status = "makeup";
      }
      statuses[statusKey(student, weekId)] = status;
    });
  });
  return statuses;
}

function buildRecoveredReadyOrder() {
  const statuses = buildRecoveredStatuses();
  return recoveredStatusWeekIds.reduce((orders, weekId) => {
    orders[weekId] = defaultStudents.filter((student) => {
      const status = statuses[statusKey(student, weekId)];
      return status === "done" || status === "makeup";
    });
    return orders;
  }, {});
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

function addDays(dateString, days) {
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function endOfDay(dateString) {
  return new Date(`${dateString}T23:59:59.999`);
}

function nextWeekLineStep() {
  const lastWeek = state.weeks.at(-1);
  const previousWeek = state.weeks.at(-2);
  if (lastWeek && previousWeek) {
    return Math.max(1, lastWeek.start - previousWeek.start);
  }
  return 10;
}

function findWeek(weekId) {
  return state.weeks.find((week) => week.id === weekId);
}

function weekDeadline(week) {
  if (!week?.date) return null;
  const deadline = endOfDay(week.date);
  const boundaryDay = state.settings.weekBoundaryDay;
  let dayOffset = (boundaryDay - deadline.getDay() + 7) % 7;
  if (dayOffset === 0) dayOffset = 7;
  deadline.setDate(deadline.getDate() + dayOffset);
  return deadline;
}

function isLateSubmission(submission) {
  const week = findWeek(submission.weekId);
  const deadline = weekDeadline(week);
  if (!deadline || !submission.createdAt) return false;
  return new Date(submission.createdAt) > deadline;
}

function effectiveSubmissionStatus(submission) {
  if (submission.status === "done" && isLateSubmission(submission)) {
    return "makeup";
  }
  return submission.status;
}

function statusKey(studentName, weekId) {
  return `${studentId(studentName)}__${weekId}`;
}

function getStatus(studentName, weekId) {
  return state.statuses[statusKey(studentName, weekId)] || "";
}

function setStatus(studentName, weekId, status) {
  const key = statusKey(studentName, weekId);
  if (status) {
    state.statuses[key] = status;
  } else {
    delete state.statuses[key];
  }
}

function cycleStatus(studentName, weekId) {
  const order = ["", "done", "makeup", "missed"];
  const current = getStatus(studentName, weekId);
  const next = order[(order.indexOf(current) + 1) % order.length];
  setStatus(studentName, weekId, next);
  saveState();
  render();
}

function statusMark(status) {
  if (status === "missed") return "لا";
  if (status === "done" || status === "makeup") return "x";
  return "";
}

function statusLabel(status) {
  if (status === "done") return "تم";
  if (status === "makeup") return "استدراك";
  if (status === "missed") return "لم يتم";
  return "فارغ";
}

function studentCompletion(studentName) {
  const filledWeeks = state.weeks.filter((week) => {
    const status = getStatus(studentName, week.id);
    return status === "done" || status === "makeup";
  }).length;
  return state.weeks.length ? Math.round((filledWeeks / state.weeks.length) * 100) : 0;
}

function studentMissing(studentName) {
  const missedWeeks = state.weeks.filter((week) => getStatus(studentName, week.id) === "missed").length;
  return state.weeks.length ? Math.round((missedWeeks / state.weeks.length) * 100) : 0;
}

function weekCompletion(weekId) {
  const done = state.students.filter((student) => {
    const status = getStatus(student, weekId);
    return status === "done" || status === "makeup";
  }).length;
  return state.students.length ? Math.round((done / state.students.length) * 100) : 0;
}

function renderWeekSelect(selectedWeekId) {
  const selected = selectedWeekId || elements.weekSelect.value || state.weeks.at(-1)?.id;
  elements.weekSelect.innerHTML = "";

  state.weeks.forEach((week) => {
    const option = document.createElement("option");
    option.value = week.id;
    option.textContent = `${weekLabel(week)} - ${formatDate(week.date)}`;
    elements.weekSelect.append(option);
  });

  if (state.weeks.some((week) => week.id === selected)) {
    elements.weekSelect.value = selected;
  } else if (state.weeks.length) {
    elements.weekSelect.value = state.weeks.at(-1).id;
  }
}

function renderTable() {
  const table = elements.trackingTable;
  table.innerHTML = "";
  const selectedWeekId = elements.weekSelect.value;
  table.style.setProperty("--week-count", state.weeks.length);

  const percentRow = document.createElement("tr");
  percentRow.className = "week-percent-row";
  percentRow.append(emptyCell("th", "", "sticky-col index-col"));
  percentRow.append(emptyCell("th", "", "sticky-col name-col"));
  percentRow.append(emptyCell("th", "", "sticky-col completion-col"));
  percentRow.append(emptyCell("th", ""));
  state.weeks.forEach((week) => {
    const cell = emptyCell("td", `${weekCompletion(week.id)}%`);
    cell.className = `week-col${week.id === selectedWeekId ? " selected-week" : ""}`;
    cell.dataset.weekId = week.id;
    percentRow.append(cell);
  });
  table.append(percentRow);

  const header = document.createElement("tr");
  header.className = "table-header-row";
  header.append(headerCell("الرقم", "sticky-col index-col"));
  header.append(headerCell("الاسم", "sticky-col name-col"));
  header.append(headerCell("نسبة التسميع", "sticky-col completion-col"));
  header.append(headerCell("نسبة عدم التسميع", "percent-col"));
  state.weeks.forEach((week) => {
    const cell = headerCell(`${weekLabel(week)}\n${formatDate(week.date)}`, "week-col");
    if (week.id === selectedWeekId) {
      cell.classList.add("selected-week");
    }
    cell.dataset.weekId = week.id;
    header.append(cell);
  });
  table.append(header);

  state.students.forEach((student, index) => {
    const row = document.createElement("tr");
    row.append(emptyCell("td", String(index + 1), "sticky-col index-col"));
    row.append(emptyCell("td", student, "sticky-col name-col"));
    row.append(emptyCell("td", `${studentCompletion(student)}%`, "sticky-col completion-col"));
    row.append(emptyCell("td", `${studentMissing(student)}%`, "percent-col"));

    state.weeks.forEach((week) => {
      const status = getStatus(student, week.id);
      const cell = emptyCell("td", "", `week-col status-${status || "empty"}`);
      if (week.id === selectedWeekId) {
        cell.classList.add("selected-week");
      }
      cell.dataset.weekId = week.id;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "cell-button";
      button.textContent = statusMark(status);
      button.title = `${student} - ${weekLabel(week)} : ${statusLabel(status)}`;
      button.addEventListener("click", () => cycleStatus(student, week.id));
      cell.append(button);
      row.append(cell);
    });

    table.append(row);
  });

  const totalRow = document.createElement("tr");
  totalRow.append(emptyCell("td", "", "sticky-col index-col"));
  totalRow.append(emptyCell("td", "المجموعة", "sticky-col name-col"));
  totalRow.append(emptyCell("td", `${averageCompletion()}%`, "sticky-col completion-col"));
  totalRow.append(emptyCell("td", `${averageMissing()}%`, "percent-col"));
  state.weeks.forEach(() => totalRow.append(emptyCell("td", "", "week-col")));
  table.append(totalRow);
}

function scrollToSelectedWeek() {
  if (!elements.tableScroll || !elements.weekSelect.value) return;
  const selectedCell = elements.trackingTable.querySelector(
    `[data-week-id="${elements.weekSelect.value}"]`
  );
  if (!selectedCell) return;
  requestAnimationFrame(() => {
    selectedCell.scrollIntoView({ block: "nearest", inline: "nearest" });
  });
}

function renderStudentList() {
  elements.studentList.innerHTML = "";
  state.students.forEach((student) => {
    const chip = document.createElement("span");
    chip.className = "student-chip";

    const name = document.createElement("span");
    name.textContent = student;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "×";
    remove.title = `حذف ${student}`;
    remove.addEventListener("click", () => removeStudent(student));

    chip.append(name, remove);
    elements.studentList.append(chip);
  });
}

function renderSettings() {
  if (elements.weekBoundaryDay) {
    elements.weekBoundaryDay.value = String(state.settings.weekBoundaryDay);
  }
}

function emptyCell(tag, text, className = "") {
  const cell = document.createElement(tag);
  if (className) cell.className = className;
  cell.textContent = text;
  return cell;
}

function headerCell(text, className = "") {
  const cell = emptyCell("th", text, className);
  cell.style.whiteSpace = "pre-line";
  return cell;
}

function averageCompletion() {
  if (!state.students.length) return 0;
  const total = state.students.reduce((sum, student) => sum + studentCompletion(student), 0);
  return Math.round(total / state.students.length);
}

function averageMissing() {
  if (!state.students.length) return 0;
  const total = state.students.reduce((sum, student) => sum + studentMissing(student), 0);
  return Math.round(total / state.students.length);
}

function renderChain() {
  const selectedWeek = elements.weekSelect.value;
  const statusReadyStudents = state.students.filter((student) => {
    const status = getStatus(student, selectedWeek);
    return status === "done" || status === "makeup";
  });
  const savedOrder = state.readyOrder[selectedWeek] || [];
  const order = [
    ...savedOrder.filter((student) => statusReadyStudents.includes(student)),
    ...statusReadyStudents.filter((student) => !savedOrder.includes(student)),
  ];

  elements.readingChain.innerHTML = "";
  if (!order.length) {
    const item = document.createElement("li");
    item.textContent = "لا يوجد طالب جاهز لهذا الأسبوع.";
    elements.readingChain.append(item);
    return;
  }

  order.forEach((student, index) => {
    const item = document.createElement("li");
    const reader = document.createElement("strong");
    reader.textContent = student;
    const target = document.createElement("span");
    target.textContent = index === 0
      ? " يسمع للأستاذ"
      : ` يسمع لـ ${order[index - 1]}`;
    item.append(reader, target);
    elements.readingChain.append(item);
  });
}

function renderSubmissions() {
  if (!elements.submissionList) return;
  elements.submissionList.innerHTML = "";

  const weekId = elements.weekSelect.value;
  const submissions = state.submissions.filter((submission) => submission.weekId === weekId);
  if (!submissions.length) {
    const empty = document.createElement("div");
    empty.className = "submission-item";
    empty.textContent = "لا توجد إجابات لهذا الأسبوع.";
    elements.submissionList.append(empty);
    renderNoReplyList();
    return;
  }

  submissions.forEach((submission) => {
    const item = document.createElement("article");
    item.className = `submission-item${submission.applied ? " applied" : ""}`;

    const name = document.createElement("strong");
    name.textContent = submission.student;

    const meta = document.createElement("div");
    meta.className = "submission-meta";
    const createdAt = submission.createdAt
      ? new Intl.DateTimeFormat("ar", { dateStyle: "short", timeStyle: "short" }).format(new Date(submission.createdAt))
      : "تاريخ غير معروف";
    const late = isLateSubmission(submission);
    meta.textContent = [
      createdAt,
      late ? "متأخر" : "",
      submission.applied ? "تم تطبيقها" : "",
    ].filter(Boolean).join(" - ");

    const pill = document.createElement("span");
    const appliedStatus = effectiveSubmissionStatus(submission);
    pill.className = `status-pill status-${appliedStatus}`;
    pill.textContent = late && submission.status === "done"
      ? "متأخر"
      : statusLabel(appliedStatus);

    item.append(name, pill, meta);
    if (submission.validatorLabel || submission.validator) {
      const validator = document.createElement("p");
      validator.className = "submission-meta";
      validator.textContent = `أكّده: ${submission.validatorLabel || submission.validator}`;
      item.append(validator);
    }
    if (submission.note) {
      const note = document.createElement("p");
      note.className = "submission-meta";
      note.textContent = submission.note;
      item.append(note);
    }
    elements.submissionList.append(item);
  });

  renderNoReplyList();
}

function studentsWithoutReply() {
  const weekId = elements.weekSelect.value;
  const submitted = new Set(
    state.submissions
      .filter((submission) => submission.weekId === weekId)
      .map((submission) => submission.student)
  );
  return state.students.filter((student) => !submitted.has(student) && !getStatus(student, weekId));
}

function renderNoReplyList() {
  if (!elements.noReplyList) return;
  const missing = studentsWithoutReply();
  if (!missing.length) {
    elements.noReplyList.classList.remove("visible");
    elements.noReplyList.textContent = "";
    return;
  }

  elements.noReplyList.classList.add("visible");
  elements.noReplyList.innerHTML = `<strong>بدون إجابة:</strong> ${missing.join("، ")}`;
}

function renderReportDate() {
  const today = new Intl.DateTimeFormat("ar", {
    dateStyle: "full",
  }).format(new Date());
  elements.reportDate.textContent = today;
}

function render(selectedWeekId) {
  sortWeeks();
  renderWeekSelect(selectedWeekId);
  renderSettings();
  renderStudentList();
  renderTable();
  renderChain();
  renderSubmissions();
  renderReportDate();
  updateBackendUi();
  scrollToSelectedWeek();
}

function sortWeeks() {
  state.weeks.sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
}

function parseWhatsAppMessages(raw) {
  const messages = [];
  const lines = raw.split(/\r?\n/);
  let current = null;

  lines.forEach((line) => {
    const parsed = parseMessageLine(line);
    if (parsed) {
      current = parsed;
      messages.push(current);
    } else if (current && line.trim()) {
      current.text += ` ${line.trim()}`;
    }
  });

  return messages;
}

function parseMessageLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const patterns = [
    /^\[?(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}),?\s*([^\]]*?)\]?\s+-\s+([^:：]+)[:：]\s*(.+)$/u,
    /^\[?(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}),?\s*([^\]]*?)\]?\s+([^:：]+)[:：]\s*(.+)$/u,
    /^([^:：]{2,60})[:：]\s*(.+)$/u,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (!match) continue;
    if (match.length === 5) {
      return {
        sender: match[3].trim(),
        text: match[4].trim(),
      };
    }
    return {
      sender: match[1].trim(),
      text: match[2].trim(),
    };
  }

  return null;
}

function detectStatus(text) {
  const normalized = normalizeArabic(text);
  const compact = ` ${normalized} `;

  const makeupWords = [
    "استدراك",
    "استدرك",
    "تدارك",
    "تعويض",
    "قضاء",
    "rattrapage",
    "ratrapage",
    "retard",
    "makeup",
  ];
  const missedWords = [
    "لم اسمع",
    "لم يسمع",
    "لم يتم",
    "لم احفظ",
    "ما سمعت",
    "غير جاهز",
    "غائب",
    "لا",
    "absent",
    "non fait",
  ];
  const doneWords = [
    "تم",
    "سمعت",
    "سمع",
    "قرات",
    "قرا",
    "حفظت",
    "حفظ",
    "انتهيت",
    "x",
    "ok",
    "done",
    "fait",
  ];

  if (makeupWords.some((word) => compact.includes(` ${normalizeArabic(word)} `))) return "makeup";
  if (missedWords.some((word) => compact.includes(` ${normalizeArabic(word)} `))) return "missed";
  if (doneWords.some((word) => compact.includes(` ${normalizeArabic(word)} `))) return "done";
  if (/[✅✔☑]/u.test(text)) return "done";
  if (/[❌]/u.test(text)) return "missed";
  return "";
}

function findStudentByName(name) {
  const normalized = normalizeArabic(name);
  return state.students.find((student) => normalizeArabic(student) === normalized);
}

function findMentionedStudents(text) {
  const normalizedText = ` ${normalizeArabic(text)} `;
  return state.students.filter((student) => {
    const normalizedStudent = normalizeArabic(student);
    return normalizedStudent && normalizedText.includes(` ${normalizedStudent} `);
  });
}

function applyChatAnalysis() {
  const weekId = elements.weekSelect.value;
  const raw = elements.chatInput.value.trim();

  if (!weekId || !raw) {
    elements.analysisResult.textContent = "اختر أسبوعًا والصق بعض الرسائل.";
    return;
  }

  const messages = parseWhatsAppMessages(raw);
  const updates = [];
  const readyOrder = [];

  messages.forEach((message) => {
    const status = detectStatus(message.text);
    if (!status) return;

    const targets = new Set();
    const senderStudent = findStudentByName(message.sender);
    if (senderStudent) targets.add(senderStudent);

    findMentionedStudents(message.text).forEach((student) => targets.add(student));

    targets.forEach((student) => {
      setStatus(student, weekId, status);
      updates.push({ student, status });
      if ((status === "done" || status === "makeup") && !readyOrder.includes(student)) {
        readyOrder.push(student);
      }
    });
  });

  if (readyOrder.length) {
    state.readyOrder[weekId] = readyOrder;
  }

  saveState();
  render();

  if (!updates.length) {
    elements.analysisResult.textContent =
      `تمت قراءة ${messages.length} رسالة، لكن لم يتم التعرف على حالة.`;
    return;
  }

  const summary = updates.reduce((acc, update) => {
    acc[update.status] = (acc[update.status] || 0) + 1;
    return acc;
  }, {});

  elements.analysisResult.innerHTML = [
    `تمت قراءة ${messages.length} رسالة.`,
    `تم تطبيق ${updates.length} تحديث.`,
    `تم: ${summary.done || 0}، استدراك: ${summary.makeup || 0}، لم يتم: ${summary.missed || 0}.`,
  ].join("<br>");
}

async function applySubmissions() {
  const weekId = elements.weekSelect.value;
  await loadSubmissions();

  const applicable = state.submissions.filter((submission) => {
    if (submission.weekId !== weekId || !state.students.includes(submission.student)) return false;
    return !submission.applied || getStatus(submission.student, weekId) !== effectiveSubmissionStatus(submission);
  });
  const readyOrder = state.readyOrder[weekId] || [];

  for (const submission of applicable) {
    const late = isLateSubmission(submission);
    const appliedStatus = effectiveSubmissionStatus(submission);
    setStatus(submission.student, weekId, appliedStatus);
    if (
      (appliedStatus === "done" || appliedStatus === "makeup") &&
      !readyOrder.includes(submission.student)
    ) {
      readyOrder.push(submission.student);
    }
    submission.applied = true;
    submission.late = late;
    submission.appliedStatus = appliedStatus;
    try {
      await markSubmissionApplied(submission.id, { late, appliedStatus });
    } catch {
      submission.applied = false;
    }
  }

  const missing = studentsWithoutReply();
  missing.forEach((student) => setStatus(student, weekId, "missed"));

  state.readyOrder[weekId] = readyOrder;
  saveState();
  await syncConfigNow();
  render();
  updateBackendUi(
    `تم تطبيق ${applicable.length} إجابة. بدون إجابة: ${missing.length}.`
  );
}

function markNoReplyAsMissed() {
  const weekId = elements.weekSelect.value;
  const missing = studentsWithoutReply();
  if (!missing.length) {
    updateBackendUi("لا يوجد طالب بدون إجابة.");
    return;
  }

  const confirmed = window.confirm(
    `هل تريد تحديد ${missing.length} طالب بدون إجابة باللون الأحمر؟`
  );
  if (!confirmed) return;

  missing.forEach((student) => setStatus(student, weekId, "missed"));
  saveState();
  render();
  updateBackendUi(`تم تحديد ${missing.length} طالب بدون إجابة.`);
}

function updateWeekSettings() {
  state.settings = normalizeSettings({
    ...state.settings,
    weekBoundaryDay: elements.weekBoundaryDay.value,
  });
  saveState();
  render();
  updateBackendUi("تم حفظ إعداد الأسبوع.");
}

function addStudent(event) {
  event.preventDefault();
  const name = elements.studentName.value.trim();
  if (!name) return;
  if (state.students.some((student) => normalizeArabic(student) === normalizeArabic(name))) {
    elements.studentName.value = "";
    return;
  }
  state.students.push(name);
  elements.studentName.value = "";
  saveState();
  render();
}

function removeStudent(studentName) {
  const confirmed = window.confirm(`هل تريد حذف ${studentName} من الجدول؟`);
  if (!confirmed) return;

  state.students = state.students.filter((student) => student !== studentName);
  Object.keys(state.statuses).forEach((key) => {
    if (key.startsWith(`${studentId(studentName)}__`)) {
      delete state.statuses[key];
    }
  });
  Object.keys(state.readyOrder).forEach((weekId) => {
    state.readyOrder[weekId] = state.readyOrder[weekId].filter((student) => student !== studentName);
  });

  saveState();
  render();
}

function addWeek(event) {
  event.preventDefault();
  const start = Number(elements.lineStart.value);
  const end = Number(elements.lineEnd.value);
  const date = elements.weekDate.value;

  if (!start || !end || !date || end < start) return;

  const id = `${date}-${start}-${end}`;
  if (!state.weeks.some((week) => week.id === id)) {
    state.weeks.push({ id, start, end, date });
  }

  elements.lineStart.value = "";
  elements.lineEnd.value = "";
  elements.weekDate.value = "";
  saveState();
  render(id);
  loadSubmissions();
}

function createNextWeek() {
  const lastWeek = state.weeks.at(-1);
  if (!lastWeek) return;

  const step = nextWeekLineStep();
  const start = lastWeek.start + step;
  const end = lastWeek.end + step;
  const date = addDays(lastWeek.date, 7);
  const id = `${date}-${start}-${end}`;

  if (!state.weeks.some((week) => week.id === id)) {
    state.weeks.push({ id, start, end, date });
    saveState();
  }

  elements.lineStart.value = "";
  elements.lineEnd.value = "";
  elements.weekDate.value = "";
  render(id);
  loadSubmissions();
  updateBackendUi(`تم إنشاء الأسبوع التالي: ${weekLabel({ start, end })} - ${formatDate(date)}.`);
}

function exportCsv() {
  const rows = [];
  rows.push(["الرقم", "الاسم", "نسبة التسميع", "نسبة عدم التسميع", ...state.weeks.map(weekLabel)]);
  state.students.forEach((student, index) => {
    rows.push([
      index + 1,
      student,
      `${studentCompletion(student)}%`,
      `${studentMissing(student)}%`,
      ...state.weeks.map((week) => statusLabel(getStatus(student, week.id))),
    ]);
  });
  downloadText(`suivi-shatibiyya-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows), "text/csv;charset=utf-8");
}

function toCsv(rows) {
  return rows
    .map((row) =>
      row
        .map((value) => `"${value.toString().replaceAll('"', '""')}"`)
        .join(",")
    )
    .join("\n");
}

function downloadText(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function exportImage(share = false) {
  const canvas = renderReportCanvas();

  const imageBlob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png", 0.95));
  if (!imageBlob) {
    throw new Error("تعذر إنشاء صورة الجدول.");
  }
  const filename = `suivi-shatibiyya-${new Date().toISOString().slice(0, 10)}.png`;

  if (share && navigator.canShare) {
    const file = new File([imageBlob], filename, { type: "image/png" });
    if (navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: "متابعة الشاطبية",
        text: "الجدول الأسبوعي للمجموعة.",
      });
      return;
    }
  }

  const downloadUrl = URL.createObjectURL(imageBlob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(downloadUrl);

  if (share) {
    window.open("https://web.whatsapp.com/", "_blank", "noopener,noreferrer");
  }
}

function renderReportCanvas() {
  const columns = [
    { type: "index", width: 42, label: "الرقم" },
    { type: "name", width: 150, label: "الاسم" },
    { type: "completion", width: 98, label: "نسبة التسميع" },
    { type: "missing", width: 112, label: "نسبة عدم التسميع" },
    ...state.weeks.map((week) => ({
      type: "week",
      width: 98,
      label: weekLabel(week),
      date: formatDate(week.date),
      week,
    })),
  ];
  const titleHeight = 54;
  const percentHeight = 28;
  const headerHeight = 42;
  const rowHeight = 28;
  const totalWidth = columns.reduce((sum, column) => sum + column.width, 0);
  const totalHeight = titleHeight + percentHeight + headerHeight + rowHeight * (state.students.length + 1);
  const scale = Math.min(2, window.devicePixelRatio || 1);
  const canvas = document.createElement("canvas");
  canvas.width = totalWidth * scale;
  canvas.height = totalHeight * scale;
  canvas.style.width = `${totalWidth}px`;
  canvas.style.height = `${totalHeight}px`;

  const context = canvas.getContext("2d");
  context.scale(scale, scale);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, totalWidth, totalHeight);

  drawTitle(context, totalWidth, titleHeight);

  const positionedColumns = positionColumns(columns, totalWidth);
  let y = titleHeight;
  drawPercentRow(context, positionedColumns, y, percentHeight);
  y += percentHeight;
  drawHeaderRow(context, positionedColumns, y, headerHeight);
  y += headerHeight;

  state.students.forEach((student, index) => {
    drawStudentRow(context, positionedColumns, student, index, y, rowHeight);
    y += rowHeight;
  });

  drawTotalRow(context, positionedColumns, y, rowHeight);
  return canvas;
}

function positionColumns(columns, totalWidth) {
  let x = totalWidth;
  return columns.map((column) => {
    x -= column.width;
    return { ...column, x };
  });
}

function drawTitle(context, width, height) {
  context.fillStyle = "#f2f5fb";
  context.fillRect(0, 0, width, height);
  context.strokeStyle = "#3d4656";
  context.strokeRect(0, 0, width, height);

  context.direction = "rtl";
  context.textAlign = "right";
  context.textBaseline = "middle";
  context.fillStyle = "#111a2a";
  context.font = "bold 20px Arial, sans-serif";
  context.fillText("متابعة حفظ الشاطبية", width - 14, 20);

  context.fillStyle = "#596b86";
  context.font = "13px Arial, sans-serif";
  context.fillText("10 أبيات أسبوعيًا", width - 14, 40);

  context.direction = "rtl";
  context.textAlign = "left";
  context.fillText(new Intl.DateTimeFormat("ar", { dateStyle: "full" }).format(new Date()), 14, 40);
}

function drawPercentRow(context, columns, y, height) {
  columns.forEach((column) => {
    const text = column.type === "week" ? `${weekCompletion(column.week.id)}%` : "";
    drawCell(context, column.x, y, column.width, height, text, "#ffffff", {
      font: "bold 13px Arial, sans-serif",
    });
  });
}

function drawHeaderRow(context, columns, y, height) {
  columns.forEach((column) => {
    const lines = column.type === "week" ? [column.label, column.date] : [column.label];
    drawCell(context, column.x, y, column.width, height, lines, "#bfd0eb", {
      font: "bold 13px Arial, sans-serif",
    });
  });
}

function drawStudentRow(context, columns, student, index, y, height) {
  columns.forEach((column) => {
    if (column.type === "index") {
      drawCell(context, column.x, y, column.width, height, String(index + 1), "#ffffff");
    } else if (column.type === "name") {
      drawCell(context, column.x, y, column.width, height, student, "#ffffff", {
        align: "right",
        direction: "rtl",
        padding: 8,
      });
    } else if (column.type === "completion") {
      drawCell(context, column.x, y, column.width, height, `${studentCompletion(student)}%`, "#ffffff");
    } else if (column.type === "missing") {
      drawCell(context, column.x, y, column.width, height, `${studentMissing(student)}%`, "#ffffff");
    } else if (column.type === "week") {
      const status = getStatus(student, column.week.id);
      drawCell(context, column.x, y, column.width, height, statusMark(status), statusColor(status), {
        font: "bold 13px Arial, sans-serif",
      });
    }
  });
}

function drawTotalRow(context, columns, y, height) {
  columns.forEach((column) => {
    if (column.type === "name") {
      drawCell(context, column.x, y, column.width, height, "المجموعة", "#bfd0eb", {
        align: "right",
        direction: "rtl",
        font: "bold 13px Arial, sans-serif",
        padding: 8,
      });
    } else if (column.type === "completion") {
      drawCell(context, column.x, y, column.width, height, `${averageCompletion()}%`, "#ffffff");
    } else if (column.type === "missing") {
      drawCell(context, column.x, y, column.width, height, `${averageMissing()}%`, "#ffffff");
    } else {
      drawCell(context, column.x, y, column.width, height, "", "#ffffff");
    }
  });
}

function statusColor(status) {
  if (status === "done") return "#8bd34a";
  if (status === "makeup") return "#ffc20a";
  if (status === "missed") return "#f6bac3";
  return "#ffffff";
}

function drawCell(context, x, y, width, height, text, fill, options = {}) {
  context.fillStyle = fill;
  context.fillRect(x, y, width, height);
  context.strokeStyle = "#3d4656";
  context.lineWidth = 1;
  context.strokeRect(x, y, width, height);

  const lines = Array.isArray(text) ? text : [text];
  context.fillStyle = "#111a2a";
  context.font = options.font || "13px Arial, sans-serif";
  context.direction = options.direction || "rtl";
  context.textAlign = options.align || "center";
  context.textBaseline = "middle";

  const padding = options.padding || 0;
  const textX = options.align === "right" ? x + width - padding : x + width / 2;
  const startY = y + height / 2 - ((lines.length - 1) * 8);
  lines.forEach((line, index) => {
    context.fillText(line, textX, startY + index * 16, width - padding * 2);
  });
}

function resetApp() {
  const confirmed = window.confirm(`هل تريد إعادة ضبط بيانات ${currentGroup().label}؟`);
  if (!confirmed) return;
  localStorage.removeItem(currentStorageKey());
  Object.assign(state, makeDefaultState());
  saveState();
  render();
}

function saveBackendUrl() {
  setFirebaseUrl(elements.apiUrlInput.value);
  syncConfigToBackend();
  loadSubmissions();
}

async function copyStudentPortalLink() {
  const link = buildStudentPortalUrl();
  try {
    await navigator.clipboard.writeText(link);
    updateBackendUi("تم نسخ رابط الطالب.");
  } catch {
    updateBackendUi(`رابط الطالب: ${link}`);
  }
}

elements.analyzeBtn.addEventListener("click", applyChatAnalysis);
elements.clearChatBtn.addEventListener("click", () => {
  elements.chatInput.value = "";
  elements.analysisResult.textContent = "تم مسح الرسائل.";
});
elements.groupSelect?.addEventListener("change", () => switchGroup(elements.groupSelect.value));
elements.saveApiUrlBtn.addEventListener("click", saveBackendUrl);
elements.copyPortalBtn.addEventListener("click", copyStudentPortalLink);
elements.refreshSubmissionsBtn.addEventListener("click", loadSubmissions);
elements.applySubmissionsBtn.addEventListener("click", applySubmissions);
elements.markNoReplyBtn.addEventListener("click", markNoReplyAsMissed);
elements.studentForm.addEventListener("submit", addStudent);
elements.weekBoundaryDay?.addEventListener("change", updateWeekSettings);
elements.weekForm.addEventListener("submit", addWeek);
elements.nextWeekBtn.addEventListener("click", createNextWeek);
elements.weekSelect.addEventListener("change", () => {
  renderChain();
  loadSubmissions();
  renderTable();
  scrollToSelectedWeek();
});
elements.exportImageBtn.addEventListener("click", () => exportImage(false));
elements.exportCsvBtn.addEventListener("click", exportCsv);
elements.shareBtn.addEventListener("click", () => exportImage(true));
elements.resetBtn.addEventListener("click", resetApp);

render();
loadConfigFromBackend();
loadSubmissions();
