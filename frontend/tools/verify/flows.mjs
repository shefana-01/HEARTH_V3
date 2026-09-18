// End-to-end flows on the sample family. Each flow logs PASS/FAIL; failures dump the
// visible buttons/links so selectors can be corrected.
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = process.env.BASE_URL ?? 'http://localhost:4173';
const outDir = process.env.OUT_DIR ?? 'screenshots/flows';
fs.mkdirSync(outDir, { recursive: true });
const only = process.env.ONLY?.split(',');

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce', acceptDownloads: true });
const p = await ctx.newPage();
const errs = [];
p.on('console', (m) => ['error', 'warning'].includes(m.type()) && errs.push(m.text().slice(0, 200)));
p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));

const settle = async () => {
  await p.waitForLoadState('networkidle');
  await p
    .waitForFunction(() => ![...document.querySelectorAll('[role=status]')].some((el) => /Loading/.test(el.textContent ?? '')) && !document.querySelector('button .animate-spin'), null, {
      timeout: 8000,
    })
    .catch(() => {});
  await p.waitForTimeout(200);
};
const go = async (path) => {
  await p.goto(base + path);
  await settle();
};
const shot = (n) => p.screenshot({ path: `${outDir}/${n}.png`, fullPage: true });
const btn = (name, opts = {}) => p.getByRole('button', { name, ...opts });
const link = (name, opts = {}) => p.getByRole('link', { name, ...opts });
const click = async (loc) => {
  await loc.first().click();
  await settle();
};
const text = () => p.evaluate(() => document.body.innerText);
const expectText = async (re, what, timeout = 5000) => {
  const ok = await p
    .waitForFunction(([src, flags]) => new RegExp(src, flags).test(document.body.innerText), [re.source, re.flags], { timeout })
    .then(() => true)
    .catch(() => false);
  if (!ok) throw new Error(`expected ${what ?? re}`);
};
const dump = async () => {
  const names = await p.evaluate(() =>
    [...document.querySelectorAll('button,a,[role=tab]')]
      .filter((e) => e.offsetParent)
      .map((e) => `${e.tagName.toLowerCase()}:${(e.getAttribute('aria-label') || e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 50)}`),
  );
  return names.join(' | ');
};

const results = [];
async function flow(name, fn) {
  if (only && !only.some((o) => name.includes(o))) return;
  errs.length = 0;
  try {
    await fn();
    results.push({ name, ok: !errs.length, note: errs.join(' / ') });
  } catch (e) {
    await shot('FAIL-' + name.replace(/\W+/g, '-'));
    results.push({ name, ok: false, note: e.message.split('\n')[0] + ` @ ${p.url()}\n      controls: ${await dump()}` });
  }
}

// ── Setup: sample family ──
await go('/sign-in');
await click(btn('Explore with sample data'));
await p.waitForURL('**/dashboard');
await settle();

