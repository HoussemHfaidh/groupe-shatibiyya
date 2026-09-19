/* Independent revision activity. */
window.Review=(()=>{
 let ctx,key='',data={},epoch=0,busy=false,panel,navButton,heading,list,form,partner,part,result,dialog,duration,errors,studentView=false,selectedDetail="";
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
 const field=(label,input)=>{const n=el('label','','field');n.append(el('span',label),input);return n;};
 function mount(next){ctx=next;if(!panel)build();if(key!==ctx.storageId){key=ctx.storageId;data={};epoch++;draw();}refresh();}
 function build(){
  panel=el('section','','panel review-panel');panel.hidden=true;
  panel.append(el('h2','المراجعة'),el('p','كل طالب يسمع قسما لزميله، والزميل يؤكد ما سمعه. لا يشترط اعتماد الأستاذ.','subtitle'));
  heading=el('h3');list=el('div','','review-list');result=el('div','','result-box');result.setAttribute('aria-live','polite');
  const reload=el('button','تحديث المراجعة','secondary');reload.type='button';reload.onclick=refresh;
  form=el('form','','student-form');partner=el('select');partner.required=true;part=el('select');part.add(new Option('القسم الأول','1'));part.add(new Option('القسم الثاني','2'));partner.onchange=drawPart;
  duration=el('input');duration.type='number';duration.min='0.01';duration.step='0.01';duration.required=true;
  errors=el('input');errors.type='number';errors.min='0';errors.step='1';errors.required=true;
  const submit=el('button','تأكيد مراجعة زميلي','primary');submit.type='submit';
  form.append(field('الطالب الذي قرأ عليّ',partner),field('القسم الذي قرأه',part),field('المدة بالدقائق',duration),field('عدد الأخطاء',errors),submit);
  form.onsubmit=async event=>{event.preventDefault();if(busy||!form.reportValidity())return;const measurement=ReviewModel.metrics({durationMinutes:Number(duration.value),errorCount:Number(errors.value)});const target=partner.value,section=Number(part.value),actor=ctx.name,id=ReviewModel.week(ctx.day).id,token=epoch;
   const finished=await ask(section,target,actor);if(finished===null||token!==epoch)return;
   mutate(store=>({...store,[id]:ReviewModel.confirm(store[id],actor,target,section,finished,new Date(),measurement)}));
  };
  dialog=el('dialog','','review-dialog');dialog.append(el('h3','تأكيد القسم الثاني'),el('p','هل قرأ زميلك من نصف الشاطبية إلى النهاية كاملة؟'));
  panel.append(heading,reload);if(ctx.role==='professor')panel.append(window.TableShare.button(()=>list.querySelector('table'),'متابعة المراجعة'));panel.append(list,form,result);document.body.append(dialog);
  const navigation=ctx.role==='professor'?ctx.host.querySelector('.jam-professor-navigation .jam-navigation'):ctx.host.querySelector('.jam-navigation');
  navButton=el('button','المراجعة','secondary');navButton.type='button';navButton.setAttribute('aria-pressed','false');
  navigation.addEventListener('click',event=>{if(event.target!==navButton){panel.hidden=true;navButton.setAttribute('aria-pressed','false');}});
  navButton.onclick=()=>{
   navigation.querySelector('button').click();
   [...ctx.host.children].filter(n=>n!==panel&&!n.contains(navigation)&&!n.matches('.account-box,.eyebrow')).forEach(n=>n.hidden=true);
   if(ctx.role==='professor')document.querySelectorAll('#exportImageBtn,#resetBtn').forEach(n=>n.hidden=true);
   panel.hidden=false;navButton.setAttribute('aria-pressed','true');
   [...navigation.children].filter(n=>n!==navButton).forEach(n=>n.setAttribute('aria-pressed','false'));refresh();
  };
  navigation.append(navButton);ctx.host.append(panel);
 }
 function popup(title,message,choices,measurements){return new Promise(resolve=>{
  if(dialog.open){resolve(null);return;}
  dialog.remove();dialog=el('dialog','','review-dialog');dialog.append(el('h3'),el('p'));document.body.append(dialog);
  dialog.querySelector('h3').textContent=title;dialog.querySelector('p').textContent=message;
  dialog.querySelectorAll('.review-measurements').forEach(n=>n.remove());
  let metricForm;
  if(measurements){metricForm=el('form','','review-measurements');for(const [label,key,min,step] of [['المدة بالدقائق','durationMinutes','0.01','0.01'],['عدد الأخطاء','errorCount','0','1']]){const input=el('input');input.type='number';input.name=key;input.min=min;input.step=step;input.required=true;input.value=measurements[key]??'';metricForm.append(field(label,input));}dialog.append(metricForm);}
  dialog.querySelectorAll('button').forEach(n=>n.remove());let resolved=false;
  const done=value=>{if(resolved)return;resolved=true;dialog.close();resolve(value);};
  for(const [label,value] of choices){const b=el('button',label,'secondary');b.type='button';b.onclick=()=>{if(value!==null&&metricForm){if(!metricForm.reportValidity())return;done(ReviewModel.metrics({durationMinutes:Number(metricForm.elements.durationMinutes.value),errorCount:Number(metricForm.elements.errorCount.value)}));}else done(value);};dialog.append(b);}
  dialog.oncancel=event=>{event.preventDefault();done(null);};dialog.onclose=()=>{if(!resolved){resolved=true;resolve(null);}};dialog.showModal();
 });}
 function ask(section,target,actor){return popup(section===1?'تأكيد القسم الأول':'تأكيد القسم الثاني',`${target} ← قرأ على ${actor}. `+(section===1?'هل قرأ القسم الأول كاملا من البداية إلى النصف؟':'هل قرأ من نصف الشاطبية إلى النهاية كاملة؟'),[['نعم، إلى النهاية',true],['لا، غير مكتمل',false],['إلغاء',null]]);}
 function remote(c){return c.local?'':c.firebaseUrl();}
 async function read(c){await c.prepare?.();const url=remote(c)||`/api/review/${c.storageId}`;const r=await fetch(url,{headers:remote(c)?{'X-Firebase-ETag':'true'}:{},cache:'no-store'});if(!r.ok)throw Error('تعذر تحميل المراجعة. تحقق من الاتصال وصلاحيات Firebase.');return remote(c)?{value:await r.json()||{},etag:r.headers.get('etag')}:r.json();}
 async function refresh(){if(!ctx||busy||ctx.ready===false)return;const c=ctx,token=epoch;try{const s=await read(c);if(token!==epoch||busy)return;data=s.value;draw();result.textContent='';if(ReviewModel.ensure(data,c.students,c.day)!==data)await mutate(store=>ReviewModel.ensure(store,c.students,c.day));}catch(e){if(token===epoch)result.textContent=e.message;}}
 async function mutate(change){if(busy||!ctx||ctx.ready===false)return;const c=ctx,token=epoch;busy=true;draw();result.textContent='جار الحفظ...';try{const s=await read(c);if(token!==epoch)throw Error('تغير الحساب أو المجموعة.');const value=change(s.value);const url=remote(c);if(url&&!s.etag)throw Error('تعذر تأمين الحفظ.');const r=await fetch(url||`/api/review/${c.storageId}`,{method:'PUT',headers:{'Content-Type':'application/json',...(url?{'if-match':s.etag}:{})},body:JSON.stringify(url?value:{value,revision:s.revision})});if([409,412].includes(r.status))throw Error('تم تحديث المراجعة عند زميلك. حدّث القائمة وأعد المحاولة.');if(!r.ok)throw Error('تعذر حفظ المراجعة.');if(token===epoch){data=value;result.textContent='تم تسجيل المراجعة.';}}catch(e){if(token===epoch)result.textContent=e.message;}finally{busy=false;draw();}}
 function current(){return data[ReviewModel.week(ctx.day).id];}
 function drawPart(){if(!ctx)return;const assigned=current()?.assigned?.[partner.value];part.disabled=busy||!partner.value||!!assigned;if(assigned)part.value=String(assigned);}
 async function editProfessor(id,name){
  const token=epoch;
  const value=await popup('تعديل المراجعة',`${name} · ${id}`,[['القسم الأول — برتقالي',1],['القسم الثاني مكتمل — أخضر',2],['القسم الأول غير مكتمل — أصفر',5],['القسم الثاني غير مكتمل — أصفر',3],['غياب — أحمر',4],['مسح النتيجة',0],['إلغاء',null]]);
  if(value===null||token!==epoch)return;
  let measurement;
  if([1,2,3,5].includes(value)){measurement=await popup('تفاصيل المراجعة',name,[['حفظ',true],['إلغاء',null]],ReviewModel.recordFor(data[id],name)||{});if(!measurement||token!==epoch)return;}
  mutate(store=>{const next=structuredClone(store),week=next[id];if(!week?.students?.includes(name))throw Error('الطالب غير موجود في هذا الأسبوع.');
   week.records=(week.records||[]).filter(r=>r.student!==name);week.missed=(week.missed||[]).filter(n=>n!==name);
   if(value===4)week.missed.push(name);
   else if(value)week.records.push({...measurement,student:name,part:[1,5].includes(value)?1:2,complete:![3,5].includes(value),participated:true,validator:'professor',createdAt:new Date().toISOString()});
   return next;
  });
 }
 function professorTable(currentWeek){
  const weeks=[currentWeek,...Object.values(data).filter(w=>w.id!==currentWeek.id)].sort((a,b)=>b.id.localeCompare(a.id));
  const names=[...new Set([...ctx.students,...weeks.flatMap(w=>w.students||[])])];
  const table=el('table','','review-table review-professor-table');
  table.append(el('caption','متابعة المراجعة الأسبوعية'));
  const percent=(n,total)=>total?`${Math.round(n*100/total)}%`:'—';
  const stats=name=>weeks.reduce((sum,w)=>{
   if(!(w.students||[]).includes(name))return sum;
   const record=ReviewModel.recordFor(w,name);
   if(record){sum.done++;sum.total++;}else if(!ReviewModel.active(w)||w.missed?.includes(name))sum.total++;
   return sum;
  },{done:0,total:0});
  const thead=el('thead'),rate=el('tr'),head=el('tr');
  const empty=el('th');empty.colSpan=4;empty.textContent='نسبة المشاركة الأسبوعية';rate.append(empty);
  for(const w of weeks)rate.append(el('th',percent((w.students||[]).filter(n=>ReviewModel.recordFor(w,n)).length,(w.students||[]).length)));
  ['#','الاسم','نسبة المراجعة','نسبة عدم المراجعة',...weeks.map(w=>w.startDate.split('-').reverse().join('/'))].forEach(t=>{const th=el('th',t);th.scope='col';head.append(th);});
  thead.append(rate,head);table.append(thead);const body=el('tbody');let allDone=0,allTotal=0;
  names.forEach((name,index)=>{
   const row=el('tr'),stat=stats(name);allDone+=stat.done;allTotal+=stat.total;
   const label=el('th',name);label.scope='row';row.append(el('td',String(index+1)),label,el('td',percent(stat.done,stat.total)),el('td',percent(stat.total-stat.done,stat.total)));
   for(const w of weeks){const r=ReviewModel.recordFor(w,name),enrolled=(w.students||[]).includes(name);let color='',title='لم يشارك بعد';
    if(!enrolled)title='غير مسجل في هذا الأسبوع';
    else if(r){color=!r.complete?'review-yellow':r.part===1?'review-orange':'review-green';title=!r.complete?`القسم ${r.part===1?'الأول':'الثاني'} غير مكتمل`:r.part===1?'القسم الأول':'القسم الثاني مكتمل';}
    else if(!ReviewModel.active(w)||w.missed?.includes(name)){color='review-red';title='لم يشارك';}
    const cell=el('td',r?'X':'—',color);if(enrolled){const button=el('button',r?'X':'—','review-cell-button');button.type='button';button.setAttribute('aria-label',`${name} · ${w.startDate} · ${title} · تعديل`);button.onclick=()=>editProfessor(w.id,name);cell.replaceChildren(button);}cell.title=title;cell.setAttribute('aria-label',`${name}: ${title}`);row.append(cell);
   }body.append(row);
  });table.append(body);
  const foot=el('tfoot'),total=el('tr'),label=el('th','المجموعة');label.colSpan=2;total.append(label,el('td',percent(allDone,allTotal)),el('td',percent(allTotal-allDone,allTotal)));for(const w of weeks)total.append(el('td',''));foot.append(total);table.append(foot);
  const legend=el('p','X برتقالي: القسم الأول · X أخضر: القسم الثاني مكتمل · X أصفر: غير مكتمل · أحمر: غياب عند الإغلاق','review-legend');
  list.append(table,legend,el('p','تحتسب المشاركة غير المكتملة ضمن المشاركات. لا يدخل الانتظار في نسبة الغياب قبل إغلاق الأسبوع.','subtitle'));
 }
 function draw(){if(!ctx||!panel)return;const w=current()||ReviewModel.ensure({},ctx.students,ctx.day)[ReviewModel.week(ctx.day).id];heading.textContent=`مراجعة الأسبوع · ${w.startDate}`;list.replaceChildren();
  function tableFor(week){
   const table=el('table','','review-table'),head=el('tr');['الطالب','التوفر','النتيجة'].forEach(t=>head.append(el('th',t)));table.append(head);
   for(const name of week.students){const record=ReviewModel.recordFor(week,name),ended=!ReviewModel.active(week);const row=el('tr');row.append(el('th',name),el('td',record?'تمت المشاركة':ended?'انتهى الأسبوع':'متاح',record||ended?'review-red':'review-green'));
    row.append(el('td',record?record.complete?`X · القسم ${record.part===1?'الأول':'الثاني'}`:`X · القسم ${record.part===1?'الأول':'الثاني'} غير مكتمل`:ended?'لم يشارك':'—',record?record.complete?record.part===1?'review-orange':'review-green':'review-blue':ended?'review-red':''));table.append(row);}
   return table;
  }
  if(ctx.role==='professor'){
   const toggle=el('button',studentView?'عرض الجدول':'عرض حسب الطالب','secondary');toggle.type='button';toggle.onclick=()=>{studentView=!studentView;draw();};list.append(toggle);
   if(studentView){
    const selector=el('select');selector.setAttribute('aria-label','تفاصيل الطالب');
    const names=[...new Set([...ctx.students,...Object.values(data).flatMap(x=>x.students||[])])];const recordsFor=n=>Object.values(data).flatMap(w=>(w.records||[]).filter(r=>r.student===n));
    names.forEach(n=>selector.add(new Option(`${n} · ${recordsFor(n).length} مراجعات`,n)));
    if(!names.includes(selectedDetail))selectedDetail=names.find(n=>recordsFor(n).some(r=>r.durationMinutes!=null))||names.find(n=>recordsFor(n).length)||names[0]||'';
    selector.value=selectedDetail;selectedDetail=selector.value;selector.onchange=()=>{selectedDetail=selector.value;draw();};list.append(selector);
    const table=el('table','','review-table review-details'),head=el('tr');['الأسبوع','القسم','المدة بالدقائق','عدد الأخطاء','النتيجة'].forEach(t=>head.append(el('th',t)));table.append(head);
    let count=0;for(const week of Object.values(data).sort((a,b)=>b.id.localeCompare(a.id))){const r=ReviewModel.recordFor(week,selectedDetail);if(!r)continue;count++;const row=el('tr');[week.startDate,r.part===1?'الأول':'الثاني',r.durationMinutes??'غير مسجل',r.errorCount??'غير مسجل',r.complete?'مكتمل':'غير مكتمل'].forEach(t=>row.append(el('td',String(t))));table.append(row);}list.append(table);if(!count)list.append(el('p','لا توجد مراجعات مسجلة لهذا الطالب.'));
   }else professorTable(w);
  }else list.append(tableFor(w));
  const selected=partner.value;partner.replaceChildren();
  const choices=w.students.filter(n=>n!==ctx.name&&!ReviewModel.recordFor(w,n));
  choices.forEach(n=>partner.add(new Option(n,n)));if(choices.includes(selected))partner.value=selected;
  form.hidden=ctx.role==='professor';
  [...form.elements].forEach(n=>n.disabled=busy||!choices.length||!w.students.includes(ctx.name));drawPart();
  if(!choices.length&&ctx.role==='student')result.textContent='لا يوجد زميل متاح حاليا.';
 }
 setInterval(()=>{if(ctx){draw();refresh();}},30000);window.addEventListener('focus',refresh);
 return {mount,popup,logout(){epoch++;ctx=null;key='';data={};dialog?.close();if(panel)panel.hidden=true;}};
})();
