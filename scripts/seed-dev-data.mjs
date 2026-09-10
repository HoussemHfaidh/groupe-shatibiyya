const DB_URL = (
  process.env.SHATIBIYYA_FIREBASE_DB_URL ||
  "https://groupe-shatibiyya-default-rtdb.asia-southeast1.firebasedatabase.app"
).replace(/\/+$/, "");

const TEST_GROUPS = [
  {
    groupId: "group1",
    dataStorageId: "login-test-group1",
    testStorageId: "login-sandbox-group1",
    boundaryDay: 6,
  },
  {
    groupId: "group2",
    dataStorageId: "login-test-group2",
    testStorageId: "login-sandbox-group2",
    boundaryDay: 0,
  },
];

function studentNameOf(student) {
  return typeof student === "string" ? student : student.name;
}

function endOfDay(dateString) {
  return new Date(`${dateString}T23:59:59.999`);
}

function weekDeadline(week, boundaryDay) {
  const deadline = endOfDay(week.date);
  let dayOffset = (boundaryDay - deadline.getDay() + 7) % 7;
  if (dayOffset === 0) dayOffset = 7;
  deadline.setDate(deadline.getDate() + dayOffset);
  return deadline;
}

function addDaysIso(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy.toISOString();
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

async function firebaseRequest(path, options = {}) {
  const response = await fetch(`${DB_URL}/${path}.json`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!response.ok) {
    throw new Error(`${path}: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

function buildGroupSeed({ groupId, config, boundaryDay }) {
  const students = config.students.map(studentNameOf);
  const week = config.weeks.at(-1);
  if (!students.length || !week) {
    throw new Error(`Le groupe ${groupId} n'a pas assez de données.`);
  }

  const [validator, alreadyDone, lateStudent, missedStudent, pendingStudent] = students;
  const deadline = weekDeadline(week, boundaryDay);
  const beforeDeadline = addDaysIso(deadline, -2);
  const afterDeadline = addDaysIso(deadline, 1);

  return {
    week,
    statuses: {
      [statusKey(validator, week.id)]: "done",
      [statusKey(alreadyDone, week.id)]: "done",
      [statusKey(lateStudent, week.id)]: "makeup",
      [statusKey(missedStudent, week.id)]: "missed",
    },
    readyOrder: {
      [week.id]: [validator, alreadyDone, lateStudent],
    },
    submissions: {
      [`dev-seed-${groupId}-done`]: {
        student: alreadyDone,
        weekId: week.id,
        status: "done",
        validator,
        validatorLabel: validator,
        validatorEmail: "dev-seed@example.test",
        note: "Donnée TEST: confirmation déjà appliquée.",
        createdAt: beforeDeadline,
        applied: true,
        appliedAt: beforeDeadline,
        appliedStatus: "done",
        late: false,
      },
      [`dev-seed-${groupId}-late`]: {
        student: lateStudent,
        weekId: week.id,
        status: "done",
        validator: alreadyDone,
        validatorLabel: alreadyDone,
        validatorEmail: "dev-seed@example.test",
        note: "Donnée TEST: réponse en retard transformée en استدراك.",
        createdAt: afterDeadline,
        applied: true,
        appliedAt: afterDeadline,
        appliedStatus: "makeup",
        late: true,
      },
      [`dev-seed-${groupId}-pending`]: {
        student: pendingStudent,
        weekId: week.id,
        status: "done",
        validator,
        validatorLabel: validator,
        validatorEmail: "dev-seed@example.test",
        note: "Donnée TEST: réponse à appliquer par le professeur.",
        createdAt: beforeDeadline,
        applied: false,
        late: false,
      },
    },
  };
}

async function seedGroup(group) {
  const dataConfigPath = `config/groups/${group.dataStorageId}`;
  const testConfigPath = `config/groups/${group.testStorageId}`;
  const testSubmissionsPath = `submissions/groups/${group.testStorageId}`;
  const dataConfig = await firebaseRequest(dataConfigPath);
  const seed = buildGroupSeed({ ...group, config: dataConfig });
  const testConfig = {
    students: dataConfig.students || [],
    weeks: dataConfig.weeks || [],
    settings: dataConfig.settings || {},
    statuses: seed.statuses,
    readyOrder: seed.readyOrder,
    loginEmails: dataConfig.loginEmails || {},
  };

  await firebaseRequest(testConfigPath, {
    method: "PUT",
    body: JSON.stringify(testConfig),
  });
  await firebaseRequest(testSubmissionsPath, {
    method: "PUT",
    body: JSON.stringify(seed.submissions),
  });

  return {
    groupId: group.groupId,
    dataStorageId: group.dataStorageId,
    testStorageId: group.testStorageId,
    weekId: seed.week.id,
    statuses: Object.keys(seed.statuses).length,
    submissions: Object.keys(seed.submissions).length,
    loginEmails: Object.keys(testConfig.loginEmails).length,
  };
}

const results = [];
for (const group of TEST_GROUPS) {
  results.push(await seedGroup(group));
}

console.log(JSON.stringify({
  mode: "DEV test",
  touchedPaths: TEST_GROUPS.flatMap((group) => [
    `config/groups/${group.testStorageId}`,
    `submissions/groups/${group.testStorageId}`,
  ]),
  untouchedDataPaths: TEST_GROUPS.flatMap((group) => [
    `config/groups/${group.dataStorageId}`,
    `submissions/groups/${group.dataStorageId}`,
  ]),
  untouchedProductionPaths: ["config", "submissions", "config/groups/group2", "submissions/groups/group2"],
  results,
}, null, 2));
