const {chromium}=require('playwright'),fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://attendance.test/**',async route=>{const p=new URL(route.request().url()).pathname;
  if(p==='/')return route.fulfill({contentType:'text/html',body:`<!doctype html><html dir="rtl"><meta charset="utf-8"><link rel="stylesheet" href="styles-dev.css"><link rel="stylesheet" href="attendance.css"><main class="layout"><nav class="jam-navigation"><button>التسميع</button></nav></main>${['attendance-matching','attendance-model','attendance-import','attendance-report','attendance'].map(n=>'<script src="'+n+'.js"></script>').join('')}<script>Attendance.mount({role:'professor',host:document.querySelector('main'),storageId:'group1',students:[],ready:true});</script></html>`});
  return route.fulfill({contentType:p.endsWith('.css')?'text/css':'text/javascript',body:await fs.readFile(path.join(__dirname,'..',p))});
 });
 await page.goto('http://attendance.test/');await page.getByRole('button',{name:'الحضور',exact:true}).click();
 const csv='Name,Email,Join time,Leave time,Duration (minutes)\nGharbi,,10/10/2026 08:00:00,10/10/2026 10:00:00,120\nParticipant A,,10/10/2026 08:00:00,10/10/2026 09:30:00,90\nPhone B,,10/10/2026 09:00:00,10/10/2026 10:00:00,60';
 const upload=async()=>{await page.locator('input[type=file]').setInputFiles({name:'test.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});await page.getByText('تم حفظ الجلسة:',{exact:false}).waitFor();};
 await upload();await page.locator('.attendance-editor > summary').click();
 assert.equal(await page.locator('.attendance-table tbody tr').count(),3);
 const initial=await page.locator('.attendance-preview img').getAttribute('src');
 await page.getByLabel('دمج Participant A مع',{exact:true}).selectOption({label:'Phone B'});
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'دمج اتصالات Participant A',exact:true}).click();
 assert.equal(await page.locator('.attendance-table tbody tr').count(),2);
 assert.notEqual(await page.locator('.attendance-preview img').getAttribute('src'),initial);
 const row=page.locator('.attendance-table tbody tr').last();assert.equal(await row.locator('td').first().innerText(),'120');
 await page.getByRole('button',{name:'التراجع عن آخر دمج',exact:true}).click();assert.equal(await page.locator('.attendance-table tbody tr').count(),3);
 await page.getByLabel('دمج Participant A مع',{exact:true}).selectOption({label:'Phone B'});page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'دمج اتصالات Participant A',exact:true}).click();
 await upload();assert.equal(await page.locator('.attendance-table tbody tr').count(),2);
 await page.reload();await page.getByRole('button',{name:'الحضور',exact:true}).click();await page.locator('.attendance-editor > summary').click();assert.equal(await page.locator('.attendance-table tbody tr').count(),2);
 for(const width of [390,1280]){await page.setViewportSize({width,height:900});await page.screenshot({path:`/private/tmp/attendance-merge-${width}.png`,fullPage:true});}
 assert.deepEqual(errors,[]);console.log('PASS manual merge, exact overlap duration, preview, undo, learned reimport, reload, mobile/desktop');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
