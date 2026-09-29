// Opt-in check on Firebase PROD matrix: write/delete a unique metadata probe, never an activity result.
const {chromium}=require('playwright'),fs=require('node:fs/promises'),assert=require('node:assert/strict'),crypto=require('node:crypto');
if(!process.argv.includes('--run-live')){console.log('Skipped: pass --run-live to run the Firebase PROD matrix transport check.');process.exit(0);}
(async()=>{
 const base='https://groupe-shatibiyya-default-rtdb.asia-southeast1.firebasedatabase.app';
 const root=process.argv.includes('--group2')?'config/groups/group2/studentStatus':'config/studentStatus';
 const path=`${root}/_releaseChecks/${crypto.randomUUID()}`;
 assert.match(path,/^config\/(groups\/group2\/)?studentStatus\/_releaseChecks\/[a-f0-9-]+$/);
 const url=`${base}/${path}.json`,stream=`${base}/${root}.json`;
 const browser=await chromium.launch({headless:true,channel:'chrome'});let written=false;
 try{
  const page=await browser.newPage();
  await page.route('http://localhost/**',async route=>route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><p>PROD matrix transport test</p>'}));
  await page.goto('http://localhost/production-matrix-check');await page.addScriptTag({content:await fs.readFile(require.resolve('../live-data.js'),'utf8')});
  await page.evaluate(({url,stream})=>{window.probeReads=0;window.nativeEvents=0;window.check=LiveData.watch({urls:()=>[stream],interval:120000,state:s=>{if(s==='live')window.nativeEvents++;},change:async()=>{const r=await fetch(url,{cache:'no-store'});window.probe=await r.json();window.probeReads++;}});},{url,stream});
  await page.waitForFunction(()=>window.probeReads>0);
  const initial=await fetch(url);assert.equal(await initial.json(),null);
  const marker={test:'production-matrix-roundtrip',nonce:crypto.randomUUID()};
  const result=await fetch(url,{method:'PUT',headers:{'Content-Type':'application/json','if-match':'null_etag'},body:JSON.stringify(marker)});assert.ok(result.ok);written=true;
  await page.waitForFunction(nonce=>window.probe?.nonce===nonce && window.nativeEvents>0,marker.nonce,{timeout:12000});
  console.log('PASS: native Firebase PROD matrix event received and fresh data read in the browser without polling or reload.');
  await page.evaluate(()=>window.check.stop());
 }finally{
  if(written){const response=await fetch(url,{method:'DELETE'});assert.ok(response.ok,'PROD probe cleanup');const check=await fetch(url);assert.equal(await check.json(),null);console.log('PROD matrix metadata probe removed. No student result changed.');}
  await browser.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
