const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");

const PORT = Number(process.env.PORT || 4173);
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const DATA_FILE = path.join(DATA_DIR, "store.json");

const defaultStudents = [
  "أنيس عمار",
  "أسماء شلبي",
  "أسماء قرشاش",
  "آدم الماجري",
  "حسام حميط",
  "حسنين عكروت",
  "زينب بالحاج صالح",
  "سمية الشيخ علي",
  "علي اليانقي",
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
  { id: "2026-05-30-1021-1040", start: 1021, end: 1040, date: "2026-05-30" },
  { id: "2026-06-06-1031-1050", start: 1031, end: 1050, date: "2026-06-06" },
  { id: "2026-06-13-1041-1060", start: 1041, end: 1060, date: "2026-06-13" },
  { id: "2026-06-20-1051-1070", start: 1051, end: 1070, date: "2026-06-20" },
  { id: "2026-09-05-1061-1080", start: 1061, end: 1080, date: "2026-09-05" },
];

const recoveredStatusWeekIds = [
  "2026-04-25-971-990",
  "2026-05-02-981-1000",
  "2026-05-09-991-1010",
  "2026-05-16-1001-1020",
  "2026-05-23-1011-1030",
  "2026-05-30-1021-1040",
  "2026-06-06-1031-1050",
  "2026-06-13-1041-1060",
  "2026-06-20-1051-1070",
];

const recoveredMissedStatuses = {
  "أسماء شلبي": ["2026-06-06-1031-1050", "2026-06-20-1051-1070"],
  "أسماء قرشاش": ["2026-06-20-1051-1070"],
  "سمية الشيخ علي": [
    "2026-05-16-1001-1020",
    "2026-05-23-1011-1030",
    "2026-05-30-1021-1040",
    "2026-06-06-1031-1050",
    "2026-06-13-1041-1060",
    "2026-06-20-1051-1070",
  ],
  "محمد الصادق الكشباط": ["2026-05-02-981-1000"],
  "مصطفى أحمدي": ["2026-05-16-1001-1020", "2026-06-20-1051-1070"],
  "ياسين بن عمار": ["2026-06-20-1051-1070"],
  "فارس المسعدي": ["2026-05-02-981-1000", "2026-06-13-1041-1060"],
};

const recoveredMakeupStatuses = {
  "أسماء شلبي": ["2026-05-09-991-1010", "2026-05-23-1011-1030", "2026-05-30-1021-1040"],
  "أسماء قرشاش": ["2026-05-23-1011-1030"],
  "سمية الشيخ علي": ["2026-04-25-971-990", "2026-05-02-981-1000", "2026-05-09-991-1010"],
  "محمد الصادق الكشباط": ["2026-05-23-1011-1030"],
  "مصطفى أحمدي": ["2026-06-13-1041-1060"],
  "حمزة الوزتي": ["2026-05-02-981-1000"],
};

const mimeTypes = {
  ".html": "text/html;charset=utf-8",
  ".css": "text/css;charset=utf-8",
  ".js": "text/javascript;charset=utf-8",
  ".json": "application/json;charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

let store = {
  students: defaultStudents,
  weeks: defaultWeeks,
  settings: {
    weekBoundaryDay: 6,
  },
  statuses: buildRecoveredStatuses(),
  readyOrder: buildRecoveredReadyOrder(),
  submissions: [],
};

async function loadStore() {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    store = {
      students: parsed.students?.length ? parsed.students : defaultStudents,
      weeks: mergeWeeks(parsed.weeks?.length ? parsed.weeks : defaultWeeks),
      settings: normalizeSettings(parsed.settings),
      statuses: parsed.statuses && Object.keys(parsed.statuses).length
        ? { ...buildRecoveredStatuses(), ...parsed.statuses }
        : buildRecoveredStatuses(),
      readyOrder: parsed.readyOrder && Object.keys(parsed.readyOrder).length
        ? { ...buildRecoveredReadyOrder(), ...parsed.readyOrder }
        : buildRecoveredReadyOrder(),
      submissions: Array.isArray(parsed.submissions) ? parsed.submissions : [],
    };
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.warn("تعذر قراءة data/store.json، سيتم التشغيل بالقيم الافتراضية.");
    }
    await saveStore();
  }
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

function addReadyStudent(weekId, student) {
  if (!store.readyOrder[weekId]) {
    store.readyOrder[weekId] = [];
  }
  if (!store.readyOrder[weekId].includes(student)) {
    store.readyOrder[weekId].push(student);
  }
}

function normalizeSettings(settings = {}) {
  const weekBoundaryDay = Number(settings.weekBoundaryDay);
  return {
    weekBoundaryDay: Number.isInteger(weekBoundaryDay) && weekBoundaryDay >= 0 && weekBoundaryDay <= 6
      ? weekBoundaryDay
      : 6,
  };
}

function mergeWeeks(weeks = []) {
  const byId = new Map();
  [...weeks, ...defaultWeeks].forEach((week) => {
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

async function saveStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2));
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json;charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        request.destroy();
        reject(new Error("البيانات المرسلة كبيرة جدًا."));
      }
    });
    request.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("صيغة JSON غير صحيحة."));
      }
    });
    request.on("error", reject);
  });
}

