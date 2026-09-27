/* Read the central roster before section reads/writes, including on another device. */
window.Roster = {
  async refresh(ctx) {
    if(!ctx.rosterUrl) return;
    await ctx.prepare?.();
    const url=ctx.rosterUrl();
    const response=await fetch(url || '/api/config',{cache:'no-store'});
    if(!response.ok) throw Error('تعذر تحديث قائمة المجموعة. أعد المحاولة.');
    const config=RosterModel.config(await response.json() || {});
    ctx.students=config.students; ctx.studentAliases=config.studentAliases;
    if(ctx.name) ctx.name=RosterModel.resolve(ctx.name,config.studentAliases);
    if(ctx.role==='student' && !ctx.students.includes(ctx.name)) throw Error('لم تعد مسجلا في هذه المجموعة. تواصل مع الأستاذ.');
  },
  project(value,ctx) { return RosterModel.project(value,ctx.studentAliases || []); }
};
