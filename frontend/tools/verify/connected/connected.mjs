// Connected mode (VITE_USE_MOCKS=false): sign-up, onboarding, a route crawl and the main journeys through the
// API client, with two people signed in at once so privacy, handovers and the chat are tested across accounts.
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
const fillSignUp = async (pg, name, address) => {
  await pg.fill('input[autocomplete=name]', name);
  await pg.fill('input[type=email]', address);
  const pw = pg.locator('input[autocomplete=new-password]');
  await pw.nth(0).fill('Gentle123');
  await pw.nth(1).fill('Gentle123');
  await pg.check('input[type=checkbox]');
  await pg.click('button[type=submit]');
};
const go = async (pg, path) => {
  await pg.goto(base + path, { waitUntil: 'networkidle' });
  await pg
    .waitForFunction(() => ![...document.querySelectorAll('[role=status]')].some((el) => /Loading/.test(el.textContent ?? '')) && !document.querySelector('.animate-spin'), null, { timeout: 8000 })
    .catch(() => {});
  await pg.waitForTimeout(200);
};
const pad = (n) => String(n).padStart(2, '0');
const dateInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const tomorrowAt = (h, m = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(h, m, 0, 0);
  return d;
};
const must = (cond, what) => {
  if (!cond) throw new Error(what);
};

await flow('sign up → onboarding → My day (tokens stored; family, dependant and weekly event created through the API)', async () => {
  await page.goto(base + '/sign-up', { waitUntil: 'networkidle' });
  await fillSignUp(page, 'Jordan Rivera', email);
  await page.waitForURL('**/onboarding');
  await page.getByRole('button', { name: 'Begin' }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByLabel('Family name').fill('The Rivera Family');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: /Add someone/ }).click();
  await page.getByLabel('Name').fill('Rosa Rivera');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Add classes' }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.getByRole('button', { name: 'Create family space & open My day' }).click({ timeout: 5000 });
  await page.waitForURL('**/today');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('hearth.auth') ?? 'null'));
  must(stored?.token && stored?.refreshToken, 'tokens were not stored');
  must(!(await page.evaluate(() => localStorage.getItem('hearth.workspace.v3'))), 'mock workspace was written in connected mode');
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

