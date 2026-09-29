const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
 for(const group of ['group1','group2']){
  const context=await browser.newContext({viewport:{width:390,height:844}}),storage=`login-test-${group}`,date=group==='group1'?'2026-09-26':'2026-09-27';
  const configPath=`/config/groups/${storage}.json`,reviewPath=`/review/groups/${storage}.json`,jamPath=`/jam/groups/${storage}.json`,khatmaPath=`/khatma/groups/${storage}.json`;
  const stores={
   [configPath]:{students:['أحمد','علي'],studentAliases:[],weeks:[{id:'w',date,start:1,end:10}],settings:{weekBoundaryDay:group==='group1'?6:0},statuses:{}},
   [reviewPath]:{[date]:{id:date,startDate:date,endDate:group==='group1'?'2026-10-03':'2026-10-04',students:['أحمد','علي'],records:[]}},
   [jamPath]:{['week-'+date]:{id:'week-'+date,startDate:date,endDate:group==='group1'?'2026-10-03':'2026-10-04',timeZone:'Europe/Paris',students:['أحمد','علي'],verses:['1','2'],confirmations:[{student:'علي',verseIndex:0}]}},
   [khatmaPath]:{},'/khatma/catalogs/login-test.json':{},[`/submissions/groups/${storage}.json`]:{}
  };
  let failing=false;const errors=[];
  await context.addInitScript(()=>{
   window.SHATIBIYYA_JAM_LOCAL_DEV=false;
   localStorage.setItem('shatibiyya-login-test-session',JSON.stringify({email:'test@example.test',emailOnly:true,expiresAt:Date.now()+86400000}));
   window.streams=[];window.EventSource=class {constructor(url){this.url=url;this.events={};this.closed=false;window.streams.push(this);}addEventListener(type,fn){this.events[type]=fn;}close(){this.closed=true;}};
   window.signalActivity=part=>{for(const stream of window.streams)if(!stream.closed&&stream.url.includes(part))stream.events.patch?.({data:'{}'});};
  });
  await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.hostname.endsWith('firebasedatabase.app')){
    assert.match(url.pathname,/login-(test|sandbox)/);
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
  await page.goto('http://localhost/student-login-dev.html');
  await page.locator('.dashboard-card[data-activity=review]').waitFor();
  assert.equal(await page.locator('#submissionForm').isVisible(),false);
  assert.match(await page.locator('.student-dashboard').innerText(),/أسبوع جديد/);
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