async function handleApi(request, response, url) {
  if (request.method === "GET" && url.pathname === "/api/config") {
    sendJson(response, 200, {
      students: store.students,
      weeks: store.weeks,
      settings: store.settings,
      statuses: store.statuses,
      readyOrder: store.readyOrder,
    });
    return;
  }

  if (request.method === "PUT" && url.pathname === "/api/config") {
    const body = await readBody(request);
    if (!Array.isArray(body.students) || !Array.isArray(body.weeks)) {
      sendJson(response, 400, { error: "الإعدادات غير صحيحة." });
      return;
    }
    store.students = body.students.map(String).filter(Boolean);
    store.settings = normalizeSettings(body.settings);
    store.statuses = body.statuses && typeof body.statuses === "object"
      ? { ...buildRecoveredStatuses(), ...body.statuses }
      : buildRecoveredStatuses();
    store.readyOrder = body.readyOrder && typeof body.readyOrder === "object"
      ? { ...buildRecoveredReadyOrder(), ...body.readyOrder }
      : buildRecoveredReadyOrder();
    store.weeks = body.weeks
      .map((week) => ({
        id: String(week.id || ""),
        start: Number(week.start),
        end: Number(week.end),
        date: String(week.date || ""),
      }))
      .filter((week) => week.id && week.start && week.end && week.date);
    store.weeks = mergeWeeks(store.weeks);
    await saveStore();
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/submissions") {
    const weekId = url.searchParams.get("weekId");
    const submissions = weekId
      ? store.submissions.filter((submission) => submission.weekId === weekId)
      : store.submissions;
    sendJson(response, 200, { submissions });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/submissions") {
    const body = await readBody(request);
    const student = String(body.student || "").trim();
    const weekId = String(body.weekId || "").trim();
    const status = String(body.status || "").trim();
    const validator = String(body.validator || "").trim();
    const validatorLabel = String(body.validatorLabel || "").trim();
    const note = String(body.note || "").trim();
    const appliedStatus = ["done", "makeup", "missed"].includes(body.appliedStatus)
      ? body.appliedStatus
      : status;
    const createdAt = String(body.createdAt || new Date().toISOString());
    const applied = Boolean(body.applied);

    if (!student || !weekId || !["done", "makeup", "missed"].includes(status)) {
      sendJson(response, 400, { error: "الإجابة غير مكتملة." });
      return;
    }
    if (!store.students.includes(student) || !store.weeks.some((week) => week.id === weekId)) {
      sendJson(response, 400, { error: "الطالب أو الأسبوع غير معروف." });
      return;
    }

    const submission = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      student,
      weekId,
      status,
      validator,
      validatorLabel,
      note,
      applied,
      createdAt,
    };
    if (applied) {
      submission.appliedAt = String(body.appliedAt || createdAt);
      submission.appliedStatus = appliedStatus;
      if (typeof body.late === "boolean") {
        submission.late = body.late;
      }
      store.statuses[statusKey(student, weekId)] = appliedStatus;
      if (appliedStatus === "done" || appliedStatus === "makeup") {
        addReadyStudent(weekId, student);
      }
    }
    store.submissions.unshift(submission);
    await saveStore();
    sendJson(response, 201, { ok: true, submission });
    return;
  }

  const applyMatch = url.pathname.match(/^\/api\/submissions\/([^/]+)\/apply$/);
  if (request.method === "PATCH" && applyMatch) {
    const submission = store.submissions.find((item) => item.id === applyMatch[1]);
    if (!submission) {
      sendJson(response, 404, { error: "الإجابة غير موجودة." });
      return;
    }
    submission.applied = true;
    submission.appliedAt = new Date().toISOString();
    const body = await readBody(request);
    if (typeof body.late === "boolean") {
      submission.late = body.late;
    }
    if (["done", "makeup", "missed"].includes(body.appliedStatus)) {
      submission.appliedStatus = body.appliedStatus;
    }
    await saveStore();
    sendJson(response, 200, { ok: true, submission });
    return;
  }

  sendJson(response, 404, { error: "واجهة API غير معروفة." });
}

async function serveFile(request, response, url) {
  const requestedPath = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = path.normalize(path.join(ROOT, requestedPath));

  if (!filePath.startsWith(ROOT)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const content = await fs.readFile(filePath);
    response.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream",
    });
    response.end(content);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain;charset=utf-8" });
    response.end("الملف غير موجود.");
  }
}

async function main() {
  await loadStore();
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    try {
      if (url.pathname.startsWith("/api/")) {
        await handleApi(request, response, url);
      } else {
        await serveFile(request, response, url);
      }
    } catch (error) {
      sendJson(response, 500, { error: error.message || "خطأ في الخادم." });
    }
  });

  server.listen(PORT, "::", () => {
    console.log(`صفحة الأستاذ : http://127.0.0.1:${PORT}/`);
    console.log(`بوابة الطلاب : http://127.0.0.1:${PORT}/student.html`);
  });
}

main();
