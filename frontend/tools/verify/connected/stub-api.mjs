// A tiny in-memory stand-in for the Hearth API gateway, written from the backend's REST contract
// (paths, methods, status codes, error format). It is NOT the backend: it exists so the frontend's
// connected mode (token handling, refresh, 204s, uploads, error messages) can be exercised in a browser.
import http from 'node:http';
import { randomUUID } from 'node:crypto';

const PORT = Number(process.env.PORT ?? 8099);
const TOKEN_USES = Number(process.env.TOKEN_USES ?? 12); // an access token "expires" after this many requests
const db = {
  accounts: [],
  access: new Map(),
  refresh: new Map(),
  families: new Map(),
  members: [],
  tasks: [],
  away: [],
  appointments: [],
  plans: new Map(),
  groceries: [],
  documents: [],
  requests: [],
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

const problem = (res, status, detail) => send(res, status, { type: 'about:blank', title: 'Error', status, detail }, 'application/problem+json');
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
  availability: { days: [true, true, true, true, true, false, false], windows: [] },
  access: { schedule: true, medical: false, documents: false },
  joinedAt: new Date().toISOString(),
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
      if (!invited) return problem(res, 403, `This invitation was sent to a different email address. Ask the lead caregiver to invite ${account.email}.`);
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
        careFocus: body.careFocus ?? '',
        timezone: body.timezone ?? 'UTC',
        createdAt: new Date().toISOString(),
        recipient: { id: randomUUID(), careNotes: '', relation: '', ...body.recipient },
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
          focus: 'Care coordination',
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
    if (!me) return problem(res, 409, 'Set up your family first.');
    if (is('PATCH', '/family')) {
      const { recipient, ...rest } = body;
      Object.assign(fam, rest);
      if (recipient) Object.assign(fam.recipient, recipient);
      return send(res, 200, fam);
    }
    if (is('GET', '/members')) return send(res, 200, mine(db.members).map(memberView));
    if (is('POST', '/members')) {
      const mm = newMember(me.familyId, body);
      db.members.push(mm);
      emails.push({ to: mm.email, purpose: 'invitation', code: fam.inviteCode });
      return send(res, 201, memberView(mm));
    }
    if ((x = path.match(/^\/members\/([^/]+)(\/availability)?$/))) {
      const mm = mine(db.members).find((i) => i.id === x[1]);
      if (!mm) return problem(res, 404, 'That family member could not be found. It may have been removed.');
      if (x[2]) {
        if (m === 'PUT') mm.availability = body;
        return send(res, 200, mm.availability);
      }
      if (m === 'PATCH') Object.assign(mm, body);
      if (m === 'DELETE') {
        db.members.splice(db.members.indexOf(mm), 1);
        return send(res, 204);
      }
      return send(res, 200, memberView(mm));
    }

    // tasks
    if (is('GET', '/tasks'))
      return send(
        res,
        200,
        mine(db.tasks)
          .filter(
            (t) => (url.searchParams.get('includeCancelled') === 'true' || t.status !== 'cancelled') && (!url.searchParams.get('assigneeId') || t.assigneeId === url.searchParams.get('assigneeId')),
          )
          .sort((a, b) => a.start.localeCompare(b.start))
          .map(strip),
      );
    if (is('POST', '/tasks')) {
      if (!body.title?.trim()) return send(res, 400, { status: 400, detail: 'Enter a title.', fieldErrors: { title: 'Enter a title.' } }, 'application/problem+json');
      const t = { ...body, id: randomUUID(), familyId: me.familyId, status: 'scheduled', createdById: me.id, createdAt: new Date().toISOString(), assigneeId: body.assigneeId ?? null };
      db.tasks.push(t);
      return send(res, 201, strip(t));
    }
    if ((x = path.match(/^\/tasks\/([^/]+)(?:\/(complete|reopen|assignee))?$/))) {
      const t = mine(db.tasks).find((i) => i.id === x[1]);
      if (!t) return problem(res, 404, 'That task could not be found. It may have been removed.');
      if (m === 'DELETE') {
        t.status = 'cancelled';
        return send(res, 204);
      }
      if (m === 'PUT' && x[2] === 'assignee') t.assigneeId = body.memberId;
      else if (m === 'PUT') Object.assign(t, body);
      if (x[2] === 'complete') Object.assign(t, { status: 'completed', completedAt: new Date().toISOString(), completedById: me.id });
      if (x[2] === 'reopen') {
        t.status = 'scheduled';
        delete t.completedAt;
        delete t.completedById;
      }
      return send(res, 200, strip(t));
    }
    if (is('GET', '/unavailability')) return send(res, 200, mine(db.away).map(strip));
    if (is('POST', '/unavailability')) {
      const u = { ...body, id: randomUUID(), familyId: me.familyId, memberId: me.id, createdAt: new Date().toISOString() };
      db.away.push(u);
      return send(res, 201, { unavailability: strip(u), affectedTaskIds: [], requestIds: [] });
    }

    // decisions (deliberately simple: unassigned tasks are conflicts)
    const priority = {
      score: 42,
      factors: { deadline: 0.6, criticality: 0.3, dependency: 0.3, reassignment: 0, conflict: 1 },
      explanation: 'Low priority for now. Worth knowing: the current plan cannot go ahead.',
    };
    const conflicts = () =>
      mine(db.tasks)
        .filter((t) => t.status === 'scheduled' && !t.assigneeId && new Date(t.start).getTime() + t.durationMin * 60000 > Date.now())
        .map((t) => ({ conflict: { id: `c-${t.id}`, taskId: t.id, memberId: null, kind: 'unassigned', reason: 'No one is assigned to this task yet.', overlapMinutes: 0 }, task: strip(t), priority }));
    if (is('GET', '/decisions/attention')) return send(res, 200, conflicts());
    if ((x = is('GET', /^\/decisions\/tasks\/([^/]+)\/insight$/))) {
      const c = conflicts().find((i) => i.task.id === x[1]);
      return send(res, 200, { ...(c ? { conflict: c.conflict } : {}), priority, candidates: [] });
    }
    if (is('POST', '/decisions/candidates/preview')) return send(res, 200, []);
    if (is('GET', '/decisions/weights')) return send(res, 200, {});
    if (is('POST', '/decisions/simulations')) return send(res, 200, { change: body, conflictsBefore: [], conflictsAfter: [], resolved: [], introduced: [], workload: [] });
    if (is('GET', '/reassignment-requests')) return send(res, 200, []);
    if (is('GET', '/schedule/events')) {
      const from = new Date(url.searchParams.get('from')).getTime(),
        to = new Date(url.searchParams.get('to')).getTime();
      if (Number.isNaN(from) || Number.isNaN(to)) return problem(res, 400, '"from" and "to" must be date-times like 2026-10-05T00:00:00Z.');
      return send(
        res,
        200,
        mine(db.tasks)
          .filter((t) => t.status !== 'cancelled' && new Date(t.start).getTime() >= from && new Date(t.start).getTime() < to)
          .map((t) => ({
            id: t.id,
            kind: t.status === 'completed' ? 'completed' : t.assigneeId ? 'task' : 'conflict',
            title: t.title,
            subtitle: 'Unassigned',
            start: t.start,
            end: new Date(new Date(t.start).getTime() + t.durationMin * 60000).toISOString(),
            memberId: t.assigneeId,
            href: `/tasks/${t.id}`,
          })),
      );
    }

    // care
    if (is('GET', '/appointments')) return send(res, 200, mine(db.appointments).map(strip));
    if (is('POST', '/appointments')) {
      const a = { ...body, id: randomUUID(), familyId: me.familyId, createdAt: new Date().toISOString(), prep: (body.prep ?? []).map((label) => ({ id: randomUUID(), label, done: false })) };
      db.appointments.push(a);
      return send(res, 201, strip(a));
    }
    if ((x = is('GET', /^\/appointments\/([^/]+)$/))) {
      const a = mine(db.appointments).find((i) => i.id === x[1]);
      return a ? send(res, 200, strip(a)) : problem(res, 404, 'That appointment could not be found. It may have been removed.');
    }
    if (is('GET', '/nutrition/plan')) return db.plans.has(me.familyId) ? send(res, 200, db.plans.get(me.familyId)) : send(res, 204);
    if (is('PUT', '/nutrition/plan')) {
      const p = { ...body, updatedAt: new Date().toISOString() };
      db.plans.set(me.familyId, p);
      return send(res, 200, p);
    }
    if (is('GET', '/nutrition/food-matches')) return send(res, 200, []);
    if (is('GET', '/groceries')) return send(res, 200, mine(db.groceries).map(strip));
    if (is('POST', '/groceries')) {
      const g = { id: randomUUID(), familyId: me.familyId, name: body.name, group: 'Other', quantity: Math.max(1, body.quantity), unit: body.unit || 'item', estimatedPrice: 0, status: 'needed' };
      db.groceries.push(g);
      return send(res, 201, strip(g));
    }
    if (is('GET', '/documents')) return send(res, 200, mine(db.documents).map(strip));
    if (is('POST', '/documents')) {
      if (!body?.multipart) return problem(res, 415, 'Upload a PDF, an image or a Word document.');
      const text = body.multipart.toString('latin1');
      const field = (n) => text.match(new RegExp(`name="${n}"\\r\\n\\r\\n([^\\r]*)`))?.[1];
      const d = {
        id: randomUUID(),
        familyId: me.familyId,
        title: field('title') || 'document',
        category: field('category'),
        fileName: text.match(/filename="([^"]*)"/)?.[1] ?? 'document',
        sizeKB: Math.max(1, Math.round(body.multipart.length / 1024)),
        uploadedAt: new Date().toISOString(),
        uploadedById: me.id,
        access: field('access'),
        allowedIds: [],
      };
      db.documents.push(d);
      return send(res, 201, strip(d));
    }
    if ((x = is('DELETE', /^\/documents\/([^/]+)$/))) {
      db.documents = db.documents.filter((d) => d.id !== x[1]);
      return send(res, 204);
    }
    if (is('GET', '/caregraph')) {
      // What care-service answers from Neo4j: plain nodes and relationships, no wording or layout.
      const upcoming = mine(db.tasks)
        .filter((t) => t.status === 'scheduled' && new Date(t.start).getTime() > Date.now() - 3600000)
        .sort((a, b) => a.start.localeCompare(b.start))
        .slice(0, 5);
      const people = mine(db.members).filter((p) => p.status === 'active' && upcoming.some((t) => t.assigneeId === p.id));
      const first = (id) => (db.members.find((p) => p.id === id)?.name ?? 'someone').split(' ')[0];
      return send(res, 200, {
        nodes: [
          { id: 'recipient', kind: 'recipient', label: fam.recipient.name, ...(fam.recipient.relation ? { detail: fam.recipient.relation } : {}) },
          ...upcoming.map((t) => ({ id: `task:${t.id}`, kind: 'task', label: t.title, start: t.start, href: `/tasks/${t.id}` })),
          ...people.map((p) => ({ id: `member:${p.id}`, kind: 'member', label: p.name, ...(p.relation ? { detail: p.relation } : {}), role: p.role, href: `/family/${p.id}` })),
        ],
        edges: [
          ...upcoming.map((t) => ({ from: 'recipient', to: `task:${t.id}`, label: 'receives care' })),
          ...upcoming.filter((t) => people.some((p) => p.id === t.assigneeId)).map((t) => ({ from: `task:${t.id}`, to: `member:${t.assigneeId}`, label: `assigned to ${first(t.assigneeId)}` })),
        ],
      });
    }
    if (is('GET', '/notifications')) return send(res, 200, []);
    if (is('GET', '/notifications/unread-count')) return send(res, 200, { unread: 0 });
    if (is('POST', '/notifications/read-all')) return send(res, 204);
    if (is('GET', '/audit-events')) return send(res, 200, []);
    return problem(res, 404, `No stub for ${m} ${path}`);
  })
  .listen(PORT, () => console.log(`stub API on :${PORT}`));
