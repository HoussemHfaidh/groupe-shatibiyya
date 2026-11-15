const {chromium}=require('playwright'),assert=require('node:assert/strict'),path=require('node:path'),M=require('../makeup-model');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);
  const names=['A','B','C'];let store=M.add({},[{student:'A',lessons:'115'},{student:'B',lessons:'115,116,117'}],names),conflict=false,writeCount=0;
  await page.route('https://example.test/**',r=>{
   if(r.request().method()==='PUT'){writeCount++;if(conflict)return r.fulfill({status:412,body:''});store=r.request().postDataJSON();}
   return r.fulfill({json:store,headers:{ETag:'"1"','access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,PUT,OPTIONS','access-control-expose-headers':'ETag'}});
  });
  await page.goto('https://example.test/');
  await page.setContent('<main><div class="jam-navigation"><button>التسميع</button></div><section class="student-dashboard"></section></main>');
  await page.evaluate(()=>{document.documentElement.dir='rtl';document.documentElement.lang='ar';});
  for(const file of ['styles.css','styles-dev.css','review.css','makeup.css'])await page.addStyleTag({path:path.join(__dirname,'..',file)});
  for(const file of ['makeup-model.js','makeup.js'])await page.addScriptTag({path:path.join(__dirname,'..',file)});
  await page.evaluate(()=>{
   window.Review={popup:async()=>true};
   window.mountMakeup=(name,role='student')=>Makeup.mount({role,name,students:['A','B','C'],storageId:'group1',host:document.querySelector('main'),url:()=> 'https://example.test/data'});
   mountMakeup('A');
  });
  await page.waitForSelector('.makeup-reminder');assert.match(await page.locator('.makeup-reminder').innerText(),/115/);
  await page.locator('.makeup-reminder').click();
  const form=page.locator('.makeup-panel form').last(),lesson=form.locator('select').nth(0),target=form.locator('select').nth(1),submit=page.getByRole('button',{name:'تأكيد تدارك زميلي'});
  assert.equal(await form.locator('select').count(),2); // The logged-in validator no longer needs to select their name.
  await lesson.selectOption('115');assert.equal(await submit.isDisabled(),true);assert.equal(await lesson.isEnabled(),true);assert.equal(await target.inputValue(),'B');
  await lesson.selectOption('116');assert.equal(await submit.isEnabled(),true);
  await page.getByRole('button',{name:'تحديث',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.makeup-panel .result-box').textContent==='');
  assert.equal(await lesson.inputValue(),'116');assert.equal(await submit.isEnabled(),true);
  await page.screenshot({path:'/private/tmp/makeup-lesson-mobile.png'});
  await submit.click();await page.waitForFunction(()=>document.querySelector('.makeup-panel .result-box').textContent==='تم الحفظ');
  assert.equal(store.debts.B__116.completed.validator,'A');assert.equal(M.pending(store,'A').length,1);assert.equal(writeCount,1);
  // A changed selection must update the button, and cancelled confirmation must not write.
  await lesson.selectOption('117');await page.evaluate(()=>Review.popup=async()=>null);await submit.click();assert.equal(writeCount,1);
  await page.evaluate(()=>Review.popup=async()=>true);
  // Eligibility is checked again against fresh data, not just against the displayed form.
  store=M.add(store,[{student:'A',lessons:'117'}],names);
  await submit.click();await page.waitForFunction(()=>document.querySelector('.makeup-panel .result-box').textContent.includes('نفس الدرس'));assert.equal(writeCount,1);assert.equal(store.debts.B__117.completed,undefined);
  store=M.confirm(store,'C','A',117,names);
  await page.getByRole('button',{name:'تحديث',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.makeup-panel .result-box').textContent==='');
  await lesson.selectOption('117');conflict=true;await submit.click();await page.waitForFunction(()=>document.querySelector('.makeup-panel .result-box').textContent.includes('تغيرت القائمة'));assert.equal(store.debts.B__117.completed,undefined);
  conflict=false;
  // A student whose only pending debt is their own has no peer target and cannot submit.
  await page.evaluate(()=>mountMakeup('B'));await page.waitForFunction(()=>document.querySelector('[name=makeupLesson]')?.closest('form').textContent.includes('أنا الطالب / الطالبة: B'));
  await lesson.selectOption('115');assert.equal(await target.inputValue(),'A');assert.equal(await submit.isDisabled(),true);
  store=M.confirm(store,'C','A',115,names);await page.getByRole('button',{name:'تحديث',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[name=makeupLesson]').options.length===0);assert.equal(await submit.isDisabled(),true);
  assert.deepEqual(errors,[]);console.log('PASS 115 blocked, 116 allowed, connected identity, course switching, cancellation, fresh eligibility, conflict, no self target, mobile');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
