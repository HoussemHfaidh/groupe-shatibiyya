(function(root){
 const clock=typeof module!=='undefined'?require('./weekly-clock'):root.WeeklyClock;
 function week(day,now=new Date()){
  const p=clock.parts(now),today=`${p.year}-${p.month}-${p.day}`;
  let start=new Date(`${today}T00:00:00Z`);
  if(Number(p.hour)<6)start.setUTCDate(start.getUTCDate()-1);
  start.setUTCDate(start.getUTCDate()-(start.getUTCDay()-day+7)%7);
  const date=start.toISOString().slice(0,10);start.setUTCDate(start.getUTCDate()+7);
  return {id:date,startDate:date,endDate:start.toISOString().slice(0,10)};
 }
 function active(w,now=new Date()){return !!w && now>=clock.at(w.startDate)&&now<clock.at(w.endDate);}
 function ensure(store,students,day,now=new Date()){
  const w=week(day,now);if(store[w.id])return store;
  const previous=Object.values(store).find(x=>x.endDate===w.startDate);
  const assigned={};
  for(const name of students){const prior=previous?.records?.find(r=>r.student===name);if(prior)assigned[name]=prior.part===1?2:1;}
  return {...store,[w.id]:{...w,students:[...students],assigned,records:[]}};
 }
 function recordFor(w,name){return (w?.records||[]).find(r=>r.student===name);}
 function metrics(value){
  if(!value||typeof value.durationMinutes!=='number'||!Number.isFinite(value.durationMinutes)||value.durationMinutes<=0||!Number.isInteger(value.errorCount)||value.errorCount<0)throw Error('أدخل مدة موجبة وعدد أخطاء صحيحا (صفر أو أكثر).');
  return {durationMinutes:value.durationMinutes,errorCount:value.errorCount};
 }
 function confirm(w,actor,target,part,finished,now=new Date(),measurement){
  if(!active(w,now))throw Error('انتهى وقت المراجعة لهذا الأسبوع.');
  if(actor===target||!w.students.includes(actor)||!w.students.includes(target))throw Error('اختر زميلا من مجموعتك.');
  if(![1,2].includes(part)||typeof finished!=='boolean')throw Error('حدد نتيجة المراجعة.');
  const measured=metrics(measurement);
  const next=structuredClone(w);
  if(recordFor(w,target))throw Error('تم تأكيد هذا الطالب بالفعل.');
  if(w.assigned?.[target] && w.assigned[target]!==part)throw Error('يجب عكس القسم الذي قرأه الطالب الأسبوع الماضي.');
  next.records ||= [];
  next.records.push({...measured,student:target,part,complete:finished,participated:true,validator:actor,createdAt:now.toISOString()});
  return next;
 }
 const api={week,active,ensure,recordFor,metrics,confirm};if(typeof module!=='undefined')module.exports=api;else root.ReviewModel=api;
})(globalThis);
