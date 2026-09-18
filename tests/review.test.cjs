const {test}=require('node:test');const assert=require('node:assert/strict');const M=require('../review-model');
const now=new Date('2026-09-14T10:00:00Z');const names=['A','B','C'];
function fresh(){const s=M.ensure({},names,6,now,{durationMinutes:12,errorCount:0});return s[M.week(6,now,{durationMinutes:12,errorCount:0}).id];}
test('No pair restriction; completed and incomplete participation each close availability',()=>{let w=fresh();w=M.confirm(w,'A','B',2,false,now,{durationMinutes:12,errorCount:0});assert.equal(M.recordFor(w,'B').participated,true);assert.equal(M.recordFor(w,'B').complete,false);w=M.confirm(w,'C','A',1,true,now,{durationMinutes:12,errorCount:0});assert.equal(w.records.length,2);assert.throws(()=>M.confirm(w,'A','B',2,true,now,{durationMinutes:12,errorCount:0}));assert.throws(()=>M.confirm(w,'C','C',1,true,now,{durationMinutes:12,errorCount:0}));});
test('Next week swaps individual halves without retaining partner',()=>{let w=M.confirm(fresh(),'A','B',2,false,now,{durationMinutes:12,errorCount:0});const later=new Date('2026-09-19T04:00:00Z');const s=M.ensure({[w.id]:w},names,6,later,{durationMinutes:12,errorCount:0}),next=s[M.week(6,later,{durationMinutes:12,errorCount:0}).id];assert.equal(next.assigned.B,1);assert.equal(next.records.length,0);assert.throws(()=>M.confirm(next,'C','B',2,true,later,{durationMinutes:12,errorCount:0}));assert.equal(M.confirm(next,'C','B',1,true,later,{durationMinutes:12,errorCount:0}).records.length,1);assert.throws(()=>M.confirm(w,'A','C',1,true,later,{durationMinutes:12,errorCount:0}));});
test('Group closures differ and Paris DST is respected',()=>{assert.equal(M.week(6,new Date('2026-09-19T03:59:59Z')).id,'2026-09-12');assert.equal(M.week(6,new Date('2026-09-19T04:00:00Z')).id,'2026-09-19');assert.equal(M.week(0,new Date('2026-09-19T04:00:00Z')).id,'2026-09-13');assert.equal(M.week(0,new Date('2026-10-25T05:00:00Z')).id,'2026-10-25');});

test('Incomplete first half is a completed participation and reverses next week',()=>{
 const w=M.confirm(fresh(),'A','B',1,false,now,{durationMinutes:12,errorCount:0}),r=M.recordFor(w,'B');
 assert.equal(r.part,1);assert.equal(r.complete,false);assert.equal(r.participated,true);
 assert.throws(()=>M.confirm(w,'C','B',1,true,now,{durationMinutes:12,errorCount:0}));
 const later=new Date('2026-09-19T04:00:00Z');
 assert.equal(M.ensure({[w.id]:w},names,6,later,{durationMinutes:12,errorCount:0})[M.week(6,later,{durationMinutes:12,errorCount:0}).id].assigned.B,2);
});
test('Measurements required and zero errors preserved',()=>{
 for(const invalid of [undefined,{}, {durationMinutes:0,errorCount:0},{durationMinutes:2,errorCount:-1},{durationMinutes:2,errorCount:1.5},{durationMinutes:Infinity,errorCount:0}])assert.throws(()=>M.confirm(fresh(),'A','B',1,true,now,invalid));
 for(const part of [1,2]){const r=M.recordFor(M.confirm(fresh(),'A','B',part,false,now,{durationMinutes:12.5,errorCount:0}),'B');assert.equal(r.durationMinutes,12.5);assert.equal(r.errorCount,0);}
});
