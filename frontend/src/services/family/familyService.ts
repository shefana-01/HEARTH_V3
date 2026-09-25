/**
 * The family space, its members, the people it looks after, invitations and
 * the signed-in account — family-service.
 */
import { apiRequest, withNulls } from '../api/client';
import { config } from '../config';
import { toAccount, type ApiAccount } from '../api/mappers';
import { INVITE_CODE, INVITE_CODE_HINT } from '@/constants/invite';
import { actorId, audit, db, fail, memberName, newId, notFound, notify, nowIso, persist, requireFamily, respond } from '../mockStore';
import type { Account, Dependant, DependantInput, Family, FamilyMember, MemberRole, Skill, WeeklyAvailability } from '@/types/domain';

export interface CreateFamilyInput {
  name: string;
  location: string;
  myRelation: string;
  /** People the family looks after who will not use Hearth themselves. May be empty. */
  dependants: DependantInput[];
  invites: InviteInput[];
  availability: WeeklyAvailability;
}

export interface InviteInput {
  name: string;
  email: string;
  relation: string;
  role: MemberRole;
}

export interface InviteLookup {
  family: Family;
  inviterName: string;
  memberCount: number;
  alreadyMember: boolean;
}

export type MemberUpdate = Partial<Pick<FamilyMember, 'focus' | 'relation' | 'role' | 'skills' | 'availability' | 'access' | 'phone'>>;

function makeInviteCode(): string {
  return `HEARTH-${Math.floor(100 + Math.random() * 900)}`;
}

function createMember(input: InviteInput): FamilyMember {
  return {
    id: newId('m'),
    name: input.name.trim(),
    relation: input.relation.trim(),
    role: input.role,
    focus: '',
    email: input.email.trim(),
    status: 'invited',
    skills: [] as Skill[],
    availability: { days: [true, true, true, true, true, true, true], windows: [] },
    access: { schedule: true, medical: false, documents: false },
    joinedAt: nowIso(),
  };
}

const cleanDependant = (input: DependantInput): DependantInput => ({ name: input.name.trim(), relation: input.relation.trim(), birthYear: input.birthYear, notes: input.notes.trim() });

