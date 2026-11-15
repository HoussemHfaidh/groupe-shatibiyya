(function(root){
const entries=s=>Object.values(s?.debts||{}).filter(d=>!d.completed||!d.archivedAt);
const pending=(s,name)=>entries(s).filter(d=>!d.completed&&(!name||d.student===name));
const canValidate=(s,actor,lesson,students)=>students.includes(actor)&&!pending(s,actor).some(d=>Number(d.lesson)===Number(lesson));
function add(store,rows,students,source,now=new Date().toISOString()){
 const s=structuredClone(store||{});s.debts||={};
 for(const row of rows){if(!students.includes(row.student))throw Error('طالب غير موجود في المجموعة');
 const lessons=String(row.lessons||'').trim();if(!lessons)continue;
 if(!/^\d+(?:[\s,،-]+\d+)*$/.test(lessons))throw Error('أدخل أرقام الدروس مفصولة بفواصل');
 for(const lesson of new Set(lessons.match(/\d+/g).map(Number))){if(lesson<1||lesson>9999)throw Error('رقم الدرس غير صحيح');
 const id=encodeURIComponent(row.student)+'__'+lesson;let d=s.debts[id];
 if(!d)d=s.debts[id]={id,student:row.student,lesson,createdAt:now,reasons:[]};
 d.reasons=[...new Set([...(d.reasons||[]),row.reason||'تدارك'])];
 }}
 // Retain completed records for attendance history and to avoid reopening them
 // on reimport, but remove them from the active list at the next upload.
 for(const d of Object.values(s.debts))if(d.completed&&!d.archivedAt)d.archivedAt=now;
 if(source)s.source={...source,uploadedAt:now};return s;
}
function confirm(store,actor,target,lesson,students,now=new Date().toISOString()){
 if(actor===target||!students.includes(target)||!canValidate(store,actor,lesson,students))throw Error('يمكنك تأكيد تدارك زميلك إذا لم يكن عليك تدارك في نفس الدرس');
 const s=structuredClone(store),d=entries(s).find(d=>d.student===target&&d.lesson===Number(lesson)&&!d.completed);
 if(!d)throw Error('تم تأكيد هذا الدرس أو لم يعد متاحا');d.completed={validator:actor,at:now};return s;
}
const api={entries,pending,canValidate,add,confirm};if(typeof module!=='undefined')module.exports=api;else root.MakeupModel=api;
})(globalThis);
