/* Conditional writes keep independent professor corrections from overwriting one another. */
window.MatrixStore = {
  async read(url) {
    if(!url)throw Error('رابط حفظ حالة الطلاب غير متاح.');
    const response=await fetch(url,{cache:'no-store',headers:{'X-Firebase-ETag':'true'},signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw Error('تعذر تحميل حالة الطلاب من Firebase.');
    const value=await response.json() || {manual:{},closed:{}};
    if(typeof value!=='object'||Array.isArray(value))throw Error('بيانات حالة الطلاب غير صالحة.');
    return {value,etag:response.headers.get('etag')};
  },
  async update(url, change) {
    for(let attempt=0;attempt<3;attempt++){
      const snapshot=await this.read(url);
      if(!snapshot.etag)throw Error('تعذر تأمين حفظ حالة الطلاب.');
      const next=change(snapshot.value);
      const response=await fetch(url,{method:'PUT',headers:{'Content-Type':'application/json','if-match':snapshot.etag},body:JSON.stringify(next),signal:AbortSignal.timeout(15000)});
      if(response.status===412)continue;
      if(!response.ok)throw Error('تعذر الحفظ في Firebase. لم يتم اعتماد التغيير؛ أعد المحاولة.');
      return next;
    }
    throw Error('تغيرت حالة الطلاب أثناء الحفظ. حدّث البيانات وأعد المحاولة.');
  }
};
