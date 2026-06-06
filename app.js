const STORAGE_KEY = "shatibiyya-tracker-v1";
const FIREBASE_URL_KEY = "shatibiyya-firebase-url";

const defaultStudents = [
  "أنيس عمار",
  "أسماء شلبي",
  "أسماء قرشاش",
  "آدم الماجري",
  "حسام حميط",
  "حسنين عكروت",
  "زينب بالحاج صالح",
  "آمنة الله علي",
  "علي البلتي",
  "مالك بن عبدالله",
  "محمد الصادق الكشباط",
  "مصطفى أحمدي",
  "معين بن زيد",
  "ياسين بن عمار",
  "أشرف السماوي",
  "فارس المسعدي",
  "حمزة الوزتي",
];

const defaultWeeks = [
  { id: "2026-02-07-931-950", start: 931, end: 950, date: "2026-02-07" },
  { id: "2026-04-04-941-960", start: 941, end: 960, date: "2026-04-04" },
  { id: "2026-04-11-951-970", start: 951, end: 970, date: "2026-04-11" },
  { id: "2026-04-18-961-980", start: 961, end: 980, date: "2026-04-18" },
  { id: "2026-04-25-971-990", start: 971, end: 990, date: "2026-04-25" },
  { id: "2026-05-02-981-1000", start: 981, end: 1000, date: "2026-05-02" },
  { id: "2026-05-09-991-1010", start: 991, end: 1010, date: "2026-05-09" },
  { id: "2026-05-16-1001-1020", start: 1001, end: 1020, date: "2026-05-16" },
  { id: "2026-05-23-1011-1030", start: 1011, end: 1030, date: "2026-05-23" },
];

const state = loadState();

