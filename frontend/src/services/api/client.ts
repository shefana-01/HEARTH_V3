import { config } from '../config';
import { readJSON } from '@/lib/storage';

/**
 * HTTP client for the Hearth API gateway.
 *
 * Not called yet: every service currently resolves from `src/mocks`. When an
 * endpoint contract is agreed with the backend team, replace the matching
 * `backendNotConnected(...)` call in the service with `apiRequest(...)`.
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

const SESSION_KEY = 'hearth.session';

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!config.apiBaseUrl) {
    throw new ApiError('VITE_API_BASE_URL is not configured.', 0);
  }
  const session = readJSON<{ token?: string } | null>(SESSION_KEY, null);
  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    let details: unknown;
    try {
      details = await response.json();
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(`Request failed with status ${response.status}`, response.status, details);
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

/**
 * Placeholder for operations whose REST contract is not defined yet.
 * Thrown only when mocks are disabled (`VITE_USE_MOCKS=false`).
 */
export function backendNotConnected(service: string, operation: string): never {
  throw new ApiError(
    `${service}: "${operation}" is not connected to the backend yet. Enable mocks or implement the endpoint.`,
    501,
  );
}
