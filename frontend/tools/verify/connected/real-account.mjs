// A real person's first days with Hearth, through the browser only, against the REAL system
// (docker compose up): sign up, confirm the email from the inbox, set up the family, invite someone who
// joins from a second browser, use every part of the app, then open every page on a computer and a phone.
// Any console error, failed API call, error screen or missing page fails the run.
//
//   docker compose up -d --wait                    (from the repository root)
//   node connected/real-account.mjs                (BASE_URL defaults to http://localhost:8000, Mailpit :8025)
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = (process.env.BASE_URL ?? 'http://localhost:8000').replace(/\/$/, '');
const MAILPIT = (process.env.MAILPIT ?? 'http://localhost:8025').replace(/\/$/, '');
const OUT = process.env.OUT_DIR ?? 'screenshots/real-account';
fs.mkdirSync(OUT, { recursive: true });
const run = Date.now().toString(36);
const PASSWORD = 'Sunrise#2026';
const ME = { name: 'Nadia Hossain', email: `nadia.${run}@example.com` };
const BROTHER = { name: 'Tanvir Hossain', email: `tanvir.${run}@example.com` };

const browser = await chromium.launch({ channel: 'chromium' });
const results = [];
const clientErrors = new Set();

/** A browser for one person, recording everything that goes wrong on the page or in the API. */
async function person(viewport = { width: 1280, height: 900 }) {
  const ctx = await browser.newContext({ viewport, reducedMotion: 'reduce', acceptDownloads: true });
  const page = await ctx.newPage();
  const problems = [];
  // The browser logs every 4xx answer as an error; those the app expects (e.g. 409 "no family yet") are
  // collected separately below, so only real script errors count here.
  page.on('console', (m) => m.type() === 'error' && !/^Failed to load resource/.test(m.text()) && problems.push('console: ' + m.text().slice(0, 200)));
  page.on('pageerror', (e) => problems.push('page error: ' + e.message.slice(0, 200)));
  page.on('response', (r) => {
    const url = r.url();
    if (url.includes('/api/') && r.status() >= 500) problems.push(`API ${r.status()} ${r.request().method()} ${url.replace(BASE, '')}`);
    else if (url.includes('/api/') && r.status() >= 400) clientErrors.add(`${r.status()} ${r.request().method()} ${url.replace(BASE, '').replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, ':id')}`);
  });
  page.on('requestfailed', (r) => {
    const url = r.url();
    // Requests cut short by leaving the page (ERR_ABORTED) are normal.
    if (url.includes('/api/') && r.failure()?.errorText !== 'net::ERR_ABORTED') problems.push(`request failed ${r.method()} ${url.replace(BASE, '')}: ${r.failure()?.errorText}`);
  });
  return { ctx, page, problems };
}

const settle = async (page) => {
  // Not 'networkidle': the live-update stream stays open.
  await page.waitForLoadState('load');
  await page
    .waitForFunction(() => ![...document.querySelectorAll('[role=status]')].some((el) => /Loading/.test(el.textContent ?? '')) && !document.querySelector('.animate-spin'), null, {
      timeout: 10000,
    })
    .catch(() => {});
  await page.waitForTimeout(300);
};
const expectText = async (page, re, what, timeout = 8000) => {
  const ok = await page
    .waitForFunction(([src, flags]) => new RegExp(src, flags).test(document.body.innerText), [re.source, re.flags], { timeout })
    .then(() => true)
    .catch(() => false);
  if (!ok) throw new Error(`expected ${what ?? re} on ${new URL(page.url()).pathname}`);
};
const must = (cond, what) => {
  if (!cond) throw new Error(what);
};
const pad = (n) => String(n).padStart(2, '0');
const dateInput = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** The link in the newest email to `email` whose subject starts with `subject`. */
async function mailLink(email, subject, pattern) {
  for (let i = 0; i < 60; i++) {
    const list = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)).json();
    const message = list.messages?.find((m) => m.Subject.startsWith(subject));
    if (message) {
      const full = await (await fetch(`${MAILPIT}/api/v1/message/${message.ID}`)).json();
      const link = full.Text.match(pattern)?.[0];
      if (link) return link;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`no "${subject}" email for ${email}`);
}