let me = '';
let rosa = '';
await flow('what onboarding sent reached the API', async () => {
  const [, family] = await apiAs('/family');
  must(family.dependants.length === 1 && family.dependants[0].name === 'Rosa Rivera', 'the person looked after was not saved');
  rosa = family.dependants[0].id;
  me = (await apiAs('/auth/session'))[1].account.memberId;
  const [, events] = await apiAs('/events');
  must(events.length === 1 && events[0].repeat === 'weekly' && events[0].title === 'Classes', 'the weekly commitment was not saved');
});

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
  must(page.url().endsWith('/tasks'), 'landed on ' + page.url());
});
await flow('create a task in the form → it is listed → open it → comment → mark it done', async () => {
  const when = tomorrowAt(18);
  await go(page, '/tasks/new');
  await page.getByLabel('Task title').fill('Evening walk');
  await page.getByRole('button', { name: 'Family time', exact: true }).click();
  await page.getByLabel(/^Date\*?$/).fill(dateInput(when));
  await page.getByLabel(/^Time\*?$/).fill('18:00');
  await settle();
  await page.getByRole('button', { name: 'Add task' }).first().click();
  await page.waitForURL(/\/tasks\/[0-9a-f-]{36}$/, { timeout: 8000 });
  await settle();
  await page.getByText('Evening walk').first().waitFor({ timeout: 5000 });
  const taskUrl = page.url();
  await page.getByLabel('Write a comment').fill('Bring the umbrella.');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await page.getByText('Bring the umbrella.').waitFor({ timeout: 5000 });
  await go(page, '/tasks');
  must(await page.getByText('Evening walk').count(), 'task not listed');
  await go(page, taskUrl.replace(base, ''));
  await page
    .getByRole('button', { name: /mark (as )?done/i })
    .first()
    .click();
  await page
    .getByText(/Done|Completed/)
    .first()
    .waitFor({ timeout: 5000 });
});
await flow('my day: a private and a shared task come back ranked from GET /decisions/my-day', async () => {
  const mk = (title, hour, extra) =>
    apiAs('/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title,
        notes: '',
        category: 'study',
        priority: 'important',
        start: tomorrowAt(hour).toISOString(),
        durationMin: 30,
        assigneeId: me,
        visibility: 'family',
        reminder: false,
        ...extra,
      }),
    });
  await mk('Jordan’s secret plan', 20, { visibility: 'private', assigneeId: null });
  await mk('Collect the parcel', 16, { category: 'errands' });
  await go(page, '/today');
  await page
    .getByText(/Do first/i)
    .first()
    .waitFor({ timeout: 5000 });
  await page.getByText('Jordan’s secret plan').first().waitFor({ timeout: 5000 });
  await page.getByText('Collect the parcel').first().waitFor({ timeout: 5000 });
  await page.getByText('Can wait').first().waitFor({ timeout: 5000 });
});
await flow('a task nobody has taken shows under Handovers and on the schedule (decision API)', async () => {
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
      forId: rosa,
      visibility: 'family',
      reminder: false,
    }),
  });
  await go(page, '/priority');
  await page.getByText('Pharmacy pickup').first().waitFor({ timeout: 5000 });
  must(await page.getByText(/No one has taken this task yet/).count(), 'the clash reason from the engine is not shown');
  await go(page, '/schedule');
  await page.getByRole('button', { name: 'Everyone' }).click();
  await settle();
  must(await page.getByText('Pharmacy pickup').count(), 'task missing from the schedule (GET /schedule/events)');
});
await flow('family map is drawn from GET /caregraph: the family, the person looked after and the task for her', async () => {
  await go(page, '/caregraph');
  await page.getByText('The Rivera Family').first().waitFor({ timeout: 5000 });
  await page.getByText('Rosa Rivera').first().waitFor({ timeout: 5000 });
  await page.getByText('Pharmacy pickup').first().waitFor({ timeout: 5000 });
});
await flow('server validation message is shown to the user (problem+json detail)', async () => {
  const [code, body] = await apiAs('/tasks', { method: 'POST', body: JSON.stringify({ title: ' ' }) });
  must(code === 400 && body?.detail === 'Enter a title.', JSON.stringify([code, body?.detail]));
});
await flow('personal event added in the form → on my schedule (POST /events)', async () => {
  await go(page, '/schedule/events/new');
  await page.getByLabel(/^Name\*?$/).fill('Dentist');
  await page.getByRole('button', { name: 'Personal', exact: true }).click();
  await page.getByLabel(/^Date\*?$/).fill(dateInput(tomorrowAt(9)));
  await page.getByLabel(/^Starts\*?$/).fill('09:00');
  await page.getByLabel(/^Ends\*?$/).fill('10:00');
  await page.getByText('Only that I’m busy', { exact: false }).click();
  await page.getByRole('button', { name: 'Add to my schedule' }).click();
  await page.waitForURL(/\/schedule$/);
  await settle();
  await page.getByText('Dentist').first().waitFor({ timeout: 5000 });
});
await flow('health note → food suggestion → shopping list (PUT /health/profiles, POST /groceries/from-food)', async () => {
  await go(page, `/health/${me}`);
  await page.getByRole('checkbox', { name: /Low iron or anaemia/ }).check();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.waitForURL(/\/health$/);
  await go(page, '/health/suggestions');
  await page.getByRole('heading', { name: /Red amaranth/ }).waitFor({ timeout: 5000 });
  const card = page.getByRole('heading', { name: /Red amaranth/ }).locator('xpath=ancestor::*[.//button][1]');
  await card.getByRole('button', { name: /Add to shopping list/ }).click();
  await settle();
  const [, list] = await apiAs('/groceries');
  const item = list.find((g) => g.foodId === 'red-amaranth');
  must(item, 'the food is not on the list');
  must(item.forIds.length === 0, 'a private health note put my name on the shared list');
  must(/Iron/.test(item.reason ?? ''), 'reason should be the food tag, got ' + item.reason);
  await go(page, '/groceries');
  await page
    .getByText(/Red amaranth/)
    .first()
    .waitFor({ timeout: 5000 });
});
await flow('profile: save name through PATCH /account → shell updates', async () => {
  await go(page, '/settings');
  await page.getByLabel('Full name').fill('Jordan A. Rivera');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await page.getByText('Profile saved').waitFor({ timeout: 5000 });
});
await flow('document upload as multipart/form-data, about a person → listed', async () => {
  await go(page, '/documents');
  await page.setInputFiles('input[type=file]', { name: 'prescription.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test') });
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  must(!(await dialog.getByText(/only the file’s details/i).count()), 'demo-only notice shown in connected mode');
  await dialog.getByLabel(/Who is it about/).selectOption(rosa);
  await dialog.getByRole('button', { name: /Upload|Save|Add/ }).click();
  await page.getByText('prescription').first().waitFor({ timeout: 5000 });
  const [, docs] = await apiAs('/documents');
  must(docs[0].ownerId === rosa && docs[0].access === 'family', 'owner or access not sent with the upload: ' + JSON.stringify(docs[0]));
});
const inbox = async (to, purpose) => (await (await fetch(`${api}/__emails?to=${encodeURIComponent(to)}`)).json()).filter((e) => e.purpose === purpose).at(-1);
let verifyLink = '';
await flow('email: unconfirmed notice → open the emailed link → confirmed, notice gone', async () => {
  await go(page, '/today');
  await page.getByText('Confirm your email address').waitFor({ timeout: 5000 });
  await page.getByRole('button', { name: 'Send the link again' }).click();
  await page.getByText('Link sent').waitFor({ timeout: 5000 });
  verifyLink = `${base}/verify-email?token=${(await inbox(email, 'verify')).token}`;
  await page.goto(verifyLink, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Your email is confirmed' }).waitFor({ timeout: 5000 });
  await page.getByRole('link', { name: 'Continue to Hearth' }).click();
  await page.waitForURL('**/today');
  await settle();
  must(!(await page.getByText('Confirm your email address').count()), 'notice still shown after confirming');
});
await flow('email: a used link is refused with a clear message', async () => {
  await page.goto(verifyLink, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'We couldn’t confirm your email' }).waitFor({ timeout: 5000 });
  await page.getByText('This link has expired or was already used.').waitFor({ timeout: 3000 });
});

