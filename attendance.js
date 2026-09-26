window.Attendance = (() => {
  let ctx, key, panel, navButton, file, sessions, summary, report, status, data = [], selected = '', busy = false;
  let preview, previewImage, actions, editor, dialog, dialogImage;
  let learned = {}, matchingBox;
  const manual = [['excused', 'خروج باستئذان'], ['unexcused', 'خروج بدون استئذان'], ['removed', 'إخراج لعدم الاستجابة']];
  const el = (tag, text, cls) => { const n = document.createElement(tag); if (text) n.textContent = text; if (cls) n.className = cls; return n; };
  const field = (label, control) => { const n = el('label', '', 'field'); n.append(el('span', label), control); return n; };
  function mount(next) {
    if (next.role !== 'professor' || !/^login-(test|sandbox)-group[12]$/.test(next.storageId)) return;
    const rosterChanged = JSON.stringify(ctx?.students) !== JSON.stringify(next.students) || ctx?.ready !== next.ready;
    ctx = next;
    if (!panel) build();
    const nextKey = `shatibiyya-attendance-v1:${ctx.storageId}`;
    if (nextKey === key) { file.disabled = busy || ctx.ready === false; if (rosterChanged) draw(); return; }
    key = nextKey; selected = ''; data = []; learned = {}; file.value = ''; status.textContent = '';
    try { const stored = JSON.parse(localStorage.getItem(key) || '[]'); data = Array.isArray(stored) ? stored : stored.sessions; learned = Array.isArray(stored) ? {} : stored.aliases || {}; if (!Array.isArray(data)) throw Error(); }
    catch { status.textContent = 'تعذر قراءة الجلسات المحفوظة. لم يتم تغييرها.'; file.disabled = true; return; }
    file.disabled = busy || ctx.ready === false; draw();
  }
  function build() {
    panel = el('section', '', 'panel attendance-panel'); panel.hidden = true;
    panel.append(el('h2', 'الحضور'), el('p', 'ارفع تقرير المشاركين من Zoom لجلسة واحدة. تجمع المدد حسب الاسم ويكون الأستاذ Gharbi مرجع الحساب.', 'subtitle'));
    file = el('input'); file.type = 'file'; file.accept = '.xlsx,.csv'; file.onchange = importFile;
    sessions = el('select'); sessions.onchange = () => { selected = sessions.value; draw(); };
    const controls = el('div', '', 'attendance-controls'); controls.append(field('استيراد تقرير Zoom — Excel / CSV', file), field('الجلسات المحفوظة', sessions));
    status = el('div', '', 'result-box'); status.setAttribute('aria-live', 'polite');
    summary = el('div', '', 'attendance-summary'); report = el('div', '', 'attendance-scroll');
    actions = el('div', '', 'button-row attendance-actions');
    [['تصدير الجدول كاملا PNG', () => exportReport(false)], ['مشاركة الجدول', () => exportReport(true)], ['تكبير الجدول', () => { dialogImage.src = previewImage.src; dialog.showModal(); }]].forEach(([label, action]) => {
      const button = el('button', label, 'secondary'); button.type = 'button'; button.onclick = action; actions.append(button);
    });
    preview = el('div', '', 'attendance-preview'); previewImage = el('img'); previewImage.alt = 'جدول الحضور كاملا بجميع المشاركين والحالات'; preview.append(previewImage);
    matchingBox = el('details', '', 'attendance-matching');
    editor = el('details', '', 'attendance-editor'); editor.append(el('summary', 'تعديل حالات الخروج — اضغط لفتح الجدول'), report);
    dialog = el('dialog', '', 'attendance-dialog');
    const close = el('button', 'إغلاق', 'secondary'); close.type = 'button'; close.onclick = () => dialog.close();
    dialogImage = el('img'); dialogImage.alt = previewImage.alt; dialog.append(close, dialogImage); panel.append(dialog);
    panel.append(controls, status, summary, matchingBox, actions, preview, editor,
      el('p', 'دخول متأخر: من 5 دقائق بعد أول دخول للأستاذ. الحضور محسوب من أوقات الاتصال أثناء حضور الأستاذ، دون تكرار الفترات المتداخلة. التوقيت المعروض: توقيت تقرير Zoom ناقص ساعتين.', 'subtitle'),
      el('p', 'اضغط على سبب الخروج لتفعيله، واضغط مرة أخرى لإلغائه. تُحفظ الجلسات والاختيارات في هذا المتصفح ولهذه المجموعة فقط.', 'subtitle'));
    const nav = ctx.host.querySelector('.jam-navigation');
    navButton = el('button', 'الحضور', 'secondary'); navButton.type = 'button'; navButton.setAttribute('aria-pressed', 'false');
    navButton.onclick = () => {
      nav.querySelector('button').click();
      [...ctx.host.children].filter(n => n !== panel && !n.contains(nav)).forEach(n => n.hidden = true);
      document.querySelectorAll('#exportImageBtn,#resetBtn').forEach(n => n.hidden = true);
      panel.hidden = false; [...nav.children].forEach(n => n.setAttribute('aria-pressed', String(n === navButton)));
    };
    nav.addEventListener('click', e => { if (e.target !== navButton) { panel.hidden = true; navButton.setAttribute('aria-pressed', 'false'); } });
    nav.append(navButton); ctx.host.append(panel);
  }
  function persist(next, aliases = learned) {
    try { localStorage.setItem(key, JSON.stringify({version:2,sessions:next,aliases})); data = next; learned = aliases; return true; }
    catch { status.textContent = 'تعذر الحفظ في المتصفح. لم يتم تطبيق التغيير؛ تحقق من مساحة التخزين.'; return false; }
  }
  async function importFile() {
    const uploaded = file.files[0]; if (!uploaded || busy) return;
    const originalKey = key, options = {students:[...(ctx.students || [])],aliases:{...learned}}; busy = true; file.disabled = true; status.textContent = 'جار تحليل التقرير...';
    matchingBox.querySelectorAll('select').forEach(n => n.disabled = true);
    try {
      const rows = await AttendanceImport.read(uploaded);
      const result = AttendanceModel.calculate(rows, 'Gharbi', options);
      if (key !== originalKey) return;
      const id = `${result.teacher.join}-${result.teacher.leave}`;
      const previous = data.find(s => s.id === id);
      const session = { ...result, id, filename: uploaded.name, flags: AttendanceModel.migrateFlags(previous, result) };
      const next = [session, ...data.filter(s => s.id !== id)].sort((a, b) => b.teacher.join - a.teacher.join);
      if (!persist(next)) return;
      selected = id; draw(); status.textContent = `تم حفظ الجلسة: ${rows.length} اتصال، ${result.participants.length} مشاركا دون الأستاذ.`;
    } catch (e) { if (key === originalKey) status.textContent = e.message || 'تعذر قراءة الملف'; }
    finally { busy = false; file.disabled = ctx.ready === false; file.value = ''; drawMatching(data.find(s => s.id === selected)); }
  }
  function drawMatching(current) {
    matchingBox.replaceChildren(); matchingBox.hidden = !current;
    if (!current) return;
    if (!current.rawRecords) {
      matchingBox.append(el('summary', 'جلسة قديمة: أعد استيراد CSV لتطبيق مطابقة الأسماء وتصحيح التداخل.'));
      return;
    }
    const entries = Object.entries(current.resolutions || {}).filter(([,r]) => r.method !== 'teacher');
    const unresolved = entries.filter(([,r]) => !r.name && r.method !== 'unlisted').length;
    matchingBox.append(el('summary', `مطابقة قائمة المجموعة · ${unresolved} اسم يحتاج مراجعة`));
    matchingBox.append(el('p', 'تُحفظ التصحيحات لهذه المجموعة وللاستيرادات القادمة. يمكنك تعديل أي مطابقة. تبقى الجلسات السابقة كما حُفظت.', 'subtitle'));
    const list = el('div', '', 'attendance-match-list');
    entries.forEach(([zoomName, resolution]) => {
      const select = el('select'); select.setAttribute('aria-label', `مطابقة ${zoomName}`);
      select.add(new Option('غير مرتبط بقائمة المجموعة', ''));
      for (const student of ctx.students || []) select.add(new Option(student,student));
      select.value = resolution.name || '';
      select.disabled = busy || ctx.ready === false;
      select.onchange = () => {
        const aliases = {...learned, [AttendanceMatching.compact(zoomName)]:select.value};
        const result = AttendanceModel.calculate(current.rawRecords, 'Gharbi', {students:ctx.students || [], aliases});
        const updated = {...current, ...result, flags:AttendanceModel.migrateFlags(current, result)};
        if (persist(data.map(s => s.id === current.id ? updated : s), aliases)) {
          draw(); matchingBox.open = true; status.textContent = 'تم حفظ المطابقة وإعادة الحساب دون تكرار أوقات الاتصال.';
        } else select.value = resolution.name || '';
      };
      const row = field(zoomName, select);
      if (!resolution.name && resolution.candidates?.length) row.append(el('small', `اقتراحات: ${resolution.candidates.join('، ')}`));
      list.append(row);
    });
    matchingBox.append(list);
  }
  const clock = t => AttendanceModel.displayTime(t);
  const number = n => Number(n.toFixed(2)).toString();
  function renderPreview() {
    const current = data.find(s => s.id === selected);
    if (!current) return;
    const group = ctx.storageId.endsWith('group2') ? 'المجموعة 2' : 'المجموعة 1';
    previewImage.src = AttendanceReport.render(current, group).toDataURL('image/png');
  }
  async function exportReport(share) {
    const current = data.find(s => s.id === selected); if (!current) return;
    const source = previewImage.src;
    try {
      const bytes = Uint8Array.from(atob(source.split(',')[1]), char => char.charCodeAt(0));
      const blob = new Blob([bytes], {type:'image/png'});
      const filename = `presence-${ctx.storageId.endsWith('group2') ? 'groupe2' : 'groupe1'}-${AttendanceModel.displayDate(current.teacher.join)}-${clock(current.teacher.join).replaceAll(':', '-')}.png`;
      const imageFile = new File([blob], filename, {type:'image/png'});
      if (share && navigator.canShare?.({files:[imageFile]})) {
        await navigator.share({files:[imageFile], title:'متابعة الحضور'}); return;
      }
      const url = URL.createObjectURL(blob), link = el('a'); link.href = url; link.download = filename;
      document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
      status.textContent = share ? 'تم تنزيل الصورة الكاملة. يمكنك إرسالها عبر WhatsApp أو أي تطبيق آخر.' : 'تم تصدير الجدول كاملا بجميع الصفوف والأعمدة.';
    } catch (e) { if (e.name !== 'AbortError') status.textContent = 'تعذر تصدير الصورة. أعد المحاولة.'; }
  }
  function draw() {
    if (!data.some(s => s.id === selected)) selected = data[0]?.id || '';
    sessions.replaceChildren(...data.map(s => new Option(`${AttendanceModel.displayDate(s.teacher.join)} · ${clock(s.teacher.join)} · ${s.filename}`, s.id)));
    sessions.value = selected; sessions.disabled = !data.length;
    summary.replaceChildren(); report.replaceChildren();
    const current = data.find(s => s.id === selected);
    drawMatching(current);
    preview.hidden = actions.hidden = editor.hidden = !current;
    if (dialog.open) dialog.close();
    if (!current) { summary.append(el('p', 'لم تُستورد أي جلسة بعد. اختر تقرير Zoom لعرض الحضور.')); return; }
    summary.append(el('strong', `${current.teacher.name} · ${number(current.teacher.minutes)} دقيقة · ${clock(current.teacher.join)} — ${clock(current.teacher.leave)}`), el('p', `${current.participants.length} مشاركا · ${current.participants.filter(p => p.late).length} دخول متأخر · ${current.participants.filter(p => p.low).length} حضور أقل من 70%`));
    if (current.participants.some(p => p.ratio > 1)) summary.append(el('p', 'توجد نسبة تتجاوز 100% بسبب جمع مدد Zoom؛ قد تتداخل اتصالات الاسم نفسه.', 'attendance-note'));
    const table = el('table', '', 'attendance-table'), head = el('thead'), header = el('tr'), body = el('tbody');
    ['الاسم', 'مدة الحضور (دق)', 'نسبة الحضور', 'وقت الدخول', 'وقت الخروج', 'دخول متأخر', 'حضور أقل من 70%', ...manual.map(m => m[1])].forEach(label => { const th = el('th', label); th.scope = 'col'; header.append(th); });
    head.append(header); table.append(head, body);
    const listed = [{...current.teacher, ratio:1, late:false, low:false, isTeacher:true}, ...current.participants];
    listed.forEach(p => {
      const row = el('tr', '', p.isTeacher ? 'attendance-teacher' : ''), name = el('th', p.name, p.late ? 'attendance-late' : ''); name.scope = 'row'; row.append(name);
      [number(p.minutes), `${number(p.ratio * 100)}%`, clock(p.join), clock(p.leave)].forEach(value => row.append(el('td', value)));
      row.append(el('td', p.late ? 'نعم' : '—', p.late ? 'attendance-late' : ''), el('td', p.low ? 'نعم' : '—', p.low ? 'attendance-low' : ''));
      manual.forEach(([id, label]) => {
        if (p.isTeacher) { row.append(el('td', '—')); return; }
        const cell = el('td'), button = el('button', label, `attendance-toggle attendance-${id}`);
        button.type = 'button'; button.setAttribute('aria-pressed', String(Boolean(current.flags[p.key]?.[id]))); button.setAttribute('aria-label', `${p.name}: ${label}`);
        button.onclick = () => {
          const flags = { ...current.flags, [p.key]: { ...current.flags[p.key], [id]: !current.flags[p.key]?.[id] } };
          if (persist(data.map(s => s.id === current.id ? { ...s, flags } : s))) {
            current.flags = flags; button.setAttribute('aria-pressed', String(flags[p.key][id])); status.textContent = 'تم حفظ الاختيار.';
            renderPreview();
          }
        };
        cell.append(button); row.append(cell);
      });
      body.append(row);
    });
    report.append(table);
    renderPreview();
  }
  return { mount };
})();
