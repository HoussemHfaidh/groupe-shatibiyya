const {test}=require('node:test'), assert=require('node:assert/strict');
const R=require('../roster-model'), Review=require('../review-model'), Jam=require('../jam-model');
test('rename retains status, readiness, aliases, historical validators, free text and other group',()=>{
 const original={students:['أحمد','علي'],statuses:{'احمد__w':'done'},readyAt:{'احمد__w':'timestamp'},readyOrder:{w:['أحمد']},groups:{group2:{students:['أحمد']}}};
 const renamed=R.edit(original,'rename','أحمد','أحمد الجديد');
 assert.deepEqual(renamed.students,['أحمد الجديد','علي']);assert.equal(renamed.statuses['احمد-الجديد__w'],'done');assert.equal(renamed.readyAt['احمد-الجديد__w'],'timestamp');assert.deepEqual(renamed.readyOrder.w,['أحمد الجديد']);assert.deepEqual(renamed.groups,original.groups);
 const again=R.edit(renamed,'rename','أحمد الجديد','أحمد المصحح');
 assert.equal(R.resolve('أحمد',again.studentAliases),'أحمد المصحح');
 const data=R.project({w:{students:['أحمد'],assigned:{'أحمد':2},records:[{student:'أحمد',validator:'علي',notes:'أحمد',teacher:'أحمد'}]}},again.studentAliases);
 assert.equal(data.w.records[0].student,'أحمد المصحح');assert.equal(data.w.records[0].notes,'أحمد');assert.equal(data.w.records[0].teacher,'أحمد');assert.equal(data.w.assigned['أحمد المصحح'],2);assert.equal(original.students[0],'أحمد');
});
test('remove last student retains history and explicit empty roster; re-add restores person',()=>{
 const c={students:['أحمد'],statuses:{'احمد__w':'done'}};
 const removed=R.edit(c,'remove','أحمد');assert.deepEqual(removed.students,[]);assert.equal(removed.rosterInitialized,true);assert.deepEqual(removed.statuses,c.statuses);
 assert.deepEqual(R.config({...removed,students:null}).students,[]);
 assert.deepEqual(R.edit(removed,'add',null,'أحمد').students,['أحمد']);
});
test('duplicate, alias collisions and stale rename are rejected',()=>{
 const c={students:['أحمد','علي']};assert.throws(()=>R.edit(c,'add',null,'احمد'));assert.throws(()=>R.edit(c,'rename','أحمد','علي'));assert.throws(()=>R.edit(c,'rename','غائب','جديد'));
 const renamed=R.edit(c,'rename','أحمد','جديد');assert.throws(()=>R.edit(renamed,'add',null,'أحمد'));
});
test('review roster changes retain records and closed weeks',()=>{
 const now=new Date('2026-09-26T12:00:00Z'), w=Review.week(6,now);const record={student:'أحمد',part:1,complete:true};
 const old={old:{students:['أحمد'],records:[record]},[w.id]:{...w,students:['أحمد'],records:[record]}};
 const next=Review.ensure(old,['علي'],6,now);assert.deepEqual(next.old,old.old);assert.deepEqual(next[w.id].records,[record]);assert.deepEqual(next[w.id].students,['علي']);
});
test('jam roster changes keep verse indices, approval and old history; deleted validator denied',()=>{
 const now=new Date('2026-09-26T12:00:00Z'),schedule={number:1,startDate:'2026-09-26',timeZone:'Europe/Paris'},w=Jam.weeklyWindow(schedule,now);
 let store=Jam.ensureWeek({},['أحمد'],schedule,now);store[w.id]=Jam.confirm(store[w.id],'أحمد',0,{role:'professor'},now);
 const added=Jam.ensureWeek(store,['أحمد','علي'],schedule,now);assert.equal(added[w.id].verses.length,2);assert.equal(added[w.id].confirmations[0].verseIndex,0);
 const removed=Jam.ensureWeek(added,['علي'],schedule,now);assert.deepEqual(removed[w.id].confirmations,store[w.id].confirmations);assert.throws(()=>Jam.confirm(removed[w.id],'علي',1,{role:'student',name:'أحمد'},now));
});
