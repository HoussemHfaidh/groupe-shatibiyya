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
  if(p.includes('/loginEmails/')){const [configPath,hash]=p.replace(/\.json$/,'').split('/loginEmails/');return route.fulfill({headers,json:stores[configPath+'.json']?.loginEmails?.[hash]||null});}
  assert.ok(Object.hasOwn(stores,p),`unexpected request ${method} ${p}`);
  if((conflict||offline)&&method==='PUT'&&p.includes('config'))return route.fulfill({status:offline?503:412,headers,json:{error:'fixture'}});
  if(method==='PUT'){if(request.headers()['if-match']!==headers.ETag)return route.fulfill({status:412,headers,json:{error:'concurrent write'}});stores[p]=request.postDataJSON();revisions[p]=(revisions[p]||0)+1;}
  if(method==='PATCH'){Object.assign(stores[p],request.postDataJSON());revisions[p]=(revisions[p]||0)+1;}
  return route.fulfill({headers,json:stores[p]});
 });
 const prof=await context.newPage();await prof.clock.install({time:now});const base=`http://127.0.0.1:${server.address().port}/`;
 await prof.goto(base+'index.html?group=group2');
 await prof.getByRole('button',{name:'إدارة الطلاب',exact:true}).click();
 const panel=prof.locator('.student-admin-panel');
 await panel.getByLabel('اسم الطالب',{exact:true}).fill('طالب الإدارة');
 await panel.getByLabel('البريد الإلكتروني للدخول',{exact:true}).fill('new@example.test');
 await panel.getByRole('button',{name:'إضافة الطالب',exact:true}).click();
 await panel.getByRole('button',{name:'تعديل حساب طالب الإدارة',exact:true}).waitFor();
 assert.ok(stores[configPath('group2')].students.includes('طالب الإدارة'));
 assert.deepEqual(stores[configPath('group1')].students,['أحمد','علي']);
 const hash=require('node:crypto').createHash('sha256').update('new@example.test').digest('hex');
 assert.equal(stores[configPath('group2')].loginEmails[hash].studentName,'طالب الإدارة');
 conflict=true;
 await panel.getByRole('button',{name:'تعديل حساب طالب الإدارة',exact:true}).click();
 await panel.getByLabel('البريد الإلكتروني للدخول',{exact:true}).fill('conflict@example.test');
 await panel.getByRole('button',{name:'حفظ التعديل',exact:true}).click();
 await panel.getByRole('status').getByText(/تغيرت البيانات/).waitFor();
 assert.equal(stores[configPath('group2')].loginEmails[hash].email,'new@example.test');
 conflict=false;await panel.getByRole('button',{name:'إلغاء التعديل',exact:true}).click();
 const student=await context.newPage();await student.clock.install({time:now});await student.addInitScript(()=>localStorage.removeItem('shatibiyya-production-session'));
 await student.goto(base+'student.html?group=group2');
 await student.locator('#loginEmail').fill('new@example.test');await student.locator('#loginForm button[type=submit]').click();
 await student.locator('#accountName').getByText('طالب الإدارة',{exact:false}).waitFor();
 await panel.getByRole('button',{name:'تعديل حساب طالب الإدارة',exact:true}).click();
 await panel.getByLabel('اسم الطالب',{exact:true}).fill('طالب مصحح');
 await panel.getByLabel('البريد الإلكتروني للدخول',{exact:true}).fill('changed@example.test');
 await panel.getByRole('button',{name:'حفظ التعديل',exact:true}).click();
 await panel.getByRole('button',{name:'تعديل حساب طالب مصحح',exact:true}).waitFor();
 assert.equal(stores[configPath('group2')].loginEmails[hash],undefined);
 await student.evaluate(()=>loadConfig());await student.locator('#loginPanel').waitFor({state:'visible'});
 await student.locator('#loginEmail').fill('changed@example.test');await student.locator('#loginForm button[type=submit]').click();
 await student.locator('#accountName').getByText('طالب مصحح',{exact:false}).waitFor();
 await prof.setViewportSize({width:390,height:844});await prof.screenshot({path:'/private/tmp/student-admin-mobile.png',fullPage:true});
 prof.once('dialog',d=>d.accept());await panel.getByRole('button',{name:'حذف حساب طالب مصحح',exact:true}).click();
 await panel.getByRole('button',{name:'حذف حساب طالب مصحح',exact:true}).waitFor({state:'detached'});
 assert.ok(!stores[configPath('group2')].students.includes('طالب مصحح'));
 assert.equal(Object.values(stores[configPath('group2')].loginEmails).some(p=>p.studentName==='طالب مصحح'),false);
 await student.evaluate(()=>loadConfig());await student.locator('#loginPanel').waitFor({state:'visible'});
 assert.deepEqual(errors,[]);console.log('PASS full production professor menu: add/email/edit/delete, isolated groups, mobile');
 }finally{await browser?.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
