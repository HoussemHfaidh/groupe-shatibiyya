const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const production=true;
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
 for(const group of ['group1','group2']){
  const context=await browser.newContext({viewport:{width:390,height:844}}),storage=production?group:`login-test-${group}`,date=group==='group1'?'2026-09-26':'2026-09-27';
  const configPath=production&&group==='group1'?'/config.json':`/config/groups/${storage}.json`,reviewPath=`/review/groups/${storage}.json`,jamPath=`/jam/groups/${storage}.json`,khatmaPath=`/khatma/groups/${storage}.json`;
  const stores={
   [configPath.replace('.json','/makeup.json')]:{},
   [configPath]:{loginEmails:{[require('node:crypto').createHash('sha256').update('test@example.test').digest('hex')]:{role:'student',studentName:'أحمد',groupId:group}},students:['أحمد','علي'],studentAliases:[],weeks:[{id:'w',date,start:1,end:10}],settings:{weekBoundaryDay:group==='group1'?6:0},statuses:{}},
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
    if(!Object.hasOwn(stores,url.pathname))return route.fulfill({json:{},headers});
    if(req.method()==='PUT')stores[url.pathname]=req.postDataJSON();
    return route.fulfill({json:stores[url.pathname],headers});
   }
   if(url.hostname!=='localhost')return route.fulfill({body:''});
   const file=url.pathname.slice(1);return route.fulfill({body:await fs.readFile(path.join(__dirname,'..',file)),contentType:file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8'});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost/index.html');
  if(group==='group2')await page.locator('#groupSelect').selectOption('group2');
  await page.getByRole('button',{name:'سجل الحضور',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('.presence-register input[name=lesson]').disabled);
  assert.equal(await page.locator('.presence-register').isVisible(),true);
  assert.equal(await page.locator('.presence-table tbody tr').count(),2);
  await page.getByRole('button',{name:'التدارك',exact:true}).click();
  assert.equal(await page.locator('.presence-register').isVisible(),false);
  await page.getByRole('button',{name:'سجل الحضور',exact:true}).click();
  assert.equal(await page.locator('.makeup-panel').isVisible(),false);
  await page.screenshot({path:'/private/tmp/presence-integrated-'+group+'.png',fullPage:true});
  assert.deepEqual(errors,[]);await context.close();
 }
 console.log('PASS production page integration, group 1 and 2, mobile navigation, no page errors');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
