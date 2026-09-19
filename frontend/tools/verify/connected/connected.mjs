// Connected mode (VITE_USE_MOCKS=false): sign-up, onboarding, a route crawl and fifteen flows through the API client.
//
// It runs against stub-api.mjs — a small stand-in written from the backend's REST contract — so the
// frontend's token handling, silent refresh, 204s, uploads and error messages can be tested without
// starting the Java services. To run it against the REAL backend instead, skip step 1 and build with
// VITE_API_BASE_URL=http://localhost:8080/api/v1 (the "silent refresh" numbers at the end then do not apply).
//
//   1. node connected/stub-api.mjs                                  (stub API on :8099)
//   2. VITE_USE_MOCKS=false VITE_API_BASE_URL=http://localhost:8099/api/v1 npm run build   (in the frontend)
//   3. npm run preview                                              (http://localhost:4173)
//   4. node connected/connected.mjs
import { chromium } from 'playwright';
const base = process.env.BASE_URL ?? 'http://localhost:4173',
  api = process.env.API_URL ?? 'http://localhost:8099/api/v1';
const b = await chromium.launch();
const results = [];
const flows = [];
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const page = await ctx.newPage();
const errs = [];
page.on('console', (m) => ['error', 'warning'].includes(m.type()) && errs.push(m.text().slice(0, 200)));
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
const settle = async () => {
  await page.waitForLoadState('networkidle');
  await page
    .waitForFunction(() => ![...document.querySelectorAll('[role=status]')].some((el) => /Loading/.test(el.textContent ?? '')) && !document.querySelector('.animate-spin'), null, { timeout: 8000 })
    .catch(() => {});
  await page.waitForTimeout(200);
};
const flow = async (name, fn) => {
  try {
    await fn();
    flows.push('PASS  ' + name);
  } catch (e) {
    flows.push('FAIL  ' + name + '\n      ' + String(e.message).split('\n')[0]);
  }
};

const email = `jordan.${Date.now()}@example.com`;
let password = 'Gentle123';
await flow('sign up → onboarding → dashboard (tokens stored, family created through the API)', async () => {
  await page.goto(base + '/sign-up', { waitUntil: 'networkidle' });
  await page.fill('input[autocomplete=name]', 'Jordan Rivera');
  await page.fill('input[type=email]', email);
  const pw = page.locator('input[autocomplete=new-password]');
  await pw.nth(0).fill('Gentle123');
  await pw.nth(1).fill('Gentle123');
  await page.check('input[type=checkbox]');
  await page.click('button[type=submit]');
  await page.waitForURL('**/onboarding');
  await page.getByRole('button', { name: 'Begin' }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByLabel('Family name').fill('The Rivera Family');
  await page.getByLabel('Who are you caring for?').fill('Rosa Rivera');
  await page.getByLabel('Their relationship to the family').fill('Grandmother');
  for (let i = 0; i < 4; i++) {
    const c = page.getByRole('button', { name: 'Continue', exact: true });
    if (await c.count()) await c.click();
    await page.waitForTimeout(150);
  }
  await page.getByRole('button', { name: 'Create family & open dashboard' }).click({ timeout: 5000 });
  await page.waitForURL('**/dashboard');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('hearth.auth') ?? 'null'));
  if (!stored?.token || !stored?.refreshToken) throw new Error('tokens were not stored');
  if (await page.evaluate(() => localStorage.getItem('hearth.workspace.v2'))) throw new Error('mock workspace was written in connected mode');
});

/**
 * A direct API call as the signed-in user, for test set-up. Like the app's own client, it renews
 * the token first if the stub has expired it. Returns [status, body].
 */
