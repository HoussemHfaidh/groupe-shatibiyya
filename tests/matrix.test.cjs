const {test}=require('node:test');
const assert=require('node:assert/strict');
const M=require('../matrix-model');
const Clock=require('../weekly-clock');
const Review=require('../review-model');
const small=(n=0)=>({late:n,incomplete:0,removed:0,form:0});
const large=(n=0)=>({makeup:n,jam:0,absence:0,iqra:0,recitation:0,review:0});
test('three small incidents add one major point and preserve the remainder',()=>{
  const r=M.calculate(small(2),large(),{smallCarry:2,largeCarry:1});
  assert.equal(r.major.triples,1);assert.equal(r.smallCarry,1);assert.equal(r.total,2);assert.equal(r.largeCarry,2);assert.equal(r.suspended,false);
});
test('suspension resets major count, preserving recorded total and small remainder',()=>{
  const r=M.calculate(small(7),large(2),{largeCarry:2});
  assert.equal(r.total,6);assert.equal(r.largeCarry,0);assert.equal(r.suspended,true);assert.equal(r.smallCarry,1);
});
test('missing or invalid data cannot become a sanction',()=>{
  assert.equal(M.calculate(small(),{...large(),absence:null}),null);
  assert.equal(M.calculate(small(-1),large()),null);
});
test('closed snapshots carry once and remain immutable',()=>{
  const w={startDate:'2026-09-19',endDate:'2026-09-26'};
  const rows=[{student:'A',result:M.calculate(small(2),large(2))}];
  const deadline=Clock.at(w.endDate),now=new Date('2026-09-28T12:00:00Z');
  const store=M.close({},w,rows,now,deadline);
  rows[0].result.smallCarry=99;
  assert.equal(M.previousFor(store,{startDate:'2026-09-26'},'A').smallCarry,2);
  assert.throws(()=>M.close(store,w,rows,now,deadline));
  assert.throws(()=>M.close({},w,rows,new Date('2026-09-20'),deadline));
  assert.throws(()=>M.close(store,{startDate:'2026-09-12',endDate:'2026-09-19'},rows,now,deadline));
});
test('sources count partial review separately from absent review',()=>{
  const w={startDate:'2026-09-19',endDate:'2026-09-26'};
  const sources={students:['A'],attendance:[{date:w.startDate,participants:[{name:'A',key:'a',late:true,matched:true}],flags:{a:{removed:true}}}],review:{[w.startDate]:{students:['A'],records:[{student:'A',complete:false}]}},jam:{w:{startDate:w.startDate,students:['A'],confirmations:[{student:'A'}]}},khatma:{weeks:{[w.startDate]:{students:['A']}},entries:{}},recitations:[{date:w.startDate,statuses:{A:'makeup'}}]};
  const r=M.sourceRow('A',w,sources,{makeup:0,absence:0,iqra:0});
  assert.deepEqual(r.minor,{late:1,incomplete:1,removed:1,form:1});assert.equal(r.major.review,0);assert.equal(r.major.recitation,0);assert.equal(r.result.major.triples,1);
  sources.review[w.startDate].records=[];
  const absent=M.sourceRow('A',w,sources,{makeup:0,absence:0,iqra:0});assert.equal(absent.minor.incomplete,0);assert.equal(absent.major.review,1);
  sources.attendance=[];assert.equal(M.sourceRow('A',w,sources,{}).minor.late,null);
});
test('group calendars use Saturday and Sunday boundaries',()=>{
  assert.equal(Review.week(6,new Date('2026-09-20T12:00:00Z')).id,'2026-09-19');
  assert.equal(Review.week(0,new Date('2026-09-20T12:00:00Z')).id,'2026-09-20');
});
test('professor corrections recalculate subsequent closed weeks and can restore sources',()=>{
 const first={startDate:'2026-09-05',endDate:'2026-09-12'},second={startDate:'2026-09-12',endDate:'2026-09-19'},now=new Date('2026-09-28');
 let store=M.close({},first,[M.applyOverrides({student:'A',minor:small(2),major:large(2)})],now,Clock.at(first.endDate));
 store=M.close(store,second,[M.applyOverrides({student:'A',minor:small(1),major:large()},undefined,M.previousFor(store,second,'A'))],now,Clock.at(second.endDate));
 assert.equal(store.closed[second.startDate].rows[0].result.suspended,true);
 const corrected=M.correct(store,first.startDate,'A','minor','late',0,now);
 assert.equal(corrected.closed[second.startDate].rows[0].result.suspended,false);
 assert.equal(corrected.closed[second.startDate].rows[0].result.total,2);
 assert.equal(corrected.closed[first.startDate].rows[0].sourceMinor.late,2);
 assert.equal(corrected.audit.length,1);
 const restored=M.correct(corrected,first.startDate,'A','minor','late',null,now);
 assert.equal(restored.closed[second.startDate].rows[0].result.suspended,true);
 assert.equal(store.audit,undefined);
});
test('professor can override the derived point, previous balances and suspension decision',()=>{
 let row=M.applyOverrides({student:'A',minor:small(),major:large()}, {major:{triples:2},previous:{largeCarry:1},suspended:false});
 assert.equal(row.result.total,3);assert.equal(row.result.suspended,false);assert.equal(row.result.automaticSuspended,true);
 row=M.applyOverrides(row,{suspended:true});assert.equal(row.result.total,0);assert.equal(row.result.suspended,true);
 assert.throws(()=>M.correct({},'2026-09-19','A','minor','late',-1));
 assert.throws(()=>M.correct({},'2026-09-19','A','status','suspended',1));
});
