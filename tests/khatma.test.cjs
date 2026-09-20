const {test}=require('node:test');
const assert=require('node:assert/strict');
const m=require('../khatma-model');
const now=new Date('2026-09-19T18:00:00Z'), actor={role:'student',name:'أحمد'}, students=['أحمد','علي'];
const input=(id,extra={})=>({id,title:'ختمة أولى',teacher:m.teachers[0],date:'2026-09-18',riwaya:m.readings[0],attendance:'present',start:'البقرة 1',position:'البقرة 20',notes:'',complete:false,...extra});
const add=(store,id,extra={})=>m.append(store,input(id,extra),actor,students,6,now);
test('multiple independent khatmas and unlimited weekly entries preserve previous records',()=>{
 let s=add({},'one'); const before=JSON.stringify(s);
 s=add(s,'two',{khatmaId:'one',position:'البقرة 50'}); s=add(s,'three',{title:'ختمة ثانية',riwaya:m.readings[1]});
 assert.equal(Object.keys(s.khatmas).length,2); assert.equal(m.entries(s,actor.name,'2026-09-12').length,3);
 assert.equal(s.entries.one.position,'البقرة 20'); assert.equal(JSON.parse(before).entries.one.position,'البقرة 20');
 assert.equal(m.latest(s,actor.name).length,2);
 assert.equal(add(s,'two',{khatmaId:'one'}),s);
});
test('student identity, membership, foreign khatma and input validation',()=>{
 const s=add({},'one');
 assert.throws(()=>m.append(s,input('two',{khatmaId:'one'}),{role:'student',name:'علي'},students,6,now));
 assert.throws(()=>m.append({},input('x'),{role:'professor',name:'أحمد'},students,6,now));
 for(const change of [{teacher:'unknown'},{riwaya:'unknown'},{date:'2026-02-30'},{date:'2027-01-01'},{start:''},{position:''},{attendance:'bad'},{complete:'yes'}]) assert.throws(()=>add({},'x',change));
});
test('attendance without reading does not erase last progress',()=>{
 let s=add({},'one'); s=add(s,'two',{khatmaId:'one',date:'2026-09-19',attendance:'excused',start:'',position:''});
 assert.equal(m.latest(s,actor.name)[0].attendance,'excused');
 assert.equal(m.latest(s,actor.name,null,true)[0].position,'البقرة 20');
 assert.throws(()=>add(s,'three',{khatmaId:'one',attendance:'absent',complete:true}));
});
test('editable teachers preserve historical names and reject stale choices',()=>{
 let s=add({},'one'); s=m.setTeachers(s,['شيخ جديد'],{role:'professor'});
 assert.equal(s.entries.one.teacher,m.teachers[0]);
 assert.throws(()=>add(s,'two',{khatmaId:'one'}));
 assert.throws(()=>m.setTeachers(s,['x'],actor));
 assert.throws(()=>m.setTeachers(s,[],{role:'professor'}));
 assert.throws(()=>m.setTeachers(s,['x','x'],{role:'professor'}));
 assert.equal(add(s,'two',{khatmaId:'one',teacher:'شيخ جديد'}).entries.two.teacher,'شيخ جديد');
});
test('historical dates, group week boundaries, and completion',()=>{
 let s=add({},'one',{date:'2026-09-11'}); s=add(s,'two',{khatmaId:'one',date:'2026-09-19',complete:true});
 assert.equal(s.entries.one.weekId,'2026-09-05'); assert.equal(s.entries.two.weekId,'2026-09-19');
 assert.equal(m.latest(s,actor.name,'2026-09-12',true)[0].id,'one');
 assert.throws(()=>add(s,'three',{khatmaId:'one'}));
 assert.equal(m.append({},input('sun',{date:'2026-09-19'}),actor,students,0,now).entries.sun.weekId,'2026-09-13');
 assert.equal(m.week(6,new Date('2026-09-19T03:59:59Z')).id,'2026-09-12');
 assert.equal(m.week(6,new Date('2026-09-19T04:00:00Z')).id,'2026-09-19');
});
test('shared configurable readings support add, rename and remove without rewriting history',()=>{
 const old=add({},'one');
 let catalog=m.setTeachers({},[...m.readings,'قراءة جديدة'],{role:'professor'},'readings');
 const group1={...old,settings:catalog.settings}, group2={settings:catalog.settings};
 assert.deepEqual(m.readingList(group1),m.readingList(group2));
 assert.equal(add(group2,'two',{riwaya:'قراءة جديدة'}).entries.two.riwaya,'قراءة جديدة');
 catalog=m.setTeachers(catalog,['قراءة معدلة'],{role:'professor'},'readings');
 assert.throws(()=>add({...old,settings:catalog.settings},'three',{riwaya:m.readings[0]}));
 assert.equal(old.entries.one.riwaya,m.readings[0]);
 assert.throws(()=>m.setTeachers(catalog,['قراءة'],actor,'readings'));
});
test('simple student form automatically groups sessions by student, teacher and reading',()=>{
 const simple=id=>{const {title,complete,...value}=input(id);return value;};
 let s=m.recordSession({},simple('auto1'),actor,students,6,now);
 s=m.recordSession(s,simple('auto2'),actor,students,6,now);
 assert.equal(s.entries.auto2.khatmaId,s.entries.auto1.khatmaId);
 s=m.recordSession(s,{...simple('auto3'),riwaya:m.readings[1]},actor,students,6,now);
 s=m.recordSession(s,{...simple('auto4'),teacher:m.teachers[1]},actor,students,6,now);
 assert.equal(Object.keys(s.khatmas).length,3);
 assert.equal(Object.keys(s.entries).length,4);
 assert.equal(s.entries.auto1.complete,false);
});
