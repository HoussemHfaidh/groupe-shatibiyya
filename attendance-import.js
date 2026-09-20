/* Read only the cell data from XLSX. No formulas, macros or external links execute. */
window.AttendanceImport = (() => {
  const xml = text => {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.querySelector('parsererror')) throw Error('ملف Excel غير صالح');
    return doc;
  };
  async function xlsx(buffer) {
    const view = new DataView(buffer), bytes = new Uint8Array(buffer), decoder = new TextDecoder();
    let end = bytes.length - 22;
    while (end >= Math.max(0, bytes.length - 65557) && view.getUint32(end, true) !== 0x06054b50) end--;
    if (end < 0 || view.getUint32(end, true) !== 0x06054b50) throw Error('ملف XLSX غير صالح');
    let cursor = view.getUint32(end + 16, true), total = 0;
    const files = new Map();
    for (let i = 0; i < view.getUint16(end + 10, true); i++) {
      if (view.getUint32(cursor, true) !== 0x02014b50) throw Error('ملف XLSX غير صالح');
      const method = view.getUint16(cursor + 10, true), size = view.getUint32(cursor + 20, true), expanded = view.getUint32(cursor + 24, true);
      const length = view.getUint16(cursor + 28, true), offset = view.getUint32(cursor + 42, true);
      const name = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + length));
      total += expanded;
      if (total > 40000000) throw Error('ملف Excel كبير جدا');
      if (name.startsWith('xl/') && name.endsWith('.xml')) {
        const start = offset + 30 + view.getUint16(offset + 26, true) + view.getUint16(offset + 28, true);
        const compressed = bytes.slice(start, start + size);
        files.set(name, async () => {
          if (method === 0) return xml(decoder.decode(compressed));
          if (method !== 8) throw Error('صيغة ضغط غير مدعومة');
          const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
          return xml(await new Response(stream).text());
        });
      }
      cursor += 46 + length + view.getUint16(cursor + 30, true) + view.getUint16(cursor + 32, true);
    }
    const strings = files.has('xl/sharedStrings.xml') ? [...(await files.get('xl/sharedStrings.xml')()).getElementsByTagName('si')].map(n => [...n.getElementsByTagName('t')].map(t => t.textContent).join('')) : [];
    const book = files.has('xl/workbook.xml') ? await files.get('xl/workbook.xml')() : null;
    const date1904 = ['1', 'true'].includes(book?.getElementsByTagName('workbookPr')[0]?.getAttribute('date1904'));
    if (date1904) throw Error('احفظ الملف بنظام تواريخ Excel 1900 أو بصيغة CSV.');
    const sheets = [];
    for (const [name, read] of files) {
      if (!/^xl\/worksheets\/sheet\d+\.xml$/.test(name)) continue;
      const doc = await read(), rows = [];
      for (const r of doc.getElementsByTagName('row')) {
        const row = [];
        for (const c of r.getElementsByTagName('c')) {
          let col = 0;
          for (const letter of (c.getAttribute('r') || '').replace(/[0-9]/g, '')) col = col * 26 + letter.charCodeAt(0) - 64;
          const value = c.getElementsByTagName('v')[0]?.textContent;
          const type = c.getAttribute('t');
          row[col - 1] = type === 's' ? strings[Number(value)] : type === 'inlineStr' ? [...c.getElementsByTagName('t')].map(t => t.textContent).join('') : value === undefined ? '' : !type || type === 'n' ? Number(value) : value;
        }
        rows.push(row);
      }
      sheets.push(rows);
    }
    return sheets;
  }
  async function read(file) {
    if (file.size > 10000000) throw Error('الحد الأقصى للملف 10 MB');
    if (/\.csv$/i.test(file.name)) return AttendanceModel.records(AttendanceModel.parseCSV(await file.text()));
    if (!/\.xlsx$/i.test(file.name)) throw Error('اختر ملف XLSX أو CSV');
    const sheets = await xlsx(await file.arrayBuffer());
    const matches = []; let lastError;
    for (const rows of sheets) { try { matches.push(AttendanceModel.records(rows)); } catch (e) { lastError = e; } }
    if (matches.length > 1) throw Error('الملف يحتوي على عدة تقارير. استورد كل جلسة في ملف مستقل.');
    if (!matches.length) throw lastError || Error('لم يتم العثور على تقرير Zoom');
    return matches[0];
  }
  return { read };
})();
