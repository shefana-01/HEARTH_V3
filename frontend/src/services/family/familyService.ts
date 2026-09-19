/**
 * Family, members, invitations and the signed-in account — family-service.
 *
 */
import { apiRequest, withNulls } from '../api/client';
import { config } from '../config';
import { toAccount, type ApiAccount } from '../api/mappers';
import { INVITE_CODE, INVITE_CODE_HINT } from '@/constants/invite';
import { audit, db, fail, memberName, newId, notFound, notify, nowIso, persist, requireFamily, respond } from '../mockStore';
import type { Account, CareRecipient, Family, FamilyMember, MemberRole, Skill, WeeklyAvailability } from '@/types/domain';

export interface CreateFamilyInput {
  name: string;
  location: string;
  careFocus: string;
  recipient: Omit<CareRecipient, 'id'>;
  myRelation: string;
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
    availability: { days: [true, true, true, true, true, false, false], windows: [] },
    access: { schedule: true, medical: false, documents: false },
    joinedAt: nowIso(),
  };
}

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
      careFocus: input.careFocus,
      createdAt: nowIso(),
      inviteCode: makeInviteCode(),
      recipient: { id: newId('rec'), ...input.recipient, name: input.recipient.name.trim() },
    };
    const me = db.members.find((m) => m.id === db.account!.memberId);
    if (me) {
      me.relation = input.myRelation.trim();
      me.availability = input.availability;
    }
    for (const invite of input.invites) db.members.push(createMember(invite));
    audit({ category: 'circle', action: 'Created the family circle', subject: db.family.name });
    persist();
    return respond(db.family);
  },

  async updateFamily(patch: Partial<Pick<Family, 'name' | 'location' | 'careFocus'>> & { recipient?: Partial<CareRecipient> }): Promise<Family> {
    if (!config.useMocks) return apiRequest<Family>('/family', { method: 'PATCH', body: { ...patch, ...(patch.recipient ? { recipient: withNulls(patch.recipient) } : {}) } });
    const family = requireFamily();
    const { recipient, ...rest } = patch;
    Object.assign(family, rest);
    if (recipient) Object.assign(family.recipient, recipient);
    audit({ category: 'circle', action: 'Updated family details', subject: family.name });
    persist();
    return respond(family);
  },

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
      return fail('Someone with this email is already in your circle.', 409);
    }
    const member = createMember(input);
    db.members.push(member);
    audit({ category: 'circle', action: 'Invited a member', subject: member.name, after: input.relation || input.role });
    // MOCK: no email is sent. The backend will deliver the invitation.
    notify({ type: 'circle', message: `${member.name} was invited to the circle.`, href: `/family/${member.id}` });
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
    if (member.role === 'lead') return fail('The lead caregiver cannot be removed.', 409);
    db.members = db.members.filter((m) => m.id !== id);
    db.tasks.forEach((t) => {
      if (t.assigneeId === id && t.status === 'scheduled') t.assigneeId = null;
    });
    db.appointments.forEach((a) => {
      if (a.escortId === id) a.escortId = null;
    });
    audit({ category: 'circle', action: 'Removed a member', subject: member.name });
    persist();
    return respond(undefined);
  },

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
   * The API only accepts this if the lead invited this account's email address.
   * MOCK: there is one account per browser, so only its own family can be "joined".
   */
  async acceptInvite(code: string): Promise<Family> {
    if (!config.useMocks) return apiRequest<Family>(`/invites/${encodeURIComponent(code.trim().toUpperCase())}/accept`, { method: 'POST' });
    if (db.family && db.family.inviteCode === code.trim().toUpperCase()) return respond(db.family);
    return fail('Joining a family from another device needs the Hearth backend.', 409);
  },
};
