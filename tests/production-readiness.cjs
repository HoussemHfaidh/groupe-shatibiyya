const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const assert = require('node:assert/strict');
const production = process.env.TEST_PRODUCTION === '1';
(async () => {
 const server=http.createServer(async(req,res)=>{try { const file=path.join(__dirname,'..',new URL(req.url,'http://localhost').pathname);res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(await fs.readFile(file)); }catch {res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser;
 try {
  browser=await chromium.launch({headless:true,channel:'chrome'});
  for(const group of ['group1','group2']) {
   const context=await browser.newContext({viewport:{width:390,height:844}});
   const errors=[];context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
   const stores={};const revision={};let reviewConflict=false,reviewOffline=false,reviewWrites=0,submissions=0,configWrites=0;
   const storage=production?group:`login-test-${group}`;
   const configPath=production&&group==='group1'?'/config.json':`/config/groups/${storage}.json`;
   const subPath=production&&group==='group1'?'/submissions.json':`/submissions/groups/${storage}.json`;
   const reviewPath=`/review/groups/${storage}.json`;
   stores[configPath]={students:['أحمد','علي','عمر'],weeks:[{id:'week1',start:1,end:10,date:'2026-09-11'}],settings:{weekBoundaryDay:group==='group1'?6:0},statuses:{'احمد__week1':'done'}};
   stores[subPath]={};stores[reviewPath]={};stores[`/jam/groups/${storage}.json`]={};
   await context.addInitScript(production=>{if(location.protocol!=='http:')return;window.SHATIBIYYA_JAM_LOCAL_DEV=false;localStorage.setItem(production?'shatibiyya-production-session':'shatibiyya-login-test-session',JSON.stringify({email:'student@example.test',emailOnly:true,expiresAt:Date.now()+86400000}));},production);
   await context.route('https://**/*',async route=>{
    const req=route.request(),url=new URL(req.url()),p=url.pathname;
    const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,PUT,PATCH,POST,OPTIONS','access-control-expose-headers':'ETag','ETag':`"${revision[p]||0}"`};
    if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
    if(p.includes('loginEmails'))return route.fulfill({headers,json:{role:'student',studentName:'أحمد',groupId:group}});
    assert.ok(Object.hasOwn(stores,p),`Unexpected path ${req.method()} ${p}`);
    if(p===reviewPath&&reviewOffline)return route.fulfill({status:503,headers,json:{error:'offline'}});
    if(req.method()==='PUT'){
     assert.equal(req.headers()['if-match'],headers.ETag);
     if(p===reviewPath&&reviewConflict)return route.fulfill({status:412,headers,json:{error:'conflict'}});
     stores[p]=req.postDataJSON();revision[p]=(revision[p]||0)+1;if(p===reviewPath)reviewWrites++;
    }else if(req.method()==='PATCH'){
     assert.equal(p,configPath);configWrites++;
     for(const [key,value]of Object.entries(req.postDataJSON())){let object=stores[p];const parts=key.split('/');for(const part of parts.slice(0,-1))object=object[part]||=( {} );object[parts.at(-1)]=value;}
    }else if(req.method()==='POST'){
     assert.equal(p,subPath);stores[p][`s${++submissions}`]=req.postDataJSON();return route.fulfill({headers,json:{name:`s${submissions}`}});
    }
    await route.fulfill({headers,json:stores[p]});
   });
   const page=await context.newPage();await page.clock.install({time:new Date('2026-09-11T10:00:00Z')});
   const base=`http://127.0.0.1:${server.address().port}/`;
   await page.goto(base+(production?'student.html':'student-login-dev.html'));
   await page.locator('#studentSelect').selectOption('علي');
   const submit=page.locator('#submissionForm button[type=submit]');await submit.click();
   assert.match(await page.locator('dialog[open]').innerText(),/علي/);assert.match(await page.locator('dialog[open]').innerText(),/أحمد/);assert.match(await page.locator('dialog[open]').innerText(),/1.*10/);
   await page.getByRole('button',{name:'إلغاء',exact:true}).click();assert.equal(submissions,0);assert.equal(configWrites,0);
   await submit.click();await page.getByRole('button',{name:'نعم، أؤكد التسميع',exact:true}).click();
   await page.waitForFunction(()=>!Array.from(document.querySelector('#studentSelect').options).some(x=>x.value==='علي'));
   assert.equal(submissions,1);assert.equal(configWrites,1);assert.equal(stores[configPath].statuses['علي__week1'],'done');
   await page.getByRole('button',{name:'المراجعة',exact:true}).click();const panel=page.locator('.review-panel');
   await panel.getByLabel('الطالب الذي قرأ عليّ').selectOption('علي');await panel.getByLabel('القسم الذي قرأه').selectOption('2');
   await panel.getByLabel('المدة بالدقائق').fill('8.5');await panel.getByLabel('عدد الأخطاء').fill('0');
   const confirm=panel.getByRole('button',{name:'تأكيد مراجعة زميلي'});
   const before=reviewWrites;reviewConflict=true;await confirm.click();await page.getByRole('button',{name:'نعم، إلى النهاية',exact:true}).click();
   await panel.getByText('تم تحديث المراجعة عند زميلك. حدّث القائمة وأعد المحاولة.',{exact:true}).waitFor();assert.equal(reviewWrites,before);
   reviewConflict=false;reviewOffline=true;await panel.getByRole('button',{name:'تحديث المراجعة',exact:true}).click();
   await panel.getByText(/تعذر تحميل المراجعة/).waitFor();assert.equal(reviewWrites,before);
   reviewOffline=false;await panel.getByRole('button',{name:'تحديث المراجعة',exact:true}).click();
   await page.waitForFunction(()=>document.querySelector('.review-panel .result-box').textContent==='');
   await confirm.click();await page.getByRole('button',{name:'نعم، إلى النهاية',exact:true}).click();
   await page.waitForFunction(()=>!Array.from(document.querySelector('.review-panel form select').options).some(x=>x.value==='علي')); 
   await panel.getByLabel('الطالب الذي قرأ عليّ').locator('option[value="عمر"]').waitFor({state:'attached'});
   assert.equal(reviewWrites,before+1);const week=Object.values(stores[reviewPath])[0];assert.equal(week.records.length,1);assert.equal(week.records[0].errorCount,0);
   const prof=await context.newPage();await prof.clock.install({time:new Date('2026-09-11T10:00:00Z')});
   await prof.goto(base+(production?'index.html':'prof-login-dev.html')+`?group=${group}&devMode=data`);
   await prof.locator('#trackingTable').getByText('أحمد',{exact:true}).waitFor();
   for(const [button,ext]of [['#exportCsvBtn','csv'],['#exportImageBtn','png']]){
    const downloadPromise=prof.waitForEvent('download');await prof.locator(button).click();const download=await downloadPromise;
    assert.ok(download.suggestedFilename().endsWith('.'+ext));const content=await fs.readFile(await download.path());assert.ok(content.length>50);
    if(ext==='csv')assert.ok(content.toString().includes('أحمد'));else assert.equal(content.subarray(1,4).toString(),'PNG');
   }
   await prof.getByRole('button',{name:'المراجعة',exact:true}).click();await prof.locator('.review-professor-table .review-green').waitFor();
   // Sharing uses the selected complete table, never sends a real message in tests.
   for (const [tab, selector] of [['واجب الجمع','.jam-panel'],['المراجعة','.review-panel']]) {
    await prof.getByRole('button',{name:tab,exact:true}).click();
    const section=prof.locator(selector), share=section.getByRole('button',{name:'مشاركة',exact:true});
    await prof.evaluate(()=>{
     window.sharedImages=[];window.opened=[];window.open=(...args)=>window.opened.push(args);
     Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});
     Object.defineProperty(navigator,'share',{configurable:true,value:async payload=>{
      const file=payload.files[0];const bytes=new Uint8Array(await file.arrayBuffer());
      const bitmap=await createImageBitmap(file);window.sharedImages.push({title:payload.title,size:file.size,type:file.type,signature:Array.from(bytes.slice(0,8)),width:bitmap.width,height:bitmap.height});
     }});
    });
    await share.click();await prof.waitForFunction(()=>window.sharedImages.length===1);
    const shared=await prof.evaluate(()=>window.sharedImages[0]);
    assert.ok(shared.title.includes(tab));assert.equal(shared.type,'image/png');assert.ok(shared.size>100);
    assert.deepEqual(shared.signature,[137,80,78,71,13,10,26,10]);assert.ok(shared.width>390);assert.ok(shared.height>150);
    await prof.evaluate(()=>Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{throw new DOMException('Cancelled','AbortError');}}));
    await share.click();await share.waitFor({state:'visible'});
    await prof.evaluate(()=>Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>false}));
    const downloadPromise=prof.waitForEvent('download');await share.click();const image=await downloadPromise;
    assert.ok(image.suggestedFilename().endsWith('.png'));assert.equal(await prof.evaluate(()=>window.opened.length),1);
   }
   assert.equal(stores[configPath].students.length,3);assert.deepEqual(errors,[]);
   await context.close();console.log(`✓ ${production?'PROD':'DEV'} ${group}: recitation cancel/submit, isolated review conflict/offline/retry, metrics, professor, CSV/PNG exports`);
  }
 }finally{await browser?.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
