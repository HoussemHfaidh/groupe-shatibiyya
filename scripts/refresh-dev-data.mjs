const DB_URL = (
  process.env.SHATIBIYYA_FIREBASE_DB_URL ||
  "https://groupe-shatibiyya-default-rtdb.asia-southeast1.firebasedatabase.app"
).replace(/\/+$/, "");

const DATA_GROUPS = [
  {
    groupId: "group1",
    storageId: "login-test-group1",
    productionConfigPath: "config",
    productionSubmissionsPath: "submissions",
  },
  {
    groupId: "group2",
    storageId: "login-test-group2",
    productionConfigPath: "config/groups/group2",
    productionSubmissionsPath: "submissions/groups/group2",
  },
];

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

function cleanSubmissionsPayload(payload) {
  if (!payload || typeof payload !== "object") return {};
  return Object.fromEntries(
    Object.entries(payload).filter(([, submission]) => (
      submission &&
      typeof submission === "object" &&
      typeof submission.weekId === "string" &&
      typeof submission.student === "string"
    ))
  );
}

async function refreshGroup(group) {
  const dataConfigPath = `config/groups/${group.storageId}`;
  const dataSubmissionsPath = `submissions/groups/${group.storageId}`;
  const productionConfig = await firebaseRequest(group.productionConfigPath);
  const productionSubmissions = cleanSubmissionsPayload(await firebaseRequest(group.productionSubmissionsPath));
  const loginEmails = await firebaseRequest(`${dataConfigPath}/loginEmails`);
  const dataConfig = {
    students: productionConfig.students || [],
    weeks: productionConfig.weeks || [],
    settings: productionConfig.settings || {},
    statuses: productionConfig.statuses || {},
    readyOrder: productionConfig.readyOrder || {},
    ...(loginEmails ? { loginEmails } : {}),
  };

  await firebaseRequest(dataConfigPath, {
    method: "PUT",
    body: JSON.stringify(dataConfig),
  });
  await firebaseRequest(dataSubmissionsPath, {
    method: "PUT",
    body: JSON.stringify(productionSubmissions),
  });

  return {
    groupId: group.groupId,
    storageId: group.storageId,
    students: dataConfig.students.length,
    weeks: dataConfig.weeks.length,
    statuses: Object.keys(dataConfig.statuses).length,
    submissions: Object.keys(productionSubmissions).length,
    loginEmails: Object.keys(loginEmails || {}).length,
  };
}

const results = [];
for (const group of DATA_GROUPS) {
  results.push(await refreshGroup(group));
}

console.log(JSON.stringify({
  mode: "DEV data",
  touchedPaths: DATA_GROUPS.flatMap((group) => [
    `config/groups/${group.storageId}`,
    `submissions/groups/${group.storageId}`,
  ]),
  untouchedProductionPaths: ["config", "submissions", "config/groups/group2", "submissions/groups/group2"],
  results,
}, null, 2));
