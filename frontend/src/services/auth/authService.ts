/**
 * Authentication — family-service / Keycloak (OAuth2 · OIDC) in the target
 * architecture. REST contract: not defined yet.
 *
 * MOCK behaviour: one account per browser, stored with the workspace.
 * Passwords are validated for strength in the UI but are NOT stored or checked
 * here — real credential handling belongs to the identity provider.
 */
import { backendNotConnected } from '../api/client';
import { config } from '../config';
import { clearWorkspace, db, emptyWorkspace, fail, newId, nowIso, replaceWorkspace, respond } from '../mockStore';
import { buildSampleWorkspace } from '@/mocks/sampleWorkspace';
import { readJSON, removeKey, writeJSON } from '@/lib/storage';
import type { Account } from '@/types/domain';

const SESSION_KEY = 'hearth.session';

export interface Session {
  account: Account;
  hasFamily: boolean;
  isSample: boolean;
}

export interface SignUpInput {
  name: string;
  email: string;
  password: string;
}

const sameEmail = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function sessionFor(account: Account): Session {
  writeJSON(SESSION_KEY, { accountId: account.id });
  return { account, hasFamily: Boolean(db.family), isSample: db.isSample };
}

export const authService = {
  /** Restore the session saved in this browser, if any. */
  async getSession(): Promise<Session | null> {
    if (!config.useMocks) return backendNotConnected('family-service', 'getSession');
    const saved = readJSON<{ accountId?: string } | null>(SESSION_KEY, null);
    if (!saved?.accountId || db.account?.id !== saved.accountId) return respond(null);
    return respond(sessionFor(db.account));
  },

  async signIn(email: string, _password: string): Promise<Session> {
    if (!config.useMocks) return backendNotConnected('family-service', 'signIn');
    if (!db.account || db.isSample || !sameEmail(db.account.email, email)) {
      return fail('We couldn’t find an account with that email on this device. Check the address or create an account.', 401);
    }
    return respond(sessionFor(db.account));
  },

  async signUp(input: SignUpInput): Promise<Session> {
    if (!config.useMocks) return backendNotConnected('family-service', 'signUp');
    if (db.account && !db.isSample) {
      return fail(
        sameEmail(db.account.email, input.email)
          ? 'An account with this email already exists. Sign in instead.'
          : 'This device already has a Hearth account. Sign in, or remove its local data from Settings first.',
        409,
      );
    }
    const memberId = newId('m');
    const account: Account = { id: newId('acc'), memberId, name: input.name.trim(), email: input.email.trim(), about: '' };
    replaceWorkspace({
      ...emptyWorkspace(),
      account,
      members: [
        {
          id: memberId,
          name: account.name,
          relation: '',
          role: 'lead',
          focus: 'Care coordination',
          email: account.email,
          status: 'active',
          skills: [],
          availability: { days: [true, true, true, true, true, false, false], windows: [] },
          access: { schedule: true, medical: true, documents: true },
          joinedAt: nowIso(),
        },
      ],
    });
    return respond(sessionFor(account));
  },

  /** Load the demo family and sign in as its lead caregiver. */
  async startSample(): Promise<Session> {
    if (!config.useMocks) return backendNotConnected('family-service', 'startSample');
    if (db.account && !db.isSample) {
      return fail('This device already has your own Hearth account. Remove its local data in Settings to explore the sample.', 409);
    }
    replaceWorkspace(buildSampleWorkspace());
    return respond(sessionFor(db.account!));
  },

  async signOut(): Promise<void> {
    removeKey(SESSION_KEY);
    if (db.isSample) clearWorkspace();
    return respond(undefined);
  },

  /** Permanently remove this device's account and family data (mock only). */
  async deleteLocalData(): Promise<void> {
    removeKey(SESSION_KEY);
    clearWorkspace();
    return respond(undefined);
  },

  async requestPasswordReset(_email: string): Promise<void> {
    if (!config.useMocks) return backendNotConnected('family-service', 'requestPasswordReset');
    return respond(undefined);
  },
};
