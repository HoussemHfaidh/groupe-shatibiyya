const {chromium}=require('playwright'), fs=require('node:fs/promises'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const Review=require('../review-model'),Jam=require('../jam-model'),Khatma=require('../khatma-model');
const production=process.env.TEST_PRODUCTION==='1';
(async()=>{
 const server=http.createServer(async(req,res)=>{try{const file=path.join(__dirname,'..',new URL(req.url,'http://localhost').pathname);res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(await fs.readFile(file));}catch{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
 browser=await chromium.launch({headless:true,channel:'chrome'});
 const context=await browser.newContext({viewport:{width:1280,height:900}});context.setDefaultTimeout(10000);
 const errors=[];context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
 const stores={},revisions={},now=new Date('2026-09-26T12:00:00Z'); let conflict=false,offline=false;
 const configPath=g=>production?(g==='group1'?'/config.json':'/config/groups/group2.json'):`/config/groups/login-test-${g}.json`;
 const storageId=g=>production?g:`login-test-${g}`;
 for(const group of ['group1','group2']){
  const id=storageId(group),day=group==='group1'?6:0;stores[group==='group1'?'/config/studentStatus.json':'/config/groups/group2/studentStatus.json']={};
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
  if(p.includes('loginEmails'))return route.fulfill({headers,json:{role:'student',studentName:'أحمد',groupId:'group1'}});
  assert.ok(Object.hasOwn(stores,p),`unexpected request ${method} ${p}`);
  if((conflict||offline)&&method==='PUT'&&p.includes('config'))return route.fulfill({status:offline?503:412,headers,json:{error:'fixture'}});
  if(method==='PUT'){if(request.headers()['if-match']!==headers.ETag)return route.fulfill({status:412,headers,json:{error:'concurrent write'}});stores[p]=request.postDataJSON();revisions[p]=(revisions[p]||0)+1;}
  if(method==='PATCH'){Object.assign(stores[p],request.postDataJSON());revisions[p]=(revisions[p]||0)+1;}
  return route.fulfill({headers,json:stores[p]});
 });
 const prof=await context.newPage();await prof.clock.install({time:now});const base=`http://127.0.0.1:${server.address().port}/`;
 await prof.goto(base+(production?'index.html':'prof-login-dev.html')+'?devMode=data&group=group1');
 await prof.getByRole('button',{name:'تعديل الطالب أحمد',exact:true}).waitFor();
 const section=async name=>prof.getByRole('button',{name,exact:true}).click();
 const add=async name=>{await section('التسميع');await prof.locator('#studentName').fill(name);await prof.locator('#studentForm button[type=submit]').click();await prof.getByRole('button',{name:`تعديل الطالب ${name}`,exact:true}).waitFor();};
 const rename=async(from,to)=>{await section('التسميع');prof.once('dialog',d=>d.accept(to));await prof.getByRole('button',{name:`تعديل الطالب ${from}`,exact:true}).click();};
 const remove=async name=>{await section('التسميع');prof.once('dialog',d=>d.accept());await prof.getByRole('button',{name:`حذف الطالب ${name}`,exact:true}).click();await prof.getByRole('button',{name:`حذف الطالب ${name}`,exact:true}).waitFor({state:'detached'});};
 // Import one historical attendance report before renaming.
 if(await prof.getByRole('button',{name:'الحضور',exact:true}).count()){
  await section('الحضور');await prof.locator('.attendance-panel input[type=file]').setInputFiles({name:'roster.csv',mimeType:'text/csv',buffer:Buffer.from('Name,Join time,Leave time,Duration (minutes)\nGharbi,09/26/2026 09:00:00,09/26/2026 10:00:00,60\nأحمد,09/26/2026 09:00:00,09/26/2026 10:00:00,60')});await prof.getByText('تم حفظ الجلسة:',{exact:false}).waitFor();
 }
 await rename('أحمد','أحمد المصحح');await prof.getByRole('button',{name:'تعديل الطالب أحمد المصحح',exact:true}).waitFor();
 assert.equal(stores[configPath('group1')].statuses['احمد-المصحح__week1'],'done');assert.equal(stores[configPath('group1')].loginEmails.fixture.studentName,'أحمد');assert.deepEqual(stores[configPath('group2')].students,['أحمد','علي']);
 await add('طالب جديد');
 await section('المراجعة');await prof.locator('.review-professor-table').getByText('طالب جديد',{exact:true}).waitFor();await prof.locator('.review-professor-table').getByText('أحمد المصحح',{exact:true}).waitFor();
 await section('واجب الجمع');await prof.locator('.jam-tracking-table').getByText('طالب جديد',{exact:true}).waitFor();await prof.locator('.jam-tracking-table').getByText('أحمد المصحح',{exact:true}).waitFor();
 if(await prof.getByRole('button',{name:'متابعة الختمات الفردية',exact:true}).count()){
  await section('متابعة الختمات الفردية');await prof.locator('.khatma-weekly').getByText('أحمد المصحح',{exact:true}).waitFor();await prof.locator('.khatma-filters select').nth(1).selectOption('أحمد المصحح');await prof.locator('.khatma-history').getByText('البقرة 10',{exact:true}).waitFor();
 }
 if(await prof.getByRole('button',{name:'الحضور',exact:true}).count()){
  await section('الحضور');await prof.locator('.attendance-editor > summary').click();await prof.locator('.attendance-table').getByRole('rowheader',{name:'أحمد المصحح',exact:true}).waitFor();
 }
 // Old login profile resolves to renamed identity, with green recitation history intact.
 const student=await context.newPage();await student.clock.install({time:now});await student.goto(base+(production?'student.html':'student-login-dev.html'));
 await student.locator('#accountName').filter({hasText:'أحمد المصحح'}).waitFor();
 await student.getByRole('button',{name:'المراجعة',exact:true}).click();await student.locator('.review-panel').getByText('طالب جديد',{exact:true}).first().waitFor();
 await remove('طالب جديد');await section('المراجعة');await prof.locator('.review-professor-table').getByText('طالب جديد',{exact:true}).waitFor({state:'detached'});
 // Failed writes retain original roster; duplicate names are rejected.
 conflict=true;await rename('علي','تغيير متعارض');await prof.locator('#syncStatus').filter({hasText:'تغيرت البيانات'}).waitFor();assert.ok(stores[configPath('group1')].students.includes('علي'));conflict=false;
 offline=true;await rename('علي','تغيير دون اتصال');await prof.locator('#syncStatus').filter({hasText:'تعذر حفظ قائمة الطلاب'}).waitFor();offline=false;
 await rename('علي','أحمد المصحح');await prof.locator('#syncStatus').filter({hasText:'هذا الاسم موجود'}).waitFor();
 // A pending save must keep its original group, even when the selector changes immediately.
 await section('التسميع');await prof.locator('#weekBoundaryDay').selectOption('5');await prof.locator('#groupSelect').selectOption('group2');
 await prof.waitForFunction(()=>currentGroupId==='group2' && jamConfigReady);
 await new Promise(resolve=>setTimeout(resolve,600));
 assert.equal(stores[configPath('group1')].settings.weekBoundaryDay,5);assert.equal(stores[configPath('group2')].settings.weekBoundaryDay,0);
 // Both groups independently persist rename/add/delete and the last deletion remains empty.
 for(const group of ['group2','group1']){
  await prof.locator('#groupSelect').selectOption(group);await prof.getByRole('button',{name:'تعديل الطالب علي',exact:true}).waitFor();
  if(group==='group2'){await rename('أحمد','أحمد المجموعة الثانية');await prof.getByRole('button',{name:'تعديل الطالب أحمد المجموعة الثانية',exact:true}).waitFor();await add('طالب ثاني جديد');await section('المراجعة');await prof.locator('.review-professor-table').getByText('طالب ثاني جديد',{exact:true}).waitFor();await prof.locator('.review-professor-table').getByText('أحمد المجموعة الثانية',{exact:true}).waitFor();await remove('طالب ثاني جديد');}
  for(const name of [...stores[configPath(group)].students])await remove(name);
  assert.deepEqual(stores[configPath(group)].students,[]);
  // Firebase serializes an empty array as null / absent.
  delete stores[configPath(group)].students;
  await prof.reload();await prof.waitForFunction(()=>jamConfigReady && state.students.length===0);assert.equal(await prof.locator('#studentList button').count(),0);
 }
 await student.reload();await student.locator('#studentResult').filter({hasText:'لم تعد مسجلا'}).waitFor();
 assert.deepEqual(errors,[]);console.log(`✓ ${production?'PROD':'DEV'} roster: both groups, rename/history/login, all sections, empty roster, conflicts, offline, duplicate protection`);
 await context.close();
 }finally{await browser?.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
