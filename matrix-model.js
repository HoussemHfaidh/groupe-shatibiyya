/* Weekly professor matrix. Closed snapshots are the only source of carried points. */
(function (root) {
  'use strict';
  const small = [['late','تأخر عن حصة الشاطبية'],['incomplete','عدم مراجعة كامل المطلوب'],['removed','إخراج لعدم الاستجابة'],['form','عدم تعبئة نموذج متابعة الختمة الفردية']];
  const large = [['makeup','عدم التدارك'],['jam','عدم إتمام واجب الجمع'],['absence','غياب دون عذر عن حصة الشاطبية'],['iqra','غياب دون عذر عن حصة الإقراء الفردي'],['triples','تراكم 3 مرات'],['recitation','عدم تسميع الأبيات'],['review','عدم المراجعة']];
  const addDays = (date,n) => new Date(Date.parse(date)+n*86400000).toISOString().slice(0,10);
  const count = n => Number.isInteger(n) && n >= 0;
  function smallProgress(minor, previous = {}) {
    if (!small.every(([k])=>count(minor[k]))) return null;
    const total = (previous.smallCarry || 0) + small.reduce((n,[k])=>n+minor[k],0);
    return {smallTotal:total,smallCarry:total%3,triples:Math.floor(total/3)};
  }
  function calculate(minor, major, previous = {}, options = {}) {
    if (![...small.map(([k])=>minor[k]), ...large.filter(([k])=>k!=='triples').map(([k])=>major[k])].every(count)) return null;
    const smallTotal = (previous.smallCarry || 0) + small.reduce((n,[k])=>n+minor[k],0);
    const triples = options.triples ?? Math.floor(smallTotal / 3);
    if(!count(triples)) return null;
    const points = {...major, triples};
    const total = (previous.largeCarry || 0) + large.reduce((n,[k])=>n+points[k],0);
    return {minor, major:points, smallPrevious:previous.smallCarry || 0, largePrevious:previous.largeCarry || 0,
      smallTotal, smallCarry:smallTotal%3, total, largeCarry:(options.suspended ?? total>=3)?0:(total>=3?0:total), suspended:options.suspended ?? total>=3, automaticSuspended:total>=3};
  }
  function sourceRow(student, week, sources, manual = {}, previous) {
    const sessions = sources.attendance.filter(s=>s.date>=week.startDate && s.date<week.endDate);
    // Unmatched participants may hide a student's presence: require matching before counting.
    const attendanceReady = sessions.length && sessions.every(s=>(s.participants || []).every(p=>p.matched || sources.students.includes(p.name)));
    const participants = sessions.flatMap(s=>(s.participants||[]).filter(p=>p.name===student).map(p=>({p,flags:s.flags?.[p.key]})));
    const reviewWeek = sources.review[week.startDate];
    const review = reviewWeek?.records?.find(r=>r.student===student);
    const jamWeek = Object.values(sources.jam).find(w=>w.startDate===week.startDate);
    const khatmaWeek = sources.khatma.weeks?.[week.startDate];
    const entries = Object.values(sources.khatma.entries || {}).filter(e=>e.student===student && e.date>=week.startDate && e.date<week.endDate);
    const recitations = sources.recitations.filter(w=>w.date>=week.startDate && w.date<week.endDate);
    const minor = {
      late:attendanceReady?participants.filter(({p})=>p.late).length:null,
      incomplete:reviewWeek?.students?.includes(student)?Number(!!review && review.complete===false):null,
      removed:attendanceReady?participants.filter(({flags})=>flags?.removed).length:null,
      form:khatmaWeek?.students?.includes(student)?Number(!entries.length):null,
    };
    const major = {
      makeup:manual.makeup??null, absence:manual.absence??null, iqra:manual.iqra??null,
      jam:jamWeek?.students?.includes(student)?Number(!(jamWeek.confirmations||[]).some(r=>r.student===student)):null,
      recitation:recitations.length?recitations.reduce((n,w)=>n+Number(!['done','makeup'].includes(w.statuses[student])),0):null,
      review:reviewWeek?.students?.includes(student)?Number(!review):null,
    };
    return {student,minor,major,result:calculate(minor,major,previous)};
  }
  function applyOverrides(row, overrides = {}, previous = {}) {
    const sourceMinor = row.sourceMinor || row.minor, sourceMajor = row.sourceMajor || row.major;
    const minor = {...sourceMinor,...overrides.minor}, major = {...sourceMajor,...overrides.major};
    const prior = {...previous,...overrides.previous};
    const result = calculate(minor,major,prior,{triples:overrides.major?.triples,suspended:overrides.suspended});
    if(result) major.triples=result.major.triples;
    return {...row,sourceMinor,sourceMajor,minor,major,overrides,result};
  }
  function reflow(store) {
    const next=structuredClone(store), previous={};
    for(const week of Object.values(next.closed || {}).sort((a,b)=>a.startDate.localeCompare(b.startDate))){
      week.rows=week.rows.map(row=>{
        const updated=applyOverrides(row,next.overrides?.[week.startDate]?.[row.student],previous[row.student]);
        if(updated.result)previous[row.student]=updated.result;
        return updated;
      });
    }
    return next;
  }
  function correct(store, weekId, student, kind, field, value, now = new Date()) {
    const allowed = kind==='minor'?small.map(([key])=>key):kind==='major'?large.map(([key])=>key):kind==='previous'?['smallCarry','largeCarry']:kind==='status'?['suspended']:[];
    if(!allowed.includes(field) || (value!==null && (kind==='status'?typeof value!=='boolean':!count(value)))) throw Error('قيمة التصحيح غير صالحة.');
    const next=structuredClone(store);next.overrides ||= {};next.overrides[weekId] ||= {};next.overrides[weekId][student] ||= {};
    const target=next.overrides[weekId][student];
    const object=kind==='status'?target:(target[kind] ||= {});
    const before=object[field] ?? null;
    if(value===null)delete object[field];else object[field]=value;
    next.audit ||= [];next.audit.push({weekId,student,kind,field,before,value,at:now.toISOString()});
    return reflow(next);
  }
  function previousFor(store, week, student) {
    const prior = Object.values(store.closed || {}).filter(w=>w.startDate<week.startDate).sort((a,b)=>b.startDate.localeCompare(a.startDate));
    return prior.map(w=>w.rows.find(r=>r.student===student)?.result).find(Boolean) || {};
  }
  function close(store, week, rows, now = new Date(), deadline) {
    if (now < deadline) throw Error('يمكن إغلاق الأسبوع بعد نهايته فقط.');
    if (store.closed?.[week.startDate]) throw Error('هذا الأسبوع مغلق بالفعل.');
    if (Object.keys(store.closed || {}).some(id=>id>week.startDate)) throw Error('لا يمكن إغلاق أسبوع أقدم من آخر أسبوع مغلق.');
    if (!rows.length || rows.some(r=>!r.result)) throw Error('أكمل البيانات الناقصة قبل إغلاق الأسبوع.');
    return {...store,closed:{...store.closed,[week.startDate]:{...week,rows:structuredClone(rows),closedAt:now.toISOString()}}};
  }
  const api={small,large,addDays,smallProgress,calculate,sourceRow,applyOverrides,reflow,correct,previousFor,close};
  if(typeof module!=='undefined')module.exports=api;else root.MatrixModel=api;
})(globalThis);
