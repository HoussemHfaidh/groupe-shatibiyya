(function(root){
const entries=s=>Object.values(s?.debts||{});
const pending=(s,name)=>entries(s).filter(d=>!d.completed&&(!name||d.student===name));
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
 if(source)s.source={...source,uploadedAt:now};return s;
}
function confirm(store,actor,target,lesson,students,now=new Date().toISOString()){
 if(actor===target||!students.includes(actor)||!students.includes(target)||pending(store,actor).length)throw Error('التأكيد متاح لطالب ليس عليه تدارك، ولزميل آخر فقط');
 const s=structuredClone(store),d=entries(s).find(d=>d.student===target&&d.lesson===Number(lesson)&&!d.completed);
 if(!d)throw Error('تم تأكيد هذا الدرس أو لم يعد متاحا');d.completed={validator:actor,at:now};return s;
}
const api={entries,pending,add,confirm};if(typeof module!=='undefined')module.exports=api;else root.MakeupModel=api;
})(globalThis);
