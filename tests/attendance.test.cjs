const {test} = require('node:test');
const assert = require('node:assert/strict');
const m = require('../attendance-model');
const start = Date.UTC(2026, 8, 12, 7, 46, 2);
const record = (name, minutes, delay = 0) => ({ name, minutes, join: start + delay * 60000, leave: start + (delay + minutes) * 60000 });
test('group 1 transliterations match its own roster; ambiguous Asma stays editable',()=>{
 const match=require('../attendance-matching');
 const roster=['حمزة الورتاني','أشرف السماوي','حسنين عكروت','آدم الماجري','معز بن زيد','حسام حفيظ','مالك بن عبدالله','أسماء شلبي','أسماء قرشان'];
 for(const [zoom,student] of [['Hamza Wertani',roster[0]],['AchrafSMAOUI',roster[1]],['Hassanine AKROUT',roster[2]],['adem mejri',roster[3]],['Moez',roster[4]],['Houssem',roster[5]],['Melek',roster[6]]]) assert.equal(match.resolve(zoom,roster).name,student);
 assert.equal(match.resolve('اسماء',roster).name,null);
});
test('professor custom names override matching and persist in aliases',()=>{
 const students=['أشرف قرمش'];
 const s={...m.calculate([record('Gharbi',100),record('Achraf Guermech',90)],'Gharbi',{students}),id:'s',flags:{}};
 const renamed=m.renameParticipant(s,s.participants[0].key,'اسم اختاره الأستاذ',{},students);
 assert.equal(renamed.value.participants[0].name,'اسم اختاره الأستاذ');
 assert.equal(m.calculate(s.rawRecords,'Gharbi',{students,aliases:renamed.aliases}).participants[0].name,'اسم اختاره الأستاذ');
 assert.throws(()=>m.renameParticipant(s,s.participants[0].key,'   '));
 assert.throws(()=>m.renameParticipant(s,s.participants[0].key,'x'.repeat(161)));
});
test('deletion excludes all source variants and survives recalculation; restore keeps flags',()=>{
 const options={students:['أشرف قرمش']};
 const s={...m.calculate([record('Gharbi',100),record('Achraf Guermech',70),record('Achraf.Guermech',90,10)],'Gharbi',options),flags:{}};
 const key=s.participants[0].key; s.flags[key]={excused:true};
 let removed=m.removeParticipant(s,key,options);
 assert.equal(removed.participants.length,0); assert.equal(removed.excludedNames.length,1);
 assert.equal(m.recalculateSession(removed,options).participants.length,0);
 const restored=m.restoreParticipant(removed,removed.excludedNames[0],options);
 assert.equal(restored.participants.length,1); assert.equal(restored.participants[0].minutes,100); assert.equal(restored.flags[key].excused,true);
 assert.equal(s.participants.length,1);
});
test('legacy rows support rename, delete, restore and retain original source for reimport',()=>{
 const old={participants:[{key:'old',name:'Zoom Old',minutes:60,join:start,leave:start+3600000}],flags:{old:{removed:true}}};
 const renamed=m.renameParticipant(old,'old','Nom Corrigé');
 const deleted=m.removeParticipant(renamed.value,'old');
 assert.equal(deleted.participants.length,0); assert.deepEqual(deleted.excludedNames,['zoomold']);
 const restored=m.restoreParticipant(deleted,'old');
 assert.equal(restored.participants[0].name,'Nom Corrigé'); assert.deepEqual(restored.excludedNames,[]);
 assert.equal(restored.flags.old.removed,true);
});
test('punctuation, Latin/Arabic spelling and group roster map one student', () => {
  const r = m.calculate([record('Gharbi',100), record('Achraf Guermech',70),record('Achraf.Guermech',85,15)], 'Gharbi', {students:['أشرف قرمش','نور القاضي']});
  assert.equal(r.participants.length,1);
  assert.equal(r.participants[0].name,'أشرف قرمش');
  assert.equal(r.participants[0].minutes,100);
  assert.equal(r.participants[0].late,false);
  assert.equal(r.participants[0].sourceNames.length,2);
});
test('overlap union, disconnected periods, duplicate devices and teacher gaps', () => {
  const r = m.calculate([record('Gharbi',40),record('Gharbi',40,60),record('Ali',100),record('Ali',100),record('Other',20,10),record('Other',10,70)]);
  assert.equal(r.teacher.minutes,80);
  assert.equal(r.participants.find(p=>p.name==='Ali').minutes,80);
  assert.equal(r.participants.find(p=>p.name==='Other').minutes,30);
  assert.ok(r.participants.every(p=>p.ratio<=1));
});
test('thresholds use exact non-rounded duration and first join', () => {
  const r=m.calculate([record('Gharbi',100),record('At70',70),record('Below70',69.99),record('At5',50,5),record('Before5',50,4.99)]);
  const get=n=>r.participants.find(p=>p.name===n);
  assert.equal(get('At70').low,false); assert.equal(get('Below70').low,true);
  assert.equal(get('At5').late,true); assert.equal(get('Before5').late,false);
  assert.throws(()=>m.calculate([record('Nobody',100)]));
  assert.throws(()=>m.calculate([record('Gharbi',0)]));
});
test('ambiguous names never merge; remembered choices restricted to roster', () => {
  const match=require('../attendance-matching');
  const students=['أسماء شلبي','أسماء مسعودي'];
  assert.equal(match.resolve('Asma',students).name,null);
  assert.equal(match.resolve('Asma',students,{asma:'أسماء شلبي'}).name,'أسماء شلبي');
  assert.equal(match.resolve('Asma',['أسماء مسعودي'],{asma:'أسماء شلبي'}).name,null);
  assert.equal(match.resolve('Unrelated Device',students).name,null);
  assert.equal(match.resolve('Achraf.Guermech',['أشرف قرمش'],{'achrafguermech':''}).method,'unlisted');
  assert.equal(match.resolve('Achref Guermech',['أشرف قرمش']).name,'أشرف قرمش');
  assert.equal(match.resolve('أحمد حوانب',['أحمد جوانب']).name,'أحمد جوانب');
  assert.equal(match.resolve('Nour',['نور القاضي']).name,'نور القاضي');
  assert.equal(match.resolve('Achraf Guermech',['أشرف قرمش','أشرف كرمش']).name,null);
});
test('case/spacing/punctuation variants merge even before identification',()=>{
  const r=m.calculate([record('Gharbi',100),record(' A.Chraf ',50),record('a chraf',50,50)]);
  assert.equal(r.participants.length,1); assert.equal(r.participants[0].minutes,100);
});
test('legacy and remapped manual flags survive merging without changing old sessions',()=>{
  const old={participants:[{key:'achraf guermech',name:'Achraf Guermech'},{key:'achraf.guermech',name:'Achraf.Guermech'}],flags:{'achraf guermech':{excused:true},'achraf.guermech':{removed:true}}};
  const before=JSON.stringify(old);
  const r=m.calculate([record('Gharbi',100),record('Achraf Guermech',60),record('Achraf.Guermech',40,60)],'Gharbi',{students:['أشرف قرمش']});
  const flags=m.migrateFlags(old,r);
  assert.deepEqual(flags[r.participants[0].key],{excused:true,removed:true}); assert.equal(JSON.stringify(old),before);
});
test('CSV quoted names, multiline fields, waiting room and invalid source rows', () => {
  const csv = '\uFEFFName (original name),Join time,Leave time,Duration (minutes),In waiting room\r\nGharbi,09/12/2026 07:46:02,09/12/2026 09:26:02,100,No\r\n"Ali, A",09/12/2026 07:51:02,09/12/2026 08:51:02,60,No\r\nWaiting,,,,Yes';
  const rows = m.records(m.parseCSV(csv));
  assert.equal(rows.length, 2); assert.equal(rows[1].name, 'Ali, A'); assert.equal(rows[0].join, start);
  assert.equal(m.calculate(rows).participants[0].late, true);
  assert.throws(() => m.records(m.parseCSV(csv.replace(',60,No', ',,No'))));
  assert.throws(() => m.time('2026-02-30 12:00:00'));
  assert.throws(() => m.parseCSV('"unfinished'));
});
test('Excel numeric times preserve wall clock; midnight exit works', () => {
  assert.equal(m.time(start / 86400000 + 25569), start);
  assert.equal(m.time('09/12/2026 12:30:00 AM'), Date.UTC(2026, 8, 12, 0, 30));
  const rows = [['Name', 'Join time', 'Leave time', 'Duration (minutes)'], ['Gharbi', '2026-09-12 23:00:00', '2026-09-13 01:00:00', 120]];
  assert.equal(m.calculate(m.records(rows)).teacher.minutes, 120);
});
test('GMT-2 display subtracts two hours, including date rollover, without changing durations', () => {
  assert.equal(m.displayTime(start), '05:46:02');
  const early = Date.UTC(2026, 8, 12, 1, 30);
  assert.equal(m.displayTime(early), '23:30:00');
  assert.equal(m.displayDate(early), '2026-09-11');
  assert.equal(m.calculate([record('Gharbi', 162), record('Ali', 160)]).participants[0].minutes, 160);
});

test('percentage uses professor actual duration, never rounded Zoom minutes, and displays threshold honestly',()=>{
 const result=m.calculate([record('Gharbi',60),record('Exact',42),record('Below',41.999),record('Whole',90,-15)]);
 const exact=result.participants.find(p=>p.name==='Exact'), below=result.participants.find(p=>p.name==='Below'),whole=result.participants.find(p=>p.name==='Whole');
 assert.equal(exact.ratio,.7);assert.equal(exact.low,false);assert.equal(m.formatPercent(exact.ratio),'70%');
 assert.equal(below.low,true);assert.notEqual(m.formatPercent(below.ratio),'70%');
 assert.equal(whole.ratio,1);assert.equal(m.formatPercent(whole.ratio),'100%');
 // Zoom's independently rounded Duration column cannot alter percentages.
 const raw=[record('Gharbi',60),record('Exact',42)];raw[0].minutes=61;raw[1].minutes=43;
 assert.equal(m.calculate(raw).participants[0].ratio,.7);
});
