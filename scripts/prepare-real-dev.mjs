/* Read PROD only; preserve DEV trials while importing real rosters and activity history. */
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),Calendar=require('../review-model');
const base='https://groupe-shatibiyya-default-rtdb.asia-southeast1.firebasedatabase.app';
const apply=process.argv.includes('--apply'),stamp=new Date().toISOString().replace(/[:.]/g,'-');
const directory=`data/dev-real-${stamp}`;
const allowed=/^(config|submissions|review|jam|khatma)\/groups\/login-test-group[12]$|^khatma\/catalogs\/login-test$/;
const fields=['students','weeks','settings','statuses','readyOrder','readyAt','studentAliases','retiredStudents','rosterInitialized','rosterRevision','loginEmails'];
const list=v=>Array.isArray(v)?v:[];
const by=(a,b,key)=>[...new Map([...list(a),...list(b)].map(item=>[key(item),item])).values()];
async function read(path){const r=await fetch(`${base}/${path}.json`,{headers:{'X-Firebase-ETag':'true'},signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error(`${path}: ${r.status}`);return {value:await r.json()||{},etag:r.headers.get('etag')};}
const plan=[];
async function prepare(type,source,target,merge){const [prod,dev]=await Promise.all([read(source),read(target)]);const value=merge(prod.value,dev.value);plan.push({path:target,before:dev,value});}
function activities(type,prod,dev){
 const next={...prod,...dev};
 for(const id of Object.keys(prod))if(dev[id]){
  const a=prod[id],b=dev[id];
  if(type==='jam'){
   // A started DEV duty owns its verse/approval chain; importing another chain could duplicate verses.
   next[id]=(b.confirmations||[]).length?b:(a.confirmations||[]).length?a:{...a,...b};
  }else next[id]={...a,...b,students:[...new Set([...list(a.students),...list(b.students)])],assigned:{...a.assigned,...b.assigned},records:by(a.records,b.records,r=>r.student)};
 }
 return next;
}
for(const group of ['group1','group2']){
 const target=`login-test-${group}`,day=group==='group1'?6:0;
 await prepare('config',group==='group1'?'config':`config/groups/${group}`,`config/groups/${target}`,(raw,dev)=>{
  const prod=Object.fromEntries(fields.filter(k=>Object.hasOwn(raw,k)).map(k=>[k,raw[k]]));
  const result={...prod,...dev,students:[...new Set([...list(prod.students),...list(dev.students)])],settings:{...dev.settings,...prod.settings},rosterInitialized:true};
  result.weeks=by(prod.weeks,dev.weeks,w=>w.id).sort((a,b)=>a.date.localeCompare(b.date));
  for(const key of ['statuses','readyAt','readyOrder','loginEmails'])result[key]={...prod[key],...dev[key]};
  result.studentAliases=by(prod.studentAliases,dev.studentAliases,a=>a.from);
  const current=Calendar.week(day).startDate;
  let last=result.weeks.at(-1);if(!last)throw Error(`No weeks for ${group}`);
  while(last.date<current){const date=new Date(Date.parse(last.date)+7*86400000).toISOString().slice(0,10),start=Number(last.start)+10,end=Number(last.end)+10;last={date,start,end,id:`${date}-${start}-${end}`};result.weeks.push(last);}
  return result;
 });
 await prepare('submissions',group==='group1'?'submissions':`submissions/groups/${group}`,`submissions/groups/${target}`,(prod,dev)=>({...Object.fromEntries(Object.entries(prod).filter(([,v])=>typeof v?.student==='string'&&typeof v?.weekId==='string')),...dev}));
 for(const type of ['review','jam'])await prepare(type,`${type}/groups/${group}`,`${type}/groups/${target}`,(prod,dev)=>activities(type,prod,dev));
 await prepare('khatma',`khatma/groups/${group}`,`khatma/groups/${target}`,(prod,dev)=>({...prod,...dev,khatmas:{...prod.khatmas,...dev.khatmas},entries:{...prod.entries,...dev.entries},weeks:{...prod.weeks,...dev.weeks}}));
}
await prepare('catalog','khatma/catalogs/production','khatma/catalogs/login-test',(prod,dev)=>({...prod,...dev,settings:{...dev.settings,...prod.settings}}));
if(plan.some(item=>!allowed.test(item.path)||!item.before.etag))throw Error('Unsafe write plan');
await fs.mkdir(directory,{recursive:true});await fs.writeFile(`${directory}/backup-plan.json`,JSON.stringify(plan),{mode:0o600});
for(const item of plan){
 if(apply){
  const response=await fetch(`${base}/${item.path}.json`,{method:'PUT',headers:{'Content-Type':'application/json','if-match':item.before.etag},body:JSON.stringify(item.value),signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error(`DEV write refused ${item.path}: ${response.status}; backup: ${directory}`);
 }
 console.log(JSON.stringify({path:item.path,applied:apply,students:item.value.students?.length,weeks:Array.isArray(item.value.weeks)?item.value.weeks.length:undefined,records:Object.values(item.value).reduce((n,w)=>n+(w?.records?.length||0),0),entries:Object.keys(item.value.entries||{}).length}));
}
console.log(JSON.stringify({backup:directory,productionWrites:0}));
