window.SHATIBIYYA_FIREBASE_DB_URL = "https://groupe-shatibiyya-default-rtdb.asia-southeast1.firebasedatabase.app";
window.SHATIBIYYA_LOGIN_TEST_LOCAL_ONLY = false;
window.SHATIBIYYA_EMAIL_ONLY_LOGIN = true;

window.SHATIBIYYA_FIREBASE_AUTH_CONFIG = {
  apiKey: "AIzaSyBU4dxW0VWw4kK5oeFF-BWOtcLaqoyrE7k",
  authDomain: "groupe-shatibiyya.firebaseapp.com",
  databaseURL: "https://groupe-shatibiyya-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "groupe-shatibiyya",
  storageBucket: "groupe-shatibiyya.firebasestorage.app",
  messagingSenderId: "324459722886",
  appId: "1:324459722886:web:d512c5cf10f5f145b17907",
};

window.SHATIBIYYA_LOGIN_TEST_PROFILE = {
  role: "student",
  groupId: "group1",
  studentName: "حسام حفيظ",
};

// Independent weekly calendar for واجب الجمع (DEV only).
window.SHATIBIYYA_JAM_SCHEDULES = {
  group1: { number: 45, startDate: "2026-09-05", timeZone: "Europe/Paris" },
  group2: { number: 45, startDate: "2026-09-06", timeZone: "Europe/Paris" },
};

// Local DEV shares Jam through server.js until the dedicated Firebase rules are deployed.
window.SHATIBIYYA_JAM_LOCAL_DEV ??= ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);
