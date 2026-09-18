import { config } from '../config';
import { readJSON, removeKey, writeJSON } from '@/lib/storage';

/**
 * HTTP client for the Hearth API gateway. Used by every service when
 * `VITE_USE_MOCKS=false`; with mocks on, nothing here runs.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/* ───────────────────────── session tokens ───────────────────────── */

const AUTH_KEY = 'hearth.auth';

interface StoredTokens {
  /** Short-lived access token, sent as `Authorization: Bearer …`. */
  token: string;
  /** Long-lived token used once to get a new pair when the access token expires. */
  refreshToken: string;
}

export const tokenStore = {
  get: () => readJSON<StoredTokens | null>(AUTH_KEY, null),
  set: (tokens: StoredTokens) => writeJSON(AUTH_KEY, tokens),
  clear: () => removeKey(AUTH_KEY),
};

/** Fired when the session can no longer be renewed, so the app can return to sign-in. */
export const SIGNED_OUT_EVENT = 'hearth:signed-out';

/* ───────────────────────── requests ───────────────────────── */

export interface ApiOptions extends Omit<RequestInit, 'body' | 'headers'> {
  /** Sent as JSON. A `FormData` body (file upload) is sent as it is. */
  body?: unknown;
  headers?: Record<string, string>;
  /** Public endpoint: do not attach the session token. */
  anonymous?: boolean;
}

function send(path: string, { body, anonymous, headers, ...init }: ApiOptions): Promise<Response> {
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  const token = anonymous ? undefined : tokenStore.get()?.token;
  return fetch(`${config.apiBaseUrl}${path}`, {
    ...init,
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    headers: {
      Accept: 'application/json',
      ...(body !== undefined && !isForm ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });
}

let refreshing: Promise<boolean> | null = null;

/** Swap the refresh token for a new pair. Concurrent callers share one request. */
function refreshTokens(): Promise<boolean> {
  const current = tokenStore.get();
  if (!current?.refreshToken) return Promise.resolve(false);
  refreshing ??= (async () => {
    try {
      const response = await send('/auth/refresh', { method: 'POST', anonymous: true, body: { refreshToken: current.refreshToken } });
      if (!response.ok) return false;
      const next = (await response.json()) as StoredTokens;
      tokenStore.set({ token: next.token, refreshToken: next.refreshToken });
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

const FALLBACK_MESSAGES: Record<number, string> = {
  401: 'Your session has ended. Sign in again.',
  403: 'You don’t have permission to do that.',
  404: 'That could not be found. It may have been removed.',
  503: 'Part of Hearth is not reachable right now. Please try again in a moment.',
};

/** The API answers errors as RFC 7807 problem documents; `detail` is written for the user. */
function messageFrom(status: number, details: unknown): string {
  if (details && typeof details === 'object') {
    const { detail, message } = details as { detail?: unknown; message?: unknown };
    if (typeof detail === 'string' && detail) return detail;
    if (typeof message === 'string' && message) return message;
  }
  return FALLBACK_MESSAGES[status] ?? 'Something went wrong. Please try again.';
}

export async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  if (!config.apiBaseUrl) {
    throw new ApiError('VITE_API_BASE_URL is not configured.', 0);
  }
  let response: Response;
  try {
    const used = options.anonymous ? null : tokenStore.get();
    response = await send(path, options);
    // An expired access token is renewed once, silently, and the request repeated.
    if (response.status === 401 && used) {
      // Another tab may have renewed the session already; then its tokens are in storage.
      const renewed = (await refreshTokens()) || (tokenStore.get() !== null && tokenStore.get()?.token !== used.token);
      if (renewed) {
        response = await send(path, options);
      } else {
        tokenStore.clear();
        window.dispatchEvent(new Event(SIGNED_OUT_EVENT));
      }
    }
  } catch {
    throw new ApiError('Hearth can’t be reached right now. Check your connection and try again.', 0);
  }

  if (!response.ok) {
    let details: unknown;
    try {
      details = await response.json();
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(messageFrom(response.status, details), response.status, details);
  }
  const text = response.status === 204 ? '' : await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** JSON drops `undefined`; the API reads `null` as "clear this field". Use for PATCH bodies. */
export function withNulls<T extends object>(patch: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(patch).map(([key, value]) => [key, value === undefined ? null : value]));
}

/** Query string from the defined values only, e.g. `?assigneeId=…`. */
export function query(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

/**
 * For the few operations that only make sense in the offline demo.
 * Thrown only when mocks are disabled (`VITE_USE_MOCKS=false`).
 */
export function backendNotConnected(service: string, operation: string): never {
  throw new ApiError(`${service}: "${operation}" is not available from the API.`, 501);
}
