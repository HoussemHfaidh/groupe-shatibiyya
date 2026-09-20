(function (root) {
  'use strict';
  const normalize = value => String(value ?? '').normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
  function time(value) {
    if (typeof value === 'number') return Math.round((value - 25569) * 86400000);
    const text = String(value ?? '').trim();
    let m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (!m) {
      const us = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
      if (us) { let hour = Number(us[4]); if (us[7]) hour = hour % 12 + (/pm/i.test(us[7]) ? 12 : 0); m = ['', us[3], us[1], us[2], hour, us[5], us[6] || 0]; }
    }
    if (!m) throw Error('صيغة الوقت غير معروفة: ' + text);
    const parts = m.slice(1, 7).map(v => Number(v || 0));
    const result = Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5]);
    const d = new Date(result);
    if (d.getUTCFullYear() !== parts[0] || d.getUTCMonth() !== parts[1] - 1 || d.getUTCDate() !== parts[2] || parts[3] > 23 || parts[4] > 59 || parts[5] > 59) throw Error('تاريخ أو وقت غير صالح');
    return result;
  }
  function parseCSV(text) {
    text = text.replace(/^\uFEFF/, '');
    const first = text.split(/\r?\n/)[0];
    const delimiter = first.includes('\t') ? '\t' : first.includes(';') ? ';' : ',';
    const rows = []; let row = [], cell = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
      else if (c === delimiter && !quoted) { row.push(cell); cell = ''; }
      else if ((c === '\n' || c === '\r') && !quoted) { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += c;
    }
    if (quoted) throw Error('ملف CSV غير مكتمل');
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }
  const aliases = {
    name: ['name (original name)', 'name', 'nom (nom original)', 'nom'],
    join: ['join time', 'heure de connexion', 'heure d’arrivée', "heure d'arrivée"],
    leave: ['leave time', 'heure de départ', 'heure de déconnexion'],
    minutes: ['duration (minutes)', 'duration (min)', 'durée (minutes)'],
    waiting: ['in waiting room', 'dans la salle d’attente', "dans la salle d'attente"]
  };
  function records(rows) {
    let columns, header = -1;
    for (let i = 0; i < rows.length; i++) {
      const names = rows[i].map(normalize);
      const found = Object.fromEntries(Object.entries(aliases).map(([key, options]) => [key, names.findIndex(n => options.includes(n))]));
      if (['name', 'join', 'leave', 'minutes'].every(k => found[k] >= 0)) { columns = found; header = i; break; }
    }
    if (!columns) throw Error('يلزم تقرير Zoom المفصل: Name، Join time، Leave time، Duration (minutes).');
    const result = [];
    rows.slice(header + 1).forEach((row, index) => {
      if (!['name', 'join', 'leave', 'minutes'].some(k => String(row[columns[k]] ?? '').trim())) return;
      if (['yes', 'oui', 'true', 'نعم'].includes(normalize(row[columns.waiting]))) return;
      try {
        const name = String(row[columns.name] ?? '').trim().replace(/\s+/g, ' ');
        const rawMinutes = row[columns.minutes];
        const minutes = Number(String(rawMinutes ?? '').replace(',', '.'));
        const join = time(row[columns.join]), leave = time(row[columns.leave]);
        if (!name || rawMinutes === undefined || String(rawMinutes).trim() === '' || !Number.isFinite(minutes) || minutes < 0 || !Number.isFinite(join) || !Number.isFinite(leave) || leave < join) throw Error('بيانات ناقصة أو مدة غير صالحة');
        result.push({ name, join, leave, minutes });
      } catch (e) { throw Error(`السطر ${header + index + 2}: ${e.message}`); }
    });
    if (!result.length) throw Error('لا توجد مشاركات في التقرير');
    return result;
  }
  function calculate(input, teacherName = 'Gharbi') {
    const grouped = new Map();
    for (const r of input) {
      const key = normalize(r.name);
      const item = grouped.get(key) || { key, name: r.name, minutes: 0, join: r.join, leave: r.leave, connections: 0 };
      item.minutes += r.minutes; item.join = Math.min(item.join, r.join); item.leave = Math.max(item.leave, r.leave); item.connections++;
      grouped.set(key, item);
    }
    const teacher = grouped.get(normalize(teacherName));
    if (!teacher || teacher.minutes <= 0) throw Error('لم يتم العثور على الأستاذ Gharbi بمدة حضور صالحة.');
    if (input.some(r => Math.floor(r.join / 86400000) !== Math.floor(teacher.join / 86400000))) throw Error('استورد تقرير جلسة واحدة فقط في كل مرة.');
    const participants = [...grouped.values()].filter(p => p !== teacher).map(p => ({ ...p, ratio: p.minutes / teacher.minutes, late: p.join - teacher.join >= 300000, low: p.minutes / teacher.minutes < .7 }));
    participants.sort((a, b) => a.join - b.join || a.name.localeCompare(b.name));
    return { teacher, participants, date: new Date(teacher.join).toISOString().slice(0, 10) };
  }
  // Reference workbook displays source wall-clock times minus two hours.
  const displayTime = timestamp => new Date(timestamp - 2 * 3600000).toISOString().slice(11, 19);
  const displayDate = timestamp => new Date(timestamp - 2 * 3600000).toISOString().slice(0, 10);
  const api = { normalize, time, parseCSV, records, calculate, displayTime, displayDate };
  if (typeof module !== 'undefined') module.exports = api;
  else root.AttendanceModel = api;
})(typeof window === 'undefined' ? globalThis : window);
