/**
 * Signing in and out — family-service (which delegates passwords and tokens to its
 * identity provider: built-in by default, Keycloak optionally).
 *
 * With the API: signing in returns an access token and a refresh token, kept
 * in local storage by `tokenStore`; `apiRequest` attaches and renews them.
 *
 * MOCK behaviour: one account per browser, stored with the workspace.
 * Passwords are validated for strength in the UI but are NOT stored or checked.
 */
import { ApiError, apiRequest, tokenStore } from '../api/client';
import { toAccount, type ApiAccount } from '../api/mappers';
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

interface ApiSession {
  account: ApiAccount;
  hasFamily: boolean;
  isSample: boolean;
}

interface AuthResponse {
  token: string;
  refreshToken: string;
  session: ApiSession;
}

const toSession = (session: ApiSession): Session => ({ ...session, account: toAccount(session.account) });

/** Keep the tokens for later requests and hand back the session. */
function remember(response: AuthResponse): Session {
  tokenStore.set({ token: response.token, refreshToken: response.refreshToken });
  return toSession(response.session);
}

async function sessionFromApi(): Promise<Session | null> {
  if (!tokenStore.get()) return null;
  try {
    return toSession(await apiRequest<ApiSession>('/auth/session'));
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

/** End the session on the server (the refresh token stops working) and forget it here. */
async function signOutOfApi(): Promise<void> {
  const tokens = tokenStore.get();
  tokenStore.clear();
  if (tokens) await apiRequest<void>('/auth/sign-out', { method: 'POST', anonymous: true, body: { refreshToken: tokens.refreshToken } }).catch(() => undefined);
}

const sameEmail = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function sessionFor(account: Account): Session {
  writeJSON(SESSION_KEY, { accountId: account.id });
  return { account, hasFamily: Boolean(db.family), isSample: db.isSample };
}

export const authService = {
  /** Restore the session saved in this browser, if any. */
  async getSession(): Promise<Session | null> {
    if (!config.useMocks) return sessionFromApi();
    const saved = readJSON<{ accountId?: string } | null>(SESSION_KEY, null);
    if (!saved?.accountId || db.account?.id !== saved.accountId) return respond(null);
    return respond(sessionFor(db.account));
  },

  async signIn(email: string, password: string): Promise<Session> {
    if (!config.useMocks) return remember(await apiRequest<AuthResponse>('/auth/sign-in', { method: 'POST', anonymous: true, body: { email: email.trim(), password } }));
    if (!db.account || db.isSample || !sameEmail(db.account.email, email)) {
      return fail('We couldn’t find an account with that email on this device. Check the address or create an account.', 401);
    }
    return respond(sessionFor(db.account));
  },

  async signUp(input: SignUpInput): Promise<Session> {
    if (!config.useMocks) {
      return remember(await apiRequest<AuthResponse>('/auth/sign-up', { method: 'POST', anonymous: true, body: { name: input.name.trim(), email: input.email.trim(), password: input.password } }));
    }
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
          focus: '',
          email: account.email,
          status: 'active',
          skills: [],
          availability: { days: [true, true, true, true, true, true, true], windows: [] },
          access: { schedule: true, medical: true, documents: true },
          joinedAt: nowIso(),
        },
      ],
    });
    return respond(sessionFor(account));
  },

  /** Load the demo family and sign in as its organiser. */
  async startSample(): Promise<Session> {
    if (!config.useMocks) throw new ApiError('The sample family is part of the offline demo. Create an account to use Hearth.', 501);
    if (db.account && !db.isSample) {
      return fail('This device already has your own Hearth account. Remove its local data in Settings to explore the sample.', 409);
    }
    replaceWorkspace(buildSampleWorkspace());
    return respond(sessionFor(db.account!));
  },

  async signOut(): Promise<void> {
    if (!config.useMocks) return signOutOfApi();
    removeKey(SESSION_KEY);
    if (db.isSample) clearWorkspace();
    return respond(undefined);
  },

  /**
   * Remove what this browser keeps. With the API that is only the session;
   * the account and family stay on the server.
   * MOCK: permanently removes this device's account and family data.
   */
  async deleteLocalData(): Promise<void> {
    if (!config.useMocks) return signOutOfApi();
    removeKey(SESSION_KEY);
    clearWorkspace();
    return respond(undefined);
  },

  async requestPasswordReset(email: string): Promise<void> {
    if (!config.useMocks) return apiRequest<void>('/auth/password-reset', { method: 'POST', anonymous: true, body: { email: email.trim() } });
    return respond(undefined);
  },

  /** Confirm the account's email address with the token from the emailed link. */
  async verifyEmail(token: string): Promise<void> {
    if (!config.useMocks) return apiRequest<void>('/auth/verify-email', { method: 'POST', anonymous: true, body: { token } });
    return respond(undefined);
  },

  /** Email the confirmation link again to the signed-in account. */
  async resendVerification(): Promise<void> {
    if (!config.useMocks) return apiRequest<void>('/auth/verify-email/resend', { method: 'POST' });
    return respond(undefined);
  },

  /** Set a new password with the token from the emailed reset link. MOCK: there is no email, so no link. */
  async confirmPasswordReset(token: string, password: string): Promise<void> {
    if (!config.useMocks) return apiRequest<void>('/auth/password-reset/confirm', { method: 'POST', anonymous: true, body: { token, password } });
    return fail('Resetting a password by email needs the Hearth backend.', 501);
  },
};
