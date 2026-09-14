/* DEV-only revision; never imported by production entry points. */
window.Review=(()=>{
 let ctx,key='',data={},epoch=0,busy=false,panel,navButton,heading,list,form,partner,part,result,dialog;
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
 const field=(label,input)=>{const n=el('label','','field');n.append(el('span',label),input);return n;};
 function mount(next){ctx=next;if(!panel)build();if(key!==ctx.storageId){key=ctx.storageId;data={};epoch++;draw();}refresh();}
 function build(){
  panel=el('section','','panel review-panel');panel.hidden=true;
  panel.append(el('h2','المراجعة'),el('p','كل طالب يسمع قسما لزميله، والزميل يؤكد ما سمعه. لا يشترط اعتماد الأستاذ.','subtitle'));
  heading=el('h3');list=el('div','','review-list');result=el('div','','result-box');result.setAttribute('aria-live','polite');
  const reload=el('button','تحديث المراجعة','secondary');reload.type='button';reload.onclick=refresh;
  form=el('form','','student-form');partner=el('select');partner.required=true;part=el('select');part.add(new Option('القسم الأول','1'));part.add(new Option('القسم الثاني','2'));partner.onchange=drawPart;
  const submit=el('button','تأكيد مراجعة زميلي','primary');submit.type='submit';
  form.append(field('الطالب الذي قرأ عليّ',partner),field('القسم الذي قرأه',part),submit);
  form.onsubmit=async event=>{event.preventDefault();if(busy)return;const target=partner.value,section=Number(part.value),actor=ctx.name,id=ReviewModel.week(ctx.day).id,token=epoch;
   let finished=true;if(section===2){finished=await ask();if(finished===null||token!==epoch)return;}
   mutate(store=>({...store,[id]:ReviewModel.confirm(store[id],actor,target,section,finished)}));
  };
  dialog=el('dialog','','review-dialog');dialog.append(el('h3','تأكيد القسم الثاني'),el('p','هل قرأ زميلك من نصف الشاطبية إلى النهاية كاملة؟'));
  panel.append(heading,reload,list,form,result,dialog);
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
 function ask(){return new Promise(resolve=>{
  dialog.querySelectorAll('button').forEach(n=>n.remove());let resolved=false;
  const done=value=>{if(resolved)return;resolved=true;dialog.close();resolve(value);};
  for(const [label,value] of [['نعم، إلى النهاية',true],['لا، غير مكتمل',false],['إلغاء',null]]){const b=el('button',label,'secondary');b.type='button';b.onclick=()=>done(value);dialog.append(b);}
  dialog.oncancel=event=>{event.preventDefault();done(null);};dialog.onclose=()=>{if(!resolved){resolved=true;resolve(null);}};dialog.showModal();
 });}
 function remote(c){return c.local?'':c.firebaseUrl();}
 async function read(c){await c.prepare?.();const url=remote(c)||`/api/review/${c.storageId}`;const r=await fetch(url,{headers:remote(c)?{'X-Firebase-ETag':'true'}:{},cache:'no-store'});if(!r.ok)throw Error('تعذر تحميل المراجعة. تحقق من اتصال DEV وصلاحيات Firebase.');return remote(c)?{value:await r.json()||{},etag:r.headers.get('etag')}:r.json();}
 async function refresh(){if(!ctx||busy||ctx.ready===false)return;const c=ctx,token=epoch;try{const s=await read(c);if(token!==epoch||busy)return;data=s.value;draw();result.textContent='';if(ReviewModel.ensure(data,c.students,c.day)!==data)await mutate(store=>ReviewModel.ensure(store,c.students,c.day));}catch(e){if(token===epoch)result.textContent=e.message;}}
 async function mutate(change){if(busy||!ctx||ctx.ready===false)return;const c=ctx,token=epoch;busy=true;draw();result.textContent='جار الحفظ...';try{const s=await read(c);if(token!==epoch)throw Error('تغير الحساب أو المجموعة.');const value=change(s.value);const url=remote(c);if(url&&!s.etag)throw Error('تعذر تأمين الحفظ.');const r=await fetch(url||`/api/review/${c.storageId}`,{method:'PUT',headers:{'Content-Type':'application/json',...(url?{'if-match':s.etag}:{})},body:JSON.stringify(url?value:{value,revision:s.revision})});if([409,412].includes(r.status))throw Error('تم تحديث المراجعة عند زميلك. حدّث القائمة وأعد المحاولة.');if(!r.ok)throw Error('تعذر حفظ المراجعة.');if(token===epoch){data=value;result.textContent='تم تسجيل المراجعة.';}}catch(e){if(token===epoch)result.textContent=e.message;}finally{busy=false;draw();}}
 function current(){return data[ReviewModel.week(ctx.day).id];}
 function drawPart(){if(!ctx)return;const assigned=current()?.assigned?.[partner.value];part.disabled=busy||!partner.value||!!assigned;if(assigned)part.value=String(assigned);}
 function draw(){if(!ctx||!panel)return;const w=current()||ReviewModel.ensure({},ctx.students,ctx.day)[ReviewModel.week(ctx.day).id];heading.textContent=`مراجعة الأسبوع · ${w.startDate}`;list.replaceChildren();
  function tableFor(week){
   const table=el('table','','review-table'),head=el('tr');['الطالب','التوفر','النتيجة'].forEach(t=>head.append(el('th',t)));table.append(head);
   for(const name of week.students){const record=ReviewModel.recordFor(week,name),ended=!ReviewModel.active(week);const row=el('tr');row.append(el('th',name),el('td',record?'تمت المشاركة':ended?'انتهى الأسبوع':'متاح',record||ended?'review-red':'review-green'));
    row.append(el('td',record?record.complete?`X · القسم ${record.part===1?'الأول':'الثاني'}`:'X · القسم الثاني غير مكتمل':ended?'لم يشارك':'—',record?record.complete?record.part===1?'review-orange':'review-green':'review-blue':ended?'review-red':''));table.append(row);}
   return table;
  }
  list.append(tableFor(w));
  if(ctx.role==='professor')for(const old of Object.values(data).filter(x=>x.id!==w.id).sort((a,b)=>b.id.localeCompare(a.id))){const details=el('details');details.append(el('summary',`الأرشيف · ${old.startDate}`),tableFor(old));list.append(details);}
  const selected=partner.value;partner.replaceChildren();
  const choices=w.students.filter(n=>n!==ctx.name&&!ReviewModel.recordFor(w,n));
  choices.forEach(n=>partner.add(new Option(n,n)));if(choices.includes(selected))partner.value=selected;
  form.hidden=ctx.role==='professor';
  [...form.elements].forEach(n=>n.disabled=busy||!choices.length||!w.students.includes(ctx.name));drawPart();
  if(!choices.length&&ctx.role==='student')result.textContent='لا يوجد زميل متاح حاليا.';
 }
 setInterval(()=>{if(ctx){draw();refresh();}},30000);window.addEventListener('focus',refresh);
 return {mount,logout(){epoch++;ctx=null;key='';data={};dialog?.close();if(panel)panel.hidden=true;}};
})();
