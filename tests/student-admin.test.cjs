const assert=require('node:assert/strict'),model=require('../student-admin-model');
(async()=>{
 const base={students:['أحمد'],weeks:[{id:'w'}],statuses:{old:'done'},studentAliases:[],loginEmails:{legacy:{role:'student',studentName:'أحمد'}}};
 const added=await model.edit(base,'add',null,'علي',' ALI@example.test ','group2');
 const [hash,profile]=model.accounts(added,'علي')[0];assert.equal(hash.length,64);assert.equal(profile.email,'ali@example.test');assert.equal(profile.groupId,'group2');assert.equal(base.students.length,1);
 await assert.rejects(()=>model.edit(added,'add',null,'عمر','ali@example.test','group2'),/مرتبط/);
 await assert.rejects(()=>model.edit(base,'add',null,'عمر','','group2'));
 const renamed=await model.edit(added,'rename','علي','علي الجديد',undefined,'group2');assert.equal(model.accounts(renamed,'علي الجديد').length,1);
 const changed=await model.edit(renamed,'rename','علي الجديد','علي الجديد','new@example.test','group2');assert.equal(changed.loginEmails[hash],undefined);
 const removed=await model.edit(changed,'remove','علي الجديد','علي الجديد',undefined,'group2');assert.equal(model.accounts(removed,'علي الجديد').length,0);assert.ok(removed.loginEmails.legacy);assert.deepEqual(removed.statuses,base.statuses);
 const legacy=await model.edit(base,'remove','أحمد','أحمد',undefined,'group1');assert.deepEqual(legacy.loginEmails,{});
 assert.deepEqual(base.students,['أحمد']);console.log('PASS account add, rename, email replacement, removal, duplicates, legacy accounts, history preservation');
})().catch(e=>{console.error(e);process.exitCode=1;});
