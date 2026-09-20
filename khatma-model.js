/* Independent khatmas and append-only session history. */
(function (root) {
  const calendar = typeof module !== 'undefined' ? require('./review-model') : root.ReviewModel;
  const teachers = ['معز البحري','أنيس الغربي','حمدي عمارة','أسامة الورغي','أشرف السماوي','زينب بالحاج صالح','أسماء قرشان','أسماء شلبي','محمد أمين الغرسلاوي','ياسين بن عمار','فراس المسعدي','معز بن زيد','أسماء مسعودي','سمية الشيخ علي'];
  const readings = ['قالون وجه الأداء','قالون وجه الصلة + ابن كثير','قالون بمد المنفصل + حفص','قالون بمد المنفصل + عاصم','الأصبهاني','ابن كثير','أبو عمرو','الدوري عن أبي عمرو','السوسي عن أبي عمرو','ابن عامر','عاصم','حمزة','قالون بوجه الجمع + ورش من طريق الأزرق','الكسائي','ورش من طريق الأزرق','قالون بوجه الأداء + الأصبهاني'];
  const attendance = { present:'حاضر(ة) في الموعد', excused:'اعتذرت', absent:'غياب دون اعتذار', postponed:'تأجلت الحصة من قبل الشيخ' };
  function text(value, label, max = 160, optional = false) {
    if (typeof value !== 'string' || (!optional && !value.trim()) || value.trim().length > max) throw Error(`تحقق من ${label}.`);
    return value.trim();
  }
  const teacherList = store => store.settings?.teachers || teachers;
  const readingList = store => store.settings?.readings || readings;
  function setTeachers(store, names, actor, kind = "teachers") {
    if (!["teachers", "readings"].includes(kind)) throw Error("قائمة غير صالحة.");
    if (actor.role !== 'professor') throw Error('تعديل قائمة الشيوخ متاح للأستاذ فقط.');
    if (!Array.isArray(names) || !names.length || names.length > 200) throw Error('أدخل اسما واحدا على الأقل (200 كحد أقصى).');
    const clean = names.map(n => text(n, 'اسم الشيخ'));
    if (new Set(clean).size !== clean.length) throw Error('احذف الأسماء المكررة.');
    return { ...store, settings: { ...store.settings, [kind]: clean } };
  }
  function today(now = new Date()) { return new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(now); }
  function append(store, input, actor, students, day, now = new Date()) {
    if (actor.role !== 'student' || !students.includes(actor.name)) throw Error('يجب تسجيل الدخول كطالب من هذه المجموعة.');
    const id = text(input.id, 'معرف التسجيل');
    if (!/^[a-zA-Z0-9-]+$/.test(id)) throw Error('معرف التسجيل غير صالح.');
    if (store.entries?.[id]) {
      if (store.entries[id].student !== actor.name) throw Error('معرف التسجيل مستعمل.');
      return store;
    }
    let khatma = store.khatmas?.[input.khatmaId];
    if (khatma && khatma.student !== actor.name) throw Error('هذه الختمة ليست لك.');
    if (input.khatmaId && !khatma) throw Error('الختمة غير موجودة.');
    if (!teacherList(store).includes(input.teacher)) throw Error('اختر الشيخ من القائمة الحالية.');
    if (!readingList(store).includes(input.riwaya)) throw Error('اختر الرواية أو القراءة.');
    if (!Object.hasOwn(attendance, input.attendance)) throw Error('حدد الحضور.');
    const date = input.date;
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10) !== date || date > today(now) || date < '2000-01-01') throw Error('أدخل تاريخا صحيحا غير مستقبلي.');
    const week = calendar.week(day, new Date(`${date}T12:00:00Z`));
    if (typeof input.complete !== 'boolean') throw Error('حدد حالة الختمة.');
    const present = input.attendance === 'present';
    if (!present && input.complete) throw Error('لا يمكن إكمال ختمة دون قراءة.');
    if (!khatma) khatma = { id, student: actor.name, title: text(input.title, 'اسم الختمة'), createdAt: now.toISOString() };
    if (entries(store, actor.name).some(e => e.khatmaId === khatma.id && e.complete)) throw Error('هذه الختمة مكتملة. أضف ختمة جديدة.');
    const entry = { id, khatmaId: khatma.id, student: actor.name, weekId: week.id, date,
      teacher: input.teacher, riwaya: input.riwaya, attendance: input.attendance,
      start: present ? text(input.start, 'بداية القراءة') : '', position: present ? text(input.position, 'نهاية القراءة') : '',
      notes: text(input.notes, 'ملاحظات الشيخ(ة)', 1000, true), complete: input.complete, createdAt: now.toISOString() };
    return { ...store, khatmas: { ...store.khatmas, [khatma.id]: khatma }, entries: { ...store.entries, [id]: entry },
      weeks: { ...store.weeks, [week.id]: { ...week, students: [...new Set([...(store.weeks?.[week.id]?.students || []), ...students])] } } };
  }
  function recordSession(store, input, actor, students, day, now = new Date()) {
    const previous = entries(store, actor.name).find(e => e.teacher === input.teacher && e.riwaya === input.riwaya &&
      !entries(store, actor.name).some(other => other.khatmaId === e.khatmaId && other.complete));
    return append(store, { ...input, khatmaId: previous?.khatmaId || '',
      title: input.riwaya, complete: false }, actor, students, day, now);
  }
  function entries(store, student, weekId) {
    return Object.values(store.entries || {}).filter(e => (!student || e.student === student) && (!weekId || e.weekId === weekId))
      .sort((a,b) => (b.date || b.createdAt.slice(0,10)).localeCompare(a.date || a.createdAt.slice(0,10)) || b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  }
  function latest(store, student, endDate, progressOnly = false) {
    const seen = new Set();
    return entries(store, student).filter(e => {
      if ((endDate && e.date >= endDate) || (progressOnly && !e.position) || seen.has(e.khatmaId)) return false;
      seen.add(e.khatmaId); return true;
    });
  }
  const api = { append, recordSession, entries, latest, week: calendar.week, teachers, readings, attendance, teacherList, readingList, setTeachers, today };
  if (typeof module !== 'undefined') module.exports = api; else root.KhatmaModel = api;
})(globalThis);
