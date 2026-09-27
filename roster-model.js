/* Canonical group roster. Name aliases preserve existing records and login profiles. */
(function(root) {
  const normalize = n => String(n).toLowerCase().normalize('NFKD').replace(/[\u064b-\u065f\u0670]/g,'').replace(/[إأآا]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  const id = n => normalize(n).replace(/\s+/g,'-');
  function resolve(name, aliases = []) {
    const seen = new Set();
    while (typeof name === 'string' && !seen.has(name)) {
      seen.add(name); const item = aliases.find(a => a.from === name);
      if (!item) break; name = item.to;
    }
    return name;
  }
  function project(value, aliases = []) {
    if (!value || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(v => project(v, aliases));
    const result = {};
    for (const [key, item] of Object.entries(value)) {
      if (['student','validator','validatorLabel','studentName'].includes(key) && typeof item === 'string') result[key] = resolve(item, aliases);
      else if (['students','missed'].includes(key) && Array.isArray(item)) result[key] = [...new Set(item.map(n => resolve(n, aliases)))];
      else if (key === 'assigned' && item) result[key] = Object.fromEntries(Object.entries(item).map(([n,v]) => [resolve(n,aliases),v]));
      else result[key] = project(item,aliases);
    }
    return result;
  }
  function config(value) {
    const aliases = value.studentAliases || [];
    const result = {...value, students:(value.students || []).map(n=>resolve(n,aliases)), studentAliases:aliases};
    result.statuses = {...value.statuses}; result.readyAt = {...value.readyAt};
    for (const field of ['statuses','readyAt']) {
      for (const [key,val] of Object.entries(value[field] || {})) {
        const split = key.indexOf('__'); if(split < 0) continue;
        const alias = aliases.find(a => id(a.from) === key.slice(0,split));
        if(alias) { delete result[field][key]; result[field][id(resolve(alias.to,aliases))+key.slice(split)] = val; }
      }
    }
    result.readyOrder = Object.fromEntries(Object.entries(value.readyOrder || {}).map(([week,names]) => [week,[...new Set(names.map(n=>resolve(n,aliases)))]]));
    return result;
  }
  function edit(value, action, oldName, newName) {
    let next = config(structuredClone(value));
    const name = typeof newName === 'string' ? newName.trim().replace(/\s+/g,' ') : '';
    if(!['add','rename','remove'].includes(action)) throw Error('عملية غير صالحة.');
    if(action !== 'remove') {
      if(!normalize(name) || name.length > 160 || /[.#$\[\]\/\u0000-\u001f\u007f]/.test(name) || ['__proto__','prototype','constructor'].includes(name)) throw Error('أدخل اسما صالحا (160 حرفا كحد أقصى).');
      if(next.students.some(n=> n!==oldName && normalize(n)===normalize(name))) throw Error('هذا الاسم موجود في المجموعة.');
      if(next.studentAliases.some(a=>normalize(a.from)===normalize(name) && resolve(a.to,next.studentAliases)!==oldName)) throw Error('هذا الاسم مرتبط بسجل طالب آخر.');
    }
    if(action!=='add' && !next.students.includes(oldName)) throw Error('تغيرت قائمة الطلاب. حدّث الصفحة.');
    if(action==='add') next.students.push(name);
    if(action==='remove') next.students=next.students.filter(n=>n!==oldName);
    if(action==='rename' && oldName!==name) {
      if(next.studentAliases.some(a=>a.from===name)) throw Error('هذا الاسم مستخدم سابقا. اختر اسما مختلفا.');
      if((next.retiredStudents || []).some(n=>normalize(n)===normalize(name))) throw Error('هذا الاسم مرتبط بطالب محذوف. أعد إضافته باسمه قبل التعديل.');
      next.studentAliases.push({from:oldName,to:name}); next=config(next);
    }
    next.retiredStudents = [...new Set([...(next.retiredStudents || []), ...(action==='remove'?[oldName]:[])])].filter(n=>!next.students.includes(n));
    next.rosterInitialized = true;
    next.rosterRevision = (value.rosterRevision || 0)+1;
    return next;
  }
  const api={normalize,resolve,project,config,edit};
  if(typeof module!=='undefined') module.exports=api; else root.RosterModel=api;
})(globalThis);
