const {chromium}=require('playwright'),fs=require('node:fs/promises'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 for(const file of ['app.js','app-dev.js']){
  const source=await fs.readFile(file,'utf8');
  const names=['normalizeArabic','recitationTableStudents','studentCompletion','studentMissing','weekCompletion','averageCompletion','averageMissing','renderTable','emptyCell','headerCell','exportCsv','toCsv','renderReportCanvas','positionColumns'];
  const code=names.map(name=>{const start=source.indexOf('function '+name+'('),end=source.indexOf('\nfunction ',start+1);return source.slice(start,end);}).join('\n');
  const page=await browser.newPage();await page.setContent('<table id="table"></table>');
  await page.evaluate(code=>{
   window.excluded='محمد الصادق الكشباطي';window.state={students:['أحمد',excluded,'علي'],weeks:[{id:'w',start:1,end:10,date:'2026-09-26'}]};
   window.elements={trackingTable:document.querySelector('table'),weekSelect:{value:'w'}};
   window.getStatus=n=>n==='علي'?'missed':'done';window.weekLabel=()=> '1–10';window.formatDate=d=>d;window.statusLabel=s=>s;window.statusMark=s=>s;window.cycleStatus=()=>{};
   window.downloadText=(name,text)=>window.csv=text;
   window.drawTitle=window.drawPercentRow=window.drawHeaderRow=window.drawTotalRow=()=>{};
   window.drawStudentRow=(ctx,cols,student)=>window.imageStudents.push(student);
   window.eval(code);
  },code);
  for(const group of ['group1','group2']){
   const result=await page.evaluate(group=>{window.currentGroupId=group;renderTable();exportCsv();window.imageStudents=[];renderReportCanvas();return {names:[...document.querySelectorAll('tr .name-col')].slice(2,-1).map(e=>e.textContent),weekly:weekCompletion('w'),done:averageCompletion(),missing:averageMissing(),csv:window.csv,image:window.imageStudents,roster:state.students};},group);
   const expected=group==='group1'?['أحمد','محمد الصادق الكشباطي','علي']:['أحمد','علي'];
   assert.deepEqual(result.names,expected);assert.deepEqual(result.image,expected);
   assert.equal(result.csv.includes('محمد الصادق الكشباطي'),group==='group1');
   assert.equal(result.weekly,group==='group1'?67:50);assert.equal(result.done,result.weekly);assert.equal(result.missing,group==='group1'?33:50);
   assert.equal(result.roster.length,3);
  }
  await page.evaluate(()=>{state.students=['محمد الصادق الكشباطى'];currentGroupId='group2';});
  assert.deepEqual(await page.evaluate(()=>[recitationTableStudents().length,weekCompletion('w'),averageCompletion(),averageMissing()]),[0,0,0,0]);
  await page.close();console.log('PASS '+file+': table, totals, CSV, image, group isolation, spelling variants, empty roster');
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
