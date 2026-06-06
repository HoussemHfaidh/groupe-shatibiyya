const elements = {
  form: document.querySelector("#submissionForm"),
  studentSelect: document.querySelector("#studentSelect"),
  weekSelect: document.querySelector("#studentWeekSelect"),
  note: document.querySelector("#studentNote"),
  result: document.querySelector("#studentResult"),
};

const FIREBASE_URL_KEY = "shatibiyya-firebase-url";

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

function getFirebaseUrl() {
  const fromQuery = new URLSearchParams(window.location.search).get("db");
  const configured = fromQuery || localStorage.getItem(FIREBASE_URL_KEY) || window.SHATIBIYYA_FIREBASE_DB_URL || "";
  const cleaned = configured.trim().replace(/\/+$/, "");
  if (cleaned) {
    localStorage.setItem(FIREBASE_URL_KEY, cleaned);
  }
  return cleaned;
}

function firebasePath(path) {
  return `${getFirebaseUrl()}/${path}.json`;
}

async function firebaseRequest(path, options = {}) {
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

async function loadConfig() {
  try {
    const previousStudent = elements.studentSelect.value;
    const previousWeek = elements.weekSelect.value;
    const config = getFirebaseUrl()
      ? await firebaseRequest("config")
      : await localRequest("/api/config");
    if (!config?.students?.length || !config?.weeks?.length) {
      throw new Error("Configuration absente.");
    }
    renderOptions(config);
    if (config.students.includes(previousStudent)) {
      elements.studentSelect.value = previousStudent;
    }
    if (config.weeks.some((week) => week.id === previousWeek)) {
      elements.weekSelect.value = previousWeek;
    }
    elements.result.textContent = "Portail prêt.";
  } catch (error) {
    elements.result.textContent =
      "Impossible de charger le portail. Vérifiez le lien envoyé par le professeur.";
  }
}

function renderOptions(config) {
  elements.studentSelect.innerHTML = "";
  config.students.forEach((student) => {
    const option = document.createElement("option");
    option.value = student;
    option.textContent = student;
    elements.studentSelect.append(option);
  });

  elements.weekSelect.innerHTML = "";
  config.weeks.forEach((week) => {
    const option = document.createElement("option");
    option.value = week.id;
    option.textContent = `${weekLabel(week)} - ${formatDate(week.date)}`;
    elements.weekSelect.append(option);
  });
  if (config.weeks.length) {
    elements.weekSelect.value = config.weeks.at(-1).id;
  }
}

async function submitResponse(event) {
  event.preventDefault();
  const formData = new FormData(elements.form);
  const payload = {
    student: elements.studentSelect.value,
    weekId: elements.weekSelect.value,
    status: formData.get("status"),
    note: elements.note.value.trim(),
  };

  elements.result.textContent = "Envoi en cours...";
  try {
    if (getFirebaseUrl()) {
      await firebaseRequest("submissions", {
        method: "POST",
        body: JSON.stringify({
          ...payload,
          applied: false,
          createdAt: new Date().toISOString(),
        }),
      });
    } else {
      await localRequest("/api/submissions", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }
    elements.form.reset();
    elements.weekSelect.value = payload.weekId;
    elements.result.textContent = "Réponse envoyée. Le professeur la verra dans son tableau.";
  } catch (error) {
    elements.result.textContent = error.message;
  }
}

elements.form.addEventListener("submit", submitResponse);
loadConfig();
window.addEventListener("focus", loadConfig);
setInterval(loadConfig, 30000);
