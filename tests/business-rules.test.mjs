import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

function normalizeArabic(value) {
  return value
    .toString()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u064b-\u065f\u0670]/g, "")
    .replace(/[إأآا]/g, "ا")
    .replace(/[ىيی]/g, "ي")
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

function endOfDay(dateString) {
  return new Date(`${dateString}T23:59:59.999`);
}

function weekDeadline(week, weekBoundaryDay) {
  if (!week?.date) return null;
  const deadline = endOfDay(week.date);
  let dayOffset = (weekBoundaryDay - deadline.getDay() + 7) % 7;
  if (dayOffset === 0) dayOffset = 7;
  deadline.setDate(deadline.getDate() + dayOffset);
  return deadline;
}

function isLateSubmission(submission, weeks, weekBoundaryDay) {
  const week = weeks.find((item) => item.id === submission.weekId);
  const deadline = weekDeadline(week, weekBoundaryDay);
  if (!deadline || !submission.createdAt) return false;
  return new Date(submission.createdAt) > deadline;
}

function effectiveSubmissionStatus(submission, weeks, weekBoundaryDay) {
  if (submission.status === "done" && isLateSubmission(submission, weeks, weekBoundaryDay)) {
    return "makeup";
  }
  return submission.status;
}

function setStatus(state, studentName, weekId, status) {
  const key = statusKey(studentName, weekId);
  if (status) state.statuses[key] = status;
  else delete state.statuses[key];
}

function getStatus(state, studentName, weekId) {
  return state.statuses[statusKey(studentName, weekId)] || "";
}

function cycleStatus(state, studentName, weekId) {
  const order = ["", "done", "makeup", "missed"];
  const current = getStatus(state, studentName, weekId);
  const next = order[(order.indexOf(current) + 1) % order.length];
  setStatus(state, studentName, weekId, next);
  return next;
}

function studentCompletion(state, studentName) {
  const filledWeeks = state.weeks.filter((week) => {
    const status = getStatus(state, studentName, week.id);
    return status === "done" || status === "makeup";
  }).length;
  return state.weeks.length ? Math.round((filledWeeks / state.weeks.length) * 100) : 0;
}

function studentMissing(state, studentName) {
  const missedWeeks = state.weeks.filter((week) => getStatus(state, studentName, week.id) === "missed").length;
  return state.weeks.length ? Math.round((missedWeeks / state.weeks.length) * 100) : 0;
}

function weekCompletion(state, weekId) {
  const done = state.students.filter((student) => {
    const status = getStatus(state, student, weekId);
    return status === "done" || status === "makeup";
  }).length;
  return state.students.length ? Math.round((done / state.students.length) * 100) : 0;
}

function studentsWithoutReply(state, weekId) {
  const submitted = new Set(
    state.submissions
      .filter((submission) => submission.weekId === weekId)
      .map((submission) => submission.student)
  );
  return state.students.filter((student) => !submitted.has(student) && !getStatus(state, student, weekId));
}

function applySubmissionsBusiness(state, weekId) {
  const applicable = state.submissions.filter((submission) => {
    if (submission.weekId !== weekId || !state.students.includes(submission.student)) return false;
    return !submission.applied || getStatus(state, submission.student, weekId) !== effectiveSubmissionStatus(submission, state.weeks, state.settings.weekBoundaryDay);
  });
  const readyOrder = state.readyOrder[weekId] || [];

  for (const submission of applicable) {
    const late = isLateSubmission(submission, state.weeks, state.settings.weekBoundaryDay);
    const appliedStatus = effectiveSubmissionStatus(submission, state.weeks, state.settings.weekBoundaryDay);
    setStatus(state, submission.student, weekId, appliedStatus);
    if ((appliedStatus === "done" || appliedStatus === "makeup") && !readyOrder.includes(submission.student)) {
      readyOrder.push(submission.student);
    }
    submission.applied = true;
    submission.late = late;
    submission.appliedStatus = appliedStatus;
  }

  const missing = studentsWithoutReply(state, weekId);
  missing.forEach((student) => setStatus(state, student, weekId, "missed"));
  state.readyOrder[weekId] = readyOrder;
  return { applicableCount: applicable.length, missingCount: missing.length };
}

