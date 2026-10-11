/* Per-group account changes are saved atomically with the central roster. */
(function(root){
 const roster=typeof module!=='undefined'?require('./roster-model'):root.RosterModel;
 const email=value=>String(value||'').trim().toLowerCase();
 function accounts(config,name){return Object.entries(config.loginEmails||{}).filter(([,p])=>p.role==='student'&&roster.resolve(p.studentName,config.studentAliases||[])===name);}
 async function edit(config,action,oldName,newName,address,groupId){
  const normalized=email(address);
  if(action==='add'&&!normalized)throw Error('أدخل البريد الإلكتروني للطالب.');
  if(normalized&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized))throw Error('أدخل بريدا إلكترونيا صالحا.');
  let hash;
  if(normalized){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(normalized));hash=Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');}
  const canonical=roster.config(config),owned=accounts(canonical,oldName);
  if(hash&&canonical.loginEmails?.[hash]&&!owned.some(([key])=>key===hash))throw Error('هذا البريد مرتبط بحساب آخر في هذه المجموعة.');
  const next=roster.edit(canonical,action,oldName,newName);next.loginEmails={...canonical.loginEmails};
  if(action==='remove'||normalized){for(const [key]of owned)delete next.loginEmails[key];}
  if(action!=='remove'&&normalized)next.loginEmails[hash]={role:'student',studentName:newName.trim().replace(/\s+/g,' '),groupId,email:normalized};
  return next;
 }
 const api={email,accounts,edit};if(typeof module!=='undefined')module.exports=api;else root.StudentAdminModel=api;
})(globalThis);
