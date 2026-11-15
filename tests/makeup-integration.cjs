const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const production=process.env.TEST_PRODUCTION==='1';
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
  let failing=false,importConflict=false;const errors=[];
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
    if(req.method()==='PUT'&&importConflict&&url.pathname.endsWith('/makeup.json'))return route.fulfill({status:412,json:{},headers});
    if(req.method()==='PUT')stores[url.pathname]=req.postDataJSON();
    return route.fulfill({json:stores[url.pathname],headers});
   }
   if(url.hostname!=='localhost')return route.fulfill({body:''});
   const file=url.pathname.slice(1);return route.fulfill({body:await fs.readFile(path.join(__dirname,'..',file)),contentType:file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8'});
  });
  const page=await context.newPage();page.on('pageerror',e=>{errors.push(e.message);console.error(e.message)});await page.clock.install({time:new Date('2026-09-29T12:00:00Z')});
  await page.goto('http://localhost/'+(production?'student.html':'student-login-dev.html'));
  await page.locator('.dashboard-card[data-activity=review]').waitFor();
  assert.equal(await page.locator('#submissionForm').isVisible(),false);
  assert.match(await page.locator('.student-dashboard').innerText(),/أسبوع جديد/);
  await page.getByRole('button',{name:'التدارك',exact:true}).click();
  await page.locator('.makeup-panel').waitFor();
  await page.getByRole('button',{name:'أسبوعي',exact:true}).click();
  await page.locator('.dashboard-card[data-activity=review]').waitFor();
  const prof=await context.newPage();prof.on('pageerror',e=>errors.push(e.message));
  await prof.goto('http://localhost/index.html');
  if(group==='group2')await prof.locator('#groupSelect').selectOption('group2');
  await prof.getByRole('button',{name:'التدارك',exact:true}).click();
  assert.equal(await prof.locator('#makeup-import-rows').count(),0);
  await prof.waitForFunction(()=>!document.querySelector('#makeup-file').disabled);
  const XLSX=require('../vendor/xlsx.full.min.js');
  const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['الاسم','أقل من 50% في الاختبار','حضور أقل من 70%','غياب'],['أحمد','105-107','','']]),'التدارك');
  const bytes=XLSX.write(book,{type:'buffer',bookType:group==='group1'?'xlsx':'biff8'});
  await prof.locator('#makeup-file').setInputFiles({name:group==='group1'?'table.xlsx':'table.xls',mimeType:'application/octet-stream',buffer:Buffer.from(bytes)});
  await prof.getByRole('button',{name:'نشر التدارك',exact:true}).click();
  await prof.waitForFunction(()=>document.querySelector('.makeup-panel .result-box').textContent==='تم نشر التدارك من الملف بنجاح');
  assert.equal(Object.keys(stores[configPath.replace('.json','/makeup.json')].debts).length,2);
  assert.equal(await prof.locator('#makeup-file').inputValue(),'');
  // The same file is idempotent and cannot erase the previous debts.
  await prof.locator('#makeup-file').setInputFiles({name:'table.xlsx',mimeType:'application/octet-stream',buffer:Buffer.from(XLSX.write(book,{type:'buffer',bookType:'xlsx'}))});
  await prof.getByRole('button',{name:'نشر التدارك',exact:true}).click();
  await prof.waitForFunction(()=>document.querySelector('.makeup-panel .result-box').textContent==='تم نشر التدارك من الملف بنجاح');
  assert.equal(Object.keys(stores[configPath.replace('.json','/makeup.json')].debts).length,2);
  const makeupPath=configPath.replace('.json','/makeup.json'),M=require('../makeup-model');
  stores[makeupPath]=M.confirm(stores[makeupPath],'علي','أحمد',105,['أحمد','علي']);
  await prof.getByRole('button',{name:'تحديث',exact:true}).click();
  await prof.waitForFunction(()=>document.querySelector('.makeup-panel .review-green')?.textContent==='تم · علي');
  assert.equal(await prof.locator('.makeup-panel table tr').count(),3);
  // Navigation and a full page reload between uploads preserve the completed row.
  await prof.reload();
  if(group==='group2')await prof.locator('#groupSelect').selectOption('group2');
  await prof.getByRole('button',{name:'التدارك',exact:true}).click();
  await prof.waitForFunction(()=>document.querySelector('.makeup-panel .review-green')?.textContent==='تم · علي');
  let before=JSON.stringify(stores[makeupPath]);
  const bad=XLSX.utils.book_new();XLSX.utils.book_append_sheet(bad,XLSX.utils.aoa_to_sheet([['الاسم','غياب'],['اسم غير معروف','108']]),'التدارك');
  await prof.locator('#makeup-file').setInputFiles({name:'bad.xlsx',mimeType:'application/octet-stream',buffer:Buffer.from(XLSX.write(bad,{type:'buffer',bookType:'xlsx'}))});
  await prof.getByRole('button',{name:'نشر التدارك',exact:true}).click();
  await prof.waitForFunction(()=>document.querySelector('.makeup-panel .result-box').textContent.includes('الاسم غير مطابق'));
  assert.equal(JSON.stringify(stores[configPath.replace('.json','/makeup.json')]),before);
  assert.notEqual(await prof.locator('#makeup-file').inputValue(),'');
  assert.equal(await prof.locator('.makeup-panel .review-green').count(),1);
  // Only a successful new upload removes the completed row, even if the file repeats it.
  await prof.locator('#makeup-file').setInputFiles({name:'next.xlsx',mimeType:'application/octet-stream',buffer:Buffer.from(XLSX.write(book,{type:'buffer',bookType:'xlsx'}))});
  importConflict=true;
  await prof.getByRole('button',{name:'نشر التدارك',exact:true}).click();
  await prof.waitForFunction(()=>document.querySelector('.makeup-panel .result-box').textContent.includes('تغيرت القائمة'));
  assert.equal(JSON.stringify(stores[makeupPath]),before);
  assert.equal(await prof.locator('.makeup-panel .review-green').count(),1);
  assert.notEqual(await prof.locator('#makeup-file').inputValue(),'');
  importConflict=false;
  await prof.getByRole('button',{name:'نشر التدارك',exact:true}).click();
  await prof.waitForFunction(()=>document.querySelector('.makeup-panel .result-box').textContent==='تم نشر التدارك من الملف بنجاح');
  assert.deepEqual(M.entries(stores[makeupPath]).map(d=>d.lesson),[107]);
  assert.equal(await prof.locator('.makeup-panel .review-green').count(),0);
  assert.equal(await prof.locator('.makeup-panel table tr').count(),2);
  assert.match(await prof.locator('.makeup-panel').innerText(),/1 دروس مطلوبة · 0 مكتملة/);
  const completed=Object.values(stores[makeupPath].debts).find(d=>d.lesson===105);
  assert.equal(completed.completed.validator,'علي');assert.ok(completed.archivedAt);
  if(group==='group1')await prof.screenshot({path:'/private/tmp/makeup-import-cleanup-mobile.png',fullPage:true});
  before=JSON.stringify(stores[makeupPath]);
  // An import finishing after a group switch cannot write to either group.
  await prof.locator('#makeup-file').setInputFiles({name:'next.xlsx',mimeType:'application/octet-stream',buffer:Buffer.from(bytes)});
  await prof.evaluate(()=>{MakeupImport.read=()=>new Promise(resolve=>window.completeOldImport=resolve);});
  await prof.getByRole('button',{name:'نشر التدارك',exact:true}).click();
  await prof.waitForFunction(()=>!!window.completeOldImport);
  await prof.evaluate(()=>{Makeup.mount({role:'professor',students:['أحمد','علي'],storageId:'other-group',host:document.querySelector('main.layout'),url:()=> 'https://groupe-shatibiyya-default-rtdb.asia-southeast1.firebasedatabase.app/config/other/makeup.json'});window.completeOldImport({rows:[{student:'أحمد',lessons:'999',reason:'غياب'}],source:{name:'old.xlsx'}});});
  await prof.waitForFunction(()=>!document.querySelector('#makeup-file').disabled);
  assert.equal(JSON.stringify(stores[configPath.replace('.json','/makeup.json')]),before);
  if(group==='group1')await prof.screenshot({path:'/private/tmp/makeup-file-upload-mobile.png',fullPage:true});
  // Real student page and confirmation dialog, with the user's 115/116 example.
  stores[makeupPath]=M.add({},[{student:'أحمد',lessons:'115'},{student:'علي',lessons:'115,116'}],['أحمد','علي']);
  await page.getByRole('button',{name:'التدارك',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('[name=makeupLesson]')?.options.length===2);
  const lesson=page.locator('[name=makeupLesson]'),confirm=page.getByRole('button',{name:'تأكيد تدارك زميلي',exact:true});
  await lesson.selectOption('115');assert.equal(await confirm.isDisabled(),true);
  await lesson.selectOption('116');assert.equal(await confirm.isEnabled(),true);
  await confirm.click();await page.locator('dialog[open]').getByRole('button',{name:'تأكيد',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.makeup-panel .result-box').textContent==='تم الحفظ');
  assert.deepEqual(M.pending(stores[makeupPath],'علي').map(d=>d.lesson),[115]);
  assert.equal(Object.values(stores[makeupPath].debts).find(d=>d.lesson===116).completed.validator,'أحمد');
  assert.deepEqual(errors,[]);await context.close();console.log('PASS integration',group);
 }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
