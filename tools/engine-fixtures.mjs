// Produces the test data that keeps decision-service's Java engine identical to the frontend's reference
// engine (frontend/src/services/decision/engine.ts and lib/recurrence.ts).
//
// It builds random families from a fixed seed, runs the TypeScript engine on each and writes the inputs
// and every result to backend/services/decision-service/src/test/resources/engine-fixtures.json.gz.
// DecisionEngineParityTest replays the same inputs through DecisionEngine.java and requires the same
// output, down to the wording of every reason.
//
//   node tools/engine-fixtures.mjs          (after changing a rule or a weight in either engine)
//
// The family time zone is Asia/Dhaka; the TypeScript engine uses the process time zone for "the same day",
// availability windows and weekly events, so the script runs in that zone.
process.env.TZ = 'Asia/Dhaka';

import { build } from '../frontend/node_modules/esbuild/lib/main.js';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'frontend/src');
const target = join(root, 'backend/services/decision-service/src/test/resources/engine-fixtures.json.gz');

const slash = (p) => p.replace(/\\/g, '/');

const dir = mkdtempSync(join(tmpdir(), 'hearth-engine-'));
const out = join(dir, 'engine.mjs');
await build({
  stdin: {
    contents: `export * from '${slash(join(src, 'services/decision/engine.ts'))}'; export * from '${slash(join(src, 'lib/recurrence.ts'))}';`,
    resolveDir: src,
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: out,
  alias: { '@': src },
  logLevel: 'silent',
});
const engine = await import(pathToFileURL(out).href);
rmSync(dir, { recursive: true, force: true });

/* ───────── seeded randomness ───────── */

let seed = 20261026;
function random() {
  // mulberry32
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (list) => list[Math.floor(random() * list.length)];
const chance = (p) => random() < p;
const int = (min, max) => min + Math.floor(random() * (max - min + 1));
let counter = 0;
const id = (prefix) => `${prefix}-${String(++counter).padStart(5, '0')}`;

const SKILLS = ['driving', 'medication', 'errands', 'meals', 'household', 'childcare', 'mobility', 'companionship', 'clinical'];
const CATEGORIES = ['medication', 'health', 'meals', 'errands', 'household', 'childcare', 'transport', 'study', 'work', 'exercise', 'family', 'other'];
const NAMES = ['Afsara Mannan', 'Rafid Mannan', 'Nazmun Nahar', 'Kamal Mannan', 'Shirin Akter', 'Tanvir Hasan', 'Mim'];
const REASONS = ['', 'Sick', 'Exam', 'Travelling', 'Work'];
const MIN = 60_000;
const HOUR = 3_600_000;
// Monday 19 Oct 2026, 10:30 in Dhaka.
const NOW = Date.parse('2026-10-19T04:30:00Z');

const at = (offsetMs) => {
  // Starts on a 15-minute boundary, like times picked in the app.
  const t = NOW + offsetMs;
  return new Date(t - (t % (15 * MIN))).toISOString();
};

function availability() {
  const days = Array.from({ length: 7 }, () => chance(0.75));
  if (!days.some(Boolean)) days[0] = true;
  const windows = chance(0.55)
    ? Array.from({ length: int(1, 2) }, (_, i) => {
        const startHour = pick([6, 8, 9, 13, 16, 17, 18]);
        const length = pick([2, 3, 4, 6]);
        const pad = (n) => String(Math.min(n, 23)).padStart(2, '0');
        return { id: `w${i}`, label: '', start: `${pad(startHour)}:${pick(['00', '30'])}`, end: `${pad(startHour + length)}:00` };
      })
    : [];
  return { days, windows };
}

function family() {
  const memberCount = int(2, 5);
  const names = [...NAMES].sort(() => random() - 0.5);
  const members = Array.from({ length: memberCount }, (_, i) => ({
    id: id('m'),
    name: names[i],
    relation: '',
    role: i === 0 ? 'lead' : chance(0.15) ? 'observer' : 'contributor',
    focus: '',
    email: '',
    status: i > 0 && chance(0.12) ? 'invited' : 'active',
    skills: SKILLS.filter(() => chance(0.3)),
    availability: availability(),
    access: { schedule: true, medical: false, documents: false },
    joinedAt: at(-30 * 24 * HOUR),
  }));
  const dependants = Array.from({ length: int(0, 2) }, () => id('dep'));
  const people = [...members.map((m) => m.id), ...dependants];
  const memberIds = members.map((m) => m.id);

  const appointments = Array.from({ length: int(0, 3) }, () => ({
    id: id('a'),
    title: pick(['Heart check-up', 'Dentist', 'Eye test', 'Physio']),
    specialty: '',
    start: at(int(-2, 96) * HOUR + int(0, 3) * 15 * MIN),
    durationMin: pick([30, 45, 60, 90]),
    provider: '',
    location: '',
    forId: pick(people),
    escortId: chance(0.6) ? pick(memberIds) : null,
    visibility: chance(0.2) ? 'private' : 'family',
    prep: [],
    note: '',
    createdById: pick(memberIds),
    createdAt: at(-48 * HOUR),
  }));

  const tasks = Array.from({ length: int(3, 10) }, () => {
    const visibility = chance(0.2) ? 'private' : 'family';
    const assigneeId = visibility === 'private' ? pick(memberIds) : chance(0.15) ? null : chance(0.05) ? 'm-gone' : pick(memberIds);
    const appointment = appointments.length && chance(0.25) ? pick(appointments) : null;
    return {
      id: id('t'),
      title: pick(['Buy rice', 'Give medicine', 'Drive to clinic', 'Cook dinner', 'Pick up Ayaan', 'Pay bills', 'Study', 'Gym']),
      notes: '',
      category: pick(CATEGORIES),
      priority: pick(['routine', 'important', 'urgent']),
      status: chance(0.85) ? 'scheduled' : pick(['completed', 'cancelled']),
      // Times cluster on a few hours, so clashes and ties are common enough to test.
      start: at(pick([-1, 1, 2, 3, 5, 8, 9, 26, 27, 50, 75]) * HOUR + pick([0, 0, 15, 30]) * MIN),
      durationMin: pick([15, 30, 45, 60, 60, 90, 120, 180]),
      assigneeId,
      forId: chance(0.3) ? pick(people) : undefined,
      visibility,
      createdById: visibility === 'private' && chance(0.7) ? assigneeId : pick(memberIds),
      createdAt: at(-24 * HOUR),
      appointmentId: appointment?.id,
      reminder: false,
      acknowledgedConflict: chance(0.08) ? pick(['unassigned', 'overlap', 'outside-availability', 'reported-unavailable']) : undefined,
    };
  });

  // Near-identical twins score the same, so every tie-break rule gets exercised.
  for (const original of tasks.filter(() => chance(0.35))) {
    const twin = { ...original, id: id('t'), title: original.title + ' (2)' };
    const vary = int(0, 4);
    if (vary === 1) twin.start = new Date(Date.parse(original.start) + 15 * MIN).toISOString();
    if (vary === 2) twin.durationMin = original.durationMin === 15 ? 30 : 15;
    if (vary === 3) twin.appointmentId = undefined;
    tasks.push(twin);
  }

  const unavailability = Array.from({ length: int(0, 3) }, () => {
    const start = at(pick([0, 1, 2, 7, 25, 48]) * HOUR);
    return { id: id('u'), memberId: pick(memberIds), start, end: new Date(Date.parse(start) + int(1, 12) * HOUR).toISOString(), reason: pick(REASONS), note: '', createdAt: at(-HOUR) };
  });

  const events = Array.from({ length: int(0, 3) }, () => {
    const weekly = chance(0.6);
    const days = Array.from({ length: 7 }, () => chance(0.4));
    if (weekly && !days.some(Boolean)) days[int(0, 6)] = true;
    return {
      id: id('ev'),
      memberId: pick(memberIds),
      title: pick(['Data Structures', 'Work shift', 'Gym', 'Tuition']),
      kind: pick(['class', 'work', 'personal']),
      start: at(pick([-7 * 24, -24, 1, 2, 8, 26]) * HOUR + pick([0, 30]) * MIN),
      durationMin: pick([60, 90, 120, 240]),
      repeat: weekly ? 'weekly' : 'none',
      days: weekly ? days : [false, false, false, false, false, false, false],
      until: weekly && chance(0.4) ? at(int(1, 20) * 24 * HOUR) : undefined,
      location: '',
      visibility: chance(0.5) ? 'busy' : 'details',
      createdAt: at(-60 * 24 * HOUR),
    };
  });

  return { members, dependants, tasks, appointments, unavailability, events, viewerId: pick(memberIds) };
}

/* ───────── run the reference engine ───────── */

const cases = [];
for (let n = 0; n < 100; n++) {
  const f = family();
  const busy = engine.expandEvents(f.events, NOW - engine.BUSY_LOOKBACK_MS, NOW + engine.BUSY_HORIZON_MS);
  const data = {
    tasks: f.tasks,
    appointments: f.appointments,
    members: f.members,
    unavailability: f.unavailability,
    busy,
    calendarOwners: Array.from(new Set(f.events.map((e) => e.memberId))),
    viewerId: f.viewerId,
  };
  const conflicts = engine.detectConflicts(data, NOW);
  const byTask = new Map(conflicts.map((c) => [c.taskId, c]));
  const target = pick(f.tasks);
  const change = { taskId: target.id };
  if (chance(0.7)) change.assigneeId = chance(0.15) ? null : pick(f.members).id;
  if (chance(0.5) || !('assigneeId' in change)) change.start = at(int(0, 72) * HOUR);

  cases.push({
    input: { ...f, now: new Date(NOW).toISOString() },
    expected: {
      busy,
      conflicts,
      candidates: Object.fromEntries(f.tasks.map((t) => [t.id, engine.scoreCandidates(t, data)])),
      priority: Object.fromEntries(f.tasks.map((t) => [t.id, engine.priorityScore(t, data, byTask.get(t.id), NOW)])),
      ranked: Object.fromEntries(f.members.map((m) => [m.id, engine.rankTasks(m.id, data, NOW)])),
      simulation: { change, result: engine.simulate(change, data, NOW) },
      dayLoad: Object.fromEntries(f.members.map((m) => [m.id, engine.dayLoadMinutes(m.id, NOW, data)])),
    },
  });
}

// Compressed: about 2 MB of JSON becomes about 150 kB.
writeFileSync(target, gzipSync(JSON.stringify({ timezone: 'Asia/Dhaka', generatedBy: 'tools/engine-fixtures.mjs', cases }), { level: 9 }));
console.log(`wrote ${cases.length} cases to ${target.replace(root + '/', '')}`);
