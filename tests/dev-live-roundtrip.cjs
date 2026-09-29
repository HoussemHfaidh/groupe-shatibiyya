// Opt-in check on Firebase DEV: write/delete a unique metadata probe, never an activity result.
const {chromium}=require('playwright'),fs=require('node:fs/promises'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const Week=require('../review-model');
if(!process.argv.includes('--run-live')){console.log('Skipped: pass --run-live to run the Firebase DEV transport check.');process.exit(0);}
(async()=>{
 const base='https://groupe-shatibiyya-default-rtdb.asia-southeast1.firebasedatabase.app';
 const path=`review/groups/login-test-group1/${Week.week(6).id}/_devRealtimeChecks/${crypto.randomUUID()}`;
 assert.match(path,/^review\/groups\/login-test-group1\/[0-9-]+\/_devRealtimeChecks\/[a-f0-9-]+$/);
 const url=`${base}/${path}.json`,stream=`${base}/review/groups/login-test-group1.json`;
 const browser=await chromium.launch({headless:true,channel:'chrome'});let written=false;
 try{
  const page=await browser.newPage();
  await page.route('http://localhost/**',async route=>route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><p>DEV live transport test</p>'}));
  await page.goto('http://localhost/dev-live-check');await page.addScriptTag({content:await fs.readFile(require.resolve('../live-data-dev.js'),'utf8')});
  await page.evaluate(({url,stream})=>{window.probeReads=0;window.nativeEvents=0;window.check=LiveData.watch({urls:()=>[stream],interval:120000,state:s=>{if(s==='live')window.nativeEvents++;},change:async()=>{const r=await fetch(url,{cache:'no-store'});window.probe=await r.json();window.probeReads++;}});},{url,stream});
  await page.waitForFunction(()=>window.probeReads>0);
  const initial=await fetch(url);assert.equal(await initial.json(),null);
  const marker={test:'dev-live-roundtrip',nonce:crypto.randomUUID()};
  const result=await fetch(url,{method:'PUT',headers:{'Content-Type':'application/json','if-match':'null_etag'},body:JSON.stringify(marker)});assert.ok(result.ok);written=true;
  await page.waitForFunction(nonce=>window.probe?.nonce===nonce && window.nativeEvents>0,marker.nonce,{timeout:12000});
  console.log('PASS: native Firebase DEV event received and fresh data read in the browser without polling or reload.');
  await page.evaluate(()=>window.check.stop());
 }finally{
  if(written){const response=await fetch(url,{method:'DELETE'});assert.ok(response.ok,'DEV probe cleanup');const check=await fetch(url);assert.equal(await check.json(),null);console.log('DEV metadata probe removed. No activity record or production data changed.');}
  await browser.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