function nextWeekLineStep(weeks) {
  const lastWeek = weeks.at(-1);
  const previousWeek = weeks.at(-2);
  if (lastWeek && previousWeek) return Math.max(1, lastWeek.start - previousWeek.start);
  return 10;
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function createNextWeekCandidate(weeks) {
  const lastWeek = weeks.at(-1);
  const step = nextWeekLineStep(weeks);
  const start = lastWeek.start + step;
  const end = lastWeek.end + step;
  const date = addDays(lastWeek.date, 7);
  return { id: `${date}-${start}-${end}`, start, end, date };
}

function orderedGreenStudents(config, weekId) {
  const greenStudents = config.students.filter((student) => getStatus(config, student, weekId) === "done");
  const savedOrder = config.readyOrder?.[weekId] || [];
  return [
    ...savedOrder.filter((student) => greenStudents.includes(student)),
    ...greenStudents.filter((student) => !savedOrder.includes(student)),
  ];
}

function studentPortalOptions(config, weekId, currentStudentName) {
  const greenStudents = orderedGreenStudents(config, weekId);
  const validatorStudents = greenStudents.filter((student) => student === currentStudentName);
  const waitingStudents = config.students.filter((student) => (
    student !== currentStudentName && getStatus(config, student, weekId) !== "done"
  ));
  return {
    visibleStudents: [
      ...greenStudents,
      ...config.students.filter((student) => !greenStudents.includes(student)),
    ],
    validatorStudents,
    waitingStudents,
    enabled: validatorStudents.length > 0 && waitingStudents.length > 0,
  };
}

function assertIncludes(source, expected, label) {
  assert.ok(source.includes(expected), label);
}

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

test("les groupes gardent leurs jours de limite: groupe 1 samedi, groupe 2 dimanche", () => {
  const app = readProjectFile("app.js");
  assertIncludes(app, "weekBoundaryDay: 6", "groupe 1 doit rester sur samedi");
  assertIncludes(app, "settings: { weekBoundaryDay: 0 }", "groupe 2 doit rester sur dimanche");

  const group1Week = { id: "2026-09-05-1061-1080", date: "2026-09-05" };
  const group2Week = { id: "2026-09-06-431-450", date: "2026-09-06" };
  assert.equal(weekDeadline(group1Week, 6).toISOString().slice(0, 10), "2026-09-12");
  assert.equal(weekDeadline(group2Week, 0).toISOString().slice(0, 10), "2026-09-13");
});

test("une réponse après la limite devient استدراك, avant la limite reste تم", () => {
  const weeks = [{ id: "w1", date: "2026-09-05" }];
  assert.equal(effectiveSubmissionStatus({ weekId: "w1", status: "done", createdAt: "2026-09-12T20:00:00.000" }, weeks, 6), "done");
  assert.equal(effectiveSubmissionStatus({ weekId: "w1", status: "done", createdAt: "2026-09-13T00:00:00.000" }, weeks, 6), "makeup");
  assert.equal(effectiveSubmissionStatus({ weekId: "w1", status: "missed", createdAt: "2026-09-13T00:00:00.000" }, weeks, 6), "missed");
});

test("la cellule prof tourne dans l'ordre vide, تم, استدراك, لم يتم, vide", () => {
  const state = { weeks: [{ id: "w1" }], students: ["أ"], statuses: {} };
  assert.equal(cycleStatus(state, "أ", "w1"), "done");
  assert.equal(cycleStatus(state, "أ", "w1"), "makeup");
  assert.equal(cycleStatus(state, "أ", "w1"), "missed");
  assert.equal(cycleStatus(state, "أ", "w1"), "");
});

test("les pourcentages comptent تم et استدراك comme récité, et لم يتم comme absence", () => {
  const state = {
    weeks: [{ id: "w1" }, { id: "w2" }],
    students: ["أ", "ب"],
    statuses: {},
  };
  setStatus(state, "أ", "w1", "done");
  setStatus(state, "أ", "w2", "makeup");
  setStatus(state, "ب", "w1", "missed");
  assert.equal(studentCompletion(state, "أ"), 100);
  assert.equal(studentMissing(state, "ب"), 50);
  assert.equal(weekCompletion(state, "w1"), 50);
});

test("appliquer les réponses côté prof met à jour le tableau, l'ordre, les retards et les sans réponse", () => {
  const state = {
    students: ["أمين", "بدر", "جلال", "دنيا"],
    weeks: [{ id: "w1", date: "2026-09-05" }],
    settings: { weekBoundaryDay: 6 },
    statuses: {},
    readyOrder: { w1: ["أمين"] },
    submissions: [
      { id: "s1", student: "بدر", weekId: "w1", status: "done", createdAt: "2026-09-10T10:00:00.000" },
      { id: "s2", student: "جلال", weekId: "w1", status: "done", createdAt: "2026-09-13T10:00:00.000" },
      { id: "s3", student: "طالب غير موجود", weekId: "w1", status: "done", createdAt: "2026-09-10T10:00:00.000" },
    ],
  };
  setStatus(state, "أمين", "w1", "done");

  const result = applySubmissionsBusiness(state, "w1");
  assert.equal(result.applicableCount, 2);
  assert.equal(result.missingCount, 1);
  assert.equal(getStatus(state, "بدر", "w1"), "done");
  assert.equal(getStatus(state, "جلال", "w1"), "makeup");
  assert.equal(getStatus(state, "دنيا", "w1"), "missed");
  assert.deepEqual(state.readyOrder.w1, ["أمين", "بدر", "جلال"]);
  assert.equal(state.submissions[1].late, true);
  assert.equal(state.submissions[1].appliedStatus, "makeup");
});

test("la page élève montre la même logique verte que le tableau: verts d'abord, puis rouges", () => {
  const config = {
    students: ["أمين", "بدر", "جلال", "دنيا"],
    statuses: {},
    readyOrder: { w1: ["جلال", "أمين"] },
  };
  setStatus(config, "أمين", "w1", "done");
  setStatus(config, "بدر", "w1", "missed");
  setStatus(config, "جلال", "w1", "done");
  setStatus(config, "دنيا", "w1", "makeup");

  assert.deepEqual(orderedGreenStudents(config, "w1"), ["جلال", "أمين"]);
  assert.deepEqual(studentPortalOptions(config, "w1", "جلال"), {
    visibleStudents: ["جلال", "أمين", "بدر", "دنيا"],
    validatorStudents: ["جلال"],
    waitingStudents: ["بدر", "دنيا"],
    enabled: true,
  });
  assert.equal(studentPortalOptions(config, "w1", "بدر").enabled, false);
});

test("un élève connecté ne peut pas se confirmer lui-même ni confirmer un élève déjà vert", () => {
  const config = {
    students: ["أمين", "بدر", "جلال"],
    statuses: {},
    readyOrder: { w1: ["أمين"] },
  };
  setStatus(config, "أمين", "w1", "done");
  const options = studentPortalOptions(config, "w1", "أمين");
  assert.deepEqual(options.validatorStudents, ["أمين"]);
  assert.deepEqual(options.waitingStudents, ["بدر", "جلال"]);
  assert.equal(options.waitingStudents.includes("أمين"), false);
});

test("le bouton créer la semaine prochaine reprend le pas des lignes et ajoute 7 jours", () => {
  const next = createNextWeekCandidate([
    { id: "2026-08-29-1041-1060", start: 1041, end: 1060, date: "2026-08-29" },
    { id: "2026-09-05-1061-1080", start: 1061, end: 1080, date: "2026-09-05" },
  ]);
  assert.deepEqual(next, {
    id: "2026-09-12-1081-1100",
    start: 1081,
    end: 1100,
    date: "2026-09-12",
  });
});

test("la page login-dev reste sur les chemins de test et ne force pas les chemins prod", () => {
  const js = readProjectFile("student-login-test.js");
  const html = readProjectFile("student-login-dev.html");
  const config = readProjectFile("config-login-test.js");

  assertIncludes(js, 'group1: "login-test-group1"', "groupe 1 dev doit pointer sur login-test-group1");
  assertIncludes(js, 'group2: "login-test-group2"', "groupe 2 dev doit pointer sur login-test-group2");
  assertIncludes(js, "config/groups/${storageId}", "la config dev doit utiliser le storageId de test");
  assertIncludes(js, "submissions/groups/${storageId}", "les réponses dev doivent utiliser le storageId de test");
  assertIncludes(config, "window.SHATIBIYYA_EMAIL_ONLY_LOGIN = true", "le login dev doit rester en email uniquement");
  assert.ok(!html.includes('id="loginPassword"'), "la page dev ne doit pas afficher un champ mot de passe");
});

test("l'élève connecté applique immédiatement son statut dans la config dev après envoi", () => {
  const js = readProjectFile("student-login-test.js");
  const submitIndex = js.indexOf('await firebaseRequest(groupPath("submissions")');
  const applyIndex = js.indexOf("await applyConfirmedStatus(student, weekId, appliedStatus)", submitIndex);
  assert.ok(submitIndex > -1, "l'envoi Firebase de la réponse doit exister");
  assert.ok(applyIndex > submitIndex, "le statut doit être appliqué juste après l'envoi");
});

test("le login email-only garde la session longtemps si demandé, sinon session courte", () => {
  const keepOpenMs = 1000 * 60 * 60 * 24 * 180;
  const shortMs = 1000 * 60 * 60 * 4;
  assert.equal(Math.round(keepOpenMs / (1000 * 60 * 60 * 24)), 180);
  assert.equal(Math.round(shortMs / (1000 * 60 * 60)), 4);

  const js = readProjectFile("student-login-test.js");
  assertIncludes(js, "Date.now() + 1000 * 60 * 60 * 24 * 180", "session longue 180 jours attendue");
  assertIncludes(js, "Date.now() + 1000 * 60 * 60 * 4", "session courte 4 heures attendue");
});

let passed = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    passed += 1;
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    console.error(error);
    process.exitCode = 1;
    break;
  }
}

if (!process.exitCode) {
  console.log(`\n${passed}/${tests.length} règles métier validées.`);
}
