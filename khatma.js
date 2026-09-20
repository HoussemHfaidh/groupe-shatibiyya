/* متابعة الختمات الفردية — independent data and repeatable student submissions. */
window.Khatma = (() => {
  let ctx, key = '', epoch = 0, data = {}, busy = false, loaded = false, pending;
  let panel, navButton, heading, result, form, riwaya, position, notes, submit, report, weekSelect, detailSelect;
  let readingEditor;
  let teacher, sessionDate, attendance, start, studentName, teacherEditor, teacherForm, teacherSave, teacherDirty = false;
  let selectedWeek = '', selectedStudent = '', refreshId = 0;
  const el = (tag, text, cls) => { const n = document.createElement(tag); if (text) n.textContent = text; if (cls) n.className = cls; return n; };
  const field = (label, input) => { const n = el('label', '', 'field'); n.append(el('span', label), input); return n; };
  const button = (label, action) => { const b = el('button', label, 'secondary'); b.type = 'button'; b.onclick = action; return b; };
  function mount(next) {
    if (!/^login-(?:test|sandbox)-group[12]$/.test(next.storageId)) return;
    const nextKey = `${next.storageId}:${next.role}:${next.name || ''}`;
    ctx = next;
    if (!panel) build();
    if (key !== nextKey) {
      epoch++; key = nextKey; data = {}; loaded = false; pending = null; selectedWeek = ''; selectedStudent = ''; form.reset(); teacherDirty = false; draw();
    }
    if (!panel.hidden) refresh();
  }
  function build() {
    panel = el('section', '', 'panel khatma-panel'); panel.hidden = true;
    panel.append(el('h2', 'متابعة الختمات الفردية'), el('p', 'يمكنك متابعة عدة ختمات، وإضافة أكثر من تسجيل في الأسبوع لكل ختمة. يبقى كل تسجيل محفوظا في السجل.', 'subtitle'));
    heading = el('h3'); result = el('div', '', 'result-box'); result.setAttribute('aria-live', 'polite');
    report = el('div');
    weekSelect = el('select'); weekSelect.onchange = () => { selectedWeek = weekSelect.value; drawReport(); };
    detailSelect = el('select'); detailSelect.onchange = () => { selectedStudent = detailSelect.value; drawReport(); };
    const filters = el('div', '', 'khatma-filters');
    filters.append(field('الأسبوع', weekSelect), field('ملخص الطالب', detailSelect)); filters.hidden = ctx.role !== 'professor';
    form = el('form', '', 'student-form');
    studentName = el('input'); studentName.readOnly = true;
    teacher = el('select'); teacher.required = true;
    sessionDate = el('input'); sessionDate.type = 'date'; sessionDate.required = true; sessionDate.min = '2000-01-01';
    attendance = el('select'); attendance.required = true; attendance.add(new Option('اختر الحضور', ''));
    Object.entries(KhatmaModel.attendance).forEach(([value,label]) => attendance.add(new Option(label,value))); attendance.onchange = updateFields;
    start = el('input'); start.maxLength = 160;
    riwaya = el('select'); riwaya.required = true; riwaya.add(new Option('اختر الرواية أو القراءة','')); KhatmaModel.readings.forEach(r => riwaya.add(new Option(r,r)));
    position = el('input'); position.required = true; position.maxLength = 160; position.placeholder = 'مثال: سورة البقرة، الآية 120';
    notes = el('textarea'); notes.maxLength = 1000; notes.rows = 3;
    submit = el('button', 'حفظ المتابعة', 'primary'); submit.type = 'submit';
    form.append(field('الاسم واللقب', studentName), field('اسم الشيخ', teacher), field('التاريخ', sessionDate), field('الحضور', attendance), field('الرواية أو القراءة', riwaya), field('بداية القراءة (السورة والآية)', start), field('نهاية القراءة (السورة والآية)', position), field('ملاحظات الشيخ(ة)', notes), submit);
    form.onsubmit = save;
    teacherForm = el('form', '', 'khatma-teacher-form');
    teacherForm.hidden = ctx.role !== 'professor';
    teacherEditor = el('textarea'); teacherEditor.rows = 8; teacherEditor.required = true; teacherEditor.oninput = () => { teacherDirty = true; };
    readingEditor = el('textarea'); readingEditor.rows = 8; readingEditor.required = true; readingEditor.oninput = () => { teacherDirty = true; };
    teacherSave = el('button', 'حفظ القائمتين', 'primary'); teacherSave.type = 'submit';
    const editor = el('details'); editor.append(el('summary', 'إدارة الشيوخ والقراءات — مشتركة للمجموعتين'), el('p', 'أضف سطرا للإضافة، عدّل النص للتعديل، أو احذف السطر للحذف. تبقى التسجيلات السابقة محفوظة.'), field('الشيوخ — اسم واحد في كل سطر', teacherEditor), field('القراءات — قراءة واحدة في كل سطر', readingEditor), teacherSave); teacherForm.append(editor); teacherForm.onsubmit = saveTeachers;
    panel.append(teacherForm);
    panel.append(heading, button('تحديث الختمات', refresh), filters, form, result, report);
    const navigation = ctx.host.querySelector('.jam-navigation');
    navButton = button('متابعة الختمات الفردية', () => {
      navigation.querySelector('button').click();
      [...ctx.host.children].filter(n => n !== panel && !n.contains(navigation) && !n.matches('.account-box,.eyebrow')).forEach(n => n.hidden = true);
      if (ctx.role === 'professor') document.querySelectorAll('#exportImageBtn,#resetBtn').forEach(n => n.hidden = true);
      panel.hidden = false;
      [...navigation.children].forEach(n => n.setAttribute('aria-pressed', String(n === navButton)));
      refresh();
    });
    navigation.addEventListener('click', event => { if (event.target !== navButton) { panel.hidden = true; navButton.setAttribute('aria-pressed', 'false'); } });
    navButton.setAttribute('aria-pressed', 'false'); navigation.append(navButton); ctx.host.append(panel);
  }
  const catalogId = c => c.storageId.replace(/group[12]$/, 'catalog');
  const remote = (c, catalog = false) => c.local ? '' : catalog ? c.firebaseUrl().replace(/groups\/(login-(?:test|sandbox))-group[12]\.json/, 'catalogs/$1.json') : c.firebaseUrl();
  async function read(c, catalog = false) {
    await c.prepare?.();
    const url = remote(c, catalog);
    const response = await fetch(url || `/api/khatma/${encodeURIComponent(catalog ? catalogId(c) : c.storageId)}`, { cache: 'no-store', headers: url ? { 'X-Firebase-ETag': 'true' } : {} });
    if (!response.ok) throw Error('تعذر تحميل الختمات. تحقق من الاتصال وصلاحيات البيانات ثم أعد المحاولة.');
    const snapshot = url ? { value: await response.json() || {}, etag: response.headers.get('ETag') } : await response.json();
    if (!catalog) { const shared = await read(c, true); snapshot.value = { ...snapshot.value, settings: shared.value.settings || {} }; }
    return snapshot;
  }
  async function refresh() {
    if (!ctx || busy || ctx.ready === false) return;
    const c = ctx, token = epoch, requestId = ++refreshId;
    result.textContent = 'جار تحميل الختمات...';
    try {
      const snapshot = await read(c);
      if (token !== epoch || requestId !== refreshId || busy) return;
      data = snapshot.value; loaded = true; draw(); result.textContent = '';
    } catch (e) { if (token === epoch && requestId === refreshId) result.textContent = e.message; }
  }
  async function save(event) {
    event.preventDefault();
    if (!ctx || busy || !loaded || !form.reportValidity()) return;
    const payload = { teacher: teacher.value, date: sessionDate.value, attendance: attendance.value, start: start.value, riwaya: riwaya.value, position: position.value, notes: notes.value };
    const signature = JSON.stringify(payload);
    if (!pending || pending.signature !== signature) pending = { signature, id: crypto.randomUUID() };
    const input = { ...payload, id: pending.id }, c = ctx, token = epoch;
    busy = true; refreshId++; updateFields(); result.textContent = 'جار الحفظ...';
    try {
      const snapshot = await read(c);
      if (token !== epoch) return;
      const value = KhatmaModel.recordSession(snapshot.value, input, { role: c.role, name: c.name }, c.students, c.day);
      if (value !== snapshot.value) {
        await c.prepare?.();
        if (token !== epoch) return;
        const url = remote(c);
        if (url && !snapshot.etag) throw Error('تعذر تأمين الحفظ. أعد المحاولة.');
        const response = await fetch(url || `/api/khatma/${encodeURIComponent(c.storageId)}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json', ...(url ? { 'if-match': snapshot.etag } : {}) },
          body: JSON.stringify(url ? { ...value, settings: null } : { value: { ...value, settings: null }, revision: snapshot.revision }),
        });
        if ([409, 412].includes(response.status)) throw Error('وصل تسجيل آخر أثناء الحفظ. أعد الضغط على حفظ المتابعة؛ بياناتك ما زالت في النموذج.');
        if (!response.ok) throw Error('تعذر الحفظ. أعد المحاولة؛ بياناتك ما زالت في النموذج.');
      }
      if (token !== epoch) return;
      data = value; pending = null; form.reset(); teacherDirty = false; draw();
      teacher.value = input.teacher; riwaya.value = input.riwaya;
      result.textContent = 'تم حفظ المتابعة. يمكنك إضافة تسجيل آخر.';
    } catch (e) { if (token === epoch) result.textContent = e.message; }
    finally { busy = false; if (ctx) updateFields(); }
  }
  async function saveTeachers(event) {
    event.preventDefault();
    if (busy || !loaded || ctx.role !== 'professor' || !teacherForm.reportValidity()) return;
    const names = teacherEditor.value.split(/\r?\n/).map(n => n.trim()).filter(Boolean), c = ctx, token = epoch;
    busy = true; refreshId++; updateFields(); result.textContent = 'جار الحفظ...';
    try {
      const snapshot = await read(c, true);
      if (token !== epoch) return;
      const teacherValue = KhatmaModel.setTeachers(snapshot.value, names, {role:c.role});
      const value = KhatmaModel.setTeachers(teacherValue, readingEditor.value.split(/\r?\n/).map(n => n.trim()).filter(Boolean), {role:c.role}, 'readings');
      await c.prepare?.();
      if (token !== epoch) return;
      const url = remote(c, true);
      if (url && !snapshot.etag) throw Error('تعذر تأمين الحفظ. أعد المحاولة.');
      const response = await fetch(url || `/api/khatma/${encodeURIComponent(catalogId(c))}`, {method:'PUT', headers:{'Content-Type':'application/json', ...(url ? {'if-match':snapshot.etag} : {})}, body:JSON.stringify(url ? value : {value,revision:snapshot.revision})});
      if ([409,412].includes(response.status)) throw Error('تغيرت البيانات. أعد حفظ القائمتين.');
      if (!response.ok) throw Error('تعذر حفظ القائمتين.');
      if (token !== epoch) return;
      data = { ...data, settings: value.settings }; teacherDirty = false; draw(); result.textContent = 'تم حفظ القائمتين. التسجيلات السابقة محفوظة بأسمائها الأصلية.';
    } catch(e) { if(token === epoch) result.textContent = e.message; }
    finally { busy = false; if(ctx) updateFields(); }
  }
  function updateFields() {
    const present = attendance.value === 'present'; start.required = position.required = present;
    [...form.elements].forEach(n => n.disabled = busy || !loaded || ctx?.ready === false || !ctx?.students.includes(ctx.name));
    start.disabled ||= !present; position.disabled ||= !present;
    readingEditor.disabled = teacherEditor.disabled = teacherSave.disabled = busy || !loaded || ctx?.ready === false;
  }
  function draw() {
    if (!ctx) return;
    const week = KhatmaModel.week(ctx.day);
    heading.textContent = `الأسبوع الحالي · ${week.startDate} — ${week.endDate} · الإغلاق 06:00`;
    form.hidden = ctx.role !== 'student';
    studentName.value = ctx.name || '';
    sessionDate.max = KhatmaModel.today(); if (!sessionDate.value) sessionDate.value = sessionDate.max;
    const oldTeacher = teacher.value; teacher.replaceChildren(new Option('اختر الشيخ', ''), ...KhatmaModel.teacherList(data).map(n => new Option(n,n))); teacher.value = oldTeacher;
    const oldReading = riwaya.value; riwaya.replaceChildren(new Option('اختر الرواية أو القراءة',''), ...KhatmaModel.readingList(data).map(n => new Option(n,n))); riwaya.value = oldReading;
    if (!teacherDirty) { teacherEditor.value = KhatmaModel.teacherList(data).join('\n'); readingEditor.value = KhatmaModel.readingList(data).join('\n'); }
    updateFields();
    // Include empty intervening weeks so a missing report remains visible.
    const recordedWeeks = Object.keys(data.weeks || {}).sort();
    const first = recordedWeeks[0] || week.id;
    const weeks = [];
    for (let start = week.id; start >= first; start = new Date(Date.parse(start) - 604800000).toISOString().slice(0, 10)) weeks.push(start);
    weekSelect.replaceChildren(...weeks.map(w => new Option(w, w)));
    if (!weeks.includes(selectedWeek)) selectedWeek = week.id;
    weekSelect.value = selectedWeek;
    const names = [...new Set([...ctx.students, ...Object.values(data.khatmas || {}).map(k => k.student)])];
    detailSelect.replaceChildren(new Option('جميع الطلاب — الجدول الأسبوعي', ''), ...names.map(n => new Option(n, n)));
    if (!names.includes(selectedStudent)) selectedStudent = '';
    detailSelect.value = selectedStudent;
    drawReport();
  }
  function table(headers, cls) {
    const wrap = el('div', '', 'khatma-scroll'), t = el('table', '', `khatma-table ${cls || ''}`), head = el('thead'), row = el('tr'), body = el('tbody');
    headers.forEach(label => { const th = el('th', label); th.scope = 'col'; row.append(th); });
    head.append(row); t.append(head, body); wrap.append(t); report.append(wrap); return body;
  }
  const entryLabel = e => `${data.khatmas[e.khatmaId]?.title || 'ختمة'} · ${e.riwaya || ''} · ${e.teacher || ''} — ${e.position || KhatmaModel.attendance[e.attendance]}`;
  function drawReport() {
    report.replaceChildren();
    if (!loaded) { report.append(el('p', 'ستظهر البيانات بعد تحميل الختمات.')); return; }
    if (ctx.role === 'professor' && !selectedStudent) {
      report.append(el('h3', `متابعة الأسبوع · ${selectedWeek}`));
      const names = [...new Set([...ctx.students, ...(data.weeks?.[selectedWeek]?.students || []), ...KhatmaModel.entries(data, null, selectedWeek).map(e => e.student)])];
      const endDate = new Date(Date.parse(selectedWeek) + 604800000).toISOString().slice(0, 10);
      const body = table(['الطالب', 'التعبئة هذا الأسبوع', 'عدد التسجيلات', 'آخر موضع معروف حتى نهاية الأسبوع', 'التفاصيل'], 'khatma-weekly');
      for (const name of names) {
        const entries = KhatmaModel.entries(data, name, selectedWeek), row = el('tr');
        const label = el('th', name); label.scope = 'row';
        row.append(label, el('td', entries.length ? 'تم التسجيل' : 'لم يسجل', entries.length ? 'khatma-done' : 'khatma-missing'), el('td', `${entries.length} · حضور: ${entries.filter(e => e.attendance === 'present').length}`));
        const positions = el('td');
        const progress = KhatmaModel.latest(data, name, endDate, true);
        KhatmaModel.latest(data, name, endDate).forEach(e => {
          const count = entries.filter(item => item.khatmaId === e.khatmaId).length;
          const line = el('p', `${entryLabel(e)} · تسجيلات الأسبوع: ${count}`);
          const previous = progress.find(item => item.khatmaId === e.khatmaId);
          if (!e.position && previous) line.append(el('span', ` · آخر موضع: ${previous.position}`));
          positions.append(line);
        });
        if (!positions.children.length) positions.textContent = 'لا توجد ختمة مسجلة';
        const action = el('td'); action.append(button('عرض الملخص', () => { selectedStudent = name; detailSelect.value = name; drawReport(); })); row.append(positions, action); body.append(row);
      }
      report.append(el('p', 'آخر موضع معروف يشمل التسجيلات السابقة. «لم يسجل» يعني عدم وجود تعبئة في الأسبوع المحدد.', 'subtitle'));
      return;
    }
    const name = ctx.role === 'student' ? ctx.name : selectedStudent;
    const entries = KhatmaModel.entries(data, name), latest = KhatmaModel.latest(data, name);
    report.append(el('h3', ctx.role === 'student' ? 'ختماتي وسجل المتابعة' : `ملخص الطالب · ${name}`));
    report.append(el('p', `الختمات: ${latest.length} · التسجيلات: ${entries.length}`, 'khatma-summary'));
    if (!entries.length) { report.append(el('p', 'لا توجد تسجيلات بعد. اختر الشيخ والقراءة ثم سجّل متابعتك.')); return; }
    const cards = el('div', '', 'khatma-cards'); latest.forEach(e => { const progress = KhatmaModel.latest(data, name, null, true).find(p => p.khatmaId === e.khatmaId); const card = el('article', entryLabel(e), 'khatma-card'); if (!e.position && progress) card.append(el('p', `آخر موضع: ${progress.position}`)); cards.append(card); }); report.append(cards);
    report.append(el('h3', 'جميع التسجيلات — كل الأسابيع'));
    const body = table(['التاريخ', 'الأسبوع', 'الختمة', 'اسم الشيخ', 'الرواية أو القراءة', 'الحضور', 'بداية القراءة', 'نهاية القراءة', 'ملاحظات الشيخ(ة)'], 'khatma-history');
    entries.forEach(e => {
      const k = data.khatmas[e.khatmaId], row = el('tr');
      [e.date, e.weekId, k?.title || '', e.teacher, e.riwaya, KhatmaModel.attendance[e.attendance], e.start || '—', e.position || '—', e.notes || '—'].forEach(t => row.append(el('td', t)));
      body.append(row);
    });
  }
  setInterval(() => { if (ctx && !panel.hidden && !busy) refresh(); }, 30000);
  window.addEventListener('focus', () => { if (ctx && !panel.hidden) refresh(); });
  return { mount, logout() { epoch++; refreshId++; ctx = null; key = ''; data = {}; loaded = false; pending = null; form?.reset(); if (panel) panel.hidden = true; } };
})();
