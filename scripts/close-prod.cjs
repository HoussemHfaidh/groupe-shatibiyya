// Idempotent fallback for weekly closures, also run by connected portals.
const {sync}=require('../recitation-maintenance.js');
const base='https://groupe-shatibiyya-default-rtdb.asia-southeast1.firebasedatabase.app';
(async()=>{
  const day=new Intl.DateTimeFormat('en-US',{timeZone:'Europe/Paris',weekday:'short'}).format(new Date());
  const path=day==='Sat'?'config':day==='Sun'?'config/groups/group2':null;
  if(!path) return;
  await sync(`${base}/${path}.json`);
  console.log('Weekly closure checked successfully.');
})().catch(error=>{console.error(error.message);process.exitCode=1;});
