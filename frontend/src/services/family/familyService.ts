/**
 * Family, members, invitations and the signed-in account — family-service.
 * REST contract: not defined yet.
 */
import { backendNotConnected } from '../api/client';
import { config } from '../config';
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
    if (!config.useMocks) return backendNotConnected('family-service', 'getFamily');
    return respond(db.family);
  },

  async createFamily(input: CreateFamilyInput): Promise<Family> {
    if (!config.useMocks) return backendNotConnected('family-service', 'createFamily');
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
    if (!config.useMocks) return backendNotConnected('family-service', 'updateFamily');
    const family = requireFamily();
    const { recipient, ...rest } = patch;
    Object.assign(family, rest);
    if (recipient) Object.assign(family.recipient, recipient);
    audit({ category: 'circle', action: 'Updated family details', subject: family.name });
    persist();
    return respond(family);
  },

  async listMembers(): Promise<FamilyMember[]> {
    if (!config.useMocks) return backendNotConnected('family-service', 'listMembers');
    return respond(db.members);
  },

  async getMember(id: string): Promise<FamilyMember> {
    if (!config.useMocks) return backendNotConnected('family-service', 'getMember');
    const member = db.members.find((m) => m.id === id);
    return member ? respond(member) : notFound('That family member');
  },

  async inviteMember(input: InviteInput): Promise<FamilyMember> {
    if (!config.useMocks) return backendNotConnected('family-service', 'inviteMember');
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
    if (!config.useMocks) return backendNotConnected('family-service', 'updateMember');
    const member = db.members.find((m) => m.id === id);
    if (!member) return notFound('That family member');
    Object.assign(member, patch);
    audit({ category: 'circle', action: 'Updated a member profile', subject: member.name });
    persist();
    return respond(member);
  },

  async removeMember(id: string): Promise<void> {
    if (!config.useMocks) return backendNotConnected('family-service', 'removeMember');
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
    if (!config.useMocks) return backendNotConnected('family-service', 'getAccount');
    return db.account ? respond(db.account) : fail('Sign in first.', 401);
  },

  async updateAccount(patch: Partial<Pick<Account, 'name' | 'email' | 'phone' | 'about'>>): Promise<Account> {
    if (!config.useMocks) return backendNotConnected('family-service', 'updateAccount');
    if (!db.account) return fail('Sign in first.', 401);
    Object.assign(db.account, patch);
    const me = db.members.find((m) => m.id === db.account!.memberId);
    if (me) {
      if (patch.name) me.name = patch.name;
      if (patch.email) me.email = patch.email;
      if (patch.phone !== undefined) me.phone = patch.phone;
    }
    persist();
    return respond(db.account);
  },

  /**
   * Look up an invitation code.
   * MOCK: only families stored on this device can be found. Cross-device
   * invitations need the backend.
   */
  async lookupInvite(code: string): Promise<{ family: Family; inviterName: string; memberCount: number; alreadyMember: boolean }> {
    if (!config.useMocks) return backendNotConnected('family-service', 'lookupInvite');
    const normalized = code.trim().toUpperCase();
    if (!/^HEARTH-\d{3}$/.test(normalized)) return fail('Invitation codes look like HEARTH-123.', 422);
    if (!db.family || db.family.inviteCode !== normalized) return fail('We couldn’t find a family with that code. Check it with the person who invited you.', 404);
    const lead = db.members.find((m) => m.role === 'lead');
    return respond({
      family: db.family,
      inviterName: memberName(lead?.id),
      memberCount: db.members.filter((m) => m.status === 'active').length,
      alreadyMember: Boolean(db.account && db.family),
    });
  },
};
