// Fills a running Hearth (docker compose up) with the same sample family the offline demo shows, through
// the real API: five people sign up, confirm their email (read from Mailpit), join the family and add
// their classes, tasks, appointments, health notes, shopping list, documents and chat.
//
//   node tools/seed-demo.mjs
//
// Then sign in at http://localhost:8000 as afsara@example.com (or nazmun@, kamal@, rafid@, shirin@)
// with the password Hearth#2026. Run it on a fresh database; it stops if the accounts already exist.
//   BASE=...     the app's address (default http://localhost:8000)
//   MAILPIT=...  Mailpit's address (default http://localhost:8025)
//   SUFFIX=x     use afsara.x@example.com etc., to seed a second family next to the first
//
// Times are relative to now in the family's time zone (Asia/Dhaka), so the plan always looks current.
process.env.TZ = 'Asia/Dhaka';

import { build } from '../frontend/node_modules/esbuild/lib/main.js';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const BASE = (process.env.BASE ?? 'http://localhost:8000').replace(/\/$/, '');
const MAILPIT = (process.env.MAILPIT ?? 'http://localhost:8025').replace(/\/$/, '');
const API = `${BASE}/api/v1`;
const PASSWORD = 'Hearth#2026';
const SUFFIX = process.env.SUFFIX ? `.${process.env.SUFFIX}` : '';

/* ───────── the sample family, from the frontend ───────── */

const slash = (p) => p.replace(/\\/g, '/');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'frontend/src');
const dir = mkdtempSync(join(tmpdir(), 'hearth-seed-'));
await build({
  stdin: { contents: `export { buildSampleWorkspace } from '${slash(join(src, 'mocks/sampleWorkspace.ts'))}';`, resolveDir: src, loader: 'ts' },
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: join(dir, 'sample.mjs'),
  alias: { '@': src },
  logLevel: 'silent',
});
const { buildSampleWorkspace } = await import(pathToFileURL(join(dir, 'sample.mjs')).href);
rmSync(dir, { recursive: true, force: true });
const sample = buildSampleWorkspace();

/* ───────── helpers ───────── */

