// Snapshot current data; apply only the explicitly requested canonical name correction.
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const R=require('../roster-model');
const base='https://groupe-shatibiyya-default-rtdb.asia-southeast1.firebasedatabase.app';
const oldName='فارس المسعدي',newName='فراس المسعدي';
const paths=['config','submissions','khatma/catalogs/production'];
for(const type of ['review','jam','khatma'])for(const group of ['group1','group2','login-test-group1','login-test-group2','login-sandbox-group1','login-sandbox-group2'])paths.push(`${type}/groups/${group}`);
function rename(value,key='') {
 if(key==='studentAliases')return value; // Keep the old name as a durable alias.
 if(typeof value==='string')return value===oldName?newName:value;
 if(!value||typeof value!=='object')return value;
 if(Array.isArray(value))return value.map(v=>rename(v));
 const out={};for(const [k,v] of Object.entries(value)){
  const next=k===oldName?newName:k.startsWith('فارس-المسعدي__')?k.replace('فارس-المسعدي__','فراس-المسعدي__'):k;
  assert.ok(!Object.hasOwn(out,next),'Name collision');out[next]=rename(v,k);
 }return out;
}
function transform(value,p){
 if(p!=='config')return rename(value);
 const original=structuredClone(value);
 function config(c){if(!c)return c;let result=c;if(c.students?.includes(oldName))result=R.edit(c,'rename',oldName,newName);return rename(result);}
 const groups=original.groups;delete original.groups;
 const result=config(original);
 if(groups)result.groups=Object.fromEntries(Object.entries(groups).map(([g,c])=>[g,config(c)]));
 return result;
}
function canonical(v){if(v===null)return undefined;if(Array.isArray(v))return v.length?v.map(canonical):undefined;if(v&&typeof v==='object'){const o=Object.fromEntries(Object.entries(v).map(([k,x])=>[k,canonical(x)]).filter(([,x])=>x!==undefined));return Object.keys(o).length?o:undefined;}return v;}
async function read(p){const r=await fetch(`${base}/${p}.json`,{headers:{'X-Firebase-ETag':'true'},signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error(`${p}: ${r.status}`);return {value:await r.json(),etag:r.headers.get('etag')};}
(async()=>{
 const dir=path.join('data',`prod-release-${new Date().toISOString().replace(/[:.]/g,'-')}`);await fs.mkdir(dir,{recursive:true});
 const snapshots={};for(const p of paths)snapshots[p]=await read(p);
 await fs.writeFile(path.join(dir,'before.json'),JSON.stringify(snapshots));
 console.log('Backup:',dir);
 for(const p of paths){const before=snapshots[p].value,next=transform(before,p);if(JSON.stringify(next)===JSON.stringify(before))continue;
  console.log('Name correction:',p);
  if(process.argv.includes('--apply')){
   const etag=snapshots[p].etag;assert.ok(etag);
   const r=await fetch(`${base}/${p}.json`,{method:'PUT',headers:{'Content-Type':'application/json','if-match':etag},body:JSON.stringify(next),signal:AbortSignal.timeout(20000)});
   if(!r.ok)throw Error(`Stopped; no overwrite on conflict: ${p} ${r.status}`);
   const after=await read(p);assert.deepEqual(canonical(after.value),canonical(next));snapshots[p]=after;
  }
 }
 await fs.writeFile(path.join(dir,'after.json'),JSON.stringify(snapshots));
 for(const g of ['group1','group2']){const c=g==='group1'?snapshots.config.value:snapshots.config.value.groups[g];console.log(g,JSON.stringify({students:c.students.length,weeks:c.weeks.length,renamed:c.students.includes(newName)}));}
})().catch(e=>{console.error(e.message);process.exitCode=1});
