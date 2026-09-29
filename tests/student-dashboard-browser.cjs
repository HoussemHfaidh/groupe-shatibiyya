const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const production=process.env.TEST_PRODUCTION==='1';
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
 for(const group of ['group1','group2']){
  const context=await browser.newContext({viewport:{width:390,height:844}}),storage=production?group:`login-test-${group}`,date=group==='group1'?'2026-09-26':'2026-09-27';
  const configPath=production&&group==='group1'?'/config.json':`/config/groups/${storage}.json`,reviewPath=`/review/groups/${storage}.json`,jamPath=`/jam/groups/${storage}.json`,khatmaPath=`/khatma/groups/${storage}.json`;
  const stores={
   [configPath]:{students:['أحمد','علي'],studentAliases:[],weeks:[{id:'w',date,start:1,end:10}],settings:{weekBoundaryDay:group==='group1'?6:0},statuses:{}},
   [reviewPath]:{[date]:{id:date,startDate:date,endDate:group==='group1'?'2026-10-03':'2026-10-04',students:['أحمد','علي'],records:[]}},
   [jamPath]:{['week-'+date]:{id:'week-'+date,startDate:date,endDate:group==='group1'?'2026-10-03':'2026-10-04',timeZone:'Europe/Paris',students:['أحمد','علي'],verses:['1','2'],confirmations:[{student:'علي',verseIndex:0}]}},
   [khatmaPath]:{},[production?'/khatma/catalogs/production.json':'/khatma/catalogs/login-test.json']:{},[production&&group==='group1'?'/submissions.json':`/submissions/groups/${storage}.json`]:{}
  };
  let failing=false;const errors=[];
  await context.addInitScript(production=>{
   window.SHATIBIYYA_JAM_LOCAL_DEV=false;
   localStorage.setItem(production?'shatibiyya-production-session':'shatibiyya-login-test-session',JSON.stringify({email:'test@example.test',emailOnly:true,expiresAt:Date.now()+86400000}));
   window.streams=[];window.EventSource=class {constructor(url){this.url=url;this.events={};this.closed=false;window.streams.push(this);}addEventListener(type,fn){this.events[type]=fn;}close(){this.closed=true;}};
   window.signalActivity=part=>{for(const stream of window.streams)if(!stream.closed&&stream.url.includes(part))stream.events.patch?.({data:'{}'});};
  },production);
  await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.hostname.endsWith('firebasedatabase.app')){
    if(production)assert.doesNotMatch(url.pathname,/login-(test|sandbox)/);else assert.match(url.pathname,/login-(test|sandbox)/);
    const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,PUT,PATCH,POST,OPTIONS','access-control-expose-headers':'ETag',ETag:'"0"'};
    if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
    if(url.pathname.includes('loginEmails'))return route.fulfill({json:{role:'student',studentName:'أحمد',groupId:group},headers});
    if(failing&&url.pathname===reviewPath)return route.fulfill({status:503,json:{},headers});
    assert.ok(Object.hasOwn(stores,url.pathname),url.pathname);
    if(req.method()==='PUT')stores[url.pathname]=req.postDataJSON();
    return route.fulfill({json:stores[url.pathname],headers});
   }
   if(url.hostname!=='localhost')return route.fulfill({body:''});
   const file=url.pathname.slice(1);return route.fulfill({body:await fs.readFile(path.join(__dirname,'..',file)),contentType:file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8'});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.clock.install({time:new Date('2026-09-29T12:00:00Z')});
  await page.goto('http://localhost/'+(production?'student.html':'student-login-dev.html'));
  await page.locator('.dashboard-card[data-activity=review]').waitFor();
  assert.equal(await page.locator('#submissionForm').isVisible(),false);
  assert.match(await page.locator('.student-dashboard').innerText(),/أسبوع جديد/);
  const prof=await context.newPage();prof.on('pageerror',e=>errors.push(e.message));
  await prof.clock.install({time:new Date('2026-09-29T12:00:00Z')});
  await prof.goto('http://localhost/'+(production?'student.html':'student-login-dev.html'));
  await prof.evaluate(async ({storage,group,production})=>{
    StudentDashboard.logout();Review.logout();Jam.logout();Khatma.logout();
    document.body.innerHTML='<main><div class="jam-professor-navigation"><nav class="jam-navigation"><button>التسميع</button></nav></div></main>';
    await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='table-share.js';s.onload=resolve;s.onerror=reject;document.head.append(s);});
    // A fresh review module provides the real professor table and editing dialogs.
    for(const src of production?['review.js','activity-live.js']:['review-dev.js','activity-live-dev.js'])await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.head.append(s);});
    Review.mount({role:'professor',students:['أحمد','علي'],storageId:storage,ready:true,day:group==='group1'?6:0,host:document.querySelector('main'),firebaseUrl:()=>`https://groupe-shatibiyya-default-rtdb.asia-southeast1.firebasedatabase.app/review/groups/${storage}.json`});
  },{storage,group,production});
  await prof.getByRole('button',{name:'المراجعة',exact:true}).click();
  await prof.locator('.review-cell-button').first().waitFor();
  await page.locator('.dashboard-card[data-activity=review]').click();
  const reviewPanel=page.locator('.review-panel');
  await reviewPanel.getByLabel('الطالب الذي قرأ عليّ').selectOption('علي');
  await reviewPanel.getByLabel('القسم الذي قرأه').selectOption('1');
  await reviewPanel.getByLabel('المدة بالدقائق').fill('5');await reviewPanel.getByLabel('عدد الأخطاء').fill('0');
  await reviewPanel.getByRole('button',{name:'تأكيد مراجعة زميلي'}).click();
  await page.getByRole('button',{name:'نعم، إلى النهاية',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.review-panel form select').options.length===0);
  await page.getByRole('button',{name:'أسبوعي',exact:true}).click();
  await page.getByText('أكدت مراجعة زميلك؛ مراجعتك أنت تنتظر تأكيد زميلك',{exact:true}).waitFor();
  await page.getByText('تأكيداتي لزملائي هذا الأسبوع: 1',{exact:true}).waitFor();
  await prof.evaluate(()=>signalActivity('/review/'));await prof.clock.runFor(400);
  await prof.waitForFunction(()=>[...document.querySelectorAll('.review-cell-button')].some(b=>b.getAttribute('aria-label').startsWith('علي ·')&&b.textContent==='X'));
  const ownCell=prof.locator('.review-cell-button').filter({hasText:'—'}).first();
  await ownCell.click();await prof.getByRole('button',{name:'القسم الثاني مكتمل — أخضر',exact:true}).click();
  await prof.locator('[name=durationMinutes]').fill('5');await prof.locator('[name=errorCount]').fill('0');await prof.getByRole('button',{name:'حفظ',exact:true}).click();
  await prof.waitForFunction(()=>[...document.querySelectorAll('.review-cell-button')].some(b=>b.getAttribute('aria-label').startsWith('أحمد ·')&&b.textContent==='X'));
  await page.evaluate(()=>signalActivity('/review/'));await page.clock.runFor(400);
  await page.locator('.dashboard-card[data-activity=review].dashboard-done').waitFor();
  await prof.locator('.review-cell-button').filter({hasText:'X'}).first().click();await prof.getByRole('button',{name:'مسح النتيجة',exact:true}).click();
  await prof.waitForFunction(()=>[...document.querySelectorAll('.review-cell-button')].some(b=>b.getAttribute('aria-label').startsWith('أحمد ·')&&b.textContent==='—'));
  await page.evaluate(()=>signalActivity('/review/'));await page.clock.runFor(400);
  await page.waitForFunction(()=>document.querySelector('.dashboard-card[data-activity=review] .dashboard-badge').textContent.includes('لم يكتمل'));
  await prof.close();

  stores[reviewPath][date].records.push({student:'عمر',validator:'أحمد',complete:true});
  await page.evaluate(()=>signalActivity('/review/'));await page.clock.runFor(400);
  await page.getByText('تأكيداتي لزملائي هذا الأسبوع: 2',{exact:true}).waitFor();
  assert.match(await page.locator('.dashboard-card[data-activity=review] .dashboard-badge').innerText(),/مراجعتي:.*لم يكتمل/);
  assert.ok((stores[reviewPath][date].records||[]).some(r=>r.student==='علي'&&r.validator==='أحمد'));
  stores[configPath].statuses['احمد__w']='done';stores[reviewPath][date].records=[{student:'أحمد',complete:false}];stores[jamPath]['week-'+date].confirmations.push({student:'أحمد',verseIndex:1});stores[khatmaPath]={entries:{e:{student:'أحمد',date,attendance:'present'}}};
  await page.evaluate(()=>signalActivity('/review/'));await page.clock.runFor(400);
  await page.locator('.dashboard-partial').waitFor();
  assert.match(await page.locator('.dashboard-card[data-activity=recitation]').innerText(),/مكتمل/);
  stores[reviewPath][date].records[0].complete=true;await page.evaluate(()=>signalActivity('/review/'));await page.clock.runFor(400);
  await page.locator('.dashboard-hero.dashboard-sun').waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:`/tmp/dashboard-${group}-mobile.png`,fullPage:true});
  await page.locator('.dashboard-card[data-activity=review]').click();assert.equal(await page.locator('.student-dashboard').isVisible(),false);assert.equal(await page.locator('.review-panel').isVisible(),true);
  await page.clock.runFor(30000);await page.waitForTimeout(300);assert.equal(await page.locator('.review-panel').isVisible(),true);assert.equal(await page.locator('#submissionForm').isVisible(),false);
  await page.getByRole('button',{name:'أسبوعي',exact:true}).click();assert.equal(await page.locator('.student-dashboard').isVisible(),true);
  failing=true;await page.evaluate(()=>signalActivity('/review/'));await page.clock.runFor(400);await page.locator('.dashboard-card.dashboard-unknown').waitFor();assert.match(await page.locator('.dashboard-connection').innerText(),/تعذر/);
  failing=false;await page.getByRole('button',{name:'تحديث حالتي',exact:true}).click();await page.locator('.dashboard-hero.dashboard-sun').waitFor();
  await page.locator('#logoutBtn').click();assert.equal(await page.locator('#studentPanel').isVisible(),false);assert.equal(await page.evaluate(()=>streams.filter(s=>!s.closed).length),0);
  assert.deepEqual(errors,[]);await context.close();
 }
 console.log('Student dashboard: both groups, live updates, partial review, offline recovery, links, mobile and logout passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
