const {chromium} = require('playwright');
const assert = require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try {
  const page=await browser.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/__fixture__/config/**', route=>route.fulfill({json:{students:['أشرف قرمش','أسماء شلبي','أسماء مسعودي'],weeks:[{id:'w1',start:1,end:10,date:'2026-09-19'}],statuses:{},settings:{weekBoundaryDay:6}}}));
  await page.goto(`${process.env.TEST_BASE_URL || 'http://127.0.0.1:4190'}/prof-login-dev.html?devMode=data`);
  await page.getByRole('button',{name:'الحضور',exact:true}).click();
  const csv='Name,Join time,Leave time,Duration (minutes)\nGharbi,09/20/2026 09:00:00,09/20/2026 10:40:00,100\nAchraf Guermech,09/20/2026 09:00:00,09/20/2026 10:10:00,70\nAchraf.Guermech,09/20/2026 09:15:00,09/20/2026 10:40:00,85\nAsma,09/20/2026 09:03:00,09/20/2026 10:40:00,97';
  const upload=async(text)=>{
   await page.locator('.attendance-panel input[type=file]').setInputFiles({name:'test.csv',mimeType:'text/csv',buffer:Buffer.from(text)});
   await page.getByText('تم حفظ الجلسة:',{exact:false}).waitFor();
  };
  await upload(csv);
  await page.locator('.attendance-matching > summary').click();
  assert.equal(await page.getByLabel('مطابقة Achraf Guermech',{exact:true}).inputValue(),'أشرف قرمش');
  assert.equal(await page.getByLabel('مطابقة Achraf.Guermech',{exact:true}).inputValue(),'أشرف قرمش');
  assert.equal(await page.getByLabel('مطابقة Asma',{exact:true}).inputValue(),'');
  await page.getByLabel('مطابقة Asma',{exact:true}).selectOption('أسماء شلبي');
  await page.locator('.attendance-editor > summary').click();
  assert.equal(await page.locator('.attendance-table tbody tr').count(),3);
  const achraf=page.locator('.attendance-table tbody tr').filter({hasText:'أشرف قرمش'});
  assert.equal(await achraf.locator('td').nth(0).innerText(),'100');
  assert.equal(await achraf.locator('td').nth(4).innerText(),'—');
  await page.getByRole('button',{name:'أشرف قرمش: خروج باستئذان',exact:true}).click();
  await upload(csv);
  assert.equal(await page.getByRole('button',{name:'أشرف قرمش: خروج باستئذان',exact:true}).getAttribute('aria-pressed'),'true');
  await upload(csv.replaceAll('09/20/2026','09/27/2026'));
  assert.equal(await page.getByLabel('مطابقة Asma',{exact:true}).inputValue(),'أسماء شلبي');
  await page.reload(); await page.getByRole('button',{name:'الحضور',exact:true}).click();
  await page.locator('.attendance-matching > summary').click();
  assert.equal(await page.getByLabel('مطابقة Asma',{exact:true}).inputValue(),'أسماء شلبي');
  await page.locator('#groupSelect').selectOption('group2'); await upload(csv);
  assert.equal(await page.getByLabel('مطابقة Asma',{exact:true}).inputValue(),'');
  // Original legacy array stays readable; raw data must be reimported for migration.
  await page.evaluate(()=>localStorage.setItem('shatibiyya-attendance-v1:login-test-group2',JSON.stringify([{id:'old',filename:'old.csv',date:'2026-09-20',teacher:{name:'Gharbi',minutes:100,join:Date.UTC(2026,8,20,9),leave:Date.UTC(2026,8,20,10,40)},participants:[],flags:{}}])));
  await page.reload(); await page.getByRole('button',{name:'الحضور',exact:true}).click();
  await page.getByText('جلسة قديمة:',{exact:false}).waitFor();
  assert.deepEqual(errors,[]);
  console.log('Matching browser: roster association, ambiguity, corrections, persistence, groups and legacy history passed.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
