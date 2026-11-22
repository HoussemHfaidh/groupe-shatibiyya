const {test}=require('node:test'),assert=require('node:assert/strict'),M=require('../khatma-model');
const now=new Date('2026-11-22T12:00:00Z'),students=['A','B'],actor={role:'student',name:'A'};
const input={id:'one',teacher:M.teachers[0],riwaya:M.readings[0],date:'2026-11-10',attendance:'present',start:'1',position:'10',notes:''};
const seed=()=>M.recordSession({},input,actor,students,0,now);
test('edit own older entry changes teacher/reading without duplicating it or changing another record',()=>{
 let s=seed();s=M.recordSession(s,{...input,id:'two',date:'2026-11-11'},actor,students,0,now);
 const before=structuredClone(s),old=s.entries.one;
 const next=M.updateEntry(s,'one',{...input,teacher:M.teachers[1],riwaya:M.readings[1]},actor,students,0,old,now);
 assert.equal(Object.keys(next.entries).length,2);assert.equal(next.entries.one.teacher,M.teachers[1]);assert.equal(next.entries.one.riwaya,M.readings[1]);assert.notEqual(next.entries.one.khatmaId,next.entries.two.khatmaId);assert.deepEqual(next.entries.two,s.entries.two);assert.deepEqual(s,before);assert.equal(next.entries.one.createdAt,old.createdAt);
});
test('delete last own entry removes empty khatma, protects other students and rejects stale writes',()=>{
 const s=seed(),old=s.entries.one;
 assert.throws(()=>M.removeEntry(s,'one',{role:'student',name:'B'},students,old));
 assert.throws(()=>M.updateEntry(s,'one',input,actor,[],0,old,now));
 assert.throws(()=>M.removeEntry(s,'one',actor,students,{...old,notes:'stale'}));
 const next=M.removeEntry(s,'one',actor,students,old);assert.deepEqual(next.entries,{});assert.deepEqual(next.khatmas,{});assert.equal(s.entries.one,old);
});
test('retired catalog values may be kept while notes change; invalid new values rejected',()=>{
 const s={...seed(),settings:{teachers:[M.teachers[1]],readings:[M.readings[1]]}},old=s.entries.one;
 const next=M.updateEntry(s,'one',{...input,notes:'corrected'},actor,students,0,old,now);assert.equal(next.entries.one.notes,'corrected');assert.deepEqual(next.settings,s.settings);
 assert.throws(()=>M.updateEntry(s,'one',{...input,teacher:'invalid'},actor,students,0,old,now));
});
test('editing an earlier entry preserves the completed entry of the same khatma',()=>{
 let s=seed();s=M.append(s,{...input,id:'final',khatmaId:s.entries.one.khatmaId,date:'2026-11-12',complete:true},actor,students,0,now);
 const last=structuredClone(s.entries.final);
 const next=M.updateEntry(s,'one',{...input,notes:'correction'},actor,students,0,s.entries.one,now);
 assert.deepEqual(next.entries.final,last);assert.equal(next.entries.one.notes,'correction');assert.equal(M.latest(next,'A')[0].complete,true);
});
