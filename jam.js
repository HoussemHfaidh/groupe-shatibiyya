/* Separate storage keeps واجب الجمع independent from weekly recitation. */
window.Jam = (() => {
  let context, key = "", data = {}, selected = "", busy = false, generation = 0;
  let panel, heading, weekNotice, list, verses, form, studentSelect, verseSelect, result, report;
  const el = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  function field(label, input) {
    const wrapper = el("label", "", "field");
    wrapper.append(el("span", label), input);
    return wrapper;
  }
  function mount(ctx) {
    context = ctx;
    if (!panel) build();
    const nextKey = ctx.storageId;
    if (key !== nextKey) {
      key = nextKey; data = {}; selected = ""; generation++;
      draw();
    }
    refresh();
  }
  function build() {
    panel = el("section", "", "panel jam-panel");
    panel.append(el("h2", "واجب الجمع"), el("p", "الطلاب بالأحمر حتى الاعتماد، والآيات بالأخضر حتى استعمالها. أول طالب يسمع للأستاذ، ثم يؤكد الطالب المعتمد زميله وآيته.", "subtitle"));
    heading = el("h3");
    weekNotice = el("p", "", "subtitle");
    list = el("div", "", "validator-list"); verses = el("div", "", "validator-list");
    const columns = el("div", "", "jam-columns");
    report = el("div", "", "table-scroll");
    if (context.role === "professor") panel.append(report);
    const studentsColumn = el("div"), versesColumn = el("div");
    studentsColumn.hidden = context.role === "professor";
    studentsColumn.append(el("h3", "الطلاب"), list); versesColumn.append(el("h3", "الآيات"), verses); columns.append(studentsColumn, versesColumn);
    form = el("form", "", "student-form");
    studentSelect = el("select"); studentSelect.required = true;
    verseSelect = el("select"); verseSelect.required = true;
    const submit = el("button", "تأكيد الطالب والآية", "primary"); submit.type = "submit";
    form.append(field("الطالب الذي سمّع عندي", studentSelect), field("الآية التي سمّعها", verseSelect), submit);
    form.addEventListener("submit", event => {
      event.preventDefault();
      const id = selected, student = studentSelect.value, verse = Number(verseSelect.value);
      const actor = { role: context.role, name: context.name };
      mutate(store => {
        if (JamModel.current(store, context.schedule)?.id !== id) throw new Error("انتهى وقت هذا الواجب. حدّث القائمة.");
        return { ...store, [id]: JamModel.confirm(store[id], student, verse, actor) };
      });
    });
    result = el("div", "", "result-box"); result.setAttribute("aria-live", "polite");
    const reload = el("button", "تحديث القائمة", "secondary");
    reload.type = "button";
    reload.addEventListener("click", refresh);
    panel.append(heading, weekNotice);
    if (context.role === "professor") panel.append(report);
    panel.append(reload, columns, form, result);
    if (window.SHATIBIYYA_JAM_LOCAL_DEV) panel.prepend(el("p", "بيانات واجب الجمع: DEV محلي", "eyebrow"));
    if (context.role === "student") {
      panel.hidden = true;
      const nav = el("div", "", "button-row jam-navigation");
      const recitation = el("button", "التسميع", "secondary"), jam = el("button", "واجب الجمع", "secondary");
      recitation.type = jam.type = "button";
      const original = [...context.host.children].filter(node => !node.matches(".account-box, .eyebrow"));
      function activate(showJam) {
        original.forEach(node => { node.hidden = showJam; });
        panel.hidden = !showJam;
        jam.setAttribute("aria-pressed", String(showJam));
        recitation.setAttribute("aria-pressed", String(!showJam));
        if (showJam) refresh();
      }
      recitation.addEventListener("click", () => activate(false)); jam.addEventListener("click", () => activate(true));
      nav.append(recitation, jam); context.host.querySelector(".account-box").after(nav);
      activate(false);
    }
    if (context.role === "professor") {
      context.host.classList.add("has-jam-navigation");
      panel.classList.add("jam-professor");
      panel.hidden = true;
      const nav = el("section", "", "panel jam-professor-navigation");
      const groupField = document.querySelector("#groupSelect").closest("label");
      const buttons = el("div", "", "button-row jam-navigation");
      const recitation = el("button", "التسميع", "secondary");
      const jam = el("button", "واجب الجمع", "secondary");
      const original = [...context.host.children];
      const headerActions = [...document.querySelectorAll("#exportImageBtn, #resetBtn")];
      function activate(showJam) {
        original.forEach(node => { node.hidden = showJam; });
        headerActions.forEach(node => { node.hidden = showJam; });
        panel.hidden = !showJam;
        jam.setAttribute("aria-pressed", String(showJam));
        recitation.setAttribute("aria-pressed", String(!showJam));
        if (showJam) refresh();
      }
      recitation.type = jam.type = "button";
      recitation.addEventListener("click", () => activate(false));
      jam.addEventListener("click", () => activate(true));
      buttons.append(recitation, jam); nav.append(groupField, buttons);
      context.host.prepend(nav);
      activate(false);
    }
    context.host.append(panel);
  }
  function backendUrl(ctx) {
    return window.SHATIBIYYA_JAM_LOCAL_DEV ? "" : ctx.firebaseUrl();
  }
  async function read(ctx) {
    if (backendUrl(ctx)) {
      await ctx.prepare?.();
      const response = await fetch(backendUrl(ctx), { headers: { "X-Firebase-ETag": "true" }, cache: "no-store" });
      if (!response.ok) throw new Error("تعذر تحميل واجب الجمع.");
      return { value: await response.json() || {}, etag: response.headers.get("ETag") };
    }
    const response = await fetch(`/api/jam/${encodeURIComponent(ctx.storageId)}`, { cache: "no-store" });
    if (!response.ok) throw new Error("تعذر تحميل واجب الجمع.");
    return response.json();
  }
  async function refresh() {
    if (busy || !context || context.ready === false) return;
    const epoch = generation, ctx = context;
    try {
      const snapshot = await read(ctx);
      if (epoch !== generation || busy) return;
      data = snapshot.value; draw(); result.textContent = "";
      if (JamModel.ensureWeek(data, ctx.students, ctx.schedule) !== data) {
        await mutate(store => JamModel.ensureWeek(store, ctx.students, ctx.schedule));
      }
    } catch (error) { if (epoch === generation) result.textContent = error.message; }
  }
  async function mutate(change, newSelection) {
    if (busy || context?.ready === false) return false;
    busy = true; draw();
    const epoch = generation, ctx = context;
    result.textContent = "جار الحفظ...";
    try {
      const snapshot = await read(ctx);
      if (epoch !== generation) throw new Error("تغيرت المجموعة. أعد المحاولة.");
      await ctx.prepare?.();
      const value = change(snapshot.value);
      const remote = backendUrl(ctx);
      if (remote && !snapshot.etag) throw new Error("تعذر تأمين الحفظ. أعد المحاولة.");
      const response = await fetch(remote || `/api/jam/${encodeURIComponent(ctx.storageId)}`, {
        method: "PUT", headers: { "Content-Type": "application/json", ...(remote ? { "if-match": snapshot.etag } : {}) },
        body: JSON.stringify(remote ? value : { value, revision: snapshot.revision }),
      });
      if (response.status === 412 || response.status === 409) throw new Error("تغيرت القائمة عند مستخدم آخر. حدّث القائمة ثم أعد المحاولة.");
      if (!response.ok) throw new Error("تعذر الحفظ. حاول من جديد.");
      if (epoch === generation) { data = value; if (newSelection) selected = newSelection; result.textContent = "تم الحفظ."; }
      return true;
    } catch (error) {
      if (epoch === generation) result.textContent = error.message;
      return false;
    } finally { busy = false; draw(); }
  }
  function draw() {
    if (!panel || !context) return;
    const oldStudent = studentSelect.value, oldVerse = verseSelect.value;
    const assignment = JamModel.current(data, context.schedule)
      || JamModel.current(JamModel.ensureWeek({}, context.students, context.schedule), context.schedule);
    const week = JamModel.weeklyWindow(context.schedule);
    selected = assignment?.id || "";
    heading.textContent = week ? `واجب الجمع ${week.number}` : assignment?.title || "واجب هذا الأسبوع";
    weekNotice.textContent = context.role === "professor"
      ? "اعتمد الطالب واختر الآية التي سمّعها. تبقى الواجبات السابقة محفوظة في الجدول."
      : !assignment?.verses?.length
      ? "في انتظار قائمة الآيات من الأستاذ لهذا الأسبوع."
      : "هذا واجب الأسبوع الحالي فقط. لا يوجد استدراك في واجب الجمع.";
    list.replaceChildren(); verses.replaceChildren(); studentSelect.replaceChildren(); verseSelect.replaceChildren();
    const confirmations = assignment?.confirmations || [];
    (assignment?.students || context.students).forEach(name => {
      const done = confirmations.find(c => c.student === name);
      list.append(el("div", `${name} — ${done ? `معتمد · ${done.validator}` : "غير معتمد"}`, `validator-option ${done ? "available" : "unavailable"}`));
      if (!done && name !== context.name) studentSelect.add(new Option(name, name));
    });
    assignment?.verses.forEach((verse, index) => {
      const used = confirmations.find(c => c.verseIndex === index);
      verses.append(el("div", `${verse} — ${used ? `مستعملة · ${used.student}` : "متاحة"}`, `validator-option ${used ? "unavailable" : "available"}`));
      if (!used) verseSelect.add(new Option(verse, String(index)));
    });
    if ([...studentSelect.options].some(o => o.value === oldStudent)) studentSelect.value = oldStudent;
    if ([...verseSelect.options].some(o => o.value === oldVerse)) verseSelect.value = oldVerse;
    if (context.role === "professor") drawReport(assignment);
    const allowed = (context.role === "professor" || confirmations.some(c => c.student === context.name)) && context.ready !== false;
    form.hidden = !assignment;
    [...form.elements].forEach(control => { control.disabled = busy || !allowed || !studentSelect.options.length || !verseSelect.options.length; });


  }
  function drawReport(currentAssignment) {
    report.replaceChildren();
    const assignments = Object.values({ ...data, ...(currentAssignment ? { [currentAssignment.id]: currentAssignment } : {}) })
      .filter(item => item.startDate && item.startDate <= (currentAssignment?.startDate || "9999"))
      .sort((a, b) => b.startDate.localeCompare(a.startDate));
    const table = el("table", "", "tracking-table jam-tracking-table");
    table.append(el("caption", "متابعة واجب الجمع"));
    const head = el("thead"), row = el("tr");
    ["#", "الاسم", "نسبة الإنجاز", ...assignments.map(a => `${a.number} · ${a.startDate}`)].forEach(label => {
      const cell = el("th", label); cell.scope = "col"; row.append(cell);
    });
    head.append(row); table.append(head);
    const names = [...new Set([...context.students, ...assignments.flatMap(a => a.students)])];
    const body = el("tbody");
    names.forEach((name, index) => {
      const row = el("tr");
      const applicable = assignments.filter(a => a.students.includes(name));
      const done = applicable.filter(a => (a.confirmations || []).some(c => c.student === name)).length;
      row.append(el("td", String(index + 1)));
      const label = el("th", name); label.scope = "row"; row.append(label);
      row.append(el("td", applicable.length ? `${Math.round(done / applicable.length * 100)}%` : "—"));
      assignments.forEach(a => {
        const confirmed = (a.confirmations || []).find(c => c.student === name);
        const included = a.students.includes(name);
        const cell = el("td", !included ? "—" : confirmed ? `تم · ${a.verses[confirmed.verseIndex]}` : "لم يتم", included ? confirmed ? "jam-done" : "jam-missed" : "");
        if (confirmed) cell.title = `اعتمد: ${confirmed.validator}`;
        row.append(cell);
      });
      body.append(row);
    });
    table.append(body);
    const foot = el("tfoot"), totals = el("tr");
    const label = el("th", "نسبة إنجاز المجموعة"); label.colSpan = 3; totals.append(label);
    assignments.forEach(a => totals.append(el("td", `${Math.round((a.confirmations || []).length / (a.students.length || 1) * 100)}%`)));
    foot.append(totals); table.append(foot); report.append(table);
  }
  setInterval(() => {
    draw(); // Expire the visible week even if the network is unavailable.
    refresh();
  }, 1000 * 30);
  window.addEventListener("focus", refresh);
  return { mount, logout() { generation++; context = null; key = ""; data = {}; selected = ""; } };
})();
