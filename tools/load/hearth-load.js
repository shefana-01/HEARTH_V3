// Load test for a running Hearth (k6, https://k6.io). Each virtual user plays one family member: opens
// My day, the task list, the week and the notification badge, and sometimes adds and completes a task.
//
//   docker run --rm -i --network host grafana/k6 run - < tools/load/hearth-load.js
//   docker run --rm -i --network host -e BASE=http://localhost:8000 -e PEAK=50 grafana/k6 run - < tools/load/hearth-load.js
//
// BASE: the web app's address (default http://localhost:8000). PEAK: the most users at once (default 30).
// FAMILIES: how many families to create first (default 10; sign-up is rate-limited to 20 a minute per address).
// The run fails if more than 1% of requests fail or the 95th percentile is above 800 ms.
import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const BASE = (__ENV.BASE || 'http://localhost:8000').replace(/\/$/, '');
const API = `${BASE}/api/v1`;
const PEAK = Number(__ENV.PEAK || 30);
const FAMILIES = Number(__ENV.FAMILIES || 10);

const myDay = new Trend('hearth_my_day_ms', true);
const createTask = new Trend('hearth_create_task_ms', true);

export const options = {
  scenarios: {
    family_members: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: PEAK },
        { duration: '2m', target: PEAK },
        { duration: '20s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<800'],
    hearth_my_day_ms: ['p(95)<800'],
  },
};

const json = (token) => ({ headers: { 'Content-Type': 'application/json', Accept: 'application/json', Origin: BASE, ...(token ? { Authorization: `Bearer ${token}` } : {}) } });

export function setup() {
  const run = Date.now().toString(36);
  const families = [];
  for (let i = 0; i < FAMILIES; i++) {
    const email = `load.${run}.${i}@example.com`;
    const signUp = http.post(`${API}/auth/sign-up`, JSON.stringify({ name: `Load Tester ${i}`, email, password: 'Sunrise#2026' }), json(''));
    check(signUp, { 'signed up': (r) => r.status === 201 });
    const token = signUp.json('token');
    const family = http.post(
      `${API}/family`,
      JSON.stringify({
        name: `Load family ${run} ${i}`,
        location: 'Dhaka',
        myRelation: 'Parent',
        dependants: [{ name: 'Grandma', relation: 'Grandmother', notes: '' }],
        invites: [],
        availability: { days: [true, true, true, true, true, true, true], windows: [] },
        timezone: 'Asia/Dhaka',
      }),
      json(token),
    );
    check(family, { 'family created': (r) => r.status === 201 });
    const me = http.get(`${API}/auth/session`, json(token)).json('account.memberId');
    // A realistic starting plan: a dozen tasks over the next week.
    for (let t = 0; t < 12; t++) {
      http.post(`${API}/tasks`, JSON.stringify(task(me, t)), json(token));
    }
    families.push({ token, me });
  }
  return { families };
}

function task(assigneeId, n) {
  const categories = ['errands', 'meals', 'household', 'health', 'medication', 'transport'];
  return {
    title: `Load task ${n}`,
    notes: '',
    category: categories[n % categories.length],
    priority: n % 5 === 0 ? 'urgent' : n % 2 ? 'important' : 'routine',
    start: new Date(Date.now() + (n + 1) * 3 * 3600 * 1000).toISOString(),
    durationMin: 30 + (n % 4) * 15,
    assigneeId,
    visibility: 'family',
    reminder: false,
  };
}

export default function (data) {
  const { token, me } = data.families[(__VU - 1) % data.families.length];
  const auth = json(token);

  group('open My day', () => {
    const day = http.get(`${API}/decisions/my-day`, auth);
    myDay.add(day.timings.duration);
    check(day, { 'my day 200': (r) => r.status === 200 });
    check(http.get(`${API}/notifications/unread-count`, auth), { 'badge 200': (r) => r.status === 200 });
  });
  sleep(1);

  group('browse tasks and the week', () => {
    check(http.get(`${API}/tasks`, auth), { 'tasks 200': (r) => r.status === 200 });
    const from = new Date().toISOString();
    const to = new Date(Date.now() + 7 * 86400000).toISOString();
    check(http.get(`${API}/schedule/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, auth), { 'week 200': (r) => r.status === 200 });
    check(http.get(`${API}/decisions/attention`, auth), { 'attention 200': (r) => r.status === 200 });
  });
  sleep(1);

  if (Math.random() < 0.2) {
    group('add and complete a task', () => {
      const created = http.post(`${API}/tasks`, JSON.stringify(task(me, Math.floor(Math.random() * 40))), auth);
      createTask.add(created.timings.duration);
      if (check(created, { 'task created': (r) => r.status === 201 })) {
        check(http.post(`${API}/tasks/${created.json('id')}/complete`, null, auth), { 'task completed': (r) => r.status === 200 });
      }
    });
  }
  sleep(1 + Math.random() * 2);
}
