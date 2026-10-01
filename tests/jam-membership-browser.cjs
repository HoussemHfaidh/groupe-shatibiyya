const {chromium}=require('playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 for(const group of ['group1','group2']){
  const page=await browser.newPage();await page.clock.install({time:new Date('2026-10-01T10:00:00Z')});
  const excluded='محمد الصادق الكشباطى',students=['أحمد',excluded,'علي'];
  const schedule={startDate:'2026-09-26',number:1,timeZone:'Europe/Paris'};
  const store=Object.fromEntries(['2026-09-19','2026-09-26'].map(date=>['week-'+date,{id:'week-'+date,startDate:date,endDate:date==='2026-09-26'?'2026-10-03':'2026-09-26',timeZone:'Europe/Paris',number:1,students,verses:['1','2','3'],confirmations:[{student:excluded,verseIndex:0},{student:'أحمد',verseIndex:2,validator:excluded}]}]));
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://jam.test/**',async route=>{const p=new URL(route.request().url()).pathname;
   if(p.startsWith('/api/')){assert.equal(route.request().method(),'GET');return route.fulfill({json:{value:store,revision:0}});}
   if(p==='/')return route.fulfill({contentType:'text/html',body:`<html dir="rtl"><meta charset="utf-8"><main><label><select id="groupSelect"></select></label></main><script>window.SHATIBIYYA_JAM_LOCAL_DEV=true;</script><script src="table-share.js"></script><script src="jam-model.js"></script><script src="jam.js"></script><script>window.ctx={role:'professor',host:document.querySelector('main'),storageId:'${group}',students:${JSON.stringify(students)},schedule:${JSON.stringify(schedule)}};Jam.mount(ctx);</script></html>`});
   return route.fulfill({contentType:'text/javascript',body:await fs.readFile(path.join(__dirname,'..',p))});
  });
  await page.goto('http://jam.test/');await page.getByRole('button',{name:'واجب الجمع',exact:true}).click();
  const table=page.locator('.jam-tracking-table');await table.locator('tfoot td').first().waitFor();
  const names=await table.locator('tbody th').allTextContents();
  assert.deepEqual(names,group==='group1'?['أحمد','علي']:students);
  assert.deepEqual(await table.locator('tfoot td').allTextContents(),group==='group1'?['50%','50%']:['67%','67%']);
  assert.deepEqual(await page.evaluate(()=>ctx.students),students);
  assert.deepEqual(errors,[]);await page.close();console.log('PASS '+group+': membership, history, percentages, central roster');
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
