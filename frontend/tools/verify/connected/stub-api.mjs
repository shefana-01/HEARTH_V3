// A small in-memory stand-in for the Hearth API gateway, written from the backend's REST contract
// (paths, methods, status codes, error format, who may see what). It is NOT the backend: it exists so
// the frontend's connected mode (token handling, refresh, 204s, uploads, error messages, polling) can
// be exercised in a browser with more than one signed-in person.
//
// The decision answers come from the frontend's own reference engine, bundled on start, because the
// backend's engine is a line-by-line port of it (see backend/README.md, "The decision engine").
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const frontend = resolve(here, '../../..');
const bundle = resolve(here, '.reference.mjs');
execFileSync(resolve(frontend, 'node_modules/.bin/esbuild'), ['--bundle', '--format=esm', '--platform=node', '--alias:@=./src', '--log-level=error', `--outfile=${bundle}`], {
  cwd: frontend,
  input: `export * from './src/services/decision/engine.ts';
export { expandEvents } from './src/lib/recurrence.ts';
export { HEALTH_CONDITIONS } from './src/constants/conditions.ts';
export { NUTRITION_TAG_LABELS } from './src/constants/labels.ts';
export { foodOptions } from './src/mocks/foods.ts';`,
});
const ref = await import(pathToFileURL(bundle).href);

const PORT = Number(process.env.PORT ?? 8099);
const TOKEN_USES = Number(process.env.TOKEN_USES ?? 12); // an access token "expires" after this many requests
const db = {
  accounts: [],
  access: new Map(),
  refresh: new Map(),
  families: new Map(),
  members: [],
  tasks: [],
  events: [],
  away: [],
  appointments: [],
  health: [],
  groceries: [],
  documents: [],
  requests: [],
  messages: [],
  reads: [], // { memberId, channel, at }
  notifications: [], // { …, familyId, actorId, forId?, readBy: Set, hiddenFor: Set }
  audit: [],
};
const stats = { requests: 0, refreshes: 0, unauthorized: 0 };
// Emails the backend would send. GET /__emails?to= lets a test read the link, like opening the inbox.
const emails = [];
const linkTokens = new Map(); // token → { id, purpose }
const sendLink = (account, purpose) => {
  for (const [t, v] of linkTokens) if (v.id === account.id && v.purpose === purpose) linkTokens.delete(t);
  const token = randomUUID();
  linkTokens.set(token, { id: account.id, purpose });
  emails.push({ to: account.email, purpose, token });
};
const newCode = () => 'HEARTH-' + randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
const now = () => new Date().toISOString();
const MIN = 60_000;

const problem = (res, status, detail) => send(res, status, { type: 'about:blank', title: 'Error', status, detail }, 'application/problem+json');
const gone = (res, what) => problem(res, 404, `${what} could not be found. It may have been removed.`);
function send(res, status, body, type = 'application/json') {
  res.writeHead(status, { 'Content-Type': type, 'Access-Control-Allow-Origin': '*' });
  res.end(body === undefined ? '' : JSON.stringify(body));
}
const issue = (account) => {
  const token = randomUUID(),
    refreshToken = randomUUID();
  db.access.set(token, { id: account.id, uses: 0 });
  db.refresh.set(refreshToken, account.id);
  return { token, refreshToken, expiresIn: 1800, session: session(account) };
};
const memberOf = (account) => db.members.find((m) => m.accountId === account.id);
const accountView = (a) => ({
  id: a.id,
  memberId: memberOf(a)?.id ?? null,
  name: a.name,
  email: a.email,
  ...(a.phone ? { phone: a.phone } : {}),
  about: a.about,
  ...(a.photo ? { photo: a.photo } : {}),
  whatsappAlerts: a.whatsappAlerts,
  emailVerified: a.emailVerified,
});
const session = (a) => ({ account: accountView(a), hasFamily: Boolean(memberOf(a)), isSample: false });
const memberView = ({ accountId: _a, familyId: _f, ...m }) => m;
const newMember = (familyId, o) => ({
  id: randomUUID(),
  familyId,
  accountId: null,
  relation: '',
  focus: '',
  status: 'invited',
  skills: [],
  availability: { days: [true, true, true, true, true, true, true], windows: [] },
  access: { schedule: true, medical: false, documents: false },
  joinedAt: now(),
  ...o,
});

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks);
  if ((req.headers['content-type'] ?? '').startsWith('multipart/form-data')) return { multipart: raw };
  return raw.length ? JSON.parse(raw.toString()) : undefined;
}