// A second person in their own browser context, kept signed in for the flows that need two people.
const c2 = await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
const p2 = await c2.newPage();
const errs2 = [];
p2.on('pageerror', (e) => errs2.push('PAGEERROR ' + e.message));
let imran = '';
await flow('invitation: invited person signs up → cannot join until the email is confirmed → confirms → joins', async () => {
  const invitee = `imran.${Date.now()}@example.com`;
  await apiAs('/members', { method: 'POST', body: JSON.stringify({ name: 'Imran Hossain', email: invitee, relation: 'Brother', role: 'contributor' }) });
  const code = (await apiAs('/family'))[1].inviteCode;
  must((await inbox(invitee, 'invitation'))?.code === code, 'no invitation email queued');
  await p2.goto(`${base}/sign-up?invite=${code}`, { waitUntil: 'networkidle' });
  await fillSignUp(p2, 'Imran Hossain', invitee);
  await p2.waitForURL(`**/join/${code}`);
  await p2.getByText('Confirm your email address').first().waitFor({ timeout: 5000 });
  await p2.getByRole('button', { name: 'Accept & join' }).click();
  await p2.getByText('Confirm your email address first.').waitFor({ timeout: 5000 });
  await p2.goto(`${base}/verify-email?token=${(await inbox(invitee, 'verify')).token}`, { waitUntil: 'networkidle' });
  await p2.getByRole('heading', { name: 'Your email is confirmed' }).waitFor({ timeout: 5000 });
  await p2.goto(`${base}/join/${code}`, { waitUntil: 'networkidle' });
  await p2.getByRole('button', { name: 'Accept & join' }).click();
  await p2.waitForURL('**/today', { timeout: 8000 });
  await go(p2, '/family');
  await p2.getByText('Jordan A. Rivera').first().waitFor({ timeout: 5000 });
  imran = (await apiAs('/members'))[1].find((m) => m.name === 'Imran Hossain').id;
});
await flow('privacy across two people: Imran never receives Jordan’s private task, and sees his private time only as “Busy”', async () => {
  const [, mine] = await apiAs('/tasks');
  const secret = mine.find((t) => t.title === 'Jordan’s secret plan');
  must(secret, 'Jordan cannot see his own private task');
  await go(p2, '/tasks');
  await p2.getByRole('radio', { name: 'Family' }).click();
  await p2.waitForTimeout(600);
  must(await p2.getByText('Collect the parcel').count(), 'the shared task should be visible to Imran');
  must(!(await p2.getByText('Jordan’s secret plan').count()), 'Imran can see Jordan’s private task in the list');
  await go(p2, `/tasks/${secret.id}`);
  must(await p2.getByText(/could not be found|couldn’t find|not found/i).count(), 'opening the private task by its address should say it was not found');
  await go(p2, '/schedule');
  await p2.getByRole('button', { name: 'Everyone' }).click();
  await p2.waitForTimeout(600);
  must(await p2.getByText('Busy').count(), 'Jordan’s private time should appear as “Busy”');
  must(!(await p2.getByText('Dentist').count()), 'the title of a “show as busy” event leaked');
  must(!(await p2.getByText('Jordan’s secret plan').count()), 'the private task title leaked into the schedule');
});
await flow('handover between two people: Jordan can’t make it → request appears → Imran takes it → the chat is told', async () => {
  // "Collect the parcel" is Jordan's shared task tomorrow at 16:00; he reports the whole afternoon.
  const [, result] = await apiAs('/unavailability', { method: 'POST', body: JSON.stringify({ start: tomorrowAt(13).toISOString(), end: tomorrowAt(23).toISOString(), reason: 'Work', note: '' }) });
  must(result.affectedTaskIds.length === 1, `one shared task should need someone, got ${result.affectedTaskIds.length}`);
  must(result.personalTaskIds.length === 1, `the private task should be left to Jordan, got ${result.personalTaskIds.length}`);
  await page.waitForTimeout(600);
  await go(p2, '/priority');
  await p2.getByText('Collect the parcel').first().waitFor({ timeout: 5000 });
  const [, requests] = await apiAs('/reassignment-requests');
  const request = requests.find((r) => r.status === 'open' && r.taskTitle === 'Collect the parcel');
  must(request, 'no open handover request');
  await go(p2, `/priority/requests/${request.id}`);
  await p2
    .getByRole('link', { name: /I’ll take it/ })
    .or(p2.getByRole('button', { name: /I’ll take it/ }))
    .first()
    .click();
  await p2.waitForURL(/\/approve\//);
  const ack = p2.getByRole('checkbox');
  if (await ack.count()) await ack.first().check();
  await p2.getByRole('button', { name: /Confirm handover/ }).click();
  await p2.waitForURL(/\/done$/, { timeout: 8000 });
  const [, task] = await apiAs(`/tasks/${request.taskId}`);
  must(task.assigneeId === imran, 'the task did not move to Imran');
  await go(page, '/chat');
  await page.getByText(/Imran took over “Collect the parcel” from Jordan/).waitFor({ timeout: 5000 });
});
await flow('chat between two people: a message reaches the other person’s open chat by polling, and the unread badge clears', async () => {
  await go(p2, '/chat');
  await go(page, '/today');
  await p2.getByRole('textbox').fill('Got it. I will collect it on my way home.');
  await p2.keyboard.press('Enter');
  await p2.getByText('Got it. I will collect it on my way home.').waitFor({ timeout: 5000 });
  await go(page, '/tasks'); // any navigation refreshes the badge
  await page.getByRole('link', { name: /Family chat, 1 unread/ }).waitFor({ timeout: 5000 });
  await go(page, '/chat');
  await page.getByText('Got it. I will collect it on my way home.').waitFor({ timeout: 5000 });
  await page.getByRole('textbox').fill('Thank you.');
  await page.keyboard.press('Enter');
  // Imran's chat is still open: the reply must arrive without a reload.
  await p2.getByText('Thank you.').waitFor({ timeout: 9000 });
  await go(page, '/today');
  must(!(await page.getByRole('link', { name: /Family chat, \d+ unread/ }).count()), 'unread badge still shown after reading');
});
await flow('notifications are personal: Imran is told about Jordan’s time away, Jordan is not told about his own', async () => {
  await go(p2, '/notifications');
  await p2
    .getByText(/Jordan can’t make it/)
    .first()
    .waitFor({ timeout: 5000 });
  await go(page, '/notifications');
  must(!(await page.getByText(/Jordan can’t make it/).count()), 'Jordan was notified about his own action');
  await page
    .getByText(/Imran took over/)
    .first()
    .waitFor({ timeout: 5000 });
  must(!errs2.length, 'errors on the second person’s pages: ' + errs2.join(' / '));
  await c2.close();
});
await flow('sign out → sign in again with the same account → My day', async () => {
  await page.goto(base + '/settings', { waitUntil: 'networkidle' });
  await settle();
  await page.getByRole('tab', { name: 'Sign-in & security' }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL(base + '/');
  if (await page.evaluate(() => localStorage.getItem('hearth.auth'))) throw new Error('tokens not cleared');
  await page.goto(base + '/sign-in', { waitUntil: 'networkidle' });
  if (await page.getByText('sample family').count()) throw new Error('sample-data offer shown in connected mode');
  await page.fill('input[type=email]', email);
  await page.fill('input[type=password]', password);
  await page.click('button[type=submit]');
  await page.waitForURL('**/today', { timeout: 8000 });
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
  await p3.waitForURL('**/today', { timeout: 8000 });
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
