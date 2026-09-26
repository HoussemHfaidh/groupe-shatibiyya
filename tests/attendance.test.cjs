const {test} = require('node:test');
const assert = require('node:assert/strict');
const m = require('../attendance-model');
const start = Date.UTC(2026, 8, 12, 7, 46, 2);
const record = (name, minutes, delay = 0) => ({ name, minutes, join: start + delay * 60000, leave: start + (delay + minutes) * 60000 });
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
