(function(root){
  const clock=typeof module!=='undefined'?require('./weekly-clock.js'):root.WeeklyClock;
  function close(config,now=new Date()) {
    if(!config?.students?.length) return config;
    const day=config.settings?.weekBoundaryDay ?? 6;
    const candidates=(config.weeks||[]).filter(w=>clock.deadline(w,day)<=now).sort((a,b)=>b.date.localeCompare(a.date));
    const week=candidates[0];
    if(!week) return config;
    // Only the most recently closed week; preserve older historical blanks.
    const statuses={...(config.statuses||{})}; let changed=false;
    for(const name of config.students){
      const id=name.toLowerCase().normalize('NFKD').replace(/[\u064b-\u065f\u0670]/g,'').replace(/[إأآا]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,'-');
      const key=`${id}__${week.id}`;
      if(!statuses[key]){statuses[key]='missed';changed=true;}
    }
    return changed?{...config,statuses}:config;
  }
  async function sync(url){
    const response=await fetch(url,{headers:{'X-Firebase-ETag':'true'},cache:'no-store'});
    if(!response.ok) throw new Error('تعذر تحميل حالات التسميع.');
    const config=await response.json(), next=close(config);
    if(next===config) return config;
    const etag=response.headers.get('etag');
    if(!etag) throw new Error('تعذر تأمين تحديث الحالات.');
    const saved=await fetch(url,{method:'PUT',headers:{'Content-Type':'application/json','if-match':etag},body:JSON.stringify(next)});
    if(saved.status===412) throw new Error('تغيرت الحالات. أعد التحديث.');
    if(!saved.ok) throw new Error('تعذر حفظ حالات التسميع.');
    return next;
  }
  const api={close,sync}; if(typeof module!=='undefined')module.exports=api;else root.RecitationMaintenance=api;
})(globalThis);
