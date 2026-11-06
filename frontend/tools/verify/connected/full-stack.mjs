// Browser checks against the REAL system (docker compose up), for what only a running stack can show:
// live updates between two people, the service worker and push settings, the security headers, and the
// new pages working through nginx → gateway → services.
//
//   docker compose up -d --wait        (from the repository root)
//   node connected/full-stack.mjs      (BASE_URL defaults to http://localhost:8000, Mailpit to :8025)
import { chromium } from 'playwright';

const BASE = (process.env.BASE_URL ?? 'http://localhost:8000').replace(/\/$/, '');
const MAILPIT = (process.env.MAILPIT ?? 'http://localhost:8025').replace(/\/$/, '');
const API = `${BASE}/api/v1`;
const run = Date.now().toString(36);
const PASSWORD = 'Sunrise#2026';
const results = [];

async function call(method, path, { token, body, expect = [200, 201, 204] } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Accept: 'application/json', Origin: BASE, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (![].concat(expect).includes(res.status)) throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : undefined;
}

async function confirmEmail(email) {
  for (let i = 0; i < 40; i++) {
    const list = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)).json();
    const message = list.messages?.find((m) => m.Subject.startsWith('Confirm your email'));
    if (message) {
      const full = await (await fetch(`${MAILPIT}/api/v1/message/${message.ID}`)).json();
      const token = full.Text.match(/token=([A-Za-z0-9_-]+)/)[1];
      await call('POST', '/auth/verify-email', { body: { token }, expect: 204 });
      return;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no confirmation email for ${email}`);
}

async function flow(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
  } catch (e) {
    results.push({ name, ok: false, note: e.message.split('\n')[0] });
  }
}

// Two people in one family, made through the API.
const afsaraEmail = `afsara.${run}@example.com`;
const rafidEmail = `rafid.${run}@example.com`;
const afsara = await call('POST', '/auth/sign-up', { body: { name: 'Afsara Mannan', email: afsaraEmail, password: PASSWORD }, expect: 201 });
await confirmEmail(afsaraEmail);
const family = await call('POST', '/family', {
  token: afsara.token,
  expect: 201,
  body: {
    name: `Mannans ${run}`,
    location: 'Dhaka',
    myRelation: 'Daughter',
    dependants: [{ name: 'Rahima Khatun', relation: 'Grandmother', notes: '' }],
    invites: [{ name: 'Rafid Mannan', email: rafidEmail, relation: 'Brother', role: 'contributor' }],
    availability: { days: [true, true, true, true, true, true, true], windows: [] },
    timezone: 'Asia/Dhaka',
  },
});
const rafid = await call('POST', '/auth/sign-up', { body: { name: 'Rafid Mannan', email: rafidEmail, password: PASSWORD }, expect: 201 });
await confirmEmail(rafidEmail);
await call('POST', `/invites/${family.inviteCode}/accept`, { token: rafid.token });
const A = await call('POST', '/auth/sign-in', { body: { email: afsaraEmail, password: PASSWORD } });
const R = await call('POST', '/auth/sign-in', { body: { email: rafidEmail, password: PASSWORD } });
const rafidId = (await call('GET', '/auth/session', { token: R.token })).account.memberId;

const browser = await chromium.launch({ channel: 'chromium' });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addInitScript(([token, refreshToken]) => localStorage.setItem('hearth.auth', JSON.stringify({ token, refreshToken })), [A.token, A.refreshToken]);
const page = await ctx.newPage();
const problems = [];
page.on('console', (m) => m.type() === 'error' && problems.push(m.text().slice(0, 200)));
page.on('pageerror', (e) => problems.push('PAGEERROR ' + e.message));

await flow('pages open through nginx without errors or CSP violations', async () => {
  for (const path of ['/today', '/tasks', '/plan', '/health/medicines', '/settings?section=calendar', '/settings?section=alerts', '/settings?section=ai', '/schedule']) {
    await page.goto(BASE + path);
    // Not 'networkidle': the live-update stream stays open.
    await page.waitForLoadState('load');
    await page.waitForTimeout(1200);
  }
  const csp = problems.filter((p) => /Content Security Policy|Refused to/.test(p));
  if (csp.length) throw new Error(csp.join(' | '));
  const other = problems.filter((p) => !/Failed to load resource/.test(p));
  if (other.length) throw new Error(other.join(' | '));
});

await flow('the service worker controls the page', async () => {
  await page.goto(BASE + '/today');
  const active = await page.evaluate(async () => Boolean((await navigator.serviceWorker.ready).active));
  if (!active) throw new Error('no active service worker');
});

await flow('live update: Rafid adds a task and it appears on Afsara’s open page', async () => {
  await page.goto(BASE + '/tasks');
  await page.waitForLoadState('load');
  await page.waitForTimeout(1500);
  await page.getByRole('radio', { name: 'Family', exact: true }).click();
  await call('POST', '/tasks', {
    token: R.token,
    expect: 201,
    body: {
      title: `Collect the prescription ${run}`,
      notes: '',
      category: 'errands',
      priority: 'important',
      start: new Date(Date.now() + 3 * 3600_000).toISOString(),
      durationMin: 30,
      assigneeId: rafidId,
      visibility: 'family',
      reminder: false,
    },
  });
  await page.getByText(`Collect the prescription ${run}`).waitFor({ timeout: 10_000 });
});

await flow('quick add works in basic mode when the server has no AI key', async () => {
  await page.goto(BASE + '/tasks');
  await page.getByRole('button', { name: 'Quick add' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox').first().fill(`Buy rice tomorrow 6pm ${run}`);
  await dialog.getByRole('button', { name: /Make drafts/ }).click();
  await dialog.getByRole('button', { name: /Save tasks/ }).click();
  await page.getByText('Task added').waitFor({ timeout: 10_000 });
  const tasks = await call('GET', '/tasks', { token: A.token });
  if (!tasks.some((t) => t.title.startsWith('Buy rice'))) throw new Error('task not saved through the API');
});

await flow('medicines and calendar sync through the real services', async () => {
  await page.goto(BASE + '/health/medicines');
  await page.getByRole('button', { name: 'Add a medicine' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(/^Medicine\*?$/).fill('Vitamin D');
  await dialog.getByRole('button', { name: 'Add medicine' }).click();
  await page.getByText('Medicine added').waitFor({ timeout: 10_000 });
  await page.goto(BASE + '/settings?section=calendar');
  await page.getByRole('button', { name: 'Get my calendar address' }).click();
  const url = await page.getByLabel('Calendar address').inputValue();
  const ics = await (await fetch(url)).text();
  if (!ics.startsWith('BEGIN:VCALENDAR') || !ics.includes('Buy rice')) throw new Error('calendar feed missing the task');
});

await browser.close();
let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.note ? `\n      ${r.note}` : ''}`);
}
console.log(`\n${results.length - failed}/${results.length} full-stack checks passed`);
process.exit(failed ? 1 : 0);
