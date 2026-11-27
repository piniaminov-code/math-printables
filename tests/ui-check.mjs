// UI regression check at a small phone size (default 375x667) in headless Chromium.
// Self-contained: serves this repo on a free port and uses the pre-installed Playwright
// (no npm install). Usage:  node tests/ui-check.mjs [--width 375 --height 667] [--shots dir]
// Fails (exit 1) on: horizontal page overflow, elements running off the screen, clipped
// text in buttons/labels, unnamed controls, tap targets under 24px, console/page errors,
// and flows that cannot be completed (practice rounds, games, sheets, printables).
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(require.resolve('playwright', { paths: ['/usr/lib/node_modules', '/usr/local/lib/node_modules', '/opt/node22/lib/node_modules'] }))); }

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
const W = +(args.width || 375), H = +(args.height || 667);
const SHOTS = args.shots || null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.css': 'text/css' };
const server = http.createServer(async (req, res) => {
  const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  const f = p === '/' || p === '\\' ? 'index.html' : p;
  try { const body = await readFile(join(root, f)); res.writeHead(200, { 'content-type': types[extname(f)] || 'application/octet-stream' }); res.end(body); }
  catch { res.writeHead(404); res.end('not found'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/`;

const problems = [];
const bad = (where, msg) => problems.push(`${where}: ${msg}`);
let checked = 0;

// in-page audit of the current screen
async function audit(page, where) {
  checked++;
  const r = await page.evaluate(({ W }) => {
    const off = [], ctl = [], out = [];
    const vis = (e) => { const s = getComputedStyle(e); const b = e.getBoundingClientRect(); return s.visibility !== 'hidden' && s.display !== 'none' && b.width > 0 && b.height > 0 && !e.closest('[aria-hidden="true"]') && !e.closest('.answers-collapsed'); };
    const inScroller = (e) => { for (let p = e.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if ((o === 'auto' || o === 'scroll') && p !== document.documentElement && p !== document.body) return true; } return false; };
    const label = (e) => (e.getAttribute('aria-label') || e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    if (document.documentElement.scrollWidth > W + 1) out.push(`page scrolls sideways (${document.documentElement.scrollWidth}px)`);
    for (const e of document.querySelectorAll('body *')) {
      if (!vis(e) || inScroller(e)) continue;
      const b = e.getBoundingClientRect();
      if (b.right > W + 1.5 || b.left < -1.5) { off.push(`off-screen ${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]} "${label(e)}" [${Math.round(b.left)}..${Math.round(b.right)}]`); }
    }
    for (const e of document.querySelectorAll('button, a[href], [role=button], [role=slider], select, input')) {
      if (!vis(e)) continue;
      const b = e.getBoundingClientRect();
      const name = (e.getAttribute('aria-label') || e.textContent || e.getAttribute('title') || '').trim();
      if (!name) ctl.push(`control without a name: ${e.outerHTML.slice(0, 80)}`);
      if (b.height < 24 || b.width < 24) ctl.push(`tap target ${Math.round(b.width)}x${Math.round(b.height)}: "${label(e)}"`);
      if (e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflow !== 'visible') ctl.push(`text clipped in control: "${label(e)}"`);
    }
    // separate caps, so one overflowing block cannot hide control problems
    return [...out, ...[...new Set(off)].slice(0, 6), ...[...new Set(ctl)].slice(0, 12)];
  }, { W });
  for (const m of r) bad(where, m);
  if (SHOTS) await page.screenshot({ path: join(SHOTS, `${where.replace(/[^\w-]+/g, '_').slice(0, 80)}.png`) });
}

const browser = await chromium.launch();
async function newPage(gender = 'f', extra = {}) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, serviceWorkers: 'block', ...extra });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => bad('page', `pageerror ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') bad('page', `console ${m.text().slice(0, 120)}`); });
  await page.goto(BASE);
  if (gender) await page.evaluate((g) => localStorage.setItem('math-printables:gender', g), gender);
  await page.reload();
  return page;
}
const go = async (page, route) => { await page.goto(BASE + '#' + route); await page.waitForTimeout(250); };

// 0. self-test: the detectors must catch planted defects, or the whole check is meaningless
{
  const page = await newPage('f');
  await go(page, '/');
  await page.evaluate(() => {
    const m = document.querySelector('main');
    m.insertAdjacentHTML('beforeend', '<div id="qa-wide" style="width:900px;height:10px;background:red"></div><button id="qa-tiny" style="width:10px;height:10px;padding:0">x</button><button id="qa-noname" style="width:50px;height:50px"></button><button id="qa-clip" style="width:60px;height:44px;overflow:hidden;white-space:nowrap">טקסט ארוך מאוד שנחתך בכפתור</button>');
  });
  const before = problems.length;
  await audit(page, 'selftest');
  const got = problems.splice(before).join(' | ');
  if (process.env.QA_DEBUG) console.log('SELFTEST GOT:', got);
  checked--;
  for (const [what, re] of [['sideways scroll', /scrolls sideways|off-screen div/], ['tiny tap target', /tap target 10x10/], ['unnamed control', /control without a name/], ['clipped text', /text clipped/]])
    if (!re.test(got)) bad('selftest', `detector for ${what} did not fire`);
  await page.context().close();
}

// 1. gender gate (fresh visitor)
{
  const page = await newPage(null);
  for (const r of ['/practice', '/games', '/printables', '/library/frac-equiv?l=2&s=1']) { await go(page, r); await audit(page, `gate ${r}`); if (!(await page.getByRole('button', { name: 'נקבה' }).count())) bad(`gate ${r}`, 'no wording choice shown'); }
  await page.getByRole('button', { name: 'זכר' }).first().click();
  await page.reload(); await go(page, '/practice');
  if (await page.getByText('באיזו לשון').count()) bad('gate', 'wording choice not remembered');
  await page.context().close();
}

// 1b. games are playable from the keyboard alone
{
  const page = await newPage('f');
  for (let round = 0; round < 6; round++) {
    await go(page, '/games/rectangle'); await page.reload(); await page.waitForTimeout(200);
    const prompt = (await page.locator('main p').first().innerText()).replace(/\s+/g, ' ');
    const nums = (prompt.match(/\d+/g) || []).map(Number);
    let w = 0, hgt = 0;
    const fits = (a, b) => a >= 1 && b >= 1 && a <= 10 && b <= 8;
    if (/שטח של/.test(prompt)) { for (let a = 1; a <= 10 && !w; a++) if (nums[0] % a === 0 && fits(a, nums[0] / a)) (w = a), (hgt = nums[0] / a); }
    else if (/היקף של/.test(prompt)) { for (let a = 1; a <= 10 && !w; a++) if (fits(a, nums[0] / 2 - a)) (w = a), (hgt = nums[0] / 2 - a); }
    else if (/שהיקפו/.test(prompt)) { const [P, L] = nums; if (fits(L, P / 2 - L)) (w = L), (hgt = P / 2 - L); else if (fits(P / 2 - L, L)) (w = P / 2 - L), (hgt = L); }
    else { const [lg, sh, k] = nums; if (fits(lg * k, sh)) (w = lg * k), (hgt = sh); else if (fits(sh, lg * k)) (w = sh), (hgt = lg * k); }
    if (!w) { bad('keyboard rectangle', `could not plan a rectangle for: ${prompt}`); continue; }
    const board = page.locator('[aria-label^="לוח משבצות"]');
    if ((await board.getAttribute('tabindex')) !== '0') { bad('keyboard rectangle', 'board is not focusable'); break; }
    await board.focus();
    await page.keyboard.press('ArrowRight'); // first key: a 1x1 rectangle in the corner
    for (let k = 1; k < w; k++) await page.keyboard.press('ArrowRight');
    for (let k = 1; k < hgt; k++) await page.keyboard.press('ArrowDown');
    const said = await page.locator('main p[aria-live]').innerText();
    // the board is left-to-right (math), so the live line reads "<width> על <height>"
    if (!said.includes(`${w}`) || !said.includes(`${hgt}`)) bad('keyboard rectangle', `live line says "${said}", expected ${w} x ${hgt}`);
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement?.textContent?.trim());
    if (focused !== 'בדיקה') { bad('keyboard rectangle', `Tab after the board reaches "${focused}", not the check button`); continue; }
    await page.keyboard.press('Enter'); await page.waitForTimeout(150);
    if (!(await page.getByText('בדיוק!').count())) bad('keyboard rectangle', `${w}x${hgt} for "${prompt}" was not accepted`);
  }
  await go(page, '/games/pizza');
  const box = page.locator('[aria-label^="קופסת משולשים"]');
  await box.focus(); await page.waitForTimeout(100);
  const y0 = await page.evaluate(() => scrollY);
  const before = await page.locator('main [aria-live]').first().innerText();
  await page.keyboard.press(' '); await page.waitForTimeout(100);
  const after = await page.locator('main [aria-live]').first().innerText();
  if (before === after) bad('keyboard pizza', 'Space did not add a triangle');
  if ((await page.evaluate(() => scrollY)) !== y0) bad('keyboard pizza', 'Space scrolled the page');
  await page.context().close();
}

// 1c. large text (phone text-size setting): nothing may run off the screen at 200%
{
  const page = await newPage('f');
  for (const r of ['/', '/practice', '/practice/addSub?seed=11', '/practice/convert?seed=11', '/practice/compare?seed=11', '/games/compare', '/games/rectangle', '/games/pizza', '/printables', '/library', '/library/dec-addsub?l=2&s=3', '/library/frac-mul?l=3&s=3']) {
    await go(page, r);
    await page.addStyleTag({ content: 'html{font-size:200%!important}' });
    await page.waitForTimeout(150);
    await audit(page, `text200 ${r}`);
  }
  await page.context().close();
}

for (const gender of ['f', 'm']) {
  const page = await newPage(gender);
  for (const r of ['/', '/practice', '/games', '/printables', '/library']) { await go(page, r); await audit(page, `${gender} ${r}`); }

  // 2. practice: every topic, every question, feedback screen + summary
  for (const t of ['convert', 'compare', 'ofQuantity', 'addSub', 'rectangle', 'lines']) {
    await go(page, `/practice/${t}?seed=11`);
    for (let i = 0; i < 8; i++) {
      await audit(page, `${gender} practice ${t} q${i + 1}`);
      const slider = page.locator('[role=slider]');
      const order = page.locator('main [aria-label^="ערך"]');
      const opts = page.locator('main button[aria-pressed]');
      if (await slider.count()) { await slider.focus(); await page.keyboard.press('ArrowRight'); }
      else if (await order.count()) { while (await order.count()) await order.first().click(); }
      else if (await opts.count()) await opts.first().click();
      else {
        // fill every answer box: a digit in each, '/' moves on to the next box
        for (let k = 0; k < 4; k++) { await page.keyboard.press('1'); await page.keyboard.press('/'); }
        const boxes = page.locator('main button[aria-label="שלמים"], main button[aria-label="מונה"], main button[aria-label="מכנה"], main button[aria-label="תשובה"], main button[aria-label*="השלם"]');
        for (let k = 0; k < (await boxes.count()); k++) { await boxes.nth(k).click(); if (!((await boxes.nth(k).innerText()).trim().match(/\d/))) await page.keyboard.press('2'); }
      }
      const check = page.getByRole('button', { name: 'בדיקה' });
      if (!(await check.count()) || !(await check.isEnabled())) { bad(`${gender} practice ${t} q${i + 1}`, 'could not answer (check button disabled)'); break; }
      await check.click(); await page.waitForTimeout(120);
      await audit(page, `${gender} practice ${t} q${i + 1} feedback`);
      const next = page.getByRole('button', { name: /לשאלה הבאה|לסיכום/ });
      if (!(await next.count())) { bad(`${gender} practice ${t} q${i + 1}`, 'no next button'); break; }
      await next.click(); await page.waitForTimeout(120);
    }
    if (!(await page.getByText('סיימת את הסבב').count())) bad(`${gender} practice ${t}`, 'did not reach the summary');
    else await audit(page, `${gender} practice ${t} summary`);
  }

  // 3. games: open, interact a little, audit
  for (const g of ['pizza', 'compare', 'rectangle']) {
    await go(page, `/games/${g}`); await audit(page, `${gender} game ${g}`);
    const btns = page.locator('main button:enabled');
    for (let k = 0; k < 4 && (await btns.count()); k++) { await btns.nth(k % (await btns.count())).click().catch(() => {}); await page.waitForTimeout(80); }
    await audit(page, `${gender} game ${g} after taps`);
  }

  // 4. printables: modes and topic sheets, answer key open
  await go(page, '/printables');
  for (const mode of ['מבחן רגיל', 'מבחן פתוח']) {
    await page.getByRole('button', { name: mode }).click();
    for (const topic of ['כל הנושאים (מבחן)', 'השוואת שברים', 'סוגי ישרים']) {
      await page.getByRole('group', { name: 'נושא' }).getByRole('button', { name: topic }).click(); await page.waitForTimeout(150);
      await audit(page, `${gender} printables ${mode} ${topic}`);
    }
  }
  await page.getByRole('button', { name: /הצגת דף תשובות/ }).click(); await audit(page, `${gender} printables answer key`);

  // 5. library: every sheet at every level, with the answer key open
  await go(page, '/library');
  const links = await page.evaluate(() => [...document.querySelectorAll('.lib-card a')].map((a) => a.getAttribute('href').replace(/^#/, '')));
  if (links.length < 60) bad('library', `only ${links.length} sheet links`);
  for (const href of gender === 'f' ? links : links.filter((l) => l.endsWith('l=3'))) {
    await go(page, href + '&s=4242');
    if (!(await page.locator('.exam-paper:not(.exam-answers) .exam-q').count())) { bad(href, 'sheet has no questions'); continue; }
    await page.getByRole('button', { name: /הצגת דף תשובות/ }).click();
    await audit(page, `${gender} ${href}`);
  }
  await page.context().close();
}

await browser.close();
server.close();
console.log(`ui-check ${W}x${H}: ${checked} screens audited, ${problems.length} problem(s)`);
for (const p of [...new Set(problems)]) console.log('  - ' + p);
process.exit(problems.length ? 1 : 0);
