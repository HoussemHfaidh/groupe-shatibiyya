const {chromium}=require('playwright'),fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),M=require('../khatma-model');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const group=process.env.TEST_GROUP||'group2',day=group==='group1'?6:0;
 const now=new Date('2026-11-22T12:00:00Z'),students=['A','B'],base={teacher:M.teachers[0],riwaya:M.readings[0],date:'2026-11-10',attendance:'present',start:'البقرة 1',position:'البقرة 10',notes:''};
 let store=M.recordSession({}, {...base,id:'one'},{role:'student',name:'A'},students,day,now);store=M.recordSession(store,{...base,id:'other'},{role:'student',name:'B'},students,day,now);
 const originalOther=structuredClone(store.entries.other);let writes=0,conflict=false;
 const page=await browser.newPage({viewport:{width:group==='group1'?1280:390,height:844}});await page.clock.install({time:now});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://khatma.test/**',async route=>{const p=new URL(route.request().url()).pathname;
  if(p.includes('/groups/')){if(route.request().method()==='PUT'){assert.equal(route.request().headers()['if-match'],'"version"');if(conflict)return route.fulfill({status:412});store=route.request().postDataJSON();writes++;}return route.fulfill({headers:{ETag:'"version"'},json:store});}
  if(p.includes('/catalogs/'))return route.fulfill({json:{}});
  if(p==='/')return route.fulfill({contentType:'text/html',body:`<!doctype html><html dir="rtl"><meta charset="utf-8"><link rel="stylesheet" href="styles-dev.css"><link rel="stylesheet" href="khatma.css"><main class="layout"><nav class="jam-navigation"><button>التسميع</button></nav></main>${['weekly-clock','review-model','khatma-model','khatma'].map(n=>'<script src="'+n+'.js"></script>').join('')}<script>Khatma.mount({role:'student',name:'A',students:['A','B'],host:document.querySelector('main'),storageId:'${group}',day:${day},ready:true,local:false,firebaseUrl:()=>'/groups/${group}.json'});</script></html>`});
  return route.fulfill({contentType:p.endsWith('.css')?'text/css':'text/javascript',body:await fs.readFile(path.join(__dirname,'..',p))});
 });
 await page.goto('https://khatma.test/');await page.getByRole('button',{name:'متابعة الختمات الفردية',exact:true}).click();
 const panel=page.locator('.khatma-panel');await panel.getByRole('button',{name:/تعديل التسجيل/}).click();
 await panel.getByLabel('اسم الشيخ',{exact:true}).selectOption(M.teachers[1]);await panel.getByLabel('الرواية أو القراءة',{exact:true}).selectOption(M.readings[1]);
 page.once('dialog',d=>{assert.ok(d.message().includes(M.teachers[1]));assert.ok(d.message().includes(M.readings[1]));d.dismiss();});
 await panel.getByRole('button',{name:'حفظ التعديل',exact:true}).click();assert.equal(writes,0);
 conflict=true;page.once('dialog',d=>d.accept());await panel.getByRole('button',{name:'حفظ التعديل',exact:true}).click();await panel.getByText(/وصل تسجيل آخر أثناء الحفظ/).waitFor();assert.equal(writes,0);assert.equal(await panel.getByLabel('اسم الشيخ',{exact:true}).inputValue(),M.teachers[1]);
 conflict=false;page.once('dialog',d=>d.accept());await panel.getByRole('button',{name:'حفظ التعديل',exact:true}).click();await panel.getByText('تم تعديل التسجيل.',{exact:true}).waitFor();assert.equal(writes,1);assert.equal(store.entries.one.teacher,M.teachers[1]);assert.equal(store.entries.one.riwaya,M.readings[1]);assert.deepEqual(store.entries.other,originalOther);
 await page.screenshot({path:'/private/tmp/khatma-history-mobile.png',fullPage:true});
 page.once('dialog',d=>d.dismiss());await panel.getByRole('button',{name:/حذف التسجيل/}).click();assert.equal(writes,1);
 page.once('dialog',d=>d.accept());await panel.getByRole('button',{name:/حذف التسجيل/}).click();await panel.getByText('تم حذف التسجيل.',{exact:true}).waitFor();assert.equal(writes,2);assert.equal(store.entries.one,undefined);assert.deepEqual(store.entries.other,originalOther);
 await panel.getByLabel('اسم الشيخ',{exact:true}).selectOption(M.teachers[0]);await panel.getByLabel('الرواية أو القراءة',{exact:true}).selectOption(M.readings[0]);await panel.getByLabel('الحضور',{exact:true}).selectOption('present');await panel.getByLabel('بداية القراءة (السورة والآية)',{exact:true}).fill('الفاتحة 1');await panel.getByLabel('نهاية القراءة (السورة والآية)',{exact:true}).fill('الفاتحة 7');
 page.once('dialog',d=>d.dismiss());await panel.getByRole('button',{name:'حفظ المتابعة',exact:true}).click();assert.equal(writes,2);
 page.once('dialog',d=>d.accept());await panel.getByRole('button',{name:'حفظ المتابعة',exact:true}).click();await panel.getByText('تم حفظ المتابعة. يمكنك إضافة تسجيل آخر.',{exact:true}).waitFor();assert.equal(writes,3);
 await page.reload();await page.getByRole('button',{name:'متابعة الختمات الفردية',exact:true}).click();await panel.getByRole('button',{name:/تعديل التسجيل/}).waitFor();assert.equal(await panel.getByRole('button',{name:/تعديل التسجيل/}).count(),1);assert.deepEqual(errors,[]);
 console.log('PASS student history: edit teacher/reading, conflict, delete cancel/confirm, create recap cancel/confirm, own history only, reload');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
