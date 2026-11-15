const test=require('node:test'),assert=require('node:assert/strict'),M=require('../makeup-model');
const names=['A','B','C'];
const importedAt='2026-11-15T10:00:00.000Z',completedAt='2026-11-15T11:00:00.000Z',nextImport='2026-11-16T10:00:00.000Z';

test('115 blocks the validator on 115 only; 116 can be confirmed',()=>{
 const s=M.add({},[{student:'A',lessons:'115'},{student:'B',lessons:'115,116'}],names);
 assert.throws(()=>M.confirm(s,'A','B',115,names));
 const confirmed=M.confirm(s,'A','B','116',names);
 assert.deepEqual(M.pending(confirmed,'B').map(d=>d.lesson),[115]);
 assert.deepEqual(M.pending(confirmed,'A').map(d=>d.lesson),[115]);
 assert.equal(confirmed.debts.B__116.completed.validator,'A');
 assert.equal(s.debts.B__116.completed,undefined);
});
test('A validator who completed the same lesson can confirm a peer',()=>{
 let s=M.add({},[{student:'A',lessons:'115,117'},{student:'B',lessons:'115'}],names);
 s=M.confirm(s,'C','A',115,names);
 assert.doesNotThrow(()=>M.confirm(s,'A','B',115,names));
});
test('Self validation, outsiders, missing lessons and duplicate confirmations remain rejected',()=>{
 let s=M.add({},[{student:'A',lessons:'115'}],names);
 assert.throws(()=>M.confirm(s,'A','A',115,names));
 assert.throws(()=>M.confirm(s,'X','A',115,names));
 assert.throws(()=>M.confirm(s,'B','X',115,names));
 assert.throws(()=>M.confirm(s,'B','A',116,names));
 s=M.confirm(s,'B','A',115,names);
 assert.throws(()=>M.confirm(s,'C','A',115,names));
});
test('Completions stay visible until a successful upload, even across weeks and reloads',()=>{
 let s=M.add({},[{student:'A',lessons:'115,116'}],names,{name:'first.xlsx'},importedAt);
 s=M.confirm(s,'B','A',115,names,completedAt);
 const loaded=JSON.parse(JSON.stringify(s));
 assert.equal(M.entries(loaded).length,2);
 assert.deepEqual(loaded.debts.A__115.completed,{validator:'B',at:completedAt});
 assert.equal(loaded.debts.A__115.archivedAt,undefined);
 assert.equal(loaded.source.uploadedAt,importedAt);
});
test('Next upload hides all old completions, preserves pending debts and never reopens completed lessons',()=>{
 let s=M.add({},[{student:'A',lessons:'115,116'},{student:'B',lessons:'114'}],names,{},importedAt);
 s=M.confirm(s,'C','A',115,names,completedAt);s=M.confirm(s,'C','B',114,names,completedAt);
 s=M.add(s,[{student:'A',lessons:'115,117'}],names,{name:'second.xlsx'},nextImport);
 assert.deepEqual(M.entries(s).map(d=>d.lesson),[116,117]);
 assert.deepEqual(M.pending(s,'A').map(d=>d.lesson),[116,117]);
 assert.equal(s.debts.A__115.archivedAt,nextImport);
 assert.equal(s.debts.B__114.archivedAt,nextImport);
 assert.equal(s.debts.A__115.completed.at,completedAt);
 s=M.add(s,[{student:'A',lessons:'115,117'}],names);
 assert.deepEqual(M.entries(s).map(d=>d.lesson),[116,117]);
 assert.equal(s.debts.A__115.archivedAt,nextImport);
 s=M.confirm(s,'B','A',116,names);
 assert.equal(M.entries(s).find(d=>d.lesson===116).completed.validator,'B');
});
test('Invalid import neither archives completions nor partially adds debts',()=>{
 let s=M.add({},[{student:'A',lessons:'115'}],names);
 s=M.confirm(s,'B','A',115,names);const before=structuredClone(s);
 for(const row of [{student:'X',lessons:'116'},{student:'A',lessons:'bad'},{student:'A',lessons:'0'}]){
  assert.throws(()=>M.add(s,[{student:'B',lessons:'117'},row],names));
  assert.deepEqual(s,before);
 }
});
test('Legacy completions without timestamps are archived on upload and preserve attendance credit',()=>{
 const P=require('../presence-register-model');
 const s=M.add({debts:{old:{student:'A',lesson:115,reasons:['غياب'],completed:{validator:'B'}}}},[{student:'A',lessons:'116'}],names,{},nextImport);
 assert.equal(M.entries(s).length,1);
 assert.equal(P.value({lesson:115,cells:{A:'غائب'}},'A',s),'تدارك');
});