const elements = {
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
  chatInput: document.querySelector("#chatInput"),
  analyzeBtn: document.querySelector("#analyzeBtn"),
  clearChatBtn: document.querySelector("#clearChatBtn"),
  analysisResult: document.querySelector("#analysisResult"),
  studentForm: document.querySelector("#studentForm"),
  studentName: document.querySelector("#studentName"),
  studentList: document.querySelector("#studentList"),
  weekForm: document.querySelector("#weekForm"),
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

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      return {
        students: parsed.students?.length ? parsed.students : defaultStudents,
        weeks: parsed.weeks?.length ? parsed.weeks : defaultWeeks,
        statuses: parsed.statuses || {},
        readyOrder: parsed.readyOrder || {},
        submissions: parsed.submissions || [],
      };
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  return {
    students: defaultStudents,
    weeks: defaultWeeks,
    statuses: {},
    readyOrder: {},
    submissions: [],
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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

async function firebaseRequest(path, options = {}) {
  if (!getFirebaseUrl()) {
    throw new Error("Aucune URL Firebase configurée.");
  }
  const response = await fetch(firebasePath(path), {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!response.ok) {
    throw new Error("Firebase n'a pas accepté la requête.");
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
    throw new Error(payload.error || "Erreur serveur local.");
  }
  return payload;
}

async function loadConfigFromBackend() {
  try {
    let config;
    if (getFirebaseUrl()) {
      config = await firebaseRequest("config");
    } else {
      config = await localRequest("/api/config");
    }
    if (config?.students?.length && config?.weeks?.length) {
      state.students = config.students;
      state.weeks = config.weeks;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      render();
    } else if (getFirebaseUrl()) {
      await syncConfigNow();
    }
    updateBackendUi("Configuration chargée.");
  } catch (error) {
    updateBackendUi(getFirebaseUrl() ? error.message : "Mode local sans serveur de données.");
  }
}

let syncTimer;
function syncConfigToBackend() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(syncConfigNow, 350);
}

async function syncConfigNow() {
  try {
    const config = { students: state.students, weeks: state.weeks };
    if (getFirebaseUrl()) {
      await firebaseRequest("config", {
        method: "PUT",
        body: JSON.stringify(config),
      });
    } else {
      await localRequest("/api/config", {
        method: "PUT",
        body: JSON.stringify(config),
      });
    }
    updateBackendUi("Élèves et semaines synchronisés.");
  } catch {
    updateBackendUi(getFirebaseUrl() ? "Synchronisation Firebase impossible." : "Mode navigateur local.");
  }
}

async function loadSubmissions() {
  const weekId = elements.weekSelect.value;
  try {
    if (getFirebaseUrl()) {
      const all = (await firebaseRequest("submissions")) || {};
      state.submissions = Object.entries(all)
        .map(([id, submission]) => ({ id, ...submission }))
        .filter((submission) => submission.weekId === weekId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else {
      const payload = await localRequest(`/api/submissions?weekId=${encodeURIComponent(weekId)}`);
      state.submissions = payload.submissions;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    renderSubmissions();
    updateBackendUi(`${state.submissions.length} réponse(s) récupérée(s).`);
  } catch (error) {
    updateBackendUi(error.message);
  }
}

async function markSubmissionApplied(submissionId) {
  if (getFirebaseUrl()) {
    await firebaseRequest(`submissions/${submissionId}`, {
      method: "PATCH",
      body: JSON.stringify({
        applied: true,
        appliedAt: new Date().toISOString(),
      }),
    });
  } else {
    await localRequest(`/api/submissions/${submissionId}/apply`, { method: "PATCH" });
  }
}

function updateBackendUi(message = "") {
  if (elements.apiUrlInput) {
    elements.apiUrlInput.value = getFirebaseUrl();
  }
  const source = getFirebaseUrl()
    ? "Source : Firebase en ligne gratuite."
    : "Source : navigateur local. Ajoutez l'URL Firebase pour le mode en ligne gratuit.";
  if (elements.syncStatus) {
    elements.syncStatus.textContent = message ? `${source} ${message}` : source;
  }
  if (elements.studentPortalLink) {
    elements.studentPortalLink.href = buildStudentPortalUrl();
  }
}

function buildStudentPortalUrl() {
  const url = new URL("student.html", window.location.href);
  if (getFirebaseUrl()) {
    url.searchParams.set("db", getFirebaseUrl());
  }
  return url.toString();
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

function weekLabel(week) {
  return `من ${week.start} إلى ${week.end}`;
}

function formatDate(dateString) {
  if (!dateString) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${dateString}T12:00:00`));
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
  if (status === "done") return "fait";
  if (status === "makeup") return "rattrapage";
  if (status === "missed") return "non fait";
  return "vide";
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

function renderWeekSelect() {
  const selected = elements.weekSelect.value || state.weeks.at(-1)?.id;
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

  const percentRow = document.createElement("tr");
  percentRow.className = "week-percent-row";
  percentRow.append(emptyCell("th", ""));
  percentRow.append(emptyCell("th", ""));
  percentRow.append(emptyCell("th", ""));
  percentRow.append(emptyCell("th", ""));
  state.weeks.forEach((week) => {
    const cell = emptyCell("td", `${weekCompletion(week.id)}%`);
    cell.className = "week-col";
    percentRow.append(cell);
  });
  table.append(percentRow);

  const header = document.createElement("tr");
  header.append(headerCell("الرقم", "index-col"));
  header.append(headerCell("الاسم", "name-col"));
  header.append(headerCell("نسبة التسميع", "percent-col"));
  header.append(headerCell("نسبة عدم التسميع", "percent-col"));
  state.weeks.forEach((week) => {
    header.append(headerCell(`${weekLabel(week)}\n${formatDate(week.date)}`, "week-col"));
  });
  table.append(header);

  state.students.forEach((student, index) => {
    const row = document.createElement("tr");
    row.append(emptyCell("td", String(index + 1), "index-col"));
    row.append(emptyCell("td", student, "name-col"));
    row.append(emptyCell("td", `${studentCompletion(student)}%`, "percent-col"));
    row.append(emptyCell("td", `${studentMissing(student)}%`, "percent-col"));

    state.weeks.forEach((week) => {
      const status = getStatus(student, week.id);
      const cell = emptyCell("td", "", `week-col status-${status || "empty"}`);
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
  totalRow.append(emptyCell("td", "", "index-col"));
  totalRow.append(emptyCell("td", "المجموعة", "name-col"));
  totalRow.append(emptyCell("td", `${averageCompletion()}%`, "percent-col"));
  totalRow.append(emptyCell("td", `${averageMissing()}%`, "percent-col"));
  state.weeks.forEach(() => totalRow.append(emptyCell("td", "", "week-col")));
  table.append(totalRow);
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
    remove.title = `Supprimer ${student}`;
    remove.addEventListener("click", () => removeStudent(student));

    chip.append(name, remove);
    elements.studentList.append(chip);
  });
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
  const order = state.readyOrder[selectedWeek] || state.students.filter((student) => {
    const status = getStatus(student, selectedWeek);
    return status === "done" || status === "makeup";
  });

  elements.readingChain.innerHTML = "";
  if (!order.length) {
    const item = document.createElement("li");
    item.textContent = "Aucun élève prêt détecté pour cette semaine.";
    elements.readingChain.append(item);
    return;
  }

  order.forEach((student, index) => {
    const item = document.createElement("li");
    const reader = document.createElement("strong");
    reader.textContent = student;
    const target = document.createElement("span");
    target.textContent = index === 0 ? " lit au professeur" : ` lit à ${order[index - 1]}`;
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
    empty.textContent = "Aucune réponse reçue pour cette semaine.";
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
      ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(submission.createdAt))
      : "date inconnue";
    meta.textContent = `${createdAt}${submission.applied ? " - déjà appliquée" : ""}`;

    const pill = document.createElement("span");
    pill.className = `status-pill status-${submission.status}`;
    pill.textContent = statusLabel(submission.status);

    item.append(name, pill, meta);
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
  elements.noReplyList.innerHTML = `<strong>Sans réponse pour cette semaine :</strong> ${missing.join("، ")}`;
}

function renderReportDate() {
  const today = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "full",
  }).format(new Date());
  elements.reportDate.textContent = today;
}

function render() {
  sortWeeks();
  renderWeekSelect();
  renderStudentList();
  renderTable();
  renderChain();
  renderSubmissions();
  renderReportDate();
  updateBackendUi();
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
    elements.analysisResult.textContent = "Choisissez une semaine et collez quelques messages.";
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
      `${messages.length} message(s) lu(s), mais aucun statut reconnu. Ajoutez des mots comme "تم", "سمعت", "استدراك" ou "لا".`;
    return;
  }

  const summary = updates.reduce((acc, update) => {
    acc[update.status] = (acc[update.status] || 0) + 1;
    return acc;
  }, {});

  elements.analysisResult.innerHTML = [
    `${messages.length} message(s) lu(s).`,
    `${updates.length} mise(s) à jour appliquée(s).`,
    `Fait : ${summary.done || 0}, rattrapage : ${summary.makeup || 0}, non fait : ${summary.missed || 0}.`,
  ].join("<br>");
}

async function applySubmissions() {
  const weekId = elements.weekSelect.value;
  await loadSubmissions();

  const pending = state.submissions.filter((submission) => submission.weekId === weekId && !submission.applied);
  const readyOrder = state.readyOrder[weekId] || [];

  for (const submission of pending) {
    if (!state.students.includes(submission.student)) continue;
    setStatus(submission.student, weekId, submission.status);
    if (
      (submission.status === "done" || submission.status === "makeup") &&
      !readyOrder.includes(submission.student)
    ) {
      readyOrder.push(submission.student);
    }
    submission.applied = true;
    try {
      await markSubmissionApplied(submission.id);
    } catch {
      submission.applied = false;
    }
  }

  const missing = studentsWithoutReply();
  missing.forEach((student) => setStatus(student, weekId, "missed"));

  state.readyOrder[weekId] = readyOrder;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
  updateBackendUi(
    `${pending.length} réponse(s) appliquée(s). ${missing.length} sans-réponse marqué(s) en rouge.`
  );
}

function markNoReplyAsMissed() {
  const weekId = elements.weekSelect.value;
  const missing = studentsWithoutReply();
  if (!missing.length) {
    updateBackendUi("Aucun élève sans réponse à marquer.");
    return;
  }

  const confirmed = window.confirm(
    `Marquer ${missing.length} élève(s) sans réponse en rouge pour cette semaine ?`
  );
  if (!confirmed) return;

  missing.forEach((student) => setStatus(student, weekId, "missed"));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
  updateBackendUi(`${missing.length} élève(s) sans réponse marqué(s) en rouge.`);
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
  const confirmed = window.confirm(`Supprimer ${studentName} du tableau ?`);
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
  render();
  elements.weekSelect.value = id;
  renderChain();
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
    throw new Error("Impossible de générer l'image du tableau.");
  }
  const filename = `suivi-shatibiyya-${new Date().toISOString().slice(0, 10)}.png`;

  if (share && navigator.canShare) {
    const file = new File([imageBlob], filename, { type: "image/png" });
    if (navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: "Suivi Shaṭibiyya",
        text: "Tableau hebdomadaire du groupe.",
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
  context.fillText("10 lignes par semaine", width - 14, 40);

  context.direction = "ltr";
  context.textAlign = "left";
  context.fillText(new Intl.DateTimeFormat("fr-FR", { dateStyle: "full" }).format(new Date()), 14, 40);
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
  const confirmed = window.confirm("Réinitialiser tous les élèves, semaines et statuts ?");
  if (!confirmed) return;
  localStorage.removeItem(STORAGE_KEY);
  state.students = [...defaultStudents];
  state.weeks = [...defaultWeeks];
  state.statuses = {};
  state.readyOrder = {};
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
    updateBackendUi("Lien élève copié.");
  } catch {
    updateBackendUi(`Lien élève : ${link}`);
  }
}

elements.analyzeBtn.addEventListener("click", applyChatAnalysis);
elements.clearChatBtn.addEventListener("click", () => {
  elements.chatInput.value = "";
  elements.analysisResult.textContent = "Messages vidés.";
});
elements.saveApiUrlBtn.addEventListener("click", saveBackendUrl);
elements.copyPortalBtn.addEventListener("click", copyStudentPortalLink);
elements.refreshSubmissionsBtn.addEventListener("click", loadSubmissions);
elements.applySubmissionsBtn.addEventListener("click", applySubmissions);
elements.markNoReplyBtn.addEventListener("click", markNoReplyAsMissed);
elements.studentForm.addEventListener("submit", addStudent);
elements.weekForm.addEventListener("submit", addWeek);
elements.weekSelect.addEventListener("change", () => {
  renderChain();
  loadSubmissions();
});
elements.exportImageBtn.addEventListener("click", () => exportImage(false));
elements.exportCsvBtn.addEventListener("click", exportCsv);
elements.shareBtn.addEventListener("click", () => exportImage(true));
elements.resetBtn.addEventListener("click", resetApp);

render();
loadConfigFromBackend();
loadSubmissions();
