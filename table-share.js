/* Export the complete professor table, including columns outside the viewport. */
window.TableShare = (() => {
  function lines(ctx, text, width) {
    const output = [];
    for (const paragraph of text.split('\n')) {
      let line = '';
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        const next = line ? `${line} ${word}` : word;
        if (line && ctx.measureText(next).width > width) { output.push(line); line = word; }
        else line = next;
      }
      output.push(line);
    }
    return output;
  }
  function background(cell) {
    for (let node = cell; node && node.tagName !== 'TABLE'; node = node.parentElement) {
      const color = getComputedStyle(node).backgroundColor;
      if (color !== 'transparent' && color !== 'rgba(0, 0, 0, 0)') return color;
    }
    return '#fff';
  }
  function render(table, title) {
    if (!table) throw Error('لا يوجد جدول للمشاركة.');
    const rows = [...table.rows].map(row => [...row.cells].map(cell => ({
      text: (cell.querySelector('.review-cell-button')?.textContent ?? cell.innerText).trim(),
      span: cell.colSpan || 1, color: getComputedStyle(cell).color,
      background: background(cell), bold: cell.tagName === 'TH',
    })));
    const columns = Math.max(...rows.map(row => row.reduce((n, cell) => n + cell.span, 0)));
    if (!columns || !rows.length) throw Error('لا يوجد جدول للمشاركة.');
    const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
    const font = '16px Arial'; ctx.font = font;
    const widths = Array(columns).fill(88);
    for (const row of rows) { let column = 0; for (const cell of row) {
      if (cell.span === 1) widths[column] = Math.min(260, Math.max(widths[column], ctx.measureText(cell.text).width + 28));
      column += cell.span;
    }}
    const width = Math.ceil(widths.reduce((a, b) => a + b, 0));
    const heights = rows.map(row => { let column = 0; let height = 40; for (const cell of row) {
      const cellWidth = widths.slice(column, column + cell.span).reduce((a, b) => a + b, 0);
      cell.lines = lines(ctx, cell.text, cellWidth - 24);
      height = Math.max(height, cell.lines.length * 24 + 16); column += cell.span;
    } return height; });
    canvas.width = width * 2; canvas.height = (64 + heights.reduce((a, b) => a + b, 0)) * 2;
    ctx.scale(2, 2); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width / 2, canvas.height / 2);
    ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#111'; ctx.font = 'bold 20px Arial'; ctx.fillText(title, width / 2, 32, width - 24);
    let y = 64;
    rows.forEach((row, index) => { let column = 0, x = width; const height = heights[index];
      for (const cell of row) {
        const cellWidth = widths.slice(column, column + cell.span).reduce((a, b) => a + b, 0); x -= cellWidth;
        ctx.fillStyle = cell.background; ctx.fillRect(x, y, cellWidth, height);
        ctx.strokeStyle = '#64748b'; ctx.strokeRect(x, y, cellWidth, height);
        ctx.fillStyle = cell.color; ctx.font = `${cell.bold ? 'bold ' : ''}${font}`;
        cell.lines.forEach((line, lineIndex) => ctx.fillText(line, x + cellWidth / 2, y + (height - cell.lines.length * 24) / 2 + 12 + lineIndex * 24, cellWidth - 16));
        column += cell.span;
      } y += height;
    });
    return canvas;
  }
  async function share(table, title) {
    const canvas = render(table, title);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw Error('تعذر إنشاء صورة الجدول.');
    const filename = `shatibiyya-${Date.now()}.png`, file = new File([blob], filename, {type: 'image/png'});
    if (navigator.share && navigator.canShare?.({files: [file]})) {
      await navigator.share({files: [file], title, text: 'الجدول الأسبوعي للمجموعة.'});
      return;
    }
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = filename; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    window.open('https://web.whatsapp.com/', '_blank', 'noopener,noreferrer');
  }
  function button(getTable, title) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'secondary'; button.textContent = 'مشاركة';
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        const group = document.querySelector('#groupSelect')?.selectedOptions[0]?.textContent || '';
        await share(getTable(), `${title} · ${group}`);
      } catch (error) {
        if (error.name !== 'AbortError') window.alert(error.message || 'تعذر مشاركة الجدول.');
      } finally { button.disabled = false; }
    });
    return button;
  }
  return {render, share, button};
})();