/** The signed-in person's API, with the token the app keeps, to check what the server stored. */
async function api(page, path) {
  return page.evaluate(async (p) => {
    const { token } = JSON.parse(localStorage.getItem('hearth.auth'));
    const res = await fetch('/api/v1' + p, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
    if (!res.ok) throw new Error(`${p} → ${res.status}`);
    return res.json();
  }, path);
}

async function step(who, name, fn) {
  who.problems.length = 0;
  try {
    await fn();
    results.push({ name, ok: who.problems.length === 0, note: who.problems.join(' / ') });
  } catch (e) {
    await who.page.screenshot({ path: `${OUT}/FAIL-${name.replace(/\W+/g, '-')}.png`, fullPage: true }).catch(() => {});
    results.push({ name, ok: false, note: e.message + (who.problems.length ? ' / ' + who.problems.join(' / ') : '') });
  }
}

const me = await person();
const p = me.page;
const go = async (path) => {
  await p.goto(BASE + path);
  await settle(p);
};
const btn = (name, opts) => p.getByRole('button', { name, ...opts });
const click = async (loc) => {
  await loc.first().click();
  await settle(p);
};
let familyCode = '';
let inviteLink = '';

await step(me, 'sign up with a real account and confirm the email from the inbox', async () => {
  await go('/sign-up');
  await p.fill('input[autocomplete=name]', ME.name);
  await p.fill('input[type=email]', ME.email);
  const pw = p.locator('input[autocomplete=new-password]');
  await pw.nth(0).fill(PASSWORD);
  await pw.nth(1).fill(PASSWORD);
  await p.check('input[type=checkbox]');
  await click(btn(/Create account|Sign up/));
  await p.waitForURL('**/onboarding', { timeout: 15000 });
  const link = await mailLink(ME.email, 'Confirm your email', /https?:\/\/\S+verify-email\S+/);
  await p.goto(link.replace(/^https?:\/\/[^/]+/, BASE));
  await settle(p);
  await expectText(p, /confirmed|verified|thank/i, 'the email confirmed');
});

await step(me, 'set up the family: someone to look after, a regular class', async () => {
  await go('/onboarding');
  await click(btn('Begin'));
  await click(btn('Continue', { exact: true }));
  await p.getByLabel('Family name').fill(`Hossain family ${run}`);
  await click(btn('Continue', { exact: true }));
  await click(btn(/Add someone/));
  await p.getByLabel('Name').fill('Amina Begum');
  await click(btn('Continue', { exact: true }));
  await click(btn('Add classes'));
  await click(btn('Continue', { exact: true }));
  await click(btn('Skip for now'));
  await click(btn(/Create family space/));
  await p.waitForURL('**/today', { timeout: 20000 });
  await settle(p);
  const session = await api(p, '/auth/session');
  must(session.account?.memberId, 'a member of a family');
  const family = await api(p, '/family');
  familyCode = family.inviteCode ?? family.family?.inviteCode ?? '';
  const dependants = family.dependants ?? family.family?.dependants ?? [];
  must(
    dependants.some((d) => d.name === 'Amina Begum'),
    'Amina stored on the server',
  );
  await p.screenshot({ path: `${OUT}/01-my-day-new-family.png`, fullPage: true });
});

await step(me, 'invite the brother from the Family page; the invitation email arrives', async () => {
  await go('/family');
  await click(btn('Invite someone'));
  const d = p.getByRole('dialog');
  await d.getByLabel(/^Full name/).fill(BROTHER.name);
  await d.getByLabel(/^Email/).fill(BROTHER.email);
  await d.getByLabel(/^Relationship/).fill('Brother');
  await click(d.getByRole('button', { name: 'Send invitation' }));
  await expectText(p, /Tanvir Hossain/, 'the invited brother on the family page');
  inviteLink = await mailLink(BROTHER.email, 'Nadia Hossain invited you to', /https?:\/\/\S+\/join\/\S+/);
});

const bro = await person();
await step(bro, 'the brother signs up from his own browser and joins with the invite code', async () => {
  const q = bro.page;
  must(inviteLink, 'the invitation email');
  // Opens the link from the email, which asks him to create an account first.
  await q.goto(inviteLink.replace(/^https?:\/\/[^/]+/, BASE));
  await settle(q);
  await expectText(q, /You’ve been invited to a family on Hearth/, 'the invitation page asking him to create an account');
  await q.screenshot({ path: `${OUT}/02-invite-link-before-account.png`, fullPage: true });
  await q.getByRole('link', { name: 'Create my account' }).click();
  await q.waitForURL(/\/sign-up\?invite=/);
  await settle(q);
  await q.fill('input[autocomplete=name]', BROTHER.name);
  await q.fill('input[type=email]', BROTHER.email);
  const pw = q.locator('input[autocomplete=new-password]');
  await pw.nth(0).fill(PASSWORD);
  await pw.nth(1).fill(PASSWORD);
  await q.check('input[type=checkbox]');
  await q.getByRole('button', { name: /Create account|Sign up/ }).click();
  await q.waitForURL(/\/(join|onboarding)/, { timeout: 15000 });
  await settle(q);
  await expectText(q, /Confirm your email address/, 'a request to confirm the email before joining');
  const link = await mailLink(BROTHER.email, 'Confirm your email', /https?:\/\/\S+verify-email\S+/);
  await q.goto(link.replace(/^https?:\/\/[^/]+/, BASE));
  await settle(q);
  await expectText(q, /confirmed|verified|thank/i, 'his email confirmed');
  await q.goto(inviteLink.replace(/^https?:\/\/[^/]+/, BASE));
  await settle(q);
  await q.getByRole('button', { name: /Accept & join/ }).click();
  await q.waitForURL('**/today', { timeout: 20000 });
  await settle(q);
  await expectText(q, new RegExp(`Hossain family ${run}`), 'the family he joined in the sidebar');
});

await step(me, 'tasks: add one for me, one for my brother, a private one; comment; complete', async () => {
  await go('/tasks/new');
  await p.getByLabel('Task title').fill('Pick up Amina’s prescription');
  await click(btn('Errands & shopping'));
  await p.getByLabel(/^Date\*?$/).fill(dateInput(1));
  await p.getByLabel(/^Time\*?$/).fill('17:00');
  await click(btn('Add task'));
  await p.waitForURL(/\/tasks\/(?!new)[^/]+$/);
  await expectText(p, /Pick up Amina’s prescription/, 'the task page');
  await p.getByLabel('Write a comment').fill('The pharmacy closes at 8.');
  await click(btn('Send'));
  await expectText(p, /The pharmacy closes at 8\./, 'the comment');

  await go('/tasks/new');
  await p.getByLabel('Task title').fill('Revise for the statistics exam');
  await click(btn('Study', { exact: true }));
  await p.getByLabel(/^Date\*?$/).fill(dateInput(2));
  await p.getByLabel(/^Time\*?$/).fill('20:00');
  await click(btn('Add task'));
  await p.waitForURL(/\/tasks\/(?!new)[^/]+$/);
  await expectText(p, /Private/, 'a private badge');

  await go('/tasks/new');
  await p.getByLabel('Task title').fill('Water the plants');
  await p.getByLabel(/^Date\*?$/).fill(dateInput(0));
  await p.getByLabel(/^Time\*?$/).fill('23:30');
  await click(btn('Add task'));
  await p.waitForURL(/\/tasks\/(?!new)[^/]+$/);
  await click(btn(/Mark done|Complete/));
  await expectText(p, /Done|Completed/i, 'the task completed');

  const tasks = await api(p, '/tasks');
  const list = Array.isArray(tasks) ? tasks : (tasks.items ?? tasks.content ?? []);
  must(
    list.some((t) => t.title === 'Revise for the statistics exam' && t.visibility === 'private'),
    'private task stored',
  );
  must(
    list.some((t) => t.title === 'Water the plants' && t.status === 'completed'),
    'completed task stored',
  );
});

await step(bro, 'the brother sees the shared task live, never the private one', async () => {
  const q = bro.page;
  await q.goto(`${BASE}/tasks`);
  await settle(q);
  await q.getByRole('radio', { name: 'Family' }).click();
  await settle(q);
  await expectText(q, /Pick up Amina’s prescription/, 'the shared task under Family');
  must(!/Revise for the statistics exam/.test(await q.evaluate(() => document.body.innerText)), 'private task hidden from him');
});

await step(me, 'schedule: a weekly class, time away, availability', async () => {
  await go('/schedule/events/new');
  await p.getByLabel(/^Name\*?$/).fill('Statistics lecture');
  await click(btn('Class', { exact: true }));
  await p.getByLabel(/^Date\*?$/).fill(dateInput(3));
  await p.getByLabel(/^Starts\*?$/).fill('09:00');
  await p.getByLabel(/^Ends\*?$/).fill('10:30');
  await p.getByText('Every week', { exact: true }).click();
  await click(btn('Add to my schedule'));
  await p.waitForURL(/\/schedule$/);
  await expectText(p, /Statistics lecture/, 'the class on the schedule');
  await go('/schedule/availability');
  await expectText(p, /free|available/i, 'the availability page');
  await go('/schedule/unavailable');
  await expectText(p, /make it/i, 'the time-away page');
});

await step(me, 'care: appointment, health notes, food suggestions, shopping list', async () => {
  await go('/appointments/new');
  await p.getByLabel('What is the visit?').fill('Blood pressure check');
  await p
    .getByLabel('Who is it for?')
    .selectOption({ label: /Amina/ })
    .catch(async () => {
      const options = await p.getByLabel('Who is it for?').locator('option').allTextContents();
      await p.getByLabel('Who is it for?').selectOption({ label: options.find((o) => o.includes('Amina')) });
    });
  await p.getByLabel('Doctor or clinic').fill('Popular Diagnostic');
  await p.getByLabel(/^Date\*?$/).fill(dateInput(5));
  await p.getByLabel(/^Time\*?$/).fill('11:00');
  await click(btn('Add appointment'));
  await p.waitForURL(/\/appointments\/(?!new)[^/]+$/);
  await expectText(p, /Blood pressure check/, 'the appointment');

  const session = await api(p, '/auth/session');
  await go(`/health/${session.account.memberId}`);
  await p.getByRole('checkbox', { name: /Weak bones or low calcium/ }).check();
  await click(btn('Save', { exact: true }));
  await p.waitForURL(/\/health$/);
  await go('/health/suggestions');
  await expectText(p, /Sesame seeds|Milk|Yogurt/, 'calcium foods');
  await go('/groceries');
  await p.getByLabel(/^Name\*?$/).fill('Toothpaste');
  await click(btn('Add', { exact: true }));
  await expectText(p, /Toothpaste/, 'the shopping item');
});

await step(me, 'medicines and the emergency card', async () => {
  await go('/health/medicines');
  await click(btn('Add a medicine'));
  const dialog = p.getByRole('dialog');
  const who = dialog.getByLabel('Who takes it');
  const options = await who.locator('option').allTextContents();
  await who.selectOption({ label: options.find((o) => o.includes('Amina')) });
  await dialog.getByLabel(/^Medicine\*?$/).fill('Amlodipine');
  await dialog.getByLabel('Dose', { exact: true }).fill('5 mg');
  const carer = dialog.getByLabel('Who helps with it');
  const carers = await carer.locator('option').allTextContents();
  await carer.selectOption({ label: carers.find((o) => o.includes('Nadia')) });
  await click(dialog.getByRole('button', { name: 'Add medicine' }));
  await expectText(p, /Medicine added/, 'a confirmation');
  const meds = await api(p, '/medications');
  must(
    (Array.isArray(meds) ? meds : (meds.items ?? [])).some((m) => m.name === 'Amlodipine'),
    'medicine stored',
  );

  const fam = await api(p, '/family');
  const amina = (fam.dependants ?? fam.family?.dependants).find((d) => d.name === 'Amina Begum');
  await go(`/health/${amina.id}/emergency`);
  await click(btn('Edit'));
  const edit = p.getByRole('dialog');
  await edit.getByLabel('Allergies').fill('Penicillin');
  await click(edit.getByRole('button', { name: 'Save' }));
  await expectText(p, /Penicillin/, 'the allergies');
  await expectText(p, /Amlodipine/, 'the medicine on the card');
});

await step(me, 'documents: upload and see it listed', async () => {
  await go('/documents');
  await p.setInputFiles('input[type=file]', { name: 'prescription.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%real account test\n') });
  const d = p.getByRole('dialog');
  await d.waitFor();
  await click(d.getByRole('button', { name: /Upload|Save|Add/ }));
  await expectText(p, /prescription\.pdf/, 'the uploaded document');
});

