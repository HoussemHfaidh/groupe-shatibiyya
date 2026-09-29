window.StudentDashboard=(()=>{
  let ctx,key='',panel,content,connection,nav,watch,epoch=0,lastRead=0;
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  const labels={recitation:'التسميع',jam:'واجب الجمع',review:'المراجعة',khatma:'متابعة الختمات الفردية'};
  function show(refreshNow=true){
    if(!ctx)return;
    const navigation=ctx.host.querySelector('.jam-navigation');
    navigation.querySelector('button').click();
    [...ctx.host.children].filter(n=>n!==panel&&!n.contains(navigation)&&!n.matches('.account-box,.eyebrow')).forEach(n=>n.hidden=true);
    panel.hidden=false;[...navigation.children].forEach(n=>n.setAttribute('aria-pressed',String(n===nav)));
    if(refreshNow)watch?.refresh();
  }
  function build(){
    panel=el('section',undefined,'student-dashboard');content=el('div');connection=el('p','جار تحديث أسبوعك…','dashboard-connection');connection.setAttribute('aria-live','polite');
    const refresh=el('button','تحديث حالتي','secondary');refresh.type='button';refresh.onclick=()=>watch?.refresh();
    panel.append(content,connection,refresh);ctx.host.append(panel);
    const navigation=ctx.host.querySelector('.jam-navigation');nav=el('button','أسبوعي','secondary');nav.type='button';nav.onclick=()=>show();
    navigation.addEventListener('click',e=>{if(e.target!==nav){panel.hidden=true;nav.setAttribute('aria-pressed','false');}});navigation.append(nav);navigation.before(panel);nav.style.order='-1';
    // The existing first button was التسميع; keep its navigation behavior available.
  }
  function activate(id){
    const target=[...ctx.host.querySelectorAll('.jam-navigation button')].find(b=>b.textContent===labels[id]);
    if(target && !target.hidden && !target.disabled)target.click();
  }
  function draw(data){
    const model=StudentDashboardModel.summary(data),weather={sun:['☀️','أسبوعك مشمس','أنجزت كل الأنشطة المتاحة هذا الأسبوع.'],partly:['🌤️','أسبوعك يتقدم','خطوة أخرى تقربك من إكمال أسبوعك.'],cloud:['☁️','أسبوع جديد، بداية طيبة','ابدأ بنشاط واحد وتابع تقدمك هنا.'],unknown:['☁️','ننتظر آخر تحديث','بعض البيانات غير متاحة الآن؛ لا نعتبرها أنشطة غير منجزة.']}[model.weather];
    content.replaceChildren();
    const hero=el('div',undefined,`dashboard-hero dashboard-${model.weather}`),icon=el('span',weather[0],'dashboard-weather');icon.setAttribute('aria-hidden','true');
    const copy=el('div');copy.append(el('p','أسبوعي','eyebrow'),el('h2',weather[1]),el('p',weather[2]));hero.append(icon,copy);content.append(hero);
    content.append(el('p',`${ctx.name} · ${ctx.groupLabel} · ${model.week.startDate} — ${model.week.endDate}`,'dashboard-period'));
    const progress=el('div',`${model.done} من ${model.total} أنشطة متاحة مكتملة`,'dashboard-progress');content.append(progress);
    const bar=el('progress');bar.max=model.total||1;bar.value=model.done;bar.setAttribute('aria-label','تقدم أنشطة الأسبوع');content.append(bar);
    const cards=el('div',undefined,'dashboard-grid');
    for(const card of model.cards){const button=el('button',undefined,`dashboard-card dashboard-${card.state}`);button.type='button';button.dataset.activity=card.id;button.disabled=card.state==='waiting';
      button.append(el('strong',card.label),el('span',({done:'✓ مكتمل',todo:'○ لم يكتمل بعد',partial:'◐ غير مكتمل',waiting:'— غير متاح بعد',unknown:'؟ تعذر التحديث'})[card.state],'dashboard-badge'),el('span',card.detail),el('span',card.state==='waiting'?'سنخبرك عند توفره':'فتح النشاط ←','dashboard-link'));button.onclick=()=>activate(card.id);cards.append(button);
    }content.append(cards);
    content.append(el('p',model.remaining.length?`المتبقي هذا الأسبوع: ${model.remaining.join('، ')}.`:model.weather==='sun'?'كل شيء مكتمل لهذا الأسبوع. أحسنت المتابعة.':'ستظهر هنا الأنشطة الجديدة عند فتحها.','dashboard-next'));
    content.append(el('p','هذه متابعة لإنجاز الأنشطة، وليست قرار تعليق الختمة. تسجيل متابعة الختمة يعني تعبئة النموذج، وليس بالضرورة حضور الحصة.','dashboard-note'));
  }
  async function refresh(){
    const c=ctx,token=epoch,request=++lastRead;
    const types=['config','jam','review','khatma'];
    const results=await Promise.allSettled(types.map(async type=>{
      const remote=c.url(type),url=(type!=='config'&&c.local)?`/api/${type}/${encodeURIComponent(c.storageId)}`:remote||'/api/config';
      const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error(type);
      const data=await response.json();return url.startsWith('/api/')&&type!=='config'?(data.value||{}):(data||{});
    }));
    if(token!==epoch||request!==lastRead||!ctx)return;
    const values={},errors=[];results.forEach((r,i)=>{if(r.status==='fulfilled')values[types[i]]=r.value;else errors.push(types[i]);});
    const config=values.config?RosterModel.config(values.config):null;
    if(config){c.name=RosterModel.resolve(c.name,config.studentAliases);c.day=config.settings?.weekBoundaryDay??c.day;
      if(!config.students.includes(c.name)){logout();return;}
      for(const type of ['jam','review','khatma'])if(values[type])values[type]=RosterModel.project(values[type],config.studentAliases);
    }
    draw({...values,config,name:c.name,day:c.day,jamEnabled:c.jamEnabled,errors});
    connection.textContent=errors.length?'تعذر تحديث بعض الأنشطة. تحقق من الاتصال؛ سنعيد المحاولة تلقائيا.':`آخر تحديث: ${new Date().toLocaleTimeString('ar',{hour:'2-digit',minute:'2-digit',second:'2-digit'})} · تحديث تلقائي`;
  }
  function mount(next){
    if(!/^login-(test|sandbox)-group[12]$/.test(next.storageId))return;
    const nextKey=`${next.storageId}:${next.name}`;ctx=next;
    if(!panel)build();
    nav.hidden=false;
    if(key===nextKey){if(!panel.hidden)show(false);return;}
    key=nextKey;epoch++;watch?.stop();content.replaceChildren();connection.textContent='جار تحديث أسبوعك…';
    show(false);watch=LiveData.watch({prepare:()=>ctx?.prepare?.(),urls:()=>['config','jam','review','khatma'].filter(type=>type==='config'||!ctx.local).map(type=>ctx.url(type)),change:refresh,state:state=>{if(state==='retry'&&ctx)connection.textContent='جار إعادة الاتصال؛ يتم التحقق تلقائيا.';}});
  }
  function logout(){epoch++;watch?.stop();watch=null;ctx=null;key='';content?.replaceChildren();if(panel)panel.hidden=true;if(nav)nav.hidden=true;}
  return {mount,logout};
})();
