// Offline browser replay of a private, freshly captured production snapshot.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const R=require('../roster-model'),D=require('../student-dashboard-model');
(async()=>{
 const snapshot=JSON.parse(await fs.readFile(process.argv[2],'utf8')),now=new Date(),browser=await chromium.launch({headless:true,channel:'chrome'});let requests=0;
 try{
 for(const group of ['group1','group2']){
  const config=group==='group1'?snapshot.config.value:snapshot.config.value.groups[group];
  const names=group==='group1'?['حسام حفيظ',...config.students.filter(n=>n==='فراس المسعدي'||n==='فارس المسعدي')]:[config.students[0]];
  for(const name of names){
   const stores={};for(const [p,s]of Object.entries(snapshot))stores['/'+p+'.json']=structuredClone(s.value);
   stores['/config/groups/group2.json']=structuredClone(snapshot.config.value.groups.group2);stores['/submissions/groups/group2.json']=structuredClone(snapshot.submissions.value?.groups?.group2||{});
   const context=await browser.newContext({viewport:{width:390,height:844}}),errors=[];
   await context.addInitScript(()=>{window.EventSource=class{addEventListener(){}close(){}};localStorage.setItem('shatibiyya-production-session',JSON.stringify({email:'fixture@example.test',emailOnly:true,expiresAt:Date.now()+86400000}));});
   await context.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.hostname.endsWith('firebasedatabase.app')){
     requests++;assert.doesNotMatch(url.pathname,/login-(test|sandbox)/);
     const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,PUT,PATCH,OPTIONS','access-control-expose-headers':'ETag',ETag:'"0"'};
     if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
     if(url.pathname.includes('loginEmails'))return route.fulfill({headers,json:{role:'student',studentName:name,groupId:group}});
     if(url.pathname.endsWith('/studentStatus.json'))return route.fulfill({headers,json:config.studentStatus||null});
     assert.ok(Object.hasOwn(stores,url.pathname),url.pathname);
     if(req.method()==='PUT')stores[url.pathname]=req.postDataJSON();
     return route.fulfill({headers,json:stores[url.pathname]});
    }
    assert.equal(url.hostname,'localhost');const file=url.pathname.slice(1);return route.fulfill({body:await fs.readFile(path.join(__dirname,'..',file)),contentType:file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css':'text/javascript; charset=utf-8'});
   });
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.clock.install({time:now});await page.goto('http://localhost/student.html');await page.locator('.dashboard-card').first().waitFor();
   const expected=D.summary({name:R.resolve(name,config.studentAliases),day:config.settings.weekBoundaryDay,config:R.config(config),jam:R.project(snapshot[`jam/groups/${group}`].value,config.studentAliases),review:R.project(snapshot[`review/groups/${group}`].value,config.studentAliases),khatma:R.project(snapshot[`khatma/groups/${group}`].value,config.studentAliases),jamEnabled:group==='group1'},now);
   for(const card of expected.cards)assert.ok((await page.locator(`[data-activity=${card.id}]`).getAttribute('class')).includes('dashboard-'+card.state));
   await page.screenshot({path:`/tmp/prod-weekly-${group}-${names.indexOf(name)}.png`,fullPage:true});assert.deepEqual(errors,[]);await context.close();
  }
 }
 console.log(`PASS: current PROD snapshots match weekly cards in both groups; ${requests} requests intercepted locally, zero remote writes.`);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
