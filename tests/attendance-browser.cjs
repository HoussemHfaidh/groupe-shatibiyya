// Optional argument: a local Zoom XLSX example. No participant data is checked in.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({headless: true, channel: 'chrome'});
  try {
    const page = await browser.newPage({viewport: {width: 1280, height: 900}});
    if (process.env.TEST_ONLINE === '1') {
      await page.route('https://*.firebasedatabase.app/**', route => {
        const req = route.request(), pathname = new URL(req.url()).pathname;
        const headers = {'access-control-allow-origin':'*', 'access-control-allow-headers':'*', 'access-control-expose-headers':'ETag', 'ETag':'"0"'};
        if (req.method() === 'OPTIONS') return route.fulfill({status:204, headers});
        assert.equal(req.method(), 'GET', 'Online checks must never write Firebase');
        const json = pathname.startsWith('/config') ? {students:['طالب تجريبي','طالب ثان'], weeks:[{id:'w1',start:1,end:10,date:'2026-09-19'}],statuses:{},settings:{weekBoundaryDay:6}} : {};
        return route.fulfill({headers,json});
      });
    }
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${process.env.TEST_BASE_URL || 'http://127.0.0.1:4190'}/prof-login-dev.html?devMode=data`);
    await page.getByRole('button', {name:'الحضور', exact:true}).click();
    const upload = page.locator('.attendance-panel input[type=file]');
    const csv = 'Name (original name),Join time,Leave time,Duration (minutes)\nGharbi,09/12/2026 07:46:02,09/12/2026 09:26:02,100\nAli,09/12/2026 07:51:02,09/12/2026 08:51:02,60';
    await upload.setInputFiles({name:'zoom.csv', mimeType:'text/csv', buffer:Buffer.from(csv)});
    await page.getByText('تم حفظ الجلسة:', {exact:false}).waitFor();
    await page.locator('.attendance-editor > summary').click();
    assert.equal(await page.locator('.attendance-table tbody tr th').first().innerText(), 'Gharbi');
    assert.doesNotMatch(await page.locator('.attendance-panel').innerText(), /GMT/);
    assert.match(await page.locator('.attendance-table tbody tr').first().innerText(), /100%/);
    let button = page.getByRole('button', {name:'Ali: خروج باستئذان', exact:true});
    await button.click(); assert.equal(await button.getAttribute('aria-pressed'), 'true');
    await upload.setInputFiles({name:'zoom.csv', mimeType:'text/csv', buffer:Buffer.from(csv)});
    await page.getByText('تم حفظ الجلسة:', {exact:false}).waitFor();
    assert.equal(await button.getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('.attendance-controls select option').count(), 1);
    await upload.setInputFiles({name:'invalid.csv', mimeType:'text/csv', buffer:Buffer.from('name,duration\nAli,60')});
    await page.getByText('يلزم تقرير Zoom المفصل:', {exact:false}).waitFor();
    assert.equal(await button.getAttribute('aria-pressed'), 'true');
    const second = csv.replaceAll('09/12/2026', '09/19/2026');
    await upload.setInputFiles({name:'next-session.csv', mimeType:'text/csv', buffer:Buffer.from(second)});
    await page.getByText('تم حفظ الجلسة:', {exact:false}).waitFor();
    assert.equal(await page.locator('.attendance-controls select option').count(), 2);
    await page.locator('.attendance-controls select').selectOption({index:1});
    assert.equal(await button.getAttribute('aria-pressed'), 'true');
    await page.reload(); await page.getByRole('button', {name:'الحضور', exact:true}).click();
    await page.locator('.attendance-editor > summary').click();
    await page.locator('.attendance-controls select').selectOption({index:1});
    button = page.getByRole('button', {name:'Ali: خروج باستئذان', exact:true});
    assert.equal(await button.getAttribute('aria-pressed'), 'true');
    await button.click(); assert.equal(await button.getAttribute('aria-pressed'), 'false');
    await page.locator('#groupSelect').selectOption('group2');
    await page.getByText('لم تُستورد أي جلسة بعد.', {exact:false}).waitFor();
    await page.locator('#groupSelect').selectOption('group1');
    await button.waitFor();
    if (process.argv[2]) {
      await upload.setInputFiles(path.resolve(process.argv[2]));
      await page.getByText('تم حفظ الجلسة:', {exact:false}).waitFor();
      const result = await page.evaluate(() => JSON.parse(localStorage.getItem('shatibiyya-attendance-v1:login-test-group1')).sessions.find(s => s.filename.endsWith('.xlsx')));
      assert.ok(Math.abs(result.teacher.minutes - (161 + 10/60)) < .0001);
      assert.match(await page.locator('.attendance-summary').innerText(), /05:46:02/);
      assert.equal(await page.getByRole('columnheader', {name:'وقت الدخول', exact:true}).count(), 1);
      assert.ok(result.participants.find(p => p.name === 'Hamza Wertani').minutes <= result.teacher.minutes);
      assert.ok(result.participants.find(p => p.name === 'Houssem').minutes <= result.teacher.minutes);
      assert.equal(result.participants.length, 13);
      assert.equal(await page.locator('.attendance-table tbody tr').count(), 14);
      console.log('XLSX results:', JSON.stringify(result.participants.map(p => ({name:p.name,minutes:p.minutes,late:p.late,low:p.low}))));
    }
    const before = await page.locator('.attendance-preview img').getAttribute('src');
    const flagButton = page.locator('.attendance-toggle').first();
    await flagButton.click();
    assert.notEqual(await page.locator('.attendance-preview img').getAttribute('src'), before);
    const downloadEvent = page.waitForEvent('download');
    await page.getByRole('button', {name:'تصدير الجدول كاملا PNG', exact:true}).click();
    const download = await downloadEvent;
    assert.match(download.suggestedFilename(), /^presence-groupe1-.*\.png$/);
    await download.saveAs('/tmp/attendance-export.png');
    await page.getByRole('button', {name:'تكبير الجدول', exact:true}).click();
    assert.equal(await page.locator('.attendance-dialog').isVisible(), true);
    await page.getByRole('button', {name:'إغلاق', exact:true}).click();
    await page.locator('.attendance-editor > summary').click();
    await page.setViewportSize({width:390,height:844});
    const previewBox = await page.locator('.attendance-preview img').boundingBox();
    assert.ok(previewBox.x >= 0 && previewBox.x + previewBox.width <= 390);
    const size = await page.locator('.attendance-preview img').evaluate(img => ({width:img.naturalWidth,height:img.naturalHeight}));
    assert.ok(size.width > 2000 && size.height > 1000);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({path:'/tmp/attendance-mobile.png',fullPage:true});
    await page.setViewportSize({width:1440,height:1000});
    await page.screenshot({path:'/tmp/attendance-desktop.png',fullPage:true});
    await page.getByRole('button', {name:'التسميع', exact:true}).click();
    assert.equal(await page.locator('.attendance-panel').isVisible(), false);
    for (const [label, selector] of [['واجب الجمع','.jam-panel'],['المراجعة','.review-panel'],['متابعة الختمات الفردية','.khatma-panel']]) {
      await page.getByRole('button', {name:label,exact:true}).click();
      assert.equal(await page.locator(selector).isVisible(), true);
      assert.equal(await page.locator('.attendance-panel').isVisible(), false);
    }
    await page.getByRole('button', {name:'الحضور',exact:true}).click();
    assert.equal(await page.locator('.attendance-preview').isVisible(), true);
    assert.deepEqual(errors, []);
    console.log('Attendance browser checks passed');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
