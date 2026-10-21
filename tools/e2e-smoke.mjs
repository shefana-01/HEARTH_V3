// End-to-end check of a running Hearth (docker compose up), through the same address the browser uses.
//
//   node tools/e2e-smoke.mjs                      (defaults: app http://localhost:8000, Mailpit http://localhost:8025)
//   BASE=http://localhost:8080 node tools/e2e-smoke.mjs     (straight to the gateway)
//
// It plays two people: Afsara signs up, confirms her email (read from Mailpit), creates a family and
// invites Rafid; Rafid signs up, confirms and joins. Then it goes through tasks, personal events, time away,
// handovers (via Kafka), the decision engine, chat, notifications, the activity log, health notes, the
// shopping list, documents and the family map (Neo4j). Each step prints ✓ or stops with what went wrong.
// Needs Node 18 or newer. Safe to run repeatedly: every run uses new email addresses.

const BASE = (process.env.BASE ?? 'http://localhost:8000').replace(/\/$/, '');
const MAILPIT = (process.env.MAILPIT ?? 'http://localhost:8025').replace(/\/$/, '');
const API = `${BASE}/api/v1`;
const run = Date.now().toString(36);
const PASSWORD = 'Sunrise#2026';
let steps = 0;

function ok(label) {
  steps++;
  console.log(`  ✓ ${label}`);
}

function check(condition, label, detail) {
  if (!condition) {
    console.error(`  ✗ ${label}${detail === undefined ? '' : `\n    ${typeof detail === 'string' ? detail : JSON.stringify(detail).slice(0, 600)}`}`);
    process.exit(1);
  }
  ok(label);
}

