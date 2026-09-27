const {chromium}=require('playwright'), fs=require('node:fs/promises'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const Review=require('../review-model'),Jam=require('../jam-model'),Khatma=require('../khatma-model');
const production=true;
(async()=>{
 const server=http.createServer(async(req,res)=>{try{const file=path.join(__dirname,'..',new URL(req.url,'http://localhost').pathname);res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(await fs.readFile(file));}catch{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
 browser=await chromium.launch({headless:true,channel:'chrome'});
 const context=await browser.newContext({viewport:{width:1280,height:900}});context.setDefaultTimeout(10000);
 const errors=[];context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
 const stores={},revisions={},now=new Date('2026-09-26T12:00:00Z'); let conflict=false,offline=false,loginGroup='group1';
 const configPath=g=>production?(g==='group1'?'/config.json':'/config/groups/group2.json'):`/config/groups/login-test-${g}.json`;
 const storageId=g=>production?g:`login-test-${g}`;
 for(const group of ['group1','group2']){
  const id=storageId(group),day=group==='group1'?6:0;
  stores[configPath(group)]={students:['أحمد','علي'],weeks:[{id:'week1',date:'2026-09-25',start:1,end:10}],settings:{weekBoundaryDay:day},statuses:{'احمد__week1':'done'},readyOrder:{week1:['أحمد']},loginEmails:{fixture:{studentName:'أحمد',role:'student'}}};
  stores[production&&group==='group1'?'/submissions.json':`/submissions/groups/${id}.json`]={};
  const week=Review.week(day,now);stores[`/review/groups/${id}.json`]={[week.id]:{...week,students:['أحمد','علي'],records:[{student:'أحمد',validator:'علي',part:1,complete:true,durationMinutes:5,errorCount:0}]}};
  const schedule={number:48,startDate:'2026-09-26',timeZone:'Europe/Paris'},j=Jam.ensureWeek({},['أحمد','علي'],schedule,now);const w=Object.keys(j)[0];j[w]=Jam.confirm(j[w],'أحمد',0,{role:'professor'},now);stores[`/jam/groups/${id}.json`]=j;
  stores[`/khatma/groups/${id}.json`]={entries:{entry1:{id:'entry1',khatmaId:'k1',student:'أحمد',teacher:Khatma.teachers[0],riwaya:Khatma.readings[0],date:'2026-09-26',weekId:week.id,createdAt:now.toISOString(),attendance:'present',start:'البقرة 1',position:'البقرة 10',notes:'محفوظ',complete:false}},khatmas:{k1:{id:'k1',student:'أحمد',title:'ختمة'}},weeks:{[week.id]:{...week,students:['أحمد','علي']}}};
 }
 stores['/khatma/catalogs/login-test.json']={};stores['/khatma/catalogs/production.json']={};
 await context.addInitScript(production=>{if(location.protocol!=='http:')return;window.SHATIBIYYA_JAM_LOCAL_DEV=false;localStorage.setItem(production?'shatibiyya-production-session':'shatibiyya-login-test-session',JSON.stringify({email:'student@example.test',emailOnly:true,expiresAt:Date.now()+86400000}));},production);
 await context.route('https://**/*',async route=>{
  const request=route.request(),p=new URL(request.url()).pathname,method=request.method();
  const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,PUT,PATCH,OPTIONS','access-control-expose-headers':'ETag','ETag':`"${revisions[p]||0}"`};
  if(method==='OPTIONS')return route.fulfill({status:204,headers});
  if(p.includes('loginEmails'))return route.fulfill({headers,json:{role:'student',studentName:'أحمد',groupId:loginGroup}});
  assert.ok(Object.hasOwn(stores,p),`unexpected request ${method} ${p}`);
  if((conflict||offline)&&method==='PUT'&&(p.includes('config')||p.startsWith('/khatma/')))return route.fulfill({status:offline?503:412,headers,json:{error:'fixture'}});
  if(method==='PUT'){assert.equal(request.headers()['if-match'],headers.ETag);stores[p]=request.postDataJSON();revisions[p]=(revisions[p]||0)+1;}
  if(method==='PATCH'){Object.assign(stores[p],request.postDataJSON());revisions[p]=(revisions[p]||0)+1;}
  return route.fulfill({headers,json:stores[p]});
 });
 const base=`http://127.0.0.1:${server.address().port}/`;
 for(const group of ['group1','group2']){
  loginGroup=group;
  const student=await context.newPage();await student.clock.install({time:now});await student.goto(base+'student.html');
  await student.getByRole('button',{name:'متابعة الختمات الفردية',exact:true}).click();
  const panel=student.locator('.khatma-panel'),form=panel.locator('form.student-form');
  await form.locator('select').nth(0).selectOption(Khatma.teachers[0]);
  await form.locator('select').nth(1).selectOption('present');
  await form.locator('select').nth(2).selectOption(Khatma.readings[0]);
  await form.getByLabel('بداية القراءة (السورة والآية)',{exact:true}).fill('البقرة 11');
  await form.getByLabel('نهاية القراءة (السورة والآية)',{exact:true}).fill('البقرة 20');
  await form.getByLabel('ملاحظات الشيخ(ة)',{exact:true}).fill('تسجيل اختبار');
  const target=`/khatma/groups/${group}.json`,count=Object.keys(stores[target].entries).length;
  conflict=true;await form.getByRole('button',{name:'حفظ المتابعة',exact:true}).click();
  await panel.getByText('وصل تسجيل آخر أثناء الحفظ.',{exact:false}).waitFor();assert.equal(Object.keys(stores[target].entries).length,count);
  assert.equal(await form.getByLabel('نهاية القراءة (السورة والآية)',{exact:true}).inputValue(),'البقرة 20');
  conflict=false;await form.getByRole('button',{name:'حفظ المتابعة',exact:true}).click();
  await panel.getByText('تم حفظ المتابعة.',{exact:false}).waitFor();assert.equal(Object.keys(stores[target].entries).length,count+1);
  await student.reload();await student.getByRole('button',{name:'متابعة الختمات الفردية',exact:true}).click();
  await student.locator('.khatma-history').getByText('البقرة 20',{exact:true}).waitFor();
  await student.close();
 }
 const professor=await context.newPage();await professor.clock.install({time:now});await professor.goto(base+'index.html?group=group1');
 await professor.getByRole('button',{name:'متابعة الختمات الفردية',exact:true}).click();
 const panel=professor.locator('.khatma-panel');await panel.locator('.khatma-weekly').getByText('أحمد',{exact:true}).waitFor();
 await panel.locator('details > summary').click();
 const editor=panel.locator('.khatma-teacher-form textarea').first();await editor.fill((await editor.inputValue())+'\nشيخ اختبار');
 await panel.getByRole('button',{name:'حفظ القائمتين',exact:true}).click();await panel.getByText('تم حفظ القائمتين.',{exact:false}).waitFor();
 assert.ok(stores['/khatma/catalogs/production.json'].settings.teachers.includes('شيخ اختبار'));
 assert.deepEqual(stores['/khatma/catalogs/login-test.json'],{});
 await professor.locator('#groupSelect').selectOption('group2');await professor.getByRole('button',{name:'متابعة الختمات الفردية',exact:true}).click();
 await professor.waitForFunction(()=>document.querySelector('.khatma-teacher-form textarea')?.value.includes('شيخ اختبار'));
 assert.equal(stores['/khatma/groups/group1.json'].entries.entry1.position,'البقرة 10');
 assert.equal(stores['/khatma/groups/group2.json'].entries.entry1.position,'البقرة 10');
 assert.deepEqual(errors,[]);console.log('✓ Khatma PROD: both groups save/reload, conflict/retry, original history, shared production catalog, DEV isolation');
 await context.close();
 }finally{await browser?.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
