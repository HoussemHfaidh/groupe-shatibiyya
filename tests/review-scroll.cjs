const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  for(const group of ['group1','group2'])for(const variant of ['','-dev'])for(const width of [390,1280]){
   const page=await browser.newPage({viewport:{width,height:844}});
   await page.clock.install({time:new Date('2026-10-01T10:00:00Z')});
   const students=['أحمد','علي','عمر','محمد الصادق الكشباطي'];
   const value=Object.fromEntries(['2026-09-19','2026-09-05','2026-09-26','2026-09-12','2026-09-13'].map(date=>[date,{id:date,startDate:date,endDate:date==='2026-09-26'?'2026-10-03':'2026-09-26',students,records:[{student:students[0],part:1,complete:true},{student:students[3],part:1,complete:true}]}]));
   await page.route('http://review.test/**',async route=>{
    const pathname=new URL(route.request().url()).pathname;
    if(pathname.startsWith('/api/'))return route.fulfill({json:{value,revision:0}});
    if(pathname==='/')return route.fulfill({contentType:'text/html',body:`<!doctype html><html dir="rtl"><meta charset="utf-8"><link rel="stylesheet" href="styles-dev.css"><link rel="stylesheet" href="review${variant}.css"><main class="layout"><div class="jam-professor-navigation"><nav class="jam-navigation"><button>التسميع</button></nav></div></main><script src="table-share.js"></script><script src="weekly-clock.js"></script><script src="review-model.js"></script><script src="review${variant}.js"></script><script>Review.mount({host:document.querySelector('main'),role:'professor',storageId:'${group}',local:true,students:${JSON.stringify(students)},day:6});</script></html>`});
    return route.fulfill({contentType:pathname.endsWith('.css')?'text/css':'text/javascript',body:await fs.readFile(path.join(__dirname,'..',pathname))});
   });
   await page.goto('http://review.test/');
   await page.getByRole('button',{name:'المراجعة',exact:true}).click();
   const table=page.locator('.review-professor-table');
   await table.locator('thead tr:last-child th').last().waitFor();
   assert.deepEqual((await table.locator('thead tr:last-child th').allTextContents()).slice(4),group==='group2'?['05/09/2026','12/09/2026','19/09/2026','26/09/2026']:['05/09/2026','12/09/2026','13/09/2026','19/09/2026','26/09/2026']);
   await page.evaluate(()=>{let ref=document.querySelector('#reference');if(!ref){ref=document.createElement('table');ref.id='reference';ref.className='tracking-table';ref.innerHTML='<tr class="table-header-row"><th class="index-col">#</th></tr><tr><td>1</td></tr>';document.body.append(ref);}});
   const styles=await page.evaluate(()=>{const props=['fontSize','fontFamily','padding','borderTopColor','borderTopWidth','height'];const read=s=>{const c=getComputedStyle(document.querySelector(s));return props.map(p=>c[p]);};return [read('#reference tr:last-child td'),read('.review-professor-table tbody tr:first-child td'),read('#reference th'),read('.review-professor-table .table-header-row th')];});
   assert.deepEqual(styles[0],styles[1]);assert.deepEqual(styles[2],styles[3]);
   await page.locator("#reference").evaluate(e=>e.remove());

   assert.deepEqual(await table.locator('.week-percent-row td').allTextContents(),Array(group==='group2'?4:5).fill(group==='group2'?'33%':'50%'));
   const displayed=await table.locator('tbody .name-col').allTextContents();
   assert.deepEqual(displayed,group==='group2'?students.slice(0,3):students);
   const fixed=table.locator('tbody tr:first-child .sticky-col');
   const before=await fixed.evaluateAll(cells=>cells.map(c=>c.getBoundingClientRect().x));
   const scroll=page.locator('.review-table-scroll');
   await scroll.evaluate(e=>{e.style.scrollBehavior='auto';e.scrollLeft=-10000;});
   const after=await fixed.evaluateAll(cells=>cells.map(c=>c.getBoundingClientRect().x));
   before.forEach((x,i)=>assert.ok(Math.abs(x-after[i])<=2,JSON.stringify({before,after})));
   if(width===390)assert.ok(await scroll.evaluate(e=>e.scrollLeft<0));
   await page.screenshot({path:`/private/tmp/review${variant}-${width}.png`});
   await page.close();console.log(`PASS review${variant} ${width}: ascending dates, frozen columns, scrolling`);
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