export const familyService = {
  async getFamily(): Promise<Family | null> {
    if (!config.useMocks) return (await apiRequest<Family | undefined>('/family')) ?? null;
    return respond(db.family);
  },

  async createFamily(input: CreateFamilyInput): Promise<Family> {
    if (!config.useMocks) return apiRequest<Family>('/family', { method: 'POST', body: { ...input, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } });
    if (!db.account) return fail('Sign in first.', 401);
    db.family = {
      id: newId('fam'),
      name: input.name.trim(),
      location: input.location.trim(),
      createdAt: nowIso(),
      inviteCode: makeInviteCode(),
      dependants: input.dependants.filter((d) => d.name.trim()).map((d) => ({ id: newId('dep'), ...cleanDependant(d) })),
    };
    const me = db.members.find((m) => m.id === db.account!.memberId);
    if (me) {
      me.relation = input.myRelation.trim();
      me.availability = input.availability;
    }
    for (const invite of input.invites) db.members.push(createMember(invite));
    audit({ category: 'circle', action: 'Created the family space', subject: db.family.name });
    persist();
    return respond(db.family);
  },

  async updateFamily(patch: Partial<Pick<Family, 'name' | 'location' | 'weeklyGroceryBudget'>>): Promise<Family> {
    if (!config.useMocks) return apiRequest<Family>('/family', { method: 'PATCH', body: withNulls(patch) });
    const family = requireFamily();
    Object.assign(family, patch);
    audit({ category: 'circle', action: 'Updated family details', subject: family.name });
    persist();
    return respond(family);
  },

  /* ── People the family looks after ── */

  async addDependant(input: DependantInput): Promise<Dependant> {
    if (!config.useMocks) return apiRequest<Dependant>('/family/dependants', { method: 'POST', body: input });
    const family = requireFamily();
    if (!input.name.trim()) return fail('Enter their name.', 422);
    const dependant: Dependant = { id: newId('dep'), ...cleanDependant(input) };
    family.dependants.push(dependant);
    audit({ category: 'circle', action: 'Added someone the family looks after', subject: dependant.name, after: dependant.relation || undefined });
    persist();
    return respond(dependant);
  },

  async updateDependant(id: string, input: DependantInput): Promise<Dependant> {
    if (!config.useMocks) return apiRequest<Dependant>(`/family/dependants/${id}`, { method: 'PUT', body: input });
    const dependant = requireFamily().dependants.find((d) => d.id === id);
    if (!dependant) return notFound('That person');
    Object.assign(dependant, cleanDependant(input));
    audit({ category: 'circle', action: 'Updated someone the family looks after', subject: dependant.name });
    persist();
    return respond(dependant);
  },

  /** Their health notes go with them; tasks and documents about them stay but lose the link. */
  async removeDependant(id: string): Promise<void> {
    if (!config.useMocks) return apiRequest<void>(`/family/dependants/${id}`, { method: 'DELETE' });
    const family = requireFamily();
    const dependant = family.dependants.find((d) => d.id === id);
    if (!dependant) return notFound('That person');
    if (db.appointments.some((a) => a.forId === id && new Date(a.start).getTime() > Date.now())) {
      return fail(`${dependant.name} still has upcoming appointments. Remove or move those first.`, 409);
    }
    family.dependants = family.dependants.filter((d) => d.id !== id);
    db.health = db.health.filter((h) => h.personId !== id);
    db.tasks.forEach((t) => {
      if (t.forId === id) t.forId = undefined;
    });
    db.documents.forEach((d) => {
      if (d.ownerId === id) d.ownerId = undefined;
    });
    db.groceries.forEach((g) => {
      g.forIds = g.forIds.filter((x) => x !== id);
    });
    audit({ category: 'circle', action: 'Removed someone the family looks after', subject: dependant.name });
    persist();
    return respond(undefined);
  },

  /* ── Members ── */

  async listMembers(): Promise<FamilyMember[]> {
    if (!config.useMocks) return apiRequest<FamilyMember[]>('/members');
    return respond(db.members);
  },

  async getMember(id: string): Promise<FamilyMember> {
    if (!config.useMocks) return apiRequest<FamilyMember>(`/members/${id}`);
    const member = db.members.find((m) => m.id === id);
    return member ? respond(member) : notFound('That family member');
  },

  async inviteMember(input: InviteInput): Promise<FamilyMember> {
    if (!config.useMocks) return apiRequest<FamilyMember>('/members', { method: 'POST', body: input });
    requireFamily();
    if (db.members.some((m) => m.email.toLowerCase() === input.email.trim().toLowerCase())) {
      return fail('Someone with this email is already in your family.', 409);
    }
    const member = createMember(input);
    db.members.push(member);
    audit({ category: 'circle', action: 'Invited a member', subject: member.name, after: input.relation || input.role });
    // MOCK: no email is sent. The backend delivers the invitation.
    notify({ type: 'circle', message: `${member.name} was invited to the family.`, href: `/family/${member.id}` });
    persist();
    return respond(member);
  },

  async updateMember(id: string, patch: MemberUpdate): Promise<FamilyMember> {
    if (!config.useMocks) return apiRequest<FamilyMember>(`/members/${id}`, { method: 'PATCH', body: withNulls(patch) });
    const member = db.members.find((m) => m.id === id);
    if (!member) return notFound('That family member');
    Object.assign(member, patch);
    audit({ category: 'circle', action: 'Updated a member profile', subject: member.name });
    persist();
    return respond(member);
  },

  async removeMember(id: string): Promise<void> {
    if (!config.useMocks) return apiRequest<void>(`/members/${id}`, { method: 'DELETE' });
    const member = db.members.find((m) => m.id === id);
    if (!member) return notFound('That family member');
    if (member.role === 'lead') return fail('The organiser cannot be removed.', 409);
    db.members = db.members.filter((m) => m.id !== id);
    // Shared tasks go back to "needs someone"; what was only theirs leaves with them.
    db.tasks = db.tasks.filter((t) => !(t.visibility === 'private' && t.assigneeId === id));
    db.tasks.forEach((t) => {
      if (t.assigneeId === id && t.status === 'scheduled') t.assigneeId = null;
      if (t.forId === id) t.forId = undefined;
    });
    db.appointments = db.appointments.filter((a) => a.forId !== id);
    db.appointments.forEach((a) => {
      if (a.escortId === id) a.escortId = null;
    });
    db.events = db.events.filter((e) => e.memberId !== id);
    db.health = db.health.filter((h) => h.personId !== id);
    db.unavailability = db.unavailability.filter((u) => u.memberId !== id);
    audit({ category: 'circle', action: 'Removed a member', subject: member.name });
    persist();
    return respond(undefined);
  },

  /**
   * Set the signed-in person's status line ("In class until 2"). An empty text clears it.
   * The family chat shows the change so people notice it.
   */
  async setStatus(text: string, until?: string): Promise<FamilyMember> {
    const body = { text: text.trim(), until: until ?? null };
    if (!config.useMocks) return apiRequest<FamilyMember>(`/members/${actorId()}/status`, { method: 'PUT', body });
    const member = db.members.find((m) => m.id === actorId());
    if (!member) return notFound('Your profile');
    if (!body.text) {
      member.statusNote = undefined;
    } else {
      member.statusNote = { text: body.text.slice(0, 80), until, updatedAt: nowIso() };
      db.messages.push({ id: newId('msg'), channel: 'family', authorId: member.id, kind: 'status', text: member.statusNote.text, createdAt: nowIso() });
    }
    persist();
    return respond(member);
  },

  /* ── Account ── */

  async getAccount(): Promise<Account> {
    if (!config.useMocks) return toAccount(await apiRequest<ApiAccount>('/account'));
    return db.account ? respond(db.account) : fail('Sign in first.', 401);
  },

  async updateAccount(patch: Partial<Pick<Account, 'name' | 'email' | 'phone' | 'about' | 'photo' | 'whatsappAlerts'>>): Promise<Account> {
    if (!config.useMocks) return toAccount(await apiRequest<ApiAccount>('/account', { method: 'PATCH', body: withNulls(patch) }));
    if (!db.account) return fail('Sign in first.', 401);
    Object.assign(db.account, patch);
    const me = db.members.find((m) => m.id === db.account!.memberId);
    if (me) {
      if (patch.name) me.name = patch.name;
      if (patch.email) me.email = patch.email;
      if (patch.phone !== undefined) me.phone = patch.phone;
      if ('photo' in patch) me.photo = patch.photo;
    }
    persist();
    return respond(db.account);
  },

  /* ── Invitations ── */

  /**
   * Look up an invitation code.
   * MOCK: only families stored on this device can be found.
   */
  async lookupInvite(code: string): Promise<InviteLookup> {
    if (!config.useMocks) return apiRequest<InviteLookup>(`/invites/${encodeURIComponent(code.trim().toUpperCase())}`);
    const normalized = code.trim().toUpperCase();
    if (!INVITE_CODE.test(normalized)) return fail(INVITE_CODE_HINT, 422);
    if (!db.family || db.family.inviteCode !== normalized) return fail('We couldn’t find a family with that code. Check it with the person who invited you.', 404);
    const lead = db.members.find((m) => m.role === 'lead');
    return respond({
      family: db.family,
      inviterName: memberName(lead?.id),
      memberCount: db.members.filter((m) => m.status === 'active').length,
      alreadyMember: Boolean(db.account && db.family),
    });
  },

  /**
   * Join the family behind an invitation code as the signed-in account.
   * The API only accepts this if the organiser invited this account's email address.
   * MOCK: there is one account per browser, so only its own family can be "joined".
   */
  async acceptInvite(code: string): Promise<Family> {
    if (!config.useMocks) return apiRequest<Family>(`/invites/${encodeURIComponent(code.trim().toUpperCase())}/accept`, { method: 'POST' });
    if (db.family && db.family.inviteCode === code.trim().toUpperCase()) return respond(db.family);
    return fail('Joining a family from another device needs the Hearth backend.', 409);
  },
};
