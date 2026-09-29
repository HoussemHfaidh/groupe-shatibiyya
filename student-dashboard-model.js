(function(root){
  const calendar=typeof module!=='undefined'?require('./review-model'):root.ReviewModel;
  const clock=typeof module!=='undefined'?require('./weekly-clock'):root.WeeklyClock;
  const normalize=n=>String(n).toLowerCase().normalize('NFKD').replace(/[\u064b-\u065f\u0670]/g,'').replace(/[إأآا]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,'-');
  function summary({name,day,config,jam,review,khatma,jamEnabled=true,errors=[]},now=new Date()){
    const week=calendar.week(day,now);
    const item=(id,label,state,detail)=>({id,label,state,detail});
    const unknown=(id,label)=>item(id,label,'unknown','تعذر التحديث، أعد المحاولة');
    const weeks=(config?.weeks||[]).filter(w=>w.date && now>=clock.at(w.date) && now<clock.deadline(w,day)).sort((a,b)=>b.date.localeCompare(a.date));
    const recitation=weeks[0],status=config?.statuses?.[`${normalize(name)}__${recitation?.id}`];
    const rec=errors.includes('config')?unknown('recitation','التسميع'):!recitation?item('recitation','التسميع','waiting','بانتظار فتح أسبوع التسميع'):item('recitation','التسميع',['done','makeup'].includes(status)?'done':'todo',status==='makeup'?'تم التسميع بالاستدراك':status==='done'?'تم اعتماد تسميعك':'بعد التسميع، يؤكد زميلك أو الأستاذ إنجازك');
    const duty=Object.values(jam||{}).find(w=>w.startDate===week.startDate);
    const jamCard=!jamEnabled?item('jam','واجب الجمع','waiting','غير مفعّل لهذه المجموعة'):errors.includes('jam')?unknown('jam','واجب الجمع'):!duty || !(duty.confirmations||[]).length?item('jam','واجب الجمع','waiting','بانتظار فتح الأستاذ للواجب'):item('jam','واجب الجمع',(duty.confirmations||[]).some(r=>r.student===name)?'done':'todo',(duty.confirmations||[]).some(r=>r.student===name)?'تم اعتماد واجبك':'واجبك متاح هذا الأسبوع');
    const record=review?.[week.startDate]?.records?.find(r=>r.student===name);
    const confirmedPeers=(review?.[week.startDate]?.records||[]).filter(r=>r.validator===name && r.student!==name).length;
    const reviewCard=errors.includes('review')?unknown('review','المراجعة'):item('review','المراجعة',record?(record.complete?'done':'partial'):'todo',record?(record.complete?'تمت مراجعة القسم المطلوب':'مراجعتك مسجلة، لكن القسم غير مكتمل'):confirmedPeers?'أكدت مراجعة زميلك؛ مراجعتك أنت تنتظر تأكيد زميلك':'راجع القسم المطلوب مع زميلك ليؤكد لك');
    reviewCard.peerConfirmations=errors.includes('review')?null:confirmedPeers;
    const entries=Object.values(khatma?.entries||{}).filter(e=>e.student===name && e.date>=week.startDate && e.date<week.endDate);
    const khatmaCard=errors.includes('khatma')?unknown('khatma','متابعة الختمات الفردية'):item('khatma','متابعة الختمات الفردية',entries.length?'done':'todo',entries.length?`تم تسجيل متابعة هذا الأسبوع (${entries.length})`:'سجّل متابعة حصتك لهذا الأسبوع');
    const cards=[rec,jamCard,reviewCard,khatmaCard],available=cards.filter(c=>c.state!=='waiting'),done=cards.filter(c=>c.state==='done').length;
    const uncertain=cards.some(c=>c.state==='unknown'),total=available.length;
    return {week,cards,done,total,weather:uncertain?'unknown':total>0&&done===total?'sun':done>0?'partly':'cloud',remaining:cards.filter(c=>['todo','partial'].includes(c.state)).map(c=>c.label)};
  }
  const api={summary};if(typeof module!=='undefined')module.exports=api;else root.StudentDashboardModel=api;
})(globalThis);
