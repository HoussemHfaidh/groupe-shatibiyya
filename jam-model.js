/* Shared rules for واجب الجمع, used by the browser and local server. */
(function (root) {
  function create(students, title, text, id) {
    const verses = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (!students.length || verses.length !== students.length) throw new Error("عدد الآيات يجب أن يساوي عدد الطلاب.");
    if (new Set(verses).size !== verses.length) throw new Error("لا يمكن تكرار الآية في نفس الواجب.");
    if (!title.trim()) throw new Error("أدخل عنوان الواجب.");
    return { id, title: title.trim(), students: [...students], verses, confirmations: [], createdAt: new Date().toISOString() };
  }
  function localDate(now, timeZone, boundaryHour = 6) {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
    const date = ["year", "month", "day"].map(type => parts.find(part => part.type === type).value).join("-");
    const hour = Number(new Intl.DateTimeFormat("en-GB", {timeZone, hour:"2-digit", hourCycle:"h23"}).format(now));
    return hour < boundaryHour ? new Date(Date.parse(date) - 86400000).toISOString().slice(0,10) : date;
  }
  function weeklyWindow(schedule, now = new Date()) {
    if (!schedule) return null;
    const today = localDate(now, schedule.timeZone);
    const offset = Math.floor((Date.parse(today) - Date.parse(schedule.startDate)) / 604800000);
    if (offset < 0) return null;
    const start = Date.parse(schedule.startDate) + offset * 604800000;
    return {
      id: `week-${new Date(start).toISOString().slice(0, 10)}`,
      number: schedule.number + offset,
      startDate: new Date(start).toISOString().slice(0, 10),
      endDate: new Date(start + 604800000).toISOString().slice(0, 10),
      timeZone: schedule.timeZone,
    };
  }
  function active(assignment, now = new Date()) {
    if (!assignment?.startDate || !assignment?.endDate || !assignment?.timeZone) return false;
    const today = localDate(now, assignment.timeZone);
    return today >= assignment.startDate && today < assignment.endDate;
  }
  function current(store, schedule, now = new Date()) {
    const week = weeklyWindow(schedule, now);
    if (week) return active(store[week.id], now) ? store[week.id] : null;
    return Object.values(store).find(assignment => active(assignment, now)) || null;
  }
  function ensureWeek(store, students, schedule, now = new Date()) {
    const week = weeklyWindow(schedule, now);
    if (!week) return store;
    const existing = store[week.id];
    if (existing) {
      if (existing.verses?.length || existing.confirmations?.length) return store;
      return { ...store, [week.id]: { ...existing, verses: existing.students.map((_, index) => `الآية ${index + 1}`) } };
    }
    return { ...store, [week.id]: {
      ...week, title: `واجب الجمع ${week.number}`, students: [...students],
      verses: students.map((_, index) => `الآية ${index + 1}`), confirmations: [], createdAt: now.toISOString(),
    } };
  }
  function confirm(assignment, student, verseIndex, actor, now = new Date()) {
    if (!assignment) throw new Error("اختر الواجب أولا.");
    if (assignment.startDate && !active(assignment, now)) throw new Error("انتهى وقت هذا الواجب. لا يوجد استدراك في واجب الجمع.");
    const confirmations = assignment.confirmations || [];
    if (!assignment.students.includes(student)) throw new Error("الطالب غير موجود في هذا الواجب.");
    if (!Number.isInteger(verseIndex) || !assignment.verses[verseIndex]) throw new Error("اختر آية من القائمة.");
    if (confirmations.some(item => item.student === student)) throw new Error("تم اعتماد هذا الطالب من قبل.");
    if (confirmations.some(item => item.verseIndex === verseIndex)) throw new Error("هذه الآية مستعملة. اختر آية متاحة.");
    if (actor.role !== "professor") {
      if (!actor.name || actor.name === student) throw new Error("لا يمكن للطالب أن يؤكد نفسه.");
      if (!confirmations.some(item => item.student === actor.name)) throw new Error("يجب أن يعتمدك الأستاذ أو طالب معتمد أولا.");
    }
    return { ...assignment, confirmations: [...confirmations, { student, verseIndex, validator: actor.role === "professor" ? "الأستاذ" : actor.name, createdAt: new Date().toISOString() }] };
  }
  const api = { create, confirm, weeklyWindow, active, current, ensureWeek };
  if (typeof module !== "undefined") module.exports = api;
  else root.JamModel = api;
})(globalThis);
