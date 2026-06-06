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
  submissions: [],
};

async function loadStore() {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    store = {
      students: parsed.students?.length ? parsed.students : defaultStudents,
      weeks: parsed.weeks?.length ? parsed.weeks : defaultWeeks,
      submissions: Array.isArray(parsed.submissions) ? parsed.submissions : [],
    };
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.warn("Impossible de lire data/store.json, démarrage avec les valeurs par défaut.");
    }
    await saveStore();
  }
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
        reject(new Error("Payload trop volumineux."));
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
        reject(new Error("JSON invalide."));
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
    });
    return;
  }

  if (request.method === "PUT" && url.pathname === "/api/config") {
    const body = await readBody(request);
    if (!Array.isArray(body.students) || !Array.isArray(body.weeks)) {
      sendJson(response, 400, { error: "Configuration invalide." });
      return;
    }
    store.students = body.students.map(String).filter(Boolean);
    store.weeks = body.weeks
      .map((week) => ({
        id: String(week.id || ""),
        start: Number(week.start),
        end: Number(week.end),
        date: String(week.date || ""),
      }))
      .filter((week) => week.id && week.start && week.end && week.date);
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
    const note = String(body.note || "").trim();

    if (!student || !weekId || !["done", "makeup", "missed"].includes(status)) {
      sendJson(response, 400, { error: "Réponse incomplète." });
      return;
    }
    if (!store.students.includes(student) || !store.weeks.some((week) => week.id === weekId)) {
      sendJson(response, 400, { error: "Élève ou semaine inconnue." });
      return;
    }

    const submission = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      student,
      weekId,
      status,
      note,
      applied: false,
      createdAt: new Date().toISOString(),
    };
    store.submissions.unshift(submission);
    await saveStore();
    sendJson(response, 201, { ok: true, submission });
    return;
  }

  const applyMatch = url.pathname.match(/^\/api\/submissions\/([^/]+)\/apply$/);
  if (request.method === "PATCH" && applyMatch) {
    const submission = store.submissions.find((item) => item.id === applyMatch[1]);
    if (!submission) {
      sendJson(response, 404, { error: "Réponse introuvable." });
      return;
    }
    submission.applied = true;
    submission.appliedAt = new Date().toISOString();
    await saveStore();
    sendJson(response, 200, { ok: true, submission });
    return;
  }

  sendJson(response, 404, { error: "API inconnue." });
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
    response.end("Fichier introuvable.");
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
      sendJson(response, 500, { error: error.message || "Erreur serveur." });
    }
  });

  server.listen(PORT, "::", () => {
    console.log(`Application professeur : http://127.0.0.1:${PORT}/`);
    console.log(`Portail eleves       : http://127.0.0.1:${PORT}/student.html`);
  });
}

main();
