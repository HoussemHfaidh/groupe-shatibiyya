const elements = {
  form: document.querySelector("#submissionForm"),
  studentSelect: document.querySelector("#studentSelect"),
  weekSelect: document.querySelector("#studentWeekSelect"),
  validatorChoice: document.querySelector("#validatorChoice"),
  validatorHint: document.querySelector("#validatorHint"),
  validatorList: document.querySelector("#validatorList"),
  note: document.querySelector("#studentNote"),
  result: document.querySelector("#studentResult"),
};

const FIREBASE_URL_KEY = "shatibiyya-firebase-url";
const TEACHER_VALIDATOR = "__teacher__";
let currentConfig = null;

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

function isValidatorAvailable(config, studentName, weekId) {
  return getStatus(config, studentName, weekId) === "done";
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
    throw new Error("Firebase n'a pas accepté la requête. / لم يقبل Firebase الطلب.");
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
    throw new Error(payload.error || "Erreur serveur local. / خطأ في الخادم المحلي.");
  }
  return payload;
}

async function loadConfig() {
  try {
    const previousStudent = elements.studentSelect.value;
    const previousWeek = elements.weekSelect.value;
    const previousValidator = new FormData(elements.form).get("validator");
    const config = getFirebaseUrl()
      ? await firebaseRequest("config")
      : await localRequest("/api/config");
    if (!config?.students?.length || !config?.weeks?.length) {
      throw new Error("Configuration absente. / الإعدادات غير موجودة.");
    }
    currentConfig = config;
    renderOptions(config);
    if (config.students.includes(previousStudent)) {
      elements.studentSelect.value = previousStudent;
    }
    if (config.weeks.some((week) => week.id === previousWeek)) {
      elements.weekSelect.value = previousWeek;
    }
    renderValidators(previousValidator);
    elements.result.textContent = "Portail prêt. / البوابة جاهزة.";
  } catch (error) {
    elements.result.textContent =
      "Impossible de charger le portail. Vérifiez le lien envoyé par le professeur. / تعذر تحميل البوابة، تحقق من رابط الأستاذ.";
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

function selectedStatus() {
  return new FormData(elements.form).get("status") || "";
}

function validatorLabel(value) {
  return value === TEACHER_VALIDATOR ? "Professeur / الأستاذ" : value;
}

function renderValidators(preferredValidator = "") {
  if (!currentConfig || !elements.validatorList) return;

  const weekId = elements.weekSelect.value;
  const currentStudent = elements.studentSelect.value;
  const status = selectedStatus();
  const needsValidator = status === "done" || status === "makeup";

  elements.validatorChoice.disabled = !needsValidator;
  elements.validatorList.innerHTML = "";

  if (!needsValidator) {
    elements.validatorHint.textContent = "Pas nécessaire si tu n'as pas récité. / غير مطلوب إذا لم تسمع.";
    return;
  }

  const availableStudents = currentConfig.students.filter((student) => (
    student !== currentStudent && isValidatorAvailable(currentConfig, student, weekId)
  ));
  const selectedValue = availableStudents.includes(preferredValidator)
    ? preferredValidator
    : availableStudents[0] || TEACHER_VALIDATOR;

  if (!availableStudents.length) {
    elements.validatorHint.textContent =
      "Aucun élève vert pour cette semaine : envoie au professeur. / لا يوجد طالب أخضر لهذا الأسبوع: أرسل للأستاذ.";
    elements.validatorList.append(createValidatorOption({
      label: "Professeur / الأستاذ",
      value: TEACHER_VALIDATOR,
      available: true,
      selected: selectedValue === TEACHER_VALIDATOR,
    }));
    return;
  }

  elements.validatorHint.textContent =
    "Choisis seulement un nom vert. Les rouges ne sont pas encore autorisés. / اختر اسمًا أخضر فقط، والأسماء الحمراء غير متاحة.";

  currentConfig.students.forEach((student) => {
    if (student === currentStudent) return;
    const available = availableStudents.includes(student);
    elements.validatorList.append(createValidatorOption({
      label: student,
      value: student,
      available,
      selected: selectedValue === student,
    }));
  });
}

function createValidatorOption({ label, value, available, selected }) {
  const wrapper = document.createElement("label");
  wrapper.className = `validator-option ${available ? "available" : "unavailable"}`;

  const input = document.createElement("input");
  input.type = "radio";
  input.name = "validator";
  input.value = value;
  input.required = true;
  input.disabled = !available;
  input.checked = available && selected;

  const name = document.createElement("span");
  name.textContent = label;

  wrapper.append(input, name);
  return wrapper;
}

async function submitResponse(event) {
  event.preventDefault();
  const formData = new FormData(elements.form);
  const status = formData.get("status");
  const validator = formData.get("validator") || "";
  if ((status === "done" || status === "makeup") && !validator) {
    elements.result.textContent = "Choisis un nom vert avant d'envoyer. / اختر اسمًا أخضر قبل الإرسال.";
    return;
  }
  const payload = {
    student: elements.studentSelect.value,
    weekId: elements.weekSelect.value,
    status,
    validator,
    validatorLabel: validatorLabel(validator),
    note: elements.note.value.trim(),
  };

  elements.result.textContent = "Envoi en cours... / جار الإرسال...";
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
    renderValidators();
    elements.result.textContent = "Réponse envoyée. Le professeur la verra dans son tableau. / تم إرسال الإجابة، سيطلع عليها الأستاذ في الجدول.";
  } catch (error) {
    elements.result.textContent = error.message;
  }
}

elements.form.addEventListener("submit", submitResponse);
elements.studentSelect.addEventListener("change", () => renderValidators());
elements.weekSelect.addEventListener("change", () => renderValidators());
elements.form.addEventListener("change", (event) => {
  if (event.target.name === "status") {
    renderValidators();
  }
});
loadConfig();
window.addEventListener("focus", loadConfig);
setInterval(loadConfig, 30000);
