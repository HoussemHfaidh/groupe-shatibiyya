/* Build a clean, complete image from matrix values, never from editor controls. */
window.MatrixShare = (() => {
  function render({rows,week,group,closed,previous}) {
    if(!rows.length)throw Error('لا توجد بيانات للمشاركة.');
    const M=MatrixModel, host=document.createElement('div');
    host.className='matrix-export-host';host.style.cssText='position:fixed;left:-20000px;top:0;width:1800px;pointer-events:none';
    host.dir='rtl';document.body.append(host);
    const corrected=rows.some(row=>Object.values(row.overrides||{}).some(value=>typeof value==='boolean'||Object.keys(value||{}).length));
    function table(columns,kind){
      const table=document.createElement('table');table.className='matrix-table';host.append(table);
      const head=table.createTHead().insertRow();
      for(const [,label] of columns){const cell=document.createElement('th');cell.textContent=label;head.append(cell);}
      const body=table.createTBody();
      for(const row of rows){
        const line=body.insertRow(),prior={...previous(row.student),...row.overrides?.previous},progress=M.smallProgress(row.minor,prior);
        for(const [id] of columns){
          const cell=line.insertCell();let value;
          if(id==='student')value=row.student;
          else if(id==='status'){value=!row.result?'بيانات ناقصة':row.result.suspended?'معلق الأسبوع التالي':'متاح الأسبوع التالي';cell.style.backgroundColor=!row.result?'#fff1cf':row.result.suspended?'#ffe2e2':'#e4f5e8';}
          else if(id==='previous')value=prior[kind==='minor'?'smallCarry':'largeCarry']||0;
          else if(id==='total')value=kind==='minor'?progress?.smallTotal:row.result?.total;
          else if(id==='carry')value=kind==='minor'?progress?.smallCarry:row.result?.largeCarry;
          else if(id==='triples')value=row.overrides?.major?.triples??progress?.triples;
          else value=row[kind][id];
          const marked=id==='previous'?Object.hasOwn(row.overrides?.previous||{},kind==='minor'?'smallCarry':'largeCarry'):id==='status'?typeof row.overrides?.suspended==='boolean':Object.hasOwn(row.overrides?.[kind]||{},id);
          cell.textContent=(value==null?'—':kind==='major' && M.large.some(([key])=>key===id) && value===1?'×':String(value))+(marked?' *':'');
          if(value==null)cell.style.backgroundColor='#fff1cf';
        }
      }
      return table;
    }
    try{
      const first=TableShare.render(table([['student','الاسم'],...M.small,['previous','رصيد سابق'],['total','المجموع'],['carry','الرصيد المتبقي']],'minor'),'المخالفات الصغيرة');
      const second=TableShare.render(table([['student','الاسم'],...M.large,['previous','رصيد سابق'],['total','المجموع'],['carry','الرصيد القادم'],['status','حالة الأسبوع التالي']],'major'),'تعليق الختمة الفردية');
      const canvas=document.createElement('canvas');canvas.width=Math.max(first.width,second.width);canvas.height=first.height+second.height+340;
      const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);
      context.direction='rtl';context.textAlign='center';context.fillStyle='#142239';context.font='bold 40px Arial';
      context.fillText(`حالة الطلاب · ${group} · ${closed?'أسبوع مغلق':'معاينة غير نهائية'}`,canvas.width/2,58,canvas.width-64);
      context.font='30px Arial';context.fillText(`الأسبوع: ${week.startDate} — ${week.endDate}`,canvas.width/2,106,canvas.width-64);
      context.fillText(`حالة الختمة للأسبوع التالي: ${week.endDate} — ${M.addDays(week.endDate,7)}`,canvas.width/2,150,canvas.width-64);
      context.drawImage(first,(canvas.width-first.width)/2,180);context.drawImage(second,(canvas.width-second.width)/2,first.height+200);
      context.font='26px Arial';context.fillText('× = مخالفة واحدة · — = بيانات ناقصة · كل 3 مخالفات صغيرة = نقطة واحدة',canvas.width/2,canvas.height-80,canvas.width-64);
      context.fillText(corrected?'* تصحيح الأستاذ · عند بلوغ 3 نقاط تعلق الختمة للأسبوع التالي':'عند بلوغ 3 نقاط تعلق الختمة للأسبوع التالي',canvas.width/2,canvas.height-36,canvas.width-64);
      return canvas;
    }finally{host.remove();}
  }
  async function save(canvas,{share,filename,title}){
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    if(!blob)throw Error('تعذر إنشاء صورة الجدول.');
    const file=new File([blob],filename,{type:'image/png'});
    if(share && navigator.share && navigator.canShare?.({files:[file]})){
      await navigator.share({files:[file],title});return 'shared';
    }
    const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return 'downloaded';
  }
  return {render,save};
})();
