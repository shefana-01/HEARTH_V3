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
await click(btn('Explore with a sample family'));
await p.waitForURL('**/today');
await settle();

/** The demo workspace as stored in the browser. */
const ws = () => p.evaluate(() => JSON.parse(localStorage.getItem('hearth.workspace.v3')));
const ME = 'm-afsara';
const must = (cond, what) => {
  if (!cond) throw new Error(what);
};
const pad = (n) => String(n).padStart(2, '0');
const dateInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const daysAhead = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
};

await flow('my day: ranked list, do first, mark done', async () => {
  await go('/today');
  await expectText(/Do first/i, 'a "Do first" card');
  await expectText(/Can wait/, 'the "Can wait" group');
  await shot('f1-my-day');
  const before = (await ws()).tasks.filter((t) => t.status === 'completed').length;
  await click(btn('Mark done'));
  await expectText(/Do first|Nothing left|Create a task/i, 'the list to reload');
  must((await ws()).tasks.filter((t) => t.status === 'completed').length === before + 1, 'one more completed task');
});

await flow('status line: set it, family hub and chat show it', async () => {
  await go('/today');
  await click(btn(/Set status|Change/));
  await p.getByRole('dialog').getByRole('textbox').first().fill('Studying in the library');
  await click(p.getByRole('dialog').getByRole('button', { name: /^Save/ }));
  must((await ws()).members.find((m) => m.id === ME).statusNote?.text === 'Studying in the library', 'status saved');
  await go('/family');
  await expectText(/Studying in the library/, 'status on the family hub');
  await go('/chat');
  await expectText(/Afsara: Studying in the library/, 'status line in the chat');
});

await flow('personal schedule: weekly event → clash on a task planned on top of it', async () => {
  const day = daysAhead(3);
  await go('/schedule/events/new');
  await p.getByLabel(/^Name\*?$/).fill('Compiler design class');
  await click(btn('Class', { exact: true }));
  await p.getByLabel(/^Date\*?$/).fill(dateInput(day));
  await p.getByLabel(/^Starts\*?$/).fill('10:00');
  await p.getByLabel(/^Ends\*?$/).fill('11:30');
  await p.getByText('Every week', { exact: true }).click();
  await shot('f3-a-event-form');
  await click(btn('Add to my schedule'));
  await p.waitForURL(/\/schedule$/);
  const ev = (await ws()).events.find((e) => e.title === 'Compiler design class');
  must(ev && ev.repeat === 'weekly' && ev.days.filter(Boolean).length === 1 && ev.durationMin === 90, 'weekly event stored with one weekday and 90 minutes');
  await expectText(/Compiler design class/, 'the event under "My regular week"');

  // A shared task for me in the middle of that class.
  await go('/tasks/new');
  await p.getByLabel('Task title').fill('Collect parcel from courier');
  await click(btn('Errands & shopping'));
  await p.getByLabel(/^Date\*?$/).fill(dateInput(day));
  await p.getByLabel(/^Time\*?$/).fill('10:30');
  await settle();
  await shot('f3-b-task-form');
  await click(btn('Add task'));
  await p.waitForURL(/\/tasks\/t-/);
  await expectText(/Compiler design class/, 'the clash naming the class', 8000);
  await shot('f3-c-task-clash');
  await go('/today');
  await expectText(/Collect parcel from courier/, 'the task in My day');
});

await flow('private task: study defaults to private, stays mine, hidden from handover', async () => {
  await go('/tasks/new');
  await p.getByLabel('Task title').fill('Revise for the networks quiz');
  await click(btn('Study', { exact: true }));
  must(await p.getByRole('radio', { name: /Only me/ }).isChecked(), 'visibility switched to "Only me" for a study task');
  await p.getByLabel(/^Date\*?$/).fill(dateInput(daysAhead(4)));
  await p.getByLabel(/^Time\*?$/).fill('19:00');
  await click(btn('Add task'));
  await p.waitForURL(/\/tasks\/t-/);
  const t = (await ws()).tasks.find((x) => x.title === 'Revise for the networks quiz');
  must(t.visibility === 'private' && t.assigneeId === ME, 'stored private and assigned to me');
  await expectText(/Private/, 'a Private badge');
  must((await btn(/Ask someone to take/).count()) === 0, 'no handover button on a private task');
  const audit = (await ws()).audit.some((e) => e.subject === 'Revise for the networks quiz');
  must(!audit, 'private task left no trace in the family activity log');
});

