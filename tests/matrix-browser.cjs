const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
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
   if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><link rel="stylesheet" href="matrix-dev.css"></head><body><main class="layout"><nav class="jam-navigation"><button>التسميع</button></nav></main><script src="weekly-clock.js"></script><script src="review-model.js"></script><script src="matrix-model.js"></script><script src="matrix-dev.js"></script></body></html>'});
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
  await page.screenshot({path:'/tmp/matrix-dev-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:'/tmp/matrix-dev-mobile.png',fullPage:true});
  await page.evaluate(()=>ProfessorMatrix.mount({role:'professor',students:['طالب'],storageId:'login-test-group2',ready:true,day:0,host:document.querySelector('main'),local:true,recitations:[{date:'2026-09-20',statuses:{'طالب':'done'}}]}));
  await page.getByText('تم تحميل البيانات.',{exact:false}).waitFor();assert.equal(await page.getByText('معلق الأسبوع التالي',{exact:true}).count(),0);
  assert.equal(await page.evaluate(()=>localStorage.getItem('shatibiyya-matrix-v1:login-test-group2')),null);
  assert.deepEqual(errors,[]);
  const integrated=await browser.newPage({viewport:{width:1440,height:1000}});
  integrated.on('pageerror',e=>errors.push(e.message));
  await integrated.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.hostname.endsWith('firebasedatabase.app')){
    assert.match(url.pathname,/login-(test|sandbox)/);
    const value=url.pathname.startsWith('/config')?{students:['طالب'],weeks:[{id:'matrix-w',date:w,start:1,end:10}],settings:{weekBoundaryDay:url.pathname.includes('group2')?0:6},statuses:{}}:{};
    return route.fulfill({json:value,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-expose-headers':'ETag',ETag:'"0"'}});
   }
   if(url.hostname!=='matrix.test')return route.fulfill({body:''});
   const file=url.pathname.slice(1);
   return route.fulfill({contentType:file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8',body:await fs.readFile(path.join(__dirname,'..',file))});
  });
  await integrated.goto('http://matrix.test/prof-login-dev.html?devMode=data');
  await integrated.getByRole('button',{name:'حالة الطلاب',exact:true}).click();
  await integrated.getByText('تم تحميل البيانات.',{exact:false}).waitFor();
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
