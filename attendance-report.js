/* Full report rendering is independent of the screen size and scroll position. */
window.AttendanceReport = (() => {
  const columns = [
    ['الاسم', 230], ['مدة الحضور\n(دق)', 105], ['نسبة\nالحضور', 110],
    ['وقت الدخول', 130], ['وقت الخروج', 130],
    ['دخول\nمتأخر', 110], ['حضور أقل\nمن 70%', 125],
    ['خروج\nباستئذان', 130], ['خروج بدون\nاستئذان', 140], ['إخراج لعدم\nالاستجابة', 145]
  ];
  const number = n => Number(n.toFixed(2)).toString();
  function render(session, group) {
    const margin = 32, width = columns.reduce((sum, c) => sum + c[1], 0) + margin * 2;
    const canvas = document.createElement('canvas'), c = canvas.getContext('2d');
    c.font = '20px Arial';
    function wrap(text, maxWidth) {
      const lines = [];
      for (const paragraph of String(text).split('\n')) {
        let line = '';
        for (const word of paragraph.split(' ')) {
          const next = line ? `${line} ${word}` : word;
          if (c.measureText(next).width <= maxWidth) { line = next; continue; }
          if (line) lines.push(line);
          line = '';
          for (const char of word) {
            if (line && c.measureText(line + char).width > maxWidth) { lines.push(line); line = ''; }
            line += char;
          }
        }
        lines.push(line);
      }
      return lines;
    }
    const listed = [{...session.teacher, ratio:1, late:false, low:false, isTeacher:true}, ...session.participants];
    const rows = listed.map(p => {
      const flags = session.flags[p.key] || {};
      const values = [p.name, number(p.minutes), `${number(p.ratio * 100)}%`, AttendanceModel.displayTime(p.join), AttendanceModel.displayTime(p.leave), p.late ? 'نعم' : '—', p.low ? 'نعم' : '—', flags.excused ? '✓' : '—', flags.unexcused ? '✓' : '—', flags.removed ? '✓' : '—'];
      const lines = values.map((v, i) => { c.font = `${i === 0 ? 'bold ' : ''}20px Arial`; return wrap(v, columns[i][1] - 24); });
      return { p, flags, lines, height: Math.max(60, ...lines.map(l => l.length * 27 + 22)) };
    });
    const headerHeight = 84, tableTop = 180, footerHeight = 112;
    const height = tableTop + headerHeight + rows.reduce((sum, row) => sum + row.height, 0) + footerHeight;
    // Limit pixel area for browsers on phones, while keeping every row in one image.
    const scale = Math.min(2, Math.sqrt(24000000 / (width * height)), 16000 / height);
    canvas.width = Math.ceil(width * scale); canvas.height = Math.ceil(height * scale);
    c.scale(scale, scale); c.fillStyle = '#ffffff'; c.fillRect(0, 0, width, height);
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.direction = 'rtl';
    const text = (value, x, y, color = '#24352d', font = '20px Arial') => { c.fillStyle = color; c.font = font; c.fillText(value, x, y); };
    text('متابعة حضور الشاطبية', width / 2, 43, '#175c44', 'bold 32px Arial');
    text(`${group} · ${AttendanceModel.displayDate(session.teacher.join)}`, width / 2, 86, '#24352d', '24px Arial');
    text(`${session.teacher.name} · ${number(session.teacher.minutes)} دقيقة · ${AttendanceModel.displayTime(session.teacher.join)} — ${AttendanceModel.displayTime(session.teacher.leave)}`, width / 2, 126);
    text(`${session.participants.length} مشاركا دون الأستاذ · ${rows.filter(r => r.p.late).length} دخول متأخر · ${rows.filter(r => r.p.low).length} حضور أقل من 70%`, width / 2, 157, '#55665d', '18px Arial');
    function drawRow(lines, y, rowHeight, colors, bold = false) {
      let x = width - margin;
      columns.forEach((column, i) => {
        x -= column[1]; c.fillStyle = colors[i] || '#ffffff'; c.fillRect(x, y, column[1], rowHeight);
        c.strokeStyle = '#cbd8d0'; c.lineWidth = 1; c.strokeRect(x, y, column[1], rowHeight);
        lines[i].forEach((line, index) => text(line, x + column[1] / 2, y + rowHeight / 2 + (index - (lines[i].length - 1) / 2) * 27, '#24352d', `${bold || i === 0 ? 'bold ' : ''}20px Arial`));
      });
    }
    drawRow(columns.map(col => col[0].split('\n')), tableTop, headerHeight, columns.map(() => '#e7f0eb'), true);
    let y = tableTop + headerHeight;
    for (const row of rows) {
      const colors = [];
      if (row.p.isTeacher) columns.forEach((_, i) => colors[i] = '#edf3ef');
      if (row.p.late) colors[0] = colors[5] = '#fff09a';
      if (row.p.low) colors[6] = '#ffe0e0';
      if (row.flags.excused) colors[7] = '#c8ead6';
      if (row.flags.unexcused) colors[8] = '#ffc5c5';
      if (row.flags.removed) colors[9] = '#ddd0f0';
      drawRow(row.lines, y, row.height, colors); y += row.height;
    }
    text('الأصفر: تأخر 5 دقائق أو أكثر · الوردي: حضور أقل من 70% · ✓ اختيار الأستاذ', width / 2, y + 33, '#44564b', '19px Arial');
    text(session.calculationVersion === 2 ? 'الأوقات: Zoom ناقص ساعتين · المدة الفعلية دون تداخل أثناء حضور Gharbi' : 'الأوقات: تقرير Zoom ناقص ساعتين · النسبة: مجموع دقائق الطالب ÷ مجموع دقائق الأستاذ', width / 2, y + 63, '#44564b', '18px Arial');
    if (session.calculationVersion === 2 && session.participants.some(p => !p.matched)) text('بعض أسماء Zoom غير مرتبطة بقائمة المجموعة؛ راجع المطابقة قبل اعتماد الجدول.', width / 2, y + 90, '#755500', '18px Arial');
    if (rows.some(r => r.p.ratio > 1)) text('قد تتجاوز النسبة 100% عند تداخل اتصالات الاسم نفسه في تقرير Zoom.', width / 2, y + 90, '#755500', '18px Arial');
    return canvas;
  }
  return { render };
})();