async function call(method, path, token, body, form) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${API}${path}`, { method, headers, body: form ?? (body === undefined ? undefined : JSON.stringify(body)) });
  const text = await response.text();
  if (!response.ok) {
    const detail = (() => { try { return JSON.parse(text).detail; } catch { return text; } })();
    throw new Error(`${method} ${path} → ${response.status}: ${detail}`);
  }
  return text ? JSON.parse(text) : undefined;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function confirmEmail(email) {
  for (let i = 0; i < 60; i++) {
    const list = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}" subject:"Confirm your email"`)}`)).json();
    if (list.messages?.length) {
      const full = await (await fetch(`${MAILPIT}/api/v1/message/${list.messages[0].ID}`)).json();
      const token = decodeURIComponent(/token=([A-Za-z0-9_%-]+)/.exec(full.Text)[1]);
      return call('POST', '/auth/verify-email', null, { token });
    }
    await sleep(500);
  }
  throw new Error(`No confirmation email for ${email} arrived in Mailpit (${MAILPIT}).`);
}

const emailOf = (member) => member.email.replace('@', `${SUFFIX}@`);

/* ───────── people ───────── */

console.log(`Seeding the sample family into ${BASE}`);
const lead = sample.members.find((m) => m.role === 'lead');
const others = sample.members.filter((m) => m !== lead);
const tokens = {}; // sample member id → access token
const ids = {}; // sample id (member or dependant) → real id

for (const member of sample.members) {
  try {
    const res = await call('POST', '/auth/sign-up', null, { name: member.name, email: emailOf(member), password: PASSWORD });
    tokens[member.id] = res.token;
  } catch (error) {
    if (String(error.message).includes('409')) {
      console.error(`\n${emailOf(member)} already exists, so this database has been seeded before.\nSign in with that address and the password ${PASSWORD}, or run again with SUFFIX=2 for a second family.`);
      process.exit(1);
    }
    throw error;
  }
  await confirmEmail(emailOf(member));
}
console.log('  ✓ 5 accounts created and confirmed');

const L = tokens[lead.id];
await call('PATCH', '/account', L, { about: sample.account.about });
const family = await call('POST', '/family', L, {
  name: sample.family.name,
  location: sample.family.location,
  myRelation: lead.relation,
  dependants: sample.family.dependants.map(({ name, relation, birthYear, notes }) => ({ name, relation, birthYear, notes })),
  invites: others.map((m) => ({ name: m.name, email: emailOf(m), relation: m.relation, role: m.role })),
  availability: lead.availability,
  timezone: 'Asia/Dhaka',
});
await call('PATCH', '/family', L, { weeklyGroceryBudget: sample.family.weeklyGroceryBudget });
ids[lead.id] = (await call('GET', '/auth/session', L)).account.memberId;
sample.family.dependants.forEach((d, i) => (ids[d.id] = family.dependants[i].id));

for (const member of others) {
  await call('POST', `/invites/${family.inviteCode}/accept`, tokens[member.id]);
  ids[member.id] = (await call('GET', '/auth/session', tokens[member.id])).account.memberId;
}
for (const member of sample.members) {
  await call('PATCH', `/members/${ids[member.id]}`, tokens[member.id], { focus: member.focus, skills: member.skills, availability: member.availability });
  if (member !== lead) await call('PATCH', `/members/${ids[member.id]}`, L, { access: member.access });
}
console.log(`  ✓ family "${family.name}" (code ${family.inviteCode}) with ${sample.members.length} members and ${family.dependants.length} people looked after`);

/* ───────── calendars, tasks, appointments ───────── */

for (const event of sample.events) {
  const { title, kind, start, durationMin, repeat, days, until, location, visibility } = event;
  await call('POST', '/events', tokens[event.memberId], { title, kind, start, durationMin, repeat, days, until, location, visibility });
}

const appointmentIds = {};
for (const a of sample.appointments) {
  const token = tokens[a.createdById];
  const created = await call('POST', '/appointments', token, {
    title: a.title, specialty: a.specialty, start: a.start, durationMin: a.durationMin, provider: a.provider, location: a.location,
    forId: ids[a.forId], escortId: a.escortId ? ids[a.escortId] : null, visibility: a.visibility, prep: a.prep.map((p) => p.label), note: a.note,
  });
  appointmentIds[a.id] = created.id;
  for (const [i, item] of a.prep.entries()) {
    if (item.done) await call('POST', `/appointments/${created.id}/prep/${created.prep[i].id}/toggle`, tokens[item.doneById ?? a.createdById]);
  }
}

const taskIds = {};
for (const t of sample.tasks) {
  const created = await call('POST', '/tasks', tokens[t.createdById], {
    title: t.title, notes: t.notes, category: t.category, priority: t.priority, start: t.start, durationMin: t.durationMin,
    assigneeId: t.assigneeId ? ids[t.assigneeId] : null, forId: t.forId ? ids[t.forId] : undefined, visibility: t.visibility,
    appointmentId: t.appointmentId ? appointmentIds[t.appointmentId] : undefined, reminder: t.reminder,
  });
  taskIds[t.id] = created.id;
  if (t.status === 'completed') await call('POST', `/tasks/${created.id}/complete`, tokens[t.completedById ?? t.assigneeId ?? t.createdById]);
  if (t.status === 'cancelled') await call('DELETE', `/tasks/${created.id}`, tokens[t.createdById]);
}
console.log(`  ✓ ${sample.events.length} classes and shifts, ${sample.tasks.length} tasks, ${sample.appointments.length} appointments`);

/* ───────── health, shopping, documents ───────── */

for (const h of sample.health) {
  const owner = sample.members.some((m) => m.id === h.personId) ? h.personId : lead.id;
  const { conditions, goals, avoid, preferences, notes, shared } = h;
  await call('PUT', `/health/profiles/${ids[h.personId]}`, tokens[owner], { conditions, goals, avoid, preferences, notes, shared });
}
// The reason shown on a suggested item ("Iron") comes from the food tags chosen when it was added.
const tagLabels = JSON.parse(readFileSync(join(root, 'backend/services/care-service/src/main/resources/catalogue/tag-labels.json'), 'utf8'));
const tagsFor = (reason) => Object.entries(tagLabels).filter(([, label]) => (reason ?? '').split(', ').includes(label)).map(([tag]) => tag);
for (const g of sample.groceries) {
  const token = tokens[g.addedById ?? lead.id];
  const item = g.foodId
    ? await call('POST', '/groceries/from-food', token, { foodId: g.foodId, forIds: g.forIds.map((id) => ids[id]), tags: tagsFor(g.reason) })
    : await call('POST', '/groceries', token, { name: g.name, quantity: g.quantity, unit: g.unit });
  if (g.quantity !== item.quantity || g.status !== item.status) await call('PATCH', `/groceries/${item.id}`, token, { quantity: g.quantity, status: g.status });
}
console.log(`  ✓ ${sample.health.length} health profiles, ${sample.groceries.length} items on the shopping list`);

const PDF = '%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Kids [] /Count 0 >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n';
const JPG = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64');
for (const d of sample.documents) {
  const form = new FormData();
  const image = d.fileName.endsWith('.jpg');
  form.append('file', new Blob([image ? JPG : PDF], { type: image ? 'image/jpeg' : 'application/pdf' }), d.fileName);
  form.append('title', d.title);
  form.append('category', d.category);
  if (d.ownerId) form.append('ownerId', ids[d.ownerId]);
  form.append('access', d.access);
  d.allowedIds.filter((id) => id !== d.uploadedById).forEach((id) => form.append('allowedIds', ids[id]));
  if (d.appointmentId) form.append('appointmentId', appointmentIds[d.appointmentId]);
  await call('POST', '/documents', tokens[d.uploadedById], undefined, form);
}
console.log(`  ✓ ${sample.documents.length} documents`);

/* ───────── chat, status lines, time away ───────── */

for (const m of sample.messages.filter((x) => x.kind === 'text')) {
  const channel = m.channel === 'family' ? 'family' : `task:${taskIds[m.channel.slice('task:'.length)]}`;
  await call('POST', '/messages', tokens[m.authorId], { channel, text: m.text });
}
for (const member of sample.members.filter((m) => m.statusNote)) {
  const until = member.statusNote.until && Date.parse(member.statusNote.until) > Date.now() ? member.statusNote.until : null;
  await call('PUT', `/members/${ids[member.id]}/status`, tokens[member.id], { text: member.statusNote.text, until });
}
for (const u of sample.unavailability) {
  await call('POST', '/unavailability', tokens[u.memberId], { start: u.start, end: u.end, reason: u.reason, note: u.note });
}
console.log('  ✓ chat, status lines and time away (handover requests follow through Kafka)');

console.log(`\nDone. Open ${BASE} and sign in as ${emailOf(lead)} (or ${others.map(emailOf).join(', ')})`);
console.log(`Password for every account: ${PASSWORD}`);