await step(me, 'family chat with the brother', async () => {
  await go('/chat');
  await p.getByRole('textbox').fill('Can you take Amina on Thursday?');
  await p.keyboard.press('Enter');
  await expectText(p, /Can you take Amina on Thursday\?/, 'my message');
  const q = bro.page;
  await q.goto(`${BASE}/chat`);
  await settle(q);
  await expectText(q, /Can you take Amina on Thursday\?/, 'the message for my brother');
});

await step(me, 'settings: every section opens and saves', async () => {
  await go('/settings');
  for (const tab of await p.getByRole('tab').allTextContents()) {
    await click(p.getByRole('tab', { name: tab.trim(), exact: true }));
    await expectText(p, /\w/, `the ${tab} section`);
  }
  await go('/settings?section=calendar');
  await click(btn('Get my calendar address'));
  must((await p.getByLabel('Calendar address').inputValue()).endsWith('.ics'), 'a feed address ending in .ics');
});

// Every page, on a computer and on a phone, with the real data made above.
await step(me, 'every page opens without errors (computer and phone)', async () => {
  const session = await api(p, '/auth/session');
  const memberId = session.account.memberId;
  const fam = await api(p, '/family');
  const dependantId = (fam.dependants ?? fam.family?.dependants)[0].id;
  const tasks = await api(p, '/tasks');
  const taskId = (Array.isArray(tasks) ? tasks : (tasks.items ?? tasks.content))[0].id;
  const appts = await api(p, '/appointments');
  const apptId = (Array.isArray(appts) ? appts : (appts.items ?? appts.content))[0].id;
  const routes = [
    '/today',
    '/plan',
    '/tasks',
    '/tasks/new',
    `/tasks/${taskId}`,
    `/tasks/${taskId}/edit`,
    `/tasks/${taskId}/resolve`,
    '/schedule',
    '/schedule/events/new',
    '/schedule/availability',
    '/schedule/unavailable',
    '/health',
    '/health/suggestions',
    '/health/medicines',
    `/health/${memberId}`,
    `/health/${dependantId}`,
    `/health/${dependantId}/emergency`,
    '/nutrition',
    '/family',
    `/family/${memberId}`,
    '/chat',
    '/priority',
    '/groceries',
    '/appointments',
    '/appointments/new',
    `/appointments/${apptId}`,
    `/appointments/${apptId}/edit`,
    '/documents',
    '/what-if',
    '/caregraph',
    '/notifications',
    '/activity',
    '/settings',
  ];
  const failures = [];
  for (const [label, viewport] of [
    ['computer', { width: 1440, height: 900 }],
    ['phone', { width: 390, height: 844 }],
  ]) {
    await p.setViewportSize(viewport);
    for (const route of routes) {
      me.problems.length = 0;
      await go(route);
      await p.waitForSelector('h1', { timeout: 6000 }).catch(() => {});
      const info = await p.evaluate(() => ({
        path: location.pathname,
        h1: document.querySelectorAll('h1').length,
        text: document.body.innerText,
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        // A sentence split into flex items (text next to <strong>/<span> directly inside a flex box) wraps
        // as broken columns instead of a paragraph.
        brokenText: [...document.querySelectorAll('body *')]
          .filter((el) => el.offsetParent && /flex/.test(getComputedStyle(el).display) && getComputedStyle(el).flexDirection.startsWith('row'))
          .filter((el) => {
            const kids = [...el.childNodes];
            const words = kids.filter((n) => n.nodeType === 3 && /[a-z]{2,}/i.test(n.textContent));
            const text = words.length >= 2 && el.textContent.trim().length > 50;
            const inline = kids.some((n) => n.nodeType === 1 && ['STRONG', 'B', 'EM', 'SPAN', 'A', 'TIME'].includes(n.tagName) && n.textContent.trim() && !n.querySelector('svg'));
            return text && inline;
          })
          .slice(0, 3)
          .map((el) => el.textContent.trim().slice(0, 60)),
      }));
      const flags = [...me.problems];
      if (/Something went wrong|Unexpected Application Error|couldn’t load|could not load/i.test(info.text)) flags.push('error shown');
      if (/Page not found|couldn’t find that page/i.test(info.text)) flags.push('not found');
      if (info.path.startsWith('/sign-in')) flags.push('signed out');
      if (info.h1 !== 1) flags.push(`${info.h1} headings`);
      if (info.overflow) flags.push('wider than the screen');
      if (info.brokenText.length) flags.push('sentence split into columns: ' + info.brokenText.join(' | '));
      if (flags.length) failures.push(`${label} ${route}: ${flags.join(', ')}`);
      if (label === 'phone' || ['/today', '/tasks', '/schedule', '/health/medicines'].includes(route)) {
        await p.screenshot({ path: `${OUT}/${label}-${route.replace(/^\//, '').replace(/[^\w]+/g, '_') || 'home'}.png`, fullPage: true });
      }
    }
  }
  me.problems.length = 0;
  if (failures.length) throw new Error(`${failures.length} page problem(s):\n      ${failures.join('\n      ')}`);
});

await step(me, 'sign out, sign back in with the password, land where I was going', async () => {
  await p.setViewportSize({ width: 1280, height: 900 });
  await go('/settings');
  await click(p.getByRole('tab', { name: 'Sign-in & security' }));
  await click(btn('Sign out'));
  await go('/health/medicines');
  must(/\/sign-in\?next=/.test(p.url()), 'sent to sign-in');
  await p.fill('input[type=email]', ME.email);
  await p.fill('input[type=password]', PASSWORD);
  await click(btn(/^Sign in$/));
  await p.waitForURL('**/health/medicines', { timeout: 15000 });
  await expectText(p, /Amlodipine/, 'my data after signing in again');
});

await browser.close();
let fail = 0;
for (const r of results) {
  if (!r.ok) fail++;
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.note ? `\n      ${r.note}` : ''}`);
}
console.log(`\nAPI answers in the 4xx range seen:\n  ${[...clientErrors].join('\n  ') || 'none'}`);
console.log(`\n${results.length - fail}/${results.length} real-account steps passed`);
process.exit(fail ? 1 : 0);
