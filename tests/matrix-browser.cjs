const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const production=process.env.TEST_PRODUCTION==='1';
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const w='2026-09-19';
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.pathname.startsWith('/api/')){
    const type=url.pathname.split('/')[2];
    const value=type==='jam'?{w:{startDate:w,students:['طالب'],confirmations:[{student:'طالب'}]}}:type==='review'?{[w]:{students:['طالب'],records:[{student:'طالب',complete:true}]}}:{weeks:{[w]:{students:['طالب']}},entries:{e:{student:'طالب',date:w}}};
    return route.fulfill({json:{value,revision:0}});
   }
   if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><link rel="stylesheet" href="matrix-dev.css"></head><body><main class="layout"><nav class="jam-navigation"><button>التسميع</button></nav></main><script src="weekly-clock.js"></script><script src="review-model.js"></script><script src="matrix-model.js"></script><script src="table-share.js"></script><script src="matrix-share.js"></script><script src="matrix-dev.js"></script></body></html>'});
   return route.fulfill({contentType:url.pathname.endsWith('.css')?'text/css':'text/javascript; charset=utf-8',body:await fs.readFile(path.join(__dirname,'..',url.pathname.slice(1)))});
  });
  await page.goto('http://matrix.test/');
  await page.evaluate(()=>{
   window.mountGroup=(id)=>ProfessorMatrix.mount({role:'professor',students:['طالب'],storageId:id,ready:true,day:id.endsWith('2')?0:6,host:document.querySelector('main'),local:true,recitations:[{date:'2026-09-19',statuses:{'طالب':'done'}}]});
   localStorage.setItem('shatibiyya-attendance-v1:login-test-group1',JSON.stringify([{date:'2026-09-19',participants:[{name:'طالب',key:'a',matched:true,late:true}],flags:{a:{removed:true}}}]));
   mountGroup('login-test-group1');
  });
  await page.getByRole('button',{name:'حالة الطلاب',exact:true}).click();
  await page.getByText('تم تحميل البيانات.',{exact:false}).waitFor();
  await page.getByLabel('أسبوع حالة الطلاب').selectOption(w);
  assert.equal(await page.getByRole('button',{name:'إغلاق الأسبوع وحفظ النتيجة'}).isDisabled(),true);
  for(const [label,n] of [['عدم التدارك','1'],['غياب دون عذر عن حصة الشاطبية','1'],['غياب دون عذر عن حصة الإقراء الفردي','1']]){
   const input=page.getByLabel(`طالب: ${label}`,{exact:true});await input.fill(n);await input.press('Tab');
  }
  await page.getByRole('button',{name:'إغلاق الأسبوع وحفظ النتيجة'}).click();
  await page.getByText('معلق الأسبوع التالي',{exact:true}).waitFor();
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('shatibiyya-matrix-v1:login-test-group1')));
  assert.equal(stored.closed[w].rows[0].result.largeCarry,0);assert.equal(stored.closed[w].rows[0].result.smallCarry,2);
  await page.reload();await page.evaluate(()=>{ProfessorMatrix.mount({role:'professor',students:['طالب'],storageId:'login-test-group1',ready:true,day:6,host:document.querySelector('main'),local:true,recitations:[{date:'2026-09-19',statuses:{'طالب':'done'}}]});});
  await page.getByRole('button',{name:'حالة الطلاب',exact:true}).click();await page.getByText('تم تحميل البيانات.',{exact:false}).waitFor();await page.getByLabel('أسبوع حالة الطلاب').selectOption(w);
  await page.getByText('معلق الأسبوع التالي',{exact:true}).waitFor();assert.ok(await page.locator('.matrix-table input').count()>0);
  await page.getByRole('button',{name:'علامة × طالب: عدم التدارك',exact:true}).click();
  await page.getByText('متاح الأسبوع التالي',{exact:true}).waitFor();
  await page.getByRole('button',{name:'إلغاء التصحيح طالب: عدم التدارك',exact:true}).click();
  await page.getByLabel('طالب: عدم التدارك',{exact:true}).fill('1');
  await page.getByLabel('طالب: عدم التدارك',{exact:true}).press('Tab');
  await page.getByText('معلق الأسبوع التالي',{exact:true}).waitFor();
  await page.getByLabel('طالب: قرار الأستاذ',{exact:true}).selectOption('allow');
  await page.getByText('متاح الأسبوع التالي',{exact:true}).waitFor();
  await page.getByLabel('طالب: قرار الأستاذ',{exact:true}).selectOption('auto');
  await page.getByText('معلق الأسبوع التالي',{exact:true}).waitFor();
  await page.getByRole('button',{name:'معاينة الصورة',exact:true}).click();
  await page.locator('.matrix-preview[open] img').waitFor();
  const picture=await page.locator('.matrix-preview img').getAttribute('src');
  await fs.writeFile('/tmp/student-status-share.png',Buffer.from(picture.split(',')[1],'base64'));
  await page.getByRole('button',{name:'إغلاق',exact:true}).click();
  const downloadPromise=page.waitForEvent('download');
  await page.getByRole('button',{name:'تصدير PNG',exact:true}).click();
  const download=await downloadPromise;assert.equal(download.suggestedFilename(),'student-status-login-test-group1-2026-09-19.png');
  await download.saveAs('/tmp/student-status-download.png');
  assert.equal((await fs.readFile('/tmp/student-status-download.png')).subarray(1,4).toString(),'PNG');
  await page.evaluate(()=>{
    Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});
    Object.defineProperty(navigator,'share',{configurable:true,value:async payload=>{window.sharedFile={name:payload.files[0].name,type:payload.files[0].type,size:payload.files[0].size};}});
  });
  await page.getByRole('button',{name:'مشاركة الجدولين',exact:true}).click();
  await page.getByText('تمت مشاركة الجدولين.',{exact:true}).waitFor();
  const shared=await page.evaluate(()=>window.sharedFile);assert.equal(shared.type,'image/png');assert.ok(shared.size>1000);
  // Full data is rendered independently of the visible viewport and editor widgets.
  const exported=await page.evaluate(()=>{
    const row=JSON.parse(localStorage.getItem('shatibiyya-matrix-v1:login-test-group1')).closed['2026-09-19'].rows[0];
    const text=[],original=CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText=function(value,...args){text.push(value);return original.call(this,value,...args);};
    try{const image=MatrixShare.render({rows:Array.from({length:40},(_,i)=>({...row,student:'طالب '+i})),week:{startDate:'2026-09-19',endDate:'2026-09-26'},group:'المجموعة 1',closed:true,previous:()=>({})});return {width:image.width,height:image.height,text};}
    finally{CanvasRenderingContext2D.prototype.fillText=original;}
  });
  assert.ok(exported.height>6000);assert.ok(exported.text.includes('طالب 39'));assert.ok(exported.text.some(x=>x.includes('×')));assert.ok(!exported.text.includes('قرار الأستاذ'));
  await page.screenshot({path:'/tmp/matrix-dev-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:'/tmp/matrix-dev-mobile.png',fullPage:true});
  await page.evaluate(()=>ProfessorMatrix.mount({role:'professor',students:['طالب'],storageId:'login-test-group2',ready:true,day:0,host:document.querySelector('main'),local:true,recitations:[{date:'2026-09-20',statuses:{'طالب':'done'}}]}));
  await page.getByText('تم تحميل البيانات.',{exact:false}).waitFor();assert.equal(await page.getByText('معلق الأسبوع التالي',{exact:true}).count(),0);
  assert.equal(await page.evaluate(()=>localStorage.getItem('shatibiyya-matrix-v1:login-test-group2')),null);
  assert.deepEqual(errors,[]);
  let liveRecitation='';let remoteMatrix=null;
  const integrated=await browser.newPage({viewport:{width:1440,height:1000}});
  await integrated.addInitScript(()=>{window.streams=[];window.EventSource=class{constructor(url){this.url=url;this.events={};window.streams.push(this);}addEventListener(type,fn){this.events[type]=fn;}close(){this.closed=true;}};window.signalMatrix=()=>streams.filter(s=>!s.closed).forEach(s=>s.events.patch?.({data:'{}'}));});
  integrated.on('pageerror',e=>errors.push(e.message));
  await integrated.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.hostname.endsWith('firebasedatabase.app')){
    if(production)assert.doesNotMatch(url.pathname,/login-(test|sandbox)/);else assert.match(url.pathname,/login-(test|sandbox)/);
    if(url.pathname.endsWith('/studentStatus.json')){if(route.request().method()==='PUT')remoteMatrix=route.request().postDataJSON();return route.fulfill({json:remoteMatrix,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-expose-headers':'ETag',ETag:'\"0\"'}});}
    const value=url.pathname.startsWith('/config')?{students:['طالب'],weeks:[{id:'matrix-w',date:w,start:1,end:10}],settings:{weekBoundaryDay:url.pathname.includes('group2')?0:6},statuses:{'طالب__matrix-w':liveRecitation}}:{};
    return route.fulfill({json:value,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-expose-headers':'ETag',ETag:'"0"'}});
   }
   if(url.hostname!=='matrix.test')return route.fulfill({body:''});
   const file=url.pathname.slice(1);
   return route.fulfill({contentType:file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8',body:await fs.readFile(path.join(__dirname,'..',file))});
  });
  await integrated.goto('http://matrix.test/'+(production?'index.html':'prof-login-dev.html')+'?devMode=data');
  await integrated.getByRole('button',{name:'حالة الطلاب',exact:true}).click();
  await integrated.getByText('تم تحميل البيانات.',{exact:false}).waitFor();
  await integrated.getByLabel('أسبوع حالة الطلاب').selectOption(w);
  const recital=integrated.getByLabel('طالب: عدم تسميع الأبيات',{exact:true});
  assert.equal(await recital.inputValue(),'1');
  liveRecitation='done';await integrated.evaluate(()=>signalMatrix());
  await integrated.waitForFunction(()=>document.querySelector('input[aria-label="طالب: عدم تسميع الأبيات"]')?.value==='0');
  await recital.fill('2');await recital.press('Tab');
  if(production){for(let i=0;i<100&&!remoteMatrix?.overrides?.[w];i++)await integrated.waitForTimeout(20);assert.ok(remoteMatrix?.overrides?.[w]);}
  liveRecitation='missed';await integrated.evaluate(()=>signalMatrix());await integrated.waitForTimeout(600);
  assert.equal(await recital.inputValue(),'2');
  await integrated.locator('#groupSelect').selectOption('group2');
  await integrated.getByText('تم تحميل البيانات.',{exact:false}).waitFor();
  assert.equal(await integrated.locator('.matrix-panel').isVisible(),true);
  await integrated.screenshot({path:'/tmp/matrix-dev-integrated.png',fullPage:true});
  await integrated.getByRole('button',{name:'التسميع',exact:true}).click();
  assert.equal(await integrated.locator('.matrix-panel').isVisible(),false);
  assert.deepEqual(errors,[]);
  console.log('Matrix browser: manual entry, closure, suspension, reload, group isolation and mobile passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
