/* Professor student management uses the application's conditional roster save. */
window.StudentAdmin=(()=>{
 let ctx,panel,nav,form,search,rows,status,name,email,save,cancel,editing=null,group,busy=false;
 const el=(tag,text,cls)=>{const n=document.createElement(tag);n.textContent=text||'';if(cls)n.className=cls;return n;};
 function reset(){editing=null;form.reset();save.textContent='إضافة الطالب';cancel.hidden=true;email.required=true;email.placeholder='name@example.com';}
 function draw(){
  rows.replaceChildren();const query=RosterModel.normalize(search.value);
  for(const student of ctx.config.students||[]){
   const profiles=StudentAdminModel.accounts(ctx.config,student),addresses=profiles.map(([,p])=>p.email).filter(Boolean);
   if(query&&!RosterModel.normalize(student+' '+addresses.join(' ')).includes(query))continue;
   const card=el('article','','student-admin-row'),info=el('div');info.append(el('strong',student),el('p',addresses.join(' · ')||(profiles.length?'بريد مسجل سابقًا — يمكن استبداله أدناه':'لا يوجد بريد للدخول')));
   const actions=el('div','','button-row'),edit=el('button','تعديل','secondary'),remove=el('button','حذف','secondary');edit.type=remove.type='button';edit.disabled=remove.disabled=busy||!ctx.ready;
   edit.setAttribute('aria-label','تعديل حساب '+student);remove.setAttribute('aria-label','حذف حساب '+student);
   edit.onclick=()=>{editing=student;name.value=student;email.value=addresses[0]||'';email.required=!profiles.length;email.placeholder=profiles.length?'اتركه فارغًا للاحتفاظ بالبريد الحالي':'name@example.com';save.textContent='حفظ التعديل';cancel.hidden=false;name.focus();};
   remove.onclick=async()=>{if(!confirm(`حذف ${student} من هذه المجموعة وإلغاء دخوله إليها؟ سيتم الاحتفاظ بالسجل السابق.`))return;await submit('remove',student,student,undefined);};
   actions.append(edit,remove);card.append(info,actions);rows.append(card);
  }
  if(!rows.children.length)rows.append(el('p','لا يوجد طلاب مطابقون.'));
  for(const input of form.elements)input.disabled=busy||!ctx.ready;
 }
 async function submit(action,oldName,newName,address){
  if(busy)return;busy=true;draw();status.textContent='جار الحفظ...';
  try{const ok=await ctx.edit(action,oldName,newName,address);if(ok){reset();status.textContent=action==='remove'?'تم حذف الطالب وإلغاء دخوله لهذه المجموعة.':'تم حفظ الطالب وبيانات الدخول.';}else status.textContent=ctx.error()||'تعذر الحفظ. أعد المحاولة.';}
  catch(e){status.textContent=e.message;}finally{busy=false;draw();}
 }
 function mount(next){ctx=next;if(!panel){
  panel=el('section','','panel student-admin-panel');panel.hidden=true;panel.append(el('h2','إدارة الطلاب'),el('p','أضف الطلاب وعدّل أسماءهم وبريد الدخول أو احذفهم من المجموعة المحددة.','subtitle'));
  form=el('form','','student-admin-form');name=el('input');name.required=true;name.maxLength=160;name.autocomplete='off';email=el('input');email.type='email';email.dir='ltr';email.autocomplete='off';
  for(const [label,input]of [['اسم الطالب',name],['البريد الإلكتروني للدخول',email]]){const field=el('label','','field');field.append(el('span',label),input);form.append(field);}
  save=el('button','إضافة الطالب','primary');save.type='submit';cancel=el('button','إلغاء التعديل','secondary');cancel.type='button';cancel.onclick=reset;form.append(save,cancel);form.onsubmit=e=>{e.preventDefault();if(form.reportValidity())submit(editing?'rename':'add',editing,name.value,email.value||undefined);};
  search=el('input');search.type='search';search.placeholder='بحث بالاسم أو البريد';search.setAttribute('aria-label','بحث عن طالب');search.oninput=draw;rows=el('div');status=el('p');status.setAttribute('role','status');panel.append(form,status,search,rows);ctx.host.append(panel);
  const navigation=ctx.host.querySelector('.jam-navigation');nav=el('button','إدارة الطلاب','secondary');nav.type='button';nav.setAttribute('aria-pressed','false');
  navigation.addEventListener('click',e=>{if(e.target!==nav){panel.hidden=true;nav.setAttribute('aria-pressed','false');}});
  nav.onclick=()=>{navigation.querySelector('button').click();for(const child of ctx.host.children)if(child!==panel&&!child.contains(navigation))child.hidden=true;panel.hidden=false;for(const button of navigation.children)button.setAttribute('aria-pressed',String(button===nav));};navigation.append(nav);reset();
 }
 if(group!==ctx.groupId){group=ctx.groupId;reset();search.value='';status.textContent='';}draw();
 }
 return {mount};
})();
