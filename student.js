const elements = {
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
let currentConfig = null;

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

async function loadConfig() {
  try {
    const previousWeek = elements.weekSelect.value;
    const previousValidator = elements.validatorSelect.value;
    const previousStudent = elements.studentSelect.value;
    const config = getFirebaseUrl()
      ? await firebaseRequest("config")
      : await localRequest("/api/config");

    if (!config?.students?.length || !config?.weeks?.length) {
      throw new Error("الإعدادات غير موجودة.");
    }

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
  const waitingStudents = currentConfig.students.filter((student) => !isGreenStudent(currentConfig, student, weekId));

  renderAvailabilityList(greenStudents, weekId);
  renderValidatorSelect(greenStudents, preferredValidator);
  renderStudentSelect(waitingStudents, preferredStudent);
  setFormEnabled(greenStudents.length > 0 && waitingStudents.length > 0);
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
    elements.validatorSelect.append(emptyOption("لا يوجد طالب معتمد"));
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
    await firebaseRequest("config/statuses", {
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
  const validator = elements.validatorSelect.value;
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
    note: elements.note.value.trim(),
  };

  elements.result.textContent = "جار الإرسال...";
  try {
    const createdAt = new Date().toISOString();
    const appliedStatus = confirmationStatus(weekId, createdAt);
    const late = appliedStatus === "makeup";

    if (getFirebaseUrl()) {
      await firebaseRequest("submissions", {
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

elements.form.addEventListener("submit", submitResponse);
elements.weekSelect.addEventListener("change", () => renderWeekState());
loadConfig();
window.addEventListener("focus", loadConfig);
setInterval(loadConfig, 30000);
