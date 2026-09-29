const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
 let store=null,revision=0,conflict=false,offline=false;const errors=[];
 const pages=[];
 for(let i=0;i<2;i++){
  const context=await browser.newContext();
  await context.addInitScript(()=>{window.streams=[];window.EventSource=class{constructor(url){this.url=url;this.events={};streams.push(this);}addEventListener(type,fn){this.events[type]=fn;}close(){this.closed=true;}};window.signal=()=>streams.filter(s=>!s.closed).forEach(s=>s.events.patch?.({data:'{}'}));});
  await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.pathname==='/config/studentStatus.json'){
    const headers={'ETag':`"${revision}"`};
    if(req.method()==='PUT'){
     if(offline)return route.fulfill({status:503,json:{}});
     if(conflict){conflict=false;store={...(store||{}),remoteMarker:'preserve me'};revision++;return route.fulfill({status:412,json:{}});}
     if(req.headers()['if-match']!==headers.ETag)return route.fulfill({status:412,json:{}});
     store=req.postDataJSON();revision++;
    }
    return route.fulfill({json:store,headers});
   }
   if(url.pathname==='/config.json')return route.fulfill({json:{students:['طالب'],weeks:[{id:'w',date:'2026-09-19'}],settings:{weekBoundaryDay:6},statuses:{'طالب__w':'done'}}});
   if(url.pathname.startsWith('/source/'))return route.fulfill({json:{}});
   if(url.pathname==='/')return route.fulfill({contentType:'text/html; charset=utf-8',body:'<html><body><main><nav class="jam-navigation"><button>التسميع</button></nav></main>'+['weekly-clock.js','review-model.js','roster-model.js','roster.js','matrix-model.js','matrix-share.js','live-data.js','matrix-store.js','matrix.js'].map(s=>`<script src="/${s}"></script>`).join('')+'</body></html>'});
   return route.fulfill({body:await fs.readFile(path.join(__dirname,'..',url.pathname.slice(1))),contentType:'text/javascript; charset=utf-8'});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.clock.install({time:new Date('2026-09-29T12:00:00Z')});await page.goto('http://localhost/');
  await page.evaluate(()=>ProfessorMatrix.mount({role:'professor',students:['طالب'],storageId:'group1',ready:true,day:6,host:document.querySelector('main'),recitations:[{id:'w',date:'2026-09-19',statuses:{'طالب':'done'}}],rosterUrl:()=>'/config.json',sourceUrl:type=>'/source/'+type+'.json',matrixUrl:()=>location.origin+'/config/studentStatus.json'}));
  await page.getByRole('button',{name:'حالة الطلاب',exact:true}).click();await page.getByText('تم تحميل البيانات.',{exact:false}).waitFor();await page.getByLabel('أسبوع حالة الطلاب').selectOption('2026-09-19');pages.push(page);
 }
 const [a,b]=pages,cell=p=>p.getByLabel('طالب: عدم التدارك',{exact:true});
 conflict=true;await cell(a).fill('1');await cell(a).press('Tab');await a.getByText('تم حفظ تصحيح الأستاذ في Firebase',{exact:false}).waitFor();assert.equal(store.remoteMarker,'preserve me');
 await b.evaluate(()=>signal());await b.clock.runFor(400);await b.waitForFunction(()=>document.querySelector('input[aria-label="طالب: عدم التدارك"]').value==='1');
 await cell(b).fill('2');await cell(b).press('Tab');await b.getByText('تم حفظ تصحيح الأستاذ في Firebase',{exact:false}).waitFor();
 await a.evaluate(()=>signal());await a.clock.runFor(400);await a.waitForFunction(()=>document.querySelector('input[aria-label="طالب: عدم التدارك"]').value==='2');
 const saved=JSON.stringify(store);offline=true;await cell(a).fill('7');await cell(a).press('Tab');await a.getByText('تعذر الحفظ في Firebase.',{exact:false}).waitFor();assert.equal(JSON.stringify(store),saved);assert.equal(await cell(a).inputValue(),'2');offline=false;
 await a.evaluate(()=>window.dispatchEvent(new CustomEvent('shatibiyya:attendance-saved',{detail:{storageId:'group1',changed:[{id:'session',date:'2026-09-19',participants:[{key:'p',name:'طالب',matched:true,late:true}]}],removed:[]}})));
 await a.waitForFunction(()=>localStorage.getItem('shatibiyya-matrix-attendance-pending:group1')===null);
 await b.evaluate(()=>signal());await b.clock.runFor(400);await b.waitForFunction(()=>document.querySelector('input[aria-label="طالب: تأخر عن حصة الشاطبية"]').value==='1');
 // Set missing inputs, close a historical week, then read its suspension on the other device.
 for(const label of ['تأخر عن حصة الشاطبية','إخراج لعدم الاستجابة','غياب دون عذر عن حصة الشاطبية','غياب دون عذر عن حصة الإقراء الفردي','عدم مراجعة كامل المطلوب','عدم تعبئة نموذج متابعة الختمة الفردية','عدم إتمام واجب الجمع','عدم المراجعة']){
  const input=a.getByLabel('طالب: '+label,{exact:true});await input.fill('0');await input.press('Tab');await a.getByText('تم حفظ تصحيح الأستاذ في Firebase',{exact:false}).waitFor();
 }
 await a.getByRole('button',{name:'إغلاق الأسبوع وحفظ النتيجة',exact:true}).click();await a.getByText('تم إغلاق الأسبوع وحفظ حالة كل طالب والرصيد القادم في Firebase.',{exact:true}).waitFor();assert.ok(store.closed['2026-09-19']);
 await b.evaluate(()=>signal());await b.clock.runFor(400);await b.getByText(/أسبوع مغلق · حالة الختمة/).waitFor();
 assert.deepEqual(errors,[]);console.log('PASS: independent browsers share corrections and closure; conflict retries preserve other edits; failed saves do not appear saved.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
