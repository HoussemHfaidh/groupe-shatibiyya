/* Shared professor state in Firebase; local DEV trials are never imported. */
window.ProfessorMatrix = (() => {
  let ctx, panel, navButton, picker, content, notice, closeButton, refreshButton, store, sources, selected, generation=0, busy=false, validStorage=true;
  let shareButtons=[], sharing=false, previewDialog, previewImage;
  let liveWatch, pendingLive=false;
  const M=MatrixModel;
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  const key=()=>`shatibiyya-matrix-v1:${ctx.storageId}`;
  function mount(next) {
    if(next.role!=='professor'||!/^group[12]$/.test(next.storageId))return;
    const becameReady=ctx?.ready===false && next.ready!==false;
    const changed=ctx?.storageId!==next.storageId;
    const updated=ctx && (JSON.stringify(ctx.studentAliases)!==JSON.stringify(next.studentAliases) || ctx.day!==next.day || JSON.stringify(ctx.students)!==JSON.stringify(next.students) || JSON.stringify(ctx.recitations)!==JSON.stringify(next.recitations));
    ctx=next;
    if(!panel)build();
    if(changed){liveWatch?.stop();liveWatch=null;previewDialog?.close();generation++;busy=false;sources=null;selected='';store={manual:{},closed:{}};validStorage=true;
      try{store={manual:{},closed:{}};}
      catch{validStorage=false;notice.textContent='تعذر قراءة حالة الطلاب المحفوظة. لم يتم تغييرها.';}
      choices();draw();if(!panel.hidden){refresh();startLive();}
    } else if(updated || becameReady){generation++;busy=false;sources=null;choices();draw();if(!panel.hidden){refresh();startLive();}}
  }
  function build(){
    panel=el('section',undefined,'panel matrix-panel');panel.hidden=true;
    panel.append(el('h2','حالة الطلاب الأسبوعية'),el('p','كل 3 مخالفات صغيرة تضيف نقطة إلى الجدول الثاني. عند بلوغ 3 نقاط: تعليق الختمة للأسبوع التالي وتصفير عداد النقاط.','subtitle'));
    picker=el('select');picker.setAttribute('aria-label','أسبوع حالة الطلاب');picker.onchange=()=>{selected=picker.value;draw();};
    refreshButton=el('button','تحديث البيانات','secondary');refreshButton.onclick=refresh;
    closeButton=el('button','إغلاق الأسبوع وحفظ النتيجة','primary');closeButton.onclick=finalize;
    const controls=el('div',undefined,'matrix-controls');controls.append(picker,refreshButton,closeButton);
    for(const [label,mode] of [['معاينة الصورة','preview'],['تصدير PNG','download'],['مشاركة الجدولين','share']]){
      const button=el('button',label,'secondary');button.type='button';button.onclick=()=>exportTables(mode);controls.append(button);shareButtons.push(button);
    }
    previewDialog=el('dialog',undefined,'matrix-preview');const closePreview=el('button','إغلاق','secondary');closePreview.type='button';closePreview.onclick=()=>previewDialog.close();previewImage=el('img');previewImage.alt='حالة الطلاب — الجدولان كاملان';previewDialog.append(closePreview,previewImage);panel.append(previewDialog);
    notice=el('p');notice.setAttribute('aria-live','polite');content=el('div');
    panel.append(controls,notice,content,el('p','الحالات والتصحيحات محفوظة في Firebase ومتزامنة بين أجهزة الأستاذ لكل مجموعة. للأستاذ تصحيح كل الحالات حتى بعد الإغلاق. تصحيح أسبوع سابق يعيد حساب أرصدة الأسابيع التالية. التعليق هنا حالة للمتابعة ولا يمنع تسجيل الختمة آليا.','matrix-note'));
    const nav=ctx.host.querySelector('.jam-navigation');navButton=el('button','حالة الطلاب','secondary');navButton.type='button';navButton.setAttribute('aria-pressed','false');
    navButton.onclick=()=>{nav.querySelector('button').click();[...ctx.host.children].filter(n=>n!==panel&&!n.contains(nav)).forEach(n=>n.hidden=true);document.querySelectorAll('#exportImageBtn,#resetBtn').forEach(n=>n.hidden=true);panel.hidden=false;[...nav.children].forEach(n=>n.setAttribute('aria-pressed',String(n===navButton)));refresh();startLive();};
    nav.addEventListener('click',e=>{if(e.target!==navButton){liveWatch?.stop();liveWatch=null;panel.hidden=true;navButton.setAttribute('aria-pressed','false');}});
    nav.append(navButton);ctx.host.append(panel);
  }
  function normalizeNames(){
    if(!window.RosterModel || !ctx.studentAliases?.length)return;
    const resolve=name=>RosterModel.resolve(name,ctx.studentAliases);
    for(const field of ['manual','overrides'])for(const [date,records] of Object.entries(store[field]||{}))store[field][date]=Object.fromEntries(Object.entries(records).map(([name,value])=>[resolve(name),value]));
    for(const closed of Object.values(store.closed||{}))for(const row of closed.rows)row.student=resolve(row.student);
    for(const change of store.audit||[])change.student=resolve(change.student);
    store=M.reflow(store);
  }
  function choices(){
    normalizeNames();
    const current=ReviewModel.week(ctx.day);
    const dates=new Set([current.startDate,...Object.keys(store.closed||{}),...ctx.recitations.map(w=>ReviewModel.week(ctx.day,new Date(`${w.date}T12:00:00Z`)).startDate)]);
    picker.replaceChildren();[...dates].filter(d=>d<=current.startDate).sort().reverse().forEach(d=>picker.add(new Option(`${d} ← ${M.addDays(d,7)}${store.closed?.[d]?' · مغلق':''}`,d)));
    if(!dates.has(selected))selected=current.startDate;picker.value=selected;
  }
  function editing(){return panel.contains(document.activeElement)&&document.activeElement.matches('input,select');}
  function startLive(){
    if(liveWatch || !window.LiveData)return;
    liveWatch=LiveData.watch({urls:()=>[ctx.rosterUrl?.(),ctx.matrixUrl?.(),...(!ctx.local?['jam','review','khatma'].map(type=>ctx.sourceUrl(type)):[])],change:()=>{
      if(panel.hidden)return;
      if(editing()){pendingLive=true;return;}
      return refresh(true);
    }});
  }
  document.addEventListener('focusout',()=>{if(pendingLive)setTimeout(()=>{if(!editing()){pendingLive=false;liveWatch?.refresh();}},0);});
  window.addEventListener('storage',event=>{
    if(!ctx || ![key(),`shatibiyya-attendance-v1:${ctx.storageId}`].includes(event.key))return;

    liveWatch?.refresh();
  });
  async function refresh(silent=false){
    silent=silent===true;
    if(busy||ctx.ready===false||!validStorage)return;
    const c=ctx,token=++generation;busy=true;if(!silent){sources=null;draw();notice.textContent='جار تحميل البيانات...';}
    try{
      const values=await Promise.all(['jam','review','khatma',...(c.rosterUrl?['config']:[])].map(async type=>{
        const url=type==='config'?c.rosterUrl():c.local?'':c.sourceUrl(type);const r=await fetch(url||(type==='config'?'/api/config':`/api/${type}/${encodeURIComponent(c.storageId)}`),{cache:'no-store',signal:AbortSignal.timeout(15000)});
        if(!r.ok)throw Error('تعذر تحميل '+type+'؛ لا يمكن حساب النتيجة.');const body=await r.json();const value=url||type==='config'?(body||{}):(body.value||{});return window.Roster?.project(value,c)||value;
      }));
      if(token!==generation)return;
      if(values[3]){
        const config=RosterModel.config(values[3]);c.students=config.students;c.studentAliases=config.studentAliases;c.day=config.settings?.weekBoundaryDay??c.day;
        c.recitations=(config.weeks||[]).map(w=>({...w,statuses:Object.fromEntries(c.students.map(name=>[name,config.statuses?.[`${RosterModel.normalize(name).replace(/\s+/g,'-')}__${w.id}`]||'']))}));
        for(let i=0;i<3;i++)values[i]=RosterModel.project(values[i],c.studentAliases);
      }
      await flushAttendance(c);
      const snapshot=await MatrixStore.read(c.matrixUrl());
      if(token!==generation)return;
      store=snapshot.value;
      const localAttendance=JSON.parse(localStorage.getItem(`shatibiyya-attendance-v1:${c.storageId}`)||'[]');
      const localSessions=Array.isArray(localAttendance)?localAttendance:localAttendance.sessions||[];
      if(!store.attendanceInitialized && localSessions.length){
        store=await MatrixStore.update(c.matrixUrl(),current=>current.attendanceInitialized?current:{...current,attendance:localSessions,attendanceInitialized:true});
      }
      const attendance=store.attendance||[];
      if(token!==generation)return;
      const sessions=(Array.isArray(attendance)?attendance:attendance.sessions||[]).map(session=>({...session,participants:(session.participants||[]).map(p=>({...p,name:window.RosterModel?.resolve(p.name,c.studentAliases)||p.name}))}));
      sources={jam:values[0],review:values[1],khatma:values[2],attendance:sessions,students:[...c.students],recitations:c.recitations};
      choices();if(!silent)notice.textContent='تم تحميل البيانات. اضغط × لإضافة مخالفة أو إلغائها، أو عدّل العدد. زر ↺ يلغي تصحيح الأستاذ ويعيد القيمة التلقائية. الرمز — يعني بيانات ناقصة؛ يمكن للأستاذ استكمالها يدويا.';
    }catch(e){if(token===generation)notice.textContent=e.message;}
    finally{if(token===generation){busy=false;if(silent&&editing())pendingLive=true;else draw();}}
  }
  function week(){return {startDate:selected,endDate:M.addDays(selected,7)};}
  function rows(){const w=week();return ctx.students.map(student=>M.applyOverrides(M.sourceRow(student,w,sources,store.manual?.[selected]?.[student]),store.overrides?.[selected]?.[student],M.previousFor(store,w,student)));}
  async function save(change, message){
    const c=ctx,token=++generation;busy=true;draw();notice.textContent='جار الحفظ في Firebase...';
    try{
      const next=await MatrixStore.update(c.matrixUrl(),change);
      if(ctx.storageId!==c.storageId || token!==generation)return;
      store=next;choices();notice.textContent=message;
    }catch(e){if(ctx.storageId===c.storageId)notice.textContent=e.message;}
    finally{if(ctx.storageId===c.storageId){busy=false;draw();}}
  }
  function correct(student,kind,field,value){
    const date=selected;
    return save(current=>M.correct(current,date,student,kind,field,value),'تم حفظ تصحيح الأستاذ في Firebase وإعادة حساب الأرصدة والحالات اللاحقة.');
  }
  const pendingKey=id=>`shatibiyya-matrix-attendance-pending:${id}`;
  async function flushAttendance(c){
    const raw=localStorage.getItem(pendingKey(c.storageId));if(!raw)return;
    const {changed,removed}=JSON.parse(raw);
    await MatrixStore.update(c.matrixUrl(),current=>{
      const sessions=new Map((current.attendance||[]).map(s=>[s.id,s]));
      for(const id of removed)sessions.delete(id);
      for(const session of changed)sessions.set(session.id,session);
      return {...current,attendance:[...sessions.values()],attendanceInitialized:true};
    });
    if(localStorage.getItem(pendingKey(c.storageId))===raw)localStorage.removeItem(pendingKey(c.storageId));
  }
  window.addEventListener('shatibiyya:attendance-saved',async event=>{
    const {storageId,changed,removed}=event.detail;
    if(!/^group[12]$/.test(storageId)||!ctx?.matrixUrl||(!changed.length&&!removed.length))return;
    const url=new URL(ctx.matrixUrl());url.pathname=storageId==='group1'?'/config/studentStatus.json':'/config/groups/group2/studentStatus.json';
    try{
      const pending=JSON.parse(localStorage.getItem(pendingKey(storageId))||'{"changed":[],"removed":[]}');
      const changes=new Map(pending.changed.map(s=>[s.id,s])),deletions=new Set(pending.removed);
      for(const id of removed){changes.delete(id);deletions.add(id);}
      for(const session of changed){changes.set(session.id,session);deletions.delete(session.id);}
      localStorage.setItem(pendingKey(storageId),JSON.stringify({changed:[...changes.values()],removed:[...deletions]}));
      await flushAttendance({storageId,matrixUrl:()=>url.href});
      if(ctx.storageId===storageId)liveWatch?.refresh();
    }catch(e){notice.textContent=e.message;const status=document.querySelector('.attendance-panel .result-box');if(status)status.textContent='تم الحفظ محليا، لكن تعذرت مزامنة حالة الطلاب. افتح حالة الطلاب لإعادة المحاولة. '+e.message;}
  });
  function editor(cell,row,kind,id,label,value){
    const controls=el('div',undefined,'matrix-cell-controls');
    if(kind!=='previous'){
      const cross=el('button',value>0?'×':'—','matrix-cross');cross.type='button';cross.setAttribute('aria-label',`علامة × ${row.student}: ${label}`);cross.setAttribute('aria-pressed',String(value>0));cross.disabled=busy||!validStorage;
      cross.onclick=()=>correct(row.student,kind,id,value>0?0:1);controls.append(cross);
    }
    const input=el('input');input.type='number';input.min='0';input.step='1';input.value=value??'';input.placeholder='—';input.disabled=busy||!validStorage;input.setAttribute('aria-label',`${row.student}: ${label}`);
    input.onchange=()=>{if(!input.reportValidity()||input.value===''){draw();return;}correct(row.student,kind,id,Number(input.value));};controls.append(input);
    const overridden=Object.hasOwn(row.overrides?.[kind]||{},id);
    if(overridden){cell.classList.add('matrix-corrected');const reset=el('button','↺','matrix-reset');reset.type='button';reset.title='إلغاء التصحيح والعودة للقيمة التلقائية';reset.setAttribute('aria-label',`إلغاء التصحيح ${row.student}: ${label}`);reset.disabled=busy||!validStorage;reset.onclick=()=>correct(row.student,kind,id,null);controls.append(reset);}
    if(value==null)cell.classList.add('matrix-warning');
    cell.append(controls);
  }
  function table(title,columns,data,kind,closed){
    content.append(el('h3',title));const wrap=el('div',undefined,'matrix-scroll'),table=el('table',undefined,'matrix-table');
    const head=el('thead'),tr=el('tr');for(const [,label] of columns)tr.append(el('th',label));head.append(tr);table.append(head);const body=el('tbody');
    for(const row of data){const line=el('tr');for(const [id,label] of columns){
      const cell=el(id==='student'?'th':'td');const result=row.result;
      const prior={...M.previousFor(store,week(),row.student),...row.overrides?.previous};
      const progress=M.smallProgress(row.minor,prior);
      if(id==='student'){cell.textContent=row.student;cell.scope='row';}
      else if(id==='status'){
        const text=el('div',!result?'بيانات ناقصة':!closed?(result.suspended?'مؤقت: تعليق الأسبوع التالي':'مؤقت: متاح'):(result.suspended?'معلق الأسبوع التالي':'متاح الأسبوع التالي'));
        cell.className=!result?'matrix-warning':result.suspended?'matrix-suspended':'matrix-ok';cell.append(text);
        const select=el('select');select.setAttribute('aria-label',`${row.student}: قرار الأستاذ`);
        for(const [value,label] of [['auto','حسب النقاط'],['allow','متاح — قرار الأستاذ'],['suspend','معلق — قرار الأستاذ']])select.add(new Option(label,value));
        select.value=row.overrides?.suspended===true?'suspend':row.overrides?.suspended===false?'allow':'auto';select.disabled=busy||!validStorage;
        select.onchange=()=>correct(row.student,'status','suspended',select.value==='auto'?null:select.value==='suspend');cell.append(select);
      }else if(id==='previous')editor(cell,row,'previous',kind==='minor'?'smallCarry':'largeCarry',kind==='minor'?'الرصيد السابق للمخالفات الصغيرة':'الرصيد السابق للنقاط',prior[kind==='minor'?'smallCarry':'largeCarry']||0);
      else if(!['total','carry'].includes(id))editor(cell,row,kind,id,label,id==='triples'?(row.overrides?.major?.triples??progress?.triples):row[kind][id]);
      else{
        const value=id==='total'?(kind==='minor'?progress?.smallTotal:result?.total):(kind==='minor'?progress?.smallCarry:result?.largeCarry);
        cell.textContent=value??'—';if(value==null)cell.className='matrix-warning';
      }
      line.append(cell);
    }body.append(line);}table.append(body);wrap.append(table);content.append(wrap);
  }
  async function exportTables(mode){
    if(sharing||busy)return;
    const id=ctx.storageId,date=selected,closed=store.closed?.[date],data=closed?M.reflow(store).closed[date].rows:rows();
    const group=document.querySelector('#groupSelect')?.selectedOptions[0]?.textContent || (id.endsWith('2')?'المجموعة 2':'المجموعة 1');
    sharing=true;shareButtons.forEach(button=>button.disabled=true);
    try{
      const canvas=MatrixShare.render({rows:data,week:week(),group,closed:!!closed,previous:student=>M.previousFor(store,week(),student)});
      if(mode==='preview'){previewImage.src=canvas.toDataURL('image/png');previewDialog.showModal();return;}
      const result=await MatrixShare.save(canvas,{share:mode==='share',filename:`student-status-${id}-${date}.png`,title:`حالة الطلاب · ${group} · ${date}`});
      if(ctx.storageId===id && selected===date)notice.textContent=result==='shared'?'تمت مشاركة الجدولين.':'تم تنزيل صورة الجدولين كاملة. يمكنك إرسالها عبر WhatsApp أو أي تطبيق آخر.';
    }catch(error){if(error.name!=='AbortError' && ctx.storageId===id && selected===date)notice.textContent=error.message||'تعذر تصدير الجدولين.';}
    finally{sharing=false;draw();}
  }
  function draw(){
    content.replaceChildren();refreshButton.disabled=busy||ctx.ready===false||!validStorage;
    const closed=store?.closed?.[selected];closeButton.disabled=true;
    shareButtons.forEach(button=>button.disabled=sharing||busy||!selected||(!closed&&!sources));
    if(!selected || (!closed&&!sources))return;
    const data=closed?M.reflow(store).closed[selected].rows:rows();const w=week();
    if(!data.length)shareButtons.forEach(button=>button.disabled=true);
    content.append(el('p',`${closed?'أسبوع مغلق':'معاينة · لم يغلق الأسبوع بعد'} · حالة الختمة للفترة ${w.endDate} ← ${M.addDays(w.endDate,7)}`));
    table('المخالفات الصغيرة',[['student','الاسم'],...M.small,['previous','رصيد سابق'],['total','المجموع'],['carry','الرصيد المتبقي']],data,'minor',!!closed);
    table('تعليق الختمة الفردية',[['student','الاسم'],...M.large,['previous','رصيد سابق'],['total','المجموع'],['carry','الرصيد القادم'],['status','حالة الأسبوع التالي']],data,'major',!!closed);
    const changes=(store.audit||[]).filter(change=>change.weekId===selected);
    if(changes.length){const history=el('details');history.append(el('summary',`سجل تصحيحات الأستاذ · ${changes.length}`));const list=el('ul');for(const change of changes.slice().reverse()){
      const label=[...M.small,...M.large,['smallCarry','الرصيد السابق للمخالفات الصغيرة'],['largeCarry','الرصيد السابق للنقاط'],['suspended','قرار التعليق']].find(([key])=>key===change.field)?.[1]||change.field;
      const display=value=>value==null?'تلقائي':typeof value==='boolean'?(value?'معلق':'متاح'):String(value);
      list.append(el('li',`${change.student} · ${label}: ${display(change.before)} ← ${display(change.value)} · ${new Date(change.at).toLocaleString('ar')}`));
    }history.append(list);content.append(history);}
    closeButton.disabled=!!closed||busy||!validStorage||new Date()<WeeklyClock.at(w.endDate)||data.some(r=>!r.result)||!data.length||Object.keys(store.closed||{}).some(id=>id>selected);
  }
  function finalize(){
    if(closeButton.disabled)return;
    const targetWeek=week(),students=[...ctx.students],snapshotSources=structuredClone(sources);
    return save(current=>{
      const data=students.map(student=>M.applyOverrides(M.sourceRow(student,targetWeek,snapshotSources,current.manual?.[targetWeek.startDate]?.[student]),current.overrides?.[targetWeek.startDate]?.[student],M.previousFor(current,targetWeek,student)));
      return M.close(current,targetWeek,data,new Date(),WeeklyClock.at(targetWeek.endDate));
    },'تم إغلاق الأسبوع وحفظ حالة كل طالب والرصيد القادم في Firebase.');
  }
  return {mount};
})();