async function call(method, path, { token, body, expect = [200, 201, 204], form } = {}) {
  // Sent like a browser does, so CORS and same-origin handling are tested too.
  const headers = { Accept: 'application/json', Origin: BASE };
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const response = await fetch(`${API}${path}`, { method, headers, body: payload });
  const text = await response.text();
  const data = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : undefined;
  const expected = Array.isArray(expect) ? expect : [expect];
  if (!expected.includes(response.status)) {
    console.error(`  ✗ ${method} ${path} → ${response.status} (expected ${expected.join(' or ')})\n    ${text.slice(0, 500)}`);
    process.exit(1);
  }
  return data;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Waits for something that arrives through Kafka (a few seconds at most). */
async function eventually(label, probe, timeoutMs = 20000) {
  const start = Date.now();
  let last;
  while (Date.now() - start < timeoutMs) {
    last = await probe();
    if (last) {
      ok(`${label} (${((Date.now() - start) / 1000).toFixed(1)} s)`);
      return last;
    }
    await sleep(500);
  }
  check(false, label, 'did not happen within 20 s');
}

/** The token in the newest email to this address, read from Mailpit's API. */
async function tokenFromEmail(to, subjectStart) {
  return eventually(`email "${subjectStart}…" reached ${to}`, async () => {
    const list = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`)).json();
    const message = list.messages?.find((m) => m.Subject.startsWith(subjectStart));
    if (!message) return null;
    const full = await (await fetch(`${MAILPIT}/api/v1/message/${message.ID}`)).json();
    return decodeURIComponent(/token=([A-Za-z0-9_%-]+)/.exec(full.Text)?.[1] ?? '') || null;
  });
}

const iso = (minutesFromNow) => {
  const t = new Date(Date.now() + minutesFromNow * 60_000);
  t.setSeconds(0, 0);
  return t.toISOString();
};

async function signUp(name, email) {
  const res = await call('POST', '/auth/sign-up', { body: { name, email, password: PASSWORD }, expect: 201 });
  const token = await tokenFromEmail(email, 'Confirm your email');
  await call('POST', '/auth/verify-email', { body: { token }, expect: 204 });
  return res;
}

console.log(`Hearth end-to-end check against ${BASE}\n`);

/* ───────── accounts and family ───────── */
console.log('Accounts and family');
const afsaraEmail = `afsara.${run}@example.com`;
const rafidEmail = `rafid.${run}@example.com`;
const afsara = await signUp('Afsara Mannan', afsaraEmail);
check(afsara.session.hasFamily === false && afsara.session.account.memberId === null, 'Afsara signed up; no family yet');
await call('POST', '/auth/sign-in', { body: { email: afsaraEmail, password: 'wrong-Password1' }, expect: 401 });
ok('a wrong password is refused');
let A = afsara.token;

const family = await call('POST', '/family', {
  token: A,
  expect: 201,
  body: {
    name: `The Mannan Family ${run}`,
    location: 'Dhaka',
    myRelation: 'Daughter',
    dependants: [{ name: 'Rahima Khatun', relation: 'Grandmother', notes: '' }],
    invites: [{ name: 'Rafid Mannan', email: rafidEmail, relation: 'Brother', role: 'contributor' }],
    availability: { days: [true, true, true, true, true, true, true], windows: [] },
    timezone: 'Asia/Dhaka',
  },
});
check(/^HEARTH-[A-Z0-9]{6}$/.test(family.inviteCode) && family.dependants.length === 1, `family created (code ${family.inviteCode})`);
const rahima = family.dependants[0].id;
const afsaraId = (await call('GET', '/auth/session', { token: A })).account.memberId;

const rafid = await signUp('Rafid Mannan', rafidEmail);
let R = rafid.token;
const lookup = await call('GET', `/invites/${family.inviteCode}`, { token: R });
check(lookup.inviterName === 'Afsara Mannan', 'Rafid looked up the invitation');
await call('POST', `/invites/${family.inviteCode}/accept`, { token: R });
const rafidId = (await call('GET', '/auth/session', { token: R })).account.memberId;
const members = await call('GET', '/members', { token: A });
check(members.length === 2 && members.every((m) => m.status === 'active'), 'Rafid joined; both members active');
await call('PATCH', `/members/${rafidId}`, { token: R, body: { skills: ['driving', 'errands'], focus: 'Weekend drives' } });
ok('Rafid listed his skills');

const pair = await call('POST', '/auth/refresh', { body: { refreshToken: afsara.refreshToken } });
await call('POST', '/auth/refresh', { body: { refreshToken: afsara.refreshToken }, expect: 401 });
check(Boolean(pair.token), 'refresh tokens rotate, and a reused one is refused');
A = (await call('POST', '/auth/sign-in', { body: { email: afsaraEmail, password: PASSWORD } })).token;

/* ───────── tasks, events, time away ───────── */
console.log('\nTasks and schedule');
const drive = await call('POST', '/tasks', {
  token: A,
  expect: 201,
  body: { title: 'Drive Grandma to the clinic', notes: '', category: 'transport', priority: 'important', start: iso(26 * 60), durationMin: 60, assigneeId: rafidId, forId: rahima, visibility: 'family', reminder: true },
});
check(drive.assigneeId === rafidId, 'shared task created for Rafid');
const secret = await call('POST', '/tasks', {
  token: A,
  expect: 201,
  body: { title: 'Private study', notes: '', category: 'study', priority: 'routine', start: iso(28 * 60), durationMin: 90, assigneeId: null, visibility: 'private', reminder: false },
});
await call('GET', `/tasks/${secret.id}`, { token: R, expect: 404 });
ok('a private task stays private');
await call('POST', '/events', {
  token: R,
  expect: 201,
  body: { title: 'Data Structures', kind: 'class', start: iso(30), durationMin: 90, repeat: 'weekly', days: [true, true, true, true, true, true, true], location: 'UAP', visibility: 'busy' },
});
const week = await call('GET', `/schedule/events?from=${encodeURIComponent(iso(-60))}&to=${encodeURIComponent(iso(7 * 24 * 60))}`, { token: A });
check(week.some((e) => e.kind === 'busy') && week.some((e) => e.id === drive.id), "the week shows Rafid's class as Busy and the shared task");

const away = await call('POST', '/unavailability', { token: R, expect: 201, body: { start: iso(25 * 60), end: iso(28 * 60), reason: 'Exam', note: '' } });
check(away.affectedTaskIds.includes(drive.id), 'time away names the affected task');
const request = await eventually('decision-service opened a handover request (Kafka)', async () => {
  const list = await call('GET', '/reassignment-requests', { token: A });
  return list.find((r) => r.taskId === drive.id && r.status === 'open');
});

/* ───────── decisions ───────── */
console.log('\nDecision engine');
const attention = await call('GET', '/decisions/attention', { token: A });
check(attention.some((item) => item.task.id === drive.id && item.conflict.kind === 'reported-unavailable'), 'the clash is on the attention list');
const insight = await call('GET', `/decisions/tasks/${drive.id}/insight`, { token: A });
check(insight.openRequestId === request.id && insight.candidates.length >= 1, 'task insight scores candidates');
const simulation = await call('POST', '/decisions/simulations', { token: A, body: { taskId: drive.id, assigneeId: afsaraId } });
check(simulation.resolved.length === 1, 'what-if: giving it to Afsara resolves the clash');
await call('POST', `/reassignment-requests/${request.id}/approve`, { token: A, body: { memberId: afsaraId } });
check((await call('GET', `/tasks/${drive.id}`, { token: A })).assigneeId === afsaraId, 'handover approved: the task is now Afsara’s');
const myDay = await call('GET', '/decisions/my-day', { token: A });
check(myDay.some((r) => r.task.id === drive.id) && myDay[0].rank === 1, "it is in Afsara's day, ranked");

/* ───────── chat, notifications, activity ───────── */
console.log('\nChat, notifications and activity');
await eventually('the chat says who took over (Kafka)', async () => (await call('GET', '/messages?channel=family', { token: R })).some((m) => m.kind === 'system' && m.text.includes('took over')));
await call('POST', '/messages', { token: R, expect: 201, body: { channel: 'family', text: 'Thanks, Apu!' } });
await eventually("Afsara has an unread message", async () => (await call('GET', '/messages/unread-count', { token: A })).unread >= 1);
await call('POST', '/messages', { token: R, expect: 201, body: { channel: `task:${drive.id}`, text: 'The clinic opens at 9.' } });
check((await call('GET', '/messages/task-counts', { token: A }))[drive.id] === 1, 'task comments are counted');
await eventually('Rafid was notified (Kafka)', async () => (await call('GET', '/notifications', { token: R })).length > 0);
await eventually('the activity log has the changes (Kafka)', async () => {
  const log = await call('GET', '/audit-events', { token: A });
  return log.some((e) => e.action === 'Handed over a task') && log.some((e) => e.action === 'Created the family space');
});
check(!(await call('GET', '/audit-events', { token: A })).some((e) => e.subject === 'Private study'), 'private tasks stay out of the activity log');

/* ───────── health, food and shopping ───────── */
console.log('\nHealth, food and shopping');
await call('PUT', `/health/profiles/${rahima}`, { token: A, body: { conditions: ['low-iron'], goals: [], avoid: [], preferences: [], notes: '', shared: true } });
const suggestions = await call('GET', '/health/suggestions', { token: A });
check(suggestions.length > 0 && suggestions[0].reasons[0].because === 'Low iron or anaemia', `food suggestions (${suggestions.length}) match the health notes`);
await call('GET', `/health/profiles/${rahima}`, { token: R, expect: 403 });
ok("Rafid (no medical access) cannot read Grandma's notes");
const item = await call('POST', '/groceries/from-food', { token: A, expect: 201, body: { foodId: suggestions[0].id, forIds: [rahima], tags: suggestions[0].reasons[0].tags } });
check(item.reason && item.forIds[0] === rahima, `"${item.name}" is on the list (${item.reason})`);
const shopping = await call('POST', '/groceries/task', { token: A, expect: 201, body: { assigneeId: rafidId, start: iso(48 * 60) } });
check(shopping.title === 'Shopping (1 item)' && shopping.assigneeId === rafidId, 'the list became a shopping task for Rafid');

/* ───────── documents and the family map ───────── */
console.log('\nDocuments and the family map');
const form = new FormData();
form.append('file', new Blob(['%PDF-1.4 Hearth test'], { type: 'application/pdf' }), 'report.pdf');
form.append('title', 'Blood test');
form.append('category', 'Lab result');
form.append('ownerId', rahima);
form.append('access', 'restricted');
const doc = await call('POST', '/documents', { token: A, expect: 201, form });
check((await call('GET', '/documents', { token: R })).every((d) => d.id !== doc.id), 'a restricted document is hidden from Rafid');
const download = await fetch(`${API}/documents/${doc.id}/file`, { headers: { Authorization: `Bearer ${A}` } });
check(download.ok && (await download.text()) === '%PDF-1.4 Hearth test', 'the stored file downloads intact');
const appointment = await call('POST', '/appointments', {
  token: A,
  expect: 201,
  body: { title: 'Heart check-up', specialty: 'Cardiology', start: iso(50 * 60), durationMin: 45, provider: 'Dr. Karim', location: 'Square Hospital', forId: rahima, escortId: rafidId, visibility: 'family', prep: ['Bring reports'], note: '' },
});
const graph = await eventually('the family map (Neo4j) shows the people and plans', async () => {
  const g = await call('GET', '/caregraph', { token: A });
  return g.nodes.some((n) => n.id === `appt:${appointment.id}`) && g.nodes.some((n) => n.kind === 'dependant') ? g : null;
});
check(graph.edges.some((e) => e.label === 'goes along'), `${graph.nodes.length} nodes, ${graph.edges.length} relationships`);

/* ───────── security ───────── */
console.log('\nSecurity');
const noToken = await fetch(`${API}/tasks`);
check(noToken.status === 401, 'no token → 401');
const internal = await fetch(`${API}/internal/context`, { headers: { Authorization: `Bearer ${A}` } });
check(internal.status === 404, 'internal endpoints are not reachable from outside');
await call('POST', `/members`, { token: R, expect: 403, body: { name: 'X', email: `x.${run}@example.com`, relation: '', role: 'contributor' } });
ok('only the organiser can invite');

console.log(`\nAll ${steps} checks passed.`);