await flow('handover: someone else’s task with a clash → I take it → chat is told', async () => {
  // t7 is tomorrow morning and clashes with Rafid’s lab, so this holds at any time of day.
  await go('/tasks/t7/resolve');
  await shot('f5-a-clash');
  await click(btn('See who can take it'));
  await p.waitForURL(/\/priority\/requests\//);
  await expectText(/Afsara|Me/, 'me among the candidates');
  await shot('f5-b-candidates');
  await click(p.getByRole('link', { name: /I’ll take it/ }).or(btn(/I’ll take it/)));
  await p.waitForURL(/\/approve\//);
  await shot('f5-c-confirm');
  const ack = p.getByRole('checkbox');
  if (await ack.count()) await ack.first().check();
  await click(btn(/Confirm handover|Hand over|Confirm/));
  await p.waitForURL(/\/done$/);
  const w = await ws();
  must(w.tasks.find((t) => t.id === 't7').assigneeId === ME, 'task now mine');
  must(
    w.messages.some((m) => m.kind === 'system' && /took over “Take Grandma to her heart check-up”/.test(m.text)),
    'system line in the family chat',
  );
  await go('/chat');
  await expectText(/Afsara took over/, 'the handover line in the chat');
});

await flow('I can’t make it: shared task gets a handover request, private one is left to me', async () => {
  await go('/schedule/unavailable');
  await click(p.getByText('The rest of today', { exact: false }));
  await click(btn('Feeling unwell'));
  await shot('f6-a-cant-make-it');
  await click(btn(/Tell my family/));
  await settle();
  const w = await ws();
  const mine = w.unavailability.filter((u) => u.memberId === ME);
  must(mine.length === 1, 'time away stored');
  const open = w.reassignments.filter((r) => r.status === 'open' && r.fromMemberId === ME);
  const sharedToday = w.tasks.filter(
    (t) => t.assigneeId === ME && t.status === 'scheduled' && t.visibility === 'family' && new Date(t.start) > new Date() && new Date(t.start).toDateString() === new Date().toDateString(),
  );
  must(open.length === sharedToday.length, `a request per shared task left today (${open.length} vs ${sharedToday.length})`);
  must(!w.reassignments.some((r) => w.tasks.find((t) => t.id === r.taskId)?.visibility === 'private'), 'no request for a private task');
});

await flow('family chat: send a message, unread badge clears', async () => {
  await go('/chat');
  await p.getByRole('textbox').fill('I can do the school run this week.');
  await p.keyboard.press('Enter');
  await expectText(/I can do the school run this week\./, 'my message in the log');
  must(
    (await ws()).messages.some((m) => m.text === 'I can do the school run this week.' && m.authorId === ME && m.channel === 'family'),
    'message stored',
  );
  await go('/today');
  must((await p.getByRole('link', { name: /Family chat, \d+ unread/ }).count()) === 0, 'no unread badge after reading');
});

await flow('task comments', async () => {
  await go('/tasks/t5');
  await p.getByLabel('Write a comment').fill('We are out of lentils, I will bring some.');
  await click(btn('Send'));
  await expectText(/We are out of lentils/, 'the comment');
  must(
    (await ws()).messages.some((m) => m.channel === 'task:t5' && /lentils/.test(m.text)),
    'comment stored in the task thread',
  );
});

await flow('health notes → food suggestions → shopping list (private notes stay unnamed)', async () => {
  await go(`/health/${ME}`);
  await p.getByRole('checkbox', { name: /Weak bones or low calcium/ }).check();
  await shot('f9-a-health-notes');
  await click(btn('Save', { exact: true }));
  await p.waitForURL(/\/health$/);
  must((await ws()).health.find((h) => h.personId === ME).conditions.includes('weak-bones'), 'condition saved');
  await go(`/health/suggestions`);
  await expectText(/Sesame seeds/, 'a calcium food in the suggestions');
  const card = p.getByRole('heading', { name: /Sesame seeds/ }).locator('xpath=ancestor::*[.//button][1]');
  await shot('f9-b-suggestions');
  await click(card.getByRole('button', { name: /Add to shopping list/ }));
  const item = (await ws()).groceries.find((g) => g.foodId === 'sesame');
  must(item, 'sesame on the shopping list');
  must(!item.forIds.includes(ME), 'my name is not attached because my notes are private');
  must(/Calcium|Iron|Magnesium/.test(item.reason ?? ''), 'reason kept as a food tag, not a condition: ' + item.reason);
  await go('/groceries');
  await expectText(/Sesame seeds/, 'the item on the list');
  await shot('f9-c-shopping-list');
});

await flow('shopping list: add an item and turn the list into a task', async () => {
  await go('/groceries');
  await p.getByLabel(/^Name\*?$/).fill('Toothpaste');
  await click(btn('Add', { exact: true }));
  await expectText(/Toothpaste/, 'the custom item');
  await click(btn('Turn into a shopping task'));
  await click(p.getByRole('dialog').getByRole('button', { name: /Create|Add|Make/ }));
  await p.waitForURL(/\/tasks\/t-/);
  const t = (await ws()).tasks.find((x) => /^Shopping \(/.test(x.title));
  must(t && t.category === 'errands' && t.visibility === 'family' && /Toothpaste/.test(t.notes), 'shopping task created with the items');
});

await flow('people we look after: add and remove', async () => {
  await go('/family');
  await click(btn('Add someone'));
  const d = p.getByRole('dialog');
  await d.getByLabel(/^Name\*?$/).fill('Nana Karim');
  await d.getByLabel(/Relation/).fill('Grandfather');
  await click(d.getByRole('button', { name: /^(Add|Save)/ }));
  await expectText(/Nana Karim/, 'the new person');
  must(
    (await ws()).family.dependants.some((x) => x.name === 'Nana Karim'),
    'dependant stored',
  );
  await click(btn('Remove Nana Karim'));
  await click(p.getByRole('dialog').getByRole('button', { name: /Remove/ }));
  await settle();
  must(!(await ws()).family.dependants.some((x) => x.name === 'Nana Karim'), 'dependant removed');
});

await flow('appointment for someone we look after, with someone going along', async () => {
  await go('/appointments/new');
  await p.getByLabel('What is the visit?').fill('Eye test');
  await p.getByLabel('Who is it for?').selectOption('dep-rahima');
  await p.getByLabel('Doctor or clinic').fill('Vision Care');
  await p.getByLabel(/^Date\*?$/).fill(dateInput(daysAhead(6)));
  await p.getByLabel(/^Time\*?$/).fill('11:00');
  await p.getByLabel('Who is going along?').selectOption(ME);
  await click(btn('Add appointment'));
  await p.waitForURL(/\/appointments\/a-/);
  const a = (await ws()).appointments.find((x) => x.title === 'Eye test');
  must(a.forId === 'dep-rahima' && a.escortId === ME && a.visibility === 'family', 'stored for Rahima with me going along');
  await expectText(/Rahima/, 'who it is for');
  await go('/schedule');
  await p
    .getByRole('button', { name: /Next week/ })
    .click()
    .catch(() => {});
});

await flow('documents: upload about a person, only me', async () => {
  await go('/documents');
  await p.setInputFiles('input[type=file]', { name: 'x-ray.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test') });
  const d = p.getByRole('dialog');
  await d.waitFor();
  await d.getByLabel(/Who is it about/).selectOption('dep-ayaan');
  await d.getByText('Only me', { exact: true }).click();
  await shot('f12-upload');
  await click(d.getByRole('button', { name: /Upload|Save|Add/ }));
  const doc = (await ws()).documents.find((x) => x.fileName === 'x-ray.pdf');
  must(doc && doc.ownerId === 'dep-ayaan' && doc.access === 'restricted' && doc.allowedIds.length === 1 && doc.allowedIds[0] === ME, 'stored about Ayaan, restricted to me');
});

await flow('display: larger text scales the whole page', async () => {
  await go('/settings');
  await click(p.getByRole('tab', { name: 'Display' }));
  const before = await p.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
  await p.getByText('Extra large', { exact: true }).click();
  await settle();
  const after = await p.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
  must(after === before * 1.25, `root font size ${before} → ${after}`);
  await shot('f13-a-extra-large');
  await p.getByRole('switch', { name: /Stronger contrast/ }).click();
  must((await p.evaluate(() => document.documentElement.dataset.contrast)) === 'high', 'contrast attribute set');
  await go('/today');
  await shot('f13-b-my-day-large-contrast');
  await go('/settings');
  await click(p.getByRole('tab', { name: 'Display' }));
  await p.getByText('Standard', { exact: true }).click();
  await p.getByRole('switch', { name: /Stronger contrast/ }).click();
});

await flow('reminder: a task starting soon raises a notification', async () => {
  const soon = new Date(Date.now() + 9 * 60_000);
  await go('/tasks/new');
  await p.getByLabel('Task title').fill('Call the pharmacy');
  await click(btn('Other', { exact: true }));
  await p.getByLabel(/^Date\*?$/).fill(dateInput(soon));
  await p.getByLabel(/^Time\*?$/).fill(`${pad(soon.getHours())}:${pad(soon.getMinutes())}`);
  await click(btn(/Optional details/));
  await p.getByLabel('Remind me 15 minutes before').check();
  await click(btn('Add task'));
  await p.waitForURL(/\/tasks\/t-/);
  await p.reload();
  await settle();
  await p.waitForFunction(() => JSON.parse(localStorage.getItem('hearth.workspace.v3')).notifications.some((n) => n.type === 'reminder' && /Call the pharmacy/.test(n.message)), null, {
    timeout: 8000,
  });
  await go('/notifications');
  await expectText(/Call the pharmacy/, 'the reminder in notifications');
});

await flow('what-if planner still works and never offers a private task to others', async () => {
  await go('/what-if?task=t7');
  await expectText(/What-if planner/);
  await go('/what-if?task=t9');
  await expectText(/private|Only you|stay with you/i, 'a note that the private task cannot be given away');
});

await flow('sign out → protected deep link → sign-in with next', async () => {
  await go('/settings');
  await click(p.getByRole('tab', { name: 'Sign-in & security' }));
  await click(btn('Sign out'));
  await go('/tasks');
  if (!/\/sign-in\?next=%2Ftasks/.test(p.url())) throw new Error('not redirected with next: ' + p.url());
  await go('/sign-in?next=https://evil.example');
  await click(btn('Explore with a sample family'));
  await p.waitForURL(/\/today/);
});

await b.close();
let fail = 0;
for (const r of results) {
  if (!r.ok) fail++;
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.note ? `\n      ${r.note}` : ''}`);
}
console.log(`\n${results.length - fail}/${results.length} flows passed`);