await flow('dashboard → resolve conflict → recommendations → candidate → approve → success', async () => {
  await go('/dashboard');
  await click(link(/Resolve|Review/i));
  await shot('f1-a-conflict');
  await click(btn(/Review available caregivers/));
  await p.waitForURL(/\/priority\/requests\//);
  await shot('f1-b-recommendations');
  await click(link('Review details'));
  await p.waitForURL(/\/candidates\//);
  await shot('f1-c-candidate');
  await click(link(/^Propose reassignment to/));
  await p.waitForURL(/\/approve\//);
  await shot('f1-d-approve');
  const ack = p.getByRole('checkbox');
  if (await ack.count()) await ack.first().check();
  await click(btn('Approve reassignment'));
  await p.waitForURL(/\/done$/);
  await go('/tasks/t3');
  await expectText(/Afsara Mannan/, 'new assignee on the task');
  if (/Schedule conflict/.test(await text())) throw new Error('task still shows a conflict after approval');
  await shot('f1-e-success');
});

await flow('what-if simulate → impact → apply', async () => {
  await go('/what-if');
  await p.getByLabel('Give it to').selectOption({ index: 1 });
  await settle();
  await shot('f2-a-simulator');
  await click(link(/impact|review|analy/i).or(btn(/impact|review|analy/i)));
  await p.waitForURL(/\/what-if\/impact/);
  await shot('f2-b-impact');
  const ack = p.getByRole('checkbox');
  if (await ack.count()) await ack.first().check();
  await click(btn(/apply/i));
  await expectText(/applied|updated|saved/i, 'confirmation after apply');
});

await flow('grocery list → create grocery task', async () => {
  await go('/nutrition/groceries');
  await click(btn(/Create grocery task/));
  await p.waitForURL(/\/tasks\/[^/]+$/);
  await expectText(/grocer/i);
  await shot('f3-grocery-task');
});

await flow('food options → add to list', async () => {
  await go('/nutrition/recommendations');
  const before = await p.getByRole('button', { name: 'On the grocery list' }).count();
  await click(btn('Add to grocery list'));
  await p.waitForFunction((n) => [...document.querySelectorAll('button')].filter((b) => b.textContent?.trim() === 'On the grocery list').length === n, before + 1, { timeout: 5000 }).catch(() => {});
  const after = await p.getByRole('button', { name: 'On the grocery list' }).count();
  if (after !== before + 1) throw new Error(`on-list count ${before} → ${after}`);
});

await flow('document upload (metadata) → listed → delete', async () => {
  await go('/documents');
  await click(btn('Upload document'));
  await p
    .getByRole('dialog')
    .locator('input[type=file]')
    .setInputFiles({ name: 'discharge-summary.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test') });
  await settle();
  const name = p.getByLabel(/^Name/);
  await name.fill('Discharge summary (test)');
  await shot('f4-a-upload-dialog');
  await click(p.getByRole('dialog').getByRole('button', { name: 'Upload', exact: true }));
  await expectText(/Discharge summary \(test\)/);
  await shot('f4-b-listed');
  // Invalid type is rejected
  await click(btn('Upload document'));
  await p
    .getByRole('dialog')
    .locator('input[type=file]')
    .setInputFiles({ name: 'virus.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('MZ') });
  await settle();
  await expectText(/type|format|PDF/i, 'file-type validation message');
  await p.keyboard.press('Escape');
});

await flow('appointment create with validation', async () => {
  await go('/appointments/new');
  await click(btn(/save|create|add appointment/i));
  await expectText(/required|enter|add a/i, 'validation errors on empty submit');
  await shot('f5-a-errors');
  await p.getByLabel(/What is the visit/).fill('Eye check-up (test)');
  const withField = p.getByLabel(/^With/);
  if (await withField.count()) await withField.fill('Dr. Example');
  const tomorrow = new Date(Date.now() + 86400000);
  await p.getByLabel(/^Date/).fill(tomorrow.toISOString().slice(0, 10));
  const loc = p.getByLabel(/^Location/);
  if (await loc.count()) await loc.fill('Community clinic');
  await click(btn(/save|create|add appointment/i));
  await p.waitForURL(/\/appointments\/[^/]+$/);
  await expectText(/Eye check-up \(test\)/);
  await shot('f5-b-created');
});

await flow('task create → complete', async () => {
  await go('/tasks/new');
  await click(btn(/create|save|add task/i));
  await expectText(/required|enter|add a/i, 'validation errors');
  await p
    .getByLabel(/^(Task|Title|What needs doing)/)
    .first()
    .fill('Water the plants (test)');
  await click(btn(/create|save|add task/i));
  await p.waitForURL(/\/tasks\/[^/]+$/);
  await expectText(/Water the plants \(test\)/);
  await click(btn(/mark as done|complete/i));
  await expectText(/Completed/);
  await shot('f6-task-done');
});

await flow('report unavailability → creates requests', async () => {
  await go('/schedule/unavailable');
  await shot('f7-a-form');
  await click(btn(/report|save|submit/i).last());
  await settle();
  await shot('f7-b-after');
  if (/\/schedule\/unavailable$/.test(p.url())) await expectText(/required|choose|enter|must/i, 'validation or navigation');
});

await flow('family: invite (validation) → member edit → access toggle → remove', async () => {
  await go('/family');
  await shot('f8-a-family');
  await click(btn('Invite member'));
  await click(p.getByRole('dialog').getByRole('button', { name: 'Send invitation' }));
  await expectText(/Name is required/);
  await p
    .getByRole('dialog')
    .getByLabel(/^Full name/)
    .fill('Casey Test');
  await p
    .getByRole('dialog')
    .getByLabel(/^Email/)
    .fill('casey@example.com');
  await click(p.getByRole('dialog').getByRole('button', { name: 'Send invitation' }));
  await expectText(/Casey Test/);
  await click(link(/Casey Test/));
  await p.waitForURL(/\/family\/[^/]+$/);
  await shot('f8-b-member');
  await click(btn('Edit profile'));
  await p
    .getByRole('dialog')
    .getByLabel(/^Household focus/)
    .fill('Weekend drives');
  await click(p.getByRole('dialog').getByRole('button', { name: /Driving/ }));
  await click(p.getByRole('dialog').getByRole('button', { name: 'Save' }));
  await expectText(/Weekend drives/);
  await click(p.getByRole('tab', { name: 'Access' }));
  await click(p.getByRole('switch', { name: /Documents/ }));
  await expectText(/Access updated/);
  await shot('f8-c-access');
  await click(btn('Remove'));
  await click(p.getByRole('dialog').getByRole('button', { name: 'Remove' }));
  await p.waitForURL(/\/family$/);
  await settle();
  if (await p.getByRole('link', { name: /Casey Test/ }).count()) throw new Error('member still listed after removal');
});

await flow('family: roster export downloads CSV', async () => {
  await go('/family');
  const [dl] = await Promise.all([p.waitForEvent('download'), btn('Export roster').click()]);
  const path = await dl.path();
  const csv = fs.readFileSync(path, 'utf8');
  if (!/^"Name","Relationship"/.test(csv) || csv.split('\r\n').length < 3) throw new Error('unexpected CSV: ' + csv.slice(0, 80));
});

await flow('notifications: mark one + all read, dismiss', async () => {
  await go('/notifications');
  await shot('f9-a-notifications');
  const before = await p.getByRole('button', { name: 'Dismiss' }).count();
  await click(btn('Dismiss'));
  const after = await p.getByRole('button', { name: 'Dismiss' }).count();
  if (after !== before - 1) throw new Error(`dismiss ${before} → ${after}`);
  if (await btn('Mark all as read').isEnabled()) await click(btn('Mark all as read'));
  if (await p.getByRole('button', { name: 'Mark as read' }).count()) throw new Error('unread items remain');
  const badge = await p
    .getByRole('link', { name: /Notifications/ })
    .first()
    .textContent();
  await shot('f9-b-read');
  if (/\d/.test(badge ?? '')) throw new Error('topbar still shows unread count: ' + badge);
});

await flow('activity: filters + export', async () => {
  await go('/activity');
  await shot('f10-activity');
  await click(p.getByRole('button', { name: 'Circle', exact: true }));
  await p.getByLabel('Time period').selectOption('all');
  await settle();
  await expectText(/event/);
  const [dl] = await Promise.all([p.waitForEvent('download'), btn('Export CSV').click()]);
  if (!/activity\.csv$/.test(dl.suggestedFilename())) throw new Error(dl.suggestedFilename());
});

await flow('settings: profile validation + save updates the shell', async () => {
  await go('/settings');
  await p.getByLabel(/^Email/).fill('not-an-email');
  await click(btn('Save profile'));
  await expectText(/valid email/);
  await p.getByLabel(/^Email/).fill('afsara@example.com');
  await p.getByLabel(/^Full name/).fill('Afsara M. Test');
  await p.getByLabel(/^About you/).fill('Keeping the week organised.');
  await click(btn('Save profile'));
  await expectText(/Profile saved/);
  await go('/dashboard');
  await expectText(/Afsara M\. Test/, 'new name in the shell after reload');
  await go('/settings');
  await click(p.getByRole('tab', { name: 'Family' }));
  await click(btn('Edit'));
  await p
    .getByRole('dialog')
    .getByLabel(/^Family name/)
    .fill('');
  await click(p.getByRole('dialog').getByRole('button', { name: 'Save changes' }));
  await expectText(/Family name is required/);
  await p.keyboard.press('Escape');
  await shot('f11-settings');
});

await flow('caregraph: open a node from the graph', async () => {
  await go('/caregraph');
  await click(btn(/^Caregiver/).first());
  await click(p.locator('a[href^="/caregraph/"]').filter({ hasText: /details|open|view/i }));
  await p.waitForURL(/\/caregraph\/.+/);
  if (/no longer in the CareGraph/.test(await text())) throw new Error('entity page could not resolve node');
  await shot('f12-entity');
});

await flow('keyboard: skip link + dialog focus trap/escape', async () => {
  await go('/family');
  await p.keyboard.press('Tab');
  const first = await p.evaluate(() => document.activeElement?.textContent?.trim());
  if (!/skip/i.test(first ?? '')) throw new Error('first tab stop is not the skip link: ' + first);
  await btn('Invite member').focus();
  await p.keyboard.press('Enter');
  await p.waitForTimeout(200);
  const inDialog = await p.evaluate(() => Boolean(document.activeElement?.closest('dialog[open]')));
  if (!inDialog) throw new Error('focus did not move into the dialog');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(200);
  const open = await p.evaluate(() => Boolean(document.querySelector('dialog[open]')));
  if (open) throw new Error('Escape did not close the dialog');
});

await flow('sign out → protected deep link → sign-in with next', async () => {
  await go('/settings');
  await click(p.getByRole('tab', { name: 'Sign-in & security' }));
  await click(btn('Sign out'));
  await go('/tasks');
  if (!/\/sign-in\?next=%2Ftasks/.test(p.url())) throw new Error('not redirected with next: ' + p.url());
  await go('/sign-in?next=https://evil.example');
  await click(btn('Explore with sample data'));
  await p.waitForURL(/\/dashboard/);
});

await b.close();
let fail = 0;
for (const r of results) {
  if (!r.ok) fail++;
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.note ? `\n      ${r.note}` : ''}`);
}
console.log(`\n${results.length - fail}/${results.length} flows passed`);
