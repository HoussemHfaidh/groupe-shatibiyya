const {chromium}=require('playwright'),fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 for(const variant of ['','-dev'])for(const chosen of [1,2]){
  const page=await browser.newPage();await page.clock.install({time:new Date('2026-10-23T10:00:00Z')});
  const id='2026-10-18';let value={[id]:{id,startDate:id,endDate:'2026-10-25',students:['A','B'],assigned:{B:chosen===1?2:1},records:[]}};
  await page.route('http://review.test/**',async route=>{const p=new URL(route.request().url()).pathname;
   if(p.startsWith('/api/')){if(route.request().method()==='PUT')value=route.request().postDataJSON().value;return route.fulfill({json:{value,revision:0}});}
   if(p==='/')return route.fulfill({contentType:'text/html',body:`<html><meta charset="utf-8"><main><nav class="jam-navigation"><button>التسميع</button></nav></main><script src="weekly-clock.js"></script><script src="review-model.js"></script><script src="review${variant}.js"></script><script>Review.mount({role:'student',name:'A',students:['A','B'],host:document.querySelector('main'),storageId:'group2',local:true,day:0});</script></html>`});
   return route.fulfill({contentType:'text/javascript',body:await fs.readFile(path.join(__dirname,'..',p))});
  });
  await page.goto('http://review.test/');await page.getByRole('button',{name:'المراجعة',exact:true}).click();
  const part=page.locator('.review-panel form select').nth(1);assert.equal(await part.isEnabled(),true);await part.selectOption(String(chosen));
  await page.getByLabel('المدة بالدقائق',{exact:true}).fill('10');await page.getByLabel('عدد الأخطاء',{exact:true}).fill('0');
  await page.getByRole('button',{name:'تأكيد مراجعة زميلي',exact:true}).click();await page.getByRole('button',{name:'نعم، إلى النهاية',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.review-table')?.textContent.includes('X'));assert.equal(value[id].records[0].part,chosen);
  await page.close();console.log(`PASS review${variant}: selecting and saving part ${chosen} despite opposite legacy assignment`);
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
