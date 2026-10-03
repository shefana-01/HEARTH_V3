// New-account crawl: signs up, completes onboarding, then visits every page of a family that has only just started.
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = process.env.BASE_URL ?? 'http://localhost:4173';
const outDir = process.env.OUT_DIR ?? 'screenshots/new-account';
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

for (const vp of ['desktop', 'mobile']) {
  const { ctx, page, errs } = await newPage(vp);
  await page.goto(base + '/sign-up', { waitUntil: 'networkidle' });
  await page.fill('input[autocomplete=name]', 'Jordan Rivera');
  await page.fill('input[type=email]', 'jordan@example.com');
  const pw = page.locator('input[autocomplete=new-password]');
  await pw.nth(0).fill('Gentle123');
  await pw.nth(1).fill('Gentle123');
  await page.check('input[type=checkbox]');
  await page.click('button[type=submit]');
  await page.waitForURL('**/onboarding');
  await page.getByRole('button', { name: 'Begin' }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByLabel('Family name').fill('The Rivera Family');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  // Someone to look after, one regular commitment, nobody invited: the three optional steps.
  await page.getByRole('button', { name: /Add someone/ }).click();
  await page.getByLabel('Name').fill('Rosa Rivera');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Add classes' }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.getByRole('button', { name: 'Create family space & open My day' }).click();
  await page.waitForURL('**/today');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('hearth.workspace.v3')));
  if (saved.family.dependants.length !== 1 || saved.events.length !== 1 || saved.members.length !== 1) {
    throw new Error(`onboarding saved the wrong things: ${saved.family.dependants.length} looked after, ${saved.events.length} events, ${saved.members.length} members`);
  }
  const routes = [
    '/today',
    '/tasks',
    '/tasks/new',
    '/schedule',
    '/schedule/events/new',
    '/schedule/availability',
    '/schedule/unavailable',
    '/health',
    '/health/suggestions',
    '/groceries',
    '/family',
    '/chat',
    '/priority',
    '/what-if',
    '/caregraph',
    '/appointments',
    '/appointments/new',
    '/documents',
    '/notifications',
    '/activity',
    '/settings',
  ];
  for (const r of routes) await check(page, errs, r, vp, 'new-' + slug(r));
  await ctx.close();
}

await b.close();
fs.writeFileSync(outDir + '/results-new.json', JSON.stringify(results, null, 2));
const bad = results.filter((r) => r.flags.length);
console.log(`checked ${results.length} route×viewport combos; ${bad.length} flagged`);
for (const r of bad) console.log(`[${r.vp}] ${r.route} → ${r.landed}\n   ${r.flags.join('\n   ')}`);
console.log('\nlandings:');
for (const r of results.filter((x) => x.vp === 'desktop')) console.log(`  ${r.route} → ${r.landed}  «${r.title}»`);