const apiAs = (path, init = {}) =>
  page.evaluate(
    async ([apiBase, path, init]) => {
      const send = () => fetch(apiBase + path, { ...init, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + JSON.parse(localStorage.getItem('hearth.auth')).token } });
      let response = await send();
      if (response.status === 401) {
        const { refreshToken } = JSON.parse(localStorage.getItem('hearth.auth'));
        const renewed = await (await fetch(apiBase + '/auth/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken }) })).json();
        localStorage.setItem('hearth.auth', JSON.stringify({ token: renewed.token, refreshToken: renewed.refreshToken }));
        response = await send();
      }
      const text = await response.text();
      return [response.status, text ? JSON.parse(text) : null];
    },
    [api, path, init],
  );

const routes = [
  '/dashboard',
  '/tasks',
  '/tasks/new',
  '/schedule',
  '/schedule/availability',
  '/schedule/unavailable',
  '/priority',
  '/what-if',
  '/caregraph',
  '/appointments',
  '/appointments/new',
  '/nutrition',
  '/nutrition/recommendations',
  '/nutrition/groceries',
  '/documents',
  '/family',
  '/notifications',
  '/activity',
  '/settings',
];
for (const r of routes) {
  errs.length = 0;
  await page.goto(base + r, { waitUntil: 'networkidle' });
  await settle();
  const info = await page.evaluate(() => ({ url: location.pathname, h1: document.querySelectorAll('h1').length, text: document.body.innerText.slice(0, 20000) }));
  // A 401 logged by the browser is the stub expiring a token on purpose; the client renews it silently.
  const flags = [...errs.filter((e) => !/status of 401/.test(e)).map((e) => 'console: ' + e)];
  if (info.h1 !== 1) flags.push(`h1 count ${info.h1}`);
  if (/Something went wrong|Unexpected Application Error|couldn’t load|can’t be reached|not available from the API|No stub for/i.test(info.text)) flags.push('error state shown');
  if (info.url !== r) flags.push('redirected to ' + info.url);
  results.push({ r, flags });
}

await flow('reload keeps the session (GET /auth/session)', async () => {
  await page.goto(base + '/tasks', { waitUntil: 'networkidle' });
  await page.reload({ waitUntil: 'networkidle' });
  await settle();
  if (!page.url().endsWith('/tasks')) throw new Error('landed on ' + page.url());
});
await flow('create a task through the API → it is listed → open it → complete it', async () => {
  await page.goto(base + '/tasks/new', { waitUntil: 'networkidle' });
  await settle();
  await page
    .getByLabel(/^(Task|Title|What needs doing)/)
    .first()
    .fill('Evening walk');
  await page
    .getByRole('button', { name: /create|save|add task/i })
    .first()
    .click();
  await page.waitForURL(/\/tasks\/[0-9a-f-]{36}$/, { timeout: 8000 });
  await settle();
  await page.getByText('Evening walk').first().waitFor({ timeout: 5000 });
  const taskUrl = page.url();
  await page.goto(base + '/tasks', { waitUntil: 'networkidle' });
  await settle();
  if (!(await page.getByText('Evening walk').count())) throw new Error('task not listed');
  await page.goto(taskUrl, { waitUntil: 'networkidle' });
  await settle();
  await page
    .getByRole('button', { name: /mark as done|complete/i })
    .first()
    .click();
  await page.getByText('Completed').first().waitFor({ timeout: 5000 });
});
await flow('an unassigned task shows as needing attention on the dashboard (decision API)', async () => {
  await apiAs('/tasks', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Pharmacy pickup',
      notes: '',
      category: 'errands',
      priority: 'important',
      start: new Date(Date.now() + 3 * 3600000).toISOString(),
      durationMin: 30,
      assigneeId: null,
      reminder: false,
    }),
  });
  await page.goto(base + '/dashboard', { waitUntil: 'networkidle' });
  await settle();
  await page.getByText('Pharmacy pickup').first().waitFor({ timeout: 5000 });
  if (!(await page.getByText(/No one is assigned|No owner|Unassigned/).count())) throw new Error('conflict not shown');
  await page.goto(base + '/priority', { waitUntil: 'networkidle' });
  await settle();
  await page.goto(base + '/schedule', { waitUntil: 'networkidle' });
  await settle();
  if (!(await page.getByText('Pharmacy pickup').count())) throw new Error('task missing from the schedule (GET /schedule/events)');
});
await flow('CareGraph is drawn from GET /caregraph: recipient, the task, and its conflict flag', async () => {
  await page.goto(base + '/caregraph', { waitUntil: 'networkidle' });
  await settle();
  await page.getByText('Rosa Rivera').first().waitFor({ timeout: 5000 });
  await page.getByText('Pharmacy pickup').first().waitFor({ timeout: 5000 });
});
await flow('server validation message is shown to the user (problem+json detail)', async () => {
  const [code, body] = await apiAs('/tasks', { method: 'POST', body: JSON.stringify({ title: ' ' }) });
  const status = [code, body?.detail];
  if (status[0] !== 400 || status[1] !== 'Enter a title.') throw new Error(JSON.stringify(status));
});
await flow('profile: save name through PATCH /account → shell updates', async () => {
  await page.goto(base + '/settings', { waitUntil: 'networkidle' });
  await settle();
  await page.getByLabel('Full name').fill('Jordan A. Rivera');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await page.getByText('Profile saved').waitFor({ timeout: 5000 });
});
await flow('document upload as multipart/form-data → listed', async () => {
  await page.goto(base + '/documents', { waitUntil: 'networkidle' });
  await settle();
  await page.getByRole('button', { name: 'Upload document' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('input[type=file]').setInputFiles({ name: 'care-plan.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test') });
  await settle();
  if (await dialog.getByText('Preview limitation').count()) throw new Error('demo-only notice shown in connected mode');
  await page.getByLabel(/^Name/).fill('Care plan (test)');
  await dialog.getByRole('button', { name: 'Upload', exact: true }).click();
  await page.getByText('Care plan (test)').first().waitFor({ timeout: 5000 });
});
const inbox = async (to, purpose) => (await (await fetch(`${api}/__emails?to=${encodeURIComponent(to)}`)).json()).filter((e) => e.purpose === purpose).at(-1);
let verifyLink = '';
await flow('email: unconfirmed notice → open the emailed link → confirmed, notice gone', async () => {
  await page.goto(base + '/dashboard', { waitUntil: 'networkidle' });
  await settle();
  await page.getByText('Confirm your email address').waitFor({ timeout: 5000 });
  await page.getByRole('button', { name: 'Send the link again' }).click();
  await page.getByText('Link sent').waitFor({ timeout: 5000 });
  verifyLink = `${base}/verify-email?token=${(await inbox(email, 'verify')).token}`;
  await page.goto(verifyLink, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Your email is confirmed' }).waitFor({ timeout: 5000 });
  await page.getByRole('link', { name: 'Continue to Hearth' }).click();
  await page.waitForURL('**/dashboard');
  await settle();
  if (await page.getByText('Confirm your email address').count()) throw new Error('notice still shown after confirming');
});
await flow('email: a used link is refused with a clear message', async () => {
  await page.goto(verifyLink, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'We couldn’t confirm your email' }).waitFor({ timeout: 5000 });
  await page.getByText('This link has expired or was already used.').waitFor({ timeout: 3000 });
});
await flow('invitation: invited person signs up → cannot join until the email is confirmed → confirms → joins', async () => {
  const invitee = `imran.${Date.now()}@example.com`;
  // The lead invites Imran.
  await apiAs('/members', { method: 'POST', body: JSON.stringify({ name: 'Imran Hossain', email: invitee, relation: 'Son', role: 'contributor' }) });
  const code = (await apiAs('/family'))[1].inviteCode;
  if ((await inbox(invitee, 'invitation'))?.code !== code) throw new Error('no invitation email queued');
  const c2 = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p2 = await c2.newPage();
  await p2.goto(`${base}/sign-up?invite=${code}`, { waitUntil: 'networkidle' });
  await p2.fill('input[autocomplete=name]', 'Imran Hossain');
  await p2.fill('input[type=email]', invitee);
  const pw = p2.locator('input[autocomplete=new-password]');
  await pw.nth(0).fill('Gentle123');
  await pw.nth(1).fill('Gentle123');
  await p2.check('input[type=checkbox]');
  await p2.click('button[type=submit]');
  await p2.waitForURL(`**/join/${code}`);
  await p2.getByText('Confirm your email address').first().waitFor({ timeout: 5000 });
  await p2.getByRole('button', { name: 'Accept & join' }).click();
  await p2.getByText('Confirm your email address first.').waitFor({ timeout: 5000 });
  await p2.goto(`${base}/verify-email?token=${(await inbox(invitee, 'verify')).token}`, { waitUntil: 'networkidle' });
  await p2.getByRole('heading', { name: 'Your email is confirmed' }).waitFor({ timeout: 5000 });
  await p2.goto(`${base}/join/${code}`, { waitUntil: 'networkidle' });
  await p2.getByRole('button', { name: 'Accept & join' }).click();
  await p2.waitForURL('**/dashboard', { timeout: 8000 });
  await p2.goto(base + '/family', { waitUntil: 'networkidle' });
  await p2.getByText('Jordan A. Rivera').first().waitFor({ timeout: 5000 });
  await c2.close();
});
await flow('sign out → sign in again with the same account → dashboard', async () => {
  await page.goto(base + '/settings', { waitUntil: 'networkidle' });
  await settle();
  await page.getByRole('tab', { name: 'Security' }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL(base + '/');
  if (await page.evaluate(() => localStorage.getItem('hearth.auth'))) throw new Error('tokens not cleared');
  await page.goto(base + '/sign-in', { waitUntil: 'networkidle' });
  if (await page.getByText('sample family').count()) throw new Error('sample-data offer shown in connected mode');
  await page.fill('input[type=email]', email);
  await page.fill('input[type=password]', password);
  await page.click('button[type=submit]');
  await page.waitForURL('**/dashboard', { timeout: 8000 });
});
await flow('forgot password → emailed link → new password → sign in with it', async () => {
  const c3 = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p3 = await c3.newPage();
  await p3.goto(base + '/sign-in', { waitUntil: 'networkidle' });
  await p3.getByRole('button', { name: 'Forgot password?' }).click();
  await p3.getByRole('dialog').locator('input[type=email]').fill(email);
  await p3.getByRole('button', { name: 'Send reset link' }).click();
  await p3.getByText('a reset link is on its way').waitFor({ timeout: 5000 });
  await p3.goto(`${base}/reset-password?token=${(await inbox(email, 'reset')).token}`, { waitUntil: 'networkidle' });
  const fields = p3.locator('input[autocomplete=new-password]');
  await fields.nth(0).fill('Calmer456');
  await fields.nth(1).fill('Calmer456');
  await p3.getByRole('button', { name: 'Save new password' }).click();
  await p3.waitForURL('**/sign-in');
  await p3.fill('input[type=email]', email);
  await p3.fill('input[type=password]', 'Calmer456');
  await p3.click('button[type=submit]');
  await p3.waitForURL('**/dashboard', { timeout: 8000 });
  password = 'Calmer456';
  await c3.close();
});
await flow('wrong password shows the API message', async () => {
  const c2 = await b.newContext();
  const p2 = await c2.newPage();
  await p2.goto(base + '/sign-in', { waitUntil: 'networkidle' });
  await p2.fill('input[type=email]', email);
  await p2.fill('input[type=password]', 'WrongPass99');
  await p2.click('button[type=submit]');
  await p2.getByText('That email and password don’t match an account.').waitFor({ timeout: 5000 });
  await c2.close();
});
await flow('an expired session that cannot be renewed returns to sign-in', async () => {
  await page.evaluate(() => localStorage.setItem('hearth.auth', JSON.stringify({ token: 'expired', refreshToken: 'revoked' })));
  await page.goto(base + '/tasks', { waitUntil: 'networkidle' });
  await page.waitForURL(/\/sign-in/, { timeout: 8000 });
});

const stats = await fetch(api + '/__stats')
  .then((r) => (r.ok ? r.json() : null))
  .catch(() => null);
await b.close();
const bad = results.filter((r) => r.flags.length);
console.log(`connected-mode crawl: ${results.length} routes; ${bad.length} flagged`);
for (const r of bad) console.log(`  ${r.r}\n     ${r.flags.join('\n     ')}`);
console.log(flows.join('\n'));
console.log(`${flows.filter((f) => f.startsWith('PASS')).length}/${flows.length} flows passed`);
if (stats) console.log(`stub API: ${stats.requests} requests, ${stats.unauthorized} answered 401 (expired token), ${stats.refreshes} silent token refreshes`);
process.exit(bad.length || flows.some((f) => f.startsWith('FAIL')) ? 1 : 0);
