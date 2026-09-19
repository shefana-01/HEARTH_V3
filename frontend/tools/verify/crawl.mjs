// Route crawl (sample family): every route × 3 viewports. Reports console errors, page errors,
// horizontal overflow, missing <h1>, error boundaries, and 404s.
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = process.env.BASE_URL ?? 'http://localhost:4173';
const outDir = process.env.OUT_DIR ?? 'screenshots/crawl';
fs.mkdirSync(outDir, { recursive: true });
const VIEWPORTS = { desktop: { width: 1440, height: 900 }, tablet: { width: 834, height: 1112 }, mobile: { width: 390, height: 844 } };
const SHOT = new Set((process.env.SHOT ?? 'desktop,mobile').split(','));

const b = await chromium.launch();
const results = [];

async function check(page, errs, route, vp, label) {
  errs.length = 0;
  await page.goto(base + route, { waitUntil: 'networkidle' });
  // Wait until no loading placeholders remain (mock latency chains can take >1s).
  await page
    .waitForFunction(() => ![...document.querySelectorAll('[role=status]')].some((el) => /Loading/.test(el.textContent ?? '')) && !document.querySelector('.animate-spin'), null, { timeout: 8000 })
    .catch(() => {});
  await page.waitForTimeout(250);
  const info = await page.evaluate(() => {
    const doc = document.documentElement;
    const wide = [...document.querySelectorAll('body *')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.right > doc.clientWidth + 1 && getComputedStyle(el).position !== 'fixed';
      })
      .slice(0, 3)
      .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0, 3).join('.')}`);
    return {
      url: location.pathname + location.search,
      title: document.title,
      h1: document.querySelectorAll('h1').length,
      overflow: doc.scrollWidth > doc.clientWidth + 1,
      wide,
      text: document.body.innerText.slice(0, 20000),
    };
  });
  const flags = [];
  if (errs.length) flags.push(...errs.map((e) => 'console: ' + e));
  if (info.overflow) flags.push('horizontal overflow: ' + info.wide.join(', '));
  if (info.h1 !== 1) flags.push(`h1 count ${info.h1}`);
  if (/Something went wrong|Unexpected Application Error/.test(info.text)) flags.push('error state shown');
  if (/Page not found|couldn’t find that page/i.test(info.text) && !route.startsWith('/this-does-not-exist')) flags.push('404 shown');
  if (SHOT.has(vp)) await page.screenshot({ path: `${outDir}/${vp}-${label}.png`, fullPage: true });
  results.push({ route, vp, landed: info.url, title: info.title, flags });
}

async function newPage(vp) {
  const ctx = await b.newContext({ viewport: VIEWPORTS[vp], reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => ['error', 'warning'].includes(m.type()) && errs.push(m.text().slice(0, 200)));
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  return { ctx, page, errs };
}

const slug = (r) => r.replace(/^\//, '').replace(/[/?=&]+/g, '_') || 'home';

for (const vp of Object.keys(VIEWPORTS)) {
  // Public routes, signed out.
  {
    const { ctx, page, errs } = await newPage(vp);
    for (const r of ['/', '/welcome', '/sign-in', '/sign-up', '/join', '/join/HEARTH-000', '/this-does-not-exist', '/dashboard']) await check(page, errs, r, vp, 'public-' + slug(r));
    await ctx.close();
  }
  // Signed in with sample data.
  {
    const { ctx, page, errs } = await newPage(vp);
    await page.goto(base + '/sign-in', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Explore with sample data' }).click();
    await page.waitForURL('**/dashboard');
    const ws = await page.evaluate(() => JSON.parse(localStorage.getItem('hearth.workspace.v2')));
    const task = ws.tasks.find((t) => t.status === 'scheduled');
    const conflictTask = ws.tasks.find((t) => t.id === 't3') ?? task;
    const member = ws.members.find((m) => m.role !== 'lead');
    const appt = ws.appointments[0];
    const routes = [
      '/dashboard',
      '/tasks',
      '/tasks/new',
      `/tasks/${task.id}`,
      `/tasks/${task.id}/edit`,
      `/tasks/${conflictTask.id}/resolve`,
      '/schedule',
      '/schedule/availability',
      '/schedule/unavailable',
      '/priority',
      '/what-if',
      `/what-if/impact?task=${task.id}&assignee=${member.id}`,
      '/caregraph',
      `/caregraph/${encodeURIComponent('member:' + member.id)}`,
      '/caregraph/nope',
      '/appointments',
      '/appointments/new',
      `/appointments/${appt.id}`,
      `/appointments/${appt.id}/edit`,
      '/nutrition',
      '/nutrition/recommendations',
      '/nutrition/groceries',
      '/documents',
      '/family',
      `/family/${member.id}`,
      '/notifications',
      '/activity',
      '/settings',
      '/settings/profile',
      '/tasks/does-not-exist',
      '/priority/requests/nope',
      '/family/nope',
      '/sign-in',
      '/onboarding',
    ];
    for (const r of routes) await check(page, errs, r, vp, 'app-' + slug(r));
    await ctx.close();
  }
}

await b.close();
fs.writeFileSync(outDir + '/results.json', JSON.stringify(results, null, 2));
const bad = results.filter((r) => r.flags.length);
console.log(`checked ${results.length} route×viewport combos; ${bad.length} flagged`);
for (const r of bad) console.log(`[${r.vp}] ${r.route} → ${r.landed}\n   ${r.flags.join('\n   ')}`);
console.log('\nlandings:');
for (const r of results.filter((x) => x.vp === 'desktop')) console.log(`  ${r.route} → ${r.landed}  «${r.title}»`);