http
  .createServer(async (req, res) => {
    stats.requests++;
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization,Content-Type,Accept',
        'Access-Control-Max-Age': '3600',
      });
      return res.end();
    }
    const url = new URL(req.url, 'http://x');
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const m = req.method;
    if (path === '/__stats') return send(res, 200, stats);
    if (path === '/__emails')
      return send(
        res,
        200,
        emails.filter((e) => !url.searchParams.get('to') || e.to === url.searchParams.get('to')),
      );
    let body;
    try {
      body = await readBody(req);
    } catch {
      return problem(res, 400, 'The request could not be read. Check the values and try again.');
    }
    const is = (method, re) => m === method && (re instanceof RegExp ? path.match(re) : path === re);

    // ── public ──
    if (is('POST', '/auth/sign-up')) {
      if (db.accounts.some((a) => a.email.toLowerCase() === body.email.toLowerCase())) return problem(res, 409, 'An account with this email already exists. Sign in instead.');
      const a = { id: randomUUID(), name: body.name, email: body.email, password: body.password, about: '', whatsappAlerts: false, emailVerified: false };
      db.accounts.push(a);
      sendLink(a, 'verify');
      return send(res, 201, issue(a));
    }
    if (is('POST', '/auth/sign-in')) {
      const a = db.accounts.find((x) => x.email.toLowerCase() === body.email.toLowerCase() && x.password === body.password);
      return a ? send(res, 200, issue(a)) : problem(res, 401, 'That email and password don’t match an account.');
    }
    if (is('POST', '/auth/refresh')) {
      // Like the backend: a used refresh token keeps working for 60 s (grace period), then stops.
      const id = db.refresh.get(body.refreshToken);
      if (!id) return problem(res, 401, 'Your session has expired. Sign in again.');
      const used = body.refreshToken;
      setTimeout(() => db.refresh.delete(used), 60_000).unref();
      stats.refreshes++;
      return send(res, 200, issue(db.accounts.find((a) => a.id === id)));
    }
    if (is('POST', '/auth/sign-out')) {
      db.refresh.delete(body.refreshToken);
      return send(res, 204);
    }
    if (is('POST', '/auth/password-reset')) {
      const a = db.accounts.find((x) => x.email.toLowerCase() === body.email.toLowerCase());
      if (a) sendLink(a, 'reset');
      return send(res, 202);
    }
    if (is('POST', '/auth/verify-email') || is('POST', '/auth/password-reset/confirm')) {
      const purpose = path === '/auth/verify-email' ? 'verify' : 'reset';
      const link = linkTokens.get(body.token);
      if (!link || link.purpose !== purpose) return problem(res, 400, 'This link has expired or was already used. Ask for a new one.');
      linkTokens.delete(body.token);
      const a = db.accounts.find((x) => x.id === link.id);
      a.emailVerified = true;
      if (purpose === 'reset') {
        a.password = body.password;
        for (const [t, id] of db.refresh) if (id === a.id) db.refresh.delete(t);
      }
      return send(res, 204);
    }

    // ── everything else needs a valid, unexpired token ──
    const grant = db.access.get((req.headers.authorization ?? '').replace('Bearer ', ''));
    let x;
    if ((x = is('GET', /^\/invites\/([^/]+)$/))) {
      const fam = [...db.families.values()].find((f) => f.inviteCode === x[1]);
      if (!fam) return problem(res, 404, 'We couldn’t find a family with that code. Check it with the person who invited you.');
      return send(res, 200, { family: fam, inviterName: db.members.find((mm) => mm.familyId === fam.id && mm.role === 'lead').name, memberCount: 1, alreadyMember: false });
    }
    if (!grant || ++grant.uses > TOKEN_USES) {
      stats.unauthorized++;
      res.writeHead(401, { 'WWW-Authenticate': 'Bearer', 'Access-Control-Allow-Origin': '*' });
      return res.end();
    }
    const account = db.accounts.find((a) => a.id === grant.id);
    const me = memberOf(account);
    const fam = me && db.families.get(me.familyId);
    const mine = (list) => list.filter((i) => i.familyId === me.familyId);
    const strip = ({ familyId: _f, ...rest }) => rest;

    if (is('GET', '/auth/session')) return send(res, 200, session(account));
    if (is('POST', '/auth/verify-email/resend')) {
      if (!account.emailVerified) sendLink(account, 'verify');
      return send(res, 202);
    }
    if ((x = is('POST', /^\/invites\/([^/]+)\/accept$/))) {
      const target = [...db.families.values()].find((f) => f.inviteCode === x[1]);
      if (!target) return problem(res, 404, 'We couldn’t find a family with that code. Check it with the person who invited you.');
      if (!account.emailVerified) return problem(res, 403, `Confirm your email address first. We sent a link to ${account.email}.`);
      const invited = db.members.find((i) => i.familyId === target.id && !i.accountId && i.email.toLowerCase() === account.email.toLowerCase());
      if (!invited) return problem(res, 403, `This invitation was sent to a different email address. Ask the organiser to invite ${account.email}.`);
      Object.assign(invited, { accountId: account.id, status: 'active', name: account.name });
      return send(res, 200, target);
    }
    if (is('GET', '/account')) return send(res, 200, accountView(account));
    if (is('PATCH', '/account')) {
      for (const [k, v] of Object.entries(body)) {
        if (v === null) delete account[k];
        else account[k] = v;
      }
      if (me) Object.assign(me, { name: account.name, email: account.email, phone: account.phone, photo: account.photo });
      return send(res, 200, accountView(account));
    }
    if (is('GET', '/family')) return fam ? send(res, 200, fam) : send(res, 204);
    if (is('POST', '/family')) {
      if (!body.name?.trim())
        return send(res, 400, { title: 'Validation failed', status: 400, detail: 'Enter a family name.', fieldErrors: { name: 'Enter a family name.' } }, 'application/problem+json');
      const f = {
        id: randomUUID(),
        name: body.name,
        location: body.location ?? '',
        timezone: body.timezone ?? 'UTC',
        createdAt: now(),
        dependants: (body.dependants ?? []).filter((d) => d.name?.trim()).map((d) => ({ id: randomUUID(), relation: '', notes: '', ...d })),
        inviteCode: newCode(),
      };
      db.families.set(f.id, f);
      db.members.push(
        newMember(f.id, {
          accountId: account.id,
          name: account.name,
          email: account.email,
          role: 'lead',
          status: 'active',
          relation: body.myRelation ?? '',
          availability: body.availability,
          access: { schedule: true, medical: true, documents: true },
        }),
      );
      for (const inv of body.invites ?? []) {
        db.members.push(newMember(f.id, inv));
        emails.push({ to: inv.email, purpose: 'invitation', code: f.inviteCode });
      }
      return send(res, 201, f);
    }
    if (!me) return problem(res, 409, 'Set up your family space first.');

    // ── helpers that need the caller ──
    const members = mine(db.members);
    const isLead = me.role === 'lead';
    const medical = isLead || me.access.medical;
    const first = (id) => (members.find((p) => p.id === id)?.name ?? 'Someone').split(' ')[0];
    const personName = (id) => members.find((p) => p.id === id)?.name ?? fam.dependants.find((d) => d.id === id)?.name ?? 'Someone';
    const isDependant = (id) => fam.dependants.some((d) => d.id === id);
    const seesTask = (t) => t.visibility === 'family' || t.assigneeId === me.id || t.createdById === me.id;
    const seesAppt = (a) => a.visibility === 'family' || a.forId === me.id || a.escortId === me.id || a.createdById === me.id;
    const seesHealth = (id) => id === me.id || (medical && (isDependant(id) || Boolean(mine(db.health).find((h) => h.personId === id)?.shared)));
    const task = (id) => mine(db.tasks).find((t) => t.id === id && seesTask(t));
    const notify = (type, message, href, forId) =>
      db.notifications.push({ id: randomUUID(), familyId: me.familyId, actorId: me.id, type, message, href, forId, createdAt: now(), readBy: new Set(), hiddenFor: new Set() });
    const log = (category, action, subject, before, after) =>
      db.audit.push({ id: randomUUID(), familyId: me.familyId, actorId: me.id, category, action, subject, at: now(), ...(before ? { before } : {}), ...(after ? { after } : {}) });
    const say = (kind, text, authorId = null) => db.messages.push({ id: randomUUID(), familyId: me.familyId, channel: 'family', authorId, kind, text, createdAt: now() });
    /** Everything the reference engine needs, through the caller's eyes (like decision-service's PlanningData). */
    const plan = () => {
      const t = Date.now();
      const events = mine(db.events);
      return {
        tasks: mine(db.tasks).map(strip),
        appointments: mine(db.appointments).map(strip),
        members: members.map(memberView),
        unavailability: mine(db.away).map(strip),
        busy: ref.expandEvents(events.map(strip), t - 86_400_000, t + 45 * 86_400_000),
        calendarOwners: [...new Set(events.map((e) => e.memberId))],
        viewerId: me.id,
      };
    };
    const openRequest = (taskId) => mine(db.requests).find((r) => r.taskId === taskId && r.status === 'open');
    const ask = (t, reason, note = '', from = me.id) => {
      const existing = openRequest(t.id);
      if (existing) return existing;
      const r = { id: randomUUID(), familyId: me.familyId, taskId: t.id, fromMemberId: t.assigneeId, reason, note, createdAt: now(), createdById: from, status: 'open' };
      db.requests.push(r);
      return r;
    };

    if (is('PATCH', '/family')) {
      if (!isLead) return problem(res, 403, 'Only the organiser can change these details.');
      for (const [k, v] of Object.entries(body)) {
        if (v === null) delete fam[k];
        else fam[k] = v;
      }
      return send(res, 200, fam);
    }
    if (is('POST', '/family/dependants')) {
      if (!body.name?.trim()) return problem(res, 422, 'Enter their name.');
      const d = { id: randomUUID(), relation: '', notes: '', ...body };
      fam.dependants.push(d);
      return send(res, 201, d);
    }
    if ((x = path.match(/^\/family\/dependants\/([^/]+)$/))) {
      const d = fam.dependants.find((i) => i.id === x[1]);
      if (!d) return gone(res, 'That person');
      if (m === 'PUT') return send(res, 200, Object.assign(d, body));
      if (mine(db.appointments).some((a) => a.forId === d.id && new Date(a.start).getTime() > Date.now()))
        return problem(res, 409, `${d.name} still has upcoming appointments. Remove or move those first.`);
      fam.dependants = fam.dependants.filter((i) => i.id !== d.id);
      db.health = db.health.filter((h) => h.personId !== d.id);
      return send(res, 204);
    }
    if (is('GET', '/members')) return send(res, 200, members.map(memberView));
    if (is('POST', '/members')) {
      if (members.some((i) => i.email.toLowerCase() === body.email.toLowerCase())) return problem(res, 409, 'Someone with this email is already in your family.');
      const mm = newMember(me.familyId, body);
      db.members.push(mm);
      emails.push({ to: mm.email, purpose: 'invitation', code: fam.inviteCode });
      return send(res, 201, memberView(mm));
    }
    if ((x = path.match(/^\/members\/([^/]+)(?:\/(availability|status))?$/))) {
      const mm = members.find((i) => i.id === x[1]);
      if (!mm) return gone(res, 'That family member');
      if (x[2] === 'availability') {
        if (m === 'PUT') mm.availability = body;
        return send(res, 200, mm.availability);
      }
      if (x[2] === 'status') {
        if (mm.id !== me.id) return problem(res, 403, 'You can only change your own status.');
        if (!body.text?.trim()) delete mm.statusNote;
        else {
          mm.statusNote = { text: body.text.trim().slice(0, 80), ...(body.until ? { until: body.until } : {}), updatedAt: now() };
          say('status', mm.statusNote.text, me.id);
        }
        return send(res, 200, memberView(mm));
      }
      if (m === 'PATCH') {
        for (const [k, v] of Object.entries(body)) {
          if (v === null) delete mm[k];
          else mm[k] = v;
        }
      }
      if (m === 'DELETE') {
        if (mm.role === 'lead') return problem(res, 409, 'The organiser cannot be removed.');
        db.members.splice(db.members.indexOf(mm), 1);
        return send(res, 204);
      }
      return send(res, 200, memberView(mm));
    }

    // ── tasks: shared, or private to their owner ──
    if (is('GET', '/tasks')) {
      const q = url.searchParams;
      return send(
        res,
        200,
        mine(db.tasks)
          .filter((t) => seesTask(t) && (q.get('includeCancelled') === 'true' || t.status !== 'cancelled') && (!q.get('assigneeId') || t.assigneeId === q.get('assigneeId')))
          .sort((a, b) => a.start.localeCompare(b.start))
          .map(strip),
      );
    }
    const taskFields = (b) => ({ ...b, assigneeId: b.visibility === 'private' ? me.id : (b.assigneeId ?? null) });
    if (is('POST', '/tasks')) {
      if (!body.title?.trim()) return send(res, 400, { status: 400, detail: 'Enter a title.', fieldErrors: { title: 'Enter a title.' } }, 'application/problem+json');
      if (!['family', 'private'].includes(body.visibility))
        return send(res, 400, { status: 400, detail: 'Choose who can see this task.', fieldErrors: { visibility: 'Choose who can see this task.' } }, 'application/problem+json');
      const t = { ...taskFields(body), id: randomUUID(), familyId: me.familyId, status: 'scheduled', createdById: me.id, createdAt: now() };
      db.tasks.push(t);
      if (t.visibility === 'family') {
        log('tasks', 'Created a task', t.title);
        if (t.assigneeId && t.assigneeId !== me.id) notify('task', `${first(me.id)} asked you to do “${t.title}”.`, `/tasks/${t.id}`, t.assigneeId);
      }
      return send(res, 201, strip(t));
    }
    if ((x = path.match(/^\/tasks\/([^/]+)(?:\/(complete|reopen|assignee))?$/))) {
      const t = task(x[1]);
      if (!t) return gone(res, 'That task');
      if (m === 'DELETE') {
        t.status = 'cancelled';
        mine(db.requests).forEach((r) => r.taskId === t.id && r.status === 'open' && (r.status = 'cancelled'));
        return send(res, 204);
      }
      if (m === 'PUT' && x[2] === 'assignee') {
        if (t.visibility === 'private') return problem(res, 422, 'A private task can’t be given to someone else. Share it with the family first.');
        t.assigneeId = body.memberId;
        delete t.acknowledgedConflict;
        if (body.memberId && body.memberId !== me.id) notify('task', `${first(me.id)} asked you to do “${t.title}”.`, `/tasks/${t.id}`, body.memberId);
      } else if (m === 'PUT') {
        Object.assign(t, taskFields(body));
        delete t.acknowledgedConflict;
      }
      if (x[2] === 'complete') Object.assign(t, { status: 'completed', completedAt: now(), completedById: me.id });
      if (x[2] === 'reopen') {
        t.status = 'scheduled';
        delete t.completedAt;
        delete t.completedById;
      }
      return send(res, 200, strip(t));
    }

    // ── personal events: full for their owner, masked when shown as busy ──
    const eventFor = (e) => (e.memberId === me.id || e.visibility === 'details' ? strip(e) : { ...strip(e), title: 'Busy', location: '' });
    if (is('GET', '/events')) {
      const owner = url.searchParams.get('memberId') ?? me.id;
      return send(
        res,
        200,
        mine(db.events)
          .filter((e) => e.memberId === owner)
          .map(eventFor)
          .sort((a, b) => a.start.localeCompare(b.start)),
      );
    }
    if (is('POST', '/events')) {
      if (!body.title?.trim()) return problem(res, 422, 'Give the event a name.');
      if (body.repeat === 'weekly' && !body.days?.some(Boolean)) return problem(res, 422, 'Choose at least one day of the week.');
      const e = { ...body, id: randomUUID(), familyId: me.familyId, memberId: me.id, createdAt: now() };
      db.events.push(e);
      return send(res, 201, strip(e));
    }
    if ((x = path.match(/^\/events\/([^/]+)$/))) {
      const e = mine(db.events).find((i) => i.id === x[1]);
      if (!e) return gone(res, 'That event');
      if (m === 'GET') return send(res, 200, eventFor(e));
      if (e.memberId !== me.id) return gone(res, 'That event');
      if (m === 'DELETE') {
        db.events.splice(db.events.indexOf(e), 1);
        return send(res, 204);
      }
      return send(res, 200, strip(Object.assign(e, body)));
    }

    // ── time away: shared tasks in that time get a handover request ──
    if (is('GET', '/unavailability'))
      return send(
        res,
        200,
        mine(db.away)
          .filter((u) => !url.searchParams.get('memberId') || u.memberId === url.searchParams.get('memberId'))
          .map(strip),
      );
    if (is('POST', '/unavailability')) {
      const start = new Date(body.start).getTime(),
        end = new Date(body.end).getTime();
      if (!(end > start)) return problem(res, 422, 'The end time must be after the start time.');
      const u = { ...body, id: randomUUID(), familyId: me.familyId, memberId: me.id, createdAt: now() };
      db.away.push(u);
      const inWindow = mine(db.tasks).filter(
        (t) => t.assigneeId === me.id && t.status === 'scheduled' && new Date(t.start).getTime() < end && new Date(t.start).getTime() + t.durationMin * MIN > start,
      );
      const shared = inWindow.filter((t) => t.visibility === 'family');
      // The backend opens the requests a moment later, from a Kafka consumer; the browser waits for them.
      setTimeout(() => shared.forEach((t) => ask(t, body.reason ? `${first(me.id)} is unavailable (${body.reason.toLowerCase()}).` : `${first(me.id)} is unavailable.`, body.note)), 300);
      notify('availability', `${first(me.id)} can’t make it.`, '/priority');
      return send(res, 201, {
        unavailability: strip(u),
        affectedTaskIds: shared.map((t) => t.id),
        requestIds: [],
        personalTaskIds: inWindow.filter((t) => t.visibility === 'private').map((t) => t.id),
      });
    }
    if ((x = is('DELETE', /^\/unavailability\/([^/]+)$/))) {
      db.away = db.away.filter((u) => u.id !== x[1]);
      return send(res, 204);
    }

    // ── decisions: the reference engine, exactly as decision-service's port of it ──
    const attention = () => {
      const d = plan();
      return ref
        .detectConflicts(d)
        .map((conflict) => ({ conflict, task: d.tasks.find((t) => t.id === conflict.taskId) }))
        .filter((i) => i.task.visibility === 'family')
        .map((i) => ({ ...i, priority: ref.priorityScore(i.task, d, i.conflict), topCandidate: ref.scoreCandidates(i.task, d)[0], openRequestId: openRequest(i.task.id)?.id }))
        .sort(ref.compareByPriority);
    };
    if (is('GET', '/decisions/attention')) return send(res, 200, attention());
    if (is('GET', '/decisions/my-day')) return send(res, 200, ref.rankTasks(me.id, plan()));
    if (is('GET', '/decisions/weights')) return send(res, 200, { priority: ref.PRIORITY_WEIGHTS, suitability: ref.SUITABILITY_WEIGHTS });
    if ((x = path.match(/^\/decisions\/tasks\/([^/]+)\/(insight|acknowledge)$/))) {
      const t = task(x[1]);
      if (!t) return gone(res, 'That task');
      const d = plan();
      const conflict = ref.detectConflicts(d).find((c) => c.taskId === t.id);
      if (x[2] === 'acknowledge') {
        if (conflict) t.acknowledgedConflict = conflict.kind;
        return send(res, 204);
      }
      return send(res, 200, {
        ...(conflict ? { conflict } : {}),
        priority: ref.priorityScore(strip(t), d, conflict),
        candidates: ref.scoreCandidates(strip(t), d),
        openRequestId: openRequest(t.id)?.id,
      });
    }
    if (is('POST', '/decisions/candidates/preview')) {
      const draft = {
        id: body.taskId ?? 'draft',
        title: 'Draft',
        notes: '',
        category: body.category,
        priority: 'routine',
        status: 'scheduled',
        start: body.start,
        durationMin: body.durationMin,
        assigneeId: null,
        visibility: 'family',
        createdById: me.id,
        createdAt: now(),
        reminder: false,
      };
      return send(res, 200, ref.scoreCandidates(draft, plan()));
    }
    if (is('POST', '/decisions/simulations')) {
      if (!task(body.taskId)) return gone(res, 'That task');
      return send(res, 200, ref.simulate(body, plan()));
    }
    if (is('POST', '/decisions/simulations/apply')) {
      const t = task(body.taskId);
      if (!t) return gone(res, 'That task');
      if (t.visibility === 'private' && body.assigneeId !== undefined && body.assigneeId !== t.assigneeId) return problem(res, 422, 'A private task can’t be given to someone else.');
      if (body.assigneeId !== undefined) t.assigneeId = body.assigneeId;
      if (body.start) t.start = body.start;
      delete t.acknowledgedConflict;
      return send(res, 200, strip(t));
    }
    const requestView = ({ familyId: _f, ...r }) => r;
    if (is('GET', '/reassignment-requests'))
      return send(
        res,
        200,
        mine(db.requests)
          .map((r) => ({ ...requestView(r), taskTitle: db.tasks.find((t) => t.id === r.taskId)?.title ?? 'Removed task', taskStart: db.tasks.find((t) => t.id === r.taskId)?.start ?? r.createdAt }))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      );
    if (is('POST', '/reassignment-requests')) {
      const t = task(body.taskId);
      if (!t) return gone(res, 'That task');
      if (t.visibility === 'private') return problem(res, 422, 'A private task can’t be handed over. Share it with the family first.');
      return send(res, 201, requestView(ask(t, body.reason, body.note)));
    }
    if ((x = path.match(/^\/reassignment-requests\/([^/]+)(?:\/(approve|cancel))?$/))) {
      const r = mine(db.requests).find((i) => i.id === x[1]);
      const t = r && db.tasks.find((i) => i.id === r.taskId);
      if (!r || !t) return gone(res, 'That handover request');
      if (!x[2]) {
        const d = plan();
        const conflict = ref.detectConflicts(d).find((c) => c.taskId === t.id);
        return send(res, 200, { request: requestView(r), task: strip(t), candidates: ref.scoreCandidates({ ...strip(t), assigneeId: r.fromMemberId }, d), ...(conflict ? { conflict } : {}) });
      }
      if (x[2] === 'cancel') {
        Object.assign(r, { status: 'cancelled', resolvedAt: now() });
        return send(res, 204);
      }
      if (r.status !== 'open') return problem(res, 409, 'This request has already been settled.');
      if (!(isLead || me.id === r.fromMemberId || me.id === r.createdById || me.id === body.memberId))
        return problem(res, 403, 'Only the organiser, the person handing the task over, or the person taking it can confirm this.');
      t.assigneeId = body.memberId;
      delete t.acknowledgedConflict;
      Object.assign(r, { status: 'approved', approvedMemberId: body.memberId, resolvedAt: now() });
      const line = r.fromMemberId ? `${first(body.memberId)} took over “${t.title}” from ${first(r.fromMemberId)}.` : `${first(body.memberId)} picked up “${t.title}”.`;
      notify('reassignment', line, `/tasks/${t.id}`);
      log('tasks', 'Handed over a task', t.title, personName(r.fromMemberId), personName(body.memberId));
      say('system', line);
      return send(res, 200, requestView(r));
    }
    if (is('GET', '/schedule/events')) {
      const from = new Date(url.searchParams.get('from')).getTime(),
        to = new Date(url.searchParams.get('to')).getTime();
      if (Number.isNaN(from) || Number.isNaN(to)) return problem(res, 400, '"from" and "to" must be date-times like 2026-10-05T00:00:00Z.');
      const within = (iso) => new Date(iso).getTime() >= from && new Date(iso).getTime() < to;
      const clashing = new Set(ref.detectConflicts(plan()).map((c) => c.taskId));
      const busy = (id, memberId, start, end) => ({ id, kind: 'busy', title: 'Busy', start, end, memberId });
      const endOf = (start, minutes) => new Date(new Date(start).getTime() + minutes * MIN).toISOString();
      return send(
        res,
        200,
        [
          ...mine(db.tasks)
            .filter((t) => t.status !== 'cancelled' && within(t.start))
            .map((t) =>
              seesTask(t)
                ? {
                    id: t.id,
                    kind: t.status === 'completed' ? 'completed' : clashing.has(t.id) ? 'conflict' : 'task',
                    title: t.title,
                    subtitle: t.visibility === 'private' ? 'Private' : t.assigneeId ? first(t.assigneeId) : 'Needs someone',
                    start: t.start,
                    end: endOf(t.start, t.durationMin),
                    memberId: t.assigneeId,
                    href: `/tasks/${t.id}`,
                  }
                : busy(t.id, t.assigneeId, t.start, endOf(t.start, t.durationMin)),
            ),
          ...mine(db.appointments)
            .filter((a) => within(a.start))
            .map((a) => {
              const attendee = members.some((p) => p.id === a.forId) ? a.forId : null;
              const memberId = attendee ?? a.escortId;
              if (!seesAppt(a)) return busy(a.id, memberId, a.start, endOf(a.start, a.durationMin));
              return {
                id: a.id,
                kind: 'appointment',
                title: a.title,
                subtitle: `For ${personName(a.forId).split(' ')[0]}`,
                start: a.start,
                end: endOf(a.start, a.durationMin),
                memberId,
                ...(attendee && a.escortId && a.escortId !== attendee ? { alsoMemberId: a.escortId } : {}),
                href: `/appointments/${a.id}`,
              };
            }),
          ...ref.expandEvents(mine(db.events).map(strip), from, to).map((b) =>
            b.hidden && b.memberId !== me.id
              ? busy(b.id, b.memberId, b.start, b.end)
              : {
                  id: b.id,
                  kind: 'event',
                  title: b.label,
                  subtitle: first(b.memberId),
                  start: b.start,
                  end: b.end,
                  memberId: b.memberId,
                  ...(b.memberId === me.id ? { href: `/schedule/events/${b.eventId}` } : {}),
                },
          ),
          ...mine(db.away)
            .filter((u) => within(u.start))
            .map((u) => ({ id: u.id, kind: 'unavailable', title: `${first(u.memberId)} unavailable`, ...(u.reason ? { subtitle: u.reason } : {}), start: u.start, end: u.end, memberId: u.memberId })),
        ].sort((a, b) => a.start.localeCompare(b.start)),
      );
    }

    // ── appointments ──
    if (is('GET', '/appointments'))
      return send(
        res,
        200,
        mine(db.appointments)
          .filter(seesAppt)
          .sort((a, b) => a.start.localeCompare(b.start))
          .map(strip),
      );
    if (is('POST', '/appointments')) {
      if (!body.forId) return problem(res, 422, 'Choose who the appointment is for.');
      const a = {
        ...body,
        id: randomUUID(),
        familyId: me.familyId,
        createdById: me.id,
        createdAt: now(),
        prep: (body.prep ?? []).filter((l) => l.trim()).map((label) => ({ id: randomUUID(), label, done: false })),
      };
      db.appointments.push(a);
      if (a.escortId && a.escortId !== me.id) notify('appointment', `${first(me.id)} asked you to go along to “${a.title}”.`, `/appointments/${a.id}`, a.escortId);
      return send(res, 201, strip(a));
    }
    if ((x = path.match(/^\/appointments\/([^/]+)(?:\/prep(?:\/([^/]+))?(\/toggle)?)?$/))) {
      const a = mine(db.appointments).find((i) => i.id === x[1] && seesAppt(i));
      if (!a) return gone(res, 'That appointment');
      if (path.endsWith('/prep') && m === 'POST') a.prep.push({ id: randomUUID(), label: body.label, done: false });
      else if (x[3]) {
        const item = a.prep.find((i) => i.id === x[2]);
        if (!item) return gone(res, 'That item');
        item.done = !item.done;
        if (item.done) item.doneById = me.id;
        else delete item.doneById;
      } else if (x[2] && m === 'DELETE') a.prep = a.prep.filter((i) => i.id !== x[2]);
      else if (m === 'PUT') Object.assign(a, body);
      else if (m === 'DELETE') {
        db.appointments.splice(db.appointments.indexOf(a), 1);
        return send(res, 204);
      }
      return send(res, 200, strip(a));
    }

    // ── health notes and food suggestions ──
    const blank = (personId) => ({ personId, conditions: [], goals: [], avoid: [], preferences: [], notes: '', shared: isDependant(personId), updatedAt: now() });
    const profile = (personId) => mine(db.health).find((h) => h.personId === personId);
    if (is('GET', '/health/profiles'))
      return send(res, 200, [
        strip(profile(me.id) ?? blank(me.id)),
        ...mine(db.health)
          .filter((h) => h.personId !== me.id && seesHealth(h.personId))
          .map(strip),
      ]);
    if ((x = path.match(/^\/health\/profiles\/([^/]+)$/))) {
      const id = x[1];
      if (!members.some((p) => p.id === id) && !isDependant(id)) return gone(res, 'That person');
      const own = id === me.id;
      if (m === 'GET') return seesHealth(id) ? send(res, 200, strip(profile(id) ?? blank(id))) : problem(res, 403, 'This person keeps their health notes private.');
      if (!own && !(isDependant(id) && medical)) return problem(res, 403, 'You can only change your own health notes, or those of someone the family looks after.');
      const known = new Set(ref.HEALTH_CONDITIONS.map((c) => c.id));
      const saved = { ...body, personId: id, familyId: me.familyId, conditions: body.conditions.filter((c) => known.has(c)), shared: isDependant(id) ? true : body.shared, updatedAt: now() };
      db.health = [...db.health.filter((h) => !(h.familyId === me.familyId && h.personId === id)), saved];
      return send(res, 200, strip(saved));
    }
    if (is('GET', '/health/suggestions')) {
      const only = url.searchParams.get('personId');
      const needs = mine(db.health)
        .filter((h) => (!only || h.personId === only) && seesHealth(h.personId))
        .flatMap((h) => [
          ...h.conditions.map((id) => ref.HEALTH_CONDITIONS.find((c) => c.id === id)).map((c) => ({ h, because: c.label, tags: c.tags })),
          ...h.goals.map((g) => ({ h, because: g.title, tags: g.tags })),
        ]);
      const avoided = (food, avoid) => avoid.some((a) => a.trim() && `${food.name} ${food.localName ?? ''}`.toLowerCase().includes(a.trim().toLowerCase()));
      return send(
        res,
        200,
        ref.foodOptions
          .map((food) => ({
            ...food,
            reasons: needs
              .filter((n) => !avoided(food, n.h.avoid))
              .map((n) => ({ personId: n.h.personId, because: n.because, tags: n.tags.filter((t) => food.tags.includes(t)) }))
              .filter((r) => r.tags.length),
            onList: mine(db.groceries).some((g) => g.foodId === food.id),
          }))
          .filter((f) => f.reasons.length)
          .sort((a, b) => b.reasons.length - a.reasons.length || a.estimatedPrice - b.estimatedPrice || a.name.localeCompare(b.name)),
      );
    }

    // ── shopping list ──
    if (is('GET', '/groceries')) return send(res, 200, mine(db.groceries).map(strip));
    if (is('POST', '/groceries')) {
      if (!body.name?.trim()) return problem(res, 422, 'Enter an item name.');
      const g = {
        id: randomUUID(),
        familyId: me.familyId,
        name: body.name.trim(),
        group: 'Other',
        quantity: Math.max(1, body.quantity),
        unit: body.unit || 'item',
        estimatedPrice: 0,
        status: 'needed',
        forIds: [],
        addedById: me.id,
      };
      db.groceries.push(g);
      return send(res, 201, strip(g));
    }
    if (is('POST', '/groceries/from-food')) {
      const food = ref.foodOptions.find((f) => f.id === body.foodId);
      if (!food) return gone(res, 'That food');
      // Naming someone on the shared list would reveal a private health note.
      const forIds = (body.forIds ?? []).filter((id) => isDependant(id) || profile(id)?.shared);
      let g = mine(db.groceries).find((i) => i.foodId === food.id);
      if (g) g.forIds = [...new Set([...g.forIds, ...forIds])];
      else {
        const reason = (body.tags ?? [])
          .filter((t) => food.tags.includes(t))
          .map((t) => ref.NUTRITION_TAG_LABELS[t])
          .join(', ');
        g = {
          id: randomUUID(),
          familyId: me.familyId,
          name: food.localName ? `${food.name} (${food.localName})` : food.name,
          group: food.group,
          quantity: 1,
          unit: food.portion,
          estimatedPrice: food.estimatedPrice,
          status: 'needed',
          foodId: food.id,
          forIds,
          ...(reason ? { reason } : {}),
          addedById: me.id,
        };
        db.groceries.push(g);
      }
      return send(res, 201, strip(g));
    }
    if (is('POST', '/groceries/task')) {
      const needed = mine(db.groceries).filter((g) => g.status === 'needed');
      if (!needed.length) return problem(res, 422, 'There is nothing left to buy.');
      const t = {
        id: randomUUID(),
        familyId: me.familyId,
        title: `Shopping (${needed.length} item${needed.length === 1 ? '' : 's'})`,
        notes: needed.map((g) => `• ${g.name} — ${g.quantity} × ${g.unit}`).join('\n'),
        category: 'errands',
        priority: 'routine',
        status: 'scheduled',
        start: body.start,
        durationMin: 60,
        assigneeId: body.assigneeId ?? null,
        visibility: 'family',
        createdById: me.id,
        createdAt: now(),
        reminder: true,
      };
      db.tasks.push(t);
      return send(res, 201, strip(t));
    }
    if ((x = path.match(/^\/groceries\/([^/]+)$/))) {
      const g = mine(db.groceries).find((i) => i.id === x[1]);
      if (!g) return gone(res, 'That item');
      if (m === 'DELETE') {
        db.groceries.splice(db.groceries.indexOf(g), 1);
        return send(res, 204);
      }
      Object.assign(g, body);
      return send(res, 200, strip(g));
    }

    // ── documents ──
    const seesDoc = (d) => d.uploadedById === me.id || d.ownerId === me.id || (d.access === 'restricted' ? d.allowedIds.includes(me.id) : isLead || me.access.documents);
    if (is('GET', '/documents'))
      return send(
        res,
        200,
        mine(db.documents)
          .filter(seesDoc)
          .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
          .map(strip),
      );
    if (is('POST', '/documents')) {
      if (!body?.multipart) return problem(res, 415, 'Upload a PDF, an image or a Word document.');
      const text = body.multipart.toString('latin1');
      const field = (n) => text.match(new RegExp(`name="${n}"\\r\\n\\r\\n([^\\r]*)`))?.[1];
      const all = (n) => [...text.matchAll(new RegExp(`name="${n}"\\r\\n\\r\\n([^\\r]*)`, 'g'))].map((r) => r[1]);
      const access = field('access');
      const d = {
        id: randomUUID(),
        familyId: me.familyId,
        title: field('title') || 'document',
        category: field('category'),
        fileName: text.match(/filename="([^"]*)"/)?.[1] ?? 'document',
        sizeKB: Math.max(1, Math.round(body.multipart.length / 1024)),
        uploadedAt: now(),
        uploadedById: me.id,
        ...(field('ownerId') ? { ownerId: field('ownerId') } : {}),
        access,
        allowedIds: access === 'restricted' ? [...new Set([me.id, ...all('allowedIds')])] : [],
        ...(field('appointmentId') ? { appointmentId: field('appointmentId') } : {}),
      };
      db.documents.push(d);
      return send(res, 201, strip(d));
    }
    if ((x = path.match(/^\/documents\/([^/]+)(\/access)?$/))) {
      const d = mine(db.documents).find((i) => i.id === x[1] && seesDoc(i));
      if (!d) return gone(res, 'That document');
      if (m === 'DELETE') {
        db.documents.splice(db.documents.indexOf(d), 1);
        return send(res, 204);
      }
      Object.assign(d, { access: body.access, allowedIds: body.access === 'restricted' ? [...new Set([me.id, ...body.allowedIds])] : [] });
      return send(res, 200, strip(d));
    }

    // ── family map: what care-service answers from Neo4j (plain nodes and relationships) ──
    if (is('GET', '/caregraph')) {
      const soon = (iso) => new Date(iso).getTime() > Date.now() - 3_600_000;
      const tasks = mine(db.tasks)
        .filter((t) => t.visibility === 'family' && t.status === 'scheduled' && soon(t.start))
        .sort((a, b) => a.start.localeCompare(b.start))
        .slice(0, 6);
      const appts = mine(db.appointments)
        .filter((a) => a.visibility === 'family' && soon(a.start))
        .sort((a, b) => a.start.localeCompare(b.start))
        .slice(0, 3);
      const node = (id) => (members.some((p) => p.id === id) ? `member:${id}` : isDependant(id) ? `dependant:${id}` : null);
      const edges = [];
      const link = (from, to, label) => from && to && edges.push({ from, to, label });
      for (const t of tasks) {
        link(node(t.assigneeId), `task:${t.id}`, 'does');
        if (t.forId && t.forId !== t.assigneeId) link(`task:${t.id}`, node(t.forId), `for ${personName(t.forId).split(' ')[0]}`);
        if (t.appointmentId && appts.some((a) => a.id === t.appointmentId)) link(`task:${t.id}`, `appt:${t.appointmentId}`, 'needed for');
      }
      for (const a of appts) {
        link(`appt:${a.id}`, node(a.forId), `for ${personName(a.forId).split(' ')[0]}`);
        if (a.escortId && a.escortId !== a.forId) link(node(a.escortId), `appt:${a.id}`, 'goes along');
      }
      const people = [
        ...members
          .filter((p) => p.status === 'active')
          .map((p) => ({ id: `member:${p.id}`, kind: 'member', label: p.name, ...(p.relation ? { detail: p.relation } : {}), role: p.role, href: `/family/${p.id}` })),
        ...fam.dependants.map((d) => ({ id: `dependant:${d.id}`, kind: 'dependant', label: d.name, ...(d.relation ? { detail: d.relation } : {}), href: `/health/${d.id}` })),
      ];
      for (const p of people) edges.push({ from: 'family', to: p.id, label: p.kind === 'member' ? 'member' : 'looked after' });
      return send(res, 200, {
        nodes: [
          { id: 'family', kind: 'family', label: fam.name, ...(fam.location ? { detail: fam.location } : {}) },
          ...people,
          ...appts.map((a) => ({ id: `appt:${a.id}`, kind: 'appointment', label: a.title, start: a.start, href: `/appointments/${a.id}` })),
          ...tasks.map((t) => ({ id: `task:${t.id}`, kind: 'task', label: t.title, start: t.start, href: `/tasks/${t.id}` })),
        ],
        edges,
      });
    }

    // ── chat: the family channel and one thread per task ──
    const channelOk = (channel) => channel === 'family' || (channel?.startsWith('task:') && Boolean(task(channel.slice(5))));
    const messageView = ({ familyId: _f, ...msg }) => msg;
    const readAt = (channel) => db.reads.find((r) => r.memberId === me.id && r.channel === channel)?.at ?? '';
    const markRead = (channel, at = now()) => {
      db.reads = [...db.reads.filter((r) => !(r.memberId === me.id && r.channel === channel)), { memberId: me.id, channel, at }];
    };
    if (is('GET', '/messages')) {
      const channel = url.searchParams.get('channel'),
        after = url.searchParams.get('after');
      if (!channelOk(channel)) return gone(res, 'That conversation');
      return send(
        res,
        200,
        mine(db.messages)
          .filter((msg) => msg.channel === channel && (!after || msg.createdAt > after))
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
          .map(messageView),
      );
    }
    if (is('POST', '/messages')) {
      if (!channelOk(body.channel)) return gone(res, 'That conversation');
      if (!body.text?.trim()) return problem(res, 422, 'Write a message first.');
      if (body.text.length > 1000) return problem(res, 422, 'Messages can be up to 1000 characters.');
      const msg = { id: randomUUID(), familyId: me.familyId, channel: body.channel, authorId: me.id, kind: 'text', text: body.text.trim(), createdAt: now() };
      db.messages.push(msg);
      markRead(body.channel, msg.createdAt);
      return send(res, 201, messageView(msg));
    }
    if (is('POST', '/messages/read')) {
      if (!channelOk(body.channel)) return gone(res, 'That conversation');
      markRead(body.channel);
      return send(res, 204);
    }
    if (is('GET', '/messages/unread-count'))
      return send(res, 200, { unread: mine(db.messages).filter((msg) => msg.channel === 'family' && msg.kind !== 'system' && msg.authorId !== me.id && msg.createdAt > readAt('family')).length });
    if (is('GET', '/messages/task-counts')) {
      const counts = {};
      for (const msg of mine(db.messages)) if (msg.kind === 'text' && msg.channel !== 'family' && task(msg.channel.slice(5))) counts[msg.channel.slice(5)] = (counts[msg.channel.slice(5)] ?? 0) + 1;
      return send(res, 200, counts);
    }

    // ── notifications: for the family (not about your own actions) or for one member ──
    const inbox = () => mine(db.notifications).filter((n) => (n.forId ? n.forId === me.id : n.actorId !== me.id) && !n.hiddenFor.has(me.id));
    const notificationView = (n) => ({
      id: n.id,
      type: n.type,
      message: n.message,
      createdAt: n.createdAt,
      read: n.readBy.has(me.id),
      ...(n.href ? { href: n.href } : {}),
      ...(n.forId ? { forId: n.forId } : {}),
    });
    if (is('GET', '/notifications'))
      return send(
        res,
        200,
        inbox()
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .map(notificationView),
      );
    if (is('GET', '/notifications/unread-count')) return send(res, 200, { unread: inbox().filter((n) => !n.readBy.has(me.id)).length });
    if (is('POST', '/notifications/read-all')) {
      inbox().forEach((n) => n.readBy.add(me.id));
      return send(res, 204);
    }
    if ((x = path.match(/^\/notifications\/([^/]+)(\/read)?$/))) {
      const n = inbox().find((i) => i.id === x[1]);
      if (!n) return gone(res, 'That notification');
      if (x[2]) n.readBy.add(me.id);
      else n.hiddenFor.add(me.id);
      return send(res, 204);
    }
    if (is('GET', '/audit-events'))
      return send(
        res,
        200,
        mine(db.audit)
          .sort((a, b) => b.at.localeCompare(a.at))
          .map(strip),
      );
    return problem(res, 404, `No stub for ${m} ${path}`);
  })
  .listen(PORT, () => console.log(`stub API on :${PORT}`));
