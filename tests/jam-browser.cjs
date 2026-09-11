const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const assert = require('node:assert/strict');
const model = require('../jam-model.js');
(async () => {
  const root = path.resolve(__dirname, '..');
  const server = http.createServer(async (req, res) => {
    try {
      const name = new URL(req.url, 'http://localhost').pathname;
      res.setHeader('Content-Type', name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html');
      res.end(await fs.readFile(path.join(root, name)));
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: "chrome" });
    const browserContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await browserContext.addInitScript(() => { window.SHATIBIYYA_JAM_LOCAL_DEV = false; });
    const page = await browserContext.newPage();
    await page.clock.install({ time: new Date('2026-09-11T10:00:00Z') });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const students = ['أحمد', 'علي', 'عمر'];
    let assignment = model.create(students, 'واجب الجمع الأول', 'البقرة — 1\nالبقرة — 2\nالبقرة — 3', 'one');
    assignment = { ...assignment, ...model.weeklyWindow({number:45,startDate:'2026-09-05',timeZone:'Europe/Paris'},new Date('2026-09-11T10:00:00Z')) };
    let jam = { [assignment.id]: assignment }, revision = 1, writes = 0, conflict = false;
    await page.addInitScript(() => localStorage.setItem('shatibiyya-login-test-session', JSON.stringify({email:'student@example.test',emailOnly:true,expiresAt:Date.now()+1000000})));
    await page.context().route('https://**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      let value;
      const headers = { 'access-control-allow-origin':'*', 'access-control-allow-headers':'*', 'access-control-allow-methods':'GET,PUT,OPTIONS', 'access-control-expose-headers':'ETag', 'ETag':`"${revision}"` };
      if (request.method() === 'OPTIONS') return route.fulfill({status:204,headers});
      if (url.pathname.includes('loginEmails')) value = { role:'student',studentName:'أحمد',groupId:'group1' };
      else if (url.pathname.startsWith('/config/')) value = {students,weeks:[{id:'week1',start:1,end:10,date:'2026-09-11'}],statuses:{'احمد__week1':'done'}};
      else if (url.pathname.startsWith('/submissions/')) value = {};
      else if (url.pathname === '/jam/groups/login-test-group1.json') {
        if (request.method() === 'PUT') {
          if (conflict) return route.fulfill({status:412,headers,body:'{}'});
          assert.equal(request.headers()['if-match'], `"${revision}"`);
          jam = request.postDataJSON(); writes++; revision++;
        }
        value = jam;
      } else throw new Error(`Unexpected request: ${request.url()}`);
      await route.fulfill({status:200,headers,contentType:'application/json',body:JSON.stringify(value)});
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/student-login-dev.html`);
    await page.getByRole('button',{name:'واجب الجمع',exact:true}).click();
    const panel = page.locator('.jam-panel');
    await panel.getByText('أحمد — غير معتمد',{exact:true}).waitFor();
    assert.equal(await panel.locator('.available').count(),3);
    assert.equal(await panel.locator('.unavailable').count(),3);
    assert.equal(await panel.getByRole('button',{name:'تأكيد الطالب والآية'}).isDisabled(),true);
    // Recitation green does not grant permission in Jam.
    const professor = await page.context().newPage();
    await professor.clock.install({time:new Date('2026-09-11T10:00:00Z')});
    professor.on('pageerror',error => errors.push(error.message));
    await professor.goto(`http://127.0.0.1:${server.address().port}/prof-login-dev.html?group=group1&devMode=data`);
    await professor.getByRole('button',{name:'واجب الجمع',exact:true}).click();
    const profPanel = professor.locator('.jam-panel');
    await profPanel.getByLabel('الطالب الذي سمّع عندي').selectOption('أحمد');
    await profPanel.getByLabel('الآية التي سمّعها').selectOption('0');
    await profPanel.getByRole('button',{name:'تأكيد الطالب والآية'}).click();
    await profPanel.locator('.jam-done').waitFor();
    assert.equal(await profPanel.locator('.jam-missed').count(),2);
    await professor.screenshot({path:'/tmp/jam-professor.png',fullPage:true});
    assert.equal(await professor.locator('#groupSelect').isVisible(),true);
    assert.equal(await professor.locator('#trackingTable').isVisible(),false);
    await professor.getByRole('button',{name:'التسميع',exact:true}).click();
    assert.equal(await professor.locator('#trackingTable').isVisible(),true);
    for (const width of [1440, 900, 390]) {
      await professor.setViewportSize({width, height: 1000});
      const layout = await professor.evaluate(() => {
        const box = selector => {
          const r = document.querySelector(selector).getBoundingClientRect();
          return {top: r.top, bottom: r.bottom};
        };
        return {nav: box('.jam-professor-navigation'), table: box('.table-panel'), controls: box('.controls-panel'), overflow: document.documentElement.scrollWidth > innerWidth};
      });
      assert.ok(layout.table.top >= layout.nav.bottom, `Navigation above table at ${width}px`);
      if (width > 1050) assert.equal(layout.table.top, layout.controls.top);
      else assert.ok(layout.controls.top >= layout.table.bottom);
      assert.equal(layout.overflow, false, `No page overflow at ${width}px`);
      await professor.getByRole('button',{name:'واجب الجمع',exact:true}).click();
      assert.equal(await professor.locator('.table-panel').isVisible(),false);
      assert.equal(await profPanel.isVisible(),true);
      await professor.getByRole('button',{name:'التسميع',exact:true}).click();
    }
    await professor.close();
    assignment = jam[assignment.id];
    await panel.getByRole('button',{name:'تحديث القائمة'}).click();
    await panel.getByText('أحمد — معتمد · الأستاذ',{exact:true}).waitFor();
    await panel.getByLabel('الطالب الذي سمّع عندي').selectOption('علي');
    await panel.getByLabel('الآية التي سمّعها').selectOption('1');
    await panel.getByRole('button',{name:'تأكيد الطالب والآية'}).click();
    await panel.getByText('علي — معتمد · أحمد',{exact:true}).waitFor();
    assert.equal(writes,2); assert.equal(jam[assignment.id].confirmations.length,2);
    assert.equal(await panel.getByRole('button',{name:'تأكيد الطالب والآية'}).isEnabled(),true);
    conflict = true;
    await panel.getByRole('button',{name:'تأكيد الطالب والآية'}).click();
    await panel.getByText('تغيرت القائمة عند مستخدم آخر. حدّث القائمة ثم أعد المحاولة.').waitFor();
    assert.equal(writes,2);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),true);
    assert.equal(await panel.getByRole('heading',{name:'واجب الجمع 45',exact:true}).count(),1);
    assert.equal(await panel.locator('select').count(),2); // No assignment/history selector.
    conflict = false;
    await page.clock.setSystemTime(new Date('2026-09-11T22:00:00Z'));
    await panel.getByRole('button',{name:'تحديث القائمة'}).click();
    await panel.getByRole('heading',{name:'واجب الجمع 46',exact:true}).waitFor();
    await panel.getByText('أحمد — غير معتمد',{exact:true}).waitFor();
    await page.waitForFunction(() => document.querySelector('.jam-panel .result-box').textContent === 'تم الحفظ.');
    assert.equal(jam[assignment.id].confirmations.length,2); // Professor history preserved.
    assert.equal(jam['week-2026-09-12'].confirmations.length,0);
    assert.equal(await panel.getByRole('button',{name:'تأكيد الطالب والآية'}).isDisabled(),true);
    await page.screenshot({path:'/tmp/jam-student-mobile.png',fullPage:true});
    await page.getByRole('button',{name:'التسميع',exact:true}).click();
    assert.equal(await page.locator('#submissionForm').isVisible(),true);
    assert.equal(await panel.isVisible(),false);
    await page.getByRole('button',{name:'خروج',exact:true}).click();
    assert.equal(await page.locator('#loginPanel').isVisible(),true);
    assert.deepEqual(errors,[]);
    console.log('✓ Mobile student UI: independent lists, atomic confirmation, conflicts, recitation navigation, logout');
  } finally { await browser?.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
