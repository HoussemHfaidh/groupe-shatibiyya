const {test} = require('node:test');
const assert = require('node:assert/strict');
const m = require('../attendance-model');
const start = Date.UTC(2026, 8, 12, 7, 46, 2);
const record = (name, minutes, delay = 0) => ({ name, minutes, join: start + delay * 60000, leave: start + 100 * 60000 });
test('reconnections grouped by name; teacher excluded; exact 5 minute and 70% boundaries', () => {
  const result = m.calculate([record('Gharbi', 100), record(' Ali ', 40, 5), record('ali', 30, 30), record('Late', 69, 5), record('Early', 70, 4.99)]);
  assert.equal(result.participants.length, 3);
  const ali = result.participants.find(p => p.key === 'ali');
  assert.equal(ali.minutes, 70); assert.equal(ali.connections, 2); assert.equal(ali.late, true); assert.equal(ali.low, false);
  assert.equal(result.participants.find(p => p.name === 'Late').low, true);
  assert.equal(result.participants.find(p => p.name === 'Early').late, false);
});
test('teacher reconnects and values above 100% follow reference summation', () => {
  const result = m.calculate([record('Gharbi', 60), record('Gharbi', 40, 60), record('Houssem', 110, 6)]);
  assert.equal(result.teacher.minutes, 100); assert.equal(result.participants[0].ratio, 1.1);
  assert.throws(() => m.calculate([record('Other', 50)]));
  assert.throws(() => m.calculate([record('Gharbi', 0)]));
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
